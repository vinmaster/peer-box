import { Util } from './util';
import { reactive, ref } from 'vue';
import { IS_DEV } from '../lib/trpc';

let socket = new WebSocket(IS_DEV ? `ws://localhost:8000/ws` : `wss://${window.location.host}/ws`);
let isSetup = false;
let isConnected = ref(false);

export function useWs() {
  let message = ref({});

  function socketSetup(socket: WebSocket) {
    socket.onopen = () => {
      isConnected.value = true;
      console.log('socket open');
      Util.sendObject(socket, { type: 'LIST_ROOMS' });
    };
    socket.onclose = () => console.log('socket close');
    socket.onmessage = e => {
      message.value = e.data;
      console.log('socket message', e.data);
    };
    socket.onerror = e => console.error(e);
  }

  function send(obj: any) {
    socket.send(JSON.stringify(obj));
  }

  if (!isSetup) {
    isSetup = true;
    socketSetup(socket);
  }

  return { isConnected, message, send };
}
