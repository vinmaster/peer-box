<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, Ref, ref, watch } from 'vue';
import { ClipboardIcon, PaperAirplaneIcon, TrashIcon } from '@heroicons/vue/24/outline';
import ClipboardJS from 'clipboard';
import { useWs } from '../lib/useWs';

interface Message {
  roomId: string;
  type: string;
  sender: string;
  text: string;
  timestamp: number;
}

const props = defineProps<{
  roomId: string,
}>();

let { isConnected, event, socket } = useWs();
let socketId = ref(socket.id);
let msgs: Ref<Message[]> = ref([]);
let chatText = ref('');
let clipboard = ref();

watch(isConnected, () => {
  if (!socketId.value) socketId.value = socket?.id;
});

watch(event, ({ key, data }: any) => {
  if (key === 'CHAT_MSG') {
    msgs.value.push(data);
    nextTick(() => {
      clipboard.value = new ClipboardJS('.copy-btn');
      const container = document.querySelector('.messages');
      container.scrollTop = container.scrollHeight;
    });
    // setTimeout(() => {
    // }, 50);
  }
});

onUnmounted(() => {
  clipboard.value?.destroy();
})

function sendMsg() {
  if (chatText.value.length === 0) return;

  let type = 'text';
  if (chatText.value.includes('http') || chatText.value.endsWith('.com')) type = 'link';

  socket.emit('CHAT_MSG', {
    roomId: props.roomId,
    type,
    sender: socket.id,
    text: chatText.value,
    timestamp: +new Date(),
  });

  chatText.value = '';
}

function clearMsgs() {
  msgs.value = [];
}
</script>

<template>
  <div class="text-2xl flex items-center justify-between">Chat <TrashIcon class="h-8 w-8 text-white cursor-pointer p-1 m-1" @click="clearMsgs">
    </TrashIcon>
  </div>
  <div class="messages flex-1 overflow-y-scroll border-box">
    <div v-for="(msg, index) in msgs" :key="index" class="message-row flex"
      :class="[msg.sender === socketId ? 'flex-row-reverse' : 'flex-row']">
      <div class="message m-2 p-4 pb-8 rounded max-w-full inline relative shadow"
        :class="[msg.sender === socketId ? 'bg-sky-500' : 'bg-gray-500']">
        <p class="message-content">{{ msg.text }}</p>
        <button class="absolute right-2 top-2 copy-btn" :data-clipboard-text="msg.text">
          <ClipboardIcon class="h-4 w-4 text-white" />
        </button>
        <div class="message-name absolute px-2 py-1 text-xs rounded left-0 bottom-0"
          :class="[msg.sender === socketId ? 'bg-sky-600' : 'bg-gray-600']">{{ msg.sender }}
        </div>
        <div class="message-name absolute px-2 py-1 text-xs rounded right-0 bottom-0"
          :class="[msg.sender === socketId ? 'bg-sky-600' : 'bg-gray-600']">{{
            new
                    Date(msg.timestamp).toLocaleTimeString()
          }}
        </div>
      </div>
    </div>
  </div>
  <div class="message-input bg-gray-500 p-4 flex flex-row text-gray-700">
    <textarea class="flex-1 p-2 rounded" rows="1" v-model.trim="chatText" @keyup.enter="sendMsg"></textarea>
    <button
      class="btn btn-success flex items-center w-18 gap-2 justify-center ml-2 font-bold"
      @click="sendMsg">
      Send
      <PaperAirplaneIcon class="h-4 w-4 text-black" />
    </button>
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
