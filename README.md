# ChatGPT Web Deployment Guide

This project includes an offline-ready web bundle driven by a service worker (`sw.js`) and a preparation script (`scripts/prepare-web.js`). The steps below walk through producing a hosted build, deploying it for direct download, and shipping it to web app stores.

## 1. Build the hosted bundle
1. Generate your production web build (for example, `npm run build:web`). Ensure the output lands in one of the standard directories (`dist/hosted`, `dist/web`, `dist`, `web-build/hosted`, `web-build`, `build/web`, or `build`).
2. Run the preparation script to copy the offline fallback page, derive the precache manifest, and emit a cache-versioned service worker:
   ```bash
   node scripts/prepare-web.js
   ```
   The script writes `sw.js` into the build directory, injects the offline page, and appends a versioned registration snippet to your HTML entry point so browsers download the latest service worker automatically.

## 2. Host the build for direct access or download
1. Upload the entire prepared build directory to your static hosting provider (Netlify, Vercel, GitHub Pages, S3 + CloudFront, etc.).
2. Configure the host to serve the generated `sw.js`, `offline.html`, and the rest of the build with long-lived caching, and enable HTTPS so the service worker can register.
3. Share the resulting HTTPS URL. Users can visit the link in any modern browser, and the service worker will precache assets and display `offline.html` whenever the network is unavailable.

## 3. Package for web app stores (PWA distribution)
Follow these steps to surface the experience in storefronts such as the Google Play Store or Microsoft Store:
1. **Verify PWA quality**
   - Confirm the deployed URL passes [https://web.dev/measure](https://web.dev/measure) (Lighthouse) PWA audits: HTTPS, fast loading, `manifest.json` with icons, and a functioning service worker (the generated `sw.js`).
   - Ensure the offline fallback page provides a branded, actionable experience for offline users.
2. **Generate store-ready packages**
   - Use [PWABuilder](https://www.pwabuilder.com/) or `npm init @bubblewrap` to create Android (Trusted Web Activity) and Windows Store packages. Supply your hosted HTTPS URL and follow the wizard to produce signed binaries.
3. **Publish to stores**
   - For Google Play: create a new app in the Play Console, upload the generated Android App Bundle (AAB), complete the content rating and listing, then submit for review.
   - For Microsoft Store: submit the PWABuilder-generated package through the Partner Center, providing the store listing details and pricing.
4. **Maintain updates**
   - Each time you rebuild, rerun `node scripts/prepare-web.js` so the cache version changes. Redeploy the updated build, then republish store packages if required.

## 4. Automate deployments (optional)
- Integrate the preparation script into your CI pipeline, e.g. as a post-build step in GitHub Actions.
- After CI uploads the build to your host, trigger PWABuilder CLI or Bubblewrap to refresh the store packages.

With these steps, the app remains installable, offline-capable, and discoverable via direct download links or major web app marketplaces.
