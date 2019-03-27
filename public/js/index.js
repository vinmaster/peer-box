/* global M, SimplePeer, Vue, VueRouter */
const url = window.location.protocol === 'http:' ? `ws://${window.location.host}`
  : `wss://${window.location.host}`;
let socket;
let timerID;
let retryCount = 0;
const maxRetryCount = 1;
WebSocket.prototype.sendObj = function sendObj(obj) {
  if (typeof obj !== 'object') { throw new Error('Not an object'); }
  const string = JSON.stringify(obj);
  console.log('string', string);
  return WebSocket.prototype.send.call(this, string);
};

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
}
function socketOpen(event) {
  console.log('open', event);
  retryCount = 0;
  if (timerID) {
    clearTimeout(timerID);
  }
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
    console.log(obj);
    if (obj.code === 'GOTO_ROOM') {
      // window.location.href = `/${obj.id}`;
      console.log(window.app);
      window.app.$router.push(`/${obj.id}`);
    } else if (obj.code === 'ROOM_CREATED') {
      console.log('created', obj);
      const cardContent = document.querySelector('.card-content');
      const newRoom = document.createElement('div');
      newRoom.innerHTML = `New room ${obj.id}`;
      newRoom.classList.add('animated', 'fadeInUp');
      cardContent.appendChild(newRoom);
    } else if (obj.code === 'ROOMS_REMOVED') {
      console.log('removed', obj);
    }
  } catch (err) {
    console.log(event);
  }
}

function onReady() {
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
      <div class="center-align"><button class="btn" v-on:click="hostClick">Host a room</button></div>
    </div>
    `,
    methods: {
      hostClick() {
        socket.sendObj({ code: 'GENERATE_ROOM' });
      },
    },
  };
  const RoomPage = { template: '<h3 class="center-align">Room <span>{{ $route.params.id }}</span></h3>' };
  Vue.component('nav-bar', NavBar);
  const routes = [
    { path: '/', component: IndexPage },
    { path: '/:id', component: RoomPage },
  ];

  const router = new VueRouter({ mode: 'history', routes });

  const app = {
    el: '#app',
    router,
    mounted() {
      M.AutoInit();
    },
  };
  window.app = new Vue(app);

  socketSetup();
  // const buttons = document.querySelectorAll('.host-btn');
  // for (const button of buttons) {
  //   button.onclick = host;
  // }
}


document.addEventListener('DOMContentLoaded', onReady, false);
