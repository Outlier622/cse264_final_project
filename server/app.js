const express = require('express');
const cors = require('cors');
require('dotenv').config();
const supabase = require('./supabaseClient');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Server is running XD' });
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

    res.json(data);
  } catch (err) {
    console.error('Catch error:', err);
    res.status(500).json({ error: err.message || 'Failed to get rooms' });
  }
});

app.post('/rooms', async (req, res) => {
  try {
    const { name, host_user_id } = req.body;

    if (!name || !host_user_id) {
      return res.status(400).json({
        error: 'name and host_user_id are required'
      });
    }

    const { data, error } = await supabase
      .from('rooms')
      .insert([{ name, host_user_id }])
      .select();

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

app.get('/rooms/:id/songs', async (req, res) => {
    try {
        const roomId = req.params.id

        const { data, error } = await supabase
            .from('songs')
            .select('*')
            .eq('room_id', roomId)

        if (error) throw error

        res.json({
            message: 'Songs fetched successfully',
            data
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post('/songs', async (req, res) => {
    try {
        const { room_id, title, url } = req.body

        if (!room_id || !title || !url) {
            return res.status(400).json({ error: 'room_id, title, and url are required' })
        }

        const { data, error } = await supabase
            .from('songs')
            .insert([{ room_id, title, url }])
            .select()

        if (error) throw error

        res.json({
            message: 'Song added successfully',
            data
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.post('/vote', async (req, res) => {
    try {
        const { song_id, user_id, vote_value } = req.body

        if (!song_id || !user_id || vote_value === undefined) {
            return res.status(400).json({ error: 'song_id, user_id, and vote_value are required' })
        }

        if (vote_value !== 1 && vote_value !== -1) {
            return res.status(400).json({ error: 'vote_value must be 1 or -1' })
        }

        const { data, error } = await supabase
            .from('votes')
            .insert([{ song_id, user_id, vote_value }])
            .select()

        if (error) throw error

        res.json({
            message: 'Vote added successfully',
            data
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});