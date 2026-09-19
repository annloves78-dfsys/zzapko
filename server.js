const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const { UNIT_TYPES } = require('./game/units');
const { Match } = require('./game/match');

const BASE_PATH = '/zzapko';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { path: `${BASE_PATH}/socket.io/` });

app.get('/', (req, res) => res.redirect(BASE_PATH + '/'));
app.use(BASE_PATH, express.static(path.join(__dirname, 'public')));

const matches = new Map();
let nextMatchId = 1;
let pvpQueue = null; // 대기 중인 socket (한 명)

function createMatch(mode) {
  const id = nextMatchId++;
  const match = new Match(id, mode, io);
  matches.set(id, match);
  return match;
}

function leaveMatch(socket) {
  const { matchId, side } = socket.data;
  if (!matchId) return;
  const match = matches.get(matchId);
  socket.data.matchId = null;
  socket.data.side = null;
  socket.leave(`match:${matchId}`);
  if (!match) return;

  if (match.mode === 'pvp' && !match.winner) {
    const otherSide = side === 'left' ? 'right' : 'left';
    match.winner = otherSide;
    io.to(match.room).emit('gameOver', { winner: otherSide, reason: 'opponentLeft' });
  }
  match.stop();
  matches.delete(match.id);
}

io.on('connection', (socket) => {
  socket.data.matchId = null;
  socket.data.side = null;
  socket.data.loadout = [];

  socket.emit('unitCatalog', UNIT_TYPES);

  socket.on('single:start', (payload) => {
    leaveMatch(socket);
    socket.data.loadout = (payload && payload.loadout) || [];
    const match = createMatch('single');
    socket.join(match.room);
    socket.data.matchId = match.id;
    socket.data.side = 'left';
    match.setLoadout('left', socket.data.loadout);
    match.start();
    socket.emit('matchStart', {
      mode: 'single',
      side: 'left',
      allUnits: UNIT_TYPES,
      myUnits: match.getAllowedList('left'),
    });
  });

  socket.on('pvp:queue', (payload) => {
    leaveMatch(socket);
    socket.data.loadout = (payload && payload.loadout) || [];

    if (pvpQueue && pvpQueue.connected) {
      const opponent = pvpQueue;
      pvpQueue = null;

      const match = createMatch('pvp');
      socket.join(match.room);
      opponent.join(match.room);
      socket.data.matchId = match.id;
      socket.data.side = 'right';
      opponent.data.matchId = match.id;
      opponent.data.side = 'left';
      match.setLoadout('left', opponent.data.loadout);
      match.setLoadout('right', socket.data.loadout);
      match.start();

      socket.emit('matchStart', {
        mode: 'pvp',
        side: 'right',
        allUnits: UNIT_TYPES,
        myUnits: match.getAllowedList('right'),
      });
      opponent.emit('matchStart', {
        mode: 'pvp',
        side: 'left',
        allUnits: UNIT_TYPES,
        myUnits: match.getAllowedList('left'),
      });
    } else {
      pvpQueue = socket;
      socket.emit('queueWaiting');
    }
  });

  socket.on('spawn', (unitTypeId) => {
    const { matchId, side } = socket.data;
    if (!matchId || !side) return;
    const match = matches.get(matchId);
    if (!match) return;
    match.spawnUnit(side, unitTypeId);
  });

  socket.on('leave', () => {
    leaveMatch(socket);
  });

  socket.on('disconnect', () => {
    if (pvpQueue === socket) pvpQueue = null;
    leaveMatch(socket);
  });
});

const PORT = process.env.PORT || 3300;
server.listen(PORT, () => {
  console.log(`zzapko server listening on port ${PORT}`);
});
