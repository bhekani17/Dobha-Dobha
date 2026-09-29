// Shared room logic for host.html and index.html (viewer).
// Pages provide #joinView, #roomView and the elements referenced below.
const { Room, RoomEvent, Track } = LivekitClient;
const $ = (id) => document.getElementById(id);
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let room;

async function joinLive({ room: roomName, identity, role }) {
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
    .on(RoomEvent.ParticipantConnected, updateCount)
    .on(RoomEvent.ParticipantDisconnected, updateCount)
    .on(RoomEvent.DataReceived, (payload, participant) => {
      let msg;
      try {
        msg = JSON.parse(decoder.decode(payload));
      } catch {
        return; // Ignore payloads that are not our chat format.
      }
      if (msg.type === 'chat') addMessage(participant?.name || 'someone', String(msg.text));
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

function showTrack(track) {
  const el = track.attach();
  if (track.kind === Track.Kind.Video) {
    $('waiting').classList.add('hidden');
    $('videos').querySelectorAll('video').forEach((v) => v.remove());
  }
  $('videos').appendChild(el);
}

// Browsers block autoplay with sound until the user taps something on the page.
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
  b.textContent = who + ' ';
  div.append(b, document.createTextNode(text));
  $('messages').appendChild(div);
  $('messages').scrollTop = $('messages').scrollHeight;
}

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

$('leaveBtn').addEventListener('click', () => room && room.disconnect());

function resetUi() {
  room = null;
  $('videos').querySelectorAll('video, audio, #soundBtn').forEach((el) => el.remove());
  $('waiting').classList.remove('hidden');
  $('messages').innerHTML = '';
  $('roomView').classList.add('hidden');
  $('joinView').classList.remove('hidden');
  document.dispatchEvent(new Event('live:left'));
}
