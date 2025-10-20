# Icon assets

Binary icon files aren’t tracked in this repository so Codex/GitHub PRs stay text-only. You can either drop your own `budget95.ico`, `budget95.icns`, and `budget95-512.png` files into this directory or rely on the bundled base64-encoded sources that the build pipeline decodes automatically whenever you run `npm run prepare:web` or any packaging task.

| File name | Purpose |
|-----------|---------|
| `budget95.ico.base64` | Encoded Windows icon (produces `budget95.ico` at build time) |
| `budget95.icns.base64` | Encoded macOS icon (produces `budget95.icns`) |
| `budget95-512.png.base64` | Encoded 512×512 PNG used for Linux launchers |
| `budget95-icon.svg` | Inline SVG used in the PWA manifest and Start menu |

If you’d like to ship different artwork there are two paths:

* **Provide binaries directly.** Replace `budget95.ico`, `budget95.icns`, and `budget95-512.png` in this folder with your own files (they are git-ignored). The preparation script will copy them into the build outputs as-is.
* **Maintain text-friendly sources.** Convert each asset to base64 (`base64 my-icon.ico > budget95.ico.base64`) and replace the corresponding `.base64` text file. Re-run `npm run prepare:web` so the decoded outputs refresh under `dist/icons/` and `build/icons/`.

During development you can skip validation entirely by setting `BUDGET95_SKIP_ICON_CHECK=1`, but leaving either the binaries or the `.base64` fallbacks in place ensures installers always include the proper imagery.
