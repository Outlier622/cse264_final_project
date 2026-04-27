# Music Like List

Music Like List is a shared music room application where users can create rooms, add songs, vote on songs, rate songs, and see playlist updates in real time.

## Team Members

| Name | Role |
| --- | --- |
| Zichen Zhang | Frontend |
| Yingran Zhang | Backend |
| Yang Xu | Project Manager |

## Features

- User authentication with signup and login
- Room creation and room browsing
- Shared room playlists stored in Supabase
- Song search through the iTunes Search API
- Add individual iTunes search results to a selected room
- Manual song submission with title and URL
- Upvote and downvote songs
- Rate songs from 1 to 10
- Ranked playlist view based on vote score
- Delete rooms and songs
- Real-time song and vote events with Socket.IO
- Admin and premium user concepts for moderation and visual features

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React, Vite, Socket.IO Client |
| Backend | Node.js, Express, Socket.IO |
| Database | PostgreSQL through Supabase |
| External Music Search | iTunes Search API |
| Authentication Storage | Supabase users table with bcrypt password hashing |

## Project Structure

```text
cse264_final_project/
|-- client/          # Simple HTML/JS testing client
|-- frontend/        # React + Vite frontend
|-- server/          # Express + Socket.IO backend
|-- test-socket.html # Socket.IO test page
`-- README.md
```

## Getting Started

### 1. Install Dependencies

Install server dependencies:

```bash
cd server
npm install
```

Install frontend dependencies:

```bash
cd ../frontend
npm install
```

### 2. Configure Environment Variables

Create `server/.env` with your Supabase credentials:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3001
```

### 3. Run the Backend

```bash
cd server
npm run dev
```

The backend runs at:

```text
http://localhost:3001
```

### 4. Run the Frontend

Open a second terminal:

```bash
cd frontend
npm run dev
```

The Vite frontend usually runs at:

```text
http://localhost:5173
```

## Main API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Check whether the server is running |
| `POST` | `/auth/signup` | Create a new user |
| `POST` | `/auth/login` | Log in an existing user |
| `GET` | `/rooms` | Get all rooms |
| `POST` | `/rooms` | Create a new room |
| `DELETE` | `/rooms/:roomId` | Delete a room |
| `GET` | `/itunes/search?q=query` | Search songs from iTunes |
| `POST` | `/songs` | Add one song to a room |
| `POST` | `/rooms/:roomId/songs/bulk` | Import multiple songs to a room |
| `GET` | `/rooms/:id/ranked-songs` | Get songs in a room sorted by vote score |
| `POST` | `/vote` | Upvote or downvote a song |
| `POST` | `/score` | Rate a song from 1 to 10 |
| `DELETE` | `/songs/:songId` | Delete a song |

## User Stories

- As a host, I want to create a room so users can join a shared music session.
- As a member, I want to join a room so I can add songs and vote with others.
- As a member, I want to search for songs and add selected results to a room playlist.
- As a member, I want to upvote and downvote songs so the playlist reflects group preference.
- As a user, I want the playlist to be ordered by votes so the most popular songs appear first.
- As a member, I want to rate songs so the room can track user opinions beyond simple votes.
- As a user, I want updates to appear in real time so collaboration feels immediate.
- As a host, I want to manage room activity so the session stays organized.
- As an admin, I want to manage users, rooms, and songs so the platform remains safe and functional.

## Notes

- The original proposal mentioned Spotify integration, but the current implementation uses the iTunes Search API because it works without OAuth credentials.
- The backend includes a helper for the `song_scores` table. If automatic table creation is unavailable in Supabase, create the table manually in the Supabase SQL editor.
