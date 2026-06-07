/**
 * landing.js — Landing page: create/join room, QR scanning
 */

// ─── Tab Switcher ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  ['create', 'join'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('active', t === tab);
    document.getElementById(`panel-${t}`).classList.toggle('active', t === tab);
  });
  if (tab === 'join') {
    document.getElementById('digit-0').focus();
  } else {
    document.getElementById('create-name').focus();
  }
}

// ─── Avatar previews ──────────────────────────────────────────────────────────
const createNameEl = document.getElementById('create-name');
const createAvatarEl = document.getElementById('create-avatar');
const joinNameEl = document.getElementById('join-name');
const joinAvatarEl = document.getElementById('join-avatar');

createNameEl.addEventListener('input', () => updateAvatarPreview(createNameEl, createAvatarEl));
joinNameEl.addEventListener('input', () => updateAvatarPreview(joinNameEl, joinAvatarEl));

// Init from localStorage
const savedName = localStorage.getItem('sb_name') || '';
createNameEl.value = savedName;
joinNameEl.value = savedName;
updateAvatarPreview(createNameEl, createAvatarEl);
updateAvatarPreview(joinNameEl, joinAvatarEl);

// ─── Digit Input Logic ────────────────────────────────────────────────────────
const digits = [0, 1, 2, 3].map(i => document.getElementById(`digit-${i}`));

digits.forEach((input, i) => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && i > 0) {
      digits[i - 1].focus();
      digits[i - 1].value = '';
    }
    if (e.key === 'Enter') handleJoin();
    if (e.key === 'ArrowLeft' && i > 0) digits[i - 1].focus();
    if (e.key === 'ArrowRight' && i < 3) digits[i + 1].focus();
  });

  input.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '');
    input.value = val ? val[0] : '';
    if (val && i < 3) digits[i + 1].focus();
    hideJoinError();
  });

  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
    if (text.length === 4) {
      digits.forEach((d, idx) => { d.value = text[idx] || ''; });
      digits[3].focus();
      hideJoinError();
    }
  });
});

function getCode() {
  return digits.map(d => d.value).join('');
}

function showJoinError() {
  document.getElementById('join-error').classList.add('visible');
}

function hideJoinError() {
  document.getElementById('join-error').classList.remove('visible');
}

// ─── Create Room ──────────────────────────────────────────────────────────────
async function handleCreate() {
  const name = createNameEl.value.trim() || 'Anonymous';
  localStorage.setItem('sb_name', name);

  const btn = document.getElementById('btn-create');
  btn.disabled = true;
  btn.textContent = 'Creating…';

  try {
    const res = await fetch('/api/rooms', { method: 'POST' });
    if (!res.ok) throw new Error('Server error');
    const { code } = await res.json();
    localStorage.setItem('sb_pending_name', name);
    window.location.href = `/room/${code}`;
  } catch (err) {
    showToast('Error', 'Could not create room. Is the server running?', 'error');
    btn.disabled = false;
    btn.innerHTML = '<span>✨</span> Create Room';
  }
}

// ─── Join Room ────────────────────────────────────────────────────────────────
async function handleJoin() {
  const code = getCode();
  if (code.length !== 4) {
    showToast('Incomplete code', 'Please enter all 4 digits', 'warning');
    digits.find(d => !d.value)?.focus();
    return;
  }

  const name = joinNameEl.value.trim() || 'Anonymous';
  localStorage.setItem('sb_name', name);

  const btn = document.getElementById('btn-join');
  btn.disabled = true;
  btn.textContent = 'Joining…';
  hideJoinError();

  try {
    const res = await fetch(`/api/rooms/${code}`);
    if (res.status === 404) {
      showJoinError();
      btn.disabled = false;
      btn.innerHTML = '<span>🔗</span> Join Room';
      return;
    }
    if (!res.ok) throw new Error('Server error');
    localStorage.setItem('sb_pending_name', name);
    window.location.href = `/room/${code}`;
  } catch (err) {
    showToast('Error', 'Could not reach server', 'error');
    btn.disabled = false;
    btn.innerHTML = '<span>🔗</span> Join Room';
  }
}

// Enter key on create name
createNameEl.addEventListener('keydown', e => { if (e.key === 'Enter') handleCreate(); });

// ─── QR Scanner ───────────────────────────────────────────────────────────────
let scanStream = null;
let scanInterval = null;

async function startQRScan() {
  openModal('scan-modal');
  const video = document.getElementById('scan-video');
  const status = document.getElementById('scan-status');

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = scanStream;
    await video.play();
    status.textContent = 'Scanning…';

    // Use BarcodeDetector if available
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      scanInterval = setInterval(async () => {
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            const raw = codes[0].rawValue;
            handleScannedQR(raw);
          }
        } catch {}
      }, 500);
    } else {
      status.textContent = 'QR scanning not supported in this browser. Use Chrome/Edge.';
    }
  } catch (err) {
    status.textContent = 'Camera access denied or unavailable.';
  }
}

function handleScannedQR(url) {
  closeScanModal();
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/room\/(\d{4})/);
    if (match) {
      const code = match[1];
      switchTab('join');
      digits.forEach((d, i) => { d.value = code[i]; });
      showToast('QR Scanned!', `Room code: ${code}`, 'success');
      handleJoin();
    } else {
      showToast('Invalid QR', 'This QR code is not a ShareBox room', 'error');
    }
  } catch {
    showToast('Invalid QR', 'Could not parse QR code', 'error');
  }
}

function closeScanModal() {
  closeModal('scan-modal');
  if (scanStream) {
    scanStream.getTracks().forEach(t => t.stop());
    scanStream = null;
  }
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
}

// Check URL params for auto-fill (e.g., if redirected from a room link)
const urlParams = new URLSearchParams(window.location.search);
const autoCode = urlParams.get('code');
if (autoCode && /^\d{4}$/.test(autoCode)) {
  switchTab('join');
  digits.forEach((d, i) => { d.value = autoCode[i]; });
}

// ─── Hold to Pair ─────────────────────────────────────────────────────────────
const socket = io({ transports: ['websocket', 'polling'] });
const btnHoldPair = document.getElementById('btn-hold-pair');
let holdTimer = null;

socket.on('pairing-success', ({ roomCode }) => {
  stopHoldPairing();
  const name = joinNameEl.value.trim() || 'Anonymous';
  localStorage.setItem('sb_name', name);
  localStorage.setItem('sb_pending_name', name);
  showToast('Matched!', `Joining room ${roomCode}...`, 'success');
  setTimeout(() => {
    window.location.href = `/room/${roomCode}`;
  }, 500);
});

function startHoldPairing(e) {
  if (e) {
    // Only prevent default on touch to avoid mouse selection issues, but we want button press
    if (e.type === 'touchstart') e.preventDefault(); 
  }
  if (holdTimer) return;

  btnHoldPair.classList.add('holding');
  document.getElementById('hold-pair-text').textContent = 'Searching...';

  // Small delay to prevent accidental taps
  holdTimer = setTimeout(() => {
    socket.emit('start-pairing', { role: 'joiner' });
  }, 200);
}

function stopHoldPairing() {
  clearTimeout(holdTimer);
  holdTimer = null;
  
  if (btnHoldPair.classList.contains('holding')) {
    btnHoldPair.classList.remove('holding');
    document.getElementById('hold-pair-text').textContent = 'Hold to Pair';
    socket.emit('stop-pairing');
  }
}

btnHoldPair.addEventListener('mousedown', startHoldPairing);
btnHoldPair.addEventListener('touchstart', startHoldPairing, { passive: false });

window.addEventListener('mouseup', stopHoldPairing);
window.addEventListener('touchend', stopHoldPairing);
window.addEventListener('blur', stopHoldPairing);
