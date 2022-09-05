import util from 'node:util';
import { FastifyInstance } from 'fastify';
import { Util } from '../lib/util';
import { Server, Socket } from 'socket.io';

export interface RoomData {
  roomId: string;
  socketIds: string[];
}

export class WebSocketService {
  static rooms: Map<string, RoomData> = new Map();
  static io: Server;

  static newId() {
    let id = '';
    let tries = 0;
    let maxTries = 10;
    do {
      id = Util.generateId();
      tries += 1;
    } while (this.rooms.has(id) && tries < maxTries);

    if (tries >= maxTries) throw new Error('Ran out of ids');

    return id;
  }

  static createRoom(roomId?: string): RoomData {
    if (!roomId) roomId = this.newId();
    let room = { roomId, socketIds: [] };
    this.rooms.set(roomId, room);
    this.io.emit('CREATE_ROOM', { roomId });

    return room;
  }

  static destroyRoom(roomId: string) {
    this.rooms.delete(roomId);
    this.io.emit('DESTROY_ROOM', { roomId });
  }

  static joinRoom(roomId: string, socketId: string) {
    let room: RoomData;
    if (this.rooms.has(roomId)) {
      room = this.rooms.get(roomId)!;
    } else {
      room = this.createRoom(roomId);
    }
    if (!room.socketIds.includes(socketId)) room.socketIds.push(socketId);
  }

  static leaveRoom(roomId: string, socketId: string) {
    if (this.rooms.has(roomId)) {
      let room = this.rooms.get(roomId)!;
      Util.remove(room.socketIds, socketId);
      if (room.socketIds.length === 0) this.destroyRoom(roomId);
    }
  }

  // EVENTS
  static disconnecting(socket: Socket) {
    console.log('disconnecting', socket.id, socket.rooms);
    for (let roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      this.leaveRoom(roomId, socket.id);
    }
  }

  static JOIN_ROOM(socket: Socket, data: any) {
    let { roomId } = data;
    this.joinRoom(roomId, socket.id);
    socket.emit('LIST_ROOM', { socketIds: this.rooms.get(roomId)?.socketIds });
    socket.join(roomId);
    console.log('join room', roomId, socket.id);
  }

  static LEAVE_ROOM(socket: Socket, data: any) {
    let { roomId } = data;
    this.leaveRoom(roomId, socket.id);
    socket.leave(roomId);
    console.log('leave room', roomId, socket.id);
  }
}

export function wsRoutes(fastify: FastifyInstance, opts, done) {
  WebSocketService.io = fastify.io;

  fastify.io.on('connection', socket => {
    console.log('connect', socket.id);

    socket.onAny((key, data) => {
      console.log('on any', key);
      WebSocketService[key](socket, data);
    });

    socket.on('disconnecting', async function () {
      // let sockets = await fastify.io.fetchSockets();
      // sockets.map(s => s.id),
      WebSocketService['disconnecting'](socket);
    });

    // socket.on('JOIN_ROOM', data => {
    // });

    // socket.on('LEAVE_ROOM', data => {
    // });
  });

  done();
}
