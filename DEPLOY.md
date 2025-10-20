# Deployment & Packaging Guide

This document supplements the beginner-friendly README with deeper instructions for production deployments, store submissions, and continuous delivery.

---

## 1. Hosted web app (https://app.budgetbuilder95.com/)

### 1.1 Build locally
```bash
npm run build:web
```
Outputs a fresh `dist/` folder containing static assets, the PWA manifest, the service worker, and pdf.js helpers.

### 1.2 Deploy with AWS S3 + CloudFront
1. Install and configure the AWS CLI (`aws configure`).
2. Grant the IAM user permission for `s3:PutObject`, `s3:DeleteObject`, and `cloudfront:CreateInvalidation`.
3. Run:
   ```bash
   BUDGET95_DEPLOY_BUCKET=app.budgetbuilder95.com \
   BUDGET95_CLOUDFRONT_DISTRIBUTION_ID=E1234567890 \
   npm run deploy:web
   ```
   - The helper script runs `aws s3 sync dist/ s3://… --delete --cache-control max-age=31536000`.
   - If `BUDGET95_CLOUDFRONT_DISTRIBUTION_ID` is set, it automatically triggers an invalidation for `/*`.

### 1.3 Alternative hosts
- **Vercel / Netlify:** point them at the `dist/` directory after running `npm run build:web`.
- **Azure Static Web Apps / Firebase Hosting:** upload `dist/` directly; no server-side code is required.
- **Custom NGINX/Apache:** serve `dist/` over HTTPS with `index.html` as the default document.

Remember to proxy `/manifest.json`, `/sw.js`, and `/vendor/pdfjs/*` because the service worker expects them at the root.

---

## 2. Electron packaging

### 2.1 Environment variables
- `BUDGET95_HOSTED_ORIGIN` – override the production URL when building white-labelled versions.
- `BUDGET95_BUILD_TAG` – appended to logs and optional artifact renaming (defaults to ISO timestamp).
- `BUDGET95_SKIP_ICON_CHECK` – set to `1` to bypass icon verification (not recommended for real releases).
- `BUDGET95_SKIP_PDFJS_DOWNLOAD` – set to `1` when running without internet access; the PDF analyser will emit warnings.

### 2.2 Commands
- `npm run package:desktop` – NSIS EXE + DMG + AppImage.
- `npm run package:desktop:store` – adds MSIX and MAS builds.

All output lands inside `release/`. The script `scripts/clean-release.js` clears the folder between runs to avoid “file locked” errors on Windows.

### 2.3 Signing & notarisation checklist
| Platform | Step |
| --- | --- |
| Windows | Use `signtool.exe sign /fd SHA256 /a` on the generated `.exe` and `.msix`. Update the `publisher` and `identityName` fields in `package.json` to match your certificate subject. |
| macOS DMG | Codesign with your Developer ID Application certificate and notarise via `xcrun notarytool submit`. Run `xcrun stapler staple` afterwards. |
| macOS MAS | Submit the `mas-universal` app bundle through Xcode’s “Product → Archive” flow. Update entitlements in `electron/entitlements.mas*.plist` if you add new native capabilities. |

---

## 3. Capacitor mobile builds

### 3.1 Android
1. `npm run cap:init`
2. `npm run cap:open:android`
3. In Android Studio, configure your signing key (`Build → Generate Signed Bundle / APK`).
4. Generate an **AAB** for Play Store upload or an **APK** for sideloading.
5. Update the app ID/package name in `android/app/src/main/AndroidManifest.xml` if you fork the project.

### 3.2 iOS
1. `npm run cap:init`
2. `npm run cap:open:ios`
3. Select your development team in Xcode, then archive (`Product → Archive`).
4. Export an IPA via the Organizer or upload straight to App Store Connect.
5. The hosted origin is controlled by `BUDGET95_HOSTED_ORIGIN`; override it via an Xcode build setting or environment variable if you run staging builds.

### 3.3 Native plugin notes
- `@capacitor/share` powers the “Share my budget snapshot” Start menu action.
- `@capacitor/preferences` stores encrypted OpenAI credentials on-device.
- Add further plugins (biometrics, push notifications) by running `npm install @capacitor/<plugin>` and resyncing with `npm run cap:init`.

---

## 4. Continuous delivery

A GitHub Actions workflow lives in `.github/workflows/deploy.yml`:
- On pushes to `main`, it installs dependencies, runs `npm run build:web`, and (optionally) deploys to S3/CloudFront when the relevant secrets are configured.
- On tagged releases, it repeats the build on `windows-latest`, runs `npm run electron:build`, and uploads the `release/` folder as an artifact.

Required secrets:
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- `BUDGET95_DEPLOY_BUCKET`
- `BUDGET95_CLOUDFRONT_DISTRIBUTION_ID` (optional)

---

## 5. Troubleshooting checklist

| Symptom | Fix |
| --- | --- |
| `ERR_CONNECTION_REFUSED` when packaging Electron | The hosted origin was unreachable. Check your firewall and ensure `https://app.budgetbuilder95.com/` resolves. The app falls back to `offline.html` automatically if the network is down. |
| `output file is locked for writing` on Windows | Ensure antivirus exceptions cover the project folder, or rerun the build; `scripts/clean-release.js` now wipes `release/` before each packaging run. |
| `spawn EINVAL` from `child_process.spawn` | Resolved in `scripts/run-electron-build.js` by spawning Node with `shell:false`. Update your repository if you see this in older clones. |
| Capacitor app shows blank screen | Make sure `capacitor.config.ts` points to the correct `BUDGET95_HOSTED_ORIGIN`, and the device has network access. |
| Service worker not updating | Increment the `CACHE_NAME` inside `sw.js` and redeploy. Browsers sometimes retain older caches aggressively. |

---

Need more help? Open an issue or reach out using the security contact listed in `SECURITY.md`.
