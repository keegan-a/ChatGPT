"""Entry point for the dithering studio desktop application."""
from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtGui import QPalette
from PySide6.QtWidgets import QApplication

from app.ui.main_window import MainWindow


def main() -> int:
    """Start the Qt application."""
    app = QApplication(sys.argv)
    app.setApplicationName("Dither Studio")

    # Apply a monochrome palette to match the design direction.
    palette = app.palette()
    palette.setColor(QPalette.ColorRole.Window, palette.color(QPalette.ColorRole.Window).darker(160))
    palette.setColor(QPalette.ColorRole.WindowText, palette.color(QPalette.ColorRole.WindowText).lighter(180))
    palette.setColor(QPalette.ColorRole.Base, palette.color(QPalette.ColorRole.Base).darker(180))
    palette.setColor(QPalette.ColorRole.AlternateBase, palette.color(QPalette.ColorRole.AlternateBase).darker(160))
    palette.setColor(QPalette.ColorRole.ToolTipBase, palette.color(QPalette.ColorRole.ToolTipBase).lighter(180))
    palette.setColor(QPalette.ColorRole.ToolTipText, palette.color(QPalette.ColorRole.ToolTipText).lighter(180))
    palette.setColor(QPalette.ColorRole.Text, palette.color(QPalette.ColorRole.Text).lighter(200))
    palette.setColor(QPalette.ColorRole.Button, palette.color(QPalette.ColorRole.Button).darker(180))
    palette.setColor(QPalette.ColorRole.ButtonText, palette.color(QPalette.ColorRole.ButtonText).lighter(180))
    palette.setColor(QPalette.ColorRole.BrightText, palette.color(QPalette.ColorRole.BrightText).lighter(200))
    app.setPalette(palette)

    # Ensure fonts stay crisp.
    app.setStyle("Fusion")

    window = MainWindow()
    window.resize(1280, 720)
    window.show()

    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
