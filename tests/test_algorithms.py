"""Lightweight tests for the dithering algorithm registry."""

import pytest

pytest.importorskip("numpy")

from app.core.dithering import DITHER_ALGORITHMS, algorithm_spec
from app.core.image_processor import ImageProcessor


def test_expected_algorithms_present():
    expected = {
        "Floyd-Steinberg",
        "Jarvis-Judice-Ninke",
        "Sierra",
        "Row Modulation",
        "Column Modulation",
        "Dispersed Modulation",
        "Medium Modulation",
        "Heavy Modulation",
        "Circuit Modulation",
        "Tilt Modulation",
        "Pattern Matrix",
        "Random Threshold",
        "Blue Noise Cluster",
        "Dot Screen",
        "Line Screen",
        "Radial Rings",
        "Spiral Waves",
        "Diamond Mesh",
        "Glitch Strata",
    }
    assert expected.issubset(DITHER_ALGORITHMS.keys())


def test_colour_modes_and_palettes_exposed():
    processor = ImageProcessor()
    colour_modes = set(processor.available_colour_modes)
    required_modes = {
        "RGB Balance",
        "Mono Luma",
        "Indexed 4",
        "Indexed 8",
        "Retro 16-bit RGB",
        "Retro 8-bit RGB",
        "Hi-Fi Neon",
        "CMYK Composite",
    }
    assert required_modes.issubset(colour_modes)

    palettes = processor.available_palettes
    assert len(palettes) >= len(DITHER_ALGORITHMS)
    assert {"Disabled", "Custom Two-Tone", "Game Boy DMG", "CGA 16-Color"}.issubset(set(palettes))


def test_algorithm_spec_flags_controls():
    diffusion_spec = algorithm_spec("Floyd-Steinberg")
    assert "amplitude" not in diffusion_spec.parameters
    assert diffusion_spec.preview_downsample >= 1

    screen_spec = algorithm_spec("Dot Screen")
    assert {"amplitude", "rotation"}.issubset(set(screen_spec.parameters))
    assert screen_spec.parameters["rotation"].label == "Screen Angle"

    blue_spec = algorithm_spec("Blue Noise Cluster")
    assert blue_spec.parameters["amplitude"].label == "Cluster Depth"
