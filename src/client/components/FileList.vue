<script setup lang="ts">
import { IncomingFile } from '../../common/types';
import { Util } from '../../common/util';
import { ArrowDownTrayIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  filesIncoming: IncomingFile[];
  isReady: boolean;
}>();

async function download(file: IncomingFile) {
  if (!file.data) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([file.data as any], { type: file.fileType }));
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  await Util.sleep(1000);
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function filePercentage(file: IncomingFile) {
  if (!file.fileSize) return 0;
  return Math.ceil((file.currentFileSize / file.fileSize) * 100);
}

function getFileStyles(file: IncomingFile) {
  return {
    backgroundColor: `hsl(${filePercentage(file) + 50}, 100%, 50%)`,
  };
}
</script>

<template>
  <div class="flex flex-col">
    <div class="text-2xl mb-2 flex items-center gap-2">
      <span class="font-bold text-gray-800 dark:text-gray-100">Incoming Files</span>
      <span 
        class="px-2 py-1 text-xs font-semibold rounded-full text-white"
        :class="[isReady ? 'bg-emerald-500' : 'bg-rose-500']"
      >
        {{ isReady ? 'Ready' : 'Waiting for peers...' }}
      </span>
    </div>
    
    <div class="bg-gray-100 dark:bg-gray-700 rounded-xl p-4 min-h-[6rem] shadow-inner">
      <div v-if="filesIncoming.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-4 italic">
        No files shared yet.
      </div>
      <ul class="flex flex-col gap-3 w-full min-w-0" v-else>
        <li 
          v-for="file in filesIncoming" 
          :key="file.id"
          class="flex flex-wrap items-center justify-between rounded-lg p-3 shadow-sm transition-all duration-300 gap-3 w-full min-w-0 overflow-hidden"
          :style="getFileStyles(file)"
        >
          <div class="flex flex-col flex-grow min-w-[120px] max-w-full">
            <span class="font-medium text-gray-900 truncate block w-full">{{ file.filename }}</span>
            <span class="text-xs text-gray-800 opacity-80 block truncate w-full">
              {{ Util.formatBytes(file.fileSize) }} - {{ new Date(file.lastModified).toLocaleString() }}
            </span>
          </div>
          
          <div class="flex items-center gap-3 whitespace-nowrap flex-grow sm:flex-grow-0 justify-end">
            <progress 
              class="progress progress-success w-24 sm:w-32 bg-white/40" 
              :value="filePercentage(file)" 
              max="100"
            ></progress>
            <span class="text-sm font-bold text-gray-900 w-10 text-right shrink-0">{{ filePercentage(file) }}%</span>
            
            <button 
              class="btn btn-circle btn-sm btn-ghost hover:bg-white/30 text-gray-900 shrink-0" 
              v-if="file.currentFileSize === file.fileSize" 
              @click="download(file)"
              title="Download File"
            >
              <ArrowDownTrayIcon class="h-5 w-5" />
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
