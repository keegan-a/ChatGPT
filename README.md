# Dither Studio

A monochrome desktop application for exploring over forty dithering and halftone modulation algorithms. The interface is inspired by the provided reference screenshots with grouped controls, sliders paired with numeric values, and dark panels.

## Features

- Load any raster image and preview changes in real time thanks to a background processing queue and down-scaled preview renders.
- Choose from a variety of error-diffusion and modulation algorithms including Floyd–Steinberg, Jarvis–Judice–Ninke, row/column modulation, circuit modulation, tilt modulation, and more.
- Adjust threshold, amplitude, frequency, period, slope, glow, noise, sharpening, and per-channel colour scaling.
- Optional two-colour palette mapping plus RGB channel scaling (0–200%) to experiment beyond greyscale.
- Glow, sharpen, and noise controls for creative treatments.
- Zoomable preview with Control + mouse wheel and full-resolution rendering on demand.
- Save and load presets for the entire control stack.

## Getting started

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows use `.venv\\Scripts\\activate`
pip install -r requirements.txt
python -m app.main
```

## Performance notes

- Real-time previews are rendered against a down-scaled copy of the original image while full-resolution renders are dispatched on demand.
- All heavy lifting is handled with NumPy arrays for vectorised operations.
- The processing pipeline runs on a small thread pool so the UI remains responsive, even for large source images.

## Presets

Preset files are stored as JSON documents. By default they live inside `~/.dither_studio/presets`. Use the toolbar buttons to save or load your favourite configurations.
