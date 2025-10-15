"""Definitions for supported dithering algorithms and lookup helpers."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple

import numpy as np


@dataclass(frozen=True)
class DitherAlgorithm:
    """Description of a dithering algorithm.

    Attributes
    ----------
    name:
        Human readable name shown in the UI.
    kind:
        Either ``"error_diffusion"``, ``"ordered"`` or ``"random"``.
    kernel:
        Diffusion kernel expressed as ``(dy, dx, weight)`` triples.
    matrix:
        Threshold matrix for ordered dithers.
    description:
        Short blurb for tooltips.
    """

    name: str
    kind: str
    kernel: Tuple[Tuple[int, int, float], ...] | None = None
    matrix: np.ndarray | None = None
    description: str = ""


# --- Error diffusion kernels -------------------------------------------------


def _normalise_kernel(pairs: Iterable[Tuple[int, int, float]]) -> Tuple[Tuple[int, int, float], ...]:
    pairs = tuple(pairs)
    weight = sum(w for _, _, w in pairs)
    if not np.isclose(weight, 0.0):
        pairs = tuple((dy, dx, w / weight) for dy, dx, w in pairs)
    return pairs


ERROR_DIFFUSION_KERNELS: Dict[str, Tuple[Tuple[int, int, float], ...]] = {
    "Floyd-Steinberg": _normalise_kernel(
        [
            (0, 1, 7 / 16),
            (1, -1, 3 / 16),
            (1, 0, 5 / 16),
            (1, 1, 1 / 16),
        ]
    ),
    "Jarvis-Judice-Ninke": _normalise_kernel(
        [
            (0, 1, 7),
            (0, 2, 5),
            (1, -2, 3),
            (1, -1, 5),
            (1, 0, 7),
            (1, 1, 5),
            (1, 2, 3),
            (2, -2, 1),
            (2, -1, 3),
            (2, 0, 5),
            (2, 1, 3),
            (2, 2, 1),
        ]
    ),
    "Stucki": _normalise_kernel(
        [
            (0, 1, 8),
            (0, 2, 4),
            (1, -2, 2),
            (1, -1, 4),
            (1, 0, 8),
            (1, 1, 4),
            (1, 2, 2),
            (2, -2, 1),
            (2, -1, 2),
            (2, 0, 4),
            (2, 1, 2),
            (2, 2, 1),
        ]
    ),
    "Atkinson": _normalise_kernel(
        [
            (0, 1, 1 / 8),
            (0, 2, 1 / 8),
            (1, -1, 1 / 8),
            (1, 0, 1 / 8),
            (1, 1, 1 / 8),
            (2, 0, 1 / 8),
        ]
    ),
    "Burkes": _normalise_kernel(
        [
            (0, 1, 8),
            (0, 2, 4),
            (1, -2, 2),
            (1, -1, 4),
            (1, 0, 8),
            (1, 1, 4),
            (1, 2, 2),
        ]
    ),
    "Sierra (2-row)": _normalise_kernel(
        [
            (0, 1, 5),
            (0, 2, 3),
            (1, -2, 2),
            (1, -1, 4),
            (1, 0, 5),
            (1, 1, 4),
            (1, 2, 2),
        ]
    ),
    "Sierra Lite (2-4A)": _normalise_kernel(
        [
            (0, 1, 2),
            (0, 2, 1),
            (1, -1, 1),
            (1, 0, 1),
            (1, 1, 1),
        ]
    ),
}


# --- Ordered matrices ---------------------------------------------------------


def _bayer_matrix(n: int) -> np.ndarray:
    if n == 2:
        base = np.array([[0, 2], [3, 1]], dtype=np.float32)
    else:
        prev = _bayer_matrix(n // 2)
        tile = np.block(
            [
                [4 * prev + 0, 4 * prev + 2],
                [4 * prev + 3, 4 * prev + 1],
            ]
        )
        base = tile
    return base / (n * n)


BAYER_MATRICES: Dict[str, np.ndarray] = {
    "Bayer 2x2": _bayer_matrix(2),
    "Bayer 4x4": _bayer_matrix(4),
    "Bayer 8x8": _bayer_matrix(8),
}


CLUSTERED_DOT_MATRIX = np.array(
    [
        [0, 32, 8, 40, 2, 34, 10, 42],
        [48, 16, 56, 24, 50, 18, 58, 26],
        [12, 44, 4, 36, 14, 46, 6, 38],
        [60, 28, 52, 20, 62, 30, 54, 22],
        [3, 35, 11, 43, 1, 33, 9, 41],
        [51, 19, 59, 27, 49, 17, 57, 25],
        [15, 47, 7, 39, 13, 45, 5, 37],
        [63, 31, 55, 23, 61, 29, 53, 21],
    ],
    dtype=np.float32,
) / 64.0


# --- Registry -----------------------------------------------------------------


def _build_registry() -> Dict[str, DitherAlgorithm]:
    registry: Dict[str, DitherAlgorithm] = {}

    for name, kernel in ERROR_DIFFUSION_KERNELS.items():
        registry[name] = DitherAlgorithm(
            name=name,
            kind="error_diffusion",
            kernel=kernel,
            description="Classic error diffusion with tunable serpentine scanning.",
        )

    for name, matrix in BAYER_MATRICES.items():
        registry[name] = DitherAlgorithm(
            name=name,
            kind="ordered",
            matrix=matrix,
            description="Ordered dithering using a Bayer threshold matrix.",
        )

    registry["Clustered Dot (ordered)"] = DitherAlgorithm(
        name="Clustered Dot (ordered)",
        kind="ordered",
        matrix=CLUSTERED_DOT_MATRIX,
        description="Clustered dot halftone pattern reminiscent of offset printing.",
    )

    registry["Random"] = DitherAlgorithm(
        name="Random",
        kind="random",
        description="Adds noise before quantisation for a stochastic effect.",
    )

    return registry


DITHER_ALGORITHMS: Dict[str, DitherAlgorithm] = _build_registry()


def algorithm_names() -> List[str]:
    """Return algorithm names in insertion order for UI bindings."""

    return list(DITHER_ALGORITHMS.keys())


def get_algorithm(name: str) -> DitherAlgorithm:
    """Fetch algorithm definition, raising ``KeyError`` if missing."""

    return DITHER_ALGORITHMS[name]


__all__ = ["DitherAlgorithm", "DITHER_ALGORITHMS", "algorithm_names", "get_algorithm"]
