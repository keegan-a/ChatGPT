#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const rootDir = path.resolve(__dirname, '..', 'dist');
const port = Number(process.env.BUDGET95_DEV_PORT) || 8000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
  fs.createReadStream(filePath).pipe(res);
}

function sendNotFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let filePath = decodeURIComponent(parsed.pathname || '/');

  if (filePath.endsWith('/')) {
    filePath = path.join(filePath, 'index.html');
  }

  const resolved = path.join(rootDir, filePath);
  if (!resolved.startsWith(rootDir)) {
    sendNotFound(res);
    return;
  }

  fs.stat(resolved, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      if (parsed.pathname === '/' || parsed.pathname === '') {
        const fallback = path.join(rootDir, 'index.html');
        fs.stat(fallback, (fallbackErr, fallbackStat) => {
          if (!fallbackErr && fallbackStat.isFile()) {
            sendFile(res, fallback);
          } else {
            sendNotFound(res);
          }
        });
      } else {
        sendNotFound(res);
      }
      return;
    }
    sendFile(res, resolved);
  });
});

server.listen(port, () => {
  console.log(`Budget Builder 95 dev server running at http://localhost:${port}/`);
  console.log(`Serving files from ${rootDir}`);
});
