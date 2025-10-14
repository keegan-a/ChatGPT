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

    def install_aliases() -> None:
        """Patch palette instances so legacy attributes resolve safely.

        Some PySide6 wheels expose the classic ``QPalette.Window`` constants,
        some only expose the enum-style ``QPalette.ColorRole.Window`` values,
        and a few ship neither but still leave compiled bytecode around that
        references ``palette.Window``. We add aliases on both the class and the
        instance to ensure any import order still succeeds.
        """

        for role_name in (
            "Window",
            "WindowText",
            "Base",
            "AlternateBase",
            "ToolTipBase",
            "ToolTipText",
            "Text",
            "Button",
            "ButtonText",
            "BrightText",
        ):
            role = resolve_role(role_name)
            if role is None:
                continue
            if not hasattr(QPalette, role_name):
                setattr(QPalette, role_name, role)
            if not hasattr(palette, role_name):
                setattr(palette, role_name, role)

    install_aliases()

    def adjust(role_name: str, factor: int, lighten: bool = False) -> None:
        role = resolve_role(role_name)
        if role is None:
            return
        base = palette.color(role)
        palette.setColor(role, base.lighter(factor) if lighten else base.darker(factor))

    adjust("Window", 160)
    adjust("WindowText", 180, lighten=True)
    adjust("Base", 180)
    adjust("AlternateBase", 160)
    adjust("ToolTipBase", 180, lighten=True)
    adjust("ToolTipText", 180, lighten=True)
    adjust("Text", 200, lighten=True)
    adjust("Button", 180)
    adjust("ButtonText", 180, lighten=True)
    adjust("BrightText", 200, lighten=True)

    app.setPalette(palette)

    # Ensure fonts stay crisp.
    app.setStyle("Fusion")

    window = MainWindow()
    window.resize(1280, 720)
    window.show()

    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
