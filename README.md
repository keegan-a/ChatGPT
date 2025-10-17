# Nostalgia Budget Suite

Nostalgia Budget Suite is a retro desktop budgeting sandbox that brings classic Windows and Macintosh aesthetics to modern personal finance planning. It ships with live window management, a Start menu, a printable showcase, and even a secret Snake arcade.

## Features

- **Authentic desktop UI:** Drag, resize, minimize, maximize, and reopen floating windows from the Start menu or taskbar.
- **Four nostalgia themes:** Windows 95, Windows XP, Windows Vista, and early 2000s Macintosh wallpapers, palettes, and chrome.
- **Mixed cadence budgeting:** Enter per-category daily, weekly, or monthly amounts without disrupting global scope toggles.
- **Advanced analytics:** Forecasts for 1, 6, 12, 24, 60, and 120 months, a health meter, milestone timeline, and savings goal planner.
- **Final showcase & export:** Curate a themed budget board with one-click print-to-PDF plus JSON import/export for power users.
- **Screensaver & easter eggs:** Smooth animated 3D Pipes screensaver and a hidden Snake game accessible from the Start menu.
- **Quality-of-life boosts:** Currency conversion, undo/redo history, quick templates, notifications, keyboard shortcuts, and more.

## Getting Started

### 1. Install Python (if you have not already)

Download Python 3.11+ from [python.org](https://www.python.org/downloads/) and be sure to tick the "Add Python to PATH" checkbox during installation on Windows.

### 2. Create & activate a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
.venv\\Scripts\\activate   # Windows PowerShell
```

### 3. Launch the local dev server

```bash
python -m http.server 8000
```

Visit <http://localhost:8000/index.html> in your browser. Avoid opening cached tabs; the service worker now updates itself automatically. If you see old visuals, refresh with <kbd>Ctrl</kbd> + <kbd>F5</kbd> (Windows) or <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd> (macOS).

### 4. Optional: Package as a desktop app

The project includes a lightweight launcher script that can be bundled with [PyInstaller](https://pyinstaller.org/). From an activated virtual environment:

```bash
pip install pyinstaller
pyinstaller desktop_launcher.py --noconfirm --windowed --name NostalgiaBudgetSuite --add-data "index.html;." --add-data "styles.css;." --add-data "app.js;." --add-data "manifest.json;." --add-data "sw.js;." --add-data "icons;icons"
```

The generated executable will include the embedded SVG icon. On macOS or Linux adjust the `--add-data` delimiter to `:`.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| <kbd>Ctrl</kbd> + <kbd>Space</kbd> | Toggle Start menu |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Jump to Final Showcase |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> | Toggle 3D Pipes screensaver |
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>N</kbd> | Open Notification Center |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo (via Start menu) |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> | Redo (via Start menu) |

## Testing the Experience

Open a second terminal window while the server is running and run:

```bash
curl -I http://localhost:8000/index.html
```

The response should include `200 OK` and the `nostalgia-budget-suite-v1` service worker cache version, verifying the current build is being served.

## Troubleshooting

- **Old layout still appears:** Clear browser storage (`Application` tab → `Storage` → `Clear site data`) or run `navigator.serviceWorker.getRegistrations().then(list => list.forEach(r => r.unregister()))` in the browser console, then refresh.
- **Binary assets not allowed:** All icons and wallpapers are embedded as data URIs. No binary downloads are necessary.
- **Exchange-rate API unavailable:** The app falls back to baked-in approximate rates and surfaces a notification if the request fails.

Enjoy budgeting like it is 1995 (or 2005, or 2007)!
