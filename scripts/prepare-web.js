#!/usr/bin/env node
const fsSync = require('fs');
const { promises: fs } = fsSync;
const { pipeline } = require('stream');
const { promisify } = require('util');
const https = require('https');
const path = require('path');

const root = process.cwd();
const dist = path.join(root, 'dist');
const rootVendorDir = path.join(root, 'vendor', 'pdfjs');
const distVendorDir = path.join(dist, 'vendor', 'pdfjs');
const streamPipeline = promisify(pipeline);

const sources = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'sw.js',
  'README.md',
  'vendor'
];

const REQUIRED_ICON_FILES = [
  'budget95.ico',
  'budget95.icns',
  'budget95-512.png'
];

async function copyIcons() {
  const srcIconsDir = path.join(root, 'icons');
  const distIconsDir = path.join(dist, 'icons');

  let srcIconsStat;
  try {
    srcIconsStat = await fs.stat(srcIconsDir);
  } catch (error) {
    if (process.env.BUDGET95_STRICT_ICON_MODE === '1') {
      throw new Error('Missing icons directory. Add your icon files to ./icons before packaging.');
    }
    console.warn('No ./icons directory detected. Skipping icon copy step and falling back to default Electron artwork.');
    return;
  }

  if (!srcIconsStat.isDirectory()) {
    throw new Error('icons path is not a directory');
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

  if (missing.length && process.env.BUDGET95_STRICT_ICON_MODE === '1') {
    throw new Error(`Missing required icon assets: ${missing.join(', ')}. Place the files in ./icons before running packaging commands.`);
  }

  if (missing.length) {
    console.warn(`Icon files missing (${missing.join(', ')}). Electron Builder will use its default icons unless you add replacements to ./icons.`);
  }
}

async function ensurePdfjsAsset(fileName, url) {
  const targetPath = path.join(rootVendorDir, fileName);

  try {
    const stat = await fs.stat(targetPath);
    if (stat.isFile() && stat.size > 0) {
      return targetPath;
    }
  } catch (error) {
    // Continue to download when the file does not exist.
  }

  if (process.env.BUDGET95_SKIP_PDFJS_DOWNLOAD === '1') {
    console.warn(`Warning: missing ${fileName}. Create vendor/pdfjs/${fileName} manually for full PDF support.`);
    await fs.mkdir(rootVendorDir, { recursive: true });
    const placeholder = `console.warn('PDF.js asset ${fileName} is missing. Install dependencies and run npm run prepare:web without BUDGET95_SKIP_PDFJS_DOWNLOAD to enable PDF parsing.');`;
    await fs.writeFile(targetPath, placeholder, 'utf8');
    return targetPath;
  }

  console.log(`Downloading ${fileName} from ${url}...`);

  await fs.mkdir(rootVendorDir, { recursive: true });

  await new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${fileName}: ${response.statusCode} ${response.statusMessage}`));
        response.resume();
        return;
      }

      const tempPath = `${targetPath}.download`;
      const fileStream = fsSync.createWriteStream(tempPath);

      streamPipeline(response, fileStream)
        .then(async () => {
          await fs.rename(tempPath, targetPath);
          resolve();
        })
        .catch(reject);
    });

    request.on('error', reject);
  });

  return targetPath;
}

async function ensurePdfjsAssets() {
  const assets = [
    {
      name: 'pdf.min.js',
      url: process.env.BUDGET95_PDFJS_CORE_URL || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.min.js',
    },
    {
      name: 'pdf.worker.min.js',
      url: process.env.BUDGET95_PDFJS_WORKER_URL || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js',
    },
  ];

  await fs.mkdir(rootVendorDir, { recursive: true });
  await fs.mkdir(distVendorDir, { recursive: true });

  const created = [];
  for (const asset of assets) {
    const sourcePath = await ensurePdfjsAsset(asset.name, asset.url);
    const destPath = path.join(distVendorDir, asset.name);
    await fs.copyFile(sourcePath, destPath);
    created.push(destPath);
  }

  return created;
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
    await ensurePdfjsAssets();
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
