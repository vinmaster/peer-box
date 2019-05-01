/* global M, io, Vue, VueRouter, VueSocketIOExt, IndexPage, RoomPage, WEBSOCKET_URL, WEBSOCKET_OPTIONS */
/* eslint-disable no-console, no-use-before-define */

function appSetup() {
  const NavBar = {
    template: `
    <nav class="light-blue lighten-1" role="navigation">
      <div class="nav-wrapper container">
        <router-link class="brand-logo" to="/">PeerBox</router-link>
    </nav>
    `,
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
      // console.log('from', from);
      if (window.app.$socket) {
        window.app.$socket.emit('LEAVE_ROOM', { roomId: from.params.id });
      }
    }
  };
  router.afterEach(routerAfterEach);

  const app = {
    el: '#app',
    router,
    mounted() {
      M.AutoInit();
    },
    // sockets: {
    //   connect() {
    //     console.log('connected');
    //   },
    //   disconnect() {
    //     console.log('disconnected');
    //   },
    //   reconnect() {
    //     console.log('reconnected');
    //   },
    //   reconnect_attempt(attempt) {
    //     console.log('attempt', attempt);
    //   },
    //   reconnect_failed() {
    //     console.log('reconnect_failed');
    //   },
    // },
  };
  Vue.use(VueSocketIOExt, io(WEBSOCKET_URL, WEBSOCKET_OPTIONS));
  window.app = new Vue(app);
}

function onReady() {
  appSetup();
}


document.addEventListener('DOMContentLoaded', onReady, false);
