// Shared room logic for host.html and index.html (viewer).
const { Room, RoomEvent, Track } = LivekitClient;
const $ = (id) => document.getElementById(id);
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let room;
let currentPinnedItem = null;
let currentRole = 'viewer';

async function joinLive({ room: roomName, identity, role }) {
  currentRole = role;
  const params = new URLSearchParams({ room: roomName, identity, role });
  const res = await fetch('/token?' + params);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not get token');

  room = new Room({ adaptiveStream: true, dynacast: true });

  room
    .on(RoomEvent.TrackSubscribed, (track) => showTrack(track))
    .on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((el) => el.remove());
      if (!$('videos').querySelector('video')) $('waiting').classList.remove('hidden');
    })
    .on(RoomEvent.LocalTrackPublished, (pub) => {
      if (pub.track.kind === Track.Kind.Video) showTrack(pub.track);
    })
    .on(RoomEvent.ParticipantConnected, () => {
      updateCount();
      // If host has an item pinned, broadcast to new participants
      if (currentRole === 'host' && currentPinnedItem) {
        broadcastData({ type: 'pin_item', item: currentPinnedItem });
      }
    })
    .on(RoomEvent.ParticipantDisconnected, updateCount)
    .on(RoomEvent.DataReceived, (payload, participant) => {
      let msg;
      try {
        msg = JSON.parse(decoder.decode(payload));
      } catch {
        return;
      }
      handleIncomingData(msg, participant);
    })
    .on(RoomEvent.AudioPlaybackStatusChanged, updateSoundButton)
    .on(RoomEvent.Disconnected, resetUi);

  await room.connect(data.url, data.token);

  if (role === 'host') {
    await room.localParticipant.enableCameraAndMicrophone();
  }

  updateSoundButton();
  $('roomName').textContent = room.name;
  $('joinView').classList.add('hidden');
  $('roomView').classList.remove('hidden');
  updateCount();
}

function handleIncomingData(msg, participant) {
  if (msg.type === 'chat') {
    addMessage(participant?.name || 'someone', String(msg.text));
  } else if (msg.type === 'reaction') {
    spawnReaction(msg.emoji || '❤️');
  } else if (msg.type === 'pin_item') {
    currentPinnedItem = msg.item;
    renderPinnedItem();
  } else if (msg.type === 'unpin_item') {
    currentPinnedItem = null;
    renderPinnedItem();
  } else if (msg.type === 'claim_item') {
    if (currentPinnedItem && currentPinnedItem.id === msg.itemId) {
      currentPinnedItem.status = 'sold';
      currentPinnedItem.claimedBy = msg.who;
      renderPinnedItem();
    }
    addSystemMessage(`🎉 ${msg.who} claimed ${msg.title || 'this item'}!`);
    spawnReaction('🎉');
    spawnReaction('🔥');
  }
}

function broadcastData(payload) {
  if (!room || !room.localParticipant) return;
  try {
    room.localParticipant.publishData(encoder.encode(JSON.stringify(payload)), { reliable: true });
  } catch (err) {
    console.warn('Failed to publish data:', err);
  }
}

function showTrack(track) {
  const el = track.attach();
  if (track.kind === Track.Kind.Video) {
    $('waiting').classList.add('hidden');
    $('videos').querySelectorAll('video').forEach((v) => v.remove());
  }
  $('videos').appendChild(el);
}

function updateSoundButton() {
  let btn = $('soundBtn');
  if (!room || room.canPlaybackAudio) {
    if (btn) btn.remove();
    return;
  }
  if (btn) return;
  btn = document.createElement('button');
  btn.id = 'soundBtn';
  btn.textContent = 'Tap for sound';
  btn.onclick = () => room.startAudio();
  $('videos').appendChild(btn);
}

function updateCount() {
  if (!room) return;
  const n = room.remoteParticipants.size + 1;
  $('viewerCount').textContent = n + (n === 1 ? ' person' : ' people');
}

function addMessage(who, text) {
  const div = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = who + ': ';
  div.append(b, document.createTextNode(text));
  $('messages').appendChild(div);
  $('messages').scrollTop = $('messages').scrollHeight;
}

function addSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'sys-msg';
  div.textContent = text;
  $('messages').appendChild(div);
  $('messages').scrollTop = $('messages').scrollHeight;
}

function spawnReaction(emoji = '❤️') {
  const container = $('reactionsOverlay');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'floating-particle';
  el.textContent = emoji;
  el.style.right = (10 + Math.random() * 40) + 'px';
  container.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function renderPinnedItem() {
  const banner = $('pinnedBanner');
  if (!banner) return;
  if (!currentPinnedItem) {
    banner.classList.add('hidden');
    return;
  }
  banner.classList.remove('hidden');
  const isSold = currentPinnedItem.status === 'sold';
  if (isSold) {
    banner.classList.add('sold');
  } else {
    banner.classList.remove('sold');
  }

  $('productTitle').textContent = currentPinnedItem.title;
  $('productSize').textContent = currentPinnedItem.size;
  $('productPrice').textContent = currentPinnedItem.price.startsWith('R') ? currentPinnedItem.price : 'R ' + currentPinnedItem.price;

  const soldTag = $('soldTag');
  if (soldTag) {
    soldTag.textContent = isSold ? `(Sold to ${currentPinnedItem.claimedBy || 'buyer'} 🎉)` : '';
  }

  const claimBtn = $('claimBtn');
  if (claimBtn) {
    if (currentRole === 'host') {
      claimBtn.textContent = isSold ? 'Sold' : 'Mark Sold';
      claimBtn.disabled = isSold;
      claimBtn.onclick = () => {
        currentPinnedItem.status = 'sold';
        renderPinnedItem();
        broadcastData({ type: 'pin_item', item: currentPinnedItem });
      };
    } else {
      claimBtn.textContent = isSold ? 'SOLD' : 'DOBHA';
      claimBtn.disabled = isSold;
      claimBtn.onclick = () => claimPinnedItem();
    }
  }
}

function claimPinnedItem() {
  if (!currentPinnedItem || currentPinnedItem.status === 'sold' || !room) return;
  const identity = room.localParticipant.name;
  currentPinnedItem.status = 'sold';
  currentPinnedItem.claimedBy = identity;
  renderPinnedItem();

  broadcastData({
    type: 'claim_item',
    itemId: currentPinnedItem.id,
    who: identity,
    title: currentPinnedItem.title,
  });
  addSystemMessage(`🎉 You claimed ${currentPinnedItem.title}!`);
  spawnReaction('🎉');
  spawnReaction('🔥');
}

function sendReaction(emoji = '❤️') {
  spawnReaction(emoji);
  broadcastData({ type: 'reaction', emoji });
}

// Chat submission
$('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('chatInput').value.trim();
  if (!text || !room) return;
  try {
    await room.localParticipant.publishData(
      encoder.encode(JSON.stringify({ type: 'chat', text })),
      { reliable: true }
    );
  } catch {
    addMessage('', 'Message not sent, check your connection');
    return;
  }
  addMessage(room.localParticipant.name, text);
  $('chatInput').value = '';
});

const heartBtn = $('heartBtn');
if (heartBtn) {
  heartBtn.addEventListener('click', () => sendReaction('❤️'));
}

$('leaveBtn').addEventListener('click', () => room && room.disconnect());

function resetUi() {
  room = null;
  currentPinnedItem = null;
  $('videos').querySelectorAll('video, audio, #soundBtn').forEach((el) => el.remove());
  $('waiting').classList.remove('hidden');
  $('messages').innerHTML = '';
  $('roomView').classList.add('hidden');
  $('joinView').classList.remove('hidden');
  renderPinnedItem();
  document.dispatchEvent(new Event('live:left'));
}
