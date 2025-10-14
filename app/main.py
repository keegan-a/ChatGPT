"""Entry point for the dithering studio desktop application."""
from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtWidgets import QApplication

from app.ui.main_window import MainWindow


def main() -> int:
    """Start the Qt application."""
    app = QApplication(sys.argv)
    app.setApplicationName("Dither Studio")

    # Apply a monochrome palette to match the design direction.
    palette = app.palette()
    palette.setColor(palette.Window, palette.color(palette.Window).darker(160))
    palette.setColor(palette.WindowText, palette.color(palette.WindowText).lighter(180))
    palette.setColor(palette.Base, palette.color(palette.Base).darker(180))
    palette.setColor(palette.AlternateBase, palette.color(palette.AlternateBase).darker(160))
    palette.setColor(palette.ToolTipBase, palette.color(palette.ToolTipBase).lighter(180))
    palette.setColor(palette.ToolTipText, palette.color(palette.ToolTipText).lighter(180))
    palette.setColor(palette.Text, palette.color(palette.Text).lighter(200))
    palette.setColor(palette.Button, palette.color(palette.Button).darker(180))
    palette.setColor(palette.ButtonText, palette.color(palette.ButtonText).lighter(180))
    palette.setColor(palette.BrightText, palette.color(palette.BrightText).lighter(200))
    app.setPalette(palette)

    # Ensure fonts stay crisp.
    app.setStyle("Fusion")

    window = MainWindow()
    window.resize(1280, 720)
    window.show()

    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
