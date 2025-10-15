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

    # Qt 6 exposes colour roles under QPalette.ColorRole, while older builds
    # still allow access directly on QPalette. Grab whichever namespace exists
    # so we can safely reference the roles without touching the palette
    # instance itself (e.g. ``palette.Window``), which raises AttributeError.
    color_roles = getattr(QPalette, "ColorRole", QPalette)

    def adjust(role: QPalette.ColorRole, factor: int, lighten: bool = False) -> None:
        """Darken/lighten the given palette role if it is supported."""

        if role is None:
            return

        try:
            base = palette.color(role)
        except (AttributeError, TypeError):
            # Some Qt builds may refuse the role even though it exists; skip it
            # so launch never fails.
            return

        new_color = base.lighter(factor) if lighten else base.darker(factor)
        palette.setColor(role, new_color)

    # The palette roles that need tweaks to achieve the monochrome aesthetic.
    adjustments: dict[QPalette.ColorRole, tuple[int, bool]] = {
        getattr(color_roles, "Window", None): (160, False),
        getattr(color_roles, "WindowText", None): (180, True),
        getattr(color_roles, "Base", None): (180, False),
        getattr(color_roles, "AlternateBase", None): (160, False),
        getattr(color_roles, "ToolTipBase", None): (180, True),
        getattr(color_roles, "ToolTipText", None): (180, True),
        getattr(color_roles, "Text", None): (200, True),
        getattr(color_roles, "Button", None): (180, False),
        getattr(color_roles, "ButtonText", None): (180, True),
        getattr(color_roles, "BrightText", None): (200, True),
    }

    for role, (factor, lighten) in adjustments.items():
        adjust(role, factor, lighten)

    app.setPalette(palette)

    # Ensure fonts stay crisp.
    app.setStyle("Fusion")

    window = MainWindow()
    window.resize(1280, 720)
    window.show()

    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
