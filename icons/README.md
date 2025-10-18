# Icon assets

Binary icon files aren’t tracked in this repository so Codex/GitHub PRs stay text-only. Instead, the `icons/` folder contains base64-encoded sources that the build pipeline can decode into `.ico`, `.icns`, and `.png` files automatically whenever you run `npm run prepare:web` or any packaging task. If you already have finished artwork, drop the real files into this directory and the build will copy them directly—no conversion required.

| File name | Purpose |
|-----------|---------|
| `budget95.ico` / `budget95.ico.base64` | Windows icon (supply the `.ico` directly **or** keep the base64 text) |
| `budget95.icns` / `budget95.icns.base64` | macOS icon (binary or base64) |
| `budget95-512.png` / `budget95-512.png.base64` | 512×512 PNG used for Linux launchers |
| `budget95-icon.svg` | Inline SVG used in the PWA manifest and Start menu |

If you’d like to ship different artwork you can either:

* Drop your `.ico`, `.icns`, and `.png` files into this directory directly; the build will pick them up automatically.
* Or convert each file to base64 (`base64 my-icon.ico > budget95.ico.base64`) and store the text variants. The preparation script will decode them into binaries under `dist/icons/` and `build/icons/`.

During development you can still skip validation entirely by setting `BUDGET95_SKIP_ICON_CHECK=1`, but providing the raw icons (or their base64 equivalents) keeps the repository binary-free while still delivering polished installers.
