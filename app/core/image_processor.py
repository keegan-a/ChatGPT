"""Background image processing pipeline using NumPy for performance."""
from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from PySide6.QtCore import QObject, Signal
from PySide6.QtGui import QImage

from app.core.dithering import DITHER_ALGORITHMS, algorithm_spec
from app.core.models import ProcessingRequest
from app.core.utils import convert_qimage


COLOUR_MODES = [
    "RGB Balance",
    "Mono Luma",
    "Indexed 4",
    "Indexed 8",
    "Retro 16-bit RGB",
    "Retro 8-bit RGB",
    "Hi-Fi Neon",
    "CMYK Composite",
]


PALETTE_LIBRARY: dict[str, tuple[str, ...]] = {
    "Disabled": (),
    "Custom Two-Tone": (),
    "Mono Silver": ("#101010", "#f0f0f0"),
    "Duotone Warm": ("#2f1100", "#b85c38", "#ffd7a3"),
    "Duotone Cool": ("#050029", "#413075", "#9ad6f5"),
    "Game Boy DMG": ("#0f380f", "#306230", "#8bac0f", "#9bbc0f"),
    "Game Boy Pocket": ("#1a1d21", "#394b59", "#6a8c8f", "#b9d8c2"),
    "Virtual Boy": ("#120000", "#400000", "#a00000", "#ff0040"),
    "CGA 4-Color": ("#000000", "#00a8a8", "#a800a8", "#a8a8a8"),
    "CGA 16-Color": (
        "#000000",
        "#0000aa",
        "#00aa00",
        "#00aaaa",
        "#aa0000",
        "#aa00aa",
        "#aa5500",
        "#aaaaaa",
        "#555555",
        "#5555ff",
        "#55ff55",
        "#55ffff",
        "#ff5555",
        "#ff55ff",
        "#ffff55",
        "#ffffff",
    ),
    "Commodore 64": (
        "#000000",
        "#ffffff",
        "#68372b",
        "#70a4b2",
        "#6f3d86",
        "#588d43",
        "#352879",
        "#b8c76f",
        "#6f4f25",
        "#433900",
        "#9a6759",
        "#444444",
        "#6c6c6c",
        "#9ad284",
        "#6c5eb5",
        "#959595",
    ),
    "ZX Spectrum": (
        "#000000",
        "#0000d7",
        "#d70000",
        "#d700d7",
        "#00d700",
        "#00d7d7",
        "#d7d700",
        "#ffffff",
    ),
    "Amiga 16": (
        "#000000",
        "#1a1a1a",
        "#5a1a4a",
        "#8a2142",
        "#c74136",
        "#ff784f",
        "#ffc36f",
        "#ffe29f",
        "#1a3a5a",
        "#24567a",
        "#2d80a3",
        "#47a6c6",
        "#6bcedf",
        "#9af3f5",
        "#d4fdfd",
        "#ffffff",
    ),
    "Apple II": ("#000000", "#1bcb02", "#f704d9", "#f7f7f7", "#1bcbf7", "#f7cb02"),
    "NES": (
        "#7c7c7c",
        "#0000fc",
        "#a80020",
        "#f83800",
        "#f8b800",
        "#b8f818",
        "#58f898",
        "#0088f8",
        "#f878f8",
        "#f8f8f8",
    ),
    "SNES Pastel": (
        "#1b1b3a",
        "#693668",
        "#a74482",
        "#f84aa7",
        "#ff99c8",
        "#acdcff",
        "#96f7d2",
        "#f9f871",
    ),
    "Atari 2600": (
        "#000000",
        "#f0f0f0",
        "#a80000",
        "#f08030",
        "#008858",
        "#2ce8a4",
        "#1c3cc4",
        "#b4b4ff",
    ),
    "IBM PC Amber": ("#000000", "#ffbf00"),
    "IBM PC Green": ("#001b00", "#00ff00"),
    "Vaporwave": ("#2d1b64", "#ff71ce", "#01cdfe", "#05ffa1", "#b967ff"),
    "Cyberpunk Neon": ("#050d1a", "#14f195", "#ff3864", "#ffe66d"),
    "CMYK Print": ("#000000", "#00aaff", "#ff00aa", "#ffee00", "#ffffff"),
    "RGB CRT": ("#050505", "#ff4444", "#44ff44", "#4444ff", "#f7f7f7"),
    "Sepia Print": ("#1b0b00", "#8c4a2f", "#f2d4a4"),
    "Blueprint": ("#081f2c", "#0f4c75", "#bbe1fa", "#ffffff"),
}


class ImageProcessor(QObject):
    """Manage processing on a worker pool and emit Qt-ready images."""

    processed = Signal(QImage, bool)

    def __init__(self) -> None:
        super().__init__()
        self._executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="dither-worker")
        self._request_lock = threading.Lock()
        self._latest_request: ProcessingRequest | None = None
        self._source_image: Image.Image | None = None
        self._preview_source: Image.Image | None = None
        self._preview_cache: QImage | None = None
        self._full_res_cache: QImage | None = None
        self._request_counter = 0
        self._full_res_request: ProcessingRequest | None = None
        self._preview_request: ProcessingRequest | None = None

    # ------------------------------------------------------------------ Properties
    @property
    def available_algorithms(self) -> list[str]:
        return sorted(DITHER_ALGORITHMS.keys())

    @property
    def available_colour_modes(self) -> list[str]:
        return list(COLOUR_MODES)

    @property
    def available_palettes(self) -> list[str]:
        return list(PALETTE_LIBRARY.keys())

    @property
    def has_image(self) -> bool:
        return self._source_image is not None

    # ------------------------------------------------------------------ API
    def load_image(self, path: Path) -> None:
        image = Image.open(path).convert("RGB")
        self._source_image = image
        preview = image.copy()
        preview.thumbnail((768, 768), Image.LANCZOS)
        self._preview_source = preview
        self._preview_cache = None
        self._full_res_cache = None
        self._full_res_request = None
        self._preview_request = None
        with self._request_lock:
            self._latest_request = None
            self._request_counter = 0

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
            self._request_counter += 1
            token = self._request_counter

        self._executor.submit(self._process_request, request, token)

    # ---------------------------------------------------------------- Processing
    def _process_request(self, request: ProcessingRequest, token: int) -> None:
        if not self._source_image:
            return

        is_preview = not request.full_resolution

        if is_preview and self._preview_cache is not None and self._preview_request == request:
            self.processed.emit(self._preview_cache, False)
            return

        if request.full_resolution and self._full_res_cache is not None and self._full_res_request == request:
            self.processed.emit(self._full_res_cache, True)
            return

        if is_preview:
            with self._request_lock:
                if token != self._request_counter or self._latest_request != request:
                    return

        source = self._source_image if request.full_resolution else self._preview_source or self._source_image

        spec = algorithm_spec(request.algorithm)
        preview_downsample = spec.preview_downsample if is_preview else 1
        processed = self._apply_pipeline(source, request, preview_downsample)

        qimage = convert_qimage(processed)
        if request.full_resolution:
            self._full_res_cache = qimage
            self._full_res_request = request
        else:
            with self._request_lock:
                if token != self._request_counter or self._latest_request != request:
                    return
            self._preview_cache = qimage
            self._preview_request = request

        self.processed.emit(qimage, request.full_resolution)

    # ----------------------------------------------------------------- Pipeline
    def _apply_pipeline(
        self,
        image: Image.Image,
        request: ProcessingRequest,
        preview_downsample: int = 1,
    ) -> Image.Image:
        original_size = image.size
        downsample_factor = max(1, preview_downsample)
        working_image = image
        if downsample_factor > 1:
            reduced_size = (
                max(1, original_size[0] // downsample_factor),
                max(1, original_size[1] // downsample_factor),
            )
            working_image = image.resize(reduced_size, Image.BOX)

        pixelated_image, pixel_return_size = self._apply_pixel_size(working_image, request.pixel_size)

        base = np.asarray(pixelated_image, dtype=np.float32)
        working = base.copy()
        working = self._apply_colour_controls(working, request)
        working = self._apply_tone_controls(working, request)
        toned_reference = working.copy()
        working = self._apply_noise(working, request.noise_level)

        algorithm = DITHER_ALGORITHMS[request.algorithm]
        dithered = algorithm(working, request)

        processed = self._apply_post_processing(dithered, toned_reference, base, request)
        output = Image.fromarray(processed)

        if pixel_return_size is not None:
            output = output.resize(pixel_return_size, Image.NEAREST)

        if downsample_factor > 1:
            output = output.resize(original_size, Image.NEAREST)

        return output

    def _apply_pixel_size(
        self, image: Image.Image, pixel_size: int
    ) -> tuple[Image.Image, tuple[int, int] | None]:
        pixel_size = max(1, pixel_size)
        image = image.convert("RGB")
        if pixel_size == 1:
            return image, None

        reduced_size = (
            max(1, image.width // pixel_size),
            max(1, image.height // pixel_size),
        )
        reduced = image.resize(reduced_size, Image.BOX)
        return reduced, image.size

    def _apply_colour_controls(self, image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
        scales = np.array([
            request.red_scale,
            request.green_scale,
            request.blue_scale,
        ], dtype=np.float32)
        adjusted = np.clip(image * scales, 0, 255)
        adjusted = self._apply_colour_mode(adjusted, request.colour_mode)
        adjusted = self._apply_palette_mode(adjusted, request)
        return adjusted.astype(np.float32)

    def _apply_colour_mode(self, image: np.ndarray, mode: str) -> np.ndarray:
        mode = mode or "RGB Balance"
        if mode == "RGB Balance":
            return image

        if mode == "Mono Luma":
            luminance = np.dot(image[..., :3], np.array([0.2126, 0.7152, 0.0722], dtype=np.float32))
            return np.repeat(luminance[..., None], 3, axis=2)

        if mode == "Indexed 4":
            return np.round(image / 85.0) * 85.0

        if mode == "Indexed 8":
            return np.round(image / 36.0) * 36.0

        if mode == "Retro 16-bit RGB":
            normalised = image / 255.0
            r = np.round(normalised[..., 0] * 31.0) / 31.0
            g = np.round(normalised[..., 1] * 63.0) / 63.0
            b = np.round(normalised[..., 2] * 31.0) / 31.0
            return np.stack([r, g, b], axis=-1) * 255.0

        if mode == "Retro 8-bit RGB":
            normalised = image / 255.0
            quantised = np.round(normalised * 7.0) / 7.0
            return np.clip(quantised * 255.0, 0, 255)

        if mode == "Hi-Fi Neon":
            normalised = np.clip(image / 255.0, 0.0, 1.0)
            cyan = np.clip(1.0 - normalised[..., 0], 0.0, 1.0)
            magenta = np.clip(1.0 - normalised[..., 1], 0.0, 1.0)
            boosted_r = np.clip(normalised[..., 0] * 0.6 + magenta * 0.4, 0.0, 1.0)
            boosted_b = np.clip(normalised[..., 2] * 0.6 + cyan * 0.4, 0.0, 1.0)
            boosted_g = np.clip(normalised[..., 1] * 0.5 + (boosted_r + boosted_b) * 0.25, 0.0, 1.0)
            return np.stack([boosted_r, boosted_g, boosted_b], axis=-1) * 255.0

        if mode == "CMYK Composite":
            rgb = np.clip(image / 255.0, 0.0, 1.0)
            c = 1.0 - rgb[..., 0]
            m = 1.0 - rgb[..., 1]
            y = 1.0 - rgb[..., 2]
            k = np.minimum(np.minimum(c, m), y)
            denom = 1.0 - k + 1e-5
            c = (c - k) / denom
            m = (m - k) / denom
            y = (y - k) / denom
            cmyk = np.stack([c, m, y, k], axis=-1)
            inks = np.array(
                [
                    [0.0, 1.0, 1.0],  # cyan subtracts red
                    [1.0, 0.0, 1.0],  # magenta subtracts green
                    [1.0, 1.0, 0.0],  # yellow subtracts blue
                    [1.0, 1.0, 1.0],  # key (black)
                ],
                dtype=np.float32,
            )
            composite = 1.0 - np.tensordot(cmyk, inks, axes=([-1], [0]))
            return np.clip(composite * 255.0, 0, 255)

        return image

    def _apply_palette_mode(self, image: np.ndarray, request: ProcessingRequest) -> np.ndarray:
        palette = self._resolve_palette(request)
        if palette is None:
            return image

        if palette.shape[0] == 2 and request.palette_mode == "Custom Two-Tone":
            luminance = np.dot(image[..., :3], np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)) / 255.0
            dark, light = palette
            return (1.0 - luminance[..., None]) * dark + luminance[..., None] * light

        return self._map_to_palette(image, palette)

    def _resolve_palette(self, request: ProcessingRequest) -> np.ndarray | None:
        mode = request.palette_mode or "Disabled"
        if mode == "Disabled":
            return None
        if mode == "Custom Two-Tone":
            dark = np.array(self._hex_to_rgb(request.colour_a), dtype=np.float32)
            light = np.array(self._hex_to_rgb(request.colour_b), dtype=np.float32)
            return np.stack([dark, light], axis=0)

        entries = PALETTE_LIBRARY.get(mode)
        if not entries:
            return None

        colours = [np.array(self._hex_to_rgb(colour), dtype=np.float32) for colour in entries]
        return np.stack(colours, axis=0)

    def _map_to_palette(self, image: np.ndarray, palette: np.ndarray) -> np.ndarray:
        flat = image.reshape(-1, 3).astype(np.float32)
        palette = palette.astype(np.float32)
        distances = np.sum((flat[:, None, :] - palette[None, :, :]) ** 2, axis=2)
        indices = np.argmin(distances, axis=1)
        mapped = palette[indices].reshape(image.shape)
        return mapped

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
            result = self._apply_glow(result, toned_reference, request.glow_radius)

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

    def _apply_glow(self, image: np.ndarray, reference: np.ndarray, radius: int) -> np.ndarray:
        radius = max(1, radius)
        luminance = np.dot(reference[..., :3], np.array([0.2126, 0.7152, 0.0722], dtype=np.float32))
        mask = np.clip((luminance - 160.0) / 95.0, 0.0, 1.0) ** 1.2
        highlight = np.clip(reference * mask[..., None], 0, 255).astype(np.uint8)

        glow_source = Image.fromarray(highlight)
        blurred = glow_source.filter(ImageFilter.GaussianBlur(radius))
        glow = np.asarray(blurred, dtype=np.float32)
        strength = np.clip(radius / 12.0, 0.15, 1.2)
        return np.clip(image + glow * strength, 0, 255)

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
