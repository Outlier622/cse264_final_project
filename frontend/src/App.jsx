import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001'

const socket = io(API_BASE, { autoConnect: true })

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [authError, setAuthError] = useState('')
  const [status, setStatus] = useState('')
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [rankedSongs, setRankedSongs] = useState([])
  const [roomSongsError, setRoomSongsError] = useState('')
  const [addSongForm, setAddSongForm] = useState({ title: '', url: '' })
  const [scoreInputs, setScoreInputs] = useState({})
  const [itunesSearchByRoom, setItunesSearchByRoom] = useState({})
  const [events, setEvents] = useState([])

  const [profile, setProfile] = useState({
    id: '',
    username: 'guest_user',
    role: 'free'
  })

  const [roomForm, setRoomForm] = useState({ name: '', description: '', mood_tag: '' })
  const [songForm, setSongForm] = useState({ room_id: '', title: '', url: '' })
  const [voteForm, setVoteForm] = useState({ song_id: '', user_id: '', vote_value: 1 })
  const [rankedRoomId, setRankedRoomId] = useState('')
  const selectedRoomSearch = selectedRoom
    ? itunesSearchByRoom[selectedRoom.id] || { query: '', songs: [] }
    : { query: '', songs: [] }

  const addEvent = (message) => {
    setEvents((prev) => [`${new Date().toLocaleTimeString()} - ${message}`, ...prev].slice(0, 12))
  }

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    try {
      if (!authForm.username.trim() || !authForm.password.trim()) {
        setAuthError('Username and password are required.')
        addEvent(`${authMode} failed: username and password required`)
        return
      }
      if (authMode === 'signup' && !authForm.email.trim()) {
        setAuthError('Email is required for sign up.')
        addEvent('signup failed: email required')
        return
      }
      if (authMode === 'signup' && authForm.password !== authForm.confirmPassword) {
        setAuthError('Passwords do not match.')
        addEvent('signup failed: passwords do not match')
        return
      }

      const endpoint = authMode === 'signup' ? '/auth/signup' : '/auth/login'
      const user = await request(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          username: authForm.username.trim(),
          email: authForm.email.trim(),
          password: authForm.password
        })
      })

      setProfile((p) => ({ ...p, id: user.id || '', username: user.username, role: user.role || 'free' }))
      setIsAuthenticated(true)
      setSelectedRoom(null)
      setRankedSongs([])
      setRoomSongsError('')
      setAuthError('')
      addEvent(`${authMode === 'signup' ? 'Signed up' : 'Logged in'} as ${user.username}`)
    } catch (err) {
      setAuthError(err.message || 'Authentication failed')
      addEvent(`${authMode} failed: ${err.message}`)
    }
  }

  const request = async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }

  const fetchRooms = async () => {
    try {
      const data = await request('/rooms')
      setRooms(data)
      if (data.length === 0) {
        setSelectedRoom(null)
        setRankedSongs([])
      }
    } catch (err) {
      addEvent(`Failed to fetch rooms: ${err.message}`)
    }
  }

  const handleSelectRoom = (room) => {
    setRoomSongsError('')
    setSelectedRoom(room)
    setRankedRoomId(String(room.id))
    setSongForm((f) => ({ ...f, room_id: String(room.id) }))
    fetchRankedSongs(room.id)
    socket.emit('join-room', String(room.id), profile.id || profile.username)
    addEvent(`Opened room #${room.id}: ${room.name}`)
  }

  const submitVoteForSong = async (songId, voteValue) => {
    try {
      await request('/vote', {
        method: 'POST',
        body: JSON.stringify({
          song_id: songId,
          user_id: profile.username,
          vote_value: voteValue
        })
      })
      addEvent(`${voteValue === 1 ? 'Upvoted' : 'Downvoted'} song #${songId}`)
      if (selectedRoom) fetchRankedSongs(selectedRoom.id)
    } catch (err) {
      addEvent(`Vote failed: ${err.message}`)
      alert(err.message)
    }
  }

  const submitSongToSelectedRoom = async (e) => {
    e.preventDefault()
    if (!selectedRoom) return

    try {
      await request('/songs', {
        method: 'POST',
        body: JSON.stringify({
          room_id: selectedRoom.id,
          title: addSongForm.title.trim(),
          url: addSongForm.url.trim()
        })
      })
      setAddSongForm({ title: '', url: '' })
      addEvent(`Added song "${addSongForm.title}" to room #${selectedRoom.id}`)
      fetchRankedSongs(selectedRoom.id)
    } catch (err) {
      addEvent(`Add song failed: ${err.message}`)
      alert(err.message)
    }
  }

  const addItunesSongToSelectedRoom = async (song) => {
    if (!selectedRoom) return

    try {
      await request('/songs', {
        method: 'POST',
        body: JSON.stringify({
          room_id: selectedRoom.id,
          title: `${song.title}${song.artist_name ? ` - ${song.artist_name}` : ''}`,
          url: song.url || song.itunes_url || song.preview_url
        })
      })
      addEvent(`Imported "${song.title}" from iTunes`)
      fetchRankedSongs(selectedRoom.id)
    } catch (err) {
      addEvent(`iTunes import failed: ${err.message}`)
      alert(err.message)
    }
  }

  const submitScoreForSong = async (songId) => {
    try {
      const scoreValue = Number(scoreInputs[songId] || 0)
      await request('/score', {
        method: 'POST',
        body: JSON.stringify({
          song_id: songId,
          user_id: profile.username,
          score_value: scoreValue
        })
      })
      addEvent(`Scored song #${songId} with ${scoreValue}`)
      if (selectedRoom) fetchRankedSongs(selectedRoom.id)
    } catch (err) {
      addEvent(`Score failed: ${err.message}`)
      alert(err.message)
    }
  }

  const deleteRoom = async (roomId) => {
    try {
      await request(`/rooms/${roomId}`, { method: 'DELETE' })
      addEvent(`Deleted room #${roomId}`)
      if (selectedRoom?.id === roomId) {
        setSelectedRoom(null)
        setRankedSongs([])
      }
      setItunesSearchByRoom((prev) => {
        const next = { ...prev }
        delete next[roomId]
        return next
      })
      fetchRooms()
    } catch (err) {
      addEvent(`Delete room failed: ${err.message}`)
      alert(err.message)
    }
  }

  const deleteSong = async (songId) => {
    try {
      await request(`/songs/${songId}`, {
        method: 'DELETE',
        body: JSON.stringify({ user_id: profile.id || profile.username })
      })
      addEvent(`Deleted song #${songId}`)
      if (selectedRoom) fetchRankedSongs(selectedRoom.id)
    } catch (err) {
      addEvent(`Delete song failed: ${err.message}`)
      alert(err.message)
    }
  }

  const fetchRankedSongs = async (roomId) => {
    if (!roomId) return
    try {
      const result = await request(`/rooms/${roomId}/ranked-songs`)
      setRankedSongs(result.data || [])
      setRoomSongsError('')
    } catch (err) {
      setRoomSongsError(err.message || 'Failed to load songs for this room')
      addEvent(`Failed to fetch ranked songs: ${err.message}`)
    }
  }

  useEffect(() => {
    fetchRooms()
    socket.on('connect', () => addEvent(`Socket connected: ${socket.id}`))
    socket.on('song-added', (song) => addEvent(`Song added in room ${song.room_id}: ${song.title}`))
    socket.on('vote-added', (vote) => addEvent(`Vote ${vote.vote_value} on song ${vote.song_id}`))

    return () => {
      socket.off('connect')
      socket.off('song-added')
      socket.off('vote-added')
    }
  }, [])

  const checkServer = async () => {
    try {
      const root = await request('/')
      const db = await request('/test-supabase')
      setStatus(`${root.message} | ${db.message}`)
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    }
  }

  const createRoom = async (e) => {
    e.preventDefault()
    try {
      await request('/rooms', {
        method: 'POST',
        body: JSON.stringify({
          ...roomForm,
          host_user_id: profile.id || profile.username
        })
      })
      setRoomForm({ name: '', description: '', mood_tag: '' })
      fetchRooms()
      addEvent(`Room created: ${roomForm.name}`)
    } catch (err) {
      addEvent(`Create room failed: ${err.message}`)
    }
  }

  const addSong = async (e) => {
    e.preventDefault()
    try {
      const payload = { ...songForm, room_id: Number(songForm.room_id) }
      await request('/songs', { method: 'POST', body: JSON.stringify(payload) })
      addEvent(`Song submitted: ${songForm.title}`)
      setSongForm({ room_id: '', title: '', url: '' })
    } catch (err) {
      addEvent(`Add song failed: ${err.message}`)
    }
  }

  const submitVote = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        song_id: Number(voteForm.song_id),
        user_id: voteForm.user_id,
        vote_value: Number(voteForm.vote_value)
      }
      await request('/vote', { method: 'POST', body: JSON.stringify(payload) })
      addEvent(`Vote sent by ${payload.user_id}`)
      setVoteForm({ song_id: '', user_id: '', vote_value: 1 })
    } catch (err) {
      addEvent(`Vote failed: ${err.message}`)
    }
  }

  const searchItunes = async (e) => {
    e.preventDefault()
    if (!selectedRoom) return

    try {
      const result = await request(`/itunes/search?q=${encodeURIComponent(selectedRoomSearch.query)}`)
      setItunesSearchByRoom((prev) => ({
        ...prev,
        [selectedRoom.id]: {
          query: selectedRoomSearch.query,
          songs: result.data || []
        }
      }))
      addEvent(`iTunes search returned ${(result.data || []).length} songs`)
    } catch (err) {
      addEvent(`Search failed: ${err.message}`)
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Music Like List</h1>
          <p className="muted">Testing auth screen</p>
          <form onSubmit={handleAuthSubmit}>
            <input
              placeholder="Username"
              value={authForm.username}
              onChange={(e) => {
                setAuthError('')
                setAuthForm((f) => ({ ...f, username: e.target.value }))
              }}
              required
            />
            {authMode === 'signup' && (
              <input
                type="email"
                placeholder="Email"
                value={authForm.email}
                onChange={(e) => {
                  setAuthError('')
                  setAuthForm((f) => ({ ...f, email: e.target.value }))
                }}
                required
              />
            )}
            <input
              type="password"
              placeholder="Password"
              value={authForm.password}
              onChange={(e) => {
                setAuthError('')
                setAuthForm((f) => ({ ...f, password: e.target.value }))
              }}
              required
            />
            {authMode === 'signup' && (
              <input
                type="password"
                placeholder="Confirm Password"
                value={authForm.confirmPassword}
                onChange={(e) => {
                  setAuthError('')
                  setAuthForm((f) => ({ ...f, confirmPassword: e.target.value }))
                }}
                required
              />
            )}
            <button type="submit">{authMode === 'signup' ? 'Create Account' : 'Log In'}</button>
            {authMode === 'login' ? (
              <button type="button" onClick={() => {
                setAuthError('')
                setAuthMode('signup')
              }}>
                Sign Up
              </button>
            ) : (
              <button type="button" onClick={() => {
                setAuthError('')
                setAuthMode('login')
              }}>
                Back to Login
              </button>
            )}
            {authError && <p className="auth-error">{authError}</p>}
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>Music Like List</h1>
          <p className="muted">Available rooms</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsAuthenticated(false)
            setAuthMode('login')
            setAuthForm({ username: '', email: '', password: '', confirmPassword: '' })
            setAuthError('')
          }}
        >
          Log out
        </button>
      </header>

      <section className="panel">
        {!selectedRoom ? (
          <>
            <h2>Rooms</h2>
            <p className="muted">Click a room to view details and songs.</p>
            <form onSubmit={createRoom}>
              <input
                placeholder="Room name"
                value={roomForm.name}
                onChange={(e) => setRoomForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
              <input
                placeholder="Description (optional)"
                value={roomForm.description || ''}
                onChange={(e) => setRoomForm((f) => ({ ...f, description: e.target.value }))}
              />
              <input
                placeholder="Mood tag (optional)"
                value={roomForm.mood_tag || ''}
                onChange={(e) => setRoomForm((f) => ({ ...f, mood_tag: e.target.value }))}
              />
              <button type="submit">Create Room</button>
            </form>
            <button onClick={fetchRooms}>Refresh Rooms</button>
            <ul>
              {rooms.length === 0 && <li>No rooms found.</li>}
              {rooms.map((room) => (
                <li key={room.id}>
                  <div className="inline">
                    <button
                      type="button"
                      className="room-item"
                      onClick={() => handleSelectRoom(room)}
                    >
                      #{room.id} - {room.name} (host: {' '}
                      <span className={room.host_role === 'premium' ? 'premium-name' : ''}>
                        {room.host_username || room.host_user_id}
                      </span>
                      )
                    </button>
                    <button type="button" onClick={() => deleteRoom(room.id)}>Delete Room</button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="inline">
              <button
                type="button"
                onClick={() => {
                  setSelectedRoom(null)
                  setRankedSongs([])
                }}
              >
                Back to Rooms
              </button>
              <button type="button" onClick={() => fetchRankedSongs(selectedRoom.id)}>
                Refresh Songs
              </button>
            </div>
            <h2>{selectedRoom.name}</h2>
            <p className="muted">Room #{selectedRoom.id} | Host: {selectedRoom.host_user_id}</p>

            <h3>Add Song to This Room</h3>
            <form onSubmit={submitSongToSelectedRoom}>
              <input
                placeholder="Song title"
                value={addSongForm.title}
                onChange={(e) => setAddSongForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
              <input
                placeholder="Song URL"
                value={addSongForm.url}
                onChange={(e) => setAddSongForm((f) => ({ ...f, url: e.target.value }))}
                required
              />
              <button type="submit">Add Song</button>
            </form>

            <h3>Search iTunes</h3>
            <form onSubmit={searchItunes}>
              <input
                placeholder="Search songs or artists"
                value={selectedRoomSearch.query}
                onChange={(e) => {
                  const query = e.target.value
                  setItunesSearchByRoom((prev) => ({
                    ...prev,
                    [selectedRoom.id]: {
                      query,
                      songs: prev[selectedRoom.id]?.songs || []
                    }
                  }))
                }}
                required
              />
              <button type="submit">Search iTunes</button>
            </form>
            <ul className="itunes-results">
              {selectedRoomSearch.songs.map((song) => (
                <li key={song.itunes_id || `${song.title}-${song.artist_name}`}>
                  <div className="song-result">
                    {song.image_url && (
                      <img src={song.image_url} alt={`${song.title} album art`} />
                    )}
                    <div>
                      <strong>{song.title}</strong>
                      <div className="muted">
                        {song.artist_name}
                        {song.album ? ` | ${song.album}` : ''}
                      </div>
                      {song.preview_url && (
                        <audio controls src={song.preview_url} />
                      )}
                    </div>
                    <button type="button" onClick={() => addItunesSongToSelectedRoom(song)}>
                      Add to Room
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <h3>Songs in this room</h3>
            {roomSongsError && <p className="auth-error">{roomSongsError}</p>}
            <ul>
              {rankedSongs.length === 0 && <li>No songs in this room yet.</li>}
              {rankedSongs.map((song) => (
                <li key={song.id}>
                  <div>
                    <strong>{song.title}</strong>
                    <div>
                      Vote score: {song.score} (upvotes: {song.upvotes}, downvotes: {song.downvotes})
                    </div>
                    <div>
                      User rating: {song.average_rating ?? 'N/A'} ({song.rating_count || 0} ratings)
                    </div>
                    <div className="inline">
                      <button type="button" onClick={() => submitVoteForSong(song.id, 1)}>Upvote</button>
                      <button type="button" onClick={() => submitVoteForSong(song.id, -1)}>Downvote</button>
                      <select
                        value={scoreInputs[song.id] ?? ''}
                        onChange={(e) => setScoreInputs((prev) => ({ ...prev, [song.id]: e.target.value }))}
                      >
                        <option value="">Rate 1-10</option>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => submitScoreForSong(song.id)}>Submit Score</button>
                      {profile.role === 'premium' && (
                        <button type="button" onClick={() => deleteSong(song.id)}>Delete Song</button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  )
}

export default App
