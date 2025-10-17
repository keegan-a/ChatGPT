# Photoshop ICO Export Script

This repository contains an Adobe Photoshop ExtendScript that exports the active document as Windows icon files at common resolutions.

## Prerequisites
- Adobe Photoshop with scripting enabled.
- The free **ICO (Windows Icon) Format** plug-in (for example, the Telegraphics plug-in), which provides the `ICOFormatOptions` class required for `.ico` export.

## Usage
1. Install the ICO export plug-in and restart Photoshop.
2. Open the document you wish to convert.
3. Choose **File ▸ Scripts ▸ Browse…** and select `scripts/export_ico.jsx` from this repository.
4. Pick an output folder if prompted. The script creates `*_16.ico`, `*_32.ico`, `*_48.ico`, and `*_256.ico` files alongside the source document or in the chosen folder.

The script applies diffusion dithering with an 8-color indexed palette before saving each icon, helping preserve detail at small sizes.
