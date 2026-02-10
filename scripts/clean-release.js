#!/usr/bin/env node
const { promises: fs } = require('fs');
const path = require('path');

const releaseDir = path.join(process.cwd(), 'release');

(async () => {
  try {
    await fs.rm(releaseDir, { recursive: true, force: true });
    console.log('Cleared previous release output.');
  } catch (error) {
    console.warn('Unable to clear release directory:', error.message);
    process.exitCode = 1;
  }
})();
