import util from 'node:util';
import { FastifyInstance } from 'fastify';
import { Util } from '../lib/util';
import { Server, Socket } from 'socket.io';

export interface RoomData {
  roomId: string;
  socketIds: string[];
  ip?: string;
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

  static async getSocketsByIp(ip?: string) {
    let sockets = [];
    if (ip) {
      for (let socket of await this.io.fetchSockets()) {
        if ((socket as any).ip === ip) sockets.push(socket);
      }
    }
    return sockets;
  }

  static createRoom(roomId?: string): RoomData {
    if (!roomId) roomId = this.newId();
    let room = { roomId, socketIds: [] };
    this.rooms.set(roomId, room);
    this.io.to('lobby').emit('CREATE_ROOM', { roomId });

    return room;
  }

  static destroyRoom(roomId: string) {
    this.rooms.delete(roomId);
    this.io.to('lobby').emit('DESTROY_ROOM', { roomId });
  }

  static leaveRoom(roomId: string, socketId: string) {
    if (this.rooms.has(roomId)) {
      let room = this.rooms.get(roomId)!;
      Util.remove(room.socketIds, socketId);
      if (room.socketIds.length === 0) this.destroyRoom(roomId);
      this.io.to(roomId).emit('LIST_ROOM', { socketIds: room?.socketIds });
    }
  }

  // EVENTS
  static disconnecting(socket: Socket) {
    for (let roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      this.leaveRoom(roomId, socket.id);
    }
  }

  static JOIN_ROOM(socket: Socket, data: any) {
    let { roomId } = data;
    socket.leave('lobby');
    socket.join(roomId);
    let room: RoomData;
    if (this.rooms.has(roomId)) {
      room = this.rooms.get(roomId)!;
    } else {
      room = this.createRoom(roomId);
      let socketIp = (socket as any).ip;
      if (socketIp) room.ip = socketIp;
    }
    if (!room.socketIds.includes(socket.id)) room.socketIds.push(socket.id);
    this.io.to(roomId).emit('LIST_ROOM', { socketIds: room?.socketIds });
  }

  static LEAVE_ROOM(socket: Socket, data: any) {
    let { roomId } = data;
    socket.leave(roomId);
    this.leaveRoom(roomId, socket.id);
  }

  static CHAT_MSG(socket: Socket, data: any) {
    this.io.to(data.roomId).emit('CHAT_MSG', data);
  }
}

export function wsRoutes(fastify: FastifyInstance, opts, done) {
  WebSocketService.io = fastify.io;

  fastify.io.on('connection', socket => {
    socket.join('lobby');
    let { headers } = socket.handshake;
    let forwarded = (headers['x-forwarded-for'] as string) || '';
    (socket as any).ip = forwarded.split(',')[0];

    socket.onAny((key, data) => {
      WebSocketService[key](socket, data);
    });

    socket.on('disconnecting', function () {
      WebSocketService['disconnecting'](socket);
    });
  });

  done();
}
