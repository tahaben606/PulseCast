const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const { v4: uuidv4 } = require('uuid');

const db = require('./db');
const { extractAudioMetadata } = require('./audioService');
const { getYouTubeInfo, downloadAudioToCache, CACHE_DIR } = require('./ytService');
const { getSpotifyDetails, findYouTubeMatch } = require('./spotifyService');
const broadcastService = require('./broadcastService');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const COVERS_DIR = path.join(UPLOADS_DIR, 'covers');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

[UPLOADS_DIR, COVERS_DIR, CACHE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Helper: Get local network IP for game & mobile streaming
function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

// Helper: Extract true public/request base URL
function getRequestBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

// Convert any audio file to MP3 for game compatibility
function convertToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpeg, [
      '-i', inputPath,
      '-vn',
      '-ar', '44100',
      '-ac', '2',
      '-b:a', '192k',
      '-y',
      outputPath
    ], { windowsHide: true });

    process.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) resolve(outputPath);
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });

    process.on('error', reject);
  });
}

// Global CORS & Game Headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range, Authorization');
  res.header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type, icy-name, icy-br');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets
app.use('/public', express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/cache', express.static(CACHE_DIR));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const id = 'trk_' + Date.now() + '_' + uuidv4().substring(0, 8);
    cb(null, `${id}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.wma', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${ext}.`));
    }
  }
});

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp3': return 'audio/mpeg';
    case '.m4a':
    case '.mp4':
    case '.aac': return 'audio/mp4';
    case '.ogg':
    case '.opus': return 'audio/ogg';
    case '.wav': return 'audio/wav';
    case '.flac': return 'audio/flac';
    case '.webm': return 'audio/webm';
    default: return 'audio/mpeg';
  }
}

// -------------------------------------------------------------
// LIVE IN-GAME BROADCAST STREAM (Permanent Single URL for Games)
// -------------------------------------------------------------
app.all(['/live.mp3', '/radio.mp3', '/live', '/stream/live.mp3', '/broadcast.mp3'], (req, res) => {
  broadcastService.addClient(req, res);
});

// Sync Web Player Track to Live In-Game Broadcast
app.post('/api/broadcast/sync', async (req, res) => {
  try {
    const { trackId, seekSeconds = 0 } = req.body;
    if (!trackId) return res.status(400).json({ success: false, message: 'trackId is required' });

    const track = db.getTrackById(trackId);
    if (!track) return res.status(404).json({ success: false, message: 'Track not found' });

    await broadcastService.playTrack(track, seekSeconds);
    res.json({
      success: true,
      message: `Live game broadcast updated to "${track.title}"!`,
      status: broadcastService.getCurrentStatus()
    });
  } catch (e) {
    console.error('Broadcast sync error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/broadcast/status', (req, res) => {
  res.json({
    success: true,
    status: broadcastService.getCurrentStatus()
  });
});

// -------------------------------------------------------------
// CORE STREAM HANDLER (For Individual Static Track Links)
// -------------------------------------------------------------
async function handleAudioStream(req, res, rawTrackId) {
  try {
    const isExplicitMp3 = rawTrackId.toLowerCase().endsWith('.mp3');
    const trackId = rawTrackId.replace(/\.(mp3|wav|ogg|m4a|webm)$/i, '');

    const track = db.getTrackById(trackId);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    if (req.method === 'GET') {
      db.incrementPlayCount(track.id);
    }

    let filePath = null;

    // 1. Check if track already has a local file path
    if (track.audioPath) {
      const candidate = path.join(__dirname, '..', track.audioPath);
      if (fs.existsSync(candidate)) {
        filePath = candidate;
      }
    }

    // 2. If Spotify track or YouTube track without cached audio, resolve and download as MP3
    if (!filePath) {
      let sourceUrl = track.sourceUrl;

      if (!sourceUrl && track.source === 'spotify') {
        const match = await findYouTubeMatch(track.artist, track.title);
        if (match && match.url) {
          sourceUrl = match.url;
          track.sourceUrl = sourceUrl;
          db.updateTrack(track.id, { sourceUrl });
        }
      }

      if (sourceUrl) {
        try {
          const cachedRelative = await downloadAudioToCache(sourceUrl, track.id);
          if (cachedRelative) {
            track.audioPath = cachedRelative.replace(/\\/g, '/');
            db.updateTrack(track.id, { audioPath: track.audioPath });
            filePath = path.join(__dirname, '..', cachedRelative);
          }
        } catch (dlErr) {
          console.error('Failed to download audio on demand:', dlErr);
        }
      }
    }

    // 3. Ensure MP3 format if game explicitly requested .mp3
    if (filePath && isExplicitMp3 && !filePath.toLowerCase().endsWith('.mp3')) {
      const targetMp3 = path.join(CACHE_DIR, `${track.id}.mp3`);
      if (fs.existsSync(targetMp3)) {
        filePath = targetMp3;
      } else {
        try {
          await convertToMp3(filePath, targetMp3);
          filePath = targetMp3;
          track.audioPath = path.join('cache', `${track.id}.mp3`).replace(/\\/g, '/');
          db.updateTrack(track.id, { audioPath: track.audioPath });
        } catch (convErr) {
          console.warn('MP3 conversion fallback:', convErr.message);
        }
      }
    }

    // 4. Serve Audio with JukeHost/Game compatible headers
    if (filePath && fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      const total = stat.size;
      const mimeType = isExplicitMp3 ? 'audio/mpeg' : getMimeType(filePath);

      if (req.method === 'HEAD') {
        res.writeHead(200, {
          'Content-Type': mimeType,
          'Content-Length': total,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'public, max-age=1209600'
        });
        return res.end();
      }

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
        const chunkSize = (end - start) + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mimeType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'public, max-age=1209600'
        });

        const fileStream = fs.createReadStream(filePath, { start, end });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': total,
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'public, max-age=1209600'
        });
        fs.createReadStream(filePath).pipe(res);
      }
      return;
    }

    return res.status(404).send('Audio stream unavailable.');
  } catch (error) {
    console.error('Streaming error:', error);
    res.status(500).send('Streaming server error');
  }
}

// -------------------------------------------------------------
// ROUTES: Audio Streaming Endpoints
// -------------------------------------------------------------
app.all(['/api/stream/:id', '/stream/:id', '/audio/:id', '/raw/:id'], (req, res) => {
  handleAudioStream(req, res, req.params.id);
});

// Direct root stream like /trackId.mp3
app.all('/:id.mp3', (req, res) => {
  handleAudioStream(req, res, req.params.id + '.mp3');
});

// -------------------------------------------------------------
// ROUTES: HTML & Dedicated Shareable Web Players
// -------------------------------------------------------------

// Main SPA App
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Standalone Shareable Auto-playing Track View
app.get('/listen/:id', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'listen.html'));
});

// Standalone Shareable Playlist View
app.get('/listen/playlist/:id', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'listen.html'));
});

// Embeddable mini player
app.get('/embed/:id', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'embed.html'));
});

// Network information for LAN / Game streaming
app.get('/api/network', (req, res) => {
  const localIp = getLocalIp();
  const baseReq = getRequestBaseUrl(req);
  res.json({
    localIp,
    port: PORT,
    currentHost: baseReq,
    lanBaseUrl: `http://${localIp}:${PORT}`,
    localhostBaseUrl: `http://localhost:${PORT}`,
    liveBroadcastUrl: `${baseReq}/live.mp3`,
    liveBroadcastLanUrl: `http://${localIp}:${PORT}/live.mp3`
  });
});

// -------------------------------------------------------------
// ROUTES: Track & Playlist API
// -------------------------------------------------------------

// Get all tracks with favorite indicator
app.get('/api/tracks', (req, res) => {
  const tracks = db.getAllTracks();
  const favList = db.getPlaylistById('favorites');
  const favIds = favList ? favList.trackIds || [] : [];
  
  const tracksWithFav = tracks.map(t => ({
    ...t,
    isFavorite: favIds.includes(t.id)
  }));

  res.json({ success: true, tracks: tracksWithFav });
});

// Get single track info & share metadata
app.get('/api/tracks/:id', (req, res) => {
  const track = db.getTrackById(req.params.id);
  if (!track) return res.status(404).json({ success: false, message: 'Track not found' });

  const host = getRequestBaseUrl(req);
  const localIp = getLocalIp();
  const lanHost = `http://${localIp}:${PORT}`;

  res.json({
    success: true,
    track: {
      ...track,
      isFavorite: db.isFavorite(track.id)
    },
    links: {
      liveBroadcast: `${host}/live.mp3`,
      liveBroadcastLan: `${lanHost}/live.mp3`,
      webPlayer: `${host}/listen/${track.id}`,
      streamAudio: `${host}/stream/${track.id}.mp3`,
      directRawMp3: `${host}/${track.id}.mp3`,
      gameLink: `${host}/stream/${track.id}.mp3`,
      gameLanLink: `${lanHost}/stream/${track.id}.mp3`,
      embed: `<iframe src="${host}/embed/${track.id}" width="100%" height="152" frameBorder="0" allow="autoplay; encrypted-media"></iframe>`
    }
  });
});

// Upload local audio files
app.post('/api/tracks/upload', upload.array('audioFiles', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No audio files uploaded' });
    }

    const createdTracks = [];

    for (const file of req.files) {
      const trackId = path.parse(file.filename).name;
      const metadata = await extractAudioMetadata(file.path, file.originalname, trackId);

      const track = {
        id: trackId,
        title: metadata.title || path.parse(file.originalname).name,
        artist: metadata.artist || 'Unknown Artist',
        album: metadata.album || 'Local Upload',
        duration: metadata.duration || 0,
        source: 'upload',
        sourceUrl: file.originalname,
        audioPath: path.join('uploads', file.filename).replace(/\\/g, '/'),
        thumbnail: metadata.thumbnail || '/public/images/default-track.svg',
        createdAt: new Date().toISOString(),
        playCount: 0
      };

      db.addTrack(track);
      createdTracks.push(track);
    }

    res.json({
      success: true,
      message: `Successfully imported ${createdTracks.length} track(s)`,
      tracks: createdTracks
    });
  } catch (error) {
    console.error('Upload processing error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error processing audio files' });
  }
});

// Preview YouTube URL before importing
app.post('/api/tracks/youtube-preview', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ success: false, message: 'URL is required' });
    }

    const info = await getYouTubeInfo(url.trim());
    res.json({ success: true, info });
  } catch (error) {
    console.error('YouTube preview error:', error);
    res.status(400).json({ success: false, message: 'Failed to inspect YouTube URL. Please verify the link.' });
  }
});

// Import YouTube Video or Playlist
app.post('/api/tracks/youtube', async (req, res) => {
  try {
    const { url, download = true } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ success: false, message: 'YouTube URL is required' });
    }

    const ytInfo = await getYouTubeInfo(url.trim());
    const addedTracks = [];

    if (ytInfo.isPlaylist) {
      for (const item of ytInfo.items) {
        const trackId = 'yt_' + item.id + '_' + Date.now().toString(36);
        let audioPath = null;

        if (download) {
          try {
            audioPath = await downloadAudioToCache(item.url, trackId);
          } catch (e) {
            console.warn(`Could not pre-cache ${item.title}:`, e.message);
          }
        }

        const track = {
          id: trackId,
          title: item.title,
          artist: item.artist,
          album: item.album || ytInfo.playlistTitle || 'YouTube Playlist',
          duration: item.duration,
          source: 'youtube',
          sourceUrl: item.url,
          audioPath: audioPath ? audioPath.replace(/\\/g, '/') : null,
          thumbnail: item.thumbnail || '/public/images/default-track.svg',
          createdAt: new Date().toISOString(),
          playCount: 0
        };

        db.addTrack(track);
        addedTracks.push(track);
      }
    } else {
      const item = ytInfo.item;
      const trackId = 'yt_' + item.id + '_' + Date.now().toString(36);
      let audioPath = null;

      if (download) {
        try {
          audioPath = await downloadAudioToCache(item.url, trackId);
        } catch (e) {
          console.warn(`Could not pre-cache ${item.title}:`, e.message);
        }
      }

      const track = {
        id: trackId,
        title: item.title,
        artist: item.artist,
        album: item.album || 'YouTube Stream',
        duration: item.duration,
        source: 'youtube',
        sourceUrl: item.url,
        audioPath: audioPath ? audioPath.replace(/\\/g, '/') : null,
        thumbnail: item.thumbnail || '/public/images/default-track.svg',
        createdAt: new Date().toISOString(),
        playCount: 0
      };

      db.addTrack(track);
      addedTracks.push(track);
    }

    res.json({
      success: true,
      message: `Imported ${addedTracks.length} YouTube track(s)`,
      tracks: addedTracks
    });
  } catch (error) {
    console.error('YouTube import error:', error);
    res.status(500).json({ success: false, message: 'Failed to import YouTube audio: ' + (error.message || error) });
  }
});

// Preview Spotify Playlist/Album/Track
app.post('/api/tracks/spotify-preview', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ success: false, message: 'Spotify URL is required' });
    }

    const details = await getSpotifyDetails(url.trim());
    res.json({ success: true, details });
  } catch (error) {
    console.error('Spotify preview error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to inspect Spotify URL.' });
  }
});

// Import Spotify Playlist/Album/Track
app.post('/api/tracks/spotify', async (req, res) => {
  try {
    const { url, createPlaylist = true } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ success: false, message: 'Spotify URL is required' });
    }

    const details = await getSpotifyDetails(url.trim());
    const addedTracks = [];

    let newPlaylist = null;
    if (createPlaylist) {
      newPlaylist = db.createPlaylist(details.title, details.description, details.cover);
    }

    for (const item of details.tracks) {
      const trackId = 'sp_' + Date.now().toString(36) + '_' + uuidv4().substring(0, 6);

      const track = {
        id: trackId,
        title: item.title,
        artist: item.artist,
        album: item.album || details.title,
        duration: item.duration,
        source: 'spotify',
        sourceUrl: null,
        audioPath: null,
        thumbnail: item.thumbnail || details.cover || '/public/images/default-track.svg',
        createdAt: new Date().toISOString(),
        playCount: 0
      };

      db.addTrack(track);
      addedTracks.push(track);

      if (newPlaylist) {
        db.addTrackToPlaylist(newPlaylist.id, track.id);
      }
    }

    res.json({
      success: true,
      message: `Successfully imported ${addedTracks.length} tracks from "${details.title}"!`,
      playlist: newPlaylist,
      tracks: addedTracks
    });
  } catch (error) {
    console.error('Spotify import error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to import Spotify playlist' });
  }
});

// Update track info
app.put('/api/tracks/:id', (req, res) => {
  const { title, artist, album } = req.body;
  const updated = db.updateTrack(req.params.id, { title, artist, album });
  if (!updated) return res.status(404).json({ success: false, message: 'Track not found' });
  res.json({ success: true, track: updated });
});

// Delete track
app.delete('/api/tracks/:id', (req, res) => {
  const track = db.deleteTrack(req.params.id);
  if (!track) return res.status(404).json({ success: false, message: 'Track not found' });

  if (track.audioPath) {
    const fullPath = path.join(__dirname, '..', track.audioPath);
    if (fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch (e) { console.warn('Could not delete audio file:', e); }
    }
  }

  res.json({ success: true, message: 'Track deleted successfully' });
});

// Favorite / Like Toggle
app.post('/api/tracks/:id/favorite', (req, res) => {
  const result = db.toggleFavorite(req.params.id);
  res.json({ success: true, isFavorite: result.isFavorite, trackIds: result.trackIds });
});

// -------------------------------------------------------------
// PLAYLISTS MANAGEMENT API
// -------------------------------------------------------------
app.get('/api/playlists', (req, res) => {
  const playlists = db.getAllPlaylists();
  res.json({ success: true, playlists });
});

app.get('/api/playlists/:id', (req, res) => {
  const playlist = db.getPlaylistById(req.params.id);
  if (!playlist) return res.status(404).json({ success: false, message: 'Playlist not found' });
  res.json({ success: true, playlist });
});

app.post('/api/playlists', (req, res) => {
  const { name, description, cover } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Playlist name is required' });
  const playlist = db.createPlaylist(name.trim(), description || '', cover || '');
  res.json({ success: true, message: 'Playlist created!', playlist });
});

app.put('/api/playlists/:id', (req, res) => {
  const { name, description, cover } = req.body;
  const updated = db.updatePlaylist(req.params.id, { name, description, cover });
  if (!updated) return res.status(404).json({ success: false, message: 'Playlist not found' });
  res.json({ success: true, message: 'Playlist updated!', playlist: updated });
});

app.delete('/api/playlists/:id', (req, res) => {
  if (req.params.id === 'favorites' || req.params.id === 'default') {
    return res.status(400).json({ success: false, message: 'Cannot delete system playlists.' });
  }
  const success = db.deletePlaylist(req.params.id);
  if (!success) return res.status(404).json({ success: false, message: 'Playlist not found' });
  res.json({ success: true, message: 'Playlist deleted successfully!' });
});

app.post('/api/playlists/:id/tracks', (req, res) => {
  const { trackId } = req.body;
  if (!trackId) return res.status(400).json({ success: false, message: 'trackId is required' });
  const success = db.addTrackToPlaylist(req.params.id, trackId);
  if (!success) return res.status(404).json({ success: false, message: 'Playlist not found' });
  res.json({ success: true, message: 'Song added to playlist!' });
});

app.delete('/api/playlists/:id/tracks/:trackId', (req, res) => {
  const success = db.removeTrackFromPlaylist(req.params.id, req.params.trackId);
  if (!success) return res.status(404).json({ success: false, message: 'Track or Playlist not found' });
  res.json({ success: true, message: 'Song removed from playlist!' });
});

// Global Stats
app.get('/api/stats', (req, res) => {
  const tracks = db.getAllTracks();
  const playlists = db.getAllPlaylists();
  const totalDuration = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const totalPlays = tracks.reduce((acc, t) => acc + (t.playCount || 0), 0);

  res.json({
    success: true,
    stats: {
      trackCount: tracks.length,
      playlistCount: playlists.length,
      totalDuration,
      totalPlays,
      uploadsCount: tracks.filter(t => t.source === 'upload').length,
      youtubeCount: tracks.filter(t => t.source === 'youtube').length,
      spotifyCount: tracks.filter(t => t.source === 'spotify').length,
      liveListeners: broadcastService.getListenerCount()
    }
  });
});

// Bind to 0.0.0.0 so games & other devices on LAN / Public IP can connect
app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`====================================================`);
  console.log(`🎵 PulseCast Live In-Game Broadcast Server Running!`);
  console.log(`👉 Web DJ Dashboard:  http://localhost:${PORT}`);
  console.log(`📡 Permanent Game URL: http://${localIp}:${PORT}/live.mp3`);
  console.log(`====================================================`);
});
