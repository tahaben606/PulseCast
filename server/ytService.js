const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('ffmpeg-static');

const CACHE_DIR = path.join(__dirname, '..', 'cache');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Execute yt-dlp with arguments and return stdout as string
 */
function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const process = spawn('yt-dlp', args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', data => {
      stdout += data.toString();
    });

    process.stderr.on('data', data => {
      stderr += data.toString();
    });

    process.on('close', code => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
      }
    });

    process.on('error', err => {
      reject(err);
    });
  });
}

/**
 * Get YouTube video or playlist metadata
 */
async function getYouTubeInfo(url) {
  try {
    const args = ['--dump-single-json', '--flat-playlist', '--no-warnings', url];
    const rawJson = await runYtDlp(args);
    const info = JSON.parse(rawJson);

    // If it's a playlist with entries
    if (info._type === 'playlist' && Array.isArray(info.entries)) {
      const items = info.entries.map(entry => {
        return {
          id: entry.id,
          title: entry.title || 'YouTube Track',
          artist: entry.uploader || entry.channel || 'YouTube',
          album: info.title || 'YouTube Playlist',
          duration: Math.round(entry.duration || 0),
          thumbnail: entry.thumbnail || (entry.thumbnails && entry.thumbnails.length > 0 ? entry.thumbnails[entry.thumbnails.length - 1].url : ''),
          url: entry.webpage_url || entry.url || `https://www.youtube.com/watch?v=${entry.id}`
        };
      });
      return { isPlaylist: true, playlistTitle: info.title, items };
    }

    // Single video
    const thumbnail = info.thumbnail || (info.thumbnails && info.thumbnails.length > 0 ? info.thumbnails[info.thumbnails.length - 1].url : '');
    return {
      isPlaylist: false,
      item: {
        id: info.id,
        title: info.title || 'YouTube Track',
        artist: info.uploader || info.channel || 'YouTube',
        album: 'YouTube Stream',
        duration: Math.round(info.duration || 0),
        thumbnail,
        url: info.webpage_url || url
      }
    };
  } catch (error) {
    console.error('Error fetching YouTube info:', error);
    throw error;
  }
}

/**
 * Download and extract audio as standard MP3 (192kbps) for game & player compatibility
 */
async function downloadAudioToCache(url, trackId) {
  const outputTemplate = path.join(CACHE_DIR, `${trackId}.%(ext)s`);
  
  const args = [
    '--ffmpeg-location', ffmpeg,
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '192K',
    '--no-part',
    '--no-playlist',
    '--no-warnings',
    '-o', outputTemplate,
    url
  ];

  await runYtDlp(args);

  // Check for the .mp3 file
  const mp3Path = path.join(CACHE_DIR, `${trackId}.mp3`);
  if (fs.existsSync(mp3Path)) {
    return path.join('cache', `${trackId}.mp3`);
  }

  // Fallback: search for any matching file in cache
  const files = fs.readdirSync(CACHE_DIR);
  const matchedFile = files.find(f => f.startsWith(trackId + '.'));
  if (matchedFile) {
    return path.join('cache', matchedFile);
  }
  return null;
}

module.exports = {
  getYouTubeInfo,
  downloadAudioToCache,
  CACHE_DIR
};
