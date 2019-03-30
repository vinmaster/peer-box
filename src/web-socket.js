const Logger = require(`${process.cwd()}/src/lib/logger`);
const Helper = require(`${process.cwd()}/src/lib/helper`);
const WebSocket = require('ws');

class WebSocketServer {
  static setup(server) {
    this.wss = new WebSocket.Server({ server });
    this.wss.broadcast = data => {
      for (const client of this.wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      }
    };
    this.wss.broadcastExceptId = (id, data) => {
      for (const client of this.wss.clients) {
        if (id !== client.id && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      }
    };
    this.wss.on('connection', this.connection.bind(this));
    this.clientCounter = 0;
    this.rooms = {};
  }

  static connection(ws, req) {
    this.clientCounter += 1;
    ws.id = this.clientCounter;
    let ip = req.connection.remoteAddress;
    if (Helper.env === 'production') {
      [ip] = req.headers['x-forwarded-for'].split(/\s*,\s*/);
    }
    Logger.log('connected', ws.id, ip);
    ws.ip = ip;
    // Logger.log('clients', this.wss.clients);
    // for (const client of this.wss.clients) {
    //   Logger.log(client.id);
    // }
    ws.on('message', data => {
      let obj;
      try {
        obj = JSON.parse(data);
      } catch (err) {
        Logger.log(data);
        return;
      }
      const { code } = obj;
      if (code === 'GENERATE_ROOM') {
        const id = this.createRoom(ws.id);
        Logger.log('GENERATE_ROOM', id, ws.id);
        ws.send(JSON.stringify({ code: 'GOTO_ROOM', id }));
        this.wss.broadcastExceptId(ws.id, { code: 'ROOM_CREATED', id });
      } else if (code === 'LEAVE_ROOM') {
        Logger.log('LEAVE_ROOM', obj.roomId, ws.id);
        const removedRooms = this.removeIdFromRooms(ws.id);
        this.wss.broadcastExceptId(ws.id, { code: 'ROOMS_REMOVED', ids: removedRooms });
      } else {
        Logger.log('Code not supported', data);
      }
    });
    ws.on('close', (_code, reason) => {
      Logger.log('close', ws.id, reason);
      const removedRooms = this.removeIdFromRooms(ws.id);
      this.wss.broadcastExceptId(ws.id, { code: 'ROOMS_REMOVED', ids: removedRooms });
    });
    // ws.send('test from server');
    // ws.terminate();
  }

  static createRoom(hostId) {
    let id;
    do {
      id = Math.floor(Math.random() * 9000) + 1000;
    } while (this.rooms[id]);
    this.rooms[id] = {
      hostId,
      clients: [],
    };
    Logger.log(`Created room ${id}`);
    return id;
  }

  static removeRoom(roomId) {
    for (const client of this.rooms[roomId].clients) {
      client.terminate();
    }
    delete this.rooms[roomId];
  }

  static removeIdFromRooms(clientId) {
    const removedRooms = [];
    for (const key of Object.keys(this.rooms)) {
      // this.rooms[key].clients.splice(clientId, 1);
      this.rooms[key].clients = this.rooms[key].clients.filter(client => {
        if (client.id === clientId) {
          Logger.log(`Removing ${clientId} from room ${key}`);
        }
        return client.id !== clientId;
      });
      if (this.rooms[key].clients.length === 0) {
        removedRooms.push(key);
        this.removeRoom(key);
      }
    }
    return removedRooms;
  }
}

module.exports = WebSocketServer;
