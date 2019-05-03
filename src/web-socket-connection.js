const Logger = require(`${process.cwd()}/src/lib/logger`);
const Helper = require(`${process.cwd()}/src/lib/helper`);
const socketio = require('socket.io');

class WebSocketConnection {
  static setup(server) {
    this.io = socketio(server);
    this.io.on('connection', this.onConnection.bind(this));
    this.rooms = {};
  }

  static onConnection(socket) {
    let ip = socket.request.connection.remoteAddress;
    if (Helper.env === 'production') {
      [ip] = socket.request.headers['x-forwarded-for'].split(/\s*,\s*/);
    }
    Logger.log('connected', socket.id, ip);
    socket.ip = ip;

    socket.on('disconnect', reason => {
      Logger.log('disconnected', socket.id, reason);
      const roomId = this.getRoomIdfromSocketId(socket.id);
      this.removeSocketIdFromRooms(socket.id);
      if (roomId) {
        // Tell room that the socket left
        this.io.to(roomId).emit('ROOM_INFO', {
          ...this.rooms[roomId],
        });
      }
      // const removedRoomIds = this.removeSocketIdFromRooms(socket.id);
      // this.io.emit('ROOMS_REMOVED', { roomIds: removedRoomIds });
      for (const id of this.listSocketIds()) {
        const roomIds = this.getRoomsWithSameIP(this.io.sockets.connected[id].ip);
        // socket.broadcast.emit('LIST_ROOMS', { roomIds });
        this.io.sockets.connected[id].emit('LIST_ROOMS', { roomIds });
      }
    });

    socket.on('LIST_ROOMS', () => {
      const roomIds = this.getRoomsWithSameIP(socket.ip);
      this.io.sockets.connected[socket.id].emit('LIST_ROOMS', { roomIds });
    });

    socket.on('GENERATE_ROOM', () => {
      const roomId = this.createRoom();
      socket.emit('GENERATE_ROOM', { roomId });
      this.joinRoom(roomId, socket);
      for (const id of this.listSocketIds()) {
        const roomIds = this.getRoomsWithSameIP(this.io.sockets.connected[id].ip);
        // socket.broadcast.emit('LIST_ROOMS', { roomIds });
        this.io.sockets.connected[id].emit('LIST_ROOMS', { roomIds });
      }
    });

    socket.on('DESTROY_ROOM', ({ roomId }) => {
      this.destroyRoom(roomId);
      for (const id of this.listSocketIds()) {
        const roomIds = this.getRoomsWithSameIP(this.io.sockets.connected[id].ip);
        // socket.broadcast.emit('LIST_ROOMS', { roomIds });
        this.io.sockets.connected[id].emit('LIST_ROOMS', { roomIds });
      }
    });

    socket.on('JOIN_ROOM', ({ roomId }) => {
      if (!this.rooms[roomId]) {
        Logger.log('Room not present', roomId);
        socket.emit('ROOM_INFO', { error: 'Room not present' });
        return;
      }
      // console.log('JOIN_ROOM', roomId);
      this.joinRoom(roomId, socket);
      socket.join(roomId);
      this.io.to(roomId).emit('ROOM_INFO', {
        socketId: socket.id,
        ...this.rooms[roomId],
      });
    });

    socket.on('LEAVE_ROOM', ({ roomId }) => {
      // console.log('LEAVE_ROOM', roomId);
      this.removeSocketIdFromRooms(socket.id);
      // this.io.emit('LEAVE_ROOM', { socketId: socket.id });
      socket.broadcast.to(roomId).emit('ROOM_INFO', {
        socketId: socket.id,
        ...this.rooms[roomId],
      });
      socket.leave(roomId);
      for (const id of this.listSocketIds()) {
        const roomIds = this.getRoomsWithSameIP(this.io.sockets.connected[id].ip);
        // socket.broadcast.emit('LIST_ROOMS', { roomIds });
        this.io.sockets.connected[id].emit('LIST_ROOMS', { roomIds });
      }
    });

    socket.on('ROOM_READY', ({ roomId }) => {
      this.io.to(roomId).emit('ROOM_READY', { roomId });
    });

    socket.on('MSG_ROOM', data => {
      // console.log('MSG_ROOM', data);
      this.io.to(data.roomId).emit('MSG_ROOM', data);
    });

    /* --------------------- SimpleMultiPeer functions --------------------- */
    socket.on('PEERS_JOIN', ({ roomId }) => {
      // console.log('PEERS_LIST', socket.id, roomId);
      // this.io.to(firstId).emit('PEERS_LIST', { socketIds: this.rooms[roomId].socketIds });
      const firstId = this.rooms[roomId].socketIds[0];
      if (socket.id === firstId) {
        this.io.sockets.connected[firstId].emit('PEERS_LIST', {
          socketIds: this.rooms[roomId].socketIds,
        });
      }
    });

    socket.on('PEERS_SIGNAL', ({ roomId, socketId, signal }) => {
      // console.log('PEERS_SIGNAL', roomId, socket.id, socketId);
      socket.broadcast.to(roomId).emit('PEERS_SIGNAL', {
        socketId,
        socketIds: this.rooms[roomId].socketIds,
        signal,
      });
    });
  }

  /* --------------------- Fetch functions --------------------- */
  static listSockets() {
    if (!this.io) {
      Logger.info('this.io is not set');
    }
    return this.io.sockets.connected;
  }

  static listSocketIds() {
    return Object.keys(this.listSockets());
  }

  // static listRooms() {
  //   return this.io.sockets.adapter.rooms;
  // }

  static getRoomIdfromSocketId(socketId) {
    for (const roomId of Object.keys(this.rooms)) {
      if (this.rooms[roomId].socketIds.includes(socketId)) {
        return roomId;
      }
    }
    return null;
  }

  static getRoomsWithSameIP(ip) {
    const roomIds = [];
    for (const roomId of Object.keys(this.rooms)) {
      if (this.rooms[roomId].socketIds.length !== 0 && this.rooms[roomId].socketIds
        .every(socketId => this.io.sockets.connected[socketId].ip === ip)) {
        roomIds.push(roomId);
      }
    }
    return roomIds;
  }

  /* --------------------- Room functions --------------------- */
  static createRoom(roomId = null) {
    // Generate room id if none given
    if (!roomId) {
      do {
        roomId = (Math.floor(Math.random() * 9000) + 1000).toString();
      } while (this.rooms[roomId]);
    }

    this.rooms[roomId] = {
      roomId,
      createdAt: +new Date(),
      socketIds: [],
    };
    return roomId;
  }

  static destroyRoom(roomId) {
    for (const socketId of this.rooms[roomId].socketIds) {
      this.io.sockets.connected[socketId].disconnect(true);
    }
    delete this.rooms[roomId];
    Logger.log('destroyed', roomId);
  }

  static joinRoom(roomId, socket) {
    if (!this.rooms[roomId].socketIds.includes(socket.id)) {
      this.rooms[roomId].socketIds.push(socket.id);
    }
  }

  static addSocketIdToRoom(roomId, socketId) {
    if (!this.rooms[roomId]) {
      this.createRoom(roomId);
    }
    this.rooms[roomId].socketIds.push(socketId);
  }

  static removeSocketIdFromRooms(socketId) {
    const removedRoomIds = [];
    for (const roomId of Object.keys(this.rooms)) {
      // this.rooms[roomId].socketIds.splice(socketId, 1);
      this.rooms[roomId].socketIds = this.rooms[roomId].socketIds.filter(id => {
        if (id === socketId) {
          Logger.log(`Removing ${socketId} from room ${roomId}`);
        }
        return id !== socketId;
      });
      if (this.rooms[roomId].socketIds.length === 0) {
        removedRoomIds.push(roomId);
        this.destroyRoom(roomId);
      }
    }
    return removedRoomIds;
  }
}

module.exports = WebSocketConnection;
