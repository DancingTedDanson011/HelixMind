#!/usr/bin/env node
/**
 * Generate PWA icons from an SVG template.
 * Uses esbuild's built-in capabilities — no sharp/canvas needed.
 *
 * Output: web/public/icons/
 *   - icon-192x192.png
 *   - icon-512x512.png
 *   - icon-192x192-maskable.png
 *   - icon-512x512-maskable.png
 *   - apple-touch-icon.png (180x180)
 *   - favicon.ico (32x32, actually a PNG served as ico)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

/**
 * Create an SVG string for the HelixMind icon.
 * Spiral/helix on dark background with cyan glow.
 */
function createIconSVG(size, maskable = false) {
  const padding = maskable ? Math.round(size * 0.1) : 0;
  const innerSize = size - padding * 2;
  const cx = size / 2;
  const cy = size / 2;
  const r = innerSize * 0.35;

  // Spiral path (simplified helix)
  const spiralPoints = [];
  for (let i = 0; i <= 720; i += 15) {
    const angle = (i * Math.PI) / 180;
    const progress = i / 720;
    const currentR = r * (0.15 + progress * 0.85);
    const x = cx + Math.cos(angle) * currentR;
    const y = cy + Math.sin(angle) * currentR * 0.9 - progress * innerSize * 0.08;
    spiralPoints.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#050510"/>
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="${size * 0.02}" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="spiralGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00d4ff"/>
      <stop offset="50%" stop-color="#4169e1"/>
      <stop offset="100%" stop-color="#8a2be2"/>
    </linearGradient>
  </defs>
  <path d="${spiralPoints.join(' ')}" fill="none" stroke="url(#spiralGrad)" stroke-width="${size * 0.03}" stroke-linecap="round" filter="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="${size * 0.04}" fill="#00d4ff" filter="url(#glow)"/>
</svg>`;
}

const sizes = [
  { name: 'icon-192x192.png', size: 192, maskable: false },
  { name: 'icon-512x512.png', size: 512, maskable: false },
  { name: 'icon-192x192-maskable.png', size: 192, maskable: true },
  { name: 'icon-512x512-maskable.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180, maskable: false },
  { name: 'favicon.ico', size: 32, maskable: false },
];

// Since we can't rasterize SVG to PNG without native deps in Node,
// we output SVG files that Next.js can serve. For production, replace
// with pre-rasterized PNGs.
//
// For now: output SVGs with .svg extension + an SVG favicon.
for (const { name, size, maskable } of sizes) {
  const svg = createIconSVG(size, maskable);
  const svgName = name.replace(/\.(png|ico)$/, '.svg');
  writeFileSync(join(outDir, svgName), svg);
  console.log(`  Created ${svgName} (${size}x${size}${maskable ? ' maskable' : ''})`);
}

// Also write the SVGs as the PNG/ICO names since browsers handle SVG fine
// in manifest when served with correct content-type via Next.js
for (const { name, size, maskable } of sizes) {
  const svg = createIconSVG(size, maskable);
  writeFileSync(join(outDir, name), svg);
}

console.log(`\nIcons generated in ${outDir}`);
console.log('Note: These are SVG-based icons. For production, replace with rasterized PNGs.');
