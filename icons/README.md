# Icon assets

To keep the repository binary-free while still enabling native packaging, provide your own icon artwork before running any Electron or Capacitor build commands.

Place the following files inside this directory:

| File name | Purpose | Suggested size |
|-----------|---------|----------------|
| `budget95.ico` | Windows installer/shortcut icon | Multi-resolution (include 16/32/48/256 within the ICO) |
| `budget95.icns` | macOS installer/dock icon | Multi-resolution ICNS |
| `budget95-512.png` | Base PNG used for Linux launchers and as a fallback | 512×512 transparent PNG |

Additional PNG sizes (e.g., 192×192, 128×128) are welcome; everything in this folder is copied into `dist/icons/` during the build.

> **Tip:** You can export these formats from design tools such as Figma, Affinity Designer, or Photoshop. Online converters like [icoconvert.com](https://icoconvert.com/) can transform a 512×512 PNG into `.ico` and `.icns` files if your editor does not export them directly.

Once the files are in place, run:

```bash
npm run prepare:web
```

The packaging commands (`npm run package:desktop`, `npm run package:android`, `npm run package:ios`) depend on the presence of these files. The script halts with a clear error if anything is missing, so you will never accidentally ship an installer without artwork.
