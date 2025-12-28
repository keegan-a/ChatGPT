#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nodeCmd = process.execPath;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const spawnOptions = { stdio: 'inherit', shell: false, ...options };
    const child = spawn(command, args, spawnOptions);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

(async () => {
  const buildTag = process.env.BUDGET95_BUILD_TAG || new Date().toISOString().replace(/[:.]/g, '-');
  process.env.BUDGET95_BUILD_TAG = buildTag;
  console.log(`Using build tag: ${buildTag}`);

  try {
    const npmExecPath = process.env.npm_execpath;
    if (npmExecPath && npmExecPath.endsWith('.js')) {
      await run(nodeCmd, [npmExecPath, 'run', 'prepare:web'], {
        env: { ...process.env },
      });
    } else {
      await run(npmCmd, ['run', 'prepare:web'], {
        env: { ...process.env },
      });
    }

    await run(nodeCmd, [path.join(__dirname, 'clean-release.js')], {
      env: { ...process.env },
    });

    if (process.env.BUDGET95_SKIP_ELECTRON_BUILDER === '1') {
      console.log('Skipping electron-builder step because BUDGET95_SKIP_ELECTRON_BUILDER=1');
      return;
    }

    let electronBuilderCli;
    try {
      electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js');
    } catch (error) {
      console.error('Unable to locate electron-builder CLI. Make sure dependencies are installed.');
      throw error;
    }

    await run(nodeCmd, [electronBuilderCli], {
      env: { ...process.env },
    });
  } catch (error) {
    console.error('electron:build failed:', error.message);
    process.exitCode = 1;
  }
})();
