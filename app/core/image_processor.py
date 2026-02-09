"""High level image processing pipeline for the dithering application."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

import cv2
import imageio.v3 as imageio
import numpy as np
from PIL import Image, ImageOps

try:  # pragma: no cover - optional dependency that may not be present
    from skimage import exposure  # type: ignore
except Exception:  # pragma: no cover - handled via fallback implementation
    exposure = None  # type: ignore[assignment]

from .dithering import get_algorithm


def _ensure_contiguous(array: np.ndarray) -> np.ndarray:
    """Return a contiguous float32 view suitable for OpenCV operations."""

    if not array.flags.c_contiguous:
        return np.ascontiguousarray(array)
    return array

PaletteArray = np.ndarray


PALETTE_PRESETS: dict[str, List[Tuple[int, int, int]]] = {
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
        (248, 248, 248),
    ],
    "CGA 16-color": [
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
class DitheringSettings:
    algorithm: str = "Floyd-Steinberg"
    serpentine: bool = True
    color_count: int = 8
    palette_mode: str = "Original Image Palette"
    custom_palette: Optional[PaletteArray] = None
    brightness: float = 0.0  # range [-1, 1]
    contrast: float = 0.0  # range [-1, 1]
    gamma: float = 1.0  # >0
    blur_radius: float = 0.0
    sharpen_amount: float = 0.0
    denoise_strength: float = 0.0
    preserve_brightness: bool = False
    transparent_background: bool = True


@dataclass
class ProcessResult:
    image: Image.Image
    palette: PaletteArray
    settings: DitheringSettings


class ImageProcessor:
    """Perform image adjustments, palette construction, and dithering."""

    def __init__(self) -> None:
        self._source_image: Optional[Image.Image] = None
        self._custom_palette: Optional[PaletteArray] = None

    # ------------------------------------------------------------------ general
    @property
    def has_image(self) -> bool:
        return self._source_image is not None

    def set_image(self, image: Image.Image) -> None:
        """Store the source image for subsequent renders."""

        # Pillow keeps file handles open until the image data is loaded; copy the
        # fully materialised image so background worker threads do not attempt to
        # read from a closed file handle when processing begins.
        image = ImageOps.exif_transpose(image)
        image.load()
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA")
        self._source_image = image.copy()

    # --------------------------------------------------------------- palettes --
    @property
    def available_palettes(self) -> List[str]:
        return ["Original Image Palette", "Grayscale", "Custom Palette"] + list(PALETTE_PRESETS.keys())

    def set_custom_palette(self, palette: PaletteArray | None) -> None:
        if palette is None:
            self._custom_palette = None
        else:
            unique = np.unique(palette.reshape(-1, 3), axis=0)
            self._custom_palette = unique.astype(np.uint8)

    def load_palette_from_file(self, path: Path) -> PaletteArray:
        """Load palette colours from an image or text file."""

        suffix = path.suffix.lower()
        if suffix in {".png", ".jpg", ".jpeg", ".bmp", ".gif"}:
            data = imageio.imread(path)
            if data.dtype != np.uint8:
                data = np.clip(data, 0, 255).astype(np.uint8)
            if data.ndim == 3 and data.shape[-1] >= 3:
                colours = np.unique(data[..., :3].reshape(-1, 3), axis=0)
            else:
                colours = np.unique(np.stack([data] * 3, axis=-1).reshape(-1, 3), axis=0)
        else:
            colours: List[Tuple[int, int, int]] = []
            for line in path.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if line.startswith("0x") or line.startswith("#"):
                    token = line.lstrip("#")
                    if len(token) == 6:
                        colours.append(tuple(int(token[i : i + 2], 16) for i in range(0, 6, 2)))
                else:
                    parts = [p for p in line.replace(",", " ").split(" ") if p]
                    if len(parts) >= 3:
                        try:
                            colours.append(tuple(int(float(p)) for p in parts[:3]))
                        except ValueError:
                            continue
            if not colours:
                raise ValueError("No colours parsed from palette file")
            colours_np = np.array(colours, dtype=np.uint8)
            colours = np.unique(colours_np, axis=0)
        palette = colours.astype(np.uint8)
        self.set_custom_palette(palette)
        return palette

    # --------------------------------------------------------------- rendering --
    def render_preview(self, settings: DitheringSettings, max_size: int = 640) -> ProcessResult:
        return self._render(settings, max_size=max_size)

    def render_full(self, settings: DitheringSettings) -> ProcessResult:
        return self._render(settings, max_size=None)

    def _render(self, settings: DitheringSettings, max_size: Optional[int]) -> ProcessResult:
        if self._source_image is None:
            raise RuntimeError("No image loaded")

        source = self._source_image
        if max_size is not None:
            scale = min(1.0, max_size / max(source.width, source.height))
            if scale < 1.0:
                new_size = (max(1, int(source.width * scale)), max(1, int(source.height * scale)))
                working = source.resize(new_size, Image.LANCZOS)
            else:
                working = source.copy()
        else:
            working = source.copy()

        arr = np.array(working).astype(np.float32) / 255.0
        if arr.ndim == 2:
            arr = np.stack([arr] * 3, axis=-1)
        if arr.shape[-1] == 4:
            rgb = arr[..., :3]
            alpha = arr[..., 3:4]
        else:
            rgb = arr[..., :3]
            alpha = None

        adjusted = self._apply_adjustments(rgb, settings)
        palette = self._build_palette(adjusted, settings)

        if settings.preserve_brightness:
            adjusted_linear = _srgb_to_linear(adjusted)
            palette_linear = _srgb_to_linear(palette)
            dithered = self._apply_dither(adjusted_linear, palette_linear, settings)
            dithered = _linear_to_srgb(dithered)
        else:
            dithered = self._apply_dither(adjusted, palette, settings)

        if alpha is not None and settings.transparent_background:
            output = np.concatenate([dithered, alpha], axis=-1)
            mode = "RGBA"
        else:
            output = dithered
            mode = "RGB"

        image = Image.fromarray(np.clip(output * 255.0, 0, 255).astype(np.uint8), mode=mode)
        return ProcessResult(image=image, palette=(palette * 255.0).astype(np.uint8), settings=settings)

    # ------------------------------------------------------------- adjustments --
    def _apply_adjustments(self, rgb: np.ndarray, settings: DitheringSettings) -> np.ndarray:
        data = _ensure_contiguous(rgb.copy())
        if settings.brightness:
            data = np.clip(data + settings.brightness, 0.0, 1.0)
        if settings.contrast:
            factor = 1.0 + settings.contrast
            data = np.clip((data - 0.5) * factor + 0.5, 0.0, 1.0)
        if settings.gamma and not np.isclose(settings.gamma, 1.0):
            data = np.clip(_adjust_gamma(data, settings.gamma), 0.0, 1.0)
        if settings.blur_radius > 0:
            sigma = max(1e-3, settings.blur_radius)
            data = _safe_gaussian_blur(data, sigma)
        if settings.sharpen_amount > 0:
            sigma = 1.0
            blurred = _safe_gaussian_blur(data, sigma)
            if blurred is not None:
                try:
                    data = cv2.addWeighted(
                        data,
                        1.0 + settings.sharpen_amount,
                        blurred,
                        -settings.sharpen_amount,
                        0,
                    )
                except cv2.error:
                    data = np.clip(
                        data + (data - blurred) * settings.sharpen_amount,
                        0.0,
                        1.0,
                    )
        if settings.denoise_strength > 0:
            temp = np.clip(data * 255.0, 0, 255).astype(np.uint8)
            h = 5 + int(settings.denoise_strength * 10)
            denoised = _safe_denoise(temp, h)
            if denoised is not None:
                data = denoised.astype(np.float32) / 255.0
        return np.clip(data, 0.0, 1.0)

    # --------------------------------------------------------------- palette ---
    def _build_palette(self, rgb: np.ndarray, settings: DitheringSettings) -> np.ndarray:
        mode = settings.palette_mode
        count = max(2, settings.color_count)
        if mode == "Original Image Palette":
            image = Image.fromarray(np.clip(rgb * 255.0, 0, 255).astype(np.uint8), mode="RGB")
            quantised = image.quantize(colors=count, method=Image.MEDIANCUT, dither=Image.NONE)
            palette = _palette_from_quantized(quantised, count)
        elif mode == "Grayscale":
            levels = np.linspace(0, 1, count)
            palette = np.stack([levels, levels, levels], axis=-1)
        elif mode == "Custom Palette":
            if self._custom_palette is None:
                palette = np.linspace(0, 1, count)
                palette = np.stack([palette, palette, palette], axis=-1)
            else:
                palette = self._custom_palette.astype(np.float32) / 255.0
        elif mode in PALETTE_PRESETS:
            palette = np.array(PALETTE_PRESETS[mode], dtype=np.float32) / 255.0
        else:
            palette = np.linspace(0, 1, count)
            palette = np.stack([palette, palette, palette], axis=-1)

        palette = palette.reshape(-1, 3)
        if palette.shape[0] > count:
            palette = palette[:count]
        elif palette.shape[0] < count:
            repeats = int(np.ceil(count / max(palette.shape[0], 1)))
            palette = np.tile(palette, (repeats, 1))[:count]
        return palette.astype(np.float32)

    # --------------------------------------------------------------- dithering --
    def _apply_dither(self, rgb: np.ndarray, palette: np.ndarray, settings: DitheringSettings) -> np.ndarray:
        if palette.size == 0:
            raise ValueError("Palette is empty; adjust colour settings and try again")
        algorithm = get_algorithm(settings.algorithm)
        if algorithm.kind == "error_diffusion":
            return _error_diffusion(rgb, palette, algorithm.kernel, settings.serpentine)
        if algorithm.kind == "ordered":
            return _ordered_dither(rgb, palette, algorithm.matrix)
        return _random_dither(rgb, palette)


# -----------------------------------------------------------------------------
# Dithering helpers
# -----------------------------------------------------------------------------


def _safe_gaussian_blur(data: np.ndarray, sigma: float) -> np.ndarray:
    """Apply Gaussian blur with a graceful fallback when OpenCV fails."""

    try:
        return cv2.GaussianBlur(_ensure_contiguous(data), ksize=(0, 0), sigmaX=sigma, sigmaY=sigma)
    except cv2.error:
        radius = max(int(round(sigma * 1.5)), 1)
        kernel = np.ones((radius, radius), dtype=np.float32)
        kernel /= kernel.size
        padded = np.pad(
            data,
            ((radius // 2, radius // 2), (radius // 2, radius // 2), (0, 0)),
            mode="edge",
        )
        blurred = np.empty_like(data)
        for channel in range(data.shape[2]):
            view = padded[:, :, channel]
            try:
                filtered = cv2.filter2D(view, -1, kernel, borderType=cv2.BORDER_REFLECT)
            except cv2.error:
                filtered = view
            blurred[:, :, channel] = filtered[
                radius // 2 : radius // 2 + data.shape[0],
                radius // 2 : radius // 2 + data.shape[1],
            ]
        return blurred


def _safe_denoise(data: np.ndarray, h: int) -> np.ndarray | None:
    """Run coloured denoising while tolerating unsupported OpenCV builds."""

    try:
        return cv2.fastNlMeansDenoisingColored(data, None, h, h, 7, 21)
    except cv2.error:
        return None


def _palette_from_quantized(image: Image.Image, count: int) -> np.ndarray:
    """Extract a palette from a quantised Pillow image."""

    palette_data = image.getpalette()
    used_indices = np.unique(np.array(image))
    if palette_data:
        palette_array = np.array(palette_data, dtype=np.uint8).reshape(-1, 3)
        used_indices = used_indices[used_indices < palette_array.shape[0]]
        palette_array = palette_array[used_indices]
    else:
        palette_array = np.array(image.convert("RGB"))
        palette_array = np.unique(palette_array.reshape(-1, 3), axis=0)
    if palette_array.size == 0:
        palette_array = np.array([[0, 0, 0]], dtype=np.uint8)
    if palette_array.shape[0] > count:
        palette_array = palette_array[:count]
    return palette_array.astype(np.float32) / 255.0


def _nearest_palette_index(pixel: np.ndarray, palette: np.ndarray) -> int:
    distances = np.sum((palette - pixel) ** 2, axis=1)
    return int(np.argmin(distances))


def _error_diffusion(
    image: np.ndarray,
    palette: np.ndarray,
    kernel: Sequence[Tuple[int, int, float]],
    serpentine: bool,
) -> np.ndarray:
    working = image.copy()
    height, width, channels = working.shape
    output = np.zeros_like(working)
    for y in range(height):
        if serpentine and y % 2 == 1:
            x_range = range(width - 1, -1, -1)
            direction = -1
        else:
            x_range = range(width)
            direction = 1
        for x in x_range:
            old_pixel = working[y, x]
            idx = _nearest_palette_index(old_pixel, palette)
            new_pixel = palette[idx]
            output[y, x] = new_pixel
            error = old_pixel - new_pixel
            for dy, dx, weight in kernel:
                ny = y + dy
                nx = x + (dx * direction if direction == -1 else dx)
                if 0 <= ny < height and 0 <= nx < width:
                    working[ny, nx] += error * weight
    return np.clip(output, 0.0, 1.0)


def _ordered_dither(image: np.ndarray, palette: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    height, width, _ = image.shape
    mh, mw = matrix.shape
    tiled = np.tile(matrix, (int(np.ceil(height / mh)), int(np.ceil(width / mw))))[:height, :width]
    # Spread the ordered threshold across channels for gentle colour shifts.
    noise = (tiled - 0.5)[..., None]
    strength = 1.0 / max(len(palette) - 1, 1)
    adjusted = np.clip(image + noise * strength, 0.0, 1.0)
    flat = adjusted.reshape(-1, 3)
    indices = _nearest_palette_indices(flat, palette)
    quantised = palette[indices].reshape(image.shape)
    return np.clip(quantised, 0.0, 1.0)


def _random_dither(image: np.ndarray, palette: np.ndarray) -> np.ndarray:
    noise = (np.random.rand(*image.shape[:2], 1) - 0.5) * (1.0 / max(len(palette) - 1, 1))
    adjusted = np.clip(image + noise, 0.0, 1.0)
    flat = adjusted.reshape(-1, 3)
    indices = _nearest_palette_indices(flat, palette)
    return palette[indices].reshape(image.shape)


def _nearest_palette_indices(pixels: np.ndarray, palette: np.ndarray) -> np.ndarray:
    diff = pixels[:, None, :] - palette[None, :, :]
    distances = np.sum(diff * diff, axis=2)
    return np.argmin(distances, axis=1)


def _srgb_to_linear(rgb: np.ndarray) -> np.ndarray:
    threshold = 0.04045
    below = rgb <= threshold
    result = np.empty_like(rgb)
    result[below] = rgb[below] / 12.92
    result[~below] = ((rgb[~below] + 0.055) / 1.055) ** 2.4
    return result


def _linear_to_srgb(rgb: np.ndarray) -> np.ndarray:
    threshold = 0.0031308
    below = rgb <= threshold
    result = np.empty_like(rgb)
    result[below] = rgb[below] * 12.92
    result[~below] = 1.055 * np.power(rgb[~below], 1 / 2.4) - 0.055
    return np.clip(result, 0.0, 1.0)


def _adjust_gamma(image: np.ndarray, gamma: float) -> np.ndarray:
    """Apply gamma correction with an optional scikit-image fallback."""

    if exposure is not None:
        return exposure.adjust_gamma(image, gamma)
    gamma = max(gamma, 1e-6)
    return np.power(np.clip(image, 0.0, 1.0), gamma)


__all__ = [
    "ImageProcessor",
    "DitheringSettings",
    "ProcessResult",
    "PALETTE_PRESETS",
]
