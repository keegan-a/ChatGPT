# Deployment Guide

This project deploys the web client to [Vercel](https://vercel.com/). The same build artifacts are consumed by the Electron and Capacitor shells so that desktop and mobile releases stay aligned with the hosted origin.

## Environments

We maintain two environments:

| Environment | Git ref trigger | Vercel target | Purpose |
|-------------|-----------------|---------------|---------|
| `staging`   | Pushes to `main` | Preview deploy | QA verification and manual validation before mobile/desktop bundles are cut. |
| `production`| Tags matching `v*` | Production deploy | Public release synchronized with Electron/Capacitor shells. |

## Required environment variables

Set the following secrets in the repository (or organization) before running the workflow:

- `VERCEL_TOKEN` – Personal or team token with deploy permissions.
- `VERCEL_ORG_ID` – Vercel organization/team ID (omit for personal projects).
- `VERCEL_PROJECT_ID` – Project ID for this site.

For local usage you can export the same variables in your shell session.

```bash
export VERCEL_TOKEN=...      # required
export VERCEL_ORG_ID=...     # optional, but recommended for teams
export VERCEL_PROJECT_ID=... # optional, locks deploys to a single project
```

## CLI commands

Install dependencies once:

```bash
npm install
```

Build the web assets:

```bash
npm run build:web
```

Deploy to staging (preview) manually:

```bash
npm run deploy:web -- --environment=staging
```

Deploy to production manually:

```bash
npm run deploy:web -- --environment=production
```

The deployment script wraps the Vercel CLI, so standard flags (for example `--debug`) can be appended after the environment switch.

## Automated rollout

The GitHub Actions workflow in `.github/workflows/deploy.yml` keeps the hosted origin synchronized with our native shells:

1. `main` pushes trigger a staging deploy. QA teams can validate the preview URL before freezing desktop/mobile builds.
2. Creating a tag that matches `v*` (for example `v1.4.0`) triggers a production deploy. Tagging should happen only after staging has been signed off and Electron/Capacitor release branches have been cut.
3. Production tags should also be used to version the Electron and Capacitor shells. Ensure the tag you push corresponds to the bundle versions that will ship to stores.

If a deploy needs to be rolled back, re-tag the last known-good release (e.g., `git tag v1.3.1 <commit>` and `git push --force origin v1.3.1`). This will redeploy the previous version and allows the native shells to stay consistent with the hosted build.

## Keeping shells in sync

- Always update Electron and Capacitor dependencies to point at the production tag before publishing binaries.
- When testing native builds against staging, configure them to load the preview deployment URL emitted by the workflow (visible in the Actions run summary).
- After promoting to production, bump the native shell configuration to the new production URL and rebuild the binaries.

Following this process ensures the hosted site and packaged applications reference the same artifact hashes and avoids cache mismatches between web and native clients.
