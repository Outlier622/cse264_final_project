const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
require('dotenv').config();
const supabase = require('./supabaseClient');
const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use('/app', express.static(path.join(__dirname, '..', 'client')));

async function getUser(userId) {
  if (!userId) return null;

  const cleanUserId = String(userId).trim();
  if (!cleanUserId) return null;

  const { data: userById, error: idError } = await supabase
    .from('users')
    .select('*')
    .eq('id', cleanUserId)
    .maybeSingle();

  if (idError) {
    console.error('Get user by id error:', idError);
  }

  if (userById) return userById;

  const { data: userByUsername, error: usernameError } = await supabase
    .from('users')
    .select('*')
    .eq('username', cleanUserId)
    .maybeSingle();

  if (usernameError) {
    console.error('Get user by username error:', usernameError);
    return null;
  }

  return userByUsername;
}

function canDownvote(user) {
  return ['admin', 'premium'].includes(String(user?.role || '').toLowerCase());
}

function canDeleteSong(user) {
  return String(user?.role || '').toLowerCase() === 'premium';
}

async function ensureExtraTables() {
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS song_scores (
          id BIGSERIAL PRIMARY KEY,
          song_id BIGINT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          score_value INTEGER NOT NULL CHECK (score_value >= 1 AND score_value <= 10),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(song_id, user_id)
        );
      `
    });

    if (error) {
      // If rpc exec_sql is unavailable, table creation can be done manually in Supabase SQL editor.
      console.warn('Skipping auto table creation:', error.message);
    }
  } catch (err) {
    // Keep server running if this helper is unsupported.
    console.warn('Skipping auto table creation:', err.message);
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', async (roomId, userId) => {
    socket.join(String(roomId));
    console.log(`Socket joined room ${roomId}`);

    if (!userId) {
      console.log('No userId provided yet, skipping user role broadcast');
      return;
    }

    const user = await getUser(userId);

    if (!user) {
      console.log(`User ${userId} not found`);
      return;
    }

    io.to(String(roomId)).emit('user-joined', {
      id: user.id,
      username: user.username,
      role: user.role || 'free'
    });

    console.log(`User ${userId} joined room ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'Server is running XD' });
});

app.post('/auth/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email and password are required' });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    if (!cleanUsername || !cleanEmail) {
      return res.status(400).json({ error: 'username and email cannot be empty' });
    }

    const { data: existingUsernameUser, error: existingUsernameError } = await supabase
      .from('users')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existingUsernameError) throw existingUsernameError;
    if (existingUsernameUser) {
      return res.status(409).json({ error: 'username already exists' });
    }

    const { data: existingEmailUser, error: existingEmailError } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingEmailError) throw existingEmailError;
    if (existingEmailUser) {
      return res.status(409).json({ error: 'email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userPayload = {
      id: crypto.randomUUID(),
      username: cleanUsername,
      email: cleanEmail,
      role: 'free',
      password_hash
    };

    const { data, error } = await supabase
      .from('users')
      .insert([userPayload])
      .select('id, username, email, role')
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: err.message || 'Signup failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const cleanUsername = String(username).trim();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, role, password_hash')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (error) throw error;
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.json({
      id: user.id,
      username: user.username,
      role: user.role || 'free'
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'Login failed' });
  }
});

app.get('/users/:id', async (req, res) => {
  try {
    const user = await getUser(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'free'
    });
  } catch (err) {
    console.error('Get user route error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get user' });
  }
});

app.get('/test-supabase', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*');

    if (error) {
      console.error('Supabase query error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      message: 'Supabase connected successfully',
      data: data
    });
  } catch (err) {
    console.error('Catch error:', err);
    res.status(500).json({
      error: err.message || 'Connection failed'
    });
  }
});

app.get('/add-room', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .insert([
        {
          name: 'My First Room',
          host_user_id: 'user123'
        }
      ])
      .select();

    if (error) {
      console.error('Insert error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      message: 'Room added successfully',
      data: data
    });
  } catch (err) {
    console.error('Catch error:', err);
    res.status(500).json({
      error: err.message || 'Insert failed'
    });
  }
});

app.get('/rooms', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Get rooms error:', error);
      return res.status(500).json({ error: error.message });
    }

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username, role');

    if (usersError) {
      console.error('Get users for room owners error:', usersError);
    }

    const normalizedUsers = users || [];
    const roomsWithHostName = (data || []).map((room) => {
      const owner = normalizedUsers.find(
        (u) => String(u.id) === String(room.host_user_id) || String(u.username) === String(room.host_user_id)
      );

      return {
        ...room,
        host_username: owner?.username || String(room.host_user_id),
        host_role: owner?.role || null
      };
    });

    res.json(roomsWithHostName);
  } catch (err) {
    console.error('Catch error:', err);
    res.status(500).json({ error: err.message || 'Failed to get rooms' });
  }
});

app.post('/rooms', async (req, res) => {
  try {
    const { name, host_user_id, description, mood_tag } = req.body;

    if (!name || !host_user_id) {
      return res.status(400).json({
        error: 'name and host_user_id are required'
      });
    }

    const basePayload = { name, host_user_id };
    const extendedPayload = {
      ...basePayload,
      ...(description ? { description } : {}),
      ...(mood_tag ? { mood_tag } : {})
    };

    let data;
    let error;

    ({ data, error } = await supabase
      .from('rooms')
      .insert([extendedPayload])
      .select());

    // Fallback if optional columns do not exist yet in DB schema.
    if (error && String(error.message || '').toLowerCase().includes('column')) {
      ({ data, error } = await supabase
        .from('rooms')
        .insert([basePayload])
        .select());
    }

    if (error) {
      console.error('Create room error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data[0]);
  } catch (err) {
    console.error('Catch error:', err);
    res.status(500).json({ error: err.message || 'Failed to create room' });
  }
});

// Search songs from Apple iTunes Search API.
app.get('/itunes/search', async (req, res) => {
  try {
    const { q } = req.query;
    const country = String(req.query.country || 'US').toUpperCase();
    const rawLimit = Number(req.query.limit) || 10;
    const limit = Math.min(Math.max(rawLimit, 1), 25);

    if (!q || !String(q).trim()) {
      return res.status(400).json({
        error: 'q is required'
      });
    }

    const params = new URLSearchParams({
      term: String(q).trim(),
      country,
      media: 'music',
      entity: 'song',
      limit: String(limit)
    });

    const response = await fetch(
      'https://itunes.apple.com/search?' + params.toString()
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('iTunes search error: ' + errorText);
    }

    const result = await response.json();

    const songs = (result.results || []).map((track) => ({
      source: 'itunes',
      itunes_id: track.trackId,
      title: track.trackName,
      artist_name: track.artistName,
      artist_text: track.artistName,
      album: track.collectionName,
      genre: track.primaryGenreName,
      image_url: track.artworkUrl100
        ? track.artworkUrl100.replace('100x100bb', '600x600bb')
        : null,
      preview_url: track.previewUrl || null,
      itunes_url: track.trackViewUrl,
      url: track.trackViewUrl,
      release_date: track.releaseDate,
      duration_ms: track.trackTimeMillis
    }));

    res.json({
      message: 'iTunes songs fetched successfully',
      data: songs
    });
  } catch (err) {
    console.error('iTunes search error:', err);
    res.status(500).json({
      error: err.message || 'Failed to search iTunes songs'
    });
  }
});

app.get('/rooms/:id/ranked-songs', async (req, res) => {
  try {
    const roomId = req.params.id;

    const { data: songs, error: songsError } = await supabase
      .from('songs')
      .select('*')
      .eq('room_id', roomId);

    if (songsError) throw songsError;

    if (!songs || songs.length === 0) {
      return res.json({
        message: 'Ranked songs fetched successfully',
        data: []
      });
    }

    const songIds = songs.map((song) => song.id);

    const { data: votes, error: votesError } = await supabase
      .from('votes')
      .select('*')
      .in('song_id', songIds);

    if (votesError) throw votesError;

    const { data: scores, error: scoresError } = await supabase
      .from('song_scores')
      .select('*')
      .in('song_id', songIds);

    const missingScoresTable =
      scoresError &&
      (
        scoresError.code === '42P01' ||
        String(scoresError.message || '').toLowerCase().includes('could not find the table') ||
        String(scoresError.message || '').toLowerCase().includes('song_scores')
      );

    if (scoresError && !missingScoresTable) throw scoresError;

    const voteMap = {};

    for (const song of songs) {
      voteMap[song.id] = {
        upvotes: 0,
        downvotes: 0,
        score: 0,
        ratingTotal: 0,
        ratingCount: 0
      };
    }

    for (const vote of votes || []) {
      if (!voteMap[vote.song_id]) continue;

      if (vote.vote_value === 1) {
        voteMap[vote.song_id].upvotes += 1;
      }

      if (vote.vote_value === -1) {
        voteMap[vote.song_id].downvotes += 1;
      }

      voteMap[vote.song_id].score += vote.vote_value;
    }

    for (const rating of scores || []) {
      if (!voteMap[rating.song_id]) continue;
      voteMap[rating.song_id].ratingTotal += Number(rating.score_value);
      voteMap[rating.song_id].ratingCount += 1;
    }

    const rankedSongs = songs
      .map((song) => ({
        ...song,
        upvotes: voteMap[song.id].upvotes,
        downvotes: voteMap[song.id].downvotes,
        score: voteMap[song.id].score,
        average_rating: voteMap[song.id].ratingCount
          ? Number((voteMap[song.id].ratingTotal / voteMap[song.id].ratingCount).toFixed(2))
          : null,
        rating_count: voteMap[song.id].ratingCount
      }))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return a.id - b.id;
      });

    res.json({
      message: 'Ranked songs fetched successfully',
      data: rankedSongs
    });
  } catch (err) {
    console.error('Get ranked songs error:', err);
    res.status(500).json({
      error: err.message || 'Failed to get ranked songs'
    });
  }
});

app.post('/songs', async (req, res) => {
  try {
    const { room_id, title, url } = req.body;

    if (!room_id || !title || !url) {
      return res.status(400).json({
        error: 'room_id, title, and url are required'
      });
    }

    const { data, error } = await supabase
      .from('songs')
      .insert([{ room_id, title, url }])
      .select();

    if (error) throw error;

    io.to(String(room_id)).emit('song-added', data[0]);

    res.json({
      message: 'Song added successfully',
      data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/rooms/:roomId/songs/bulk', async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    const { songs } = req.body;

    if (!roomId || !Array.isArray(songs) || songs.length === 0) {
      return res.status(400).json({
        error: 'roomId and a non-empty songs array are required'
      });
    }

    const rows = songs
      .map((song) => ({
        room_id: roomId,
        title: String(song.title || '').trim(),
        url: String(song.url || '').trim()
      }))
      .filter((song) => song.title && song.url);

    if (rows.length === 0) {
      return res.status(400).json({
        error: 'Each imported song needs a title and url'
      });
    }

    const { data, error } = await supabase
      .from('songs')
      .insert(rows)
      .select();

    if (error) throw error;

    for (const song of data || []) {
      io.to(String(roomId)).emit('song-added', song);
    }

    res.status(201).json({
      message: 'Songs imported successfully',
      data
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to import songs' });
  }
});

app.delete('/songs/:songId', async (req, res) => {
  try {
    const { songId } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const user = await getUser(user_id);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!canDeleteSong(user)) {
      return res.status(403).json({
        error: 'Only premium users can delete songs'
      });
    }

    // Delete votes and scores first to satisfy foreign key constraints
    await supabase.from('votes').delete().eq('song_id', songId);
    await supabase.from('song_scores').delete().eq('song_id', songId);

    const { error } = await supabase
      .from('songs')
      .delete()
      .eq('id', songId);

    if (error) throw error;
    return res.json({ message: 'Song deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to delete song' });
  }
});

app.post('/vote', async (req, res) => {
  try {
    const { song_id, user_id, vote_value } = req.body;

    if (!song_id || !user_id || vote_value === undefined) {
      return res.status(400).json({
        error: 'song_id, user_id, and vote_value are required'
      });
    }

    if (vote_value !== 1 && vote_value !== -1) {
      return res.status(400).json({
        error: 'vote_value must be 1 or -1'
      });
    }

    const user = await getUser(user_id);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (vote_value === -1 && !canDownvote(user)) {
      return res.status(403).json({
        error: 'Only premium users can downvote songs'
      });
    }

    const { data: existingVote, error: existingVoteError } = await supabase
      .from('votes')
      .select('id')
      .eq('song_id', song_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (existingVoteError) throw existingVoteError;
    if (existingVote) {
      return res.status(409).json({
        error: 'You already voted on this song'
      });
    }

    const { data, error } = await supabase
      .from('votes')
      .insert([{ song_id, user_id, vote_value }])
      .select();

    if (error) throw error;

    io.emit('vote-added', data[0]);

    res.json({
      message: 'Vote added successfully',
      data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId);

    if (error) throw error;
    return res.json({ message: 'Room deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to delete room' });
  }
});

app.post('/score', async (req, res) => {
  try {
    const { song_id, user_id, score_value } = req.body;

    if (!song_id || !user_id || score_value === undefined) {
      return res.status(400).json({
        error: 'song_id, user_id, and score_value are required'
      });
    }

    const scoreNum = Number(score_value);
    if (!Number.isInteger(scoreNum) || scoreNum < 1 || scoreNum > 10) {
      return res.status(400).json({
        error: 'score_value must be an integer from 1 to 10'
      });
    }

    const { data: existingScore, error: existingScoreError } = await supabase
      .from('song_scores')
      .select('id')
      .eq('song_id', song_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (existingScoreError && existingScoreError.code !== '42P01') throw existingScoreError;
    if (existingScore) {
      return res.status(409).json({
        error: 'You already scored this song'
      });
    }

    const { data, error } = await supabase
      .from('song_scores')
      .insert([{ song_id, user_id, score_value: scoreNum }])
      .select();

    if (error) throw error;

    res.json({
      message: 'Score added successfully',
      data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

ensureExtraTables();
