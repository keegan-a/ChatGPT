"""Entry point for launching the Dithering Tool application."""
from __future__ import annotations

import sys
from PySide6.QtGui import QPalette
from PySide6.QtWidgets import QApplication

from app.ui.main_window import MainWindow


def main() -> int:
    """Start the Qt event loop and show the main window."""

    app = QApplication(sys.argv)
    app.setApplicationName("Dithering Tool")

    palette = app.palette()
    color_roles = getattr(QPalette, "ColorRole", QPalette)
    window_role = getattr(color_roles, "Window", None)
    base_role = getattr(color_roles, "Base", None)
    text_role = getattr(color_roles, "WindowText", None)
    if window_role is not None and text_role is not None:
        base_color = palette.color(window_role)
        palette.setColor(window_role, base_color.darker(140))
        palette.setColor(text_role, palette.color(text_role).lighter(180))
    if base_role is not None:
        palette.setColor(base_role, palette.color(base_role).darker(150))
    app.setPalette(palette)
    app.setStyle("Fusion")

    window = MainWindow()
    window.resize(1280, 760)
    window.show()
    return app.exec()


if __name__ == "__main__":  # pragma: no cover - manual invocation
    sys.exit(main())
