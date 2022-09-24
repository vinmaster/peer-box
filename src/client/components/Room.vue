<script setup lang="ts">
import { computed, onMounted, onUnmounted, Ref, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { client } from '../lib/trpc';
import { useWs } from '../lib/useWs';
import { Util } from '../../common/util';
import * as FilePond from 'filepond';
import { SimpleMultiPeer } from '../lib/simple-multi-peer';
import Chat from './Chat.vue';
import 'filepond/dist/filepond.min.css';

interface Message {
  roomId: string;
  type: string;
  sender: string;
  text: string;
  timestamp: number;
}

let route = useRoute();
let roomId = ref('');
let isReady = ref(false);
let { isConnected, event, socket } = useWs();
let socketId = ref(socket.id);
let socketIds: Ref<string[]> = ref([]);
let upload = ref(null);
let pond: FilePond.FilePond;
let peerConnection: SimpleMultiPeer;

onMounted(() => {
  // socket.close();
  let { id } = route.params as { id?: string; };
  if (!id) {
    throw new Error('No room id found');
  }
  roomId.value = id as string;
  socket.emit('JOIN_ROOM', { roomId: id });
  peerConnection = new SimpleMultiPeer({
    socket, roomId: id, callbacks: {
      connect: (socketId) => {
        console.log('connect', socketId);
      },
      signal: (socketId) => {
        console.log('signal', socketId);
      },
      data: (socketId, data) => {
        console.log('data', socketId, JSON.parse(data));
      },
      close: (socketId) => {
        console.log('close', socketId);
      },
    }
  });

  pond = FilePond.create(upload.value, {
    instantUpload: false,
    server: {
      process,
    }
  });

  pond.on('addfile', (error, file: FilePond.FilePondFile) => {
    if (Object.keys(file.getMetadata()).length === 0) {
      file.setMetadata('socketId', socketId.value);
      file.setMetadata('isDone', true);
    }
    console.log('metadata', file);
  });
});

onUnmounted(() => {
  console.log('unmount');
  peerConnection.close();
  socket.emit('LEAVE_ROOM', { roomId: roomId.value });
});

watch(isConnected, () => {
  if (!socketId.value) socketId.value = socket?.id;
});

watch(event, ({ key, data }: any) => {
  if (key === 'LIST_ROOM') {
    isReady.value = true;
    socketIds.value = data.socketIds;
  }
});

let process: FilePond.ProcessServerConfigFunction = (fieldName, file, metadata, load, error, progress, abort, transfer, options) => {
  console.log(file, metadata);
  return {
    abort: () => {
      console.log('aborting');
      abort();
    }
  };
};

function button1() {
  console.log('click 1', peerConnection.peers.size);
  pond.addFile('files', { type: 'local' });
  peerConnection.sendStringify('test data');
}
</script>

<template>
  <div class="font-sans antialiased bg-gray-800 pt-12 pb-5 text-white">
    <div class="flex flex-col justify-center sm:w-96 sm:m-auto mx-5 space-y-5">
      <div class="text-4xl text-center">Room {{ roomId }}</div>
      <div class="flex flex-col rounded-lg border border-gray-200">
        <div class="text-xl text-center p-2 bg-sky-500 rounded-t-lg">In this room</div>
        <div class="border-t border-gray-200 w-full p-2" v-for="id in socketIds" :key="id">{{ id }}<span
            v-if="id == socketId" class="text-sky-400"> (You)</span></div>
      </div>
    </div>

    <div class="pt-5 max-w-screen-md mx-auto w-full flex flex-col">
      <div class="text-2xl mb-2">Files<span class="ml-2 p-1 text-sm rounded"
          :class="[isReady ? 'bg-green-500' : 'bg-red-500']">Status: {{ isReady ? 'Ready' : 'Waiting' }}</span></div>
      <input class="upload-input" type="file" multiple ref="upload" />
      <button class="py-2 rounded-lg border border-gray-200" @click="button1()">Button 1</button>
    </div>

    <div class="pt-5 max-w-screen-md mx-auto w-full flex flex-col max-h-80" style="min-height: 20rem;">
      <Chat :room-id="roomId"></Chat>
    </div>
  </div>
</template>

<style scoped>
.message {
  min-width: 16rem;
}

.message-content {
  white-space: pre;
}

.copy-btn {
  cursor: pointer;
}
</style>
