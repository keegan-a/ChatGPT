"""Utility helpers."""
from __future__ import annotations

import numpy as np
from PIL import Image
from PySide6.QtGui import QImage


def convert_qimage(image: Image.Image) -> QImage:
    """Convert a PIL image to a QImage."""
    arr = np.asarray(image.convert("RGBA"))
    height, width, channel = arr.shape
    bytes_per_line = channel * width
    qimage = QImage(arr.data, width, height, bytes_per_line, QImage.Format_RGBA8888)
    # Keep a reference to prevent garbage collection.
    qimage.ndarray = arr  # type: ignore[attr-defined]
    return qimage
