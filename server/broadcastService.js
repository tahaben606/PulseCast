const fs = require('fs');
const path = require('path');
const db = require('./db');
const { downloadAudioToCache, CACHE_DIR } = require('./ytService');
const { findYouTubeMatch } = require('./spotifyService');

class BroadcastService {
  constructor() {
    this.clients = new Set();
    this.currentTrack = null;
    this.currentFd = null;
    this.currentChunkInterval = null;
    this.isPlaying = false;
  }

  getListenerCount() {
    return this.clients.size;
  }

  getCurrentStatus() {
    return {
      isPlaying: this.isPlaying,
      currentTrack: this.currentTrack,
      listenerCount: this.clients.size
    };
  }

  /**
   * Register a new game client HTTP stream
   */
  addClient(req, res) {
    if (req.method === 'HEAD' || req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'icy-name': 'PulseCast In-Game Live Radio',
        'icy-br': '192'
      });
      return res.end();
    }

    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-store, must-revalidate, no-transform',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'icy-name': 'PulseCast In-Game Live Radio',
      'icy-genre': 'Gaming Radio',
      'icy-br': '192'
    });

    this.clients.add(res);

    req.on('close', () => {
      this.clients.delete(res);
    });

    // If not playing anything yet, start playing the first available track
    if (!this.isPlaying) {
      const allTracks = db.getAllTracks();
      if (allTracks.length > 0) {
        this.playTrack(allTracks[0]);
      }
    }
  }

  /**
   * Switch the live stream immediately to a new track
   */
  async playTrack(track, seekSeconds = 0) {
    if (!track) return;
    this.currentTrack = track;

    let filePath = null;
    if (track.audioPath) {
      const candidate = path.join(__dirname, '..', track.audioPath);
      if (fs.existsSync(candidate)) {
        filePath = candidate;
      }
    }

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
          const cached = await downloadAudioToCache(sourceUrl, track.id);
          if (cached) {
            track.audioPath = cached.replace(/\\/g, '/');
            db.updateTrack(track.id, { audioPath: track.audioPath });
            filePath = path.join(__dirname, '..', cached);
          }
        } catch (e) {
          console.warn('Failed to cache track for live broadcast:', e.message);
        }
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      console.warn(`Cannot play track ${track.title} on broadcast: file missing`);
      return;
    }

    this.startStreamingFile(filePath, seekSeconds);
  }

  /**
   * Streams an MP3 file at real-time audio rate (192kbps ~ 24000 bytes/sec)
   */
  startStreamingFile(filePath, seekSeconds = 0) {
    this.stopCurrentStream();

    const stat = fs.statSync(filePath);
    const totalSize = stat.size;
    const bytesPerSecond = 24000;
    const chunkSize = 4096;
    const intervalMs = Math.round((chunkSize / bytesPerSecond) * 1000); // ~170ms

    let startByte = 0;
    if (seekSeconds > 0) {
      startByte = Math.min(totalSize - 1, Math.round(seekSeconds * bytesPerSecond));
    }

    const fd = fs.openSync(filePath, 'r');
    this.currentFd = fd;
    let currentPosition = startByte;
    this.isPlaying = true;

    const buffer = Buffer.alloc(chunkSize);

    this.currentChunkInterval = setInterval(() => {
      if (!this.isPlaying || this.currentFd !== fd) return;

      if (currentPosition >= totalSize) {
        this.stopCurrentStream();
        this.advanceToNextTrack();
        return;
      }

      const bytesToRead = Math.min(chunkSize, totalSize - currentPosition);
      try {
        const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, currentPosition);
        if (bytesRead > 0) {
          const chunkToSend = buffer.subarray(0, bytesRead);
          for (const client of this.clients) {
            try {
              client.write(chunkToSend);
            } catch (err) {
              this.clients.delete(client);
            }
          }
        }
        currentPosition += bytesRead;
      } catch (err) {
        this.stopCurrentStream();
      }
    }, intervalMs);
  }

  stopCurrentStream() {
    if (this.currentChunkInterval) {
      clearInterval(this.currentChunkInterval);
      this.currentChunkInterval = null;
    }
    if (this.currentFd !== null) {
      try {
        fs.closeSync(this.currentFd);
      } catch (e) {}
      this.currentFd = null;
    }
    this.isPlaying = false;
  }

  advanceToNextTrack() {
    const allTracks = db.getAllTracks();
    if (allTracks.length === 0) return;

    let nextIdx = 0;
    if (this.currentTrack) {
      const idx = allTracks.findIndex(t => t.id === this.currentTrack.id);
      if (idx !== -1 && idx < allTracks.length - 1) {
        nextIdx = idx + 1;
      }
    }

    this.playTrack(allTracks[nextIdx]);
  }
}

const broadcastInstance = new BroadcastService();
module.exports = broadcastInstance;
