/**
 * wsTransport.js — WebSocket (Socket.io) relay transport
 *
 * Mirror API of WebRTCMesh so room.js can swap transports transparently.
 * All data goes through the server as a relay.
 */

const WS_CHUNK_SIZE = 256 * 1024; // 256KB chunks for WS relay

class WSTransport {
  constructor(socket, myId, myName) {
    this.socket = socket;
    this.myId = myId;
    this.myName = myName;
    this.incomingFiles = new Map();

    // Callbacks
    this.onMessage = null;
    this.onFileProgress = null;
    this.onFileComplete = null;
    this.onPeerConnect = null;
    this.onPeerDisconnect = null;

    // Listen for relayed data
    this.socket.on('relay-data', (payload) => this._handleRelayData(payload));
  }

  // These are no-ops for WS transport (connection is via socket room)
  addPeer(peerId, peerName) {
    this.onPeerConnect?.(peerId);
  }

  removePeer(peerId) {
    this.onPeerDisconnect?.(peerId);
  }

  isConnected() { return this.socket.connected; }
  connectedCount() { return 0; } // WS doesn't track individual P2P connections

  // ─── Send helpers ─────────────────────────────────────────────────────────

  send(type, payload) {
    this.socket.emit('relay-data', {
      type,
      payload,
      fromName: this.myName,
    });
  }

  sendToPeer(peerId, type, payload) {
    // WS relay broadcasts to room; targeted sends aren't supported in fallback
    this.send(type, payload);
  }

  async sendFile(file, onProgress, existingTransferId) {
    const transferId = existingTransferId || crypto.randomUUID();
    const meta = {
      type: 'file-meta',
      transferId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    };

    this.socket.emit('relay-data', { ...meta, fromName: this.myName });

    let offset = 0;

    while (offset < file.size) {
      const chunkBlob = file.slice(offset, offset + WS_CHUNK_SIZE);
      const chunk = await chunkBlob.arrayBuffer();
      offset += chunk.byteLength;

      this.socket.emit('relay-data', {
        type: 'file-chunk',
        transferId,
        data: chunk, // binary supported by socket.io
        fromName: this.myName,
      });

      onProgress?.(offset / file.size);
      
      // Yield to prevent UI freeze and overwhelming the internal buffer
      await new Promise(r => setTimeout(r, 5));
    }

    this.socket.emit('relay-data', {
      type: 'file-end',
      transferId,
      fromName: this.myName,
    });

    return transferId;
  }

  // ─── Receive ──────────────────────────────────────────────────────────────

  _handleRelayData(payload) {
    const { from, fromName, type } = payload;

    if (type === 'chat' || type === 'clipboard') {
      this.onMessage?.(from, fromName, type, payload.payload);
    } else if (type === 'file-meta') {
      this.incomingFiles.set(payload.transferId, {
        chunks: [],
        meta: payload,
        received: 0,
      });
    } else if (type === 'file-chunk') {
      const transfer = this.incomingFiles.get(payload.transferId);
      if (transfer) {
        let buf = payload.data;
        if (!buf) return;
        if (!(buf instanceof ArrayBuffer)) {
          if (buf.buffer instanceof ArrayBuffer) {
            buf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
          } else {
            buf = new Uint8Array(buf).buffer;
          }
        }
        
        transfer.chunks.push(buf);
        transfer.received += buf.byteLength;
        const progress = Math.min(transfer.received / transfer.meta.size, 1);
        this.onFileProgress?.(payload.transferId, progress, transfer.meta);
      }
    } else if (type === 'file-end') {
      const transfer = this.incomingFiles.get(payload.transferId);
      if (transfer) {
        const blob = new Blob(transfer.chunks, { type: transfer.meta.mimeType });
        this.onFileComplete?.(payload.transferId, blob, transfer.meta, from, fromName);
        this.incomingFiles.delete(payload.transferId);
      }
    }
  }

  destroy() {
    this.socket.off('relay-data');
  }
}
