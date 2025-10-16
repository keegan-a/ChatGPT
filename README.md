# Budget Builder 95

Welcome to **Budget Builder 95**, a nostalgic Windows 95-inspired budgeting playground. Follow the steps below to launch the app on your own computer using a Python virtual environment. The instructions assume **no prior experience**, so feel free to follow them line by line.

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

---

## 6. Retro desktop tips
- The **taskbar** keeps a button for every window. Click a button to bring its panel forward or to restore it if you minimized it.
- Tap the green **Start** button to open the Start menu. From there you can re-open closed windows, switch between the Windows 95, Windows Vista, or 2000s Macintosh aesthetics, and launch the hidden game.
- Try the **Classic Snake** Easter egg from the Start menu. Use the arrow keys to guide the snake once the Snake window is focused.
- If you close a panel accidentally, re-open it from the Start menu’s **Windows** section.
- On large screens you can drag window title bars or use the resize grips in the lower-right corner for a full retro desktop feel.
- Use the **Final Budget Showcase** button in the Categories window (or Start → Tools → 📊 Final Budget Showcase) to open a themed summary with export controls.
- Kick back with the **Activate Screensaver** option in Start → Tools to launch an animated 3D pipes homage. Move your mouse, tap, or press any key to return to work.
- Theme switching also updates wallpaper, window chrome, the Start bar, and Snake so each mode feels era-correct.

---

## 7. Save or share your final budget
- Open the Final Budget Showcase from the Categories window or Start → Tools.
- Review the scope-by-scope metrics, category highlights, and hero banner.
- Click **Save Showcase as PDF** to trigger your browser’s print dialog with a dedicated layout (only the showcase prints).
- You can also use your browser’s regular Print/Save-as-PDF shortcut. The page automatically switches to a clean print mode.

---

## 8. Install it like an app (desktop & mobile)
The project ships as a Progressive Web App (PWA) so you can “install” it with its retro icon.

**Desktop (Chrome/Edge/Brave):**
1. With the site open, look for the **Install** icon in the address bar (a monitor with a down arrow) and click it.
2. Confirm the prompt. A standalone window with taskbar/dock icon will appear.
3. Launch the app from your OS just like any other program.

**macOS Safari:** open the Share menu → **Add to Dock**.

**iOS & Android:**
1. Open the site in Safari (iOS) or Chrome (Android).
2. Use the Share menu → **Add to Home Screen** (iOS) or the overflow menu → **Install app** (Android).
3. The icon `BB95` will appear on your home screen and launch full screen.

The PWA works offline thanks to the bundled service worker, so the nostalgia desktop travels with you.

---

## 9. Package a desktop launcher (optional)
If you prefer a classic executable, use the included `desktop_launcher.py` script:

1. Activate your virtual environment (see Section 3).
2. Install PyInstaller (only needed once):
   ```bash
   pip install pyinstaller
   ```
3. Build the executable:
   ```bash
   pyinstaller --noconfirm --onefile --windowed desktop_launcher.py
   ```
4. Launch the generated file in `dist/desktop_launcher` (Windows/macOS/Linux builds are produced for your platform).

The launcher spins up a local server on an available port, opens the retro desktop in your default browser, and shuts down cleanly when you close it. You can also drop the generated executable onto a USB stick for an instant portable build.

---

## 10. Stop the server and exit the environment
- To stop the server, return to the terminal running `python -m http.server` and press `Ctrl + C`.
- To leave the virtual environment, type:
  ```bash
  deactivate
  ```

---

## 11. Customize or explore further
- Open `index.html`, `styles.css`, or `app.js` in your favorite code editor to tweak the layout, styling, or logic.
- Refresh the browser page after saving your changes to see the updates.

Have fun exploring the retro budgeting experience!
