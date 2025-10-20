# Budget Builder 95

Budget Builder 95 is a retro-flavoured budgeting studio that blends Windows 95, Windows XP Bliss, Windows Vista, and 2000s Macintosh themes into a single productivity playground. You can plan budgets, map real bank statements with AI assistance, log journal entries on a calendar, and even sneak in a round of classic Snake. This guide walks through everything from the very first command prompt all the way to shipping store-ready installers.

> **New in this release** – the desktop and mobile shells now load the hosted web experience at **https://app.budgetbuilder95.com/**. You still get an offline screen, a robust PWA service worker, native sharing via Capacitor, and optional secure storage for your OpenAI key.

---

## 1. Prerequisites (no experience required)

1. **Install Node.js 18 or newer**
   - Go to [https://nodejs.org/en/download](https://nodejs.org/en/download) and grab the LTS installer for your platform.
   - On Windows, leave “Automatically install the necessary tools” checked.
   - After installation, open a new command prompt/terminal and confirm:
     ```bash
     node --version
     npm --version
     ```
2. **Install Git (optional but recommended)**
   - Download from [https://git-scm.com/downloads](https://git-scm.com/downloads).
   - Verify with `git --version`.
3. **Install Python 3 (optional)**
   - Only required if you prefer using the legacy `desktop_launcher.py` helper.
   - Download from [https://www.python.org/downloads/](https://www.python.org/downloads/) and tick “Add python.exe to PATH” during installation.

---

## 2. Grab the project

These steps work exactly the same on Windows (Command Prompt), macOS (Terminal), or Linux shells.

```bash
cd path\to\where\you\want\the\project
# Clone the repository
git clone https://github.com/your-account/budget-desktop-suite.git
cd budget-desktop-suite

# Install Node dependencies
npm install
```

> If your shell cannot use `git`, download the project ZIP from GitHub, unzip it, then `cd` into the extracted folder before running `npm install`.

---

## 3. Provide the icon artwork **before building installers**

The repository stays binary-free, so you must supply three files locally:

| Required file | Where to place it | Purpose |
| --- | --- | --- |
| `budget95.ico` | `icons/budget95.ico` | Windows taskbar & installer icon |
| `budget95.icns` | `icons/budget95.icns` | macOS dock/icon |
| `budget95-512.png` | `icons/budget95-512.png` | High-resolution PWA & Linux icon |

If you do not have custom artwork yet, keep the provided Base64 text files and decode them with your favourite tool, or follow the steps in `icons/README.md`.

Run the build scripts **after** these files are in place so Electron Builder and the PWA manifest can pick them up automatically.

---

## 4. Daily development flows

### 4.1 Preview the hosted desktop in a browser

```bash
npm run dev
```

This command:
1. Copies the latest assets into `dist/` (`npm run prepare:web`).
2. Starts a tiny static server at [http://localhost:8000](http://localhost:8000).
3. Registers the service worker (outside of localhost) with offline caching and an `offline.html` fallback.

Stop the server with `Ctrl + C`.

Prefer Python? Run `python desktop_launcher.py` to open the hosted origin directly, or add `--serve-local` to spin up a local preview without leaving the terminal.

### 4.2 Electron developer mode

```bash
npm run electron:dev
```

- Loads the hosted origin when the app is packaged, but in dev it still points at `http://localhost:8000/` so you can iterate quickly.
- Use `BUDGET95_DEV_SERVER=http://localhost:8000 npm run electron:dev` to point at a different dev server if needed.

### 4.3 Mobile shells with Capacitor

```bash
npm run cap:init        # Sync web assets into native projects
npm run cap:add:android # Run once to generate the Android project
npm run cap:add:ios     # Run once to generate the iOS project
```

To open the native IDEs:
```bash
npm run cap:open:android
npm run cap:open:ios
```

By default both platforms load the production origin `https://app.budgetbuilder95.com/`. To test against a local dev server set:
```bash
BUDGET95_CAP_USE_LOCAL=1 BUDGET95_DEV_SERVER=http://your-machine:8000 npm run cap:init
```

---

## 5. Deploying the hosted web app

1. Build the static bundle:
   ```bash
   npm run build:web
   ```
2. Deploy to your S3 bucket + CloudFront distribution (requires the AWS CLI to be configured):
   ```bash
   BUDGET95_DEPLOY_BUCKET=app.budgetbuilder95.com \
   BUDGET95_CLOUDFRONT_DISTRIBUTION_ID=YOUR_DISTRIBUTION_ID \
   npm run deploy:web
   ```

The helper script simply calls `aws s3 sync` and optionally issues a CloudFront invalidation. Adapt it for Azure Static Web Apps, Netlify, Vercel, or any other provider if you prefer; the `dist/` folder is completely static.

Further guidance lives in [DEPLOY.md](DEPLOY.md).

---

## 6. Packaging desktop installers

### 6.1 Quick build for friends (NSIS EXE + Linux AppImage)

```bash
npm run package:desktop
```

Results appear under `release/`:
- `BudgetBuilder95 Setup 1.0.0-x64.exe` (plus an ARM64 sibling) – simple double-click installer for Windows.
- `BudgetBuilder95-1.0.0.AppImage` – portable Linux bundle.
- `BudgetBuilder95-1.0.0.dmg` – macOS disk image signed by you (see below for notarisation).

If Windows Defender or another scanner keeps files locked, re-run the build; `scripts/run-electron-build.js` cleans the previous `release/` folder automatically.

> Building against a staging site? Prefix the command with `BUDGET95_HOSTED_ORIGIN=https://staging.budgetbuilder95.com/` so Electron and Capacitor shells point to the right origin.

### 6.2 Store-ready bundles (MSIX + Mac App Store)

```bash
npm run package:desktop:store
```

What you get:
- **Windows MSIX** in addition to NSIS, using the placeholder publisher information in `package.json`. Replace `publisher` and `identityName` with your actual certificate subject.
- **macOS MAS** target in `release/mas-universal/` along with the DMG. The entitlements live in `electron/entitlements.mas*.plist` – customise them before submitting to Apple.

### 6.3 Notarisation and signing

- **Windows:** Use `signtool.exe` on the generated `.exe`/`.msix` packages. Document the certificate thumbprint in `DEPLOY.md` for teammates.
- **macOS:** Export `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`, then run notarisation (`xcrun notarytool submit …`). Hardened runtime entitlements are already configured.

More detailed, step-by-step instructions (including antivirus troubleshooting) live in [DEPLOY.md](DEPLOY.md).

---

## 7. Packaging mobile apps

### 7.1 Android (APK/AAB)

```bash
npm run package:android
```

This wraps the hosted web app inside an Android WebView. Before uploading to the Play Store:
1. Create a signing keystore and register it with Android Studio (see `DEPLOY.md`).
2. Update `android/app/src/main/AndroidManifest.xml` if you add Capacitor plugins requiring extra permissions.

### 7.2 iOS (IPA)

```bash
npm run package:ios
```

Open Xcode, supply your Apple developer team, and follow the prompts to archive/notarise. The `CapacitorConfig` already points to the hosted origin; offline caching is handled by the service worker inside the web bundle.

### 7.3 Native capability checklist

To satisfy Apple guideline 4.2, the app integrates:
- **Native sharing** (`@capacitor/share`) – triggered from the Start menu (“📤 Share my budget snapshot”).
- **Secure storage bridge** (`@capacitor/preferences`) – your encrypted OpenAI key is mirrored into device storage when available.

You can extend this with biometrics, push notifications, or secure storage integrations; see the Capacitor docs linked in `DEPLOY.md`.

---

## 8. Offline experience & security

- The service worker precaches the core shell plus `offline.html` and `offline.css`. Any navigation failure shows a friendly “Waiting for dial-up…” screen.
- Electron enforces a strict Content Security Policy (no `unsafe-inline` or `unsafe-eval`) via session headers.
- The web app mirrors that CSP through a `<meta>` tag and keeps external origins to `https://api.openai.com` plus Google Fonts.
- API keys stored through “Remember my key” are encrypted in the browser and mirrored to native secure storage where available.
- The offline banner in the web UI highlights connectivity status and offers a quick “Retry now” button.

Full details live in [SECURITY.md](SECURITY.md).

---

## 9. AI budgeting assistant quick start

1. Open the **Spending Mapper** window from the Start menu.
2. Drop in PDFs or multiple screenshots of your statements. The app now sends a detailed prompt to OpenAI (choose between GPT‑4o and GPT‑4o mini, or add your own model in the selector).
3. Optionally save your API key securely – you’ll be asked for a passphrase, and the session unlocks automatically while the window stays open.
4. Imported line items appear with cadence controls so you can push them directly into the main budget table.
5. Use the **Budget AI Co-Pilot** window for conversational follow-up questions; the history is trimmed after 10 exchanges to stay concise.

---

## 10. Additional documentation

- [DEPLOY.md](DEPLOY.md) – deep dive into hosting, signing, and continuous delivery.
- [SECURITY.md](SECURITY.md) – CSP breakdown, credential storage notes, and reporting instructions.
- [icons/README.md](icons/README.md) – tips for preparing ICO/ICNS/PNG variants if you want to keep the repository binary-free.

Have fun exploring – and don’t forget to hit the Start menu for the hidden Snake game and the retro 3D pipes screensaver! If you run into issues, open an issue on GitHub or email the team listed in `SECURITY.md`.
