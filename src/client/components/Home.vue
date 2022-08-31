<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { client } from '../lib/trpc';
import { router } from '../router';

async function createRoom() {
  let roomId = await client.mutation('room.create');
  console.log('roomId', roomId);
  router.push(`/rooms/${roomId}`);
}
</script>

<template>
  <div class="hero bg-base-200">
    <div class="hero-content text-center">
      <div class="max-w-md">
        <h1 class="text-5xl font-bold">PeerBox</h1>
        <button type="button" class="btn btn-primary" @click="createRoom()">Create Room</button>
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