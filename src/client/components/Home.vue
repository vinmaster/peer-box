<script setup lang="ts">
import { onMounted, onUnmounted, Ref, ref, watch } from 'vue';
import { client } from '../lib/trpc';
import { useWs } from '../lib/useWs';
import { router } from '../router';
import { Util } from '../../common/util';

let { isConnected, event, socket } = useWs();
let roomIds: Ref<string[]> = ref([]);

async function createRoom() {
  let roomId = await client.mutation('room.create');
  router.push(`/rooms/${roomId}`);
}

onMounted(async () => {
  roomIds.value = await client.query('room.list');
});

watch(event, () => {
  let { key, data } = event.value;
  if (key === 'CREATE_ROOM') {
    if (!roomIds.value.includes(data.roomId)) roomIds.value.push(data.roomId);
  }
  if (key === 'DESTROY_ROOM') {
    Util.remove(roomIds.value, data.roomId);
  }
});
</script>

<template>
  <div class="hero bg-base-200">
    <div class="hero-content text-center">
      <div class="max-w-md">
        <h1 class="text-5xl font-bold">PeerBox</h1>
        <button type="button" class="btn btn-primary mt-4" @click="createRoom()">Create Room</button>
        <div class="flex flex-col">
          <router-link class="mt-4" :to="`/rooms/${roomId}`" v-for="roomId in roomIds" :key="roomId">Join {{ roomId }}
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
a {
  color: #42b983;
}

label {
  margin: 0 0.5em;
  font-weight: bold;
}

code {
  background-color: #eee;
  padding: 2px 4px;
  border-radius: 4px;
  color: #304455;
}
</style>