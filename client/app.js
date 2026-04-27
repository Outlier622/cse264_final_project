const API_BASE = 'http://localhost:3001';
const socket = io(API_BASE);

const statusOutput = document.getElementById('statusOutput');
const roomsList = document.getElementById('roomsList');
const rankedSongsList = document.getElementById('rankedSongsList');
const searchResults = document.getElementById('searchResults');
const socketEvents = document.getElementById('socketEvents');

function renderJson(target, data) {
  target.textContent = JSON.stringify(data, null, 2);
}

function addSocketEvent(text) {
  const li = document.createElement('li');
  li.textContent = text;
  socketEvents.prepend(li);
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

document.getElementById('checkServerBtn').addEventListener('click', async () => {
  try {
    renderJson(statusOutput, await api('/'));
  } catch (err) {
    statusOutput.textContent = err.message;
  }
});

document.getElementById('checkSupabaseBtn').addEventListener('click', async () => {
  try {
    renderJson(statusOutput, await api('/test-supabase'));
  } catch (err) {
    statusOutput.textContent = err.message;
  }
});

document.getElementById('loadRoomsBtn').addEventListener('click', loadRooms);

async function loadRooms() {
  try {
    const rooms = await api('/rooms');
    roomsList.innerHTML = '';
    rooms.forEach((room) => {
      const li = document.createElement('li');
      li.textContent = `#${room.id} - ${room.name} (host: ${room.host_user_id})`;
      roomsList.appendChild(li);
    });
  } catch (err) {
    roomsList.innerHTML = `<li>${err.message}</li>`;
  }
}

document.getElementById('createRoomForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('roomName').value.trim();
  const host_user_id = document.getElementById('hostUserId').value.trim();
  try {
    await api('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, host_user_id })
    });
    e.target.reset();
    loadRooms();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('addSongForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const room_id = Number(document.getElementById('songRoomId').value);
  const title = document.getElementById('songTitle').value.trim();
  const url = document.getElementById('songUrl').value.trim();
  try {
    await api('/songs', {
      method: 'POST',
      body: JSON.stringify({ room_id, title, url })
    });
    e.target.reset();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('voteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const song_id = Number(document.getElementById('voteSongId').value);
  const user_id = document.getElementById('voteUserId').value.trim();
  const vote_value = Number(document.getElementById('voteValue').value);
  try {
    await api('/vote', {
      method: 'POST',
      body: JSON.stringify({ song_id, user_id, vote_value })
    });
    e.target.reset();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('rankedSongsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const roomId = Number(document.getElementById('rankedRoomId').value);
  try {
    const result = await api(`/rooms/${roomId}/ranked-songs`);
    rankedSongsList.innerHTML = '';
    result.data.forEach((song) => {
      const li = document.createElement('li');
      li.textContent = `${song.title} | score=${song.score} (up=${song.upvotes}, down=${song.downvotes})`;
      rankedSongsList.appendChild(li);
    });
  } catch (err) {
    rankedSongsList.innerHTML = `<li>${err.message}</li>`;
  }
});

document.getElementById('searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = document.getElementById('searchQuery').value.trim();
  try {
    const result = await api(`/itunes/search?q=${encodeURIComponent(q)}`);
    searchResults.innerHTML = '';
    result.data.forEach((song) => {
      const li = document.createElement('li');
      li.textContent = `${song.title} - ${song.artist_name}`;
      searchResults.appendChild(li);
    });
  } catch (err) {
    searchResults.innerHTML = `<li>${err.message}</li>`;
  }
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
  socket.emit('join-room', '1');
  addSocketEvent('Joined room 1');
});

socket.on('connect', () => addSocketEvent(`Connected: ${socket.id}`));
socket.on('song-added', (song) => addSocketEvent(`song-added: ${song.title}`));
socket.on('vote-added', (vote) => addSocketEvent(`vote-added: ${vote.vote_value} on song ${vote.song_id}`));

loadRooms();
