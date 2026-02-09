"""Predefined colour rendering palettes for creative output modes."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List

import numpy as np


@dataclass(frozen=True)
class ColourMode:
    """Describe a colour rendering mode."""

    name: str
    palette: np.ndarray | None  # ``None`` implies use of toned image directly.


def _hex_palette(*values: str) -> np.ndarray:
    """Create an ``Nx3`` float32 palette from hexadecimal colour strings."""

    colours: List[tuple[int, int, int]] = []
    for value in values:
        value = value.strip().lstrip("#")
        if len(value) != 6:
            raise ValueError(f"Invalid hex colour: {value}")
        colours.append(tuple(int(value[i : i + 2], 16) for i in range(0, 6, 2)))
    return np.array(colours, dtype=np.float32)


# The first entry mirrors the natural RGB rendering (no palette remap). The
# remaining options draw from retro computers, print processes, and creative
# neon looks to give users as many colour choices as algorithm options.
_COLOUR_MODES: Dict[str, ColourMode] = {
    "Natural RGB": ColourMode("Natural RGB", None),
    "Mono - Neutral": ColourMode("Mono - Neutral", _hex_palette("000000", "FFFFFF")),
    "Mono - Warm": ColourMode("Mono - Warm", _hex_palette("1F140A", "F7E7CE")),
    "Mono - Cool": ColourMode("Mono - Cool", _hex_palette("05080F", "D7E8FF")),
    "Duotone - Ember": ColourMode("Duotone - Ember", _hex_palette("2B0000", "FF6B3D")),
    "Duotone - Ocean": ColourMode("Duotone - Ocean", _hex_palette("001123", "43E0FF")),
    "Duotone - Ultraviolet": ColourMode("Duotone - Ultraviolet", _hex_palette("12002A", "D68CFF")),
    "CMYK Process": ColourMode(
        "CMYK Process",
        _hex_palette("000000", "00A1D7", "FFDD00", "FF3EA5", "FFFFFF"),
    ),
    "RGB Trichrome": ColourMode(
        "RGB Trichrome",
        _hex_palette("000000", "FF0040", "00FF85", "2D6BFF", "FFFFFF"),
    ),
    "Retro 8-Bit": ColourMode(
        "Retro 8-Bit",
        _hex_palette("000000", "55415F", "646964", "D77355", "508CD7", "64B964", "E6C547", "FFFFFF"),
    ),
    "Retro 16-Bit": ColourMode(
        "Retro 16-Bit",
        _hex_palette(
            "140C1C",
            "442434",
            "30346D",
            "4E4A4E",
            "854C30",
            "346524",
            "D04648",
            "757161",
            "597DCE",
            "D27D2C",
            "8595A1",
            "6DAA2C",
            "DAD45E",
            "D9A066",
            "E9D8A1",
            "FFFFFF",
        ),
    ),
    "Game Boy DMG": ColourMode("Game Boy DMG", _hex_palette("0F380F", "306230", "8BAC0F", "9BBC0F")),
    "Commodore 64": ColourMode(
        "Commodore 64",
        _hex_palette("000000", "626262", "898989", "9AD284", "B766B5", "6C5EB5", "84C5CC", "FFFFFF"),
    ),
    "ZX Spectrum": ColourMode(
        "ZX Spectrum",
        _hex_palette(
            "000000",
            "0000D7",
            "D70000",
            "D700D7",
            "00D700",
            "00D7D7",
            "D7D700",
            "FFFFFF",
        ),
    ),
    "Apple II GS": ColourMode(
        "Apple II GS",
        _hex_palette("000000", "0046FF", "7DFF00", "FF8C00", "FF004A", "FFFFFF"),
    ),
    "Atari Sunset": ColourMode(
        "Atari Sunset",
        _hex_palette("1B1F3B", "5A3D5C", "F26CA7", "F7DB4F", "F9F4EA"),
    ),
    "Vaporwave Neon": ColourMode(
        "Vaporwave Neon",
        _hex_palette("14003B", "4C2EFF", "FF3CAC", "FFB86C", "F8F8FF"),
    ),
    "Heatmap Inferno": ColourMode(
        "Heatmap Inferno",
        _hex_palette("120C3C", "422680", "93329E", "D91656", "F1723A", "F7F06D"),
    ),
    "Solarized Night": ColourMode(
        "Solarized Night",
        _hex_palette("002B36", "073642", "586E75", "657B83", "839496", "EEE8D5"),
    ),
    "Cyberpunk Grid": ColourMode(
        "Cyberpunk Grid",
        _hex_palette("05070A", "00FFC6", "2CE8F5", "FF00A0", "FFD319"),
    ),
    "Noir Pop": ColourMode(
        "Noir Pop",
        _hex_palette("050505", "2E1F27", "D7263D", "F46036", "E2C044", "F7F4EA"),
    ),
    "Luxe Metallic": ColourMode(
        "Luxe Metallic",
        _hex_palette("030303", "1F1A17", "4A423F", "8C7A6B", "D9C6B0", "F4EDE1"),
    ),
}


COLOUR_MODE_NAMES: List[str] = list(_COLOUR_MODES.keys())


def get_colour_mode(name: str) -> ColourMode:
    """Return the palette definition for the requested mode."""

    try:
        return _COLOUR_MODES[name]
    except KeyError as exc:  # pragma: no cover - defensive fallback
        raise ValueError(f"Unknown colour mode: {name}") from exc
