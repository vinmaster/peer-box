const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 100 * 1024 * 1024, // 100MB for WS relay
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Room State ────────────────────────────────────────────────────────────
const rooms = new Map(); // code → { peers: Map<socketId, peerInfo>, createdAt, timer }
const ROOM_EXPIRY_MS = 5 * 60 * 1000; // 5 min after last peer leaves

// ─── Pairing State ─────────────────────────────────────────────────────────
const activeHosts = new Map(); // socketId → roomCode
const activeJoiners = new Map(); // socketId → true

function checkPairing() {
  if (activeHosts.size === 1 && activeJoiners.size === 1) {
    const hostId = Array.from(activeHosts.keys())[0];
    const joinerId = Array.from(activeJoiners.keys())[0];
    const roomCode = activeHosts.get(hostId);

    io.to(hostId).emit('pairing-matched', { joinerId });
    io.to(joinerId).emit('pairing-success', { roomCode });

    activeHosts.delete(hostId);
    activeJoiners.delete(joinerId);
  }
}

function generateRoomCode() {
  let code;
  let attempts = 0;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
    attempts++;
  } while (rooms.has(code) && attempts < 100);
  return code;
}

function createRoom(code) {
  const room = { peers: new Map(), createdAt: Date.now(), timer: null, wsMode: false };
  rooms.set(code, room);
  return room;
}

function scheduleRoomExpiry(code) {
  const room = rooms.get(code);
  if (!room) return;
  if (room.timer) clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    rooms.delete(code);
    console.log(`[Room] ${code} expired (empty)`);
  }, ROOM_EXPIRY_MS);
}

function cancelRoomExpiry(code) {
  const room = rooms.get(code);
  if (!room || !room.timer) return;
  clearTimeout(room.timer);
  room.timer = null;
}

// ─── HTTP Endpoints ────────────────────────────────────────────────────────

// Create a new room
app.post('/api/rooms', (req, res) => {
  const code = generateRoomCode();
  createRoom(code);
  console.log(`[Room] Created: ${code}`);
  res.json({ code });
});

// Validate a room exists
app.get('/api/rooms/:code', (req, res) => {
  const { code } = req.params;
  if (!/^\d{4}$/.test(code)) return res.status(400).json({ error: 'Invalid code format' });
  if (!rooms.has(code)) return res.status(404).json({ error: 'Room not found' });
  const room = rooms.get(code);
  res.json({ code, peerCount: room.peers.size });
});

// QR code image for room URL
app.get('/api/qr/:code', async (req, res) => {
  const { code } = req.params;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const url = `${proto}://${host}/room/${code}`;
  try {
    const svg = await QRCode.toString(url, {
      type: 'svg',
      color: { dark: '#a78bfa', light: '#00000000' },
      width: 256,
      margin: 1,
    });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

// Serve room.html for room routes
app.get('/room/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

// ─── Socket.io Signaling ───────────────────────────────────────────────────

io.on('connection', (socket) => {
  let currentRoom = null;
  let peerName = null;

  console.log(`[Socket] Connected: ${socket.id}`);

  // Join or create a room
  socket.on('join-room', ({ code, name, peerId }, ack) => {
    if (!/^\d{4}$/.test(code)) return ack?.({ error: 'Invalid code' });

    // Auto-create room if it doesn't exist (allows deep-linking via QR)
    if (!rooms.has(code)) createRoom(code);

    const room = rooms.get(code);
    cancelRoomExpiry(code);

    peerName = name || `User ${Math.floor(Math.random() * 900) + 100}`;
    currentRoom = code;

    // Check for existing peer with the same peerId to prevent duplicates on reconnect/refresh
    if (peerId) {
      for (const [sid, p] of room.peers.entries()) {
        if (p.peerId === peerId) {
          room.peers.delete(sid);
          io.to(code).emit('peer-left', { id: sid });
          const oldSocket = io.sockets.sockets.get(sid);
          if (oldSocket) oldSocket.leave(code);
          console.log(`[Room] ${code}: Removed stale socket ${sid} for re-joining peer ${peerName}`);
        }
      }
    }

    const peerInfo = { id: socket.id, name: peerName, peerId, joinedAt: Date.now() };
    room.peers.set(socket.id, peerInfo);
    socket.join(code);

    // Tell the new peer about everyone else
    const existingPeers = [...room.peers.values()].filter(p => p.id !== socket.id);

    // Tell everyone else about the new peer
    socket.to(code).emit('peer-joined', peerInfo);

    console.log(`[Room] ${code}: ${peerName} joined (${room.peers.size} peers)`);

    ack?.({ ok: true, peers: existingPeers, you: peerInfo, wsMode: room.wsMode });
  });

  // WebRTC signaling relay
  socket.on('signal', ({ to, signal }) => {
    if (!currentRoom) return;
    io.to(to).emit('signal', { from: socket.id, signal });
  });

  // WebSocket relay transport (fallback / non-WebRTC mode)
  // Binary chunks streamed through the server
  socket.on('relay-data', (payload) => {
    if (!currentRoom) return;
    // Broadcast to all others in the room
    socket.to(currentRoom).emit('relay-data', {
      from: socket.id,
      fromName: peerName,
      ...payload,
    });
  });

  // Transport toggle synchronization
  socket.on('set-transport', (wsMode) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (room) room.wsMode = wsMode;
    socket.to(currentRoom).emit('set-transport', wsMode);
  });

  // Tap & Hold Pairing
  socket.on('start-pairing', ({ role, roomCode }) => {
    if (role === 'host' && roomCode) {
      activeHosts.set(socket.id, roomCode);
    } else if (role === 'joiner') {
      activeJoiners.set(socket.id, true);
    }
    checkPairing();
  });

  socket.on('stop-pairing', () => {
    activeHosts.delete(socket.id);
    activeJoiners.delete(socket.id);
  });

  socket.on('disconnect', () => {
    activeHosts.delete(socket.id);
    activeJoiners.delete(socket.id);

    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    room.peers.delete(socket.id);
    io.to(currentRoom).emit('peer-left', { id: socket.id });
    console.log(`[Room] ${currentRoom}: ${peerName} left (${room.peers.size} peers)`);

    if (room.peers.size === 0) {
      scheduleRoomExpiry(currentRoom);
    }
  });
});

// ─── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 PeerBox running at http://localhost:${PORT}\n`);
});
