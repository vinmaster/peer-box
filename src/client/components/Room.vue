<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { client, IS_DEV } from '../lib/trpc';
import { useWs } from '../lib/useWs';
import { Util } from '../lib/util';

let route = useRoute();
let { isConnected, message, send } = useWs();

watch(isConnected, () => {
  if (isConnected.value) {
    try {
      let { id } = route.params;
      if (!id) {
        throw new Error('No id found');
      }
      console.log('params', id);
      send({ type: 'JOIN_ROOMS', data: { id } });
    } catch (error) {
      console.error(error);
    }
  }
});

onUnmounted(() => {
  console.log('unmount');
  // socket.close();
});

watch(message, (m) => {
  console.log('new message', m);
});

</script>

<template>
  <div class="font-sans min-h-screen antialiased bg-gray-800 pt-24 pb-5 text-white">
    Room
    <div class="flex flex-col justify-center sm:w-96 sm:m-auto mx-5 mb-5 space-y-8">
    </div>
  </div>
</template>

<style scoped>
</style>
