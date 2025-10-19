#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const buildRoot = await resolveBuildDirectory(projectRoot);
  if (!buildRoot) {
    console.warn('[prepare-web] No hosted web build directory found. Skipping service worker preparation.');
    return;
  }

  const offlineFileName = 'offline.html';
  await ensureOfflineFallback(projectRoot, buildRoot, offlineFileName);

  const precacheEntries = await collectPrecacheEntries(buildRoot);
  if (!precacheEntries.includes(offlineFileName) && (await fileExists(path.join(buildRoot, offlineFileName)))) {
    precacheEntries.push(offlineFileName);
  }

  precacheEntries.sort((a, b) => a.localeCompare(b));

  const cacheVersion = await createCacheVersion(buildRoot, precacheEntries);
  const swTemplatePath = path.join(projectRoot, 'sw.js');
  if (!(await fileExists(swTemplatePath))) {
    throw new Error(`[prepare-web] Service worker template not found at ${swTemplatePath}`);
  }
  const swTemplate = await fs.promises.readFile(swTemplatePath, 'utf8');
  const swOutput = injectManifest(swTemplate, precacheEntries, cacheVersion);

  const swOutputPath = path.join(buildRoot, 'sw.js');
  await fs.promises.writeFile(swOutputPath, swOutput);
  console.log(`[prepare-web] Wrote service worker with ${precacheEntries.length} precached assets (cache ${cacheVersion}).`);

  await ensureSwRegistration(buildRoot, cacheVersion);
}

async function resolveBuildDirectory(projectRoot) {
  const candidatePaths = [
    'dist/hosted',
    'dist/web',
    'dist',
    'web-build/hosted',
    'web-build',
    'build/web',
    'build',
  ].map((relativePath) => path.join(projectRoot, relativePath));

  for (const directory of candidatePaths) {
    if (await directoryExists(directory)) {
      return directory;
    }
  }
  return null;
}

async function ensureOfflineFallback(projectRoot, buildRoot, fileName) {
  const sourcePath = path.join(projectRoot, fileName);
  if (!(await fileExists(sourcePath))) {
    console.warn(`[prepare-web] Offline fallback (${fileName}) not found in project root.`);
    return;
  }
  const destinationPath = path.join(buildRoot, fileName);
  await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.promises.copyFile(sourcePath, destinationPath);
}

async function collectPrecacheEntries(buildRoot) {
  const results = [];
  await walkDirectory(buildRoot, async (absolutePath) => {
    const relative = path.relative(buildRoot, absolutePath).split(path.sep).join('/');
    if (!relative) {
      return;
    }
    if (shouldSkip(relative)) {
      return;
    }
    results.push(relative);
  });
  return Array.from(new Set(results));
}

function shouldSkip(relativePath) {
  const normalized = relativePath.toLowerCase();
  if (normalized === 'sw.js') {
    return true;
  }
  if (normalized.endsWith('.map')) {
    return true;
  }
  if (normalized === '.ds_store') {
    return true;
  }
  return false;
}

async function walkDirectory(directory, onFile) {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name)) {
          return;
        }
        await walkDirectory(fullPath, onFile);
        return;
      }
      if (entry.isFile()) {
        await onFile(fullPath);
      }
    })
  );
}

function shouldSkipDirectory(name) {
  if (name.startsWith('.')) {
    return name !== '.well-known';
  }
  return false;
}

async function createCacheVersion(buildRoot, precacheEntries) {
  const hash = crypto.createHash('sha256');
  for (const relative of precacheEntries) {
    const absolute = path.join(buildRoot, relative);
    try {
      const stats = await fs.promises.stat(absolute);
      hash.update(relative);
      hash.update(String(stats.size));
      hash.update(String(Math.floor(stats.mtimeMs)));
    } catch (error) {
      console.warn(`[prepare-web] Unable to stat ${relative} for cache versioning:`, error.message);
    }
  }
  return `v${hash.digest('hex').slice(0, 16)}`;
}

function injectManifest(template, entries, cacheVersion) {
  const manifestJson = JSON.stringify(entries);
  const manifestString = `'${manifestJson.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const versionString = `'${cacheVersion.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

  if (!template.includes("'__PRECACHE_MANIFEST__'")) {
    throw new Error('[prepare-web] Service worker template is missing the precache manifest placeholder.');
  }
  if (!template.includes("'__CACHE_VERSION__'")) {
    throw new Error('[prepare-web] Service worker template is missing the cache version placeholder.');
  }

  return template
    .replace(/'__PRECACHE_MANIFEST__'/g, manifestString)
    .replace(/'__CACHE_VERSION__'/g, versionString);
}

async function ensureSwRegistration(buildRoot, cacheVersion) {
  const htmlEntryCandidates = ['index.html', '200.html'];
  const registrationSnippetId = 'sw-register';
  const registrationSnippet =
    `<script id="${registrationSnippetId}">\n` +
    "  if ('serviceWorker' in navigator) {\n" +
    "    window.addEventListener('load', () => {\n" +
    "      const swUrl = new URL('sw.js', window.location.href);\n" +
    `      swUrl.searchParams.set('v', '${cacheVersion}');\n` +
    "      navigator.serviceWorker.register(swUrl.toString()).catch((error) => {\n" +
    "        console.error('[sw] Registration failed', error);\n" +
    "      });\n" +
    "    });\n" +
    "  }\n" +
    "</script>";

  for (const candidate of htmlEntryCandidates) {
    const htmlPath = path.join(buildRoot, candidate);
    if (!(await fileExists(htmlPath))) {
      continue;
    }
    let html = await fs.promises.readFile(htmlPath, 'utf8');
    if (html.includes('navigator.serviceWorker')) {
      continue;
    }
    if (html.includes(`<script id="${registrationSnippetId}">`)) {
      continue;
    }
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${registrationSnippet}\n</body>`);
    } else {
      html += `\n${registrationSnippet}\n`;
    }
    await fs.promises.writeFile(htmlPath, html);
    console.log(`[prepare-web] Injected service worker registration snippet into ${candidate}.`);
  }
}

async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

async function directoryExists(directoryPath) {
  try {
    const stats = await fs.promises.stat(directoryPath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

main().catch((error) => {
  console.error('[prepare-web] Failed:', error);
  process.exit(1);
});
