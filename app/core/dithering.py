"""Collection of dithering algorithms used by the studio."""
from __future__ import annotations

import math
from dataclasses import dataclass
from functools import lru_cache
from typing import Callable, Dict

import numpy as np

from app.core.models import ProcessingRequest


@dataclass(frozen=True)
class ParameterSpec:
    """Describe a configurable control exposed for an algorithm."""

    field: str
    label: str
    minimum: float
    maximum: float
    default: float
    multiplier: int = 1


@dataclass(frozen=True)
class AlgorithmSpec:
    """Metadata describing how a dithering algorithm should behave."""

    parameters: tuple[ParameterSpec, ...]
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
    """Dither by applying a ranked blue-noise threshold map."""

    tile = _blue_noise_tile()
    height, width = image.shape[:2]
    scale = max(1, int(round(request.period)))
    if scale > 1:
        tile = np.repeat(np.repeat(tile, scale, axis=0), scale, axis=1)
    reps_y = math.ceil(height / tile.shape[0])
    reps_x = math.ceil(width / tile.shape[1])
    pattern = np.tile(tile, (reps_y, reps_x))[:height, :width]
    threshold_map = pattern[..., None] * 255.0

    strength = np.clip(request.amplitude, 0.0, 2.0)
    blend = np.clip(request.frequency / 10.0, 0.0, 1.0)
    bias = (strength * 2.0 - 1.0) * 64.0
    mixed = np.clip(image * (1.0 - blend) + threshold_map * blend + bias, 0.0, 255.0)
    return _threshold(mixed, request.threshold)


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
    """Generate a deterministic blue-noise ranked tile.

    The routine shapes random noise in the frequency domain to push energy into
    higher frequencies, then ranks the distribution to create a stable
    threshold map with minimal low-frequency structure.
    """

    rng = np.random.default_rng(1337)
    tile = rng.random((size, size), dtype=np.float32)

    yy, xx = np.mgrid[-size // 2 : size // 2, -size // 2 : size // 2]
    radius = np.sqrt(xx**2 + yy**2)
    weight = radius / (radius.max() or 1.0)
    weight = np.clip(weight, 0.15, 1.0)

    for _ in range(6):
        shifted = np.fft.fftshift(np.fft.fft2(tile - tile.mean()))
        shaped = shifted * weight
        tile = np.real(np.fft.ifft2(np.fft.ifftshift(shaped)))
        tile = (tile - tile.min()) / (tile.ptp() + 1e-6)
        tile = np.clip(tile + rng.normal(0.0, 0.02, tile.shape), 0.0, 1.0)

    flat = tile.ravel()
    order = np.argsort(flat)
    ranked = np.empty_like(flat)
    ranked[order] = np.linspace(0.0, 1.0, flat.size, endpoint=False)
    tile = ranked.reshape(tile.shape)
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
    "Floyd-Steinberg": AlgorithmSpec(parameters=(), preview_downsample=2),
    "Jarvis-Judice-Ninke": AlgorithmSpec(parameters=(), preview_downsample=3),
    "Sierra": AlgorithmSpec(parameters=(), preview_downsample=2),
    "Row Modulation": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Stripe Depth", 0.0, 2.0, 0.8, 100),
            ParameterSpec("period", "Stripe Width", 2, 64, 12),
        )
    ),
    "Column Modulation": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Stripe Depth", 0.0, 2.0, 0.8, 100),
            ParameterSpec("period", "Stripe Width", 2, 64, 12),
        )
    ),
    "Dispersed Modulation": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Dot Contrast", 0.0, 2.0, 0.7, 100),
            ParameterSpec("period", "Dot Spread", 2, 64, 10),
            ParameterSpec("frequency", "Grain Detail", 1, 12, 4),
        )
    ),
    "Medium Modulation": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Wave Strength", 0.0, 2.0, 0.9, 100),
            ParameterSpec("frequency", "Wave Frequency", 1, 20, 6),
        )
    ),
    "Heavy Modulation": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Wave Strength", 0.0, 2.0, 1.2, 100),
        )
    ),
    "Circuit Modulation": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Circuit Strength", 0.0, 2.0, 0.9, 100),
            ParameterSpec("frequency", "Circuit Frequency", 1, 16, 6),
            ParameterSpec("period", "Circuit Scale", 2, 64, 16),
        )
    ),
    "Tilt Modulation": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Tilt Strength", 0.0, 2.0, 0.8, 100),
            ParameterSpec("slope", "Tilt Angle", -1.0, 1.0, 0.25, 100),
            ParameterSpec("period", "Tilt Spacing", 2, 64, 12),
        )
    ),
    "Pattern Matrix": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Matrix Strength", 0.0, 2.0, 1.0, 100),
        )
    ),
    "Random Threshold": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Noise Amount", 0.0, 2.0, 0.6, 100),
        )
    ),
    "Blue Noise Cluster": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Cluster Bias", 0.0, 2.0, 1.0, 100),
            ParameterSpec("period", "Tile Zoom", 1, 8, 2),
            ParameterSpec("frequency", "Blend Mix", 0, 10, 6),
        ),
        preview_downsample=2,
    ),
    "Dot Screen": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Dot Contrast", 0.0, 2.0, 1.0, 100),
            ParameterSpec("period", "Dot Pitch", 2, 64, 12),
            ParameterSpec("rotation", "Angle", -90.0, 90.0, 15.0, 10),
        )
    ),
    "Line Screen": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Line Contrast", 0.0, 2.0, 1.0, 100),
            ParameterSpec("period", "Line Pitch", 2, 64, 10),
            ParameterSpec("frequency", "Line Density", 1, 20, 5),
            ParameterSpec("rotation", "Angle", -90.0, 90.0, 0.0, 10),
        )
    ),
    "Radial Rings": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Ring Strength", 0.0, 2.0, 1.0, 100),
            ParameterSpec("period", "Ring Spacing", 2, 64, 14),
            ParameterSpec("frequency", "Ring Density", 1, 20, 6),
        )
    ),
    "Spiral Waves": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Spiral Strength", 0.0, 2.0, 1.0, 100),
            ParameterSpec("period", "Spiral Scale", 2, 64, 18),
            ParameterSpec("frequency", "Spiral Density", 1, 20, 7),
            ParameterSpec("slope", "Twist", -1.0, 1.0, 0.4, 100),
        )
    ),
    "Diamond Mesh": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Mesh Strength", 0.0, 2.0, 1.0, 100),
            ParameterSpec("period", "Mesh Size", 2, 64, 16),
            ParameterSpec("rotation", "Angle", -90.0, 90.0, 0.0, 10),
        )
    ),
    "Glitch Strata": AlgorithmSpec(
        parameters=(
            ParameterSpec("amplitude", "Glitch Mix", 0.0, 2.0, 0.6, 100),
            ParameterSpec("period", "Scanline Drift", 2, 32, 8),
            ParameterSpec("frequency", "Strata Count", 1, 20, 6),
        )
    ),
}

_DEFAULT_SPEC = AlgorithmSpec(parameters=())


def algorithm_spec(name: str) -> AlgorithmSpec:
    """Return algorithm metadata, falling back to a default spec."""

    return ALGORITHM_SPECS.get(name, _DEFAULT_SPEC)


def parameter_defaults(name: str) -> Dict[str, float]:
    """Return a mapping of parameter field names to their default values."""

    spec = algorithm_spec(name)
    return {param.field: param.default for param in spec.parameters}


def _rotated_coordinates(shape: tuple[int, int], rotation: float) -> tuple[np.ndarray, np.ndarray]:
    angle = np.deg2rad(rotation)
    height, width = shape
    y, x = np.indices((height, width))
    xr = x * np.cos(angle) - y * np.sin(angle)
    yr = x * np.sin(angle) + y * np.cos(angle)
    return xr, yr
