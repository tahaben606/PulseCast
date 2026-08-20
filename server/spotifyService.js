const path = require('path');
const { spawn } = require('child_process');

/**
 * Parse Spotify URL to extract type and ID
 */
function parseSpotifyUrl(url) {
  if (!url) return null;
  const cleanUrl = url.trim();

  // Match https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M or album / track
  const webMatch = cleanUrl.match(/open\.spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/);
  if (webMatch) {
    return { type: webMatch[1], id: webMatch[2] };
  }

  // Match spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
  const uriMatch = cleanUrl.match(/spotify:(playlist|album|track):([a-zA-Z0-9]+)/);
  if (uriMatch) {
    return { type: uriMatch[1], id: uriMatch[2] };
  }

  return null;
}

/**
 * Fetch and extract tracks & metadata from Spotify Embed HTML
 */
async function getSpotifyDetails(url) {
  const parsed = parseSpotifyUrl(url);
  if (!parsed) {
    throw new Error('Invalid Spotify URL. Please provide a valid Spotify playlist, album, or track link.');
  }

  const { type, id } = parsed;
  const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;

  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) {
    throw new Error(`Spotify request returned status ${response.status}`);
  }

  const html = await response.text();
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/);
  
  if (!nextDataMatch) {
    throw new Error('Unable to extract Spotify metadata. The playlist may be private or unavailable.');
  }

  const data = JSON.parse(nextDataMatch[1]);
  const entity = data.props?.pageProps?.state?.data?.entity;

  if (!entity) {
    throw new Error('Spotify playlist entity not found.');
  }

  const coverArt = entity.visualIdentity?.image?.[0]?.url || entity.coverArt?.sources?.[0]?.url || '';
  const playlistName = entity.name || entity.title || 'Spotify Playlist';
  const description = entity.subtitle || entity.description || 'Imported from Spotify';

  let tracks = [];

  // Single track
  if (type === 'track') {
    tracks.push({
      title: entity.name || entity.title || 'Unknown Title',
      artist: entity.artists?.[0]?.name || entity.subtitle || 'Unknown Artist',
      album: entity.album?.name || playlistName,
      duration: Math.round((entity.duration || 180000) / 1000),
      thumbnail: coverArt || '/public/images/default-track.png',
      spotifyUri: entity.uri,
      previewUrl: entity.audioPreview?.url || null
    });
  } 
  // Playlist or Album
  else if (Array.isArray(entity.trackList)) {
    tracks = entity.trackList.map(item => {
      const trackCover = item.visualIdentity?.image?.[0]?.url || coverArt || '/public/images/default-track.png';
      return {
        title: item.title || item.name || 'Unknown Track',
        artist: item.subtitle || item.artists?.[0]?.name || 'Unknown Artist',
        album: playlistName,
        duration: Math.round((item.duration || 180000) / 1000),
        thumbnail: trackCover,
        spotifyUri: item.uri,
        previewUrl: item.audioPreview?.url || null
      };
    });
  }

  return {
    type,
    id,
    title: playlistName,
    description,
    cover: coverArt,
    trackCount: tracks.length,
    tracks
  };
}

/**
 * Search YouTube via yt-dlp to find the closest match for a Spotify track
 */
function findYouTubeMatch(artist, title) {
  return new Promise((resolve) => {
    const query = `ytsearch1:${artist} - ${title} audio`;
    const args = ['--dump-single-json', '--flat-playlist', '--no-warnings', query];
    const process = spawn('yt-dlp', args, { windowsHide: true });
    let stdout = '';

    process.stdout.on('data', d => stdout += d.toString());
    process.on('close', code => {
      if (code === 0 && stdout.trim()) {
        try {
          const info = JSON.parse(stdout.trim());
          const entry = info.entries?.[0] || info;
          if (entry && entry.id) {
            return resolve({
              url: `https://www.youtube.com/watch?v=${entry.id}`,
              duration: Math.round(entry.duration || 0),
              thumbnail: entry.thumbnail || entry.thumbnails?.[0]?.url || ''
            });
          }
        } catch (e) {
          console.warn('Error parsing yt search result:', e);
        }
      }
      resolve(null);
    });

    process.on('error', () => resolve(null));
  });
}

module.exports = {
  parseSpotifyUrl,
  getSpotifyDetails,
  findYouTubeMatch
};
