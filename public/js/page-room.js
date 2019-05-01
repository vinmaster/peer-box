/* global Uppy, ClipboardJS, WebRTCUpload, SimpleMultiPeer */
/* eslint-disable no-console */

const RoomPage = { // eslint-disable-line no-unused-vars
  template: `
  <div>
    <div class="center-align" v-show="error">
      <h3>{{ error }}</h3>
      <router-link to="/">Go back home</router-link>
    </div>

    <div v-show="!error">
      <h3 class="center-align">Room <span>{{ $route.params.id }}</span></h3>
      <div v-show="isHost"><b>Host Instructions:</b> Wait till all peers are in the room. Click CONNECT PEERS. Choose files to send. Done.</div>
      <div v-show="!isHost"><b>Receiver Instructions:</b> Wait for host to transfer file. Click SAVE. Done.</div>
      <br />
      <div>ID: {{ $socket.id }}</div>
      <div>Number of peers in room: {{ socketIds.length }}</div>
      <div v-show="socketIds.length > 1">
        <button class="btn" v-on:click="connectPeers" v-show="isHost && !webrtcReady">Connect peers</button>
        <h4 v-show="isHost && webrtcReady">Files to send</h4>
        <div v-show="isHost && webrtcReady" id="upload-area"></div>
        <h4 v-show="!isHost && webrtcReady">Files received</h4>
        <div v-show="!isHost && webrtcReady">Bytes received: {{ formatBytes(currentBufferSize) }}</div>
      </div>
      <ul class="collection">
        <li v-for="(file, index) in files" v-bind:key="file.id" class="files collection-item">
          <span>Name: {{ file.name }}</span><br />
          <span>Size: {{ formatBytes(file.size) }}</span><br />
          <span>Type: {{ file.type }}</span><br />
          <span>Last Modified: {{ dateFns.format(file.lastModified, 'M/D/YY h:mm a') }}</span><br />
          <div class="download-progress-bar" v-bind:style="{ width: calcPercent(file.bufferSize, file.size) }"></div>
          <span>Downloaded: {{ calcPercent(file.bufferSize, file.size) }} {{ formatBytes(file.bufferSize) }}</span><br />
          <a class="btn" v-on:click="saveFile($event, file.id)">Save<i class="right material-icons">save</i></a>
        </li>
      </ul>

      <div class="chat-container">
        <span>Chat</span>
        <div class="chat-msgs collection">
          <div class="chat-msg collection-item" v-for="msg in msgs">
            <button class="right copy" v-bind:data-clipboard-text="msg.text">Copy</button>
            <span v-if="msg.type === 'text'">{{ msg.text }}</span>
            <a v-bind:href="msg.text" v-if="msg.type === 'link'">{{ msg.text }}</a>
            <span class="badge">{{ dateFns.format(msg.timestamp, 'h:mm a') }}</span>
          </div>
        </div>
        <div class="chat-input">
          <input placeholder="Enter a message" v-model.trim="textfield" v-on:keyup.enter="sendMsg" />
          <button class="btn" v-on:click="sendMsg"><i class="material-icons">send</i></button>
        </div>
      </div>

      <a id="downloadLink"></a>
    </div>
  </div>
  `,

  mounted() {
    // console.log('page room', this.$socket.connected);
    this.$options.sockets.ROOM_INFO = data => {
      // console.log('ROOM_INFO', data);
      if (data.error) {
        console.log(data.error);
        this.error = data.error;
        // this.$router.push('/');
        return;
      }
      const {
        // socketId, roomId, createdAt, socketIds,
        socketIds,
      } = data;
      // console.log('roomIds', socketId, roomId, createdAt, socketIds);

      // Add sockets
      for (const id of socketIds) {
        if (!this.socketIds.includes(id)) {
          this.socketIds.push(id);
        }
      }

      // Remove sockets
      for (const id of this.socketIds) {
        if (!socketIds.includes(id)) {
          if (this.peerConnection) {
            this.peerConnection.deleteSocket(id);
          }
          this.socketIds.splice(this.socketIds.indexOf(id), 1);
        }
      }
    };

    this.$options.sockets.ROOM_READY = () => {
      // console.log('ROOM_READY', this.socketIds);
      this.setupWebRTC();
      this.setupUploader();
    };

    this.$options.sockets.UPLOAD_START = ({
      id, name, size, type, lastModified,
    }) => {
      // console.log('UPLOAD_START', id, name);
      this.files[id] = {
        id, name, size, type, lastModified, buffer: [], bufferSize: 0,
      };
      this.currentFileId = id;
    };

    this.$options.sockets.MSG_ROOM = ({ msg }) => {
      this.msgs.push(msg);
      new ClipboardJS('.copy'); // eslint-disable-line no-new
    };
    this.$socket.emit('JOIN_ROOM', { roomId: this.$route.params.id });
  },
  beforeDestroy() {
    delete this.$options.sockets.ROOM_INFO;
    delete this.$options.sockets.ROOM_READY;
    delete this.$options.sockets.UPLOAD_START;
    delete this.$options.sockets.MSG_ROOM;
    if (this.peerConnection) {
      this.peerConnection.deleteListeners();
    }
    this.peerConnection = null;
  },
  methods: {
    setupWebRTC() {
      this.peerConnection = new SimpleMultiPeer({
        listeners: this.$options.sockets,
        socket: this.$socket,
        roomId: this.$route.params.id,
        callbacks: {
          connect: this.peerOnConnect.bind(this),
          close: this.peerOnClose.bind(this),
          data: this.peerOnData.bind(this),
          // stream: this.peerOnStream.bind(this),
        },
      });
    },
    setupUploader() {
      this.uppy = Uppy.Core({
        // debug: true,
        // autoProceed: true,
        autoProceed: false,
        allowMultipleUploads: true,
        restrictions: {
          // maxNumberOfFiles: 1,
          // maxFileSize: 500000000,
          minNumberOfFiles: 1,
        },
      })
        .use(Uppy.Dashboard, {
          // trigger: '.UppyModalOpenerBtn',
          inline: true,
          target: '#upload-area',
          replaceTargetContent: true,
          showProgressDetails: true,
          note: 'Upload will start automatically',
          height: 470,
          metaFields: [
            { id: 'name', name: 'Name', placeholder: 'file name' },
            { id: 'caption', name: 'Caption', placeholder: 'describe what the image is about' },
          ],
          browserBackButtonClose: true,
        });

      this.uppy.use(WebRTCUpload, {
        peerConnection: this.peerConnection,
        // server: WEBSOCKET_URL,
        // socketId,
        // roomId,
      });
      this.uppy.on('upload-started', file => {
        this.$socket.emit('UPLOAD_START', {
          id: file.id,
          name: file.data.name,
          size: file.data.size,
          type: file.data.type,
          lastModified: file.data.lastModified,
        });
      });
      // this.uppy.on('complete', result => {
      //   console.log('successful files:', result.successful);
      //   console.log(result.successful[0].progress);
      //   console.log('failed files:', result.failed);
      //   console.log('files', this.uppy.getFiles());
      // });
    },
    connectPeers() {
      this.$socket.emit('ROOM_READY', { roomId: this.$route.params.id });
    },
    peerOnConnect() {
      // console.log('----------- WebRTC connected! -----------');
      this.webrtcReady = true;
      // console.log('peers', this.peerConnection.peers);
    },
    peerOnClose() {
      this.webrtcReady = false;
    },
    peerOnData(socketId, data) {
      // console.log(`PEER received data callback from ${socketId}`);
      if (!this.currentBuffer) {
        this.currentBufferSize = 0;
        this.currentBuffer = [];
      }
      this.currentBuffer.push(data);
      this.currentBufferSize += data.byteLength;

      if (this.currentFileId) {
        this.files[this.currentFileId].bufferSize = this.currentBufferSize;
        if (this.files[this.currentFileId].size === this.currentBufferSize) {
          this.files[this.currentFileId].buffer = this.currentBuffer;
          // this.files[this.currentFileId].size = this.currentBufferSize;
          this.currentFileId = null;
          this.currentBuffer = null;
        }
      }
    },
    sendMsg() {
      if (this.textfield.length !== 0) {
        let type = 'text';
        if (this.textfield.includes('http') || this.textfield.endsWith('.com')) {
          type = 'link';
        }
        this.$socket.emit('MSG_ROOM', {
          roomId: this.$route.params.id,
          msg: {
            sender: this.$socket.id,
            type,
            text: this.textfield,
            timestamp: +new Date(),
          },
        });
        this.textfield = '';
      }
    },
    saveFile(event, id) {
      if (this.files[id]) {
        event.target.href = URL.createObjectURL(new Blob(this.files[id].buffer));
        event.target.download = this.files[id].name;
      }
    },
    calcPercent(current, total) {
      return `${(current / total).toFixed(2) * 100}%`;
    },
    formatBytes(bytes, decimals = 2) {
      if (bytes === 0) return '0 Bytes';

      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return `${parseFloat((bytes / (k ** i)).toFixed(dm))} ${sizes[i]}`;
    },
  },
  computed: {
    isHost() {
      if (this.socketIds.length === 0) {
        return false;
      }
      return this.$socket.id === this.socketIds[0];
    },
  },
  data() {
    return {
      error: null,
      uppy: null,
      peerConnection: null,
      socketIds: [],
      webrtcReady: false,
      files: {},
      currentFileId: null,
      currentBuffer: null,
      currentBufferSize: 0,
      msgs: [],
      textfield: '',
    };
  },
};
