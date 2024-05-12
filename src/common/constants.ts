export interface ServerToClientEvents {
  // basicEmit: (a: number, b: string, c: Buffer) => void;
  // withAck: (d: string, callback: (e: number) => void) => void;
  ADD_FILE: (data: any) => void;
  ROOM_CREATED: ({ roomId }: { roomId: string }) => void;
  DESTROY_ROOM: ({ roomId }: { roomId: string }) => void;
  LEAVE_ROOM: ({ socketIds, socketId }: { socketIds: string[]; socketId: string }) => void;
  LIST_ROOM: ({ users }: { users: string[] }) => void;
  ROOM_INFO: ({ room }: { room: any }) => void;
  CHAT_MSG: (data: any) => void;
  PEERS_START: ({ socketIds, initiator }: { socketIds: string[]; initiator: boolean }) => void;
  REMOVE_FILE: (data: any) => void;
  RECEIVE_FILE: (data: any) => void;
  RECEIVED_FILE: (data: any) => void;
  ABORT_FILE: ({ roomId, id }: { roomId: string; id: string }) => void;
  COMPLETED_FILE: ({ roomId, id }: { roomId: string; id: string }) => void;
  PEERS_SIGNAL: ({ socketId, signal }: { socketId: string; signal: any }) => void;
}

export interface ClientToServerEvents {
  ADD_FILE: (file: any) => void;
  JOIN_ROOM: ({ roomId }: { roomId: string }) => void;
  CREATE_ROOM: (callback: (roomId: string) => void) => void;
  ROOM_CREATED: ({ roomId }: { roomId: string }) => void;
  DESTROY_ROOM: ({ roomId }: { roomId: string }) => void;
  LEAVE_ROOM: ({ roomId }: { roomId: string }) => void;
  CHAT_MSG: (data: {
    roomId: string;
    type: string;
    sender?: string;
    text: string;
    timestamp: number;
  }) => void;
  ABORT_FILE: ({ roomId, id }: { roomId: string; id: string }) => void;
  UPLOAD_FILE: ({
    roomId,
    id,
    chunkIndex,
    arrayBuffer,
  }: {
    roomId: string;
    id: string;
    chunkIndex: number;
    arrayBuffer: Uint8Array;
  }) => void;
  COMPLETED_FILE: ({ roomId, id }: { roomId: string; id: string }) => void;
  REMOVE_FILE: (data: any) => void;
  RECEIVE_FILE: (data: any) => void;
  RECEIVED_FILE: (data: any) => void;
}
