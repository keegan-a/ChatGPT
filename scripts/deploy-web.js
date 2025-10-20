#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const distDir = path.resolve(__dirname, '..', 'dist');
const bucket = process.env.BUDGET95_DEPLOY_BUCKET;
const distribution = process.env.BUDGET95_CLOUDFRONT_DISTRIBUTION_ID;

if (!bucket) {
  console.error('Missing S3 bucket. Set BUDGET95_DEPLOY_BUCKET to your target (e.g. app.budgetbuilder95.com).');
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  console.error('dist/ not found. Run npm run build:web first.');
  process.exit(1);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

(async () => {
  try {
    const syncArgs = [
      's3',
      'sync',
      distDir,
      `s3://${bucket}/`,
      '--delete',
      '--acl',
      'public-read',
      '--cache-control',
      'max-age=31536000,public',
    ];
    console.log(`Syncing ${distDir} to s3://${bucket}/`);
    await run('aws', syncArgs);

    if (distribution) {
      console.log(`Creating CloudFront invalidation for ${distribution}`);
      await run('aws', ['cloudfront', 'create-invalidation', '--distribution-id', distribution, '--paths', '/*']);
    }

    console.log('Web deployment complete.');
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exitCode = 1;
  }
})();
