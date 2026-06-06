<script setup lang="ts">
import { UsersIcon, UserCircleIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  socketIds: string[];
  names: Record<string, string>;
  currentSocketId: string;
}>();
</script>

<template>
  <div class="flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div class="bg-gradient-to-r from-sky-500 to-blue-600 p-4 text-white flex items-center justify-between">
      <h3 class="font-bold text-lg flex items-center gap-2">
        <UsersIcon class="h-6 w-6" />
        Room Members
      </h3>
      <span class="badge badge-sm border-none bg-white/20 text-white font-bold">{{ socketIds.length }}</span>
    </div>
    
    <div class="p-2 max-h-[300px] overflow-y-auto">
      <ul class="space-y-1">
        <li 
          v-for="id in socketIds" 
          :key="id" 
          class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div class="avatar placeholder">
            <div class="bg-neutral text-neutral-content rounded-full w-10">
              <span class="text-xs">{{ names[id]?.charAt(0).toUpperCase() || '?' }}</span>
            </div>
          </div>
          <div class="flex-grow min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {{ names[id] || 'Unknown' }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
              ID: {{ id.substring(0, 8) }}...
            </p>
          </div>
          <div v-if="id === currentSocketId" class="badge badge-primary badge-sm whitespace-nowrap">You</div>
        </li>
      </ul>
      <div v-if="socketIds.length === 0" class="text-center p-4 text-gray-500 dark:text-gray-400 italic">
        Waiting for others to join...
      </div>
    </div>
  </div>
</template>
