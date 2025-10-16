"""Regression tests for the dithering engine."""
from __future__ import annotations

from pathlib import Path

import pytest

cv2 = pytest.importorskip("cv2")

np = pytest.importorskip("numpy")
pytest.importorskip("PIL.Image")
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


def test_custom_palette_accepts_rgba() -> None:
    processor = ImageProcessor()
    rgba_palette = np.array([[10, 20, 30, 255], [40, 50, 60, 128]], dtype=np.uint8)
    processor.set_custom_palette(rgba_palette)

    processor.set_image(Image.new("RGB", (4, 4), color=(120, 90, 200)))
    settings = DitheringSettings(palette_mode="Custom Palette", color_count=2)
    result = processor.render_preview(settings, max_size=None)
    assert result.palette.shape[0] == 2


def test_empty_palette_falls_back_to_grayscale() -> None:
    processor = ImageProcessor()
    processor.set_custom_palette(np.empty((0, 3), dtype=np.uint8))

    processor.set_image(Image.new("RGB", (4, 4), color=(0, 0, 0)))
    settings = DitheringSettings(palette_mode="Custom Palette", color_count=4)
    result = processor.render_preview(settings, max_size=None)
    assert result.palette.shape[0] == 4


def test_preview_survives_cv2_failure(monkeypatch) -> None:
    processor = ImageProcessor()
    processor.set_image(Image.new("RGB", (8, 8), color=(128, 128, 128)))
    settings = DitheringSettings(blur_radius=1.5, sharpen_amount=0.5)

    def fail(*_args, **_kwargs):
        raise cv2.error("Intentional failure", "GaussianBlur", "")

    from app.core import image_processor as module

    original = module.cv2.GaussianBlur
    monkeypatch.setattr(module.cv2, "GaussianBlur", fail)
    try:
        result = processor.render_preview(settings, max_size=None)
    finally:
        monkeypatch.setattr(module.cv2, "GaussianBlur", original)

    assert result.image.size == (8, 8)


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
