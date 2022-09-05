<script setup lang="ts">
import { computed, onMounted, onUnmounted, Ref, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { client } from '../lib/trpc';
import { useWs } from '../lib/useWs';
import { Util } from '../lib/util';

interface Message {
  roomId: string;
  type: string;
  sender: string;
  text: string;
  timestamp: number;
}

let route = useRoute();
let roomId = ref('');
let { isConnected, event, socket } = useWs();
let socketId = ref(socket.id);
let socketIds: Ref<string[]> = ref([]);
let msgs: Ref<Message[]> = ref([]);
let chatText = ref('');

onMounted(() => {
  // socket.close();
  let { id } = route.params;
  if (!id) {
    throw new Error('No id found');
  }
  roomId.value = id as string;
  console.log('joining on mount');
  socket.emit('JOIN_ROOM', { roomId: id });
});

onUnmounted(() => {
  socket.emit('LEAVE_ROOM', { roomId: roomId.value });
});

watch(isConnected, () => {
  if (!socketId.value) socketId.value = socket?.id;
});

watch(event, ({ key, data }: any) => {
  console.log('new event', key, data);
  if (key === 'LIST_ROOM') {
    socketIds.value = data.socketIds;
  } else if (key === 'CHAT_MSG') {
    msgs.value.push(data);
    setTimeout(() => {
      const container = document.querySelector('.messages');
      container.scrollTop = container.scrollHeight;
    }, 50);
  }
});

function sendMsg() {
  if (chatText.value.length === 0) return;

  let type = 'text';
  if (chatText.value.includes('http') || chatText.value.endsWith('.com')) type = 'link';

  socket.emit('CHAT_MSG', {
    roomId: roomId.value,
    type,
    sender: socketId.value,
    text: chatText.value,
    timestamp: +new Date(),
  });

  chatText.value = '';
}

function LIST_ROOM(data) {
  console.log('LIST_ROOM socket on', data);
}
</script>

<template>
  <div class="font-sans min-h-screen antialiased bg-gray-800 pt-12 pb-5 text-white">
    <div class="flex flex-col justify-center sm:w-96 sm:m-auto mx-5 space-y-5">
      <div class="text-4xl text-center">Room {{ roomId }}</div>
      <div class="flex flex-col rounded-lg border border-gray-200">
        <div class="text-xl text-center p-2 bg-sky-500 rounded-t-lg">In this room</div>
        <div class="border-t border-gray-200 w-full p-2" v-for="id in socketIds" :key="id">{{ id }}<span
            v-if="id == socketId" class="text-sky-400"> (You)</span></div>
      </div>
    </div>

    <div class="pt-5 max-w-screen-md mx-auto w-full flex flex-col overflow-hidden" style="min-height: 24rem;">
      <div class="text-2xl">Chat</div>
      <div class="messages flex-1 overflow-y-scroll border-box">
        <div v-for="(msg, index) in msgs" :key="index" class="message-row flex"
          :class="[msg.sender === socketId ? 'flex-row-reverse' : 'flex-row']">
          <div class="message m-2 p-4 pb-8 rounded max-w-full inline relative shadow"
            :class="[msg.sender === socketId ? 'bg-sky-500' : 'bg-gray-500']">
            <p class="message-content">{{ msg.text }}</p>
            <!-- <a class="absolute right-0 top-0 copy" :data-clipboard-text="msg.text">
              <i class="material-icons">content_copy</i>
            </a> -->
            <div class="message-name absolute px-2 py-1 text-xs rounded left-0 bottom-0"
              :class="[msg.sender === socketId ? 'bg-sky-600' : 'bg-gray-600']">{{ msg.sender }}
            </div>
            <div class="message-name absolute px-2 py-1 text-xs rounded right-0 bottom-0"
              :class="[msg.sender === socketId ? 'bg-sky-600' : 'bg-gray-600']">{{ new
                  Date(msg.timestamp).toLocaleTimeString()
              }}
            </div>
          </div>
        </div>
      </div>
      <div class="message-input bg-gray-500 p-4 flex flex-row text-gray-700">
        <!-- <input class="flex-1 p-2 rounded" type="text" v-model.trim="chatText" @keyup.enter="sendMsg" /> -->
        <textarea class="flex-1 p-2 rounded" rows="1" v-model.trim="chatText" @keyup.enter="sendMsg"></textarea>
        <button class="w-16 space-x-2 justify-center text-white rounded-lg border ml-2" @click="sendMsg">Send</button>
      </div>
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
</style>
