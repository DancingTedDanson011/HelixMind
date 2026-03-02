#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';

const compositions = [
  'HeroIntro',
  'ModesJarvis',
  'ModesAgent',
  'ModesMonitor',
  'SpiralMemory',
  'Brain3D',
  'GettingStarted',
  'FeaturesOverview',
];

const outDir = 'out';
if (!existsSync(outDir)) mkdirSync(outDir);

const is4k = process.argv.includes('--scale=4k');
const codec = process.argv.includes('--webm') ? 'vp9' : 'h264';
const ext = codec === 'vp9' ? 'webm' : 'mp4';

console.log(`\n🎬 Rendering ${compositions.length} compositions`);
console.log(`   Resolution: ${is4k ? '3840x2160 (4K)' : '3840x2160 (native 4K)'}`);
console.log(`   Codec: ${codec}\n`);

for (const comp of compositions) {
  const outFile = `${outDir}/${comp}.${ext}`;
  console.log(`▶ Rendering ${comp}...`);

  try {
    execSync(
      `npx remotion render src/index.ts ${comp} ${outFile} --codec=${codec} --concurrency=75%`,
      { stdio: 'inherit', cwd: process.cwd() },
    );
    console.log(`✓ ${comp} → ${outFile}\n`);
  } catch (err) {
    console.error(`✗ Failed: ${comp}\n`);
  }
}

console.log('🎬 All renders complete!');
