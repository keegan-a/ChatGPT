# Dither Studio

A monochrome desktop application for exploring over forty dithering and halftone modulation algorithms. The interface is inspired by the provided reference screenshots with grouped controls, sliders paired with numeric values, and dark panels.

## Features

- Load any raster image and preview changes in real time thanks to a background processing queue and down-scaled preview renders.
- Choose from a variety of error-diffusion and modulation algorithms including Floyd–Steinberg, Jarvis–Judice–Ninke, blue-noise clustering, stitch/grid weaves, spiral/line/dot screens, glitch strata, and more.
- Adjust threshold, amplitude, frequency, period, slope, rotation, glow, noise, sharpening, and per-channel colour scaling.
- Optional two-colour palette mapping plus RGB channel scaling (0–200%) to experiment beyond greyscale.
- Retro-inspired colour render modes spanning indexed 16/32/64/256 palettes, Game Boy, CGA/EGA, Commodore 64, Amiga, CMYK print simulations, neon vector glows, thermal printers, and more with adjustable palette blending and bit depth.
- Creative tone sculpting with gamma, contrast, saturation, hue shift, edge emphasis, vignette strength, invert, posterise, and original-image blend controls.
- Zoomable preview with Control + mouse wheel and full-resolution rendering on demand.
- Save and load presets for the entire control stack.

## Getting started

### 1. Install Python 3.10+

Any recent CPython release will work, but the UI has been tested most on Python 3.10 and 3.11.

### 2. Create and activate a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate
```

> [!TIP]
> On Windows (PowerShell) run ``.\.venv\Scripts\Activate.ps1`` instead.

### 3. Install dependencies

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

If you still see `ModuleNotFoundError: No module named 'PySide6'`, double-check that your shell is using the virtual environment and try `python -m pip install PySide6` manually.

### 4. Launch the application

```bash
python -m app
```

This command uses the module entry point so it works regardless of your current working directory inside the project.

### Troubleshooting

- **Linux Qt platform plugin errors** such as `Could not load the Qt platform plugin "xcb"` mean the system Qt libraries are missing. On Debian/Ubuntu run `sudo apt install libxcb-cursor0 libxkbcommon-x11-0`.
- **macOS Gatekeeper prompts** can appear the first time you launch a Qt application downloaded from the internet. Use System Settings → Privacy & Security to allow the app to run.
- **Blank window on macOS** usually indicates the Python process is running under Rosetta without the matching Qt binaries. Reinstall Python natively (ARM64 or x86_64) and reinstall the requirements.

Once the window opens you can load an image with the toolbar button and start experimenting with the controls.

## Performance notes

- Real-time previews are rendered against a down-scaled copy of the original image while full-resolution renders are dispatched on demand.
- All heavy lifting is handled with NumPy arrays for vectorised operations, with optional Numba-accelerated error diffusion for massive speed gains when `numba` is installed.
- The processing pipeline runs on a small thread pool so the UI remains responsive, even for large source images. Preview requests are coalesced so only the newest slider change is rendered.

## Presets

Preset files are stored as JSON documents. By default they live inside `~/.dither_studio/presets`. Use the toolbar buttons to save or load your favourite configurations.
