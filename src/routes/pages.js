const Helper = require(`${process.cwd()}/src/lib/helper`);
const WebSocketConnection = require(`${process.cwd()}/src/web-socket-connection`);

const Pages = {
  index(_req, res, _next) {
    res.render('index', { title: 'PeerBox' });
  },
  room(req, res, _next) {
    const { id } = req.params;
    const room = WebSocketConnection.rooms[id];
    if (!id || !room) { throw Helper.createError('Room not found', 404); }

    res.render('index', { title: `PeerBox - Room ${id}` });
  },
};

module.exports = Pages;
