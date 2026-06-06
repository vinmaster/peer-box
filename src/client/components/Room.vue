<script setup lang="ts">
import { onMounted, onUnmounted, Ref, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useWs } from '../lib/useWs';
import { useFileTransfer } from '../lib/useFileTransfer';
import { renderSVG } from 'uqr';
import 'filepond/dist/filepond.min.css';

import Chat from './Chat.vue';
import FileList from './FileList.vue';
import UserList from './UserList.vue';
import { ShareIcon, QrCodeIcon, ArrowUpTrayIcon } from '@heroicons/vue/24/outline';

const route = useRoute();
const roomId = ref('');
const isReady = ref(false);
const { isConnected, event, socket } = useWs();
const socketId = ref(socket.id);
const socketIds: Ref<string[]> = ref([]);
const names: Ref<Record<string, string>> = ref({});
const qrcode = ref('');

const { filesIncoming, uploadElement, onUpload } = useFileTransfer(socket, roomId, socketId);

onMounted(() => {
  const { id } = route.params as { id?: string };
  if (!id) throw new Error('No room id found');
  
  roomId.value = id;
  qrcode.value = renderSVG(window.location.href);
  
  socket.emit('JOIN_ROOM', { roomId: id });
});

onUnmounted(() => {
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
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans p-4 sm:p-8 flex flex-col items-center">
    <!-- Header Section -->
    <div class="w-full max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
      <div>
        <h1 class="text-3xl sm:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-teal-400">
          Room: {{ roomId }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Share files and messages in real-time</p>
      </div>
      
      <button class="btn btn-outline btn-primary gap-2" onclick="qr_modal.showModal()">
        <QrCodeIcon class="h-5 w-5" />
        Show QR Code
      </button>
    </div>

    <!-- Main Grid Layout -->
    <div class="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Left Column (Sidebar) -->
      <div class="flex flex-col gap-6 lg:col-span-1">
        <UserList :socket-ids="socketIds" :names="names" :current-socket-id="socketId" />
        
        <!-- File Upload Section -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
          <h3 class="text-lg font-bold flex items-center gap-2 mb-4 text-gray-800 dark:text-gray-100">
            <ShareIcon class="h-5 w-5 text-blue-500" />
            Share Files
          </h3>
          <div class="filepond-container">
            <input class="upload-input" type="file" multiple ref="uploadElement" />
          </div>
          <button 
            class="btn btn-primary w-full mt-4 gap-2 font-bold shadow-md hover:shadow-lg transition-all"
            @click="onUpload"
          >
            <ArrowUpTrayIcon class="h-5 w-5" />
            Upload All
          </button>
        </div>
      </div>

      <!-- Right Column (Main Content) -->
      <div class="flex flex-col gap-6 lg:col-span-2">
        <!-- Incoming Files -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
          <FileList :files-incoming="filesIncoming" :is-ready="isReady" />
        </div>

        <!-- Chat Section -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col" style="height: 500px;">
          <Chat :room-id="roomId" />
        </div>
      </div>
    </div>

    <!-- QR Code Modal -->
    <dialog id="qr_modal" class="modal modal-bottom sm:modal-middle">
      <div class="modal-box bg-white dark:bg-gray-800">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        <h3 class="font-bold text-xl text-center mb-4 text-gray-800 dark:text-gray-100">Scan to Join</h3>
        <div class="flex justify-center p-4 bg-white rounded-xl shadow-inner" v-html="qrcode"></div>
        <p class="text-center text-sm text-gray-500 mt-4">Anyone with this code can join the room.</p>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<style>
/* Custom FilePond Styles for a more modern look */
.filepond--panel-root {
  background-color: #f3f4f6 !important;
  border-radius: 0.75rem;
}
.dark .filepond--panel-root {
  background-color: #374151 !important;
}
.filepond--drop-label {
  color: #4b5563 !important;
}
.dark .filepond--drop-label {
  color: #9ca3af !important;
}
.filepond--item-panel {
  background-color: #3b82f6 !important;
}
</style>
