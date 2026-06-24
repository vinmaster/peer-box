/**
 * ui.js — Shared UI utilities: toasts, modals, avatars, peer colors
 */

// ─── Fun Name Generator ─────────────────────────────────────────────────────
const FUN_ADJECTIVES = [
  'Cosmic', 'Turbo', 'Sneaky', 'Fuzzy', 'Electric', 'Mighty', 'Chill',
  'Groovy', 'Zippy', 'Bouncy', 'Stealthy', 'Blazing', 'Sparkly', 'Jolly',
  'Mystic', 'Swift', 'Witty', 'Lucky', 'Daring', 'Breezy', 'Spicy',
  'Nifty', 'Cozy', 'Giggly', 'Bold', 'Crispy', 'Frosty', 'Dizzy',
  'Snappy', 'Peppy', 'Zesty', 'Goofy', 'Sassy', 'Wacky', 'Plucky',
];

const FUN_NOUNS = [
  'Panda', 'Otter', 'Fox', 'Falcon', 'Koala', 'Penguin', 'Raccoon',
  'Llama', 'Gecko', 'Capybara', 'Quokka', 'Axolotl', 'Narwhal', 'Sloth',
  'Parrot', 'Wombat', 'Octopus', 'Hedgehog', 'Dolphin', 'Flamingo',
  'Chameleon', 'Meerkat', 'Bison', 'Toucan', 'Badger', 'Lemur',
  'Puffin', 'Chinchilla', 'Corgi', 'Mantis', 'Starfish', 'Jaguar',
];

function generateName() {
  const adj = FUN_ADJECTIVES[Math.floor(Math.random() * FUN_ADJECTIVES.length)];
  const noun = FUN_NOUNS[Math.floor(Math.random() * FUN_NOUNS.length)];
  return `${adj} ${noun}`;
}

// ─── Peer Color Palette ──────────────────────────────────────────────────────
const PEER_COLORS = [
  { bg: '#7c3aed', light: '#a78bfa' },
  { bg: '#2563eb', light: '#60a5fa' },
  { bg: '#059669', light: '#34d399' },
  { bg: '#d97706', light: '#fbbf24' },
  { bg: '#dc2626', light: '#f87171' },
  { bg: '#7c3aed', light: '#c084fc' },
  { bg: '#0891b2', light: '#22d3ee' },
  { bg: '#be185d', light: '#f472b6' },
];

let _colorIdx = 0;
const _peerColorMap = {};

function getPeerColor(id) {
  if (!_peerColorMap[id]) {
    _peerColorMap[id] = PEER_COLORS[_colorIdx % PEER_COLORS.length];
    _colorIdx++;
  }
  return _peerColorMap[id];
}

function getInitials(name) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function renderAvatar(name, id, size = 36) {
  const color = getPeerColor(id);
  return `<div class="peer-avatar" style="width:${size}px;height:${size}px;background:${color.bg};" data-peer-id="${id}">
    <span style="position:relative;z-index:1;">${getInitials(name)}</span>
    <div class="peer-avatar-ring"></div>
  </div>`;
}

function renderMsgAvatar(name, id, size = 32) {
  const color = getPeerColor(id);
  return `<div class="msg-avatar" style="width:${size}px;height:${size}px;background:${color.bg};">${getInitials(name)}</div>`;
}

function updateAvatarPreview(inputEl, previewEl) {
  const name = inputEl.value.trim() || '?';
  const color = PEER_COLORS[0];
  previewEl.style.background = color.bg;
  previewEl.style.color = '#fff';
  previewEl.style.fontSize = '0.9rem';
  previewEl.style.fontWeight = '700';
  previewEl.textContent = getInitials(name || 'Me');
}

// ─── Toast System ────────────────────────────────────────────────────────────
const TOAST_ICONS = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
};

function showToast(title, message = '', type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${TOAST_ICONS[type] || 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${message ? `<div class="toast-msg">${escapeHtml(message)}</div>` : ''}
    </div>
  `;
  container.appendChild(toast);

  const remove = () => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  const timer = setTimeout(remove, duration);
  toast.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

// ─── HTML Escape ─────────────────────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

// ─── Formatters ──────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
    ppt: '📊', pptx: '📊', txt: '📃', md: '📃',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🎨',
    mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬',
    mp3: '🎵', wav: '🎵', flac: '🎵', aac: '🎵',
    zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦',
    js: '⚙️', ts: '⚙️', py: '🐍', go: '🐹', rs: '🦀',
    html: '🌐', css: '🎨', json: '📋',
  };
  return map[ext] || '📄';
}

// ─── Modal helpers ────────────────────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('visible');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('visible');
}

// Close on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('visible');
  }
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.visible').forEach(m => m.classList.remove('visible'));
  }
});
