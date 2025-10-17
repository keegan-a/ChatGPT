#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');
const { build } = require('electron-builder');
const pkg = require('../package.json');

function runPrepare() {
  const result = spawnSync('node', [path.join(__dirname, 'prepare-web.js')], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error('prepare-web failed');
  }
}

function cloneBuildConfig() {
  return JSON.parse(JSON.stringify(pkg.build || {}));
}

(async () => {
  try {
    runPrepare();

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '')
      .replace(/\..*/, '');

    const config = cloneBuildConfig();
    const productName = config.productName || pkg.productName || pkg.name || 'app';

    const outputDir = path.posix.join('release', timestamp);
    config.directories = Object.assign({}, config.directories, { output: outputDir });

    const artifactBase = `${productName}-Setup-${timestamp}`;

    if (config.win) {
      config.win = Object.assign({}, config.win, {
        artifactName: `${artifactBase}-\${arch}.\${ext}`,
      });
    }

    if (config.mac) {
      config.mac = Object.assign({}, config.mac, {
        artifactName: `${artifactBase}-mac-\${arch}.\${ext}`,
      });
    }

    if (config.linux) {
      config.linux = Object.assign({}, config.linux, {
        artifactName: `${artifactBase}-linux-\${arch}.\${ext}`,
      });
    }

    console.log('Building desktop package to', outputDir);

    await build({ config });

    console.log('Desktop build completed at', outputDir);
  } catch (error) {
    console.error('Desktop packaging failed:', error);
    process.exitCode = 1;
  }
})();
