# 🎵 PulseCast • Self-Hosted Spotify-Style Audio & Game Streamer

> **An ultra-premium, ad-free audio streaming platform and live in-game broadcast radio server with Spotify & YouTube import, comprehensive playlist management, and JukeHost-compatible MP3 streams for game engines.**

---

## 🌟 Key Features

### 1. 🎧 Spotify-Themed Luxury Web Interface
- **Dark Glassmorphism Aesthetic**: Frosted acrylic panels (`backdrop-filter: blur(24px)`), ambient glowing mesh gradients, and smooth micro-interactions.
- **Full Playback Controls**: Play, Pause, Seek bar with preview tooltip, Volume/Mute, Next/Previous, Shuffle, Repeat (Off / All / One), and Up Next Queue.
- **Interactive Multi-Mode Visualizer**: Real-time Web Audio API FFT visualizer in the sidebar with 3 toggleable modes:
  - 📊 **Cyber EQ Bars**: 32-band spectrum with peak drop caps.
  - 🌊 **Neon Glow Waveform**: Oscilloscope sine wave with green glow bloom.
  - 🔘 **Radial Pulse**: Circular frequency mandala.
- **Keyboard Shortcuts**: `Space` (Play/Pause), `Shift+N` (Next), `Shift+P` (Previous).

---

### 2. 🎮 Game-Ready Audio Streaming (JukeHost Compatible)
Engineered specifically for game audio engines (**Roblox, FiveM `xsound`, GTA SAMP, Garry's Mod `sound.PlayURL`, Unity, and Unreal Engine**):
- **Standard MP3 Output**: Real-time 192kbps `Content-Type: audio/mpeg` encoding powered by `ffmpeg-static`.
- **Game URL Format**: Direct `.mp3` endpoints (`http://<ip>:3000/stream/<trackId>.mp3` or `http://<ip>:3000/<trackId>.mp3`).
- **HTTP HEAD & Range Support**: Full `200 OK` response on `HEAD` requests and `206 Partial Content` with `Accept-Ranges: bytes` for in-game seeking.
- **Wildcard CORS**: `Access-Control-Allow-Origin: *` to prevent client-side game engine security blocks.

---

### 3. 📻 Live In-Game Broadcast Radio (DJ Mode)
A continuous, live 24/7 radio station on a **single permanent stream link**:
- **Permanent Game URL**: Put `http://<ip>:3000/live.mp3` (or `http://localhost:3000/live.mp3`) into your game radio or car stereo once.
- **Real-Time DJ Synchronization**: Whenever you click, select, skip, or change a song on the web app, **the in-game radio immediately switches and broadcasts that song to all players in real time**!
- **Continuous Auto-DJ**: When a track finishes, the broadcast seamlessly advances to the next song in your queue without disconnecting in-game listeners.

---

### 4. 📥 Multi-Source Audio Importer
- **📁 Local File Uploads**: Drag-and-drop MP3, WAV, M4A, AAC, FLAC, OGG files (up to 150MB). Automatically parses ID3 metadata, artist tags, and embedded album artwork.
- **▶️ YouTube Videos & Playlists**: Paste any video or playlist link for instant streaming and local caching via `yt-dlp`.
- **💚 Spotify Playlists, Albums & Tracks**: Paste any public Spotify playlist URL (e.g. `https://open.spotify.com/playlist/...`). Automatically extracts all tracks, creates a dedicated playlist, and matches lossless YouTube audio streams with **zero API keys or logins required**!

---

### 5. 📂 Complete Playlist Management
- **Create & Edit Playlists**: Set custom playlist names, descriptions, and cover images.
- **Add & Remove Songs**: 1-click "Add to Playlist" modal from any track row, player bar, or queue. Remove songs from specific playlists while keeping the original file in your library.
- **Delete Custom Playlists**: Clean 1-click removal with confirmation protection.
- **❤️ Liked Songs (Favorites)**: 1-click heart button on track rows and player bar instantly syncs songs into your "Liked Songs" auto-playlist.

---

### 6. 🌐 Shareable Web Players & Public Hosting
- **Standalone Auto-Playing Web Player**: `http://<host>/listen/:trackId` (opens in browser and starts playing immediately with glowing visualizer).
- **Embeddable Mini Widget**: `http://<host>/embed/:trackId` (iframe widget with play/pause controls).
- **Public Domain & Tunnel Support**: Share Modal includes a custom host input (e.g. Cloudflare Tunnel, Ngrok, or VPS IP) that instantly formats all share links and QR codes.
- **LAN Multi-Device Streaming**: Automatically detects and provides your network IP (`http://192.168.x.x:3000`) for phones, consoles, and external game clients.

---

### 7. 🚀 100% Unlimited & Ad-Free
- **Zero Commercials**: No YouTube video ads, no Spotify audio commercials, and no banners.
- **No Time Limits**: Continuous 24/7 playback without auto-pauses or "are you still listening?" interruptions.
- **Self-Hosted & Private**: Runs completely on your own machine.

---

## 🛠️ Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Python 3.10+](https://www.python.org/) with `yt-dlp` installed:
  ```bash
  pip install -U yt-dlp
  ```

### Installation
1. Clone or navigate to the project directory:
   ```bash
   cd radio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   # or
   node server/server.js
   ```

4. Open your browser:
   - **Web App**: [http://localhost:3000](http://localhost:3000)

---

## 📡 API & Stream Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/live.mp3` (or `/radio.mp3`) | `GET` / `HEAD` | **Permanent Live DJ Broadcast Stream** (syncs with web player in real time). |
| `/stream/:trackId.mp3` | `GET` / `HEAD` | Direct MP3 stream for a single track (JukeHost compatible). |
| `/:trackId.mp3` | `GET` / `HEAD` | Root-level direct MP3 stream alias. |
| `/listen/:trackId` | `GET` | Standalone browser player that auto-plays the track. |
| `/embed/:trackId` | `GET` | Embeddable iframe mini-player widget. |
| `/api/tracks` | `GET` | List all library tracks with favorite status. |
| `/api/tracks/upload` | `POST` | Upload local audio files (multipart/form-data). |
| `/api/tracks/youtube` | `POST` | Import YouTube video or playlist URL. |
| `/api/tracks/spotify` | `POST` | Import Spotify playlist/album/track URL. |
| `/api/playlists` | `GET` / `POST` | Get all playlists or create a new playlist. |
| `/api/playlists/:id` | `PUT` / `DELETE` | Update playlist details or delete playlist. |
| `/api/playlists/:id/tracks` | `POST` | Add a track to a playlist. |
| `/api/playlists/:id/tracks/:trackId` | `DELETE` | Remove a track from a playlist. |
| `/api/tracks/:id/favorite` | `POST` | Toggle favorite / Liked Songs status. |
| `/api/broadcast/sync` | `POST` | Switch the live in-game broadcast stream to a specific track. |
| `/api/broadcast/status` | `GET` | Get live broadcast status and listener count. |
| `/api/network` | `GET` | Get local LAN IP and network base URLs. |

---

## 🎮 Game Engine Integration Examples

### Roblox (Script)
```lua
local SoundService = game:GetService("SoundService")
local sound = Instance.new("Sound")
sound.SoundId = "http://YOUR_LAN_IP:3000/live.mp3" -- or /stream/trackId.mp3
sound.Parent = SoundService
sound:Play()
```

### FiveM (xsound)
```lua
-- Play permanent live broadcast radio
exports.xsound:PlayUrl("car_radio", "http://YOUR_LAN_IP:3000/live.mp3", 0.8, false)
```

### Garry's Mod (Lua)
```lua
sound.PlayURL("http://YOUR_LAN_IP:3000/live.mp3", "3d", function(station)
    if IsValid(station) then
        station:Play()
    end
end)
```

---

## 📄 License
MIT License. Free for personal, gaming, and commercial streaming projects.
