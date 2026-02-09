"""Shared data models for the dithering application."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ProcessingRequest:
    algorithm: str
    threshold: int
    amplitude: float
    frequency: int
    period: int
    slope: float
    pixel_size: int
    glow_radius: int
    noise_level: float
    sharpen_amount: float
    red_scale: float
    green_scale: float
    blue_scale: float
    colour_mode: str
    palette_mode: str
    colour_a: str
    colour_b: str
    full_resolution: bool
    gamma: float
    contrast: float
    saturation: float
    hue_shift: float
    edge_boost: float
    posterize_levels: int
    blend_original: float
    invert_output: bool
    vignette_strength: float
    rotation: float
