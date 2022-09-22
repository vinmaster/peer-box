import { reactive, ref } from 'vue';
import { io } from 'socket.io-client';

export interface Event {
  key: string;
  data?: any;
}

let protocol = location.protocol === 'http:' ? 'ws' : 'wss';
let socket = io(
  (import.meta as any).env.DEV
    ? `${protocol}://localhost:8000`
    : `${protocol}://${window.location.host}`
);
let isSetup = false;
let isConnected = ref(false);
let event = ref<Event>({ key: '' });

export function useWs() {
  function socketSetup() {
    socket.onAny((key, data) => {
      isConnected.value = true;
      event.value = { key, data };
    });
  }

  if (!isSetup) {
    isSetup = true;
    socketSetup();
  }

  return { isConnected, event, socket };
}
