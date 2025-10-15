"""Collection of dithering algorithms used by the studio."""
from __future__ import annotations

import math
from dataclasses import dataclass, replace
from functools import lru_cache
from typing import Callable, Dict

import numpy as np

from app.core.models import ProcessingRequest


PARAMETER_LIBRARY: Dict[str, ParameterSpec] = {
    "amplitude": ParameterSpec(
        label="Pattern Strength",
        minimum=0,
        maximum=240,
        default=80,
        scale=0.01,
        tooltip="Controls how strongly the pattern or noise modulates the base image.",
    ),
    "frequency": ParameterSpec(
        label="Pattern Frequency",
        minimum=1,
        maximum=24,
        default=6,
        tooltip="Adjusts the number of pattern repeats within the image.",
    ),
    "period": ParameterSpec(
        label="Pattern Size",
        minimum=2,
        maximum=64,
        default=12,
        tooltip="Sets the spacing or cluster size of the pattern elements.",
    ),
    "slope": ParameterSpec(
        label="Slope",
        minimum=-100,
        maximum=100,
        default=0,
        scale=0.01,
        tooltip="Biases patterns diagonally; negative leans left, positive leans right.",
    ),
    "rotation": ParameterSpec(
        label="Rotation",
        minimum=-90,
        maximum=90,
        default=0,
        tooltip="Rotates the generated pattern or halftone screen.",
    ),
}


@dataclass(frozen=True)
class ParameterSpec:
    """Describe how a UI control maps to an algorithm parameter."""

    label: str
    minimum: int
    maximum: int
    default: int
    step: int = 1
    scale: float = 1.0
    tooltip: str | None = None


@dataclass(frozen=True)
class AlgorithmSpec:
    """Metadata describing how a dithering algorithm should behave."""

    parameters: dict[str, ParameterSpec]
    preview_downsample: int = 1


def floyd_steinberg(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    return _error_diffusion(image, request, diffusion_matrix={
        (1, 0): 7 / 16,
        (-1, 1): 3 / 16,
        (0, 1): 5 / 16,
        (1, 1): 1 / 16,
    })


def jarvis_judice_ninke(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    return _error_diffusion(image, request, diffusion_matrix={
        (1, 0): 7 / 48,
        (2, 0): 5 / 48,
        (-2, 1): 3 / 48,
        (-1, 1): 5 / 48,
        (0, 1): 7 / 48,
        (1, 1): 5 / 48,
        (2, 1): 3 / 48,
        (-2, 2): 1 / 48,
        (-1, 2): 3 / 48,
        (0, 2): 5 / 48,
        (1, 2): 3 / 48,
        (2, 2): 1 / 48,
    })


def sierra(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    return _error_diffusion(image, request, diffusion_matrix={
        (1, 0): 5 / 32,
        (2, 0): 3 / 32,
        (-2, 1): 2 / 32,
        (-1, 1): 4 / 32,
        (0, 1): 5 / 32,
        (1, 1): 4 / 32,
        (2, 1): 2 / 32,
        (-1, 2): 2 / 32,
        (0, 2): 3 / 32,
        (1, 2): 2 / 32,
    })


# ---------------------------------------------------------------- Pattern & Modulation

def row_modulation(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    rows = image.shape[0]
    pattern = ((np.arange(rows)[:, None] % request.period) / request.period) * 255
    modulated = image - request.amplitude * pattern[..., None]
    return _threshold(modulated, request.threshold)


def column_modulation(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    cols = image.shape[1]
    pattern = ((np.arange(cols)[None, :] % request.period) / request.period) * 255
    modulated = image - request.amplitude * pattern[..., None]
    return _threshold(modulated, request.threshold)


def dispersed_modulation(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    pattern = np.indices(image.shape[:2]).sum(axis=0) % request.period
    modulated = image + request.amplitude * np.sin(pattern * request.frequency)
    return _threshold(modulated, request.threshold)


def medium_modulation(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    pattern = np.sin(np.linspace(0, np.pi * request.frequency, image.shape[0]))[:, None]
    modulated = image + request.amplitude * pattern[..., None]
    return _threshold(modulated, request.threshold)


def heavy_modulation(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    pattern = np.sign(np.sin(np.linspace(0, np.pi * request.frequency, image.shape[0])[:, None]))
    modulated = image + request.amplitude * pattern[..., None] * 255
    return _threshold(modulated, request.threshold)


def circuit_modulation(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    y, x = np.indices(image.shape[:2])
    pattern = np.sin((x + y) * request.frequency / request.period)
    modulated = image + request.amplitude * pattern[..., None] * 255
    return _threshold(modulated, request.threshold)


def tilt_modulation(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    y, x = np.indices(image.shape[:2])
    pattern = (x * request.slope + y) % request.period
    modulated = image + request.amplitude * np.cos(pattern / request.period * 2 * np.pi)[..., None] * 255
    return _threshold(modulated, request.threshold)


def pattern_matrix(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    bayer2 = np.array([[0, 2], [3, 1]]) / 4.0
    tiled = np.tile(bayer2, (image.shape[0] // 2 + 1, image.shape[1] // 2 + 1))[: image.shape[0], : image.shape[1]]
    modulated = image + request.amplitude * tiled[..., None] * 255
    return _threshold(modulated, request.threshold)


def random_threshold(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    rng = np.random.default_rng()
    jitter = rng.uniform(-request.amplitude * 255, request.amplitude * 255, size=image.shape)
    modulated = image + jitter
    return _threshold(modulated, request.threshold)


def blue_noise_cluster(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    tile = _blue_noise_tile()
    height, width = image.shape[:2]
    cluster = max(1, int(request.period))
    if cluster > 1:
        tile = np.repeat(np.repeat(tile, cluster, axis=0), cluster, axis=1)
    reps_y = math.ceil(height / tile.shape[0])
    reps_x = math.ceil(width / tile.shape[1])
    pattern = np.tile(tile, (reps_y, reps_x))[:height, :width]
    pattern = (pattern - pattern.mean()) / (pattern.std() + 1e-6)
    pattern = np.clip(pattern, -2.5, 2.5)
    threshold_map = request.threshold + pattern * (request.amplitude * 90.0)
    threshold_map = np.clip(threshold_map, 0.0, 255.0)
    return np.where(image > threshold_map[..., None], 255.0, 0.0)


def dot_screen(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    xr, yr = _rotated_coordinates(image.shape[:2], request.rotation)
    period = max(request.period, 1)
    pattern = np.sin(xr / period * np.pi) * np.sin(yr / period * np.pi)
    modulated = image + request.amplitude * pattern[..., None] * 255
    return _threshold(modulated, request.threshold)


def line_screen(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    xr, _ = _rotated_coordinates(image.shape[:2], request.rotation)
    period = max(request.period, 1)
    pattern = np.sin(xr / period * np.pi * max(request.frequency, 1))
    modulated = image + request.amplitude * pattern[..., None] * 255
    return _threshold(modulated, request.threshold)


def radial_rings(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    height, width = image.shape[:2]
    y, x = np.indices((height, width))
    cx = width / 2.0
    cy = height / 2.0
    radius = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    pattern = np.sin(radius / max(request.period, 1) * max(request.frequency, 1))
    modulated = image + request.amplitude * pattern[..., None] * 255
    return _threshold(modulated, request.threshold)


def spiral_waves(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    height, width = image.shape[:2]
    y, x = np.indices((height, width))
    cx = width / 2.0
    cy = height / 2.0
    angle = np.arctan2(y - cy, x - cx)
    radius = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    pattern = np.sin(radius * max(request.frequency, 1) / max(request.period, 1) + angle * request.slope)
    modulated = image + request.amplitude * pattern[..., None] * 255
    return _threshold(modulated, request.threshold)


def diamond_mesh(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    xr, yr = _rotated_coordinates(image.shape[:2], request.rotation)
    period = max(request.period, 1)
    pattern = (np.abs(xr % period - period / 2) + np.abs(yr % period - period / 2))
    pattern = (pattern / (period / 2)) - 1.0
    modulated = image + request.amplitude * pattern[..., None] * 255
    return _threshold(modulated, request.threshold)


def glitch_strata(image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
    stripes = np.sin(np.linspace(0, np.pi * max(request.frequency, 1), image.shape[0]))
    offsets = (np.sign(stripes) * max(request.period, 1)).astype(int)
    jitter = np.empty_like(image)
    for row_idx, shift in enumerate(offsets):
        jitter[row_idx] = np.roll(image[row_idx], shift, axis=0)
    strength = np.clip(request.amplitude, 0.0, 1.0)
    modulated = image * (1 - strength) + jitter * strength
    return _threshold(modulated, request.threshold)


# ----------------------------------------------------------------- Shared helpers

@lru_cache(maxsize=1)
def _blue_noise_tile(size: int = 64) -> np.ndarray:
    rng = np.random.default_rng(1337)
    tile = rng.random((size, size), dtype=np.float32) - 0.5
    fy = np.fft.fftfreq(size)[:, None]
    fx = np.fft.fftfreq(size)[None, :]
    radius = np.sqrt(fx**2 + fy**2).astype(np.float32)
    radius[0, 0] = 1.0
    for _ in range(4):
        spectrum = np.fft.fft2(tile)
        spectrum *= radius
        tile = np.fft.ifft2(spectrum).real
        tile -= tile.mean()
        tile /= (np.std(tile) + 1e-6)
    tile = (tile - tile.min()) / (tile.ptp() + 1e-6)
    return tile.astype(np.float32)

def _error_diffusion(image: np.ndarray, request: ProcessingRequest, diffusion_matrix: dict[tuple[int, int], float]) -> np.ndarray:
    height, width, channels = image.shape
    buffer = image.copy()
    for y in range(height):
        for x in range(width):
            old_pixel = buffer[y, x].copy()
            new_pixel = np.where(old_pixel > request.threshold, 255.0, 0.0)
            buffer[y, x] = new_pixel
            error = old_pixel - new_pixel
            for (dx, dy), weight in diffusion_matrix.items():
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height:
                    buffer[ny, nx] += error * weight
    return np.clip(buffer, 0, 255)


def _threshold(image: np.ndarray, threshold: int) -> np.ndarray:
    return np.where(image > threshold, 255.0, 0.0)


DITHER_ALGORITHMS: Dict[str, Callable[[np.ndarray, ProcessingRequest], np.ndarray]] = {
    "Floyd-Steinberg": floyd_steinberg,
    "Jarvis-Judice-Ninke": jarvis_judice_ninke,
    "Sierra": sierra,
    "Row Modulation": row_modulation,
    "Column Modulation": column_modulation,
    "Dispersed Modulation": dispersed_modulation,
    "Medium Modulation": medium_modulation,
    "Heavy Modulation": heavy_modulation,
    "Circuit Modulation": circuit_modulation,
    "Tilt Modulation": tilt_modulation,
    "Pattern Matrix": pattern_matrix,
    "Random Threshold": random_threshold,
    "Blue Noise Cluster": blue_noise_cluster,
    "Dot Screen": dot_screen,
    "Line Screen": line_screen,
    "Radial Rings": radial_rings,
    "Spiral Waves": spiral_waves,
    "Diamond Mesh": diamond_mesh,
    "Glitch Strata": glitch_strata,
}


ALGORITHM_SPECS: Dict[str, AlgorithmSpec] = {
    "Floyd-Steinberg": AlgorithmSpec(parameters={}, preview_downsample=2),
    "Jarvis-Judice-Ninke": AlgorithmSpec(parameters={}, preview_downsample=3),
    "Sierra": AlgorithmSpec(parameters={}, preview_downsample=2),
    "Row Modulation": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Row Contrast",
                default=90,
                tooltip="Strengthens or softens the contrast between row bands.",
            ),
            "period": replace(
                PARAMETER_LIBRARY["period"],
                label="Row Cycle",
                minimum=2,
                maximum=96,
                default=14,
                tooltip="Controls how many rows form a repeating band.",
            ),
        }
    ),
    "Column Modulation": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Column Contrast",
                default=90,
                tooltip="Strengthens or softens the contrast between column bands.",
            ),
            "period": replace(
                PARAMETER_LIBRARY["period"],
                label="Column Cycle",
                minimum=2,
                maximum=96,
                default=14,
                tooltip="Controls how many columns form a repeating band.",
            ),
        }
    ),
    "Dispersed Modulation": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Scatter Strength",
                default=110,
                tooltip="Sets how aggressively tones scatter into the dispersed pattern.",
            ),
            "period": replace(
                PARAMETER_LIBRARY["period"],
                label="Cluster Size",
                minimum=3,
                maximum=64,
                default=18,
                tooltip="Defines the cell size of the dispersed clusters.",
            ),
            "frequency": replace(
                PARAMETER_LIBRARY["frequency"],
                label="Wave Frequency",
                default=8,
                tooltip="Adds subtle waves through the dispersed pattern.",
            ),
        }
    ),
    "Medium Modulation": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Wave Strength",
                default=90,
                tooltip="Controls how deep the medium sine modulation appears.",
            ),
            "frequency": replace(
                PARAMETER_LIBRARY["frequency"],
                label="Wave Count",
                default=6,
                tooltip="Adjusts how many waves span the image height.",
            ),
        }
    ),
    "Heavy Modulation": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Switch Strength",
                default=120,
                tooltip="Drives how strongly rows flip between light and dark.",
            ),
        }
    ),
    "Circuit Modulation": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Circuit Depth",
                default=110,
                tooltip="Controls the contrast of the circuit-style interference.",
            ),
            "frequency": replace(
                PARAMETER_LIBRARY["frequency"],
                label="Oscillation",
                default=10,
                tooltip="Sets how fast the circuit oscillations repeat.",
            ),
            "period": replace(
                PARAMETER_LIBRARY["period"],
                label="Circuit Spacing",
                minimum=3,
                maximum=60,
                default=16,
                tooltip="Adjusts the spacing between circuit pathways.",
            ),
        }
    ),
    "Tilt Modulation": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Tilt Strength",
                default=100,
                tooltip="Sets the contrast of the diagonal modulation bands.",
            ),
            "slope": replace(
                PARAMETER_LIBRARY["slope"],
                label="Diagonal Bias",
                minimum=-140,
                maximum=140,
                default=35,
                tooltip="Tilts the diagonal bands left or right.",
            ),
            "period": replace(
                PARAMETER_LIBRARY["period"],
                label="Band Width",
                minimum=4,
                maximum=64,
                default=18,
                tooltip="Controls the spacing between diagonal bands.",
            ),
        }
    ),
    "Pattern Matrix": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Matrix Contrast",
                default=80,
                tooltip="Adjusts how much the Bayer matrix influences tones.",
            ),
        }
    ),
    "Random Threshold": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Noise Strength",
                default=40,
                tooltip="Injects random jitter into thresholds for speckled noise.",
            ),
        }
    ),
    "Blue Noise Cluster": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Cluster Depth",
                default=105,
                tooltip="Emphasises or softens the blue-noise grain.",
            ),
            "period": replace(
                PARAMETER_LIBRARY["period"],
                label="Cluster Size",
                minimum=2,
                maximum=48,
                default=12,
                tooltip="Sets the scale of the repeating blue-noise tile.",
            ),
        },
        preview_downsample=2,
    ),
    "Dot Screen": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Dot Contrast",
                default=90,
                tooltip="Controls the weight of the circular halftone dots.",
            ),
            "period": replace(
                PARAMETER_LIBRARY["period"],
                label="Dot Pitch",
                minimum=3,
                maximum=64,
                default=14,
                tooltip="Sets the spacing between halftone dots.",
            ),
            "rotation": replace(
                PARAMETER_LIBRARY["rotation"],
                label="Screen Angle",
                minimum=-90,
                maximum=90,
                default=45,
                tooltip="Rotates the halftone dot screen.",
            ),
        }
    ),
    "Line Screen": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Line Contrast",
                default=95,
                tooltip="Controls how pronounced the halftone lines appear.",
            ),
            "period": replace(
                PARAMETER_LIBRARY["period"],
                label="Line Spacing",
                minimum=2,
                maximum=56,
                default=12,
                tooltip="Sets the distance between halftone lines.",
            ),
            "frequency": replace(
                PARAMETER_LIBRARY["frequency"],
                label="Line Thickness",
                minimum=1,
                maximum=18,
                default=6,
                tooltip="Adjusts how thick each line appears.",
            ),
            "rotation": replace(
                PARAMETER_LIBRARY["rotation"],
                label="Line Angle",
                minimum=-90,
                maximum=90,
                default=0,
                tooltip="Rotates the halftone line direction.",
            ),
        }
    ),
    "Radial Rings": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Ring Contrast",
                default=95,
                tooltip="Controls how bold each radial ring appears.",
            ),
            "period": replace(
                PARAMETER_LIBRARY["period"],
                label="Ring Spacing",
                minimum=4,
                maximum=96,
                default=20,
                tooltip="Sets the distance between concentric rings.",
            ),
            "frequency": replace(
                PARAMETER_LIBRARY["frequency"],
                label="Ring Count",
                minimum=1,
                maximum=32,
                default=8,
                tooltip="Determines how many rings span the canvas.",
            ),
        }
    ),
    "Spiral Waves": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Spiral Contrast",
                default=95,
                tooltip="Controls how bold the spiral modulation appears.",
            ),
            "period": replace(
                PARAMETER_LIBRARY["period"],
                label="Spiral Pitch",
                minimum=4,
                maximum=80,
                default=18,
                tooltip="Adjusts the distance between spiral arms.",
            ),
            "frequency": replace(
                PARAMETER_LIBRARY["frequency"],
                label="Spiral Turns",
                minimum=1,
                maximum=24,
                default=7,
                tooltip="Controls how many spiral oscillations occur.",
            ),
            "slope": replace(
                PARAMETER_LIBRARY["slope"],
                label="Spiral Twist",
                minimum=-180,
                maximum=180,
                default=25,
                tooltip="Twists the spiral tighter or looser.",
            ),
        }
    ),
    "Diamond Mesh": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Mesh Contrast",
                default=90,
                tooltip="Sets the contrast of the diamond lattice.",
            ),
            "period": replace(
                PARAMETER_LIBRARY["period"],
                label="Diamond Size",
                minimum=3,
                maximum=56,
                default=16,
                tooltip="Controls the width of each diamond cell.",
            ),
            "rotation": replace(
                PARAMETER_LIBRARY["rotation"],
                label="Mesh Angle",
                minimum=-90,
                maximum=90,
                default=35,
                tooltip="Rotates the diamond grid.",
            ),
        }
    ),
    "Glitch Strata": AlgorithmSpec(
        parameters={
            "amplitude": replace(
                PARAMETER_LIBRARY["amplitude"],
                label="Glitch Strength",
                default=70,
                tooltip="Blends between the shifted glitch layers and the base image.",
            ),
            "period": replace(
                PARAMETER_LIBRARY["period"],
                label="Shift Distance",
                minimum=2,
                maximum=64,
                default=10,
                tooltip="Sets how far rows are displaced during glitches.",
            ),
            "frequency": replace(
                PARAMETER_LIBRARY["frequency"],
                label="Shift Rate",
                minimum=1,
                maximum=16,
                default=5,
                tooltip="Controls how frequently glitch shifts occur.",
            ),
        }
    ),
}

_DEFAULT_SPEC = AlgorithmSpec(parameters={})


def algorithm_spec(name: str) -> AlgorithmSpec:
    """Return algorithm metadata, falling back to a default spec."""

    return ALGORITHM_SPECS.get(name, _DEFAULT_SPEC)


def _rotated_coordinates(shape: tuple[int, int], rotation: float) -> tuple[np.ndarray, np.ndarray]:
    angle = np.deg2rad(rotation)
    height, width = shape
    y, x = np.indices((height, width))
    xr = x * np.cos(angle) - y * np.sin(angle)
    yr = x * np.sin(angle) + y * np.cos(angle)
    return xr, yr
