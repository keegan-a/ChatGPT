"""Lightweight tests for the dithering algorithm registry."""

import pytest

pytest.importorskip("numpy")

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
        "Horizontal Stitch",
        "Vertical Stitch",
        "Offset Grid",
        "Cross Hatch",
        "Iso Weave",
    }
    assert expected.issubset(DITHER_ALGORITHMS.keys())
