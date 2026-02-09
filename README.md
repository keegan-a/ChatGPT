# Dithering Tool

Dithering Tool is a cross-platform desktop application that emulates the creative controls of high-end halftone plug-ins. It lets you compare an original image with its dithered counterpart, experiment with classic and retro palettes, and export the result in a single click.

## Highlights

- **Side-by-side preview** of the source and processed image with automatic scaling.
- **Extensive algorithm catalogue** including Floyd–Steinberg, Jarvis–Judice–Ninke, Stucki, Atkinson, Burkes, Sierra (2-row), Sierra Lite (2-4A), Bayer 2×2/4×4/8×8, Clustered Dot, and Random dithering.
- **Serpentine scanning toggle** for diffusion modes to reduce directional artefacts.
- **Palette management** with adaptive palettes, grayscale ramps, Game Boy, NES, CGA presets, and a custom palette loader (image or text).
- **Colour depth controls** via a “Number of Colors” spinner (2–64) that constrains the quantisation palette.
- **Image adjustments** for brightness, contrast, gamma, Gaussian blur, sharpening, and denoising applied before dithering.
- **Linear light processing** option to preserve brightness during error diffusion.
- **Transparency handling** so alpha channels can be preserved when saving PNGs.
- **Background rendering** with a responsive Qt interface and quick-save workflow.

## Requirements

- Python 3.10+
- The libraries listed in `requirements.txt` (NumPy, Pillow, PySide6, OpenCV, scikit-image, imageio).

Install the dependencies with:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## Running the application

1. (Optional) Create and activate a virtual environment.
2. Install the requirements as shown above.
3. Launch the UI:

```bash
python -m app
```

The window titled **“Dithering Tool”** will open. Click **Load Image…** to select a PNG, JPEG, GIF, or BMP. The preview updates automatically as you tweak settings. Use **Save Dithered Image…** to export the processed image (PNG, BMP, JPG, or GIF).

## Custom palette loading

Choose **Custom Palette** in the palette dropdown and click **Load Custom Palette…** to supply your own colours. The loader accepts:

- Image files – the unique colours from the pixels form the palette.
- Text-based lists – one RGB value per line (`#RRGGBB`, `0xRRGGBB`, or `R G B`).

## Tips for best results

- Enable **Serpentine scan** when using error diffusion on photographs to reduce streaking.
- Ordered modes (Bayer and Clustered Dot) benefit from slightly higher colour counts or adaptive palettes.
- Use the denoise control sparingly; high settings can soften fine texture before dithering.
- Turn on **Preserve brightness (linear)** for scenes with large gradients—quantisation will happen in linear RGB and convert back to sRGB for display.

## Troubleshooting

- If the window does not appear on Linux, ensure the Qt platform plugins are installed (e.g. `sudo apt install libxcb-cursor0 libxkbcommon-x11-0`).
- macOS may require granting execution permission the first time you launch a Qt app downloaded from the internet.
- When running inside a virtual environment, verify that the shell uses the environment’s Python before launching `python -m app`.

## License

This project is provided as-is without warranty. Use it as a reference or starting point for your own creative tools.
