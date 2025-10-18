# Budget Builder 95

Welcome to **Budget Builder 95**, a nostalgic budgeting playground that shape-shifts between Windows 95, Windows XP Bliss, Windows Vista, and early 2000s Macintosh desktops. Follow the steps below to launch the app on your own computer using a Python virtual environment. The instructions assume **no prior experience**, so feel free to follow them line by line.

---

## 1. Install Python (if needed)
1. Open [python.org/downloads](https://www.python.org/downloads/).
2. Download the latest stable release for your operating system (Windows, macOS, or Linux).
3. Run the installer and, on Windows, make sure to check **"Add python.exe to PATH"** before clicking *Install Now*.

You can verify the installation afterwards:
```bash
python --version
```

---

## 2. Open a command prompt or terminal
- **Windows:** Press `Win + R`, type `cmd`, and press Enter.
- **macOS:** Open **Terminal** from Applications → Utilities.
- **Linux:** Launch your preferred terminal emulator.

Use the `cd` command to move into the folder that contains the project files (replace the path with where you saved the repository):
```bash
cd path\to\ChatGPT
```
> On macOS/Linux use forward slashes instead: `cd /path/to/ChatGPT`

---

## 3. Create and activate a virtual environment
A virtual environment keeps this project’s tools separate from the rest of your machine.

1. **Create** the environment (this makes a new `.venv` folder inside the project):
   ```bash
   python -m venv .venv
   ```
2. **Activate** the environment:
   - **Windows (Command Prompt):**
     ```bash
     .venv\Scripts\activate
     ```
   - **Windows (PowerShell):**
     ```powershell
     .venv\Scripts\Activate.ps1
     ```
   - **macOS/Linux:**
     ```bash
     source .venv/bin/activate
     ```

When the environment is active, you will see `(.venv)` at the beginning of your command prompt.

> This project uses only static files, so there are no extra packages to install. The virtual environment is still handy for keeping tools isolated.

---

## 4. Start a local web server
While the files can be opened directly in a browser, using a tiny local server keeps everything behaving like a real website.

From inside the project folder **with the virtual environment activated**, run:
```bash
python -m http.server 8000
```
If port `8000` is busy, pick another number (for example `python -m http.server 8080`).

You should see a message similar to:
```
Serving HTTP on :: port 8000 (http://[::]:8000/) ...
```
Keep this terminal window open while you use the app.

> **Fresh assets every time:** When you serve the project from `localhost`, any previously cached service workers are automatically cleared so you always load the latest layout.

---

## 5. View the app in your browser
1. Open your web browser (Chrome, Edge, Firefox, Safari, etc.).
2. Visit `http://localhost:8000` (or the alternate port you chose).
3. Click `index.html` in the file listing to launch **Budget Builder 95**.

You now have access to:
- Weekly income controls and Windows 95-inspired panels.
- Editable starter categories plus custom category creation.
- Per-category cadence settings (daily, weekly, or monthly) with automatic conversions.
- Future value forecasts across multiple timeframes.
- Scope toggles for daily, weekly, monthly, and yearly views.
- The Budget Insights window with live callouts, autosave controls, and quick resets.
- Auto theme cycling and keyboard shortcuts (`Ctrl` + `←`/`→`, `Ctrl` + `Shift` + `F`) for rapid navigation.
- A budget health gauge that shows how much of your income the plan is consuming.
- The Spending Mapper window for manual or AI-assisted transaction imports.
- Desktop icons that open Classic Snake or the AI co-pilot, mirroring a vintage OS desktop.
- The Financial Journal window for daily/weekly/monthly accountability and notes that sync with the AI assistant.
- Configurable OpenAI models plus encrypted API-key storage with unlock controls.

---

## 6. Retro desktop tips
- The **taskbar** keeps a button for every window. Click a button to bring its panel forward or to restore it if you minimized it.
- Desktop icons in the upper-left corner launch Classic Snake or the AI Budget Co-Pilot without diving into the Start menu.
- Tap the green **Start** button to open the Start menu. From there you can re-open closed windows, switch between the Windows 95, Windows XP Bliss, Windows Vista, or 2000s Macintosh aesthetics, jump into the Final Budget Showcase, launch the Classic Snake easter egg, or fire up the newly 3D-rendered Pipes screensaver.
- Window controls now mimic the original desktop experience—hover to see their labels, minimize panels to the taskbar, or double-click title bars to maximize and restore.
- The **Data tools** section of the Start menu lets you launch the Spending Mapper, cascade or tile every window, or toggle a focus mode that spotlights the active panel.
- Try the **Classic Snake** Easter egg from the Start menu. Use the arrow keys to guide the snake once the Snake window is focused.
- If you close a panel accidentally, re-open it from the Start menu’s **Windows** section.
- On large screens you can drag window title bars or use the resize grips in the lower-right corner for a full retro desktop feel.
- The **Budget Insights** panel surfaces top categories, savings rate, and suggestions. Use its reset button to jump back to the starter blueprint or toggle automatic theme cycling.

### Keyboard shortcuts & automation

- `Ctrl` + `←`/`→` cycles through the daily, weekly, monthly, and yearly scopes.
- `Ctrl` + `Shift` + `F` opens the Final Budget Showcase on demand.
- Toggle **Auto-cycle themes** in the Budget Insights window to rotate aesthetics every 45 seconds.
- Budgets now autosave locally—returning to the app restores your last plan unless you reset it.

### Spending Mapper & AI imports

- Open the **Spending Mapper** from Start → Data tools to paste plain-text statements or upload one or more screenshots and/or bank-statement PDFs.
- Manual lines work best in the format `Category - Amount - cadence`. Supported cadences include daily, weekly, monthly, biweekly (converted to weekly), and yearly (converted to monthly).
- To try AI assistance, paste (or restore) an OpenAI API key, load your files, fine-tune the **Analysis focus** field if you want extra guidance, and click **Analyze with AI**. When you enable **Remember this key on this device**, add a passphrase so the key is encrypted locally; use **Unlock saved key** with the same passphrase or **Forget saved key** to remove it.
- Pick the GPT model that suits your needs (for example GPT-4o for the richest analysis or GPT-4o mini for faster iterations) from the mapper panel or Start menu.
- The default prompt now asks the model to read every transaction, call out subscriptions like Adobe Creative Cloud by name, and infer cadence from how often a merchant appears. Add your own instructions in the field to emphasize edge cases or budgeting priorities.
- The analyzer can ingest multiple files at once. Images are sent directly to OpenAI, while PDFs are text-parsed locally via [pdf.js](https://mozilla.github.io/pdf.js/) before the excerpts are included in the request. A live internet connection is required for both the pdf.js loader and the OpenAI request; if either step fails you can still use manual entry.
- Map detected entries to existing categories or create new ones, then apply them individually or all at once.

### Financial journal & accountability

- Open the **Financial Journal** window to log daily victories, impulse purchases, or reflections. Switch between daily, weekly, and monthly scopes and click any calendar day to focus it.
- Journal entries autosave alongside your budget and appear in the right-hand list for quick editing or deletion.
- The AI mapper and co-pilot automatically consider recent journal entries, helping the model distinguish recurring habits from one-off events when it suggests budget tweaks.

### AI Budget Co-Pilot

- Launch the **AI Budget Co-Pilot** from the desktop icon or Start → Data tools to ask for clarifications, cleanup ideas, or savings strategies.
- The co-pilot reuses the OpenAI key you saved for the Spending Mapper and remembers the last several prompts so you can iterate quickly on follow-up questions.
- Replies stay concise (under roughly 180 words) and often include checklists you can apply manually inside the Categories Planner.

---

## 7. Capture your final budget showcase

- Open the **Final Budget Showcase** window from the Budget Pulse panel or via the Start menu whenever you’re happy with your numbers.
- The showcase auto-syncs with your latest inputs and renders a poster-style overview featuring theme-aware colors, scope insights, and category breakdowns.
- Click **Save showcase as PDF** to open a print-ready window. From there you can save to PDF, share, or print the layout for a real-world reminder of your plan.

## 8. Install Budget Builder 95 like an app

Budget Builder 95 ships as a Progressive Web App (PWA), so you can pin it to your desktop or phone home screen without extra tooling.

- **Desktop (Chrome / Edge):** With the app open, click the install icon in the address bar or open the browser menu → **Install Budget Builder 95**.
- **iOS Safari:** Tap the share button → **Add to Home Screen**.
- **Android Chrome:** Open the browser menu → **Install app**.

After installation you’ll see a custom retro icon and can launch the budgeting desktop directly without re-opening the browser.

## 9. Launch it like a desktop app (Python-free)

If you’d rather double-click an app icon without running commands every time, use the included launcher script once to generate a shortcut:

1. Make sure your virtual environment is active (see sections above).
2. From the project folder run:
   ```bash
   python desktop_launcher.py
   ```
3. Your default browser will open to the hosted app. Pass `--no-browser` if you want to launch the server silently and open the URL manually. You can also create a desktop shortcut to this script once you are happy with the setup.

## 10. Build native desktop installers with Electron

Use the bundled Electron configuration to generate `.exe`, `.dmg`, and `.AppImage` builds that run without a browser:

1. Install [Node.js](https://nodejs.org/) (version 18 or newer is recommended).
2. **Add your own icon files** to the `icons/` folder following the table in `icons/README.md` (minimum: `budget95.ico`, `budget95.icns`, `budget95-512.png`). These files are required for packaging but are not tracked in git so you can ship your personal artwork.
3. Inside the project folder run:
   ```bash
   npm install
   ```
   This installs Electron, electron-builder, and the Capacitor toolchain.
4. To preview the desktop shell (optional) launch the development build:
   ```bash
   npm run electron:dev
   ```
   The window falls back to the packaged assets automatically if you are not running `python -m http.server`.
5. Create installable packages with:
   ```bash
   npm run package:desktop
   ```
   The helper script prints the build tag it generated (for example `2025-01-17T21-44-03-712Z`) and feeds it to Electron Builder so every run lands in its own `release/<build-tag>/` directory with uniquely named installers. Double-click the file that matches your platform to install Budget Builder 95 permanently.

> **Icon tip:** `npm run prepare:web` copies whatever you place in `icons/` into `dist/icons/` and refuses to continue if the required files are missing. When you are hacking locally without icons you can temporarily run `BUDGET95_SKIP_ICON_CHECK=1 npm run prepare:web`, but packaging commands always enforce that the files exist.

### Troubleshooting locked installer files on Windows

If Electron Builder pauses with “output file is locked for writing,” work through these checks:

1. **Unique build tags are automatic.** Each run now uses a timestamped `BUDGET95_BUILD_TAG`, which means new filenames such as `BudgetBuilder95 Setup 1.0.0-arm64-2025-01-17T21-44-03-712Z.exe`. Windows Defender usually releases unique names instantly; if you need a predictable tag set `BUDGET95_BUILD_TAG=your-label npm run package:desktop`.
2. **The release directory is cleaned every time.** `scripts/clean-release.js` wipes the entire `release/` folder before Electron Builder runs so stale executables (or partially scanned artifacts) never linger. If the folder is held open in Explorer, close the window and rerun the command.
3. **Blockmap generation is disabled.** Windows installers are created without delta update metadata (`differentialPackage: false`), reducing the chance that antivirus hooks the file mid-build.
4. **Dry-run without Electron Builder when debugging.** Run `BUDGET95_SKIP_ELECTRON_BUILDER=1 npm run electron:build` to rebuild `dist/` and clean `release/` without touching the installer. Once the prep succeeds, rerun without the flag to generate the binaries.
5. **Whitelist or relocate the release folder if needed.** Some corporate antivirus tools keep scanning new `.exe` files. Add `release/` to your exclusions or point the output somewhere else: `BUDGET95_BUILD_TAG=mytemp npm run package:desktop` writes to `release/mytemp/`, which you can move outside monitored directories.

## 11. Package Android and iOS builds with Capacitor

Prefer native launchers on your phone? Capacitor wraps the same `dist/` bundle inside Android and iOS shells.

### One-time platform setup

```bash
npm install                    # already run for the desktop build step
npm run cap:add:android        # creates android/ with Gradle & icon assets
npm run cap:add:ios            # creates ios/ with an Xcode project (macOS only)
```

These commands install the official `@capacitor/android` and `@capacitor/ios` packages, generate the platform projects, and copy the prepared web assets automatically.

### Generate updated bundles

Whenever you change the web app, sync the native projects:

```bash
npm run cap:init               # rebuilds dist/ and copies it into android/ & ios/
```

### Build installable packages

- **Android:**
  ```bash
  npm run package:android      # produces a debug APK/AAB using the local Android SDK
  ```
  Open the generated Android Studio project (`npm run cap:open:android`) if you prefer a graphical build pipeline or need to create signed releases for the Play Store.

- **iOS (macOS required):**
  ```bash
  npm run package:ios          # triggers an Xcode build via Capacitor
  ```
  Launch the workspace in Xcode (`npm run cap:open:ios`) to archive the app, create signing certificates, or push the build to TestFlight.

Both platforms reuse the same retro icons and app metadata defined in `capacitor.config.json`. Update that file if you want to change the displayed app name, bundle IDs, or splash colors.

> **Quick alternative:** PWABuilder still works great if you prefer a web-only workflow. Point it at a hosted version of the app to download ready-made store bundles without maintaining native projects locally.

## 12. Stop the server and exit the environment
- To stop the server, return to the terminal running `python -m http.server` and press `Ctrl + C`.
- To leave the virtual environment, type:
  ```bash
  deactivate
  ```

---

## 13. Customize or explore further
- Open `index.html`, `styles.css`, or `app.js` in your favorite code editor to tweak the layout, styling, or logic.
- Refresh the browser page after saving your changes to see the updates.

Have fun exploring the retro budgeting experience!
