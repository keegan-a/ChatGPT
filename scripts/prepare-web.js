#!/usr/bin/env node
const { promises: fs } = require('fs');
const path = require('path');

const root = process.cwd();
const dist = path.join(root, 'dist');

const sources = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'sw.js',
  'README.md'
];

const REQUIRED_ICON_FILES = [
  'budget95.ico',
  'budget95.icns',
  'budget95-512.png'
];

async function copyIcons() {
  const srcIconsDir = path.join(root, 'icons');
  const distIconsDir = path.join(dist, 'icons');

  try {
    const stat = await fs.stat(srcIconsDir);
    if (!stat.isDirectory()) {
      throw new Error('icons path is not a directory');
    }
  } catch (error) {
    throw new Error('Missing icons directory. Add your icon files to ./icons before packaging.');
  }

  await fs.mkdir(distIconsDir, { recursive: true });

  const entries = await fs.readdir(srcIconsDir);
  await Promise.all(entries.map(async (entry) => {
    const src = path.join(srcIconsDir, entry);
    const dest = path.join(distIconsDir, entry);
    const stat = await fs.stat(src);
    if (stat.isFile()) {
      await fs.copyFile(src, dest);
    }
  }));

  const missing = [];
  for (const file of REQUIRED_ICON_FILES) {
    try {
      const stat = await fs.stat(path.join(distIconsDir, file));
      if (!stat.isFile()) {
        missing.push(file);
      }
    } catch (error) {
      missing.push(file);
    }
  }

  if (!missing.length) {
    return;
  }

  if (process.env.BUDGET95_SKIP_ICON_CHECK === '1') {
    console.warn(`Warning: missing icon assets (${missing.join(', ')}). Packaging commands will fail until you add them to ./icons.`);
    return;
  }

  throw new Error(`Missing required icon assets: ${missing.join(', ')}. Place the files in ./icons before running packaging commands.`);
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
    await copyIcons();
    console.log('Web assets prepared in dist/');
  } catch (error) {
    console.error('Failed to prepare web assets:', error);
    process.exitCode = 1;
  }
})();
