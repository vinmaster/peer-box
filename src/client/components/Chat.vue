<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, Ref, ref, watch } from 'vue';
import { ClipboardIcon, PaperAirplaneIcon, TrashIcon } from '@heroicons/vue/24/outline';
import ClipboardJS from 'clipboard';
import { useWs } from '../lib/useWs';
import { Message } from '../../common/types';

const props = defineProps<{
  roomId: string,
}>();

let { isConnected, event, socket } = useWs();
let socketId = ref(socket.id);
let msgs: Ref<Message[]> = ref([]);
let chatText = ref('');
let clipboard: ClipboardJS | null = null;

watch(isConnected, () => {
  if (!socketId.value) socketId.value = socket?.id;
});

watch(event, ({ key, data }: any) => {
  if (key === 'CHAT_MSG') {
    msgs.value.push(data);
    nextTick(() => {
      if (!clipboard) {
        clipboard = new ClipboardJS('.copy-btn');
      }
      const container = document.querySelector('.messages-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }
});

onUnmounted(() => {
  clipboard?.destroy();
});

function sendMsg() {
  if (chatText.value.trim().length === 0) return;

  let type = 'text';
  if (chatText.value.includes('http') || chatText.value.endsWith('.com')) type = 'link';

  socket.emit('CHAT_MSG', {
    roomId: props.roomId,
    type,
    sender: socket.id,
    senderName: '', // server handles this
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
  <div class="flex flex-col h-full bg-white dark:bg-gray-800">
    <!-- Chat Header -->
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center z-10">
      <h3 class="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <span>Room Chat</span>
        <span class="badge badge-sm badge-primary">{{ msgs.length }}</span>
      </h3>
      <button 
        class="btn btn-ghost btn-sm btn-circle text-gray-500 hover:text-red-500 transition-colors" 
        @click="clearMsgs"
        title="Clear Chat"
      >
        <TrashIcon class="h-5 w-5" />
      </button>
    </div>

    <!-- Chat Messages Area -->
    <div class="messages-container flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/50">
      <div v-if="msgs.length === 0" class="h-full flex flex-col items-center justify-center text-gray-400">
        <p>No messages yet.</p>
        <p class="text-sm">Start the conversation!</p>
      </div>
      
      <div 
        v-for="(msg, index) in msgs" 
        :key="index" 
        class="chat transition-all duration-300"
        :class="[msg.sender === socketId ? 'chat-end' : 'chat-start']"
      >
        <div class="chat-header text-xs opacity-70 mb-1 ml-1 text-gray-600 dark:text-gray-400">
          {{ msg.senderName }}
          <time class="ml-1 text-xs opacity-50">{{ new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</time>
        </div>
        
        <div 
          class="chat-bubble relative group shadow-sm text-sm"
          :class="[msg.sender === socketId ? 'chat-bubble-primary' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100']"
        >
          <p class="whitespace-pre-wrap break-words pr-6 leading-relaxed">{{ msg.text }}</p>
          
          <button 
            class="copy-btn absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10 dark:hover:bg-white/10" 
            :data-clipboard-text="msg.text"
            title="Copy"
          >
            <ClipboardIcon class="h-3.5 w-3.5" :class="msg.sender === socketId ? 'text-primary-content' : 'text-gray-600 dark:text-gray-300'" />
          </button>
        </div>
      </div>
    </div>

    <!-- Chat Input Area -->
    <div class="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div class="flex items-end gap-2 bg-gray-100 dark:bg-gray-700 rounded-xl p-1 border border-transparent focus-within:border-blue-500 transition-colors">
        <textarea 
          class="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-3 px-4 text-sm text-gray-800 dark:text-gray-100" 
          rows="1" 
          placeholder="Type a message..."
          v-model.trim="chatText" 
          @keydown.enter.prevent="sendMsg"
          oninput="this.style.height = ''; this.style.height = Math.min(this.scrollHeight, 120) + 'px'"
        ></textarea>
        <button
          class="btn btn-primary btn-circle btn-sm mb-1 mr-1 shadow-md hover:scale-105 transition-transform"
          :disabled="chatText.trim().length === 0"
          @click="sendMsg"
        >
          <PaperAirplaneIcon class="h-4 w-4 -ml-0.5" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Scrollbar styling for a cleaner look */
.messages-container::-webkit-scrollbar {
  width: 6px;
}
.messages-container::-webkit-scrollbar-track {
  background: transparent;
}
.messages-container::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 20px;
}
.dark .messages-container::-webkit-scrollbar-thumb {
  background-color: rgba(75, 85, 99, 0.5);
}
</style>
