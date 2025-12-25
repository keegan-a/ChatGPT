# Capacitor configuration

## Environment-aware server URL

The Capacitor configuration resolves the server URL automatically based on the active environment:

- For production (`APP_ENV=production` or `NODE_ENV=production`), `server.url` defaults to the hosted origin (`https://app.production.example.com` by default) or the value supplied through `CAPACITOR_PRODUCTION_URL`/`APP_HOSTED_ORIGIN`.
- For other environments, no URL is injected so the previous live-reload behaviour continues to work when running locally.

You can override the server URL at any time by exporting `CAPACITOR_SERVER_URL` before running any Capacitor command. This is helpful when pointing a build at a staging environment:

```bash
export CAPACITOR_SERVER_URL="https://staging.example.com"
```

Run `npm run cap:init` after updating the environment variable to sync the configuration into the native Android and iOS projects. The script simply shells out to `npx cap sync`, ensuring the generated platform projects pick up the latest `capacitor.config.ts` server settings.
