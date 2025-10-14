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
    glow_radius: int
    noise_level: float
    sharpen_amount: float
    red_scale: float
    green_scale: float
    blue_scale: float
    two_colour_mode: str
    colour_a: str
    colour_b: str
    full_resolution: bool
