<script setup lang="ts">
import { computed, onMounted, onUnmounted, Ref, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { client } from '../lib/trpc';
import { useWs } from '../lib/useWs';
import { Util } from '../../common/util';
import * as FilePond from 'filepond';
import { SimpleMultiPeer } from '../lib/simple-multi-peer';
import Chat from './Chat.vue';
import { ArrowDownTrayIcon } from '@heroicons/vue/24/outline';
import 'filepond/dist/filepond.min.css';

interface Message {
  roomId: string;
  type: string;
  sender: string;
  text: string;
  timestamp: number;
}

interface IncomingFile {
  id: string;
  currentFileSize: number;
  data?: ArrayBuffer;
  filename: string;
  fileSize: number;
  fileType: string;
  fileExt: string;
  lastModified: number;
}

let route = useRoute();
let roomId = ref('');
let isReady = ref(false);
let { isConnected, event, socket } = useWs();
let filesIncoming: Ref<IncomingFile[]> = ref([]);
let socketId = ref(socket.id);
let socketIds: Ref<string[]> = ref([]);
let uploadElement = ref(null);
let pond: FilePond.FilePond;
let peerConnection: SimpleMultiPeer;

onMounted(() => {
  // socket.close();
  let { id } = route.params as { id?: string; };
  if (!id) {
    throw new Error('No room id found');
  }
  roomId.value = id as string;
  registerSocket();
  socket.emit('JOIN_ROOM', { roomId: id });
  // filesIncoming.value.push({
  //   "id": "ymgzz1p64",
  //   currentFileSize: 312443,
  //   "filename": "Android Bluetooth SDK Documentation (12.0).pdf",
  //   "fileSize": 312443,
  //   "fileType": "application/pdf",
  //   "fileExt": "pdf",
  //   "lastModified": 1632511628839
  // });

  // peerConnection = new SimpleMultiPeer({
  //   socket, roomId: id, callbacks: {
  //     connect: (socketId) => {
  //       console.log('connect', socketId);
  //     },
  //     signal: (socketId) => {
  //       console.log('signal', socketId);
  //     },
  //     data: (socketId, data) => {
  //       try {
  //         let parsed = JSON.parse(data);
  //         console.log('data', socketId, parsed);
  //         if (parsed.payloadType === 'ADD_FILE') {
  //           filesIncoming.value.push(parsed as IncomingFile);
  //         } else if (parsed.payloadType === 'UPLOAD_START') {
  //         }
  //       } catch (error) {

  //       }
  //     },
  //     close: (socketId) => {
  //       peerConnection.onPeerClose(socketId);
  //       console.log('close', socketId);
  //     },
  //   }
  // });
  peerConnection = {} as any;

  pond = FilePond.create(uploadElement.value, {
    instantUpload: false,
    server: {
      process,
    }
  });

  pond.on('addfile', (error, file: FilePond.FilePondFile) => {
    if (Object.keys(file.getMetadata()).length === 0) {
      file.setMetadata('socketId', socketId.value);
      file.setMetadata('currentFileSize', 0);
      file.setMetadata('id', file.id);
    }
    console.log('addfile', file);
    socket.emit('ADD_FILE', {
      roomId: roomId.value,
      id: file.id,
      currentFileSize: 0,
      filename: file.filename,
      fileSize: file.fileSize,
      fileType: file.fileType,
      fileExt: file.fileExtension,
      lastModified: file.file.lastModified,
    });
    // peerConnection.sendStringify({
    //   payloadType: 'ADD_FILE',
    //   id: file.id,
    //   filename: file.filename,
    //   fileSize: file.fileSize,
    //   fileType: file.fileType,
    //   fileExt: file.fileExtension,
    //   lastModified: file.file.lastModified,
    // });
  });

  pond.on('removefile', (error, file: FilePond.FilePondFile) => {
    console.log('removefile', file.getMetadata());
    socket.emit('REMOVE_FILE', {
      roomId: roomId.value,
      id: file.id,
    });
  });
});

onUnmounted(() => {
  console.log('unmount');
  // peerConnection.close();
  unregisterSocket();
  socket.emit('LEAVE_ROOM', { roomId: roomId.value });
});

watch(isConnected, () => {
  if (!socketId.value) socketId.value = socket?.id;
});

watch(event, ({ key, data }: any) => {
  if (key === 'LIST_ROOM') {
    isReady.value = true;
    socketIds.value = data.socketIds;
  } else if (key === 'LEAVE_ROOM') {
    // peerConnection.onPeerClose(data.socketId);
  }
});

let process: FilePond.ProcessServerConfigFunction = (fieldName, file, metadata, load, error, progress, abort, transfer, options) => {
  console.log('process', file, metadata);
  upload(file, metadata);
  return {
    abort: () => {
      console.log('aborting');
      abort();
    }
  };
};

async function upload(file, metadata) {
  socket.emit('UPLOAD_FILE', {
    roomId: roomId.value,
    id: metadata.id,
    arrayBuffer: await file.arrayBuffer(),
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    var fr = new FileReader();
    fr.onload = () => {
      resolve(fr.result);
    };
    fr.onerror = reject;
    fr.readAsText(file.blob);
  });
}

function download(file: IncomingFile) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([file.data], { type: file.fileType }));
  a.download = file.filename;
  a.click();
}

function getFileStyles(file: IncomingFile) {
  return {
    backgroundColor: `hsl(${filePercentage(file) + 50},100%,50%)`,
  };
}

function filePercentage(file: IncomingFile) {
  return Math.ceil(file.currentFileSize / file.fileSize * 100);
}

function registerSocket() {
  socket.on('ADD_FILE', (data: any) => {
    console.log('socket add file', data);
    filesIncoming.value.push(data);
  });
  socket.on('REMOVE_FILE', (data: any) => {
    console.log('socket remove file', data);
    let index = filesIncoming.value.findIndex(f => f.id === data.id);
    if (index !== -1) filesIncoming.value.splice(index, 1);
  });
  socket.on('UPLOAD_FILE', (data: any) => {
    console.log('socket upload file', data);
    let index = filesIncoming.value.findIndex(f => f.id === data.id);
    if (index !== -1) {
      filesIncoming.value[index].data = data.arrayBuffer;
      filesIncoming.value[index].currentFileSize = filesIncoming.value[index].data.byteLength;
    }
  });
}

function unregisterSocket() {
  socket.off('ADD_FILE');
  socket.off('REMOVE_FILE');
  socket.off('UPLOAD_FILE');
}

function arrayBufferToBuffer(ab) {
  let buffer = Buffer.alloc(ab.byteLength);
  let copy = new Uint8Array(ab);
  for (let i = 0; i < buffer.length; ++i) {
    buffer[i] = copy[i];
  }
  return buffer;
}

function onUpload() {
  pond.processFiles();
  // console.log('click 1', peerConnection.peers.size);
  // peerConnection.sendStringify('test data');
}
</script>

<template>
  <div class="font-sans antialiased bg-gray-800 pt-12 p-5 text-white">
    <div class="flex flex-col justify-center sm:w-96 sm:m-auto mx-5 space-y-5">
      <div class="text-4xl text-center">Room {{ roomId }}</div>
      <div class="flex flex-col rounded-lg border border-gray-200">
        <div class="text-xl text-center p-2 bg-sky-500 rounded-t-lg">In this room</div>
        <div class="border-t border-gray-200 w-full p-2" v-for="id in socketIds" :key="id">{{ id }}<span
            v-if="id == socketId" class="text-sky-400"> (You)</span></div>
      </div>
    </div>

    <div class="pt-5 max-w-screen-md mx-auto w-full flex flex-col">
      <div class="text-2xl mb-2">Files Received<span class="ml-2 p-1 text-sm rounded"
          :class="[isReady ? 'bg-green-500' : 'bg-red-500']">Status: {{ isReady? 'Ready': 'Waiting' }}</span>
      </div>
      <div class="file-container mb-4">
        <ul class="grid gap-2">
          <li class="file-item" v-for="file in filesIncoming" :style="getFileStyles(file)">
            <div class="flex flex-col">
              <label>{{ file.filename }}</label>
              <label class="text-xs">
                {{ Util.formatBytes(file.fileSize) }} - {{
                  new Date(file.lastModified).toLocaleString()
                }}
              </label>
            </div>
            <div class="ml-auto"></div>
            <div>{{ filePercentage(file) }}%</div>
            <ArrowDownTrayIcon class="h-4 w-4 text-black mr-2" v-if="file.currentFileSize === file.fileSize"
              @click="download(file)" />
          </li>
        </ul>
      </div>
      <div class="text-2xl mb-2">Files Send</div>
      <input class="upload-input" type="file" multiple ref="uploadElement" />
      <button class="font-bold py-2 rounded-lg border border-gray-200 bg-sky-500 cursor-pointer"
        @click="onUpload()">UPLOAD</button>
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

.file-container {
  min-height: 4.75em;
  background-color: #f1f0ef;
  color: black;
  border-radius: 0.5em;
  padding: 1em;
}

.file-item {
  border-radius: 0.5em;
  padding: 0.5625em;
  display: flex;
  align-items: center;
}
</style>
