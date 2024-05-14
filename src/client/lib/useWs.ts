import { ref } from 'vue';
import { Socket, io } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '../../common/constants';

export interface Event {
  key: string;
  data?: any;
}

let protocol = location.protocol === 'http:' ? 'ws' : 'wss';
let socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  (import.meta as any).env.DEV
    ? `${protocol}://localhost:8000`
    : `${protocol}://${window.location.host}`,
  { reconnection: false }
);
let isConnected = ref(false);
let event = ref<Event>({ key: '' });

socket.on('disconnect', (reason: any) => {
  console.log('disconnect', reason);
  isConnected.value = false;
});

socket.on('connect', () => {
  isConnected.value = true;
});

socket.onAny((key, data) => {
  event.value = { key, data };
});

export function useWs() {
  return { isConnected, event, socket };
}
