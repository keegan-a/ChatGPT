"""Colour rendering utilities and retro palette mappings."""
from __future__ import annotations

from typing import Iterable

import numpy as np

# ---------------------------------------------------------------------------
# Palette collections inspired by retro hardware and print workflows.

RENDER_MODE_OPTIONS: list[str] = [
    "RGB (Full Range)",
    "Monochrome Luma",
    "Warm Monochrome",
    "Thermal Printer",
    "CMYK Print",
    "CMY Split Screen",
    "Duotone Indigo & Amber",
    "Duotone Scarlet & Teal",
    "Duotone Carbon & Ice",
    "Indexed 256 Colours",
    "Indexed 64 Colours",
    "Indexed 32 Colours",
    "Indexed 16 Colours",
    "Indexed Custom Depth",
    "Game Boy DMG",
    "Game Boy Pocket",
    "CGA Mode 1",
    "CGA Mode 2",
    "EGA 16",
    "Commodore 64",
    "Amiga 32",
    "Apple II",
    "ZX Spectrum",
    "Atari ST",
    "Vector Neon",
    "LCD Pixel Grid",
    "Arcade Fire",
    "Plasma Glow",
]


_PRESET_PALETTES: dict[str, np.ndarray] = {
    "Game Boy DMG": np.array(
        [
            [15, 56, 15],
            [48, 98, 48],
            [139, 172, 15],
            [155, 188, 15],
        ],
        dtype=np.float32,
    ),
    "Game Boy Pocket": np.array(
        [
            [26, 28, 32],
            [96, 104, 96],
            [176, 184, 172],
            [240, 248, 240],
        ],
        dtype=np.float32,
    ),
    "CGA Mode 1": np.array(
        [
            [0, 0, 0],
            [85, 255, 255],
            [255, 85, 255],
            [255, 255, 255],
        ],
        dtype=np.float32,
    ),
    "CGA Mode 2": np.array(
        [
            [0, 0, 0],
            [255, 0, 0],
            [0, 255, 0],
            [255, 255, 0],
        ],
        dtype=np.float32,
    ),
    "EGA 16": np.array(
        [
            [0, 0, 0],
            [0, 0, 170],
            [0, 170, 0],
            [0, 170, 170],
            [170, 0, 0],
            [170, 0, 170],
            [170, 85, 0],
            [170, 170, 170],
            [85, 85, 85],
            [85, 85, 255],
            [85, 255, 85],
            [85, 255, 255],
            [255, 85, 85],
            [255, 85, 255],
            [255, 255, 85],
            [255, 255, 255],
        ],
        dtype=np.float32,
    ),
    "Commodore 64": np.array(
        [
            [0, 0, 0],
            [255, 255, 255],
            [136, 0, 0],
            [170, 255, 238],
            [204, 68, 204],
            [0, 204, 85],
            [0, 0, 170],
            [238, 238, 119],
            [221, 136, 85],
            [102, 68, 0],
            [255, 119, 119],
            [51, 51, 51],
            [119, 119, 119],
            [170, 255, 102],
            [0, 136, 255],
            [187, 187, 187],
        ],
        dtype=np.float32,
    ),
    "Amiga 32": np.array(
        [
            [0, 0, 0],
            [68, 68, 68],
            [136, 136, 136],
            [255, 255, 255],
            [255, 68, 68],
            [255, 153, 68],
            [255, 238, 68],
            [153, 255, 68],
            [68, 255, 153],
            [68, 204, 255],
            [68, 102, 255],
            [153, 68, 255],
            [238, 68, 255],
            [255, 68, 170],
            [255, 204, 204],
            [204, 255, 238],
        ],
        dtype=np.float32,
    ),
    "Apple II": np.array(
        [
            [0, 0, 0],
            [255, 255, 255],
            [255, 68, 0],
            [204, 0, 255],
            [0, 221, 0],
            [0, 204, 255],
            [255, 204, 0],
            [0, 0, 221],
        ],
        dtype=np.float32,
    ),
    "ZX Spectrum": np.array(
        [
            [0, 0, 0],
            [0, 0, 205],
            [205, 0, 0],
            [205, 0, 205],
            [0, 205, 0],
            [0, 205, 205],
            [205, 205, 0],
            [205, 205, 205],
            [0, 0, 0],
            [0, 0, 255],
            [255, 0, 0],
            [255, 0, 255],
            [0, 255, 0],
            [0, 255, 255],
            [255, 255, 0],
            [255, 255, 255],
        ],
        dtype=np.float32,
    ),
    "Atari ST": np.array(
        [
            [0, 0, 0],
            [255, 255, 255],
            [255, 0, 0],
            [0, 255, 0],
            [0, 0, 255],
            [255, 255, 0],
            [255, 0, 255],
            [0, 255, 255],
            [128, 64, 0],
            [128, 0, 128],
            [0, 128, 128],
            [255, 128, 0],
            [0, 128, 255],
            [128, 255, 0],
            [255, 0, 128],
            [128, 128, 128],
        ],
        dtype=np.float32,
    ),
}


_DUOTONE_MAPS: dict[str, np.ndarray] = {
    "Duotone Indigo & Amber": np.array(
        [[18, 20, 58], [92, 45, 120], [255, 153, 51]], dtype=np.float32
    ),
    "Duotone Scarlet & Teal": np.array(
        [[20, 60, 80], [200, 40, 70], [255, 200, 120]], dtype=np.float32
    ),
    "Duotone Carbon & Ice": np.array(
        [[5, 15, 25], [80, 100, 140], [190, 220, 255]], dtype=np.float32
    ),
}


# ---------------------------------------------------------------------------
# Public API

def apply_render_mode(
    image: np.ndarray,
    mode: str,
    mix: float,
    bit_depth: int,
) -> np.ndarray:
    """Apply the chosen colour rendering strategy to the image.

    Parameters
    ----------
    image:
        Input RGB array in float32 space (0-255).
    mode:
        Selected render mode name.
    mix:
        Blend factor between the original image and the rendered target.
    bit_depth:
        Requested indexed depth for palette quantisation.
    """

    if image.size == 0:
        return image

    base = np.clip(image.astype(np.float32), 0, 255)
    mode = mode or "RGB (Full Range)"
    mix = float(np.clip(mix, 0.0, 1.0))
    bit_depth = int(np.clip(bit_depth, 1, 8))

    target = base

    if mode == "RGB (Full Range)":
        target = base
    elif mode == "Monochrome Luma":
        target = _monochrome(base, warm=False)
    elif mode == "Warm Monochrome":
        target = _monochrome(base, warm=True)
    elif mode == "Thermal Printer":
        target = _thermal_printer(base)
    elif mode in _PRESET_PALETTES:
        target = _map_to_palette(base, _PRESET_PALETTES[mode])
    elif mode in _DUOTONE_MAPS:
        target = _apply_duotone(base, _DUOTONE_MAPS[mode])
    elif mode == "CMYK Print":
        target = _simulate_cmyk(base)
    elif mode == "CMY Split Screen":
        target = _split_cmy(base)
    elif mode == "Vector Neon":
        target = _vector_neon(base)
    elif mode == "LCD Pixel Grid":
        target = _lcd_pixel_grid(base)
    elif mode == "Arcade Fire":
        target = _arcade_fire(base)
    elif mode == "Plasma Glow":
        target = _plasma_glow(base)
    elif mode.startswith("Indexed"):
        levels = _levels_from_mode(mode) or (2**bit_depth)
        target = _quantize_to_levels(base, levels)
    else:
        target = base

    target = np.clip(target, 0, 255).astype(np.float32)

    if mix <= 0.0:
        return base
    if mix >= 1.0:
        return target
    return np.clip(base * (1.0 - mix) + target * mix, 0, 255).astype(np.float32)


# ---------------------------------------------------------------------------
# Helper implementations

def _levels_from_mode(mode: str) -> int | None:
    digits = [int(token) for token in mode.split() if token.isdigit()]
    if digits:
        return max(2, digits[0])
    return None


def _quantize_to_levels(image: np.ndarray, levels: int) -> np.ndarray:
    levels = max(2, levels)
    step = 255.0 / (levels - 1)
    return np.round(image / step) * step


def _monochrome(image: np.ndarray, warm: bool) -> np.ndarray:
    luma = np.dot(image[..., :3], np.array([0.2126, 0.7152, 0.0722], dtype=np.float32))
    mono = np.repeat(luma[..., None], 3, axis=-1)
    if warm:
        tint = np.array([255, 240, 210], dtype=np.float32)
        return mono * 0.7 + tint * 0.3
    return mono


def _thermal_printer(image: np.ndarray) -> np.ndarray:
    mono = _monochrome(image, warm=False)
    shadows = np.clip(mono / 255.0, 0.0, 1.0)
    warm = np.array([70, 32, 16], dtype=np.float32)
    light = np.array([255, 220, 180], dtype=np.float32)
    return warm * (1.0 - shadows[..., None]) + light * shadows[..., None]


def _map_to_palette(image: np.ndarray, palette: np.ndarray) -> np.ndarray:
    palette = palette.astype(np.float32)
    flat = image.reshape(-1, 3)
    distances = np.sum((flat[:, None, :] - palette[None, :, :]) ** 2, axis=2)
    indices = np.argmin(distances, axis=1)
    mapped = palette[indices]
    return mapped.reshape(image.shape)


def _apply_duotone(image: np.ndarray, tones: np.ndarray) -> np.ndarray:
    tones = tones.astype(np.float32)
    luminance = np.dot(image[..., :3], np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)) / 255.0
    if len(tones) == 2:
        a, b = tones
        return (a + (b - a) * luminance[..., None]).astype(np.float32)
    positions = np.linspace(0.0, 1.0, len(tones), dtype=np.float32)
    return _interpolate_palette(luminance, tones, positions)


def _simulate_cmyk(image: np.ndarray) -> np.ndarray:
    rgb = np.clip(image / 255.0, 0.0, 1.0)
    k = 1.0 - np.max(rgb, axis=-1)
    c = (1.0 - rgb[..., 0] - k) / (1.0 - k + 1e-5)
    m = (1.0 - rgb[..., 1] - k) / (1.0 - k + 1e-5)
    y = (1.0 - rgb[..., 2] - k) / (1.0 - k + 1e-5)
    cyan = (1.0 - np.clip(c, 0.0, 1.0))[..., None] * np.array([0, 180, 180], dtype=np.float32)
    magenta = (1.0 - np.clip(m, 0.0, 1.0))[..., None] * np.array([200, 0, 180], dtype=np.float32)
    yellow = (1.0 - np.clip(y, 0.0, 1.0))[..., None] * np.array([220, 200, 0], dtype=np.float32)
    black = (1.0 - np.clip(k, 0.0, 1.0))[..., None] * np.array([30, 30, 30], dtype=np.float32)
    combined = (cyan + magenta + yellow) * 0.45 + black * 0.65
    return np.clip(combined, 0, 255)


def _split_cmy(image: np.ndarray) -> np.ndarray:
    rgb = np.clip(image / 255.0, 0.0, 1.0)
    cmy = 1.0 - rgb
    cyan = (1.0 - cmy[..., 0])[..., None] * np.array([0, 180, 180], dtype=np.float32)
    magenta = (1.0 - cmy[..., 1])[..., None] * np.array([200, 0, 200], dtype=np.float32)
    yellow = (1.0 - cmy[..., 2])[..., None] * np.array([220, 200, 0], dtype=np.float32)
    return np.clip((cyan + magenta + yellow) / 3.0, 0, 255)


def _vector_neon(image: np.ndarray) -> np.ndarray:
    luma = np.dot(image[..., :3], np.array([0.299, 0.587, 0.114], dtype=np.float32)) / 255.0
    neon = np.stack([
        np.sin(luma * np.pi) * 255,
        np.sin((luma + 0.33) * np.pi) * 255,
        np.sin((luma + 0.66) * np.pi) * 255,
    ], axis=-1)
    neon = np.clip(neon, 0, 255).astype(np.float32)
    glow = np.array([30, 0, 60], dtype=np.float32)
    return np.clip(neon * 0.7 + glow, 0, 255).astype(np.float32)


def _lcd_pixel_grid(image: np.ndarray) -> np.ndarray:
    base = image.copy().astype(np.float32)
    height, width = base.shape[:2]
    y, x = np.indices((height, width))
    mask = ((x % 3) == 0) | ((y % 2) == 0)
    base[mask] *= 0.85
    subpixels = np.zeros_like(base)
    subpixels[..., 0] = base[..., 0]
    subpixels[..., 1] = np.roll(base[..., 1], 1, axis=1)
    subpixels[..., 2] = np.roll(base[..., 2], 2, axis=1)
    return np.clip(subpixels * 0.95 + base * 0.05, 0, 255).astype(np.float32)


def _arcade_fire(image: np.ndarray) -> np.ndarray:
    palette = np.array(
        [
            [0, 0, 0],
            [255, 40, 0],
            [255, 128, 0],
            [255, 255, 0],
            [0, 200, 255],
            [160, 0, 255],
        ],
        dtype=np.float32,
    )
    return _apply_duotone(image, palette)


def _plasma_glow(image: np.ndarray) -> np.ndarray:
    luminance = np.dot(image[..., :3], np.array([0.3, 0.59, 0.11], dtype=np.float32)) / 255.0
    gradient = np.array(
        [
            [20, 0, 40],
            [0, 120, 255],
            [255, 60, 200],
            [255, 240, 200],
        ],
        dtype=np.float32,
    )
    return _interpolate_palette(luminance, gradient, np.linspace(0, 1, len(gradient)))


def _interpolate_palette(
    luminance: np.ndarray,
    palette: np.ndarray,
    positions: Iterable[float],
) -> np.ndarray:
    palette = palette.astype(np.float32)
    positions = np.array(list(positions), dtype=np.float32)
    luminance = np.clip(luminance, 0.0, 1.0)

    indices = np.searchsorted(positions, luminance, side="right")
    indices = np.clip(indices, 1, len(positions) - 1)
    lower_pos = positions[indices - 1]
    upper_pos = positions[indices]
    weight = (luminance - lower_pos) / (upper_pos - lower_pos + 1e-5)

    lower_col = palette[indices - 1]
    upper_col = palette[indices]
    return (lower_col + (upper_col - lower_col) * weight[..., None]).astype(np.float32)

