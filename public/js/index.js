/* global M, SimplePeer, Vue, VueRouter */
/* eslint-disable no-console, no-use-before-define */
const url = window.location.protocol === 'http:' ? `ws://${window.location.host}`
  : `wss://${window.location.host}`;
let socket;
let socketId;
let peerConnection;
let isHost;
let timerID;
let retryCount = 0;
const maxRetryCount = 1;
let receivedSize = 0;
let fileInput;
let downloadAnchor;
const targetFile = {};
const fileBuffer = [];
WebSocket.prototype.sendObj = function sendObj(obj) {
  if (typeof obj !== 'object') { throw new Error('Not an object'); }
  const string = JSON.stringify(obj);
  // console.log('string', string);
  return WebSocket.prototype.send.call(this, string);
};

function handleFileInputChange() {
  const file = fileInput.files[0];
  console.log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);
  socket.sendObj({
    code: 'FILE_READY',
    roomId: window.app.$route.params.id,
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  });
}

function socketSetup() {
  socket = new WebSocket(url);
  socket.addEventListener('open', socketOpen);
  socket.addEventListener('close', socketClose);
  socket.addEventListener('error', socketError);
  socket.addEventListener('message', socketMessage);
}
function socketTeardown() {
  socket.removeEventListener('open', socketOpen);
  socket.removeEventListener('close', socketClose);
  socket.removeEventListener('error', socketError);
  socket.removeEventListener('message', socketMessage);
  socket = null;
  socketId = null;
}
function socketOpen(event) {
  console.log('open', event);
  retryCount = 0;
  if (timerID) {
    clearTimeout(timerID);
  }
  appSetup();
}
function socketClose(event) {
  console.log('close', event);
  socketTeardown();
  timerID = setTimeout(() => {
    retryCount += 1;
    if (retryCount <= maxRetryCount) {
      socketSetup();
    }
  }, 2000);
}
function socketError(event) {
  console.log('error', event);
}
function socketMessage(event) {
  try {
    const obj = JSON.parse(event.data);
    // console.log(obj);
    if (obj.code === 'SET_ID') {
      socketId = obj.id;
    } else if (obj.code === 'LIST_ROOMS') {
      for (const roomId of obj.roomIds) {
        window.app.$data.rooms.push({ id: roomId });
      }
    } else if (obj.code === 'GOTO_ROOM') {
      // window.location.href = `/${obj.id}`;
      window.app.$router.push(`/${obj.id}`);
    } else if (obj.code === 'ROOM_CREATED') {
      // console.log('created', obj);
      window.app.$data.rooms.push({ id: obj.id });
      // const cardContent = document.querySelector('.card-content');
      // const newRoom = document.createElement('div');
      // newRoom.innerHTML = `New room ${obj.id}`;
      // newRoom.classList.add('animated', 'fadeInUp');
      // cardContent.appendChild(newRoom);
    } else if (obj.code === 'ROOMS_REMOVED') {
      // console.log('removed', obj);
      let index = -1;
      for (const room of window.app.$data.rooms) {
        index += 1;
        if (obj.id === room.id) {
          break;
        }
      }
      if (window.app.$data.rooms.length !== index) {
        window.app.$data.rooms.splice(index, 1);
      }
    } else if (obj.code === 'JOIN_ROOM') {
      // console.log('join', obj, socketId, peerConnection, window.app.$route.params.id, obj.roomId);
      if (window.app.$route.params.id === obj.roomId) {
        isHost = obj.hostId === socketId;

        fileInput = document.querySelector('input#fileInput');
        if (isHost) {
          fileInput.addEventListener('change', handleFileInputChange, false);
          document.querySelector('#info').textContent = 'You are host';
        } else {
          fileInput.style.display = 'none';
        }
        downloadAnchor = document.querySelector('a#downloadLink');

        // There is more than 2 people in the room
        if (obj.clients.length >= 2) {
          if (!peerConnection) {
            peerConnection = new SimplePeer({ initiator: isHost });
          }
          peerConnection.on('signal', data => {
            socket.sendObj({ code: 'SIGNAL', roomId: window.app.$route.params.id, signal: data });
          });
          peerConnection.on('connect', () => {
            console.log('WebRTC CONNECTED');
            document.querySelector('input#fileInput').disabled = false;
          });
          peerConnection.on('data', data => {
            fileBuffer.push(data);
            receivedSize += data.byteLength;
            if (receivedSize === targetFile.size) {
              const received = new Blob(fileBuffer);
              downloadAnchor.href = URL.createObjectURL(received);
              downloadAnchor.download = targetFile.name;
              downloadAnchor.textContent = 'Download';
            }
          });
        }
      }
    } else if (obj.code === 'SIGNAL') {
      // console.log('signal', obj.signal);
      if (window.app.$route.params.id === obj.roomId) {
        peerConnection.signal(obj.signal);
      }
    } else if (obj.code === 'FILE_READY') {
      if (window.app.$route.params.id === obj.roomId) {
        targetFile.name = obj.name;
        targetFile.size = obj.size;
        targetFile.type = obj.type;
        targetFile.lastModified = obj.lastModified;
        document.querySelector('#info').innerHTML = `Filename: ${targetFile.name}</br>Size: ${targetFile.size} bytes</br>Type: ${targetFile.type}</br>Last modified: ${new Date(targetFile.lastModified)}`;
      }
    } else if (obj.code === 'FILE_UPLOAD') {
      // console.log('begin', obj.roomId, window.app.$route.params.id);
      if (obj.roomId === window.app.$route.params.id) {
        const file = fileInput.files[0];
        const chunkSize = 16384;
        let offset = 0;
        const readSlice = o => {
          console.log('readSlice ', o);
          const slice = file.slice(offset, o + chunkSize);
          fileReader.readAsArrayBuffer(slice);
        };

        const fileReader = new FileReader();
        fileReader.addEventListener('load', e => {
          // console.log('FileRead.onload ', e);
          peerConnection.send(e.target.result);
          offset += e.target.result.byteLength;
          if (offset < file.size) {
            readSlice(offset);
          }
        });

        readSlice(0);
      }
    } else {
      console.log('Code not supported', obj);
    }
  } catch (err) {
    console.error(err);
    console.log(event);
  }
}

function appSetup() {
  const NavBar = {
    template: `
    <nav class="light-blue lighten-1" role="navigation">
      <div class="nav-wrapper container">
        <router-link class="brand-logo" to="/">PeerBox</router-link>
        <ul class="right hide-on-med-and-down">
          <li><a href="#" class="host-btn">Host a room</a></li>
        </ul>

        <ul id="nav-mobile" class="sidenav">
          <li><a href="#" class="host-btn">Host a room</a></li>
        </ul>
        <a href="#" data-target="nav-mobile" class="sidenav-trigger"><i class="material-icons">menu</i></a>
      </div>
    </nav>
    `,
  };
  const IndexPage = {
    template: `
    <div>
      <h3 class="center-align">Welcome</h3>
      <div class="center-align">
        <button class="btn" v-on:click="hostClick">Host a room</button>
        <ul>
          <transition-group enter-active-class="animated fadeInUp" leave-active-class="animated fadeOutDown">
            <li v-for="(room, index) in this.$parent.rooms" v-bind:key="room.id" class="rooms">
              New room
              <router-link :to="{path: '/' + room.id}">{{ room.id }}</router-link>
            </li>
          </transition-group>
        </ul>
      </div>
    </div>
    `,
    mounted() {
      socket.sendObj({ code: 'LIST_ROOMS' });
    },
    methods: {
      hostClick() {
        socket.sendObj({ code: 'GENERATE_ROOM' });
      },
    },
    data() {
      return {};
    },
  };

  const RoomPage = {
    template: `
    <div>
      <h3 class="center-align">Room <span>{{ $route.params.id }}</span></h3>
      <div id="info"></div>
      <form>
        <input disabled type="file" id="fileInput" name="files"/>
      </form>
      <a id="downloadLink"></a>
    </div>
    `,
    mounted() {
      socket.sendObj({ code: 'JOIN_ROOM', roomId: this.$route.params.id });
    },
    methods: {
    },
  };
  Vue.component('nav-bar', NavBar);
  const routes = [
    { path: '/', name: 'index-page', component: IndexPage },
    { path: '/:id', name: 'room-page', component: RoomPage },
  ];

  const router = new VueRouter({ mode: 'history', routes });
  const routerAfterEach = (to, from) => {
    // Navigating away from room
    if (from.name === 'room-page') {
      console.log('from', from);
      socket.sendObj({ code: 'LEAVE_ROOM', roomId: from.params.id });
    }
  };
  router.afterEach(routerAfterEach);

  const app = {
    el: '#app',
    router,
    mounted() {
      M.AutoInit();
    },
    data() {
      return {
        rooms: [],
      };
    },
  };
  window.app = new Vue(app);
}

function onReady() {
  socketSetup();

  // const buttons = document.querySelectorAll('.host-btn');
  // for (const button of buttons) {
  //   button.onclick = host;
  // }
}


document.addEventListener('DOMContentLoaded', onReady, false);
