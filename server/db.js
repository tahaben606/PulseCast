const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultData = {
  tracks: [],
  playlists: [
    {
      id: 'favorites',
      name: 'Liked Songs',
      description: 'Your favorite tracks in one place',
      cover: '/public/images/liked-cover.svg',
      trackIds: [],
      createdAt: new Date().toISOString()
    },
    {
      id: 'default',
      name: 'Main Library',
      description: 'All uploaded audio, YouTube & Spotify streams',
      cover: '',
      trackIds: [],
      createdAt: new Date().toISOString()
    }
  ]
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeDb(defaultData);
      return defaultData;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data.tracks) data.tracks = [];
    if (!data.playlists) data.playlists = defaultData.playlists;
    return data;
  } catch (err) {
    console.error('Error reading db.json, returning default data:', err);
    return defaultData;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing to db.json:', err);
  }
}

module.exports = {
  // --- TRACKS ---
  getAllTracks() {
    const db = readDb();
    return db.tracks;
  },

  getTrackById(id) {
    const db = readDb();
    return db.tracks.find(t => t.id === id);
  },

  addTrack(track) {
    const db = readDb();
    db.tracks.unshift(track);
    const defaultPlaylist = db.playlists.find(p => p.id === 'default');
    if (defaultPlaylist && !defaultPlaylist.trackIds.includes(track.id)) {
      defaultPlaylist.trackIds.unshift(track.id);
    }
    writeDb(db);
    return track;
  },

  updateTrack(id, updates) {
    const db = readDb();
    const index = db.tracks.findIndex(t => t.id === id);
    if (index !== -1) {
      db.tracks[index] = { ...db.tracks[index], ...updates };
      writeDb(db);
      return db.tracks[index];
    }
    return null;
  },

  incrementPlayCount(id) {
    const db = readDb();
    const track = db.tracks.find(t => t.id === id);
    if (track) {
      track.playCount = (track.playCount || 0) + 1;
      writeDb(db);
    }
    return track;
  },

  deleteTrack(id) {
    const db = readDb();
    const track = db.tracks.find(t => t.id === id);
    if (!track) return null;

    db.tracks = db.tracks.filter(t => t.id !== id);
    db.playlists.forEach(p => {
      p.trackIds = p.trackIds.filter(tid => tid !== id);
    });
    writeDb(db);
    return track;
  },

  // --- PLAYLISTS ---
  getAllPlaylists() {
    const db = readDb();
    return db.playlists.map(playlist => ({
      ...playlist,
      tracks: (playlist.trackIds || [])
        .map(tid => db.tracks.find(t => t.id === tid))
        .filter(Boolean)
    }));
  },

  getPlaylistById(id) {
    const db = readDb();
    const playlist = db.playlists.find(p => p.id === id);
    if (!playlist) return null;
    return {
      ...playlist,
      tracks: (playlist.trackIds || [])
        .map(tid => db.tracks.find(t => t.id === tid))
        .filter(Boolean)
    };
  },

  createPlaylist(name, description = '', cover = '') {
    const db = readDb();
    const newPlaylist = {
      id: 'pl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: name.trim(),
      description: description.trim(),
      cover: cover.trim(),
      trackIds: [],
      createdAt: new Date().toISOString()
    };
    db.playlists.push(newPlaylist);
    writeDb(db);
    return newPlaylist;
  },

  updatePlaylist(id, updates) {
    const db = readDb();
    const index = db.playlists.findIndex(p => p.id === id);
    if (index !== -1) {
      db.playlists[index] = {
        ...db.playlists[index],
        name: updates.name ? updates.name.trim() : db.playlists[index].name,
        description: updates.description !== undefined ? updates.description.trim() : db.playlists[index].description,
        cover: updates.cover !== undefined ? updates.cover.trim() : db.playlists[index].cover
      };
      writeDb(db);
      return db.playlists[index];
    }
    return null;
  },

  toggleFavorite(trackId) {
    const db = readDb();
    let favPlaylist = db.playlists.find(p => p.id === 'favorites');
    if (!favPlaylist) {
      favPlaylist = {
        id: 'favorites',
        name: 'Liked Songs',
        description: 'Your favorite tracks in one place',
        cover: '/public/images/liked-cover.svg',
        trackIds: [],
        createdAt: new Date().toISOString()
      };
      db.playlists.push(favPlaylist);
    }

    if (!favPlaylist.trackIds) favPlaylist.trackIds = [];
    const index = favPlaylist.trackIds.indexOf(trackId);
    let isFavorite = false;
    if (index === -1) {
      favPlaylist.trackIds.unshift(trackId);
      isFavorite = true;
    } else {
      favPlaylist.trackIds.splice(index, 1);
      isFavorite = false;
    }
    writeDb(db);
    return { isFavorite, trackIds: favPlaylist.trackIds };
  },

  isFavorite(trackId) {
    const db = readDb();
    const favPlaylist = db.playlists.find(p => p.id === 'favorites');
    return !!(favPlaylist && favPlaylist.trackIds && favPlaylist.trackIds.includes(trackId));
  },

  addTrackToPlaylist(playlistId, trackId) {
    const db = readDb();
    const playlist = db.playlists.find(p => p.id === playlistId);
    if (!playlist) return false;
    if (!playlist.trackIds) playlist.trackIds = [];
    if (!playlist.trackIds.includes(trackId)) {
      playlist.trackIds.unshift(trackId);
      writeDb(db);
      return true;
    }
    return true;
  },

  removeTrackFromPlaylist(playlistId, trackId) {
    const db = readDb();
    const playlist = db.playlists.find(p => p.id === playlistId);
    if (playlist && playlist.trackIds) {
      playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
      writeDb(db);
      return true;
    }
    return false;
  },

  deletePlaylist(id) {
    if (id === 'favorites' || id === 'default') return false;
    const db = readDb();
    db.playlists = db.playlists.filter(p => p.id !== id);
    writeDb(db);
    return true;
  }
};
