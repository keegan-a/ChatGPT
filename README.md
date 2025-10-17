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
- To try AI assistance, paste (or restore) an OpenAI API key, load your files, fine-tune the **Analysis focus** field if you want extra guidance, and click **Analyze with AI**. You can optionally enable **Remember this key on this device** to keep the key in local storage for future sessions—use the **Forget saved key** button to clear it at any time.
- The default prompt now asks the model to read every transaction, call out subscriptions like Adobe Creative Cloud by name, and infer cadence from how often a merchant appears. Add your own instructions in the field to emphasize edge cases or budgeting priorities.
- The analyzer can ingest multiple files at once. Images are sent directly to OpenAI, while PDFs are text-parsed locally via [pdf.js](https://mozilla.github.io/pdf.js/) before the excerpts are included in the request. A live internet connection is required for both the pdf.js loader and the OpenAI request; if either step fails you can still use manual entry.
- Map detected entries to existing categories or create new ones, then apply them individually or all at once.

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

Budget Builder 95 now ships as a Progressive Web App (PWA), so you can pin it to your desktop or phone home screen.

- **Desktop (Chrome / Edge):** With the app open, click the install icon in the address bar or open the browser menu → **Install Budget Builder 95**.
- **iOS Safari:** Tap the share button → **Add to Home Screen**.
- **Android Chrome:** Open the browser menu → **Install app**.

After installation you’ll see a custom retro icon and can launch the budgeting desktop directly without re-opening the browser.

## 9. Launch it like a desktop app (optional)

If you’d rather double-click an app icon, use the included launcher script:

1. Make sure your virtual environment is active (see sections above).
2. From the project folder run:
   ```bash
   python desktop_launcher.py
   ```
3. Your default browser will open to the hosted app. Pass `--no-browser` if you want to launch the server silently and open the URL manually.

## 10. Create native installers with Electron

For a command-prompt-free desktop experience, use the bundled Electron configuration to generate `.exe`, `.dmg`, and `.AppImage` builds:

1. Install [Node.js](https://nodejs.org/) (version 18 or newer is recommended).
2. Inside the project folder run:
   ```bash
   npm install
   ```
   This pulls in Electron, electron-builder, and Capacitor tooling.
3. Prepare the web assets (copies everything into `dist/`):
   ```bash
   npm run prepare:web
   ```
4. Start the desktop app in development mode (uses your running `python -m http.server` on port 8000 if available):
   ```bash
   npm run electron:dev
   ```
5. When you’re ready to ship installers, build them with:
   ```bash
   npm run electron:build
   ```
   The signed output lives in the `release/` folder and includes Windows `.exe` (NSIS installer), macOS `.dmg`, and Linux `.AppImage` packages. Double-click the appropriate file to install without touching the terminal.

> **Icon tip:** Electron automatically reads the retro icon from `icons/budget95-icon-512x512.base64.txt`. If you need a traditional `.ico` for Windows shortcuts, decode the base64 payload using the snippet in [icons/README](icons/README.md) or any base64-to-ICO converter.

## 11. Prepare Android/iOS shells with Capacitor

Prefer native launchers on your phone? The included Capacitor configuration wraps the same `dist/` bundle:

1. Ensure Node.js dependencies are installed (`npm install`).
2. Generate fresh web assets:
   ```bash
   npm run prepare:web
   ```
3. Sync Capacitor (creates the `android/` and `ios/` projects on first run):
   ```bash
   npm run cap:init
   ```
4. Open the native projects in their respective IDEs:
   ```bash
   npm run cap:open:android   # opens Android Studio for APK/AAB generation
   npm run cap:open:ios       # opens Xcode for iOS builds/TestFlight
   ```
5. From Android Studio or Xcode you can build signed releases, deploy to emulators, or sideload directly to your devices. Capacitor copies the retro icon and manifest metadata automatically—update `capacitor.config.json` if you want a different app name or bundle identifier.

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
