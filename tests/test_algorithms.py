"""Lightweight tests for the dithering algorithm registry."""

import pytest

pytest.importorskip("numpy")

import numpy as np

from app.core.dithering import DITHER_ALGORITHMS, algorithm_spec, parameter_defaults
from app.core.image_processor import ImageProcessor
from app.core.models import ProcessingRequest


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
    assert diffusion_spec.parameters == ()
    assert diffusion_spec.preview_downsample >= 1

    screen_spec = algorithm_spec("Dot Screen")
    screen_fields = {param.field for param in screen_spec.parameters}
    assert {"amplitude", "rotation"}.issubset(screen_fields)


def test_parameter_defaults_expose_values():
    defaults = parameter_defaults("Blue Noise Cluster")
    assert defaults["frequency"] == 6
    assert defaults["amplitude"] == 1.0


def test_blue_noise_cluster_outputs_binary_map():
    algorithm = DITHER_ALGORITHMS["Blue Noise Cluster"]
    image = np.full((32, 32, 3), 128.0, dtype=np.float32)
    request = ProcessingRequest(
        algorithm="Blue Noise Cluster",
        threshold=128,
        amplitude=1.0,
        frequency=6,
        period=2,
        slope=0.0,
        pixel_size=1.0,
        glow_radius=0,
        noise_level=0.0,
        sharpen_amount=0.0,
        red_scale=1.0,
        green_scale=1.0,
        blue_scale=1.0,
        colour_mode="RGB Balance",
        palette_mode="Disabled",
        colour_a="#000000",
        colour_b="#FFFFFF",
        full_resolution=False,
        gamma=1.0,
        contrast=1.0,
        saturation=1.0,
        hue_shift=0.0,
        edge_boost=0.0,
        posterize_levels=0,
        blend_original=0.0,
        invert_output=False,
        vignette_strength=0.0,
        rotation=0.0,
    )
    output = algorithm(image, request)
    assert output.min() == 0.0
    assert output.max() == 255.0
