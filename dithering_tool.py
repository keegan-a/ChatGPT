# -*- coding: utf-8 -*-
"""Standalone Dithering Tool GUI application.

This module implements a PySide6 based GUI that exposes a feature rich
image dithering workflow.  The application offers a live preview of the
original and dithered images side by side and provides numerous controls
for palette configuration, pre-processing adjustments, and dithering
algorithms.  The implementation purposely avoids platform specific code
so that it can run on Windows (including ARM64) and other platforms
without modification as long as the required pure Python dependencies
are available.
"""
from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageFilter
from PySide6 import QtCore, QtGui, QtWidgets


# ----------------------------------------------------------------------------
# Utility helpers
# ----------------------------------------------------------------------------

def srgb_to_linear(channel: np.ndarray) -> np.ndarray:
    """Convert sRGB values (0-1 range) to linear light."""
    a = 0.055
    linear = np.where(
        channel <= 0.04045,
        channel / 12.92,
        ((channel + a) / (1 + a)) ** 2.4,
    )
    return linear


def linear_to_srgb(channel: np.ndarray) -> np.ndarray:
    """Convert linear light values to sRGB (0-1 range)."""
    a = 0.055
    srgb = np.where(
        channel <= 0.0031308,
        channel * 12.92,
        (1 + a) * np.power(channel, 1 / 2.4) - a,
    )
    return srgb


def clamp01(data: np.ndarray) -> np.ndarray:
    """Clamp an array to the [0, 1] range."""
    return np.clip(data, 0.0, 1.0)


def ensure_uint8(image: np.ndarray) -> np.ndarray:
    """Return an uint8 copy of *image* in the 0-255 range."""
    img = np.clip(image, 0.0, 1.0)
    return (img * 255).astype(np.uint8)


def from_uint8(image: np.ndarray) -> np.ndarray:
    """Convert a uint8 image to float32 0-1 range."""
    if image.dtype == np.uint8:
        return image.astype(np.float32) / 255.0
    if image.dtype == np.uint16:
        return image.astype(np.float32) / 65535.0
    return image.astype(np.float32)


def argmin_distance(pixel: np.ndarray, palette: np.ndarray) -> int:
    """Return index of nearest palette color to *pixel*."""
    diff = palette - pixel
    dist = np.sum(diff * diff, axis=1)
    return int(np.argmin(dist))


def palette_to_qimage(palette: np.ndarray, swatch_size: int = 24) -> QtGui.QImage:
    """Return a QImage containing palette swatches for display."""
    if palette.size == 0:
        palette = np.zeros((1, 3), dtype=np.float32)
    count = palette.shape[0]
    width = swatch_size * count
    height = swatch_size
    img = np.zeros((height, width, 3), dtype=np.float32)
    for i, color in enumerate(palette):
        img[:, i * swatch_size : (i + 1) * swatch_size, :] = color
    img_uint8 = ensure_uint8(img)
    qimage = QtGui.QImage(
        img_uint8.data,
        width,
        height,
        width * 3,
        QtGui.QImage.Format_RGB888,
    )
    return qimage.copy()


# ----------------------------------------------------------------------------
# Error diffusion kernels
# ----------------------------------------------------------------------------

ERROR_DIFFUSION_KERNELS: Dict[str, List[Tuple[int, int, float]]] = {
    "Floyd-Steinberg": [(1, 0, 7 / 16), (-1, 1, 3 / 16), (0, 1, 5 / 16), (1, 1, 1 / 16)],
    "Jarvis-Judice-Ninke": [
        (1, 0, 7 / 48),
        (2, 0, 5 / 48),
        (-2, 1, 3 / 48),
        (-1, 1, 5 / 48),
        (0, 1, 7 / 48),
        (1, 1, 5 / 48),
        (2, 1, 3 / 48),
        (-2, 2, 1 / 48),
        (-1, 2, 3 / 48),
        (0, 2, 5 / 48),
        (1, 2, 3 / 48),
        (2, 2, 1 / 48),
    ],
    "Stucki": [
        (1, 0, 8 / 42),
        (2, 0, 4 / 42),
        (-2, 1, 2 / 42),
        (-1, 1, 4 / 42),
        (0, 1, 8 / 42),
        (1, 1, 4 / 42),
        (2, 1, 2 / 42),
        (-2, 2, 1 / 42),
        (-1, 2, 2 / 42),
        (0, 2, 4 / 42),
        (1, 2, 2 / 42),
        (2, 2, 1 / 42),
    ],
    "Atkinson": [
        (1, 0, 1 / 8),
        (2, 0, 1 / 8),
        (-1, 1, 1 / 8),
        (0, 1, 1 / 8),
        (1, 1, 1 / 8),
        (0, 2, 1 / 8),
    ],
    "Burkes": [
        (1, 0, 8 / 32),
        (2, 0, 4 / 32),
        (-2, 1, 2 / 32),
        (-1, 1, 4 / 32),
        (0, 1, 8 / 32),
        (1, 1, 4 / 32),
        (2, 1, 2 / 32),
    ],
    "Sierra (2-row)": [
        (1, 0, 5 / 32),
        (2, 0, 3 / 32),
        (-2, 1, 2 / 32),
        (-1, 1, 4 / 32),
        (0, 1, 5 / 32),
        (1, 1, 4 / 32),
        (2, 1, 2 / 32),
    ],
    "Sierra Lite (2-4A)": [
        (1, 0, 2 / 4),
        (-1, 1, 1 / 4),
        (0, 1, 1 / 4),
    ],
}


# ----------------------------------------------------------------------------
# Ordered dithering matrices
# ----------------------------------------------------------------------------

ORDERED_MATRICES: Dict[str, np.ndarray] = {
    "Bayer 2x2": np.array([[0, 2], [3, 1]], dtype=np.float32) / 4.0,
    "Bayer 4x4": (
        np.array(
            [
                [0, 8, 2, 10],
                [12, 4, 14, 6],
                [3, 11, 1, 9],
                [15, 7, 13, 5],
            ],
            dtype=np.float32,
        )
        / 16.0
    ),
    "Bayer 8x8": (
        np.array(
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
        )
        / 64.0
    ),
    "Clustered Dot (ordered)": (
        np.array(
            [
                [8, 3, 4, 9],
                [2, 1, 0, 5],
                [7, 6, 11, 10],
                [12, 13, 14, 15],
            ],
            dtype=np.float32,
        )
        / 16.0
    ),
}


PRESET_PALETTES: Dict[str, List[Tuple[int, int, int]]] = {
    "GameBoy (4 colors)": [(15, 56, 15), (48, 98, 48), (139, 172, 15), (155, 188, 15)],
    "NES (16 colors)": [
        (124, 124, 124),
        (0, 0, 252),
        (0, 0, 188),
        (68, 40, 188),
        (148, 0, 132),
        (168, 0, 32),
        (168, 16, 0),
        (136, 20, 0),
        (80, 48, 0),
        (0, 120, 0),
        (0, 104, 0),
        (0, 88, 0),
        (0, 64, 88),
        (0, 0, 0),
        (188, 188, 188),
        (0, 120, 248),
    ],
    "CGA (16 colors)": [
        (0, 0, 0),
        (0, 0, 170),
        (0, 170, 0),
        (0, 170, 170),
        (170, 0, 0),
        (170, 0, 170),
        (170, 85, 0),
        (170, 170, 170),
        (85, 85, 85),
        (85, 85, 255),
        (85, 255, 85),
        (85, 255, 255),
        (255, 85, 85),
        (255, 85, 255),
        (255, 255, 85),
        (255, 255, 255),
    ],
}


@dataclass
class AdjustmentSettings:
    brightness: float = 0.0  # range -1 .. 1
    contrast: float = 0.0  # range -1 .. 1
    gamma: float = 1.0  # >0
    blur_radius: float = 0.0  # Gaussian sigma
    sharpen_amount: float = 0.0  # 0..2
    denoise: bool = False


@dataclass
class DitherSettings:
    algorithm: str = "Floyd-Steinberg"
    serpentine: bool = True
    num_colors: int = 8
    palette_mode: str = "Original Image Palette"
    preserve_brightness: bool = False
    transparent_background: bool = False
    custom_palette: Optional[np.ndarray] = None


@dataclass
class DitherResult:
    image: np.ndarray
    palette: np.ndarray = field(default_factory=lambda: np.zeros((0, 3), dtype=np.float32))


# ----------------------------------------------------------------------------
# Dithering Engine
# ----------------------------------------------------------------------------


class DitheringEngine:
    """Encapsulates image adjustments, palette generation and dithering."""

    def __init__(self) -> None:
        self.random_state = np.random.RandomState(0)

    # -- Adjustments -----------------------------------------------------
    def apply_adjustments(
        self, image: np.ndarray, adjustments: AdjustmentSettings
    ) -> np.ndarray:
        """Return a new image with adjustments applied."""
        if image.ndim != 3:
            raise ValueError("Expected 3-channel image array")

        img = from_uint8(image)
        rgb = img[:, :, :3]
        alpha = img[:, :, 3:] if img.shape[2] == 4 else None

        # Brightness adjustment: simple offset
        if adjustments.brightness != 0.0:
            rgb = clamp01(rgb + adjustments.brightness)

        # Contrast adjustment around midpoint 0.5
        if adjustments.contrast != 0.0:
            factor = 1.0 + adjustments.contrast
            rgb = clamp01((rgb - 0.5) * factor + 0.5)

        # Gamma/exposure
        if not math.isclose(adjustments.gamma, 1.0):
            rgb = clamp01(np.power(rgb, max(adjustments.gamma, 1e-5)))

        # Blur and denoise use OpenCV/Pillow style operations on uint8 data.
        rgb_uint8 = ensure_uint8(rgb)

        if adjustments.blur_radius > 0.0:
            sigma = max(adjustments.blur_radius, 0.01)
            # Use cv2 Gaussian blur when available, fall back to Pillow otherwise.
            try:
                import cv2  # local import to keep module load fast

                rgb_uint8 = cv2.GaussianBlur(rgb_uint8, (0, 0), sigmaX=sigma, sigmaY=sigma)
            except Exception:
                pil = Image.fromarray(rgb_uint8, mode="RGB")
                rgb_uint8 = np.array(
                    pil.filter(ImageFilter.GaussianBlur(radius=sigma)), dtype=np.uint8
                )

        if adjustments.denoise:
            try:
                import cv2

                rgb_uint8 = cv2.fastNlMeansDenoisingColored(rgb_uint8, None, 10, 10, 7, 21)
            except Exception:
                # Provide a light fallback using Pillow median filter
                pil = Image.fromarray(rgb_uint8, mode="RGB")
                rgb_uint8 = np.array(pil.filter(ImageFilter.MedianFilter(size=3)), dtype=np.uint8)

        rgb = from_uint8(rgb_uint8)

        if adjustments.sharpen_amount > 0.0:
            amount = adjustments.sharpen_amount
            try:
                import cv2

                blurred = cv2.GaussianBlur(rgb, (0, 0), sigmaX=1.0)
                rgb = clamp01(rgb + amount * (rgb - blurred))
            except Exception:
                pil = Image.fromarray(ensure_uint8(rgb), mode="RGB")
                enhanced = pil.filter(ImageFilter.UnsharpMask(percent=int(amount * 200), radius=1))
                rgb = from_uint8(np.array(enhanced, dtype=np.uint8))

        if alpha is not None:
            img = np.dstack([rgb, alpha])
        else:
            img = rgb

        return img

    # -- Palette generation ----------------------------------------------
    def generate_palette(
        self,
        image: np.ndarray,
        settings: DitherSettings,
    ) -> np.ndarray:
        """Create the palette used for dithering."""
        mode = settings.palette_mode
        num_colors = max(2, int(settings.num_colors))

        if settings.custom_palette is not None and mode.startswith("Custom"):
            palette = settings.custom_palette
            return palette[:num_colors]

        if mode == "Grayscale":
            colors = np.linspace(0, 1, num_colors)
            palette = np.stack([colors, colors, colors], axis=1)
            return palette.astype(np.float32)

        if mode in PRESET_PALETTES:
            palette_list = PRESET_PALETTES[mode]
            palette = np.array(palette_list, dtype=np.float32) / 255.0
            return palette[:num_colors]

        # Adaptive palette from image using Pillow's quantize implementation.
        pil_image = Image.fromarray(ensure_uint8(image[:, :, :3]), mode="RGB")
        quantized = pil_image.quantize(colors=num_colors, method=Image.MEDIANCUT, dither=Image.NONE)
        palette_bytes = quantized.getpalette()[: num_colors * 3]
        palette_array = np.array(palette_bytes, dtype=np.float32).reshape(-1, 3) / 255.0
        if palette_array.shape[0] == 0:
            palette_array = np.array([[0.0, 0.0, 0.0]], dtype=np.float32)
        return palette_array

    # -- Dithering entry point -------------------------------------------
    def dither(
        self,
        image: np.ndarray,
        adjustments: AdjustmentSettings,
        settings: DitherSettings,
    ) -> DitherResult:
        if image is None:
            raise ValueError("No image data provided for dithering")

        adjusted = self.apply_adjustments(image, adjustments)
        palette = self.generate_palette(adjusted, settings)

        # Convert to linear space if requested
        work_rgb = adjusted[:, :, :3]
        alpha = adjusted[:, :, 3] if adjusted.shape[2] == 4 else None
        if settings.preserve_brightness:
            work_rgb = srgb_to_linear(work_rgb)

        if settings.algorithm in ERROR_DIFFUSION_KERNELS:
            result_rgb = self._error_diffusion(work_rgb, palette, settings)
        elif settings.algorithm in ORDERED_MATRICES:
            matrix = ORDERED_MATRICES[settings.algorithm]
            result_rgb = self._ordered_dither(work_rgb, palette, matrix)
        elif settings.algorithm == "Random":
            result_rgb = self._random_dither(work_rgb, palette)
        else:
            # Fallback to Floyd-Steinberg
            result_rgb = self._error_diffusion(work_rgb, palette, settings)

        if settings.preserve_brightness:
            result_rgb = linear_to_srgb(clamp01(result_rgb))

        result_rgb = clamp01(result_rgb)

        if alpha is not None:
            if settings.transparent_background:
                alpha_channel = alpha[:, :, np.newaxis]
            else:
                alpha_channel = self._dither_alpha(alpha, settings)[:, :, np.newaxis]
            result = np.dstack([result_rgb, clamp01(alpha_channel)])
        else:
            result = result_rgb

        return DitherResult(result, palette)

    # -- Error diffusion implementation ----------------------------------
    def _error_diffusion(
        self,
        image: np.ndarray,
        palette: np.ndarray,
        settings: DitherSettings,
    ) -> np.ndarray:
        kernel = ERROR_DIFFUSION_KERNELS.get(settings.algorithm) or ERROR_DIFFUSION_KERNELS[
            "Floyd-Steinberg"
        ]
        h, w, c = image.shape
        work = image.copy()
        output = np.zeros_like(work)

        serpentine = settings.serpentine

        for y in range(h):
            if serpentine and y % 2 == 1:
                x_range = range(w - 1, -1, -1)
                direction = -1
            else:
                x_range = range(w)
                direction = 1
            for x in x_range:
                old_pixel = work[y, x]
                idx = argmin_distance(old_pixel, palette)
                new_pixel = palette[idx]
                output[y, x] = new_pixel
                error = old_pixel - new_pixel
                for dx, dy, weight in kernel:
                    nx = x + dx * direction
                    ny = y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        work[ny, nx] += error * weight
        return output

    # -- Ordered dithering implementation --------------------------------
    def _ordered_dither(
        self,
        image: np.ndarray,
        palette: np.ndarray,
        matrix: np.ndarray,
    ) -> np.ndarray:
        h, w, c = image.shape
        tile_h, tile_w = matrix.shape
        threshold = matrix - 0.5
        output = np.zeros_like(image)
        for y in range(h):
            for x in range(w):
                offset = threshold[y % tile_h, x % tile_w]
                noisy = clamp01(image[y, x] + offset / max(len(palette), 2))
                idx = argmin_distance(noisy, palette)
                output[y, x] = palette[idx]
        return output

    # -- Random dithering ------------------------------------------------
    def _random_dither(self, image: np.ndarray, palette: np.ndarray) -> np.ndarray:
        h, w, c = image.shape
        noise = self.random_state.uniform(-1.0 / len(palette), 1.0 / len(palette), size=image.shape)
        noisy = clamp01(image + noise)
        output = np.zeros_like(image)
        flat_palette = palette
        for y in range(h):
            for x in range(w):
                idx = argmin_distance(noisy[y, x], flat_palette)
                output[y, x] = flat_palette[idx]
        return output

    # -- Alpha dithering -------------------------------------------------
    def _dither_alpha(self, alpha: np.ndarray, settings: DitherSettings) -> np.ndarray:
        if settings.algorithm in ERROR_DIFFUSION_KERNELS:
            kernel = ERROR_DIFFUSION_KERNELS.get(settings.algorithm) or ERROR_DIFFUSION_KERNELS[
                "Floyd-Steinberg"
            ]
            return self._error_diffusion_gray(alpha, kernel, settings.serpentine)
        if settings.algorithm in ORDERED_MATRICES:
            matrix = ORDERED_MATRICES[settings.algorithm]
            return self._ordered_dither_gray(alpha, matrix)
        if settings.algorithm == "Random":
            return self._random_dither_gray(alpha)
        kernel = ERROR_DIFFUSION_KERNELS["Floyd-Steinberg"]
        return self._error_diffusion_gray(alpha, kernel, settings.serpentine)

    def _error_diffusion_gray(
        self,
        image: np.ndarray,
        kernel: List[Tuple[int, int, float]],
        serpentine: bool,
    ) -> np.ndarray:
        h, w = image.shape
        work = image.copy()
        output = np.zeros_like(work)
        for y in range(h):
            if serpentine and y % 2 == 1:
                x_range = range(w - 1, -1, -1)
                direction = -1
            else:
                x_range = range(w)
                direction = 1
            for x in x_range:
                old = work[y, x]
                new = 1.0 if old >= 0.5 else 0.0
                output[y, x] = new
                error = old - new
                for dx, dy, weight in kernel:
                    nx = x + dx * direction
                    ny = y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        work[ny, nx] += error * weight
        return output

    def _ordered_dither_gray(self, image: np.ndarray, matrix: np.ndarray) -> np.ndarray:
        h, w = image.shape
        tile_h, tile_w = matrix.shape
        threshold = matrix - 0.5
        output = np.zeros_like(image)
        for y in range(h):
            for x in range(w):
                offset = threshold[y % tile_h, x % tile_w]
                value = clamp01(image[y, x] + offset)
                output[y, x] = 1.0 if value >= 0.5 else 0.0
        return output

    def _random_dither_gray(self, image: np.ndarray) -> np.ndarray:
        noise = self.random_state.uniform(-0.5, 0.5, size=image.shape)
        value = clamp01(image + noise)
        return (value >= 0.5).astype(np.float32)


# ----------------------------------------------------------------------------
# Qt Worker infrastructure
# ----------------------------------------------------------------------------


class WorkerSignals(QtCore.QObject):
    finished = QtCore.Signal(int, DitherResult)
    failed = QtCore.Signal(int, str)


class DitherTask(QtCore.QRunnable):
    def __init__(
        self,
        engine: DitheringEngine,
        image: np.ndarray,
        adjustments: AdjustmentSettings,
        settings: DitherSettings,
        task_id: int,
    ) -> None:
        super().__init__()
        self.engine = engine
        self.image = image
        self.adjustments = adjustments
        self.settings = settings
        self.task_id = task_id
        self.signals = WorkerSignals()

    @QtCore.Slot()
    def run(self) -> None:
        try:
            result = self.engine.dither(self.image, self.adjustments, self.settings)
        except Exception as exc:  # pragma: no cover - runtime diagnostics
            self.signals.failed.emit(self.task_id, str(exc))
            return
        self.signals.finished.emit(self.task_id, result)


# ----------------------------------------------------------------------------
# Qt Widgets
# ----------------------------------------------------------------------------


class ImagePreview(QtWidgets.QWidget):
    """Widget showing original and dithered images."""

    def __init__(self, parent: Optional[QtWidgets.QWidget] = None) -> None:
        super().__init__(parent)
        self.original_pixmap: Optional[QtGui.QPixmap] = None
        self.dithered_pixmap: Optional[QtGui.QPixmap] = None

        layout = QtWidgets.QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        self.splitter = QtWidgets.QSplitter(QtCore.Qt.Horizontal)
        layout.addWidget(self.splitter)

        self.original_label = self._create_image_panel("Original")
        self.dithered_label = self._create_image_panel("Dithered")

    def _create_image_panel(self, title: str) -> QtWidgets.QLabel:
        container = QtWidgets.QWidget()
        vbox = QtWidgets.QVBoxLayout(container)
        vbox.setContentsMargins(4, 4, 4, 4)
        caption = QtWidgets.QLabel(f"<b>{title}</b>")
        caption.setAlignment(QtCore.Qt.AlignHCenter)
        vbox.addWidget(caption)
        label = QtWidgets.QLabel()
        label.setAlignment(QtCore.Qt.AlignCenter)
        label.setSizePolicy(QtWidgets.QSizePolicy.Expanding, QtWidgets.QSizePolicy.Expanding)
        label.setBackgroundRole(QtGui.QPalette.Base)
        label.setAutoFillBackground(True)
        vbox.addWidget(label, 1)
        self.splitter.addWidget(container)
        return label

    def set_original(self, image: np.ndarray) -> None:
        self.original_pixmap = self._array_to_pixmap(image)
        self._update_labels()

    def set_dithered(self, image: np.ndarray) -> None:
        self.dithered_pixmap = self._array_to_pixmap(image)
        self._update_labels()

    def _array_to_pixmap(self, image: np.ndarray) -> QtGui.QPixmap:
        if image is None:
            return QtGui.QPixmap()
        data = ensure_uint8(image)
        h, w, c = data.shape
        if c == 4:
            fmt = QtGui.QImage.Format_RGBA8888
        else:
            fmt = QtGui.QImage.Format_RGB888
        qimage = QtGui.QImage(data.data, w, h, w * c, fmt)
        return QtGui.QPixmap.fromImage(qimage.copy())

    def resizeEvent(self, event: QtGui.QResizeEvent) -> None:  # noqa: N802 - Qt signature
        super().resizeEvent(event)
        self._update_labels()

    def _scaled(self, pixmap: Optional[QtGui.QPixmap]) -> QtGui.QPixmap:
        if not pixmap:
            return QtGui.QPixmap()
        area = self.original_label.size()
        return pixmap.scaled(area, QtCore.Qt.KeepAspectRatio, QtCore.Qt.SmoothTransformation)

    def _update_labels(self) -> None:
        if self.original_pixmap:
            scaled = self.original_pixmap.scaled(
                self.original_label.size(),
                QtCore.Qt.KeepAspectRatio,
                QtCore.Qt.SmoothTransformation,
            )
            self.original_label.setPixmap(scaled)
        if self.dithered_pixmap:
            scaled = self.dithered_pixmap.scaled(
                self.dithered_label.size(),
                QtCore.Qt.KeepAspectRatio,
                QtCore.Qt.SmoothTransformation,
            )
            self.dithered_label.setPixmap(scaled)


class ControlPanel(QtWidgets.QScrollArea):
    """Scrollable container for all control widgets."""

    settings_changed = QtCore.Signal()
    load_custom_palette = QtCore.Signal()

    def __init__(self, parent: Optional[QtWidgets.QWidget] = None) -> None:
        super().__init__(parent)
        self.setWidgetResizable(True)
        content = QtWidgets.QWidget()
        self.setWidget(content)
        self.layout = QtWidgets.QVBoxLayout(content)
        self.layout.setAlignment(QtCore.Qt.AlignTop)

        self._build_controls()

    def _build_controls(self) -> None:
        # Buttons
        self.load_button = QtWidgets.QPushButton("Load Image…")
        self.save_button = QtWidgets.QPushButton("Save Dithered Image…")
        self.reset_button = QtWidgets.QPushButton("Reset Settings")

        self.layout.addWidget(self.load_button)
        self.layout.addWidget(self.save_button)
        self.layout.addWidget(self.reset_button)

        self.layout.addSpacing(12)

        # Algorithm selection
        self.algorithm_combo = QtWidgets.QComboBox()
        for name in list(ERROR_DIFFUSION_KERNELS.keys()) + list(ORDERED_MATRICES.keys()) + ["Random"]:
            self.algorithm_combo.addItem(name)
        self.serpentine_checkbox = QtWidgets.QCheckBox("Serpentine scanning")
        self.serpentine_checkbox.setChecked(True)

        self.layout.addWidget(QtWidgets.QLabel("<b>Dithering Algorithm</b>"))
        self.layout.addWidget(self.algorithm_combo)
        self.layout.addWidget(self.serpentine_checkbox)

        self.layout.addSpacing(12)

        # Palette controls
        palette_group = QtWidgets.QGroupBox("Palette")
        palette_layout = QtWidgets.QFormLayout(palette_group)
        self.num_colors_spin = QtWidgets.QSpinBox()
        self.num_colors_spin.setRange(2, 64)
        self.num_colors_spin.setValue(8)
        palette_layout.addRow("Number of Colors", self.num_colors_spin)

        self.palette_combo = QtWidgets.QComboBox()
        self.palette_combo.addItems(
            ["Original Image Palette", "Grayscale"] + list(PRESET_PALETTES.keys()) + ["Custom Palette (load…)"]
        )
        palette_layout.addRow("Palette Mode", self.palette_combo)

        self.custom_palette_button = QtWidgets.QPushButton("Load Custom Palette…")
        self.custom_palette_button.setEnabled(False)
        palette_layout.addRow(self.custom_palette_button)

        self.palette_preview_label = QtWidgets.QLabel("Palette preview")
        self.palette_preview_label.setAlignment(QtCore.Qt.AlignCenter)
        palette_layout.addRow(self.palette_preview_label)

        self.layout.addWidget(palette_group)

        # Advanced options
        advanced_group = QtWidgets.QGroupBox("Advanced Options")
        advanced_layout = QtWidgets.QVBoxLayout(advanced_group)
        self.preserve_brightness_checkbox = QtWidgets.QCheckBox("Preserve Brightness (linear RGB)")
        self.transparent_background_checkbox = QtWidgets.QCheckBox("Preserve Transparency")
        advanced_layout.addWidget(self.preserve_brightness_checkbox)
        advanced_layout.addWidget(self.transparent_background_checkbox)
        self.layout.addWidget(advanced_group)

        # Adjustments
        self.layout.addWidget(QtWidgets.QLabel("<b>Adjustments</b>"))
        self.brightness_slider = self._create_slider(-100, 100, 0, "Brightness")
        self.contrast_slider = self._create_slider(-100, 100, 0, "Contrast")
        self.gamma_slider = self._create_slider(10, 400, 100, "Gamma (x0.01)")
        self.blur_slider = self._create_slider(0, 50, 0, "Blur radius (x0.1)")
        self.sharpen_slider = self._create_slider(0, 200, 0, "Sharpen amount (x0.01)")
        self.denoise_checkbox = QtWidgets.QCheckBox("Denoise image")
        self.layout.addWidget(self.denoise_checkbox)

        self.layout.addStretch(1)

        # connect signals
        for widget in [
            self.algorithm_combo,
            self.serpentine_checkbox,
            self.num_colors_spin,
            self.palette_combo,
            self.preserve_brightness_checkbox,
            self.transparent_background_checkbox,
            self.denoise_checkbox,
            self.brightness_slider,
            self.contrast_slider,
            self.gamma_slider,
            self.blur_slider,
            self.sharpen_slider,
        ]:
            if isinstance(widget, QtWidgets.QAbstractButton):
                widget.toggled.connect(self.settings_changed)
            elif isinstance(widget, QtWidgets.QAbstractSlider):
                widget.valueChanged.connect(self.settings_changed)
            else:
                widget.currentIndexChanged.connect(self.settings_changed)

        self.custom_palette_button.clicked.connect(self.load_custom_palette)
        self.palette_combo.currentIndexChanged.connect(self._palette_mode_changed)

    def _create_slider(self, min_value: int, max_value: int, default: int, title: str) -> QtWidgets.QSlider:
        label = QtWidgets.QLabel(title)
        self.layout.addWidget(label)
        slider = QtWidgets.QSlider(QtCore.Qt.Horizontal)
        slider.setRange(min_value, max_value)
        slider.setValue(default)
        slider.setSingleStep(1)
        self.layout.addWidget(slider)
        return slider

    def _palette_mode_changed(self) -> None:
        mode = self.palette_combo.currentText()
        self.custom_palette_button.setEnabled(mode.startswith("Custom"))
        self.settings_changed.emit()

    # Helper methods to read settings from the controls
    def get_adjustments(self) -> AdjustmentSettings:
        return AdjustmentSettings(
            brightness=self.brightness_slider.value() / 100.0,
            contrast=self.contrast_slider.value() / 100.0,
            gamma=max(self.gamma_slider.value() / 100.0, 0.01),
            blur_radius=self.blur_slider.value() / 10.0,
            sharpen_amount=self.sharpen_slider.value() / 100.0,
            denoise=self.denoise_checkbox.isChecked(),
        )

    def get_dither_settings(self) -> DitherSettings:
        return DitherSettings(
            algorithm=self.algorithm_combo.currentText(),
            serpentine=self.serpentine_checkbox.isChecked(),
            num_colors=self.num_colors_spin.value(),
            palette_mode=self.palette_combo.currentText(),
            preserve_brightness=self.preserve_brightness_checkbox.isChecked(),
            transparent_background=self.transparent_background_checkbox.isChecked(),
        )

    def update_palette_preview(self, palette: np.ndarray) -> None:
        qimage = palette_to_qimage(palette)
        self.palette_preview_label.setPixmap(QtGui.QPixmap.fromImage(qimage))

    def reset(self) -> None:
        self.algorithm_combo.setCurrentText("Floyd-Steinberg")
        self.serpentine_checkbox.setChecked(True)
        self.num_colors_spin.setValue(8)
        self.palette_combo.setCurrentIndex(0)
        self.preserve_brightness_checkbox.setChecked(False)
        self.transparent_background_checkbox.setChecked(False)
        self.brightness_slider.setValue(0)
        self.contrast_slider.setValue(0)
        self.gamma_slider.setValue(100)
        self.blur_slider.setValue(0)
        self.sharpen_slider.setValue(0)
        self.denoise_checkbox.setChecked(False)
        self.settings_changed.emit()


# ----------------------------------------------------------------------------
# Main Window
# ----------------------------------------------------------------------------


class MainWindow(QtWidgets.QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("Dithering Tool")
        self.resize(1200, 700)

        self.engine = DitheringEngine()
        self.thread_pool = QtCore.QThreadPool.globalInstance()
        self.current_task: Optional[DitherTask] = None
        self.task_counter = 0
        self.active_task_id = 0

        self.original_image: Optional[np.ndarray] = None
        self.last_result: Optional[DitherResult] = None
        self.custom_palette: Optional[np.ndarray] = None

        central = QtWidgets.QWidget()
        self.setCentralWidget(central)
        layout = QtWidgets.QHBoxLayout(central)

        self.preview = ImagePreview()
        layout.addWidget(self.preview, 2)

        self.controls = ControlPanel()
        layout.addWidget(self.controls, 1)

        # Connect control signals
        self.controls.load_button.clicked.connect(self.load_image)
        self.controls.save_button.clicked.connect(self.save_image)
        self.controls.reset_button.clicked.connect(self.reset_settings)
        self.controls.settings_changed.connect(self.schedule_update)
        self.controls.load_custom_palette.connect(self.load_custom_palette)

        # Timer to coalesce UI changes
        self.update_timer = QtCore.QTimer(self)
        self.update_timer.setInterval(200)
        self.update_timer.setSingleShot(True)
        self.update_timer.timeout.connect(self.start_dither_task)

        self.statusBar().showMessage("Load an image to begin")

    # -- UI Actions ------------------------------------------------------
    def load_image(self) -> None:
        file_path, _ = QtWidgets.QFileDialog.getOpenFileName(
            self,
            "Open Image",
            "",
            "Images (*.png *.jpg *.jpeg *.bmp *.gif *.tif *.tiff)",
        )
        if not file_path:
            return
        try:
            img = imageio.imread(file_path)
        except Exception as exc:
            QtWidgets.QMessageBox.critical(self, "Error", f"Failed to load image: {exc}")
            return

        if img.ndim == 2:
            img = np.stack([img] * 3, axis=-1)
        if img.shape[2] == 3:
            # ensure RGB
            pass
        elif img.shape[2] == 4:
            pass
        else:
            img = img[:, :, :3]
        img = from_uint8(img)
        if img.max() > 1.0:
            img = img / 255.0
        if img.shape[2] == 3:
            self.original_image = img
        else:
            self.original_image = img

        self.preview.set_original(self.original_image)
        self.custom_palette = None
        self.controls.update_palette_preview(np.zeros((0, 3), dtype=np.float32))
        self.statusBar().showMessage(f"Loaded {os.path.basename(file_path)} ({img.shape[1]}x{img.shape[0]})")
        self.schedule_update()

    def save_image(self) -> None:
        if not self.last_result:
            QtWidgets.QMessageBox.information(self, "No image", "Nothing to save yet.")
            return
        file_path, _ = QtWidgets.QFileDialog.getSaveFileName(
            self,
            "Save Dithered Image",
            "dithered.png",
            "PNG Image (*.png);;JPEG Image (*.jpg);;GIF Image (*.gif)",
        )
        if not file_path:
            return
        data = ensure_uint8(self.last_result.image)
        try:
            imageio.imwrite(file_path, data)
        except Exception as exc:
            QtWidgets.QMessageBox.critical(self, "Error", f"Failed to save image: {exc}")
            return
        self.statusBar().showMessage(f"Saved {os.path.basename(file_path)}")

    def reset_settings(self) -> None:
        self.controls.reset()
        self.custom_palette = None
        self.controls.update_palette_preview(np.zeros((0, 3), dtype=np.float32))
        self.schedule_update()

    def schedule_update(self) -> None:
        if self.original_image is None:
            return
        # Cancel pending timer and start a new one
        self.update_timer.start()

    def start_dither_task(self) -> None:
        if self.original_image is None:
            return
        if self.current_task:
            # No direct cancel, but we allow current task to finish while ignoring
            self.current_task = None

        adjustments = self.controls.get_adjustments()
        settings = self.controls.get_dither_settings()
        settings.custom_palette = self.custom_palette

        self.task_counter += 1
        task_id = self.task_counter
        self.active_task_id = task_id

        task = DitherTask(self.engine, self.original_image, adjustments, settings, task_id)
        task.signals.finished.connect(self._dither_finished)
        task.signals.failed.connect(self._dither_failed)
        self.current_task = task
        self.thread_pool.start(task)
        self.statusBar().showMessage("Processing…")

    def _dither_finished(self, task_id: int, result: DitherResult) -> None:
        if task_id != self.active_task_id:
            return
        self.last_result = result
        self.preview.set_dithered(result.image)
        self.controls.update_palette_preview(result.palette)
        self.statusBar().showMessage("Dithering complete")

    def _dither_failed(self, task_id: int, message: str) -> None:
        if task_id != self.active_task_id:
            return
        QtWidgets.QMessageBox.critical(self, "Error", f"Dithering failed: {message}")
        self.statusBar().showMessage("Error during dithering")

    def load_custom_palette(self) -> None:
        file_path, _ = QtWidgets.QFileDialog.getOpenFileName(
            self,
            "Load Palette",
            "",
            "Palette files (*.json *.txt *.png *.jpg *.bmp *.gif)",
        )
        if not file_path:
            return
        try:
            palette = self._parse_palette(file_path)
        except Exception as exc:
            QtWidgets.QMessageBox.critical(self, "Error", f"Failed to load palette: {exc}")
            return
        self.custom_palette = palette
        self.controls.update_palette_preview(palette)
        self.schedule_update()

    # -- Palette loading helpers ----------------------------------------
    def _parse_palette(self, file_path: str) -> np.ndarray:
        ext = os.path.splitext(file_path)[1].lower()
        if ext in {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tif", ".tiff"}:
            palette_image = imageio.imread(file_path)
            if palette_image.ndim == 2:
                palette_image = np.stack([palette_image] * 3, axis=-1)
            palette = np.unique(palette_image.reshape(-1, palette_image.shape[-1]), axis=0)
            palette = palette[:, :3]
            palette = from_uint8(palette)
            return palette

        # For text based palettes we support JSON list or plain hex codes per line.
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        try:
            data = json.loads(content)
            colors = []
            for item in data:
                if isinstance(item, str):
                    colors.append(self._hex_to_rgb(item))
                elif isinstance(item, (list, tuple)) and len(item) >= 3:
                    colors.append(tuple(int(v) for v in item[:3]))
            if not colors:
                raise ValueError("No colors found in JSON palette")
            palette = np.array(colors, dtype=np.float32) / 255.0
            return palette
        except json.JSONDecodeError:
            lines = [line.strip() for line in content.splitlines() if line.strip()]
            colors = [self._hex_to_rgb(line) for line in lines]
            palette = np.array(colors, dtype=np.float32) / 255.0
            return palette

    def _hex_to_rgb(self, value: str) -> Tuple[int, int, int]:
        value = value.strip().lstrip("#")
        if len(value) == 6:
            r = int(value[0:2], 16)
            g = int(value[2:4], 16)
            b = int(value[4:6], 16)
            return (r, g, b)
        if len(value) == 3:
            r = int(value[0] * 2, 16)
            g = int(value[1] * 2, 16)
            b = int(value[2] * 2, 16)
            return (r, g, b)
        raise ValueError(f"Invalid hex color: {value}")


# ----------------------------------------------------------------------------
# Application entry point
# ----------------------------------------------------------------------------


def main() -> None:
    app = QtWidgets.QApplication([])
    window = MainWindow()
    window.show()
    app.exec()


if __name__ == "__main__":  # pragma: no cover - entry point
    main()
