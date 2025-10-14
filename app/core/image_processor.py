"""Background image processing pipeline using NumPy for performance."""
from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from PySide6.QtGui import QImage

from app.core.dithering import DITHER_ALGORITHMS
from app.core.models import ProcessingRequest
from app.core.utils import convert_qimage


class ImageProcessor:
    """Manage processing on a worker pool and emit Qt-ready images."""

    def __init__(self, callback: Callable[[QImage, bool], None]) -> None:
        self._callback = callback
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="dither-worker")
        self._request_lock = threading.Lock()
        self._latest_request: ProcessingRequest | None = None
        self._source_image: Image.Image | None = None
        self._preview_cache: QImage | None = None
        self._full_res_cache: QImage | None = None

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

        with self._request_lock:
            self._latest_request = request

        self._executor.submit(self._process_request, request)

    # ---------------------------------------------------------------- Processing
    def _process_request(self, request: ProcessingRequest) -> None:
        if not self._source_image:
            return

        # Work on a downscaled copy for the preview unless full resolution requested.
        image = self._source_image.copy()
        if not request.full_resolution:
            image.thumbnail((1024, 1024), Image.LANCZOS)
        else:
            # If we already rendered a full res output with matching settings reuse it.
            if self._full_res_cache is not None and self._latest_request == request:
                self._callback(self._full_res_cache, True)
                return

        processed = self._apply_pipeline(image, request)

        qimage = convert_qimage(processed)
        if request.full_resolution:
            self._full_res_cache = qimage
        else:
            self._preview_cache = qimage

        self._callback(qimage, request.full_resolution)

    # ----------------------------------------------------------------- Pipeline
    def _apply_pipeline(self, image: Image.Image, request: ProcessingRequest) -> Image.Image:
        np_img = np.asarray(image).astype(np.float32)
        np_img = self._apply_colour_controls(np_img, request)
        np_img = self._apply_noise(np_img, request.noise_level)

        algorithm = DITHER_ALGORITHMS[request.algorithm]
        dithered = algorithm(np_img, request)

        if request.glow_radius > 0:
            dithered = Image.fromarray(dithered).filter(ImageFilter.GaussianBlur(request.glow_radius))
            dithered = np.asarray(dithered)

        if request.sharpen_amount > 0:
            pil_img = Image.fromarray(dithered)
            enhancer = ImageEnhance.Sharpness(pil_img)
            pil_img = enhancer.enhance(1.0 + request.sharpen_amount * 2)
            dithered = np.asarray(pil_img)

        return Image.fromarray(dithered.astype(np.uint8))

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

        return adjusted

    def _apply_noise(self, image: np.ndarray, level: float) -> np.ndarray:
        if level <= 0:
            return image
        noise = np.random.uniform(-level * 255, level * 255, size=image.shape)
        return np.clip(image + noise, 0, 255)

    # ----------------------------------------------------------------- Utilities
    def _hex_to_rgb(self, value: str) -> tuple[int, int, int]:
        value = value.strip().lstrip("#")
        if len(value) != 6:
            raise ValueError("Colours must be in #RRGGBB format")
        r = int(value[0:2], 16)
        g = int(value[2:4], 16)
        b = int(value[4:6], 16)
        return r, g, b
