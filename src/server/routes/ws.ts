import util from 'node:util';
import { SocketStream } from '@fastify/websocket';
import { FastifyInstance } from 'fastify';
import * as WebSocket from 'ws';
import { Manager } from '../lib/manager';

let rooms: Map<string, any> = new Map();
let maxId = 1;

function isObject(x: any) {
  return x !== null && typeof x === 'object';
}

export function wsRoutes(fastify: FastifyInstance, opts, done) {
  function getClients(): Set<WebSocket> {
    return fastify.websocketServer.clients;
  }

  function broadcast(message) {
    for (let client of getClients()) {
      client.send(JSON.stringify(message));
    }
  }

  fastify.get('/', { websocket: true }, async (connection: SocketStream, request) => {
    connection.socket.id = maxId++;
    console.log('connected', connection.socket.id, request.ip);

    connection.socket.on('close', () => {
      console.log('close', connection.socket.id, getClients().values.name);
      Manager.leave(connection.socket, connection.socket.roomId);
    });

    connection.socket.on('message', message => {
      message = JSON.parse(message.toString());
      if (isObject(message)) {
        let { type, data } = message;
        console.log('isObject', type, data);
        if (type === 'JOIN_ROOM') {
          Manager.join(connection.socket, data.id);
        }
      } else {
        throw new Error(`Object is expected but got: ${message}`);
      }
      connection.socket.send(JSON.stringify(message));
    });
  });

  done();
}
