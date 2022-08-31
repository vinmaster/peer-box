export class Manager {
  static rooms: Map<string, any> = new Map();

  static list() {
    return this.rooms.keys();
  }

  static create(id?: string) {
    if (!id) id = this.generateId();
    this.rooms.set(id, { socketIds: [] });
    return id;
  }

  static join(socket: WebSocket & { id: string; roomId?: string }, id: string) {
    if (!this.rooms.has(id)) {
      console.log('Room does not exist');
      return false;
    }

    let room = this.rooms.get(id);
    room.socketIds.push(socket.id);
    socket.roomId = id;
    return true;
  }

  static leave(socket: WebSocket & { id: string; roomId?: string }, id: string) {
    let room = this.rooms.get(id);
    let index = room.socketIds.indexOf(socket.roomId);
    room.socketIds.slice(index, 1);
    socket.roomId = undefined;
  }

  static generateId(): string {
    let num = Math.floor(Math.random() * 9999) + 1;
    return num.toString().padStart(4, '0');
  }
}
