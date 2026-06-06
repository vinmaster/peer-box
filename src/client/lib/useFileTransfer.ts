import { Ref, ref, onMounted, onUnmounted, watch } from 'vue';
import * as FilePond from 'filepond';
import { Socket } from 'socket.io-client';
import { IncomingFile, CurrentUpload, ServerToClientEvents, ClientToServerEvents } from '../../common/types';

const CHUNK_SIZE = 524288;

export function useFileTransfer(
  socket: Socket<ServerToClientEvents, ClientToServerEvents>,
  roomId: Ref<string>,
  socketId: Ref<string>
) {
  let filesIncoming: Ref<IncomingFile[]> = ref([]);
  let uploadElement = ref<HTMLInputElement | null>(null);
  let currentUpload: CurrentUpload | null = null;
  let pond: FilePond.FilePond | null = null;
  let uploaderMetadata: Record<string, { completed: number; load: Function }> = {};

  function registerSocket() {
    socket.on('ADD_FILE', (data) => {
      filesIncoming.value.push(data as IncomingFile);
    });
    
    socket.on('REMOVE_FILE', (data) => {
      let index = filesIncoming.value.findIndex(f => f.id === data.id);
      if (index !== -1) filesIncoming.value.splice(index, 1);
    });
    
    socket.on('RECEIVE_FILE', (data) => {
      let index = filesIncoming.value.findIndex(f => f.id === data.id);
      if (index !== -1) {
        let file = filesIncoming.value[index];
        if (file.data) {
          file.data = arrayBufferAppend(file.data, new Uint8Array(data.arrayBuffer));
        } else {
          file.data = new Uint8Array(data.arrayBuffer);
        }
        file.currentFileSize = file.data!.byteLength;

        if (file.currentFileSize === file.fileSize) {
          socket.emit('COMPLETED_FILE', { roomId: roomId.value, id: file.id });
        } else {
          socket.emit('RECEIVED_FILE', data);
        }
      }
    });

    socket.on('RECEIVED_FILE', (data) => {
      if (!currentUpload) return;
      let start = currentUpload.chunkIndex * CHUNK_SIZE;
      let end = Math.min((currentUpload.chunkIndex + 1) * CHUNK_SIZE, currentUpload.arrayBuffer.byteLength);
      socket.emit('UPLOAD_FILE', {
        roomId: currentUpload.roomId,
        id: currentUpload.id,
        chunkIndex: currentUpload.chunkIndex,
        arrayBuffer: currentUpload.arrayBuffer.slice(start, end),
      });
      currentUpload.chunkIndex += 1;
    });

    socket.on('ABORT_FILE', (data) => {
      let index = filesIncoming.value.findIndex(f => f.id === data.id);
      if (index !== -1) {
        delete filesIncoming.value[index].data;
        filesIncoming.value[index].currentFileSize = 0;
      }
    });

    socket.on('COMPLETED_FILE', (data) => {
      if (!uploaderMetadata[data.id]) return;
      let metadata = uploaderMetadata[data.id];
      metadata.completed += 1;
      metadata.load(data.id);
    });

    socket.on('ROOM_INFO', (data) => {
      // Room info could contain existing files, they would be pushed here if desired
    });
  }

  function unregisterSocket() {
    socket.off('ADD_FILE');
    socket.off('REMOVE_FILE');
    socket.off('RECEIVE_FILE');
    socket.off('RECEIVED_FILE');
    socket.off('ABORT_FILE');
    socket.off('COMPLETED_FILE');
    socket.off('ROOM_INFO');
  }

  function arrayBufferAppend(a: Uint8Array, b: Uint8Array): Uint8Array {
    let arrayBuffer = new Uint8Array(a.byteLength + b.byteLength);
    arrayBuffer.set(a);
    arrayBuffer.set(b, a.byteLength);
    return arrayBuffer;
  }

  async function upload(file: File, metadata: any) {
    let arrayBuffer = new Uint8Array(await file.arrayBuffer());

    currentUpload = {
      arrayBuffer,
      chunkIndex: 0,
      roomId: roomId.value,
      id: metadata.id,
    };

    let start = currentUpload.chunkIndex * CHUNK_SIZE;
    let end = Math.min((currentUpload.chunkIndex + 1) * CHUNK_SIZE, currentUpload.arrayBuffer.byteLength);
    socket.emit('UPLOAD_FILE', {
      roomId: currentUpload.roomId,
      id: currentUpload.id,
      chunkIndex: currentUpload.chunkIndex,
      arrayBuffer: currentUpload.arrayBuffer.slice(start, end),
    });
    currentUpload.chunkIndex += 1;
  }

  let process: FilePond.ProcessServerConfigFunction = (fieldName, file, metadata, load, error, progress, abort, transfer, options) => {
    uploaderMetadata[metadata.id] = { completed: 0, load };
    upload(file as File, metadata);

    return {
      abort: () => {
        metadata.abort = true;
        socket.emit('ABORT_FILE', { roomId: roomId.value, id: metadata.id });
        abort();
      }
    };
  };

  let revert: FilePond.RevertServerConfigFunction = (uniqueFileId, load, error) => {
    socket.emit('ABORT_FILE', { roomId: roomId.value, id: uniqueFileId });
  };

  onMounted(() => {
    if (uploadElement.value) {
      pond = FilePond.create(uploadElement.value, {
        instantUpload: false,
        server: { process, revert }
      });

      pond.on('addfile', (error, file) => {
        if (Object.keys(file.getMetadata()).length === 0) {
          file.setMetadata('socketId', socketId.value);
          file.setMetadata('id', file.id);
        }
        let incomingFile = {
          roomId: roomId.value,
          id: file.id,
          currentFileSize: 0,
          filename: file.filename,
          fileSize: file.fileSize,
          fileType: file.fileType,
          fileExt: file.fileExtension,
          lastModified: file.file.lastModified,
          socketId: socketId.value,
        };
        socket.emit('ADD_FILE', incomingFile);
      });

      pond.on('removefile', (error, file) => {
        socket.emit('REMOVE_FILE', { roomId: roomId.value, id: file.id });
      });
    }

    registerSocket();
  });

  onUnmounted(() => {
    if (pond) {
      pond.destroy();
    }
    unregisterSocket();
  });

  function onUpload() {
    if (pond) pond.processFiles();
  }

  return {
    filesIncoming,
    uploadElement,
    onUpload
  };
}
