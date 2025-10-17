# Budget95 Icons

The icon assets are generated automatically from the embedded base64 payloads in `scripts/prepare-web.js`.

Running `npm run prepare:web` decodes those payloads into real PNG files (for example `icons/budget95-icon-512.png` and `icons/budget95-icon-256.png`). The script then writes the decoded images to `dist/icons/` and uses [`icon-gen`](https://www.npmjs.com/package/icon-gen) to build the platform specific wrappers:

- `icons/budget95-icon.ico` for Windows builds
- `icons/budget95-icon.icns` for macOS builds

`electron-builder` is configured to read the generated files directly from `dist/icons/`, so the build no longer needs base64 blobs. If you need to refresh the artwork, update the base64 payloads in the script and re-run the prepare step.
