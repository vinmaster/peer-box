<script setup lang="ts">
import { onMounted, Ref, ref, watch } from 'vue';
import { useWs } from '../lib/useWs';
import { router } from '../router';
import { Util } from '../../common/util';
import { CubeTransparentIcon, PlusCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/vue/24/outline';

const { event, socket } = useWs();
const roomIds: Ref<string[]> = ref([]);
const joinRoomId = ref('');

async function createRoom() {
  socket.emit('CREATE_ROOM', (roomId: string) => {
    router.push(`/rooms/${roomId}`);
  });
}

function joinRoom() {
  if (joinRoomId.value.trim()) {
    router.push(`/rooms/${joinRoomId.value.trim()}`);
  }
}

watch(event, () => {
  let { key, data } = event.value;
  if (key === 'ROOM_CREATED') {
    if (!roomIds.value.includes(data.roomId)) roomIds.value.push(data.roomId);
  }
  if (key === 'DESTROY_ROOM') {
    Util.remove(roomIds.value, data.roomId);
  }
});
</script>

<template>
  <div class="min-h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 font-sans">
    <div class="max-w-4xl w-full flex flex-col md:flex-row gap-12 items-center">
      
      <!-- Hero Text Section -->
      <div class="flex-1 text-center md:text-left space-y-6">
        <div class="inline-flex items-center justify-center md:justify-start gap-3 text-blue-600 dark:text-blue-400 mb-2">
          <CubeTransparentIcon class="h-12 w-12" />
          <h1 class="text-5xl md:text-6xl font-extrabold tracking-tight">PeerBox</h1>
        </div>
        <p class="text-xl md:text-2xl text-gray-600 dark:text-gray-300 font-light leading-relaxed">
          Share files and chat securely in real-time. No sign-up required.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 pt-4 justify-center md:justify-start">
          <button class="btn btn-primary btn-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all gap-2" @click="createRoom()">
            <PlusCircleIcon class="h-6 w-6" />
            Create a New Room
          </button>
        </div>
      </div>

      <!-- Action Card Section -->
      <div class="w-full md:w-96">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-8 space-y-6 transform hover:scale-[1.02] transition-transform duration-300">
          <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center">Join an Existing Room</h2>
          
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text text-gray-600 dark:text-gray-400 font-medium">Room ID</span>
            </label>
            <div class="relative">
              <input 
                type="text" 
                placeholder="e.g. 1234" 
                class="input input-bordered input-primary w-full pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-gray-50 dark:bg-gray-900" 
                v-model="joinRoomId"
                @keyup.enter="joinRoom"
              />
              <button 
                class="btn btn-primary btn-sm absolute right-2 top-2 h-8 min-h-0"
                @click="joinRoom"
                :disabled="!joinRoomId.trim()"
              >
                Join
              </button>
            </div>
          </div>

          <div v-if="roomIds.length > 0" class="pt-4 border-t border-gray-100 dark:border-gray-700">
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Active Public Rooms</h3>
            <ul class="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              <li v-for="roomId in roomIds" :key="roomId">
                <router-link 
                  :to="`/rooms/${roomId}`" 
                  class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors group"
                >
                  <span class="font-medium text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">Room {{ roomId }}</span>
                  <ArrowRightOnRectangleIcon class="h-5 w-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                </router-link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 20px;
}
</style>