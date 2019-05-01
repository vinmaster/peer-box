/* eslint-disable no-console */

const IndexPage = { // eslint-disable-line no-unused-vars
  template: `
  <div>
    <h3 class="center-align">Message and transfer files easily</h3>
    <div class="center-align">
      <button class="btn" v-on:click="hostClick">Host a room</button>
      <div class="collection">
        <transition-group enter-active-class="animated fadeInUp" leave-active-class="animated fadeOutDown">
          <router-link :to="{path: '/' + id}" v-for="(id, index) in roomIds" v-bind:key="id" class="collection-item">Join Room {{ id }}</router-link>
        </transition-group>
      </div>
    </div>
  </div>
  `,

  mounted() {
    // console.log('page index', this.$socket.connected);
    this.$options.sockets.LIST_ROOMS = ({ roomIds }) => {
      // console.log('roomIds', roomIds);
      // Add rooms
      for (const roomId of roomIds) {
        if (!this.roomIds.includes(roomId)) {
          this.roomIds.push(roomId);
        }
      }

      // Remove rooms
      for (const roomId of this.roomIds) {
        if (!roomIds.includes(roomId)) {
          this.roomIds.splice(this.roomIds.indexOf(roomId), 1);
        }
      }
    };

    this.$options.sockets.GENERATE_ROOM = ({ roomId }) => {
      // window.location.href = `/${data.id}`;
      this.$router.push(`/${roomId}`);
    };

    this.$socket.emit('LIST_ROOMS');
  },
  beforeDestroy() {
    delete this.$options.sockets.LIST_ROOMS;
    delete this.$options.sockets.GENERATE_ROOM;
  },
  methods: {
    hostClick() {
      this.$socket.emit('GENERATE_ROOM');
    },
  },
  data() {
    return {
      roomIds: [],
    };
  },
};
