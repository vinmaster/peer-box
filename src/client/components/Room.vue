<script setup lang="ts">
import { computed, onMounted, onUnmounted, Ref, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { client } from '../lib/trpc';
import { useWs } from '../lib/useWs';
import { Util } from '../lib/util';

let route = useRoute();
let roomId = ref('');
let { isConnected, event, socket } = useWs();
let socketId = ref(socket.id);
let socketIds: Ref<string[]> = ref([]);

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
})

watch(event, ({ key, data }: any) => {
  console.log('new event', key, data);
  if (key === 'LIST_ROOM') {
    socketIds.value = data.socketIds;
  }
});

</script>

<template>
  <div class="font-sans min-h-screen antialiased bg-gray-800 pt-24 pb-5 text-white">
    <div class="flex flex-col justify-center sm:w-96 sm:m-auto mx-5 mb-5 space-y-8">
      <div class="text-4xl">Room {{ roomId }}: ({{ socketIds.join(', ') }})</div>
      <div>
        Socket id: {{ socketId }}
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
