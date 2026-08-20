/**
 * PulseCast Main UI Controller & Playlist Manager
 */

// Toast notifications
window.showToast = function(message, type = 'default') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3000);
};

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Core Services
  const player = new AudioPlayer();
  const visualizerCanvas = document.getElementById('audioVisualizerCanvas');
  const visualizer = new AudioVisualizer(visualizerCanvas, player.audio);
  player.setVisualizer(visualizer);

  const shareModal = new ShareModal();

  // App State
  let state = {
    tracks: [],
    playlists: [],
    currentPlaylistId: 'all', // 'all', 'favorites', or custom playlist id
    activeFilterQuery: '',
    selectedTrackForPlaylist: null,
    isLoading: false
  };

  // DOM Elements
  const trackTableBody = document.getElementById('trackTableBody');
  const emptyState = document.getElementById('emptyState');
  const emptyStateTitle = document.getElementById('emptyStateTitle');
  const emptyStateDesc = document.getElementById('emptyStateDesc');
  const playlistNavList = document.getElementById('playlistNavList');
  const searchInput = document.getElementById('searchInput');

  // Hero Elements
  const heroTitle = document.getElementById('heroTitle');
  const heroDesc = document.getElementById('heroDesc');
  const heroMeta = document.getElementById('heroMeta');
  const heroArt = document.getElementById('heroArt');
  const btnHeroPlay = document.getElementById('btnHeroPlay');
  const btnHeroCreatePlaylist = document.getElementById('btnHeroCreatePlaylist');
  const btnHeroEditPlaylist = document.getElementById('btnHeroEditPlaylist');
  const btnHeroDeletePlaylist = document.getElementById('btnHeroDeletePlaylist');

  // Bottom Player Elements
  const playerThumb = document.getElementById('playerThumb');
  const playerTitle = document.getElementById('playerTitle');
  const playerArtist = document.getElementById('playerArtist');
  const btnPlayerPlay = document.getElementById('btnPlayerPlay');
  const btnPlayerPrev = document.getElementById('btnPlayerPrev');
  const btnPlayerNext = document.getElementById('btnPlayerNext');
  const btnPlayerShuffle = document.getElementById('btnPlayerShuffle');
  const btnPlayerRepeat = document.getElementById('btnPlayerRepeat');
  const btnPlayerFav = document.getElementById('btnPlayerFav');
  const btnPlayerShare = document.getElementById('btnPlayerShare');

  const progressTrack = document.getElementById('progressTrack');
  const progressFill = document.getElementById('progressFill');
  const currentTimeLabel = document.getElementById('currentTimeLabel');
  const totalDurationLabel = document.getElementById('totalDurationLabel');

  const volumeTrack = document.getElementById('volumeTrack');
  const volumeFill = document.getElementById('volumeFill');
  const btnMute = document.getElementById('btnMute');

  // Right Sidebar Elements
  const rightSidebar = document.getElementById('rightSidebar');
  const btnToggleRightSidebar = document.getElementById('btnToggleRightSidebar');
  const nowPlayingThumb = document.getElementById('nowPlayingThumb');
  const nowPlayingTitle = document.getElementById('nowPlayingTitle');
  const nowPlayingArtist = document.getElementById('nowPlayingArtist');
  const queueList = document.getElementById('queueList');

  // Modals
  const uploadModal = document.getElementById('uploadModal');
  const ytModal = document.getElementById('ytModal');
  const spotifyModal = document.getElementById('spotifyModal');
  const createPlaylistModal = document.getElementById('createPlaylistModal');
  const editPlaylistModal = document.getElementById('editPlaylistModal');
  const addToPlaylistModal = document.getElementById('addToPlaylistModal');

  // -------------------------------------------------------------
  // DATA FETCHING
  // -------------------------------------------------------------
  async function loadInitialData() {
    try {
      const [tracksRes, playlistsRes] = await Promise.all([
        fetch('/api/tracks').then(r => r.json()),
        fetch('/api/playlists').then(r => r.json())
      ]);

      if (tracksRes.success) state.tracks = tracksRes.tracks;
      if (playlistsRes.success) state.playlists = playlistsRes.playlists;

      renderPlaylists();
      renderCurrentView();
    } catch (err) {
      console.error('Error fetching data:', err);
      showToast('Failed to connect to streaming server', 'error');
    }
  }

  // -------------------------------------------------------------
  // RENDERING FUNCTIONS
  // -------------------------------------------------------------
  function getFilteredTracks() {
    let currentList = [];
    if (state.currentPlaylistId === 'all') {
      currentList = state.tracks;
    } else if (state.currentPlaylistId === 'favorites') {
      const favPl = state.playlists.find(p => p.id === 'favorites');
      const favIds = favPl ? (favPl.trackIds || []) : [];
      currentList = state.tracks.filter(t => favIds.includes(t.id));
    } else {
      const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
      if (pl) {
        const tIds = pl.trackIds || [];
        currentList = tIds.map(id => state.tracks.find(t => t.id === id)).filter(Boolean);
      }
    }

    if (!state.activeFilterQuery) return currentList;

    const q = state.activeFilterQuery.toLowerCase();
    return currentList.filter(t => 
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.artist && t.artist.toLowerCase().includes(q)) ||
      (t.album && t.album.toLowerCase().includes(q))
    );
  }

  function renderCurrentView() {
    const tracksToRender = getFilteredTracks();
    const currentPlayingTrack = player.getCurrentTrack();

    // Update Hero Banner & Action Buttons
    if (state.currentPlaylistId === 'all') {
      heroTitle.textContent = 'All Tracks';
      heroDesc.textContent = 'Your complete library of uploaded songs, Spotify and YouTube streams';
      heroArt.innerHTML = `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
      btnHeroEditPlaylist.style.display = 'none';
      btnHeroDeletePlaylist.style.display = 'none';
    } else if (state.currentPlaylistId === 'favorites') {
      heroTitle.textContent = 'Liked Songs';
      heroDesc.textContent = 'Your favorite collection of streamed tracks';
      heroArt.innerHTML = `<svg width="80" height="80" viewBox="0 0 24 24" fill="#1db954" stroke="#1db954" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
      btnHeroEditPlaylist.style.display = 'none';
      btnHeroDeletePlaylist.style.display = 'none';
    } else {
      const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
      heroTitle.textContent = pl ? pl.name : 'Custom Playlist';
      heroDesc.textContent = pl && pl.description ? pl.description : 'Custom playlist';
      if (pl && pl.cover) {
        heroArt.innerHTML = `<img src="${pl.cover}" alt="${pl.name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.onerror=null;this.parentElement.innerHTML='<svg width=\\'80\\' height=\\'80\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1.5\\'><path d=\\'M9 18V5l12-2v13\\'></path><circle cx=\\'6\\' cy=\\'18\\' r=\\'3\\'></circle><circle cx=\\'18\\' cy=\\'16\\' r=\\'3\\'></circle></svg>'"/>`;
      } else {
        heroArt.innerHTML = `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
      }
      btnHeroEditPlaylist.style.display = 'inline-flex';
      btnHeroDeletePlaylist.style.display = 'inline-flex';
    }

    const totalSeconds = tracksToRender.reduce((sum, t) => sum + (t.duration || 0), 0);
    const totalMinutes = Math.round(totalSeconds / 60);
    heroMeta.innerHTML = `<span>${tracksToRender.length} song${tracksToRender.length === 1 ? '' : 's'}</span><span class="dot">•</span><span>about ${totalMinutes} min</span>`;

    // Render Track Table
    if (tracksToRender.length === 0) {
      trackTableBody.innerHTML = '';
      emptyState.style.display = 'flex';
      emptyStateTitle.textContent = state.currentPlaylistId === 'favorites' 
        ? 'No liked songs yet' 
        : (state.currentPlaylistId === 'all' ? 'No songs in your library' : 'This playlist is empty');
      emptyStateDesc.textContent = 'Click the heart icon on any song or use "+ Add to Playlist" to populate this list.';
      return;
    }

    emptyState.style.display = 'none';
    const isCustomPlaylist = state.currentPlaylistId !== 'all' && state.currentPlaylistId !== 'favorites';

    trackTableBody.innerHTML = tracksToRender.map((track, idx) => {
      const isCurrent = currentPlayingTrack && currentPlayingTrack.id === track.id;
      const isPlaying = isCurrent && player.isPlaying;
      const thumb = track.thumbnail || '/public/images/default-track.svg';
      const durationStr = player.formatTime(track.duration);
      const isYt = track.source === 'youtube';
      const isSpotify = track.source === 'spotify';
      const badgeClass = isSpotify ? 'badge-spotify' : (isYt ? 'badge-yt' : 'badge-upload');
      const badgeText = isSpotify ? 'Spotify' : (isYt ? 'YouTube' : 'Audio File');
      const isFav = !!track.isFavorite;

      return `
        <tr class="track-row ${isCurrent ? 'active' : ''}" data-id="${track.id}">
          <td class="track-num-cell center">
            <span class="num-label">${isPlaying ? `
              <div class="equalizer-icon">
                <div class="equalizer-bar"></div>
                <div class="equalizer-bar"></div>
                <div class="equalizer-bar"></div>
                <div class="equalizer-bar"></div>
              </div>
            ` : (idx + 1)}</span>
            <button class="row-play-btn" title="Play">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
          </td>
          <td>
            <div class="track-meta-cell">
              <img class="track-thumb" src="${thumb}" alt="${track.title}" loading="lazy" onerror="this.src='/public/images/default-track.svg'" />
              <div class="track-details">
                <span class="track-title" title="${track.title}">${escapeHtml(track.title)}</span>
                <span class="track-artist">${escapeHtml(track.artist)}</span>
              </div>
            </div>
          </td>
          <td>
            <span class="badge-source ${badgeClass}">
              ${badgeText}
            </span>
          </td>
          <td class="center">${durationStr}</td>
          <td>
            <div class="track-actions-cell">
              <button class="action-btn-row btn-row-fav ${isFav ? 'fav-active' : ''}" title="${isFav ? 'Unlike' : 'Like'}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
              </button>
              <button class="action-btn-row btn-add-to-pl" title="Add to Playlist">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <button class="action-btn-row btn-share-track" title="Share & Game Link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
              </button>
              ${isCustomPlaylist ? `
                <button class="action-btn-row btn-remove-from-pl" title="Remove from this Playlist" style="color:#ff5555;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              ` : `
                <button class="action-btn-row btn-delete-track" title="Delete Track from Library">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach Row Event Listeners
    document.querySelectorAll('.track-row').forEach((row, index) => {
      const trackId = row.getAttribute('data-id');
      const track = state.tracks.find(t => t.id === trackId);

      // Play on double click or click
      row.addEventListener('click', (e) => {
        if (e.target.closest('.action-btn-row')) return;
        player.setQueue(tracksToRender, index, true);
      });

      // Like toggle
      const favBtn = row.querySelector('.btn-row-fav');
      if (favBtn) {
        favBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await toggleTrackFavorite(track.id);
        });
      }

      // Add to playlist
      const addPlBtn = row.querySelector('.btn-add-to-pl');
      if (addPlBtn) {
        addPlBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openAddToPlaylistModal(track);
        });
      }

      // Share button
      const shareBtn = row.querySelector('.btn-share-track');
      if (shareBtn) {
        shareBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          shareModal.open(track);
        });
      }

      // Remove from playlist
      const removePlBtn = row.querySelector('.btn-remove-from-pl');
      if (removePlBtn) {
        removePlBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await removeTrackFromPlaylist(state.currentPlaylistId, track.id);
        });
      }

      // Delete track
      const delBtn = row.querySelector('.btn-delete-track');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Delete "${track.title}" from library?`)) {
            await deleteTrack(track.id);
          }
        });
      }
    });
  }

  function renderPlaylists() {
    const favPl = state.playlists.find(p => p.id === 'favorites');
    const favCount = favPl ? (favPl.trackIds || []).length : 0;

    playlistNavList.innerHTML = `
      <div class="playlist-item ${state.currentPlaylistId === 'all' ? 'active' : ''}" data-id="all">
        <div class="playlist-icon-box radio-gradient">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
        </div>
        <div class="playlist-info">
          <span class="name">All Library</span>
          <span class="meta">${state.tracks.length} tracks</span>
        </div>
      </div>
      <div class="playlist-item ${state.currentPlaylistId === 'favorites' ? 'active' : ''}" data-id="favorites">
        <div class="playlist-icon-box liked-gradient">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </div>
        <div class="playlist-info">
          <span class="name">Liked Songs</span>
          <span class="meta">${favCount} tracks</span>
        </div>
      </div>
    `;

    // Render custom playlists
    state.playlists.forEach(pl => {
      if (pl.id === 'favorites' || pl.id === 'default') return;
      const count = (pl.trackIds || []).length;
      const el = document.createElement('div');
      el.className = `playlist-item ${state.currentPlaylistId === pl.id ? 'active' : ''}`;
      el.setAttribute('data-id', pl.id);
      el.innerHTML = `
        <div class="playlist-icon-box" style="background: #282828;">
          ${pl.cover ? `<img src="${pl.cover}" style="width:100%;height:100%;object-fit:cover;" onerror="this.remove()"/>` : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`}
        </div>
        <div class="playlist-info">
          <span class="name">${escapeHtml(pl.name)}</span>
          <span class="meta">${count} track${count === 1 ? '' : 's'}</span>
        </div>
        <button class="btn-playlist-delete" title="Delete Playlist">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      `;

      // Playlist delete button in sidebar
      const delBtn = el.querySelector('.btn-playlist-delete');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deletePlaylist(pl.id, pl.name);
        });
      }

      playlistNavList.appendChild(el);
    });

    // Attach click events
    playlistNavList.querySelectorAll('.playlist-item').forEach(item => {
      item.addEventListener('click', () => {
        state.currentPlaylistId = item.getAttribute('data-id');
        renderPlaylists();
        renderCurrentView();
      });
    });
  }

  function renderQueue(queue, currentIndex) {
    if (!queueList) return;
    const upNext = queue.slice(currentIndex + 1, currentIndex + 10);
    if (upNext.length === 0) {
      queueList.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Queue empty. Add more songs or loop playlist.</div>`;
      return;
    }

    queueList.innerHTML = upNext.map((track, idx) => `
      <div class="queue-item" data-index="${currentIndex + 1 + idx}">
        <img src="${track.thumbnail || '/public/images/default-track.svg'}" alt="${track.title}" onerror="this.src='/public/images/default-track.svg'"/>
        <div class="queue-item-text">
          <span class="title">${escapeHtml(track.title)}</span>
          <span class="artist">${escapeHtml(track.artist)}</span>
        </div>
      </div>
    `).join('');

    queueList.querySelectorAll('.queue-item').forEach(item => {
      item.addEventListener('click', () => {
        const targetIdx = parseInt(item.getAttribute('data-index'), 10);
        player.currentIndex = targetIdx;
        player.loadCurrentTrack(true);
      });
    });
  }

  // -------------------------------------------------------------
  // PLAYER EVENT SUBSCRIPTIONS & LIVE DJ SYNC
  // -------------------------------------------------------------
  player.onTrackChange = (track) => {
    if (!track) return;
    const thumb = track.thumbnail || '/public/images/default-track.svg';

    playerThumb.src = thumb;
    playerTitle.textContent = track.title;
    playerArtist.textContent = track.artist;

    if (btnPlayerFav) {
      btnPlayerFav.classList.toggle('active', !!track.isFavorite);
    }

    if (nowPlayingThumb) nowPlayingThumb.src = thumb;
    if (nowPlayingTitle) nowPlayingTitle.textContent = track.title;
    if (nowPlayingArtist) nowPlayingArtist.textContent = track.artist;

    // Synchronize In-Game Live Stream Radio in real time!
    fetch('/api/broadcast/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId: track.id })
    }).then(r => r.json()).then(d => {
      if (d.success) {
        showToast(`📡 Live In-Game Radio switched to "${track.title}"!`, 'success');
      }
    }).catch(err => console.warn('Broadcast sync note:', err.message));

    renderCurrentView();
  };

  player.onPlayStateChange = (isPlaying) => {
    const playIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    const pauseIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;

    btnPlayerPlay.innerHTML = isPlaying ? pauseIcon : playIcon;
    btnHeroPlay.innerHTML = isPlaying ? pauseIcon : playIcon;
    renderCurrentView();
  };

  player.onTimeUpdate = (currentTime, duration) => {
    currentTimeLabel.textContent = player.formatTime(currentTime);
    totalDurationLabel.textContent = player.formatTime(duration);
    const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
    progressFill.style.width = `${pct}%`;
  };

  player.onQueueChange = (queue, currentIndex) => {
    renderQueue(queue, currentIndex);
  };

  // -------------------------------------------------------------
  // PLAYLIST MANAGEMENT ACTIONS
  // -------------------------------------------------------------
  async function createPlaylist(name, description = '', cover = '') {
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, cover })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Playlist "${data.playlist.name}" created!`, 'success');
        state.playlists.push(data.playlist);
        state.currentPlaylistId = data.playlist.id;
        renderPlaylists();
        renderCurrentView();
        createPlaylistModal.classList.remove('open');
      } else {
        showToast(data.message || 'Failed to create playlist', 'error');
      }
    } catch (e) {
      showToast('Error creating playlist', 'error');
    }
  }

  async function updatePlaylist(id, name, description, cover) {
    try {
      const res = await fetch(`/api/playlists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, cover })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Playlist updated!', 'success');
        const idx = state.playlists.findIndex(p => p.id === id);
        if (idx !== -1) {
          state.playlists[idx] = { ...state.playlists[idx], ...data.playlist };
        }
        renderPlaylists();
        renderCurrentView();
        editPlaylistModal.classList.remove('open');
      }
    } catch (e) {
      showToast('Error updating playlist', 'error');
    }
  }

  async function deletePlaylist(id, name) {
    if (!confirm(`Are you sure you want to delete playlist "${name}"?`)) return;
    try {
      const res = await fetch(`/api/playlists/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Playlist deleted', 'success');
        state.playlists = state.playlists.filter(p => p.id !== id);
        if (state.currentPlaylistId === id) {
          state.currentPlaylistId = 'all';
        }
        renderPlaylists();
        renderCurrentView();
      } else {
        showToast(data.message || 'Cannot delete playlist', 'error');
      }
    } catch (e) {
      showToast('Error deleting playlist', 'error');
    }
  }

  async function addTrackToPlaylist(playlistId, trackId) {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Added to playlist!', 'success');
        const pl = state.playlists.find(p => p.id === playlistId);
        if (pl) {
          if (!pl.trackIds) pl.trackIds = [];
          if (!pl.trackIds.includes(trackId)) pl.trackIds.unshift(trackId);
        }
        renderPlaylists();
        if (state.currentPlaylistId === playlistId) renderCurrentView();
        addToPlaylistModal.classList.remove('open');
      }
    } catch (e) {
      showToast('Error adding track to playlist', 'error');
    }
  }

  async function removeTrackFromPlaylist(playlistId, trackId) {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast('Removed from playlist', 'success');
        const pl = state.playlists.find(p => p.id === playlistId);
        if (pl && pl.trackIds) {
          pl.trackIds = pl.trackIds.filter(id => id !== trackId);
        }
        renderPlaylists();
        renderCurrentView();
      }
    } catch (e) {
      showToast('Error removing track from playlist', 'error');
    }
  }

  async function toggleTrackFavorite(trackId) {
    try {
      const res = await fetch(`/api/tracks/${trackId}/favorite`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.isFavorite ? 'Saved to Liked Songs' : 'Removed from Liked Songs', 'success');
        const t = state.tracks.find(x => x.id === trackId);
        if (t) t.isFavorite = data.isFavorite;

        const favPl = state.playlists.find(p => p.id === 'favorites');
        if (favPl) favPl.trackIds = data.trackIds;

        const cur = player.getCurrentTrack();
        if (cur && cur.id === trackId) {
          cur.isFavorite = data.isFavorite;
          if (btnPlayerFav) btnPlayerFav.classList.toggle('active', data.isFavorite);
        }

        renderPlaylists();
        renderCurrentView();
      }
    } catch (e) {
      showToast('Error updating favorite', 'error');
    }
  }

  function openAddToPlaylistModal(track) {
    state.selectedTrackForPlaylist = track;
    const thumb = document.getElementById('addToPlaylistThumb');
    const title = document.getElementById('addToPlaylistTitle');
    const artist = document.getElementById('addToPlaylistArtist');
    const list = document.getElementById('playlistSelectionList');

    if (thumb) thumb.src = track.thumbnail || '/public/images/default-track.svg';
    if (title) title.textContent = track.title;
    if (artist) artist.textContent = track.artist;

    const customPlaylists = state.playlists.filter(p => p.id !== 'default');

    if (customPlaylists.length === 0) {
      list.innerHTML = `
        <div style="font-size:13px; color:var(--text-secondary); padding:10px 0; text-align:center;">
          No custom playlists yet. Create one first!
        </div>
      `;
    } else {
      list.innerHTML = customPlaylists.map(pl => {
        const contains = pl.trackIds && pl.trackIds.includes(track.id);
        return `
          <div class="playlist-select-item" data-id="${pl.id}">
            <div class="pl-info">
              <div style="width:32px;height:32px;border-radius:4px;background:#282828;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                ${pl.cover ? `<img src="${pl.cover}" style="width:100%;height:100%;object-fit:cover;"/>` : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`}
              </div>
              <div>
                <div class="pl-name">${escapeHtml(pl.name)}</div>
                <div class="pl-count">${(pl.trackIds || []).length} songs</div>
              </div>
            </div>
            <button class="btn-pill ${contains ? 'btn-secondary' : 'btn-primary'} btn-toggle-pl-track" data-id="${pl.id}" style="padding:6px 14px; font-size:12px;">
              ${contains ? '✓ Added' : '+ Add'}
            </button>
          </div>
        `;
      }).join('');

      list.querySelectorAll('.btn-toggle-pl-track').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const plId = btn.getAttribute('data-id');
          const pl = state.playlists.find(p => p.id === plId);
          const contains = pl && pl.trackIds && pl.trackIds.includes(track.id);
          if (contains) {
            await removeTrackFromPlaylist(plId, track.id);
            btn.textContent = '+ Add';
            btn.className = 'btn-pill btn-primary btn-toggle-pl-track';
          } else {
            await addTrackToPlaylist(plId, track.id);
            btn.textContent = '✓ Added';
            btn.className = 'btn-pill btn-secondary btn-toggle-pl-track';
          }
        });
      });
    }

    addToPlaylistModal.classList.add('open');
  }

  // -------------------------------------------------------------
  // EVENT LISTENERS: UI & MODALS
  // -------------------------------------------------------------
  btnPlayerPlay.addEventListener('click', () => player.togglePlay());
  btnHeroPlay.addEventListener('click', () => {
    const currentTrack = player.getCurrentTrack();
    if (currentTrack) {
      player.togglePlay();
    } else {
      const tracks = getFilteredTracks();
      if (tracks.length > 0) {
        player.setQueue(tracks, 0, true);
      }
    }
  });

  btnPlayerNext.addEventListener('click', () => player.next());
  btnPlayerPrev.addEventListener('click', () => player.prev());

  btnPlayerShuffle.addEventListener('click', () => {
    const isShuffle = player.toggleShuffle();
    btnPlayerShuffle.classList.toggle('active', isShuffle);
    showToast(isShuffle ? 'Shuffle ON' : 'Shuffle OFF');
  });

  btnPlayerRepeat.addEventListener('click', () => {
    const mode = player.toggleRepeat();
    btnPlayerRepeat.classList.toggle('active', mode !== 'off');
    showToast(`Repeat: ${mode.toUpperCase()}`);
  });

  // Favorite button on bottom player bar
  btnPlayerFav.addEventListener('click', async () => {
    const cur = player.getCurrentTrack();
    if (cur) {
      await toggleTrackFavorite(cur.id);
    }
  });

  // Seek bar click
  progressTrack.addEventListener('click', (e) => {
    const rect = progressTrack.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    player.seek(pos * 100);
  });

  // Volume slider click
  volumeTrack.addEventListener('click', (e) => {
    const rect = volumeTrack.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    player.setVolume(pos);
    volumeFill.style.width = `${pos * 100}%`;
  });

  btnMute.addEventListener('click', () => {
    const isMuted = player.toggleMute();
    volumeFill.style.width = isMuted ? '0%' : `${player.volume * 100}%`;
  });

  btnPlayerShare.addEventListener('click', () => {
    const current = player.getCurrentTrack();
    if (current) {
      shareModal.open(current);
    } else {
      showToast('No track is currently playing', 'error');
    }
  });

  if (btnToggleRightSidebar) {
    btnToggleRightSidebar.addEventListener('click', () => {
      rightSidebar.classList.toggle('collapsed');
    });
  }

  searchInput.addEventListener('input', (e) => {
    state.activeFilterQuery = e.target.value;
    renderCurrentView();
  });

  // Live Radio top bar button
  const btnOpenLiveRadio = document.getElementById('btnOpenLiveRadio');
  if (btnOpenLiveRadio) {
    btnOpenLiveRadio.addEventListener('click', () => {
      shareModal.open(player.getCurrentTrack());
    });
  }

  // Create Playlist Modals
  const btnSidebarCreatePlaylist = document.getElementById('btnSidebarCreatePlaylist');
  const btnCloseCreatePlaylist = document.getElementById('btnCloseCreatePlaylist');
  const btnCancelCreatePlaylist = document.getElementById('btnCancelCreatePlaylist');
  const btnSubmitCreatePlaylist = document.getElementById('btnSubmitCreatePlaylist');
  const newPlaylistName = document.getElementById('newPlaylistName');
  const newPlaylistDesc = document.getElementById('newPlaylistDesc');
  const newPlaylistCover = document.getElementById('newPlaylistCover');

  function openCreatePlaylist() {
    newPlaylistName.value = '';
    newPlaylistDesc.value = '';
    newPlaylistCover.value = '';
    createPlaylistModal.classList.add('open');
  }

  btnSidebarCreatePlaylist.addEventListener('click', openCreatePlaylist);
  btnHeroCreatePlaylist.addEventListener('click', openCreatePlaylist);
  btnCloseCreatePlaylist.addEventListener('click', () => createPlaylistModal.classList.remove('open'));
  btnCancelCreatePlaylist.addEventListener('click', () => createPlaylistModal.classList.remove('open'));

  btnSubmitCreatePlaylist.addEventListener('click', () => {
    const name = newPlaylistName.value.trim();
    if (!name) return showToast('Please enter a playlist name', 'error');
    createPlaylist(name, newPlaylistDesc.value, newPlaylistCover.value);
  });

  // Edit Playlist Modal
  const btnCloseEditPlaylist = document.getElementById('btnCloseEditPlaylist');
  const btnCancelEditPlaylist = document.getElementById('btnCancelEditPlaylist');
  const btnSubmitEditPlaylist = document.getElementById('btnSubmitEditPlaylist');
  const editPlaylistName = document.getElementById('editPlaylistName');
  const editPlaylistDesc = document.getElementById('editPlaylistDesc');
  const editPlaylistCover = document.getElementById('editPlaylistCover');

  btnHeroEditPlaylist.addEventListener('click', () => {
    const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
    if (!pl) return;
    editPlaylistName.value = pl.name;
    editPlaylistDesc.value = pl.description || '';
    editPlaylistCover.value = pl.cover || '';
    editPlaylistModal.classList.add('open');
  });

  btnCloseEditPlaylist.addEventListener('click', () => editPlaylistModal.classList.remove('open'));
  btnCancelEditPlaylist.addEventListener('click', () => editPlaylistModal.classList.remove('open'));

  btnSubmitEditPlaylist.addEventListener('click', () => {
    const name = editPlaylistName.value.trim();
    if (!name) return showToast('Please enter a playlist name', 'error');
    updatePlaylist(state.currentPlaylistId, name, editPlaylistDesc.value, editPlaylistCover.value);
  });

  // Delete Playlist Button in Hero
  btnHeroDeletePlaylist.addEventListener('click', () => {
    const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
    if (pl) deletePlaylist(pl.id, pl.name);
  });

  // Close Add to Playlist Modal
  const btnCloseAddToPlaylist = document.getElementById('btnCloseAddToPlaylist');
  if (btnCloseAddToPlaylist) {
    btnCloseAddToPlaylist.addEventListener('click', () => addToPlaylistModal.classList.remove('open'));
  }

  // Upload Modal
  const btnOpenUpload = document.getElementById('btnOpenUpload');
  const btnCloseUpload = document.getElementById('btnCloseUpload');
  const audioFileInput = document.getElementById('audioFileInput');
  const uploadDropzone = document.getElementById('uploadDropzone');
  const uploadProgressCard = document.getElementById('uploadProgressCard');
  const uploadProgressBar = document.getElementById('uploadProgressBar');

  btnOpenUpload.addEventListener('click', () => uploadModal.classList.add('open'));
  btnCloseUpload.addEventListener('click', () => uploadModal.classList.remove('open'));
  uploadDropzone.addEventListener('click', () => audioFileInput.click());

  uploadDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadDropzone.classList.add('dragover');
  });

  uploadDropzone.addEventListener('dragleave', () => uploadDropzone.classList.remove('dragover'));
  uploadDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadDropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  });

  audioFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesUpload(e.target.files);
    }
  });

  async function handleFilesUpload(files) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('audioFiles', files[i]);
    }

    uploadProgressCard.style.display = 'block';
    uploadProgressBar.style.width = '30%';

    try {
      uploadProgressBar.style.width = '70%';
      const res = await fetch('/api/tracks/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      uploadProgressBar.style.width = '100%';
      if (data.success) {
        showToast(`Uploaded ${data.tracks.length} track(s)!`, 'success');
        state.tracks.unshift(...data.tracks);
        renderCurrentView();
        renderPlaylists();
        setTimeout(() => {
          uploadModal.classList.remove('open');
          uploadProgressCard.style.display = 'none';
          uploadProgressBar.style.width = '0%';
        }, 600);
      } else {
        showToast(data.message || 'Upload failed', 'error');
        uploadProgressCard.style.display = 'none';
      }
    } catch (err) {
      console.error('Upload error:', err);
      showToast('Error uploading file', 'error');
      uploadProgressCard.style.display = 'none';
    }
  }

  // YouTube Import Modal
  const btnOpenYt = document.getElementById('btnOpenYt');
  const btnCloseYt = document.getElementById('btnCloseYt');
  const ytUrlInput = document.getElementById('ytUrlInput');
  const btnYtPreview = document.getElementById('btnYtPreview');
  const btnYtImport = document.getElementById('btnYtImport');
  const ytPreviewCard = document.getElementById('ytPreviewCard');
  const ytPreviewThumb = document.getElementById('ytPreviewThumb');
  const ytPreviewTitle = document.getElementById('ytPreviewTitle');
  const ytPreviewAuthor = document.getElementById('ytPreviewAuthor');
  const ytPreviewDuration = document.getElementById('ytPreviewDuration');
  const ytCacheCheckbox = document.getElementById('ytCacheCheckbox');

  btnOpenYt.addEventListener('click', () => ytModal.classList.add('open'));
  btnCloseYt.addEventListener('click', () => ytModal.classList.remove('open'));

  btnYtPreview.addEventListener('click', async () => {
    const url = ytUrlInput.value.trim();
    if (!url) return showToast('Please enter a YouTube URL', 'error');

    btnYtPreview.disabled = true;
    btnYtPreview.innerHTML = `<div class="spinner"></div> Checking...`;

    try {
      const res = await fetch('/api/tracks/youtube-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      btnYtPreview.disabled = false;
      btnYtPreview.textContent = 'Preview';

      if (data.success) {
        ytPreviewCard.style.display = 'flex';
        if (data.info.isPlaylist) {
          ytPreviewTitle.textContent = data.info.playlistTitle || 'YouTube Playlist';
          ytPreviewAuthor.textContent = `${data.info.items.length} items`;
          ytPreviewThumb.src = data.info.items[0]?.thumbnail || '/public/images/default-track.svg';
          ytPreviewDuration.textContent = 'Playlist';
        } else {
          ytPreviewTitle.textContent = data.info.item.title;
          ytPreviewAuthor.textContent = data.info.item.artist;
          ytPreviewThumb.src = data.info.item.thumbnail;
          ytPreviewDuration.textContent = player.formatTime(data.info.item.duration);
        }
      } else {
        showToast(data.message || 'Could not fetch video info', 'error');
      }
    } catch (e) {
      btnYtPreview.disabled = false;
      btnYtPreview.textContent = 'Preview';
      showToast('Error connecting to YouTube helper', 'error');
    }
  });

  btnYtImport.addEventListener('click', async () => {
    const url = ytUrlInput.value.trim();
    if (!url) return showToast('Please enter a YouTube URL', 'error');

    btnYtImport.disabled = true;
    btnYtImport.innerHTML = `<div class="spinner"></div> Importing Audio...`;

    try {
      const res = await fetch('/api/tracks/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, download: ytCacheCheckbox.checked })
      });
      const data = await res.json();

      btnYtImport.disabled = false;
      btnYtImport.textContent = 'Add to Playlist';

      if (data.success) {
        showToast(data.message || 'YouTube stream added!', 'success');
        state.tracks.unshift(...data.tracks);
        renderCurrentView();
        renderPlaylists();
        ytModal.classList.remove('open');
        ytUrlInput.value = '';
        ytPreviewCard.style.display = 'none';
      } else {
        showToast(data.message || 'Failed to import YouTube track', 'error');
      }
    } catch (e) {
      btnYtImport.disabled = false;
      btnYtImport.textContent = 'Add to Playlist';
      showToast('Error importing YouTube stream', 'error');
    }
  });

  // Spotify Import Modal
  const btnOpenSpotify = document.getElementById('btnOpenSpotify');
  const btnCloseSpotify = document.getElementById('btnCloseSpotify');
  const spotifyUrlInput = document.getElementById('spotifyUrlInput');
  const btnSpotifyPreview = document.getElementById('btnSpotifyPreview');
  const btnSpotifyImport = document.getElementById('btnSpotifyImport');
  const spotifyPreviewCard = document.getElementById('spotifyPreviewCard');
  const spotifyPreviewThumb = document.getElementById('spotifyPreviewThumb');
  const spotifyPreviewTitle = document.getElementById('spotifyPreviewTitle');
  const spotifyPreviewAuthor = document.getElementById('spotifyPreviewAuthor');
  const spotifyPreviewCount = document.getElementById('spotifyPreviewCount');
  const spotifyCreatePlaylistCheckbox = document.getElementById('spotifyCreatePlaylistCheckbox');

  if (btnOpenSpotify) btnOpenSpotify.addEventListener('click', () => spotifyModal.classList.add('open'));
  if (btnCloseSpotify) btnCloseSpotify.addEventListener('click', () => spotifyModal.classList.remove('open'));

  if (btnSpotifyPreview) {
    btnSpotifyPreview.addEventListener('click', async () => {
      const url = spotifyUrlInput.value.trim();
      if (!url) return showToast('Please enter a Spotify URL', 'error');

      btnSpotifyPreview.disabled = true;
      btnSpotifyPreview.innerHTML = `<div class="spinner"></div> Checking...`;

      try {
        const res = await fetch('/api/tracks/spotify-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const data = await res.json();
        btnSpotifyPreview.disabled = false;
        btnSpotifyPreview.textContent = 'Preview';

        if (data.success) {
          spotifyPreviewCard.style.display = 'flex';
          spotifyPreviewTitle.textContent = data.details.title;
          spotifyPreviewAuthor.textContent = data.details.description || 'Spotify';
          spotifyPreviewThumb.src = data.details.cover || '/public/images/default-track.svg';
          spotifyPreviewCount.textContent = `${data.details.trackCount} track(s)`;
        } else {
          showToast(data.message || 'Could not inspect Spotify playlist', 'error');
        }
      } catch (e) {
        btnSpotifyPreview.disabled = false;
        btnSpotifyPreview.textContent = 'Preview';
        showToast('Error connecting to Spotify helper', 'error');
      }
    });
  }

  if (btnSpotifyImport) {
    btnSpotifyImport.addEventListener('click', async () => {
      const url = spotifyUrlInput.value.trim();
      if (!url) return showToast('Please enter a Spotify URL', 'error');

      btnSpotifyImport.disabled = true;
      btnSpotifyImport.innerHTML = `<div class="spinner"></div> Importing Spotify...`;

      try {
        const res = await fetch('/api/tracks/spotify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            createPlaylist: spotifyCreatePlaylistCheckbox.checked
          })
        });
        const data = await res.json();

        btnSpotifyImport.disabled = false;
        btnSpotifyImport.textContent = 'Import Playlist';

        if (data.success) {
          showToast(data.message, 'success');
          state.tracks.unshift(...data.tracks);
          if (data.playlist) {
            state.playlists.push(data.playlist);
            state.currentPlaylistId = data.playlist.id;
          }
          renderPlaylists();
          renderCurrentView();
          spotifyModal.classList.remove('open');
          spotifyUrlInput.value = '';
          spotifyPreviewCard.style.display = 'none';
        } else {
          showToast(data.message || 'Failed to import Spotify playlist', 'error');
        }
      } catch (e) {
        btnSpotifyImport.disabled = false;
        btnSpotifyImport.textContent = 'Import Playlist';
        showToast('Error importing Spotify playlist', 'error');
      }
    });
  }

  // Delete Track Global
  async function deleteTrack(trackId) {
    try {
      const res = await fetch(`/api/tracks/${trackId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Track deleted from library', 'success');
        state.tracks = state.tracks.filter(t => t.id !== trackId);
        state.playlists.forEach(pl => {
          if (pl.trackIds) pl.trackIds = pl.trackIds.filter(t => t !== trackId);
        });
        renderCurrentView();
        renderPlaylists();
      }
    } catch (e) {
      showToast('Error deleting track', 'error');
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Start Application
  loadInitialData();
});
