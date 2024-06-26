<script setup lang="ts">
import { computed, onMounted, onUnmounted, Ref, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useWs } from '../lib/useWs';
import { Util } from '../../common/util';
import * as FilePond from 'filepond';
import { SimpleMultiPeer } from '../lib/simple-multi-peer';
import Chat from './Chat.vue';
import { ArrowDownTrayIcon } from '@heroicons/vue/24/outline';
import 'filepond/dist/filepond.min.css';
import { renderSVG } from 'uqr';

interface IncomingFile {
  id: string;
  currentFileSize: number;
  data?: Uint8Array;
  filename: string;
  fileSize: number;
  fileType: string;
  fileExt: string;
  lastModified: number;
}

interface CurrentUpload {
  arrayBuffer: Uint8Array;
  chunkIndex: number;
  roomId: string;
  id: string;
}

// 0.5 MiB
const CHUNK_SIZE = 524288;
let route = useRoute();
let roomId = ref('');
let isReady = ref(false);
let { isConnected, event, socket } = useWs();
let filesIncoming: Ref<IncomingFile[]> = ref([]);
let socketId = ref(socket.id);
let socketIds: Ref<string[]> = ref([]);
let names: Ref<Record<string, string>> = ref({});
let uploadElement = ref(null);
let currentUpload: CurrentUpload | null = null;
let pond: FilePond.FilePond;
let peerConnection: SimpleMultiPeer;
let uploaderMetadata: Record<string, { completed: number, load: Function; }> = {};
let qrcode = renderSVG(window.location.href);

onMounted(() => {
  // socket.close();
  let { id } = route.params as { id?: string; };
  if (!id) {
    throw new Error('No room id found');
  }
  roomId.value = id;
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

  // peerConnection = {} as any;

  pond = FilePond.create(uploadElement.value!, {
    instantUpload: false,
    server: {
      process,
      revert,
    }
  });

  pond.on('addfile', (error, file: FilePond.FilePondFile) => {
    if (Object.keys(file.getMetadata()).length === 0) {
      file.setMetadata('socketId', socketId.value);
      file.setMetadata('id', file.id);
    }
    let incomingFile = {
      roomId: roomId.value,
      id: file.id,
      currentFileSize: 0,
      filename: file.filename,
      fileSize: file.fileSize,
      fileType: file.fileType,
      fileExt: file.fileExtension,
      lastModified: file.file.lastModified,
    };
    socket.emit('ADD_FILE', incomingFile);
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
    socket.emit('REMOVE_FILE', {
      roomId: roomId.value,
      id: file.id,
    });
  });
});

onUnmounted(() => {
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
    socketIds.value = data.users;
    names.value = data.names;
  } else if (key === 'LEAVE_ROOM') {
    // peerConnection.onPeerClose(data.socketId);
  }
});

let process: FilePond.ProcessServerConfigFunction = (fieldName, file, metadata, load, error, progress, abort, transfer, options) => {
  // console.log('process', file, metadata);
  uploaderMetadata[metadata.id] = {
    completed: 0,
    load,
  };
  upload(file as File, metadata);

  return {
    abort: () => {
      console.log('aborting');
      metadata.abort = true;
      socket.emit('ABORT_FILE', {
        roomId: roomId.value,
        id: metadata.id,
      });
      abort();
    }
  };
};
let revert: FilePond.RevertServerConfigFunction = (uniqueFileId, load, error) => {
  socket.emit('ABORT_FILE', {
    roomId: roomId.value,
    id: uniqueFileId,
  });
};

async function upload(file: File, metadata: any) {
  let arrayBuffer = new Uint8Array(await file.arrayBuffer());
  // let arrayBuffer = new Uint8Array(await getFileArrayBuffer(file));

  currentUpload = {
    arrayBuffer,
    chunkIndex: 0,
    roomId: roomId.value,
    id: metadata.id,
  };

  // socket.emit('UPLOAD_FILE', {
  //   roomId: roomId.value,
  //   id: metadata.id,
  //   arrayBuffer,
  // });
  // return;

  // for (let chunk = 0; chunk < arrayBuffer.byteLength; chunk += CHUNK_SIZE) {
  //   if (metadata.abort) {
  //     return;
  //   }
  //   socket.emit('UPLOAD_FILE', {
  //     roomId: roomId.value,
  //     id: metadata.id,
  //     arrayBuffer: arrayBuffer.slice(chunk, chunk + CHUNK_SIZE),
  //   });
  //   await Util.sleep(1);
  // }
  let start = currentUpload.chunkIndex * CHUNK_SIZE;
  let end = Math.min((currentUpload.chunkIndex + 1) * CHUNK_SIZE, currentUpload.arrayBuffer.byteLength);
  socket.emit('UPLOAD_FILE', {
    roomId: currentUpload.roomId,
    id: currentUpload.id,
    chunkIndex: currentUpload.chunkIndex,
    arrayBuffer: currentUpload.arrayBuffer.slice(start, end),
  });
  currentUpload.chunkIndex += 1;
}

async function download(file: IncomingFile) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([file.data as any], { type: file.fileType }));
  // a.href = URL.createObjectURL(new Blob([file.data], { type: 'application/octet-stream' }));
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  await Util.sleep(1000);
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function getFileStyles(file: IncomingFile) {
  return {
    backgroundColor: `hsl(${filePercentage(file) + 50},100%,50%)`,
  };
}

function registerSocket() {
  socket.on('ADD_FILE', (data: any) => {
    // console.log('socket add file', data);
    filesIncoming.value.push(data);
  });
  socket.on('REMOVE_FILE', (data: any) => {
    // console.log('socket remove file', data);
    let index = filesIncoming.value.findIndex(f => f.id === data.id);
    if (index !== -1) filesIncoming.value.splice(index, 1);
  });
  socket.on('RECEIVE_FILE', (data: CurrentUpload) => {
    let index = filesIncoming.value.findIndex(f => f.id === data.id);
    if (index !== -1) {
      let file = filesIncoming.value[index];
      if (file.data) {
        file.data = arrayBufferAppend(file.data, new Uint8Array(data.arrayBuffer));
      } else {
        file.data = new Uint8Array(data.arrayBuffer);
      }
      file.currentFileSize = file.data!.byteLength;

      if (file.currentFileSize === file.fileSize) {
        socket.emit('COMPLETED_FILE', {
          roomId: roomId.value,
          id: file.id,
        });
      } else {
        socket.emit('RECEIVED_FILE', data);
      }
    }
  });
  socket.on('RECEIVED_FILE', (data: any) => {
    if (!currentUpload) return;
    let start = currentUpload.chunkIndex * CHUNK_SIZE;
    let end = Math.min((currentUpload.chunkIndex + 1) * CHUNK_SIZE, currentUpload.arrayBuffer.byteLength);
    socket.emit('UPLOAD_FILE', {
      roomId: currentUpload.roomId,
      id: currentUpload.id,
      chunkIndex: currentUpload.chunkIndex,
      arrayBuffer: currentUpload.arrayBuffer.slice(start, end),
    });
    currentUpload.chunkIndex += 1;
  });
  socket.on('ABORT_FILE', (data: any) => {
    let index = filesIncoming.value.findIndex(f => f.id === data.id);
    if (index !== -1) {
      delete filesIncoming.value[index].data;
    }
    filesIncoming.value[index].currentFileSize = 0;
  });
  socket.on('COMPLETED_FILE', (data: any) => {
    if (!uploaderMetadata[data.id]) return;
    let metadata = uploaderMetadata[data.id];
    metadata.completed += 1;
    metadata.load(data.id);
    // metadata.progress(false, metadata.completed, users.value.length - 1);
  });
  socket.on('ROOM_INFO', (data: any) => {
    let room = data.room;
    // console.log('ROOM_INFO', room);
    if (room.files) {
      for (let f of room.files) {
        // filesIncoming.value.push(f);
      }
    }
  });
}

function arrayBufferAppend(a: Uint8Array, b: Uint8Array): Uint8Array {
  let arrayBuffer = new Uint8Array(a.byteLength + b.byteLength);
  arrayBuffer.set(a);
  arrayBuffer.set(b, a.byteLength);
  return arrayBuffer;
}

function unregisterSocket() {
  socket.off('ADD_FILE');
  socket.off('REMOVE_FILE');
  socket.off('RECEIVE_FILE');
  socket.off('RECEIVED_FILE');
  socket.off('ABORT_FILE');
  socket.off('COMPLETED_FILE');
  socket.off('ROOM_INFO');
}

function onUpload() {
  pond.processFiles();
  // console.log('click 1', peerConnection.peers.size);
  // peerConnection.sendStringify('test data');
}

function filePercentage(file: IncomingFile) {
  return Math.ceil(file.currentFileSize / file.fileSize * 100);
}

// Unused code
function readFile(file: any) {
  return new Promise((resolve, reject) => {
    var fr = new FileReader();
    fr.onload = () => {
      resolve(fr.result);
    };
    fr.onerror = reject;
    fr.readAsText(file.blob);
  });
}

function getUserAgent(id: string) {
  return navigator.userAgent;
}

function arrayBufferToBuffer(ab: any) {
  let buffer = Buffer.alloc(ab.byteLength);
  let copy = new Uint8Array(ab);
  for (let i = 0; i < buffer.length; ++i) {
    buffer[i] = copy[i];
  }
  return buffer;
}

function getFileArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.addEventListener('loadend', (e: any) => resolve(e.target.result as ArrayBuffer));
    reader.addEventListener('error', reject);

    reader.readAsArrayBuffer(file);
  });
}

</script>

<template>
  <div class="font-sans antialiased bg-gray-800 pt-12 p-5 text-white">
    <div class="flex flex-col justify-center sm:w-96 sm:m-auto mx-5 space-y-5">
      <div class="text-4xl text-center flex items-center justify-between">
        Room {{ roomId }}
        <button class="btn" onclick="qr_modal.showModal()">Show QR
          Code</button>
      </div>
      <div class="flex flex-col rounded-lg border border-gray-200">
        <div class="text-xl text-center p-2 bg-sky-500 rounded-t-lg">In this room</div>
        <div class="border-t border-gray-200 w-full p-2" v-for="id in socketIds" :key="id">{{ names[id] }}<span
            v-if="id == socketId" class="text-sky-400"> (You)</span></div>
      </div>
      <dialog id="qr_modal" class="modal">
        <div class="modal-box">
          <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
          <h3 class="font-bold text-lg">QR Code (Scan to join)</h3>
          <p class="py-4" v-html="qrcode"></p>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>

    <div class="pt-5 max-w-screen-md mx-auto w-full flex flex-col">
      <div class="text-2xl mb-2">Files Incoming<span class="ml-2 p-1 text-sm rounded"
          :class="[isReady ? 'bg-green-500' : 'bg-red-500']">Status: {{ isReady ? 'Ready' : 'Waiting' }}</span>
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
            <progress class="progress w-56" :value="filePercentage(file)" max="100"></progress>
            <div class="mx-2">{{ filePercentage(file) }}%</div>
            <button class="mx-2 btn btn-success" v-if="file.currentFileSize === file.fileSize" @click="download(file)">
              <ArrowDownTrayIcon class="h-4 w-4 text-black" />
            </button>
          </li>
        </ul>
      </div>
      <div class="text-2xl mb-2">Files Send</div>
      <input class="upload-input" type="file" multiple ref="uploadElement" />
      <button class="font-bold py-2 rounded-lg border border-gray-200 bg-sky-500 cursor-pointer"
        @click="onUpload()">UPLOAD ALL</button>
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
