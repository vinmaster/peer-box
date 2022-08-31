export class Util {
  static sendObject(socket: WebSocket, x: any) {
    return socket.send(JSON.stringify(x));
  }
}
