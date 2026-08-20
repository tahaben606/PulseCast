const fs = require('fs');
const path = require('path');

const imgDir = path.join(__dirname, '..', 'public', 'images');
if (!fs.existsSync(imgDir)) {
  fs.mkdirSync(imgDir, { recursive: true });
}

// 1x1 transparent/dark PNG fallback or SVG
// We can write a simple SVG-based data or write standard fallback images
const svgDefault = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
  <rect width="300" height="300" fill="#282828"/>
  <circle cx="150" cy="150" r="70" fill="#181818"/>
  <path d="M135 110v80l60-40z" fill="#1db954"/>
</svg>`;

const svgLiked = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#450af5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8e8ee5;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="300" height="300" fill="url(#grad)"/>
  <path d="M150 215l-14.5-13.2C84 154.4 50 123.6 50 85.5 50 54.4 74.4 30 105.5 30c17.6 0 34.5 8.2 44.5 21.1C160 38.2 176.9 30 194.5 30 225.6 30 250 54.4 250 85.5c0 38.1-34 68.9-85.5 116.3L150 215z" fill="#ffffff" transform="scale(0.8) translate(38, 38)"/>
</svg>`;

fs.writeFileSync(path.join(imgDir, 'default-track.svg'), svgDefault);
fs.writeFileSync(path.join(imgDir, 'liked-cover.svg'), svgLiked);

// Also copy SVG to .png fallback or serve with appropriate header
fs.writeFileSync(path.join(imgDir, 'default-track.png'), svgDefault);
fs.writeFileSync(path.join(imgDir, 'liked-cover.png'), svgLiked);

console.log('Default artwork assets created successfully.');
