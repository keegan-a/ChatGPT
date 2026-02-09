"""Lightweight tests for the dithering algorithm registry."""

import pytest

pytest.importorskip("numpy")

from app.core.colour_modes import COLOUR_MODE_NAMES
from app.core.dithering import DITHER_ALGORITHMS


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
        "Hex Weave",
        "Offset Checker",
        "Pulse Burst",
    }
    assert expected.issubset(DITHER_ALGORITHMS.keys())


def test_colour_modes_match_algorithm_variety():
    assert len(COLOUR_MODE_NAMES) >= len(DITHER_ALGORITHMS)
