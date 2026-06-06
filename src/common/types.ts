export interface FileData {
  socketId: string;
  id: string;
  filename: string;
  fileSize: number;
  fileType: string;
  fileExt: string;
  lastModified: number | string;
}

export interface IncomingFile extends FileData {
  currentFileSize: number;
  data?: Uint8Array;
}

export interface RoomData {
  roomId: string;
  socketIds: string[];
  names: Record<string, string>;
  files: FileData[];
  ip?: string;
}

export interface CurrentUpload {
  arrayBuffer: Uint8Array;
  chunkIndex: number;
  roomId: string;
  id: string;
}

export interface Message {
  roomId: string;
  type: string;
  sender: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface ServerToClientEvents {
  ADD_FILE: (data: FileData) => void;
  ROOM_CREATED: ({ roomId }: { roomId: string }) => void;
  DESTROY_ROOM: ({ roomId }: { roomId: string }) => void;
  LEAVE_ROOM: ({ socketIds, socketId }: { socketIds: string[]; socketId: string }) => void;
  LIST_ROOM: ({ users, names }: { users: string[]; names: Record<string, string> }) => void;
  ROOM_INFO: ({ room }: { room: RoomData }) => void;
  CHAT_MSG: (data: Message) => void;
  REMOVE_FILE: (data: { roomId: string; id: string }) => void;
  RECEIVE_FILE: (data: CurrentUpload) => void;
  RECEIVED_FILE: (data: CurrentUpload) => void;
  ABORT_FILE: ({ roomId, id }: { roomId: string; id: string }) => void;
  COMPLETED_FILE: ({ roomId, id }: { roomId: string; id: string }) => void;
}

export interface ClientToServerEvents {
  ADD_FILE: (file: FileData & { roomId: string }) => void;
  JOIN_ROOM: ({ roomId }: { roomId: string }) => void;
  CREATE_ROOM: (callback: (roomId: string) => void) => void;
  ROOM_CREATED: ({ roomId }: { roomId: string }) => void;
  DESTROY_ROOM: ({ roomId }: { roomId: string }) => void;
  LEAVE_ROOM: ({ roomId }: { roomId: string }) => void;
  CHAT_MSG: (data: Message) => void;
  ABORT_FILE: ({ roomId, id }: { roomId: string; id: string }) => void;
  UPLOAD_FILE: (data: CurrentUpload) => void;
  COMPLETED_FILE: ({ roomId, id }: { roomId: string; id: string }) => void;
  REMOVE_FILE: (data: { roomId: string; id: string }) => void;
  RECEIVE_FILE: (data: CurrentUpload) => void;
  RECEIVED_FILE: (data: CurrentUpload) => void;
}
