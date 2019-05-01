/* eslint-disable no-unused-vars */

const WEBSOCKET_URL = window.location.protocol === 'http:' ? `ws://${window.location.host}`
  : `wss://${window.location.host}`;
const WEBSOCKET_OPTIONS = {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 3,
};
