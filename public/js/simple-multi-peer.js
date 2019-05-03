/* global SimplePeer */
/* eslint-disable no-console */

class SimpleMultiPeer { // eslint-disable-line no-unused-vars
  constructor(options) {
    this._peerOptions = options.peerOptions || {};
    this.roomId = options.roomId;
    this.callbacks = options.callbacks || {};
    this.peers = {};

    if (options.socket) {
      this.listeners = options.listeners;
      this.socket = options.socket;
      this.listeners.PEERS_LIST = ({ socketIds }) => {
        this.isHost = this.socket.id === socketIds[0];
        // console.log('PEERS_LIST', this.socket.id, socketIds, this.isHost);
        socketIds.forEach(socketId => {
          // Self should not be in peers
          if (!this.peers[socketId]) {
            // const initiator = socketIds.indexOf(socketId) === 0;
            const initiator = this.isHost && this.socket.id !== socketId;
            this.peers[socketId] = new SimplePeer(Object.assign({ initiator }, this._peerOptions));
            this.registerPeerEvents(this.peers[socketId], socketId);
          }
        });
      };

      // Receive signal from peers
      this.listeners.PEERS_SIGNAL = ({ socketId, socketIds, signal }) => {
        // console.log('PEERS_SIGNAL', this.socket.id, socketId);
        // TODO fix when greater than 3 people
        if (socketIds.length > 2 && this.socket.id === socketId) {
          return;
        }
        if (!this.peers[socketId]) {
          this.peers[socketId] = new SimplePeer(Object.assign({}, this._peerOptions));
          this.registerPeerEvents(this.peers[socketId], socketId);
        }
        try {
          this.peers[socketId].signal(signal);
        } catch (error) {
          // if (this.callbacks.error) {
          //   return this.callbacks.error(error);
          // }
          throw error;
        }
      };

      this.socket.emit('PEERS_JOIN', { roomId: this.roomId });
    }
  }

  /* --------------------- Public API --------------------- */

  registerPeerEvents(peer, id) {
    ['Connect', 'Signal', 'Data', 'Stream', 'Close'].forEach(event => {
      peer.on(event.toLowerCase(), this[`onPeer${event}`].bind(this, id));
    });
  }

  send(data) {
    Object.keys(this.peers).forEach(id => {
      // if (this.socket.id === id) {
      if (this.peers[id].channelName === null) {
        return;
      }
      this.peers[id].send(data);
    });
  }

  apply(func, args) {
    Object.keys(this.peers).forEach(id => {
      this.peers[id][func].apply(this.peers[id], args); // eslint-disable-line
    });
  }

  getPeer(id) {
    return this.peers[id];
  }

  deleteSocket(socketId) {
    delete this.peers[socketId];
  }

  deleteListeners() {
    delete this.listeners.PEERS_LIST;
    delete this.listeners.PEERS_SIGNAL;
  }

  /* --------------------- Peer Events --------------------- */

  onPeerConnect(socketId) {
    // console.log(`PEER connected to ${socketId}`);
    this.callbacks.connect && this.callbacks.connect(socketId);
  }

  onPeerSignal(socketId, signal) {
    // console.log(`PEER signal send to others ${this.socket.id} ${socketId} ${signal}`);
    // Send signal to other peers
    this.socket.emit('PEERS_SIGNAL', {
      roomId: this.roomId,
      socketId,
      signal,
    });
  }

  onPeerData(socketId, data) {
    // console.log(`PEER received data from ${socketId}`);
    this.callbacks.data && this.callbacks.data(socketId, data);
  }

  onPeerStream(socketId, stream) {
    // console.log(`received stream ${stream} from ${socketId}`);
    this.callbacks.stream && this.callbacks.stream(socketId, stream);
  }

  onPeerClose(socketId) {
    delete this.peers[socketId];
    // console.log(`PEER closed to ${socketId}`);
    this.callbacks.close && this.callbacks.close(socketId);
  }
}
