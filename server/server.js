require('dotenv').config();
const express = require('express');
const path = require('path');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

const {
  LIVEKIT_URL = 'ws://localhost:7880',
  LIVEKIT_API_KEY = 'devkey',
  LIVEKIT_API_SECRET = 'secret',
  PORT = 3000,
} = process.env;

const roomService = new RoomServiceClient(
  LIVEKIT_URL.replace(/^ws/, 'http'),
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET
);

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// GET /rooms -> rooms that are currently live, for the viewer page
app.get('/rooms', async (req, res) => {
  try {
    const rooms = await roomService.listRooms();
    res.json(
      rooms
        .filter((r) => r.numPublishers > 0)
        .map((r) => ({ name: r.name, viewers: Math.max(r.numParticipants - r.numPublishers, 0) }))
    );
  } catch (err) {
    res.status(502).json({ error: 'LiveKit server unreachable' });
  }
});

// GET /token?room=bale-1&identity=thabo&role=host|viewer
// Hosts can publish camera/mic; viewers can only watch and send chat (data).
app.get('/token', async (req, res) => {
  const room = String(req.query.room || '').trim();
  const identity = String(req.query.identity || '').trim();
  const role = req.query.role === 'host' ? 'host' : 'viewer';

  if (!room || !identity) {
    return res.status(400).json({ error: 'room and identity are required' });
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    ttl: '2h',
    metadata: JSON.stringify({ role }),
  });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: role === 'host',
    canSubscribe: true,
    canPublishData: true,
  });

  // A local LiveKit URL is useless to a phone ("localhost" is the phone itself),
  // so point it at whatever host the client used to reach this server.
  const url = LIVEKIT_URL.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, `//${req.hostname}`);

  res.json({ url, token: await at.toJwt(), role });
});

app.listen(PORT, () => {
  console.log(`Dobha server on http://localhost:${PORT} (LiveKit: ${LIVEKIT_URL})`);
});
