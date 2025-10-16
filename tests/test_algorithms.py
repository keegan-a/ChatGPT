"""Regression tests for the dithering engine."""
from __future__ import annotations

from pathlib import Path

import pytest

np = pytest.importorskip("numpy")
from PIL import Image

from app.core.dithering import DITHER_ALGORITHMS
from app.core.image_processor import DitheringSettings, ImageProcessor


REQUIRED_ALGORITHMS = {
    "Floyd-Steinberg",
    "Jarvis-Judice-Ninke",
    "Stucki",
    "Atkinson",
    "Burkes",
    "Sierra (2-row)",
    "Sierra Lite (2-4A)",
    "Bayer 2x2",
    "Bayer 4x4",
    "Bayer 8x8",
    "Clustered Dot (ordered)",
    "Random",
}


def test_required_algorithms_present() -> None:
    assert REQUIRED_ALGORITHMS.issubset(DITHER_ALGORITHMS.keys())


def test_processor_preview_generates_palette(tmp_path: Path) -> None:
    image = Image.new("RGB", (32, 32), color=(120, 90, 200))
    processor = ImageProcessor()
    processor.set_image(image)

    settings = DitheringSettings(algorithm="Floyd-Steinberg", color_count=4)
    result = processor.render_preview(settings, max_size=None)
    assert result.image.mode in {"RGB", "RGBA"}
    assert result.palette.shape[0] == 4

    # Ensure adaptive palette honours the requested colour count even when the
    # image contains fewer unique colours.
    flat_colour = Image.new("RGB", (16, 16), color=(10, 20, 30))
    processor.set_image(flat_colour)
    settings.color_count = 6
    adaptive_result = processor.render_preview(settings, max_size=None)
    assert adaptive_result.palette.shape[0] == settings.color_count

    settings.algorithm = "Bayer 4x4"
    settings.color_count = 8
    result_ordered = processor.render_preview(settings, max_size=None)
    assert result_ordered.palette.shape[0] == 8


def test_custom_palette_loader(tmp_path: Path) -> None:
    processor = ImageProcessor()
    # Text palette
    text_palette = tmp_path / "palette.txt"
    text_palette.write_text("#ff0000\n0 255 0\n0x0000ff\n")
    palette = processor.load_palette_from_file(text_palette)
    assert palette.shape[0] == 3

    # Image palette
    image = Image.new("RGB", (2, 2), color=(0, 0, 0))
    image.putpixel((0, 0), (255, 0, 0))
    image.putpixel((1, 0), (0, 255, 0))
    image.putpixel((0, 1), (0, 0, 255))
    palette_image_path = tmp_path / "palette.png"
    image.save(palette_image_path)
    palette_from_image = processor.load_palette_from_file(palette_image_path)
    assert palette_from_image.shape[0] >= 3


def test_serpentine_toggle_changes_output() -> None:
    # Use a gradient so diffusion direction matters
    gradient = np.tile(np.linspace(0, 1, 16, dtype=np.float32), (16, 1))
    data = np.stack([gradient, gradient, gradient], axis=-1)
    image = Image.fromarray((data * 255).astype(np.uint8))
    processor = ImageProcessor()
    processor.set_image(image)
    settings = DitheringSettings(algorithm="Floyd-Steinberg", color_count=2)

    serpentine = processor.render_preview(settings, max_size=None).image
    settings.serpentine = False
    linear = processor.render_preview(settings, max_size=None).image
    assert serpentine.tobytes() != linear.tobytes()
