"""Collection of dithering algorithms used by the studio."""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Callable, Dict

import numpy as np

from app.core.models import ProcessingRequest


@dataclass(frozen=True)
class ParameterControl:
    """Describe how a UI control should present a parameter."""

    label: str
    minimum: int
    maximum: int
    default: int
    step: int = 1
    tooltip: str | None = None


@dataclass(frozen=True)
class AlgorithmSpec:
    """Metadata describing how a dithering algorithm should behave."""

    parameters: tuple[str, ...]
    preview_downsample: int = 1
    controls: Dict[str, ParameterControl] = field(default_factory=dict)


DEFAULT_PARAMETER_CONTROLS: Dict[str, ParameterControl] = {
    "amplitude": ParameterControl(
        label="Pattern Strength",
        minimum=0,
        maximum=300,
        default=150,
        step=5,
        tooltip="Controls how strongly the pattern modulates the image before thresholding.",
    ),
    "frequency": ParameterControl(
        label="Pattern Density",
        minimum=1,
        maximum=40,
        default=8,
        step=1,
        tooltip="Sets how many pattern waves or stripes appear across the image height.",
    ),
    "period": ParameterControl(
        label="Pattern Scale",
        minimum=2,
        maximum=64,
        default=12,
        step=1,
        tooltip="Adjusts the spacing between pattern features such as dots or clusters.",
    ),
    "slope": ParameterControl(
        label="Diagonal Skew",
        minimum=-200,
        maximum=200,
        default=0,
        step=5,
        tooltip="Tilts striped patterns to introduce diagonal motion or spirals.",
    ),
    "rotation": ParameterControl(
        label="Pattern Angle",
        minimum=-180,
        maximum=180,
        default=0,
        step=5,
        tooltip="Rotates screen and mesh patterns to classic printmaker angles.",
    ),
}


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
    scale = max(1, int(round(request.period)))
    if scale > 1:
        tile = np.repeat(np.repeat(tile, scale, axis=0), scale, axis=1)
    reps_y = math.ceil(height / tile.shape[0])
    reps_x = math.ceil(width / tile.shape[1])
    pattern = np.tile(tile, (reps_y, reps_x))[:height, :width]
    # emphasise clustered voids for tighter halftones
    contrast_gain = np.clip(0.35 + (request.amplitude - 1.0) * 0.45, 0.05, 1.5)
    balanced = np.clip((pattern - 0.5) * contrast_gain, -0.5, 0.5)
    threshold_map = np.clip(request.threshold + balanced * 255.0, 0.0, 255.0)
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
    tile = rng.random((size, size), dtype=np.float32)
    for _ in range(5):
        blurred = (
            np.roll(tile, 1, axis=0)
            + np.roll(tile, -1, axis=0)
            + np.roll(tile, 1, axis=1)
            + np.roll(tile, -1, axis=1)
        ) / 4.0
        tile = np.clip(tile * 1.5 - blurred * 0.5, 0.0, 1.0)
    tile = tile - tile.min()
    tile = tile / (tile.ptp() + 1e-6)
    return tile.astype(np.float32)

def _error_diffusion(image: np.ndarray, request: ProcessingRequest, diffusion_matrix: dict[tuple[int, int], float]) -> np.ndarray:
    height, width, channels = image.shape
    buffer = image.copy()
    strength = np.clip(request.amplitude, 0.1, 3.0)
    threshold = np.clip(request.threshold + (strength - 1.0) * 60.0, 0.0, 255.0)
    diffusion_gain = 0.75 + strength * 0.75
    for y in range(height):
        for x in range(width):
            old_pixel = buffer[y, x].copy()
            new_pixel = np.where(old_pixel > threshold, 255.0, 0.0)
            buffer[y, x] = new_pixel
            error = (old_pixel - new_pixel) * diffusion_gain
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
    "Floyd-Steinberg": AlgorithmSpec(
        parameters=("amplitude",),
        preview_downsample=2,
        controls={
            "amplitude": ParameterControl(
                label="Edge Contrast",
                minimum=40,
                maximum=240,
                default=120,
                step=5,
                tooltip="Accentuate edges or soften gradients in the diffusion pass.",
            ),
        },
    ),
    "Jarvis-Judice-Ninke": AlgorithmSpec(
        parameters=("amplitude",),
        preview_downsample=3,
        controls={
            "amplitude": ParameterControl(
                label="Edge Contrast",
                minimum=40,
                maximum=240,
                default=130,
                step=5,
                tooltip="Controls the aggressiveness of error spreading for Jarvis diffusion.",
            ),
        },
    ),
    "Sierra": AlgorithmSpec(
        parameters=("amplitude",),
        preview_downsample=2,
        controls={
            "amplitude": ParameterControl(
                label="Edge Contrast",
                minimum=40,
                maximum=240,
                default=125,
                step=5,
                tooltip="Fine tune Sierra diffusion to push highlights or shadows.",
            ),
        },
    ),
    "Row Modulation": AlgorithmSpec(
        parameters=("amplitude", "period"),
        controls={
            "amplitude": ParameterControl(
                label="Stripe Strength",
                minimum=0,
                maximum=300,
                default=180,
                step=5,
                tooltip="Sets how dark or light the horizontal banding appears.",
            ),
            "period": ParameterControl(
                label="Stripe Height",
                minimum=2,
                maximum=80,
                default=16,
                step=1,
                tooltip="Adjust the number of rows bundled into each tone band.",
            ),
        },
    ),
    "Column Modulation": AlgorithmSpec(
        parameters=("amplitude", "period"),
        controls={
            "amplitude": ParameterControl(
                label="Column Strength",
                minimum=0,
                maximum=300,
                default=180,
                step=5,
                tooltip="Sets how bold the vertical modulation reads.",
            ),
            "period": ParameterControl(
                label="Column Width",
                minimum=2,
                maximum=80,
                default=18,
                step=1,
                tooltip="Controls how many pixels contribute to a vertical band.",
            ),
        },
    ),
    "Dispersed Modulation": AlgorithmSpec(
        parameters=("amplitude", "period", "frequency"),
        controls={
            "amplitude": ParameterControl(
                label="Speckle Strength",
                minimum=0,
                maximum=300,
                default=160,
                step=5,
                tooltip="Boost the contrast of the dispersed texture.",
            ),
            "period": ParameterControl(
                label="Speckle Scale",
                minimum=2,
                maximum=64,
                default=14,
                step=1,
                tooltip="Controls how large the dispersed cells become.",
            ),
            "frequency": ParameterControl(
                label="Scatter Frequency",
                minimum=1,
                maximum=32,
                default=10,
                step=1,
                tooltip="Adds extra oscillation for shimmering noise.",
            ),
        },
    ),
    "Medium Modulation": AlgorithmSpec(
        parameters=("amplitude", "frequency"),
        controls={
            "amplitude": ParameterControl(
                label="Wave Strength",
                minimum=0,
                maximum=300,
                default=170,
                step=5,
                tooltip="Increase to make the medium modulation more pronounced.",
            ),
            "frequency": ParameterControl(
                label="Wave Frequency",
                minimum=1,
                maximum=32,
                default=12,
                step=1,
                tooltip="Sets the number of medium bands across the image.",
            ),
        },
    ),
    "Heavy Modulation": AlgorithmSpec(
        parameters=("amplitude",),
        controls={
            "amplitude": ParameterControl(
                label="Block Strength",
                minimum=0,
                maximum=300,
                default=200,
                step=5,
                tooltip="Controls the harshness of the heavy modulation bands.",
            ),
        },
    ),
    "Circuit Modulation": AlgorithmSpec(
        parameters=("amplitude", "frequency", "period"),
        controls={
            "amplitude": ParameterControl(
                label="Circuit Depth",
                minimum=0,
                maximum=300,
                default=190,
                step=5,
                tooltip="Increase for deeper etched circuit contours.",
            ),
            "frequency": ParameterControl(
                label="Circuit Frequency",
                minimum=1,
                maximum=36,
                default=12,
                step=1,
                tooltip="Adjust the number of circuit wiggles per tile.",
            ),
            "period": ParameterControl(
                label="Circuit Scale",
                minimum=2,
                maximum=64,
                default=16,
                step=1,
                tooltip="Resize the repeating circuit tile.",
            ),
        },
    ),
    "Tilt Modulation": AlgorithmSpec(
        parameters=("amplitude", "slope", "period"),
        controls={
            "amplitude": ParameterControl(
                label="Tilt Strength",
                minimum=0,
                maximum=300,
                default=170,
                step=5,
                tooltip="Amplify the cross-hatch tilt.",
            ),
            "slope": ParameterControl(
                label="Tilt Skew",
                minimum=-300,
                maximum=300,
                default=60,
                step=10,
                tooltip="Lean the diagonal modulation forward or backward.",
            ),
            "period": ParameterControl(
                label="Tilt Scale",
                minimum=2,
                maximum=64,
                default=18,
                step=1,
                tooltip="Set the spacing between tilt waves.",
            ),
        },
    ),
    "Pattern Matrix": AlgorithmSpec(
        parameters=("amplitude",),
        controls={
            "amplitude": ParameterControl(
                label="Matrix Strength",
                minimum=0,
                maximum=300,
                default=140,
                step=5,
                tooltip="Emphasise or soften the Bayer pattern imprint.",
            ),
        },
    ),
    "Random Threshold": AlgorithmSpec(
        parameters=("amplitude",),
        controls={
            "amplitude": ParameterControl(
                label="Noise Range",
                minimum=0,
                maximum=300,
                default=160,
                step=5,
                tooltip="Sets how much random jitter is added before thresholding.",
            ),
        },
    ),
    "Blue Noise Cluster": AlgorithmSpec(
        parameters=("amplitude", "period"),
        preview_downsample=2,
        controls={
            "amplitude": ParameterControl(
                label="Noise Strength",
                minimum=60,
                maximum=280,
                default=180,
                step=5,
                tooltip="Blend between pure threshold and clustered blue-noise grains.",
            ),
            "period": ParameterControl(
                label="Cluster Scale",
                minimum=1,
                maximum=24,
                default=6,
                step=1,
                tooltip="Resample the blue-noise tile for larger or finer grains.",
            ),
        },
    ),
    "Dot Screen": AlgorithmSpec(
        parameters=("amplitude", "period", "rotation"),
        controls={
            "amplitude": ParameterControl(
                label="Ink Coverage",
                minimum=0,
                maximum=300,
                default=200,
                step=5,
                tooltip="Adjust how full the halftone dots print.",
            ),
            "period": ParameterControl(
                label="Dot Pitch",
                minimum=4,
                maximum=72,
                default=18,
                step=1,
                tooltip="Controls the spacing between individual dots.",
            ),
            "rotation": ParameterControl(
                label="Screen Angle",
                minimum=-180,
                maximum=180,
                default=45,
                step=5,
                tooltip="Rotate dots to match CMYK screen angles.",
            ),
        },
    ),
    "Line Screen": AlgorithmSpec(
        parameters=("amplitude", "period", "frequency", "rotation"),
        controls={
            "amplitude": ParameterControl(
                label="Ink Coverage",
                minimum=0,
                maximum=300,
                default=210,
                step=5,
                tooltip="Controls how dark the screen lines render.",
            ),
            "period": ParameterControl(
                label="Line Pitch",
                minimum=4,
                maximum=64,
                default=16,
                step=1,
                tooltip="Adjusts the spacing between halftone lines.",
            ),
            "frequency": ParameterControl(
                label="Line Frequency",
                minimum=1,
                maximum=48,
                default=18,
                step=1,
                tooltip="Adds harmonics for tighter or looser line groupings.",
            ),
            "rotation": ParameterControl(
                label="Screen Angle",
                minimum=-180,
                maximum=180,
                default=30,
                step=5,
                tooltip="Rotate the line screen.",
            ),
        },
    ),
    "Radial Rings": AlgorithmSpec(
        parameters=("amplitude", "period", "frequency"),
        controls={
            "amplitude": ParameterControl(
                label="Ring Contrast",
                minimum=0,
                maximum=300,
                default=190,
                step=5,
                tooltip="Strengthen or soften the radial rings.",
            ),
            "period": ParameterControl(
                label="Ring Spacing",
                minimum=4,
                maximum=80,
                default=20,
                step=1,
                tooltip="Set the distance between circular bands.",
            ),
            "frequency": ParameterControl(
                label="Ring Density",
                minimum=1,
                maximum=40,
                default=14,
                step=1,
                tooltip="Increase to pack more rings towards the centre.",
            ),
        },
    ),
    "Spiral Waves": AlgorithmSpec(
        parameters=("amplitude", "period", "frequency", "slope"),
        controls={
            "amplitude": ParameterControl(
                label="Spiral Contrast",
                minimum=0,
                maximum=300,
                default=190,
                step=5,
                tooltip="Controls how visible the spiral arms are.",
            ),
            "period": ParameterControl(
                label="Spiral Pitch",
                minimum=4,
                maximum=96,
                default=22,
                step=1,
                tooltip="Spacing between spiral wraps.",
            ),
            "frequency": ParameterControl(
                label="Spiral Turns",
                minimum=1,
                maximum=40,
                default=18,
                step=1,
                tooltip="Higher values add more turns before reaching the edge.",
            ),
            "slope": ParameterControl(
                label="Twist Amount",
                minimum=-300,
                maximum=300,
                default=80,
                step=10,
                tooltip="Twist the spiral tighter or looser.",
            ),
        },
    ),
    "Diamond Mesh": AlgorithmSpec(
        parameters=("amplitude", "period", "rotation"),
        controls={
            "amplitude": ParameterControl(
                label="Mesh Contrast",
                minimum=0,
                maximum=300,
                default=180,
                step=5,
                tooltip="Controls the depth of the mesh pattern.",
            ),
            "period": ParameterControl(
                label="Cell Size",
                minimum=4,
                maximum=72,
                default=20,
                step=1,
                tooltip="Sets the width of the diamond cells.",
            ),
            "rotation": ParameterControl(
                label="Mesh Angle",
                minimum=-180,
                maximum=180,
                default=15,
                step=5,
                tooltip="Rotate the diamond grid for different weave directions.",
            ),
        },
    ),
    "Glitch Strata": AlgorithmSpec(
        parameters=("amplitude", "period", "frequency"),
        controls={
            "amplitude": ParameterControl(
                label="Glitch Strength",
                minimum=0,
                maximum=300,
                default=220,
                step=5,
                tooltip="Mix in more displaced rows for a heavier glitch.",
            ),
            "period": ParameterControl(
                label="Shift Distance",
                minimum=2,
                maximum=64,
                default=20,
                step=1,
                tooltip="Sets how far rows slide horizontally.",
            ),
            "frequency": ParameterControl(
                label="Glitch Density",
                minimum=1,
                maximum=40,
                default=10,
                step=1,
                tooltip="Determines how often rows pick up a glitch shift.",
            ),
        },
    ),
}

_DEFAULT_SPEC = AlgorithmSpec(parameters=())


def parameter_control(name: str, spec: AlgorithmSpec | None = None) -> ParameterControl:
    """Return the UI control metadata for a parameter."""

    if spec and name in spec.controls:
        return spec.controls[name]
    return DEFAULT_PARAMETER_CONTROLS[name]


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
