#!/usr/bin/env node
const fsSync = require('fs');
const { promises: fs } = fsSync;
const { pipeline } = require('stream');
const { promisify } = require('util');
const https = require('https');
const path = require('path');

const root = process.cwd();
const dist = path.join(root, 'dist');
const buildIconsDir = path.join(root, 'build', 'icons');
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

const ICON_REQUIREMENTS = [
  { filename: 'budget95.ico', base64: 'budget95.ico.base64' },
  { filename: 'budget95.icns', base64: 'budget95.icns.base64' },
  { filename: 'budget95-512.png', base64: 'budget95-512.png.base64' },
];

const STATIC_ICON_FILES = [
  'budget95-icon.svg',
];

async function materializeIcons() {
  const srcIconsDir = path.join(root, 'icons');
  const distIconsDir = path.join(dist, 'icons');

  await fs.mkdir(distIconsDir, { recursive: true });
  await fs.mkdir(buildIconsDir, { recursive: true });

  const missing = [];

  for (const { filename, base64 } of ICON_REQUIREMENTS) {
    const binarySource = path.join(srcIconsDir, filename);
    const base64Source = base64 ? path.join(srcIconsDir, base64) : null;

    let buffer = null;

    try {
      const stat = await fs.stat(binarySource);
      if (stat.isFile() && stat.size > 0) {
        buffer = await fs.readFile(binarySource);
      }
    } catch (error) {
      // Ignore missing binary icon and fall back to base64.
    }

    if (!buffer && base64Source) {
      try {
        const base64Content = await fs.readFile(base64Source, 'utf8');
        buffer = Buffer.from(base64Content.replace(/\s+/g, ''), 'base64');
      } catch (error) {
        if (process.env.BUDGET95_SKIP_ICON_CHECK === '1') {
          console.warn(`Warning: failed to read base64 icon ${base64Source}:`, error.message);
        } else {
          throw new Error(`Missing required icon asset ${filename} (expected ${binarySource} or ${base64Source}).`);
        }
      }
    }

    if (!buffer || !buffer.length) {
      if (process.env.BUDGET95_SKIP_ICON_CHECK === '1') {
        console.warn(`Warning: icon ${filename} is unavailable.`);
        missing.push(filename);
        continue;
      }
      throw new Error(`Missing required icon asset ${filename}. Provide ${binarySource} or ${base64Source}.`);
    }

    const targets = [
      path.join(distIconsDir, filename),
      path.join(buildIconsDir, filename),
    ];

    await Promise.all(targets.map(async (target) => {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, buffer);
    }));
  }

  const svgSources = await Promise.all(STATIC_ICON_FILES.map(async (filename) => {
    const src = path.join(srcIconsDir, filename);
    try {
      await fs.copyFile(src, path.join(distIconsDir, filename));
      await fs.copyFile(src, path.join(buildIconsDir, filename));
      return null;
    } catch (error) {
      if (process.env.BUDGET95_SKIP_ICON_CHECK === '1') {
        console.warn(`Warning: failed to copy ${filename}:`, error.message);
        return filename;
      }
      throw new Error(`Missing required icon asset ${filename}: ${error.message}`);
    }
  }));

  for (const value of svgSources) {
    if (value) {
      missing.push(value);
    }
  }

  if (missing.length && process.env.BUDGET95_SKIP_ICON_CHECK !== '1') {
    throw new Error(`Missing required icon assets: ${missing.join(', ')}`);
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
    await materializeIcons();
    console.log('Web assets prepared in dist/');
  } catch (error) {
    console.error('Failed to prepare web assets:', error);
    process.exitCode = 1;
  }
})();
