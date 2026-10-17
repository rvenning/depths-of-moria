/** Generates the app icons from an original SVG emblem. Run: npm run icons */
import { writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const emblem = (pad: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#2a2f3d"/><stop offset="1" stop-color="#0b0c10"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4dc98"/><stop offset="1" stop-color="#b88f3a"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="60%" r="50%"><stop offset="0" stop-color="#ffb347" stop-opacity="0.95"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - pad * 2) / 512})">
    <path d="M96 440 L96 210 C96 120 170 70 256 70 C342 70 416 120 416 210 L416 440 Z" fill="#05060a" stroke="url(#gold)" stroke-width="16" stroke-linejoin="round"/>
    <path d="M140 440 L140 220 C140 150 192 112 256 112 C320 112 372 150 372 220 L372 440 Z" fill="#12141c" stroke="#8a6e32" stroke-width="6"/>
    <circle cx="256" cy="330" r="120" fill="url(#glow)"/>
    <path d="M256 250 C214 296 226 340 256 364 C286 340 298 296 256 250 Z" fill="url(#gold)" stroke="#0b0a0e" stroke-width="8" stroke-linejoin="round"/>
    <path d="M256 296 C240 320 246 338 256 350 C266 338 272 320 256 296 Z" fill="#fff2b0"/>
    <path d="M96 440 L416 440" stroke="url(#gold)" stroke-width="16" stroke-linecap="round"/>
    <path d="M176 180 L336 180" stroke="#8a6e32" stroke-width="5" stroke-linecap="round"/>
  </g>
</svg>`;

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon.svg', emblem(0));
const png = async (name: string, size: number, pad: number) => {
  await sharp(Buffer.from(emblem(pad))).resize(size, size).png().toFile(`public/icons/${name}`);
};
await png('icon-192.png', 192, 0);
await png('icon-512.png', 512, 0);
await png('maskable-512.png', 512, 64);
await png('apple-touch-icon.png', 180, 0);
writeFileSync('public/manifest.webmanifest', JSON.stringify({
  name: 'The Fellowship: Depths of Moria',
  short_name: 'Depths of Moria',
  description: 'A long-form fantasy auto-battler. Private fan-game concept.',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'landscape',
  background_color: '#0d0e12',
  theme_color: '#0d0e12',
  categories: ['games'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
  ],
}, null, 2));
console.log('icons written');
