"""Entry point for the dithering studio desktop application."""
from __future__ import annotations

import sys
from PySide6.QtGui import QPalette
from PySide6.QtWidgets import QApplication

from app.ui.main_window import MainWindow


def main() -> int:
    """Start the Qt application."""
    app = QApplication(sys.argv)
    app.setApplicationName("Dither Studio")

    # Apply a monochrome palette to match the design direction.
    palette = app.palette()

    def resolve_role(name: str) -> QPalette.ColorRole | int | None:
        """Return a palette role value that is compatible with the Qt build."""

        color_role_enum = getattr(QPalette, "ColorRole", None)
        if color_role_enum is not None:
            role = getattr(color_role_enum, name, None)
            if role is not None:
                return role
        return getattr(QPalette, name, None)

    def adjust(role_name: str, factor: int, lighten: bool = False) -> None:
        role = resolve_role(role_name)
        if role is None:
            return

        try:
            base = palette.color(role)
        except AttributeError:
            # Some Qt builds can resolve the role constant but still refuse to
            # accept it when querying colours; skip in that case so launching
            # never fails.
            return

        new_color = base.lighter(factor) if lighten else base.darker(factor)
        palette.setColor(role, new_color)

    # The palette roles that need tweaks to achieve the monochrome aesthetic.
    adjustments: dict[str, tuple[int, bool]] = {
        "Window": (160, False),
        "WindowText": (180, True),
        "Base": (180, False),
        "AlternateBase": (160, False),
        "ToolTipBase": (180, True),
        "ToolTipText": (180, True),
        "Text": (200, True),
        "Button": (180, False),
        "ButtonText": (180, True),
        "BrightText": (200, True),
    }

    for role_name, (factor, lighten) in adjustments.items():
        adjust(role_name, factor, lighten)

    app.setPalette(palette)

    # Ensure fonts stay crisp.
    app.setStyle("Fusion")

    window = MainWindow()
    window.resize(1280, 720)
    window.show()

    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
