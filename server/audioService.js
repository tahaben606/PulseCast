const path = require('path');
const fs = require('fs');
const mm = require('music-metadata');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const COVERS_DIR = path.join(UPLOADS_DIR, 'covers');

// Ensure directories exist
if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

async function extractAudioMetadata(filePath, originalFilename, trackId) {
  try {
    const metadata = await mm.parseFile(filePath);
    const { common, format } = metadata;

    const title = common.title && common.title.trim() 
      ? common.title.trim() 
      : path.parse(originalFilename).name;

    const artist = common.artist && common.artist.trim() 
      ? common.artist.trim() 
      : (common.albumartist && common.albumartist.trim() ? common.albumartist.trim() : 'Unknown Artist');

    const album = common.album && common.album.trim() 
      ? common.album.trim() 
      : 'Local Upload';

    const duration = format.duration ? Math.round(format.duration) : 0;

    let thumbnail = '';
    if (common.picture && common.picture.length > 0) {
      const picture = common.picture[0];
      const ext = picture.format === 'image/png' ? 'png' : 'jpg';
      const coverFileName = `${trackId}.${ext}`;
      const coverFilePath = path.join(COVERS_DIR, coverFileName);
      fs.writeFileSync(coverFilePath, picture.data);
      thumbnail = `/uploads/covers/${coverFileName}`;
    }

    return {
      title,
      artist,
      album,
      duration,
      thumbnail
    };
  } catch (error) {
    console.warn(`Could not extract ID3 metadata for ${originalFilename}:`, error.message);
    return {
      title: path.parse(originalFilename).name,
      artist: 'Unknown Artist',
      album: 'Local Upload',
      duration: 0,
      thumbnail: ''
    };
  }
}

module.exports = {
  extractAudioMetadata
};
