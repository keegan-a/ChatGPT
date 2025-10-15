"""Allow running the application via ``python -m app``."""
from __future__ import annotations

from app.main import main


def _run() -> int:
    """Delegate to :func:`app.main.main` for module execution."""
    return main()


if __name__ == "__main__":  # pragma: no cover - invoked by the interpreter
    raise SystemExit(_run())
