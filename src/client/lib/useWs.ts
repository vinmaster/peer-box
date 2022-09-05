import { Util } from './util';
import { reactive, ref } from 'vue';
import { io } from 'socket.io-client';

export interface Event {
  key: string;
  data?: any;
}

let socket = io(Util.IS_DEV ? `ws://localhost:8000` : `wss://${window.location.host}`);
let isSetup = false;
let isConnected = ref(false);
let event = ref<Event>({ key: '' });

export function useWs() {
  function socketSetup() {
    socket.onAny((key, data) => {
      isConnected.value = true;
      event.value = { key, data };
      console.log('useWs', key, data);
    });
  }

  if (!isSetup) {
    isSetup = true;
    socketSetup();
  }

  return { isConnected, event, socket };
}
