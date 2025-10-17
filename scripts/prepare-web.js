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
  'icons',
  'README.md'
];

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
    console.log('Web assets prepared in dist/');
  } catch (error) {
    console.error('Failed to prepare web assets:', error);
    process.exitCode = 1;
  }
})();
