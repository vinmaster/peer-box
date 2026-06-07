/**
 * room.js — Room coordinator
 *
 * Orchestrates: socket signaling, transport layer (WebRTC/WS),
 * UI updates, file reassembly, chat.
 */

// ─── Init ─────────────────────────────────────────────────────────────────────
const roomCode = window.location.pathname.split('/room/')[1]?.trim();
if (!roomCode || !/^\d{4}$/.test(roomCode)) {
  window.location.href = '/';
}

const myName = localStorage.getItem('sb_pending_name') ||
  localStorage.getItem('sb_name') ||
  'Anonymous';
localStorage.removeItem('sb_pending_name');

let myId = null;
let peers = new Map(); // id → { id, name }
let transport = null;
let useWebSocket = false;
let msgCount = 0;
let fileCount = 0;

// ─── Socket Connection ────────────────────────────────────────────────────────
const socket = io({ transports: ['websocket', 'polling'] });

socket.on('connect', () => {
  myId = socket.id;
  setConnectingText('Joining room…');

  socket.emit('join-room', { code: roomCode, name: myName }, (res) => {
    if (res?.error) {
      setConnectingText('Error: ' + res.error);
      return;
    }

    // Initialize transport
    initTransport();

    // Add existing peers
    (res.peers || []).forEach(p => {
      addPeerToUI(p.id, p.name);
      peers.set(p.id, p);
      transport.addPeer(p.id, p.name, true); // we are initiator for existing peers
    });

    showRoom();
    updateRoomUI();
    loadQR();
  });
});

socket.on('peer-joined', (peerInfo) => {
  if (peerInfo.id === myId) return;
  peers.set(peerInfo.id, peerInfo);
  addPeerToUI(peerInfo.id, peerInfo.name);
  transport.addPeer(peerInfo.id, peerInfo.name, false); // they initiate offer to us
  showToast(`${peerInfo.name} joined`, 'Connected to room', 'success', 3000);
  updateRoomUI();
  appendSystemMsg(`${peerInfo.name} joined the room`);
});

socket.on('peer-left', ({ id }) => {
  const peer = peers.get(id);
  if (peer) {
    showToast(`${peer.name} left`, '', 'info', 3000);
    appendSystemMsg(`${peer.name} left the room`);
  }
  peers.delete(id);
  removePeerFromUI(id);
  transport.removePeer(id);
  updateRoomUI();
});

socket.on('disconnect', () => {
  showToast('Disconnected', 'Lost connection to server. Reconnecting…', 'error');
});

socket.on('reconnect', () => {
  showToast('Reconnected', 'Back online!', 'success');
});

socket.on('set-transport', (wsMode) => {
  if (useWebSocket !== wsMode) {
    toggleTransport(false);
  }
});

// ─── Transport Init ───────────────────────────────────────────────────────────
function initTransport() {
  if (transport) transport.destroy();

  if (useWebSocket) {
    transport = new WSTransport(socket, myId, myName);
  } else {
    transport = new WebRTCMesh(socket, myId, myName);
  }

  transport.onMessage = handleMessage;
  transport.onFileProgress = handleFileProgress;
  transport.onFileComplete = handleFileComplete;
  transport.onPeerConnect = (peerId) => {
    updatePeerStatus(peerId, 'connected');
  };
  transport.onPeerDisconnect = (peerId) => {
    updatePeerStatus(peerId, 'offline');
  };
}

// ─── Transport Toggle ─────────────────────────────────────────────────────────
function toggleTransport(sync = true) {
  useWebSocket = !useWebSocket;
  const track = document.getElementById('transport-toggle');
  const labelWebRTC = document.getElementById('label-webrtc');
  const labelWS = document.getElementById('label-ws');

  track.classList.toggle('active', useWebSocket);
  track.setAttribute('aria-checked', String(useWebSocket));
  labelWebRTC.classList.toggle('active', !useWebSocket);
  labelWS.classList.toggle('active', useWebSocket);

  // Re-init transport and re-connect peers
  initTransport();
  peers.forEach((p) => {
    transport.addPeer(p.id, p.name, true);
  });

  if (sync) {
    socket.emit('set-transport', useWebSocket);
  }

  showToast(
    useWebSocket ? 'Switched to WebSocket' : 'Switched to WebRTC',
    useWebSocket ? 'Data relayed via server' : 'Direct peer-to-peer',
    'info',
    3000
  );
}

// ─── Incoming Message Handler ─────────────────────────────────────────────────
function handleMessage(from, fromName, type, payload) {
  if (type === 'chat') {
    appendChatMsg(from, fromName, payload.text, Date.now(), false);
  }
}

// ─── File Transfers ───────────────────────────────────────────────────────────
const activeTransfers = new Map(); // transferId → DOM element

function handleFileProgress(transferId, progress, meta) {
  let item = activeTransfers.get(transferId);
  if (!item) {
    item = addTransferItem(transferId, meta, 'receiving');
    activeTransfers.set(transferId, item);
  }
  const fill = item.querySelector('.progress-fill');
  if (fill) fill.style.width = `${Math.round(progress * 100)}%`;
  const pct = item.querySelector('.transfer-pct');
  if (pct) pct.textContent = `${Math.round(progress * 100)}%`;
}

function handleFileComplete(transferId, blob, meta, from, fromName) {
  const item = activeTransfers.get(transferId);
  if (item) {
    const status = item.querySelector('.transfer-status');
    if (status) status.textContent = '✅ Received';
    item.querySelector('.transfer-pct')?.remove();
    const url = URL.createObjectURL(blob);
    const dl = item.querySelector('.transfer-dl');
    if (dl) {
      dl.href = url;
      dl.download = meta.name;
      dl.style.display = 'inline-flex';
    }
    activeTransfers.delete(transferId);
  }
  showToast(`📥 File received`, `${meta.name} (${formatBytes(meta.size)}) from ${fromName}`, 'success');

  // Auto-download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = meta.name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 10000);

  fileCount++;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  transport.send('chat', { text });
  appendChatMsg(myId, myName, text, Date.now(), true);
  input.value = '';
  input.style.height = 'auto';
}

function appendChatMsg(fromId, fromName, text, ts, own) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `chat-message${own ? ' own' : ''}`;

  const color = getPeerColor(fromId);

  div.innerHTML = `
    <div class="msg-avatar" style="width:32px;height:32px;background:${color.bg};" aria-hidden="true">
      ${getInitials(fromName)}
    </div>
    <div class="msg-content">
      <div class="msg-header${own ? ' msg-header-own' : ''}">
        <span class="msg-name">${escapeHtml(own ? 'You' : fromName)}</span>
        <span class="msg-time">${formatTime(ts)}</span>
        <button class="msg-copy-btn" onclick="copyChatText(this)" aria-label="Copy message" title="Copy">📋</button>
      </div>
      <div class="msg-bubble">${escapeHtml(text)}</div>
    </div>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function appendSystemMsg(text) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-system-msg';
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function copyChatText(btn) {
  const bubble = btn.closest('.msg-content').querySelector('.msg-bubble');
  if (bubble) {
    const text = bubble.textContent;
    navigator.clipboard.writeText(text).then(() => {
      const original = btn.textContent;
      btn.textContent = '✅';
      setTimeout(() => { btn.textContent = original; }, 2000);
    }).catch(() => {
      showToast('Error', 'Failed to copy to clipboard', 'error');
    });
  }
}
window.copyChatText = copyChatText;

// Chat auto-resize and Enter key
document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});

document.getElementById('chat-input').addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});



// ─── File Sending ─────────────────────────────────────────────────────────────
async function sendFiles(files) {
  for (const file of files) {
    try {
      const transferId = `send-${Date.now()}-${file.name}`;
      const item = addTransferItem(transferId, {
        name: file.name,
        size: file.size,
        mimeType: file.type,
      }, 'sending');

      await transport.sendFile(file, (progress) => {
        const fill = item.querySelector('.progress-fill');
        if (fill) fill.style.width = `${Math.round(progress * 100)}%`;
        const pct = item.querySelector('.transfer-pct');
        if (pct) pct.textContent = `${Math.round(progress * 100)}%`;
      });

      const fill = item.querySelector('.progress-fill');
      if (fill) {
        fill.style.width = '100%';
        fill.style.background = 'var(--accent-green)';
      }
      const status = item.querySelector('.transfer-status');
      if (status) status.textContent = '✅ Sent';
      item.querySelector('.transfer-pct')?.remove();

      showToast('📤 File sent', `${file.name} (${formatBytes(file.size)})`, 'success');
      fileCount++;
    } catch (err) {
      showToast('Transfer failed', err.message, 'error');
    }
  }
}

function addTransferItem(transferId, meta, direction) {
  const empty = document.getElementById('transfer-empty');
  if (empty) empty.style.display = 'none';

  const list = document.getElementById('transfer-list');
  const div = document.createElement('div');
  div.className = 'transfer-item';
  div.id = `transfer-${transferId}`;
  div.innerHTML = `
    <div class="transfer-icon" aria-hidden="true">${getFileIcon(meta.name)}</div>
    <div class="transfer-info">
      <div class="transfer-name" title="${escapeHtml(meta.name)}">${escapeHtml(meta.name)}</div>
      <div class="transfer-meta">
        <span>${formatBytes(meta.size)}</span>
        <span class="transfer-status">${direction === 'sending' ? '📤 Sending' : '📥 Receiving'}</span>
        <span class="transfer-pct">0%</span>
      </div>
      <div class="progress-bar" style="margin-top:6px;">
        <div class="progress-fill" style="width:0%"></div>
      </div>
    </div>
    <div class="transfer-actions">
      <a class="btn btn-primary btn-sm" style="display:none;text-decoration:none;" aria-label="Download file">⬇️ Save</a>
    </div>
  `;
  list.prepend(div);
  return div;
}

// ─── File Staging Queue ──────────────────────────────────────────────────────────────
const stagedFiles = []; // Array of File objects

function stageFiles(files) {
  if (!files.length) return;
  stagedFiles.push(...files);
  renderQueue();
}

function renderQueue() {
  const queueEl = document.getElementById('staged-queue');
  const listEl = document.getElementById('staged-list');
  queueEl.style.display = stagedFiles.length ? 'block' : 'none';
  listEl.innerHTML = '';

  stagedFiles.forEach((file, idx) => {
    const row = document.createElement('div');
    row.className = 'staged-item';
    row.innerHTML = `
      <span class="staged-item-icon" aria-hidden="true">${getFileIcon(file.name)}</span>
      <span class="staged-item-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
      <span class="staged-item-size">${formatBytes(file.size)}</span>
      <button class="staged-item-remove" onclick="removeFromQueue(${idx})" aria-label="Remove" title="Remove">&times;</button>
    `;
    listEl.appendChild(row);
  });

  const sendBtn = document.getElementById('btn-send-files');
  if (sendBtn) sendBtn.textContent = `📤 Send ${stagedFiles.length} File${stagedFiles.length > 1 ? 's' : ''}`;
}

function removeFromQueue(idx) {
  stagedFiles.splice(idx, 1);
  renderQueue();
}

function clearQueue() {
  stagedFiles.length = 0;
  renderQueue();
}
window.clearQueue = clearQueue;

async function sendStagedFiles() {
  if (!stagedFiles.length) return;
  const toSend = stagedFiles.splice(0); // take all and clear
  renderQueue();

  const sendBtn = document.getElementById('btn-send-files');
  if (sendBtn) sendBtn.disabled = true;

  await sendFiles(toSend);

  if (sendBtn) sendBtn.disabled = false;
}
window.sendStagedFiles = sendStagedFiles;
window.removeFromQueue = removeFromQueue;

// ─── Drop Zone ────────────────────────────────────────────────────────────────
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const files = [...e.dataTransfer.files];
  if (files.length) stageFiles(files);
});

// Global paste to capture files/images dropped anywhere
document.addEventListener('paste', (e) => {
  const items = [...(e.clipboardData?.items || [])];
  const files = items.filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
  if (files.length > 0) stageFiles(files);
});

fileInput.addEventListener('change', () => {
  const files = [...fileInput.files];
  if (files.length) stageFiles(files);
  fileInput.value = '';
});

dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});

// ─── UI ───────────────────────────────────────────────────────────────────────
function showRoom() {
  document.getElementById('connecting-overlay').classList.add('hidden');
  document.getElementById('room-layout').style.display = 'grid';
  document.getElementById('room-code-btn').textContent = roomCode;
  document.title = `ShareBox · Room ${roomCode}`;

  // Add self to peer list
  addPeerToUI(myId, myName, true);
}

function updateRoomUI() {
  const total = peers.size + 1; // +1 for self
  document.getElementById('peer-count').textContent = total;
}

function setConnectingText(text) {
  document.getElementById('connecting-text').textContent = text;
}

// ─── Peer List ────────────────────────────────────────────────────────────────
function addPeerToUI(id, name, isSelf = false) {
  const list = document.getElementById('peer-list');
  if (document.getElementById(`peer-item-${id}`)) return;

  const color = getPeerColor(id);
  const div = document.createElement('div');
  div.className = 'peer-item';
  div.id = `peer-item-${id}`;
  div.innerHTML = `
    <div class="peer-avatar ${isSelf ? 'connected' : 'connecting'}" style="background:${color.bg};" data-peer-id="${id}" aria-hidden="true">
      <span style="position:relative;z-index:1;">${getInitials(name)}</span>
      <div class="peer-avatar-ring"></div>
    </div>
    <div class="peer-info">
      <div class="peer-name">${escapeHtml(name)}${isSelf ? ' <span style="font-size:0.7rem;color:var(--text-muted);">(you)</span>' : ''}</div>
      <div class="peer-status" id="peer-status-${id}">${isSelf ? 'Host' : 'Connecting…'}</div>
    </div>
  `;
  list.appendChild(div);
}

function removePeerFromUI(id) {
  const el = document.getElementById(`peer-item-${id}`);
  if (el) {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-16px)';
    el.style.transition = 'all 0.25s ease';
    setTimeout(() => el.remove(), 250);
  }
}

function updatePeerStatus(id, status) {
  const avatar = document.querySelector(`[data-peer-id="${id}"].peer-avatar`);
  if (avatar) {
    avatar.classList.remove('connected', 'connecting');
    if (status === 'connected') avatar.classList.add('connected');
    else if (status === 'connecting') avatar.classList.add('connecting');
  }
  const statusEl = document.getElementById(`peer-status-${id}`);
  if (statusEl) {
    statusEl.textContent = status === 'connected' ? '🟢 Connected' : '🔴 Disconnected';
  }
}



// ─── QR Code ──────────────────────────────────────────────────────────────────
function loadQR() {
  const qrUrl = `/api/qr/${roomCode}`;
  document.getElementById('sidebar-qr').src = qrUrl;
  document.getElementById('qr-modal-img').src = qrUrl;
  document.getElementById('qr-modal-code').textContent = roomCode;
  const fullUrl = `${location.protocol}//${location.host}/room/${roomCode}`;
  document.getElementById('qr-modal-url').textContent = fullUrl;
}

function openQRModal() { openModal('qr-modal'); }
function closeQRModal() { closeModal('qr-modal'); }

function copyRoomLink() {
  const url = `${location.protocol}//${location.host}/room/${roomCode}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copied!', url, 'success');
  });
}

function copyRoomCode() {
  navigator.clipboard.writeText(roomCode).then(() => {
    showToast('Code copied!', roomCode, 'success');
  });
}

// ─── Leave ────────────────────────────────────────────────────────────────────
function leaveRoom() {
  transport?.destroy();
  socket.disconnect();
  window.location.href = '/';
}

// ─── Transport toggle keyboard ────────────────────────────────────────────────
document.getElementById('transport-toggle').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') toggleTransport();
});

// ─── Hold to Pair (Host) ───────────────────────────────────────────────────────
const btnHostHoldPair = document.getElementById('btn-host-hold-pair');
let hostHoldTimer = null;

socket.on('pairing-matched', ({ joinerId }) => {
  showToast('Matched!', `Someone joined via Hold to Pair.`, 'success');
  // the 'peer-joined' event will handle adding them to the UI
});

function startHostHoldPairing(e) {
  if (e) {
    if (e.type === 'touchstart') e.preventDefault(); 
  }
  if (hostHoldTimer) return;

  btnHostHoldPair.classList.add('holding');
  document.getElementById('host-hold-pair-text').textContent = 'Waiting for joiner...';

  hostHoldTimer = setTimeout(() => {
    socket.emit('start-pairing', { role: 'host', roomCode: roomCode });
  }, 200);
}

function stopHostHoldPairing() {
  clearTimeout(hostHoldTimer);
  hostHoldTimer = null;
  
  if (btnHostHoldPair.classList.contains('holding')) {
    btnHostHoldPair.classList.remove('holding');
    document.getElementById('host-hold-pair-text').textContent = 'Hold to Pair';
    socket.emit('stop-pairing');
  }
}

btnHostHoldPair.addEventListener('mousedown', startHostHoldPairing);
btnHostHoldPair.addEventListener('touchstart', startHostHoldPairing, { passive: false });

window.addEventListener('mouseup', stopHostHoldPairing);
window.addEventListener('touchend', stopHostHoldPairing);
window.addEventListener('blur', stopHostHoldPairing);
