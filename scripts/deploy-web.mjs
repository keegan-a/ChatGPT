#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const ARG_PREFIX = '--environment=';

function parseEnvironment(argv) {
  let envFromFlag;
  for (const arg of argv) {
    if (arg.startsWith(ARG_PREFIX)) {
      envFromFlag = arg.slice(ARG_PREFIX.length);
    } else if (arg === '--production') {
      envFromFlag = 'production';
    } else if (arg === '--staging') {
      envFromFlag = 'staging';
    }
  }

  const env = envFromFlag || process.env.DEPLOY_ENVIRONMENT || 'staging';
  if (!['staging', 'production'].includes(env)) {
    console.error(
      `Unknown deployment environment: "${env}". Expected "staging" or "production".`
    );
    process.exit(1);
  }

  return env;
}

function ensureEnv(variable) {
  const value = process.env[variable];
  if (!value) {
    console.error(`Missing required environment variable ${variable}.`);
    process.exit(1);
  }
  return value;
}

const environment = parseEnvironment(process.argv.slice(2));
const token = ensureEnv('VERCEL_TOKEN');
const orgId = process.env.VERCEL_ORG_ID;
const projectId = process.env.VERCEL_PROJECT_ID;

const cliArgs = ['vercel', 'deploy', '--yes', '--token', token];

if (orgId) {
  cliArgs.push('--scope', orgId);
}

if (projectId) {
  cliArgs.push('--project', projectId);
}

if (environment === 'production') {
  cliArgs.push('--prod');
} else {
  cliArgs.push('--meta', 'deployment=staging');
}

console.log(`Deploying to Vercel (${environment})...`);
const result = spawnSync('npx', cliArgs, {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
