/*
Credit: https://github.com/nihey/simple-multi-peer

Requires:
import NodeModulesPolyfills from '@esbuild-plugins/node-modules-polyfill';
import GlobalsPolyfills from '@esbuild-plugins/node-globals-polyfill';
in vite config

Flow:
PEERS_JOIN -> PEERS_START -> PEERS_SIGNAL
*/

import SimplePeer from 'simple-peer';
import { Socket } from 'socket.io-client';

interface CallbackFns {
  connect?: Function;
  data?: Function;
  stream?: Function;
  signal?: Function;
  close?: Function;
}

export class SimpleMultiPeer {
  socket: Socket;
  roomId: string;
  peerOptions: any;
  peers: Map<string, any>;
  callbacks: CallbackFns;
  isHost: boolean;

  constructor(options: {
    socket: Socket;
    roomId: string;
    peerOptions?: any;
    callbacks?: CallbackFns;
  }) {
    this.socket = options.socket;
    this.roomId = options.roomId;
    this.peerOptions = options.peerOptions || {};
    this.peers = new Map();
    this.callbacks = options.callbacks || {};

    this.registerSignalEvents();
    this.socket.emit('PEERS_JOIN', { roomId: this.roomId });
  }

  // Public API
  send(data: any) {
    this.peers.forEach(peer => peer.send(data));
  }

  sendStringify(data: any) {
    this.send(JSON.stringify(data));
  }

  close() {
    this.peers.forEach(peer => peer.destroy());
    this.peers.clear();
  }

  // Signal events
  private registerSignalEvents() {
    this.socket.on(
      'PEERS_START',
      ({ socketIds, initiator }: { socketIds: string[]; initiator: boolean }) => {
        console.log('---- before peers start', this.peers.size);
        socketIds.forEach(socketId => {
          // Self should not be in peers
          if (!this.peers.has(socketId)) {
            this.peers.set(
              socketId,
              new SimplePeer(Object.assign({ initiator, trickle: false }, this.peerOptions))
            );
            this.registerPeerEvents(this.peers.get(socketId), socketId);
          }
        });
      }
    );

    // Receive signal from peers
    this.socket.on(
      'PEERS_SIGNAL',
      ({ socketId, socketIds, signal }: { socketId: string; socketIds: string[]; signal: any }) => {
        if (!this.peers.has(socketId)) {
          console.error('should not be here', socketId);
        }
        console.log('---- after peers signal', this.peers.size);
        this.peers.get(socketId).signal(signal);
      }
    );
  }

  // Peer events
  private registerPeerEvents(peer, socketId: string) {
    ['Connect', 'Signal', 'Data', 'Stream', 'Close'].forEach(event => {
      peer.on(event.toLowerCase(), this[`onPeer${event}`].bind(this, socketId));
    });
  }

  private onPeerConnect(socketId: string) {
    this.callbacks.connect && this.callbacks.connect(socketId);
  }

  private onPeerSignal(socketId, signal) {
    this.callbacks.signal && this.callbacks.signal(socketId);
    // console.log(`PEER signal send to others ${this.socket.id} ${socketId} ${signal}`);
    // Send signal to other peers
    this.socket.emit('PEERS_SIGNAL', {
      roomId: this.roomId,
      socketId,
      signal,
    });
  }

  private onPeerData(socketId, data) {
    // console.log(`PEER received data from ${socketId}`);
    this.callbacks.data && this.callbacks.data(socketId, data);
  }

  private onPeerStream(socketId, stream) {
    // console.log(`received stream ${stream} from ${socketId}`);
    this.callbacks.stream && this.callbacks.stream(socketId, stream);
  }

  onPeerClose(socketId) {
    if (!this.peers.has(socketId)) {
      console.error(`Socket id not found: ${socketId}`);
      return;
      // throw new Error(`Socket id not found: ${socketId}`);
    }
    this.peers.get(socketId).destroy();
    this.peers.delete(socketId);
    // console.log(`PEER closed to ${socketId}`);
    this.callbacks.close && this.callbacks.close(socketId);
  }
}
