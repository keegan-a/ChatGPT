"""Lightweight tests for the dithering algorithm registry."""
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
    }
    assert expected.issubset(DITHER_ALGORITHMS.keys())
