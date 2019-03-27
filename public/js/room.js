/* global M, SimplePeer */
const url = window.location.protocol === 'http:' ? `ws://${window.location.host}`
  : `wss://${window.location.host}`;
let socket;
let timerID;
let retryCount = 0;
const maxRetryCount = 1;

function socketSetup() {
  socket = new WebSocket(url);
  socket.addEventListener('open', socketOpen);
  socket.addEventListener('close', socketClose);
  socket.addEventListener('error', socketError);
  socket.addEventListener('message', socketMessage);
}
function socketTeardown() {
  socket.removeEventListener('open', socketOpen);
  socket.removeEventListener('close', socketClose);
  socket.removeEventListener('error', socketError);
  socket.removeEventListener('message', socketMessage);
  socket = null;
}
function socketOpen(event) {
  console.log('open', event);
  retryCount = 0;
  if (timerID) {
    clearTimeout(timerID);
  }
  socket.send('test from client');
}
function socketClose(event) {
  console.log('close', event);
  socketTeardown();
  timerID = setTimeout(() => {
    retryCount += 1;
    if (retryCount <= maxRetryCount) {
      socketSetup();
    }
  }, 2000);
}
function socketError(event) {
  console.log('error', event);
}
function socketMessage(event) {
  console.log('message', event);
}
function gotMedia(stream) {
  const peer = new SimplePeer({ initiator: true, stream });
  console.log(peer);
}
function onReady() {
  M.AutoInit();
  const roomId = window.location.href.split('/').slice(-1)[0];
  document.getElementById('room-id').textContent = roomId;

  socketSetup();
  navigator.mediaDevices.getUserMedia({ video: false, audio: true })
    .then(gotMedia)
    .catch(err => console.error(err.message, err.name));
}


document.addEventListener('DOMContentLoaded', onReady, false);
