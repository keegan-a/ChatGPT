"""Background image processing pipeline using NumPy for performance."""
from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from PySide6.QtCore import QObject, Signal
from PySide6.QtGui import QImage

from app.core.colour_modes import apply_render_mode
from app.core.dithering import DITHER_ALGORITHMS
from app.core.models import ProcessingRequest
from app.core.utils import convert_qimage


class ImageProcessor(QObject):
    """Manage processing on a worker pool and emit Qt-ready images."""

    processed = Signal(QImage, bool)

    def __init__(self) -> None:
        super().__init__()
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="dither-worker")
        self._request_lock = threading.Lock()
        self._latest_request: ProcessingRequest | None = None
        self._source_image: Image.Image | None = None
        self._preview_cache: QImage | None = None
        self._full_res_cache: QImage | None = None
        self._sequence: int = 0

    # ------------------------------------------------------------------ Properties
    @property
    def available_algorithms(self) -> list[str]:
        return sorted(DITHER_ALGORITHMS.keys())

    @property
    def has_image(self) -> bool:
        return self._source_image is not None

    # ------------------------------------------------------------------ API
    def load_image(self, path: Path) -> None:
        image = Image.open(path).convert("RGB")
        self._source_image = image
        self._preview_cache = None
        self._full_res_cache = None

    def save_output(self, path: Path) -> None:
        if self._full_res_cache is None:
            raise RuntimeError("No rendered image available yet")
        buffer = self._full_res_cache
        buffer.save(path, "PNG")

    def enqueue(self, request: ProcessingRequest) -> None:
        if not self._source_image:
            return

        emit_cached: QImage | None = None
        sequence = self._sequence
        with self._request_lock:
            if (
                not request.full_resolution
                and self._latest_request == request
                and self._preview_cache is not None
            ):
                emit_cached = self._preview_cache
            else:
                self._latest_request = request
                self._sequence += 1
                sequence = self._sequence

        if emit_cached is not None:
            self.processed.emit(emit_cached, False)
            return

        self._executor.submit(self._process_request, request, sequence)

    # ---------------------------------------------------------------- Processing
    def _process_request(self, request: ProcessingRequest, sequence: int) -> None:
        if not self._source_image:
            return

        # Work on a downscaled copy for the preview unless full resolution requested.
        image = self._source_image.copy()
        if not request.full_resolution:
            image.thumbnail((1024, 1024), Image.LANCZOS)
        else:
            # If we already rendered a full res output with matching settings reuse it.
            if self._full_res_cache is not None and self._latest_request == request:
                self.processed.emit(self._full_res_cache, True)
                return

        with self._request_lock:
            if not request.full_resolution and sequence != self._sequence:
                return

        processed = self._apply_pipeline(image, request)

        qimage = convert_qimage(processed)
        if request.full_resolution:
            self._full_res_cache = qimage
        else:
            self._preview_cache = qimage

        with self._request_lock:
            if not request.full_resolution and sequence != self._sequence:
                return

        self.processed.emit(qimage, request.full_resolution)

    # ----------------------------------------------------------------- Pipeline
    def _apply_pipeline(self, image: Image.Image, request: ProcessingRequest) -> Image.Image:
        base = np.asarray(image.convert("RGB"), dtype=np.float32)
        working = base.copy()
        working = self._apply_colour_controls(working, request)
        working = apply_render_mode(working, request.colour_render_mode, request.palette_mix, request.bit_depth)
        working = self._apply_tone_controls(working, request)
        toned_reference = working.copy()
        working = self._apply_noise(working, request.noise_level)

        algorithm = DITHER_ALGORITHMS[request.algorithm]
        dithered = algorithm(working, request)

        processed = self._apply_post_processing(dithered, toned_reference, base, request)
        return Image.fromarray(processed)

    def _apply_colour_controls(self, image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
        scales = np.array([
            request.red_scale,
            request.green_scale,
            request.blue_scale,
        ], dtype=np.float32)
        adjusted = np.clip(image * scales, 0, 255)

        if request.two_colour_mode == "Custom Two-Tone":
            dark = np.array(self._hex_to_rgb(request.colour_a), dtype=np.float32)
            light = np.array(self._hex_to_rgb(request.colour_b), dtype=np.float32)
            luminance = np.dot(adjusted[..., :3], np.array([0.2126, 0.7152, 0.0722])) / 255.0
            adjusted = (1 - luminance[..., None]) * dark + luminance[..., None] * light

        return adjusted.astype(np.float32)

    def _apply_tone_controls(self, image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
        gamma = max(request.gamma, 0.1)
        normalised = np.clip(image / 255.0, 0.0, 1.0)
        gamma_corrected = np.power(normalised, 1.0 / gamma)
        contrasted = self._apply_contrast(gamma_corrected * 255.0, request.contrast)
        hsv_adjusted = self._apply_hsv_controls(contrasted / 255.0, request)
        vignetted = self._apply_vignette(hsv_adjusted * 255.0, request.vignette_strength)
        return vignetted.astype(np.float32)

    def _apply_noise(self, image: np.ndarray, level: float) -> np.ndarray:
        if level <= 0:
            return image
        noise = np.random.uniform(-level * 255, level * 255, size=image.shape).astype(np.float32)
        return np.clip(image + noise, 0, 255).astype(np.float32)

    def _apply_post_processing(
        self,
        image: np.ndarray,
        toned_reference: np.ndarray,
        original: np.ndarray,
        request: ProcessingRequest,
    ) -> np.ndarray:
        result = np.clip(image, 0, 255).astype(np.float32)

        if request.glow_radius > 0:
            pil_img = Image.fromarray(result.astype(np.uint8))
            pil_img = pil_img.filter(ImageFilter.GaussianBlur(request.glow_radius))
            result = np.asarray(pil_img, dtype=np.float32)

        if request.sharpen_amount > 0:
            pil_img = Image.fromarray(result.astype(np.uint8))
            enhancer = ImageEnhance.Sharpness(pil_img)
            pil_img = enhancer.enhance(1.0 + request.sharpen_amount * 2)
            result = np.asarray(pil_img, dtype=np.float32)

        if request.posterize_levels > 1:
            levels = float(request.posterize_levels - 1)
            step = 255.0 / levels
            result = (np.round(result / step) * step).astype(np.float32)

        if request.edge_boost > 0:
            edges = Image.fromarray(original.astype(np.uint8)).filter(ImageFilter.FIND_EDGES)
            edges_arr = np.asarray(edges, dtype=np.float32)
            result = np.clip(result + edges_arr * request.edge_boost * 0.5, 0, 255).astype(np.float32)

        if request.invert_output:
            result = (255.0 - result).astype(np.float32)

        if request.blend_original > 0:
            blend = np.clip(request.blend_original, 0.0, 1.0)
            result = (result * (1.0 - blend) + toned_reference * blend).astype(np.float32)

        return np.clip(result, 0, 255).astype(np.uint8)

    def _apply_contrast(self, image: np.ndarray, contrast: float) -> np.ndarray:
        factor = max(contrast, 0.0)
        midpoint = 127.5
        return np.clip((image - midpoint) * factor + midpoint, 0, 255).astype(np.float32)

    def _apply_hsv_controls(self, image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
        saturation = max(request.saturation, 0.0)
        hue_shift = request.hue_shift / 360.0

        r, g, b = image[..., 0], image[..., 1], image[..., 2]
        maxc = np.max(image, axis=-1)
        minc = np.min(image, axis=-1)
        delta = maxc - minc

        hue = np.zeros_like(maxc)
        mask = delta > 1e-5
        r_mask = mask & (maxc == r)
        g_mask = mask & (maxc == g)
        b_mask = mask & (maxc == b)
        hue[r_mask] = ((g - b)[r_mask] / delta[r_mask]) % 6
        hue[g_mask] = ((b - r)[g_mask] / delta[g_mask]) + 2
        hue[b_mask] = ((r - g)[b_mask] / delta[b_mask]) + 4
        hue = (hue / 6.0 + hue_shift) % 1.0

        saturation_values = np.zeros_like(maxc)
        nonzero = maxc > 1e-5
        saturation_values[nonzero] = (delta[nonzero] / maxc[nonzero]) * saturation
        saturation_values = np.clip(saturation_values, 0.0, 1.0)
        value = maxc

        h6 = hue * 6.0
        i = np.floor(h6).astype(int) % 6
        f = h6 - np.floor(h6)
        p = value * (1.0 - saturation_values)
        q = value * (1.0 - saturation_values * f)
        t = value * (1.0 - saturation_values * (1.0 - f))

        result = np.zeros_like(image)
        result[..., 0] = np.choose(i, [value, q, p, p, t, value])
        result[..., 1] = np.choose(i, [t, value, value, q, p, p])
        result[..., 2] = np.choose(i, [p, p, t, value, value, q])

        return np.clip(result, 0.0, 1.0).astype(np.float32)

    def _apply_vignette(self, image: np.ndarray, strength: float) -> np.ndarray:
        if strength <= 0:
            return image

        height, width = image.shape[:2]
        y, x = np.indices((height, width))
        cx = width / 2.0
        cy = height / 2.0
        distance = np.sqrt(((x - cx) / cx) ** 2 + ((y - cy) / cy) ** 2)
        mask = np.clip(1.0 - distance, 0.0, 1.0)
        weight = (1.0 - strength) + strength * mask
        return (image * weight[..., None]).astype(np.float32)

    # ----------------------------------------------------------------- Utilities
    def _hex_to_rgb(self, value: str) -> tuple[int, int, int]:
        value = value.strip().lstrip("#")
        if len(value) != 6:
            raise ValueError("Colours must be in #RRGGBB format")
        r = int(value[0:2], 16)
        g = int(value[2:4], 16)
        b = int(value[4:6], 16)
        return r, g, b
