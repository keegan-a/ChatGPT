"""Background image processing pipeline using NumPy for performance."""
from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from PySide6.QtCore import QObject, Signal
from PySide6.QtGui import QImage

from app.core.colour_modes import get_colour_mode
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
        self._request_version = 0
        self._source_image: Image.Image | None = None
        self._preview_source: Image.Image | None = None
        self._preview_cache: QImage | None = None
        self._full_res_cache: QImage | None = None
        self._last_full_request: ProcessingRequest | None = None

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
        preview = image.copy()
        resampling_base = getattr(Image, "Resampling", Image)
        resample = getattr(resampling_base, "LANCZOS", getattr(Image, "LANCZOS", Image.BICUBIC))
        preview.thumbnail((960, 960), resample)
        self._preview_source = preview
        self._preview_cache = None
        self._full_res_cache = None
        self._last_full_request = None
        with self._request_lock:
            self._latest_request = None
            self._request_version += 1

    def save_output(self, path: Path) -> None:
        if self._full_res_cache is None:
            raise RuntimeError("No rendered image available yet")
        buffer = self._full_res_cache
        buffer.save(path, "PNG")

    def enqueue(self, request: ProcessingRequest) -> None:
        if not self._source_image:
            return

        with self._request_lock:
            self._latest_request = request
            self._request_version += 1
            version = self._request_version

        self._executor.submit(self._process_request, request, version)

    # ---------------------------------------------------------------- Processing
    def _process_request(self, request: ProcessingRequest, version: int) -> None:
        if not self._source_image:
            return

        if not request.full_resolution:
            with self._request_lock:
                latest_version = self._request_version
            if version != latest_version:
                return

        if request.full_resolution and self._full_res_cache is not None and self._last_full_request == request:
            self.processed.emit(self._full_res_cache, True)
            return

        source = self._source_image if request.full_resolution else (self._preview_source or self._source_image)
        if source is None:
            return

        image = source.copy()
        processed = self._apply_pipeline(image, request)

        qimage = convert_qimage(processed)
        if request.full_resolution:
            self._full_res_cache = qimage
            self._last_full_request = request
        else:
            self._preview_cache = qimage

        with self._request_lock:
            latest_version = self._request_version

        if not request.full_resolution and version != latest_version:
            # A newer request has superseded this preview; skip the emit to keep UI snappy.
            return

        self.processed.emit(qimage, request.full_resolution)

    # ----------------------------------------------------------------- Pipeline
    def _apply_pipeline(self, image: Image.Image, request: ProcessingRequest) -> Image.Image:
        base = np.asarray(image.convert("RGB"), dtype=np.float32)
        working = base.copy()
        working = self._apply_colour_controls(working, request)
        working = self._apply_tone_controls(working, request)
        toned_reference = working.copy()
        working = self._apply_noise(working, request.noise_level)

        luminance = self._to_luminance(working)
        algorithm = DITHER_ALGORITHMS[request.algorithm]
        mask = algorithm(luminance, request)
        coloured = self._apply_colour_rendering(mask, toned_reference, request)

        processed = self._apply_post_processing(coloured, toned_reference, base, request)
        return Image.fromarray(processed)

    def _apply_colour_controls(self, image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
        scales = np.array([
            request.red_scale,
            request.green_scale,
            request.blue_scale,
        ], dtype=np.float32)
        adjusted = np.clip(image * scales, 0, 255)

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

    def _apply_colour_rendering(
        self,
        mask: np.ndarray,
        toned_reference: np.ndarray,
        request: ProcessingRequest,
    ) -> np.ndarray:
        toned = np.clip(toned_reference, 0, 255).astype(np.float32)
        mask_norm = np.clip(mask / 255.0, 0.0, 1.0)

        if request.two_colour_mode == "Custom Two-Tone":
            dark = np.array(self._hex_to_rgb(request.colour_a), dtype=np.float32)
            light = np.array(self._hex_to_rgb(request.colour_b), dtype=np.float32)
            colourised = (1.0 - mask_norm)[..., None] * dark + mask_norm[..., None] * light
        else:
            mode = get_colour_mode(request.colour_mode)
            if mode.palette is None:
                colourised = toned
            else:
                palette = mode.palette
                steps = max(request.colour_steps, 2)
                if steps < len(palette):
                    sample_idx = np.linspace(0, len(palette) - 1, steps, dtype=int)
                    palette = palette[sample_idx]

                palette = palette.astype(np.float32)
                luminance = self._to_luminance(toned) / 255.0
                levels = max(len(palette) - 1, 1)
                scaled = np.clip(luminance * levels, 0.0, float(levels))
                lower = np.floor(scaled).astype(int)
                upper = np.clip(lower + 1, 0, len(palette) - 1)
                fraction = scaled - lower
                choose_upper = mask_norm > fraction
                indices = np.where(choose_upper, upper, lower)
                colourised = palette[indices]

        mix = np.clip(request.palette_mix, 0.0, 1.0)
        if mix < 1.0:
            colourised = colourised * mix + toned * (1.0 - mix)

        return np.clip(colourised, 0, 255).astype(np.float32)

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
    def _to_luminance(self, image: np.ndarray) -> np.ndarray:
        coefficients = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        return np.tensordot(image[..., :3], coefficients, axes=([-1], [0]))

    def _hex_to_rgb(self, value: str) -> tuple[int, int, int]:
        value = value.strip().lstrip("#")
        if len(value) != 6:
            raise ValueError("Colours must be in #RRGGBB format")
        r = int(value[0:2], 16)
        g = int(value[2:4], 16)
        b = int(value[4:6], 16)
        return r, g, b
