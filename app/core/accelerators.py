"""Optional accelerator helpers for heavy image operations."""
from __future__ import annotations

from typing import Optional

import numpy as np

try:  # pragma: no cover - optional dependency
    from numba import njit
except Exception:  # pragma: no cover - optional dependency
    njit = None  # type: ignore


_error_diffusion_kernel = None


if njit is not None:  # pragma: no cover - compiled at runtime

    @njit(cache=True)
    def _numba_error_diffusion(
        buffer: np.ndarray,
        threshold: float,
        offsets: np.ndarray,
        weights: np.ndarray,
    ) -> np.ndarray:
        height, width, channels = buffer.shape
        for y in range(height):
            for x in range(width):
                for channel in range(channels):
                    old_pixel = buffer[y, x, channel]
                    new_pixel = 255.0 if old_pixel > threshold else 0.0
                    error = old_pixel - new_pixel
                    buffer[y, x, channel] = new_pixel
                    for idx in range(offsets.shape[0]):
                        ny = y + offsets[idx, 1]
                        nx = x + offsets[idx, 0]
                        if 0 <= nx < width and 0 <= ny < height:
                            buffer[ny, nx, channel] += error * weights[idx]
        return buffer


    _error_diffusion_kernel = _numba_error_diffusion


def error_diffusion_accelerated(
    image: np.ndarray,
    threshold: float,
    offsets: np.ndarray,
    weights: np.ndarray,
) -> Optional[np.ndarray]:
    """Run the error diffusion loop using numba when available."""

    if _error_diffusion_kernel is None:
        return None

    buffer = np.ascontiguousarray(image.copy())
    offsets = np.ascontiguousarray(offsets.astype(np.int32))
    weights = np.ascontiguousarray(weights.astype(np.float32))
    result = _error_diffusion_kernel(buffer, float(threshold), offsets, weights)
    return np.clip(result, 0, 255)
