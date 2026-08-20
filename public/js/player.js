/**
 * Spotify-Style Playback Engine
 */
class AudioPlayer {
  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = "anonymous";
    this.queue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.isShuffle = false;
    this.repeatMode = 'off'; // 'off' | 'all' | 'one'
    this.volume = 0.8;
    this.isMuted = false;
    this.visualizer = null;

    // Callbacks for UI updates
    this.onTrackChange = null;
    this.onPlayStateChange = null;
    this.onTimeUpdate = null;
    this.onQueueChange = null;

    this.initAudioEvents();
    this.initMediaSession();
    this.initKeyboardShortcuts();
  }

  setVisualizer(visualizer) {
    this.visualizer = visualizer;
  }

  initAudioEvents() {
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      if (this.visualizer) this.visualizer.start();
      if (this.onPlayStateChange) this.onPlayStateChange(true);
      this.updateMediaSessionState();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      if (this.visualizer) this.visualizer.stop();
      if (this.onPlayStateChange) this.onPlayStateChange(false);
      this.updateMediaSessionState();
    });

    this.audio.addEventListener('timeupdate', () => {
      if (this.onTimeUpdate) {
        this.onTimeUpdate(this.audio.currentTime, this.audio.duration || 0);
      }
    });

    this.audio.addEventListener('ended', () => {
      if (this.repeatMode === 'one') {
        this.audio.currentTime = 0;
        this.audio.play().catch(console.warn);
      } else {
        this.next(false); // auto next
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      if (window.showToast) window.showToast('Audio playback error for this track', 'error');
    });

    this.audio.volume = this.volume;
  }

  initMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          this.audio.currentTime = details.seekTime;
        }
      });
    }
  }

  updateMediaSessionMetadata(track) {
    if ('mediaSession' in navigator && track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Untitled Track',
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'SpotyStream',
        artwork: [
          { src: track.thumbnail || '/public/images/default-track.png', sizes: '512x512', type: 'image/png' }
        ]
      });
    }
  }

  updateMediaSessionState() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
    }
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't trigger if user is typing in an input field
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.seekRelative(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.seekRelative(5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.setVolume(Math.min(1, this.volume + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.setVolume(Math.max(0, this.volume - 0.05));
          break;
        case 'KeyM':
          e.preventDefault();
          this.toggleMute();
          break;
        case 'KeyN':
          if (e.shiftKey) {
            e.preventDefault();
            this.next();
          }
          break;
        case 'KeyP':
          if (e.shiftKey) {
            e.preventDefault();
            this.prev();
          }
          break;
      }
    });
  }

  getCurrentTrack() {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex];
    }
    return null;
  }

  setQueue(tracks, startIndex = 0, autoPlay = true) {
    if (!tracks || tracks.length === 0) return;
    this.queue = [...tracks];
    this.currentIndex = Math.max(0, Math.min(startIndex, this.queue.length - 1));
    this.loadCurrentTrack(autoPlay);
    if (this.onQueueChange) this.onQueueChange(this.queue, this.currentIndex);
  }

  addToQueue(track) {
    this.queue.push(track);
    if (this.currentIndex === -1) {
      this.currentIndex = 0;
      this.loadCurrentTrack(true);
    }
    if (this.onQueueChange) this.onQueueChange(this.queue, this.currentIndex);
  }

  loadCurrentTrack(autoPlay = true) {
    const track = this.getCurrentTrack();
    if (!track) return;

    this.audio.src = `/api/stream/${track.id}`;
    this.audio.load();

    this.updateMediaSessionMetadata(track);
    document.title = `${track.title} • ${track.artist} | PulseCast`;

    if (this.onTrackChange) this.onTrackChange(track);
    if (this.onQueueChange) this.onQueueChange(this.queue, this.currentIndex);

    if (autoPlay) {
      this.play();
    }
  }

  play() {
    if (!this.getCurrentTrack() && this.queue.length > 0) {
      this.currentIndex = 0;
      this.loadCurrentTrack(true);
      return;
    }
    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('Autoplay prevented or playback interrupted:', err.message);
        this.isPlaying = false;
        if (this.onPlayStateChange) this.onPlayStateChange(false);
      });
    }
  }

  pause() {
    this.audio.pause();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  next(userInitiated = true) {
    if (this.queue.length === 0) return;

    if (this.isShuffle) {
      if (this.queue.length > 1) {
        let nextIdx;
        do {
          nextIdx = Math.floor(Math.random() * this.queue.length);
        } while (nextIdx === this.currentIndex);
        this.currentIndex = nextIdx;
      }
    } else {
      if (this.currentIndex < this.queue.length - 1) {
        this.currentIndex++;
      } else if (this.repeatMode === 'all') {
        this.currentIndex = 0;
      } else if (userInitiated) {
        this.currentIndex = 0; // Wrap around if clicked next explicitly
      } else {
        // End of queue reached naturally
        this.pause();
        return;
      }
    }

    this.loadCurrentTrack(true);
  }

  prev() {
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
    } else {
      this.currentIndex = this.queue.length - 1;
    }

    this.loadCurrentTrack(true);
  }

  seek(percentage) {
    if (this.audio.duration) {
      this.audio.currentTime = (percentage / 100) * this.audio.duration;
    }
  }

  seekRelative(seconds) {
    if (this.audio.duration) {
      this.audio.currentTime = Math.max(0, Math.min(this.audio.duration, this.audio.currentTime + seconds));
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.audio.volume = this.volume;
    this.isMuted = this.volume === 0;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.audio.volume = this.isMuted ? 0 : this.volume;
    return this.isMuted;
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    return this.isShuffle;
  }

  toggleRepeat() {
    if (this.repeatMode === 'off') this.repeatMode = 'all';
    else if (this.repeatMode === 'all') this.repeatMode = 'one';
    else this.repeatMode = 'off';
    return this.repeatMode;
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}

window.AudioPlayer = AudioPlayer;
