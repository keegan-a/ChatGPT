"""Preset management for storing user configurations."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class PresetManager:
    preset_dir: Path

    def __post_init__(self) -> None:
        self.preset_dir.mkdir(parents=True, exist_ok=True)

    def save(self, path: Path, data: dict[str, Any]) -> None:
        if not path.suffix:
            path = path.with_suffix(".json")
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)

    def load(self, path: Path) -> dict[str, Any]:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
