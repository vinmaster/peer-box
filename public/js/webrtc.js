/**
 * webrtc.js — WebRTC full-mesh peer manager
 *
 * Manages one RTCPeerConnection per remote peer.
 * Exposes a simple event-driven API consumed by room.js.
 *
 * Events fired: onMessage(from, fromName, type, data)
 *               onFileProgress(transferId, progress, meta)
 *               onFileComplete(transferId, blob, meta, from, fromName)
 *               onPeerConnect(peerId)
 *               onPeerDisconnect(peerId)
 */

const CHUNK_SIZE = 64 * 1024; // 64KB chunks

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

class WebRTCMesh {
  constructor(socket, myId, myName) {
    this.socket = socket;
    this.myId = myId;
    this.myName = myName;
    this.peers = new Map(); // peerId → { pc, dc, name }
    this.incomingFiles = new Map(); // transferId → { chunks, meta }

    // Callbacks (set by room.js)
    this.onMessage = null;
    this.onFileProgress = null;
    this.onFileComplete = null;
    this.onPeerConnect = null;
    this.onPeerDisconnect = null;

    // Listen for WebRTC signals from server
    this.socket.on('signal', ({ from, signal }) => this._handleSignal(from, signal));
  }

  // ─── Add a new peer (called when someone joins) ──────────────────────────
  async addPeer(peerId, peerName, initiator) {
    if (this.peers.has(peerId)) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peerEntry = { pc, dc: null, name: peerName, initiator };
    this.peers.set(peerId, peerEntry);

    // ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.socket.emit('signal', { to: peerId, signal: { type: 'ice', candidate } });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        this.onPeerConnect?.(peerId);
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        this._removePeer(peerId);
        this.onPeerDisconnect?.(peerId);
      }
    };

    if (initiator) {
      // Create data channel
      const dc = pc.createDataChannel('data', { ordered: true });
      peerEntry.dc = dc;
      this._setupDataChannel(dc, peerId);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit('signal', { to: peerId, signal: { type: 'offer', sdp: offer } });
    } else {
      // Wait for data channel
      pc.ondatachannel = ({ channel }) => {
        peerEntry.dc = channel;
        this._setupDataChannel(channel, peerId);
      };
    }
  }

  // ─── Handle incoming signal ───────────────────────────────────────────────
  async _handleSignal(from, signal) {
    let peerEntry = this.peers.get(from);

    if (!peerEntry) {
      // Create PC entry if we don't have one yet (answer side)
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerEntry = { pc, dc: null, name: 'Unknown', initiator: false };
      this.peers.set(from, peerEntry);

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          this.socket.emit('signal', { to: from, signal: { type: 'ice', candidate } });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') this.onPeerConnect?.(from);
        if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          this._removePeer(from);
          this.onPeerDisconnect?.(from);
        }
      };

      pc.ondatachannel = ({ channel }) => {
        peerEntry.dc = channel;
        this._setupDataChannel(channel, from);
      };
    }

    const { pc } = peerEntry;

    if (signal.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket.emit('signal', { to: from, signal: { type: 'answer', sdp: answer } });
    } else if (signal.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    } else if (signal.type === 'ice') {
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
    }
  }

  // ─── Setup data channel listeners ────────────────────────────────────────
  _setupDataChannel(dc, peerId) {
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      const peer = this.peers.get(peerId);
      if (peer) this.onPeerConnect?.(peerId);
    };

    dc.onclose = () => {
      this._removePeer(peerId);
      this.onPeerDisconnect?.(peerId);
    };

    dc.onmessage = ({ data }) => {
      this._handleDataChannelMessage(data, peerId);
    };
  }

  _handleDataChannelMessage(data, peerId) {
    const peer = this.peers.get(peerId);
    const fromName = peer?.name || 'Unknown';

    if (typeof data === 'string') {
      // JSON envelope
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'chat' || msg.type === 'clipboard') {
          this.onMessage?.(peerId, fromName, msg.type, msg.payload);
        } else if (msg.type === 'file-meta') {
          // Start receiving a file
          this.incomingFiles.set(msg.transferId, {
            chunks: [],
            meta: msg,
            received: 0,
          });
        } else if (msg.type === 'file-end') {
          const transfer = this.incomingFiles.get(msg.transferId);
          if (transfer) {
            const blob = new Blob(transfer.chunks, { type: transfer.meta.mimeType });
            this.onFileComplete?.(msg.transferId, blob, transfer.meta, peerId, fromName);
            this.incomingFiles.delete(msg.transferId);
          }
        }
      } catch {}
    } else {
      // Binary chunk: first 36 bytes = transferId (UUID as UTF-8)
      const idBuffer = new Uint8Array(data, 0, 36);
      const transferId = new TextDecoder().decode(idBuffer);
      const chunk = data.slice(36);

      const transfer = this.incomingFiles.get(transferId);
      if (transfer) {
        transfer.chunks.push(chunk);
        transfer.received += chunk.byteLength;
        const progress = Math.min(transfer.received / transfer.meta.size, 1);
        this.onFileProgress?.(transferId, progress, transfer.meta);
      }
    }
  }

  // ─── Sending ──────────────────────────────────────────────────────────────

  send(type, payload) {
    const msg = JSON.stringify({ type, payload });
    this.peers.forEach(({ dc }) => {
      if (dc?.readyState === 'open') {
        try { dc.send(msg); } catch {}
      }
    });
  }

  sendToPeer(peerId, type, payload) {
    const peer = this.peers.get(peerId);
    const msg = JSON.stringify({ type, payload });
    if (peer?.dc?.readyState === 'open') {
      try { peer.dc.send(msg); } catch {}
    }
  }

  async sendFile(file, onProgress) {
    if (this.peers.size === 0) throw new Error('No peers connected');

    const transferId = crypto.randomUUID();
    const meta = {
      type: 'file-meta',
      transferId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    };

    // Send meta to all peers
    const metaStr = JSON.stringify(meta);
    const dcs = [...this.peers.values()].map(p => p.dc).filter(dc => dc?.readyState === 'open');
    if (dcs.length === 0) throw new Error('No open data channels');

    dcs.forEach(dc => { try { dc.send(metaStr); } catch {} });

    // Stream file in chunks
    const buffer = await file.arrayBuffer();
    const idBytes = new TextEncoder().encode(transferId);
    let offset = 0;

    while (offset < buffer.byteLength) {
      const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
      offset += chunk.byteLength;

      // Prepend transferId to binary chunk
      const packet = new ArrayBuffer(36 + chunk.byteLength);
      const view = new Uint8Array(packet);
      view.set(idBytes, 0);
      view.set(new Uint8Array(chunk), 36);

      dcs.forEach(dc => {
        if (dc.readyState === 'open') {
          // Throttle if buffer is filling up
          if (dc.bufferedAmount > 8 * 1024 * 1024) {
            // Wait for buffer to drain
            const wait = new Promise(res => {
              const check = () => { dc.bufferedAmount < 4 * 1024 * 1024 ? res() : setTimeout(check, 50); };
              check();
            });
            wait.then(() => { try { dc.send(packet); } catch {} });
          } else {
            try { dc.send(packet); } catch {}
          }
        }
      });

      onProgress?.(offset / buffer.byteLength);
      // Yield to event loop every 16 chunks
      if ((offset / CHUNK_SIZE) % 16 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    // End signal
    const endMsg = JSON.stringify({ type: 'file-end', transferId });
    dcs.forEach(dc => { try { dc.send(endMsg); } catch {} });

    return transferId;
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  _removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (peer) {
      try { peer.dc?.close(); } catch {}
      try { peer.pc?.close(); } catch {}
      this.peers.delete(peerId);
    }
  }

  removePeer(peerId) {
    this._removePeer(peerId);
  }

  destroy() {
    this.peers.forEach((_, id) => this._removePeer(id));
    this.peers.clear();
  }

  isConnected(peerId) {
    const peer = this.peers.get(peerId);
    return peer?.dc?.readyState === 'open';
  }

  connectedCount() {
    return [...this.peers.values()].filter(p => p.dc?.readyState === 'open').length;
  }
}
