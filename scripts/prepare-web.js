#!/usr/bin/env node
const { promises: fs } = require('fs');
const path = require('path');
let pngToIco = null;
let iconGen = null;

try {
  pngToIco = require('png-to-ico');
} catch (error) {
  console.warn('png-to-ico is not available; ICO generation will be skipped.');
}

try {
  iconGen = require('icon-gen');
} catch (error) {
  console.warn('icon-gen is not available; ICNS generation will be skipped.');
}

const root = process.cwd();
const dist = path.join(root, 'dist');

const sources = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'sw.js',
  'icons',
  'README.md'
];

const BASE64_ICONS = [
  { name: 'budget95-icon-64', file: 'budget95-icon-64x64.base64.txt' },
  { name: 'budget95-icon-192', file: 'budget95-icon-192x192.base64.txt' },
  { name: 'budget95-icon-512', file: 'budget95-icon-512x512.base64.txt' },
];

async function decodeIconPayloads() {
  const distIconsDir = path.join(dist, 'icons');
  await fs.mkdir(distIconsDir, { recursive: true });

  const generatedPngs = [];

  for (const icon of BASE64_ICONS) {
    const sourcePath = path.join(root, 'icons', icon.file);
    const targetPath = path.join(distIconsDir, `${icon.name}.png`);
    try {
      const raw = await fs.readFile(sourcePath, 'utf8');
      const trimmed = raw.trim();
      const base64 = trimmed.includes(',') ? trimmed.split(',').pop() : trimmed;
      const buffer = Buffer.from(base64, 'base64');
      await fs.writeFile(targetPath, buffer);
      generatedPngs.push(targetPath);
    } catch (error) {
      console.warn(`Unable to decode icon payload ${icon.file}:`, error);
    }
  }

  if (!generatedPngs.length) {
    return;
  }

  if (pngToIco) {
    const icoPath = path.join(distIconsDir, 'budget95.ico');
    try {
      const icoBuffer = await pngToIco(generatedPngs);
      await fs.writeFile(icoPath, icoBuffer);
    } catch (error) {
      console.warn('Unable to generate ICO icon:', error);
    }
  }

  if (iconGen) {
    try {
      await iconGen(generatedPngs[generatedPngs.length - 1], distIconsDir, {
        report: false,
        modes: ['icns'],
        names: { icns: 'budget95' },
      });
    } catch (error) {
      console.warn('Unable to generate ICNS icon:', error);
    }
  }
}

async function emptyDist() {
  try {
    await fs.rm(dist, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  await fs.mkdir(dist, { recursive: true });
}

async function copySource(srcRelative) {
  const src = path.join(root, srcRelative);
  const dest = path.join(dist, srcRelative);
  const stat = await fs.stat(src);

  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src);
    for (const entry of entries) {
      await copySource(path.join(srcRelative, entry));
    }
  } else {
    await fs.copyFile(src, dest);
  }
}

(async () => {
  try {
    await emptyDist();
    for (const item of sources) {
      await copySource(item);
    }
    await decodeIconPayloads();
    console.log('Web assets prepared in dist/');
  } catch (error) {
    console.error('Failed to prepare web assets:', error);
    process.exitCode = 1;
  }
})();
