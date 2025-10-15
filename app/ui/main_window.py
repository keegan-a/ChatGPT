"""Main window and UI composition for the dithering studio."""
from __future__ import annotations

from pathlib import Path
from typing import Callable

from PySide6.QtCore import Qt, Signal, Slot
from PySide6.QtGui import QAction, QImage, QPixmap
from PySide6.QtWidgets import (
    QComboBox,
    QCheckBox,
    QFileDialog,
    QFormLayout,
    QGraphicsPixmapItem,
    QGraphicsScene,
    QGraphicsView,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSlider,
    QSplitter,
    QToolBar,
    QVBoxLayout,
    QWidget,
)

from app.core.dithering import ParameterSpec, algorithm_spec, parameter_defaults
from app.core.image_processor import ImageProcessor
from app.core.models import ProcessingRequest
from app.core.presets import PresetManager


class PreviewView(QGraphicsView):
    """Zoomable view for image preview."""

    zoom_changed = Signal(float)

    def __init__(self) -> None:
        super().__init__()
        self.setAlignment(Qt.AlignCenter)
        self.setBackgroundBrush(self.palette().window().color())
        self._zoom_level = 1.0

    def wheelEvent(self, event):  # type: ignore[override]
        if event.modifiers() & Qt.ControlModifier:
            delta = event.angleDelta().y()
            factor = 1.2 if delta > 0 else 0.8
            self._zoom_level = max(0.1, min(10.0, self._zoom_level * factor))
            self.resetTransform()
            self.scale(self._zoom_level, self._zoom_level)
            self.zoom_changed.emit(self._zoom_level)
            event.accept()
        else:
            super().wheelEvent(event)


class MainWindow(QMainWindow):
    """Construct the main UI and connect controls."""

    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("Dither Studio")

        self._scene = QGraphicsScene(self)
        self._preview_item = QGraphicsPixmapItem()
        self._scene.addItem(self._preview_item)

        self._view = PreviewView()
        self._view.setScene(self._scene)

        self._processor = ImageProcessor()
        self._processor.processed.connect(self._update_preview)
        self._preset_manager = PresetManager(Path.home() / ".dither_studio" / "presets")

        self._source_path: Path | None = None
        self._parameter_form: QFormLayout | None = None
        self._parameter_controls: dict[str, tuple[QSlider, QLabel, ParameterSpec]] = {}
        self._building_parameters = False
        self._pixel_size_stops = [
            1.0,
            1.2,
            1.4,
            1.7,
            2.0,
            2.4,
            2.8,
            3.4,
            4.0,
            4.8,
            5.6,
            6.8,
            8.0,
            10.0,
            12.0,
            16.0,
            20.0,
            24.0,
            32.0,
        ]
        self._pixel_size_label: QLabel | None = None
        self._parameter_fallbacks = {
            "amplitude": 0.0,
            "frequency": 1.0,
            "period": 1.0,
            "slope": 0.0,
            "rotation": 0.0,
        }
        self.statusBar()
        self._setup_ui()

    # ------------------------------------------------------------------ UI SETUP
    def _setup_ui(self) -> None:
        central = QWidget()
        layout = QHBoxLayout(central)

        splitter = QSplitter()
        splitter.setOrientation(Qt.Horizontal)
        splitter.addWidget(self._view)
        splitter.addWidget(self._build_control_panel())
        splitter.setStretchFactor(0, 2)
        splitter.setStretchFactor(1, 1)

        layout.addWidget(splitter)
        self.setCentralWidget(central)

        self._setup_menu()

    def _setup_menu(self) -> None:
        toolbar = QToolBar("File")
        self.addToolBar(Qt.TopToolBarArea, toolbar)

        open_action = QAction("Open Image", self)
        open_action.triggered.connect(self._open_image)
        toolbar.addAction(open_action)

        save_action = QAction("Save Output", self)
        save_action.triggered.connect(self._save_image)
        toolbar.addAction(save_action)

        toolbar.addSeparator()

        load_preset_action = QAction("Load Preset", self)
        load_preset_action.triggered.connect(self._load_preset)
        toolbar.addAction(load_preset_action)

        save_preset_action = QAction("Save Preset", self)
        save_preset_action.triggered.connect(self._save_preset)
        toolbar.addAction(save_preset_action)

    def _build_control_panel(self) -> QWidget:
        panel = QWidget()
        panel_layout = QVBoxLayout(panel)

        panel_layout.addWidget(self._build_algorithm_controls())
        panel_layout.addWidget(self._build_effect_controls())
        panel_layout.addWidget(self._build_tone_controls())
        panel_layout.addWidget(self._build_colour_controls())
        panel_layout.addWidget(self._build_output_controls())
        panel_layout.addStretch(1)

        return panel

    # ---------------------------------------------------------------- Algorithms
    def _build_algorithm_controls(self) -> QWidget:
        box = QGroupBox("Render Settings")
        outer_layout = QVBoxLayout(box)

        form = QFormLayout()
        outer_layout.addLayout(form)

        self._algorithm_combo = QComboBox()
        self._algorithm_combo.addItems(self._processor.available_algorithms)
        self._algorithm_combo.currentTextChanged.connect(self._on_algorithm_changed)
        form.addRow("Algorithm", self._algorithm_combo)

        self._threshold_slider = self._make_slider(0, 255, 127, self._queue_update)
        form.addRow("Threshold", self._threshold_slider)

        pixel_row = QWidget()
        pixel_layout = QHBoxLayout(pixel_row)
        pixel_layout.setContentsMargins(0, 0, 0, 0)
        self._pixel_size_slider = self._make_slider(
            0, len(self._pixel_size_stops) - 1, 0, self._on_pixel_slider_changed
        )
        self._pixel_size_slider.setPageStep(1)
        pixel_layout.addWidget(self._pixel_size_slider)
        self._pixel_size_label = QLabel("1.0x")
        pixel_layout.addWidget(self._pixel_size_label)
        form.addRow("Pixel Size", pixel_row)

        self._parameter_form = QFormLayout()
        outer_layout.addLayout(self._parameter_form)

        self._on_algorithm_changed(self._algorithm_combo.currentText())

        return box

    # ---------------------------------------------------------------- Effects
    def _build_effect_controls(self) -> QWidget:
        box = QGroupBox("Effects")
        layout = QFormLayout(box)

        self._glow_slider = self._make_slider(0, 50, 0, self._queue_update)
        layout.addRow("Glow Radius", self._glow_slider)

        self._noise_slider = self._make_slider(0, 100, 0, self._queue_update)
        layout.addRow("Noise", self._noise_slider)

        self._sharpness_slider = self._make_slider(0, 100, 50, self._queue_update)
        layout.addRow("Sharpen", self._sharpness_slider)

        return box

    def _build_tone_controls(self) -> QWidget:
        box = QGroupBox("Tone & FX")
        layout = QFormLayout(box)

        self._gamma_slider = self._make_slider(10, 300, 100, self._queue_update)
        layout.addRow("Gamma", self._gamma_slider)

        self._contrast_slider = self._make_slider(0, 200, 100, self._queue_update)
        layout.addRow("Contrast", self._contrast_slider)

        self._saturation_slider = self._make_slider(0, 200, 100, self._queue_update)
        layout.addRow("Saturation", self._saturation_slider)

        self._hue_slider = self._make_slider(-180, 180, 0, self._queue_update)
        layout.addRow("Hue Shift", self._hue_slider)

        self._edge_slider = self._make_slider(0, 100, 0, self._queue_update)
        layout.addRow("Edge Boost", self._edge_slider)

        self._posterize_slider = self._make_slider(0, 8, 0, self._queue_update)
        layout.addRow("Posterize Levels", self._posterize_slider)

        self._blend_slider = self._make_slider(0, 100, 0, self._queue_update)
        layout.addRow("Blend Original", self._blend_slider)

        self._vignette_slider = self._make_slider(0, 100, 0, self._queue_update)
        layout.addRow("Vignette", self._vignette_slider)

        self._invert_toggle = QCheckBox("Invert Output")
        self._invert_toggle.stateChanged.connect(self._queue_update)
        layout.addRow(self._invert_toggle)

        return box

    # --------------------------------------------------------------- Colour Tools
    def _build_colour_controls(self) -> QWidget:
        box = QGroupBox("Colour Controls")
        layout = QFormLayout(box)

        self._colour_mode_combo = QComboBox()
        self._colour_mode_combo.addItems(self._processor.available_colour_modes)
        self._colour_mode_combo.currentTextChanged.connect(self._queue_update)
        layout.addRow("Colour Mode", self._colour_mode_combo)

        self._red_slider = self._make_slider(0, 200, 100, self._queue_update)
        self._green_slider = self._make_slider(0, 200, 100, self._queue_update)
        self._blue_slider = self._make_slider(0, 200, 100, self._queue_update)

        layout.addRow("Red", self._red_slider)
        layout.addRow("Green", self._green_slider)
        layout.addRow("Blue", self._blue_slider)

        self._palette_combo = QComboBox()
        self._palette_combo.addItems(self._processor.available_palettes)
        self._palette_combo.currentTextChanged.connect(self._on_palette_changed)
        layout.addRow("Palette", self._palette_combo)

        two_color_layout = QHBoxLayout()
        self._color_a_input = QLineEdit("#000000")
        self._color_b_input = QLineEdit("#FFFFFF")
        for widget in (self._color_a_input, self._color_b_input):
            widget.editingFinished.connect(self._queue_update)
        two_color_layout.addWidget(QLabel("Dark"))
        two_color_layout.addWidget(self._color_a_input)
        two_color_layout.addWidget(QLabel("Light"))
        two_color_layout.addWidget(self._color_b_input)
        layout.addRow(two_color_layout)

        self._on_palette_changed(self._palette_combo.currentText())

        return box

    # --------------------------------------------------------------- Output Tools
    def _build_output_controls(self) -> QWidget:
        box = QGroupBox("Output")
        layout = QVBoxLayout(box)

        self._zoom_label = QLabel("Zoom: 100%")
        self._view.zoom_changed.connect(self._on_zoom_changed)

        self._render_button = QPushButton("Render Full Resolution")
        self._render_button.clicked.connect(self._render_full_resolution)

        layout.addWidget(self._zoom_label)
        layout.addWidget(self._render_button)

        return box

    # ----------------------------------------------------------------- Utilities
    def _make_slider(self, minimum: int, maximum: int, value: int, slot: Callable[[int], None]) -> QSlider:
        slider = QSlider(Qt.Horizontal)
        slider.setRange(minimum, maximum)
        slider.setValue(value)
        slider.valueChanged.connect(slot)
        slider.setSingleStep(1)
        return slider

    def _format_parameter_value(self, spec: ParameterSpec, value: float) -> str:
        if spec.multiplier <= 1:
            return f"{int(round(value))}"
        if spec.multiplier <= 10:
            return f"{value:.1f}"
        return f"{value:.2f}"

    def _rebuild_parameter_controls(self, algorithm: str) -> None:
        if self._parameter_form is None:
            return

        while self._parameter_form.rowCount():
            self._parameter_form.removeRow(0)
        self._parameter_controls.clear()

        spec = algorithm_spec(algorithm)
        self._building_parameters = True
        for parameter in spec.parameters:
            slider = self._make_slider(
                int(round(parameter.minimum * parameter.multiplier)),
                int(round(parameter.maximum * parameter.multiplier)),
                int(round(parameter.default * parameter.multiplier)),
                lambda value, field=parameter.field: self._on_parameter_changed(field, value),
            )
            slider.setPageStep(max(1, slider.maximum() // 12))
            value_label = QLabel(self._format_parameter_value(parameter, parameter.default))
            row = QWidget()
            row_layout = QHBoxLayout(row)
            row_layout.setContentsMargins(0, 0, 0, 0)
            row_layout.addWidget(slider)
            row_layout.addWidget(value_label)
            self._parameter_form.addRow(parameter.label, row)
            self._parameter_controls[parameter.field] = (slider, value_label, parameter)

        self._building_parameters = False

    def _current_pixel_size(self) -> float:
        index = max(0, min(self._pixel_size_slider.value(), len(self._pixel_size_stops) - 1))
        return self._pixel_size_stops[index]

    def _pixel_index_for_value(self, value: float) -> int:
        candidates = [
            (abs(stop - value), idx) for idx, stop in enumerate(self._pixel_size_stops)
        ]
        candidates.sort()
        return candidates[0][1]

    def _on_pixel_slider_changed(self, value: int) -> None:  # noqa: ARG002
        if self._pixel_size_label is not None:
            size = self._current_pixel_size()
            suffix = "x"
            if size >= 10:
                self._pixel_size_label.setText(f"{size:.0f}{suffix}")
            else:
                self._pixel_size_label.setText(f"{size:.1f}{suffix}")
        self._queue_update()

    def _on_parameter_changed(self, field: str, value: int) -> None:
        del value
        if field not in self._parameter_controls:
            return
        slider, label, spec = self._parameter_controls[field]
        actual = slider.value() / spec.multiplier
        label.setText(self._format_parameter_value(spec, actual))
        if not self._building_parameters:
            self._queue_update()

    def _collect_parameter_values(self) -> dict[str, float]:
        values: dict[str, float] = {}
        for field, (slider, _, spec) in self._parameter_controls.items():
            values[field] = slider.value() / spec.multiplier
        return values

    # ----------------------------------------------------------------- Callbacks
    def _open_image(self) -> None:
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select an image",
            str(Path.home()),
            "Images (*.png *.jpg *.jpeg *.bmp *.tif *.tiff)",
        )
        if file_path:
            path = Path(file_path)
            try:
                self._processor.load_image(path)
                self._source_path = path
                self.statusBar().showMessage(f"Loaded {path.name}", 5000)
                self._queue_update()
            except Exception as exc:  # pragma: no cover - Qt dialog
                QMessageBox.critical(self, "Load Error", str(exc))

    def _save_image(self) -> None:
        if not self._processor.has_image:
            QMessageBox.information(self, "No image", "Load an image before saving.")
            return
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Save Dithered Image",
            str(self._source_path.parent if self._source_path else Path.home()),
            "PNG Image (*.png)",
        )
        if file_path:
            try:
                self._processor.save_output(Path(file_path))
                self.statusBar().showMessage("Image saved", 5000)
            except Exception as exc:  # pragma: no cover - Qt dialog
                QMessageBox.critical(self, "Save Error", str(exc))

    def _save_preset(self) -> None:
        if not self._processor.has_image:
            QMessageBox.information(self, "No image", "Load an image before saving a preset.")
            return
        name, ok = QFileDialog.getSaveFileName(
            self,
            "Save Preset",
            str(self._preset_manager.preset_dir),
            "Preset (*.json)",
        )
        if ok and name:
            self._preset_manager.save(Path(name), self._gather_settings())
            self.statusBar().showMessage("Preset saved", 5000)

    def _load_preset(self) -> None:
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Load Preset",
            str(self._preset_manager.preset_dir),
            "Preset (*.json)",
        )
        if file_path:
            settings = self._preset_manager.load(Path(file_path))
            self._apply_settings(settings)
            self._queue_update()

    def _gather_settings(self) -> dict:
        parameters = self._collect_parameter_values()
        return {
            "algorithm": self._algorithm_combo.currentText(),
            "threshold": self._threshold_slider.value(),
            "pixel_size": self._current_pixel_size(),
            "parameters": parameters,
            "glow": self._glow_slider.value(),
            "noise": self._noise_slider.value(),
            "sharpen": self._sharpness_slider.value(),
            "red": self._red_slider.value(),
            "green": self._green_slider.value(),
            "blue": self._blue_slider.value(),
            "colour_mode": self._colour_mode_combo.currentText(),
            "palette_mode": self._palette_combo.currentText(),
            "two_colour_mode": self._palette_combo.currentText(),
            "colour_a": self._color_a_input.text(),
            "colour_b": self._color_b_input.text(),
            "gamma": self._gamma_slider.value(),
            "contrast": self._contrast_slider.value(),
            "saturation": self._saturation_slider.value(),
            "hue": self._hue_slider.value(),
            "edge": self._edge_slider.value(),
            "posterize": self._posterize_slider.value(),
            "blend": self._blend_slider.value(),
            "invert": self._invert_toggle.isChecked(),
            "vignette": self._vignette_slider.value(),
        }

    def _apply_settings(self, settings: dict) -> None:
        def set_value(widget, key, setter: Callable):
            if key in settings:
                setter(settings[key])

        set_value(self._algorithm_combo, "algorithm", self._algorithm_combo.setCurrentText)
        set_value(self._threshold_slider, "threshold", self._threshold_slider.setValue)
        if "pixel_size" in settings:
            index = self._pixel_index_for_value(float(settings["pixel_size"]))
            self._pixel_size_slider.setValue(index)
        if "parameters" in settings and isinstance(settings["parameters"], dict):
            self._building_parameters = True
            for field, value in settings["parameters"].items():
                if field not in self._parameter_controls:
                    continue
                slider, label, spec = self._parameter_controls[field]
                numeric = float(value)
                numeric = min(max(numeric, spec.minimum), spec.maximum)
                slider.setValue(int(round(numeric * spec.multiplier)))
                label.setText(self._format_parameter_value(spec, numeric))
            self._building_parameters = False
        set_value(self._glow_slider, "glow", self._glow_slider.setValue)
        set_value(self._noise_slider, "noise", self._noise_slider.setValue)
        set_value(self._sharpness_slider, "sharpen", self._sharpness_slider.setValue)
        set_value(self._red_slider, "red", self._red_slider.setValue)
        set_value(self._green_slider, "green", self._green_slider.setValue)
        set_value(self._blue_slider, "blue", self._blue_slider.setValue)
        set_value(self._color_a_input, "colour_a", self._color_a_input.setText)
        set_value(self._color_b_input, "colour_b", self._color_b_input.setText)
        set_value(self._gamma_slider, "gamma", self._gamma_slider.setValue)
        set_value(self._contrast_slider, "contrast", self._contrast_slider.setValue)
        set_value(self._saturation_slider, "saturation", self._saturation_slider.setValue)
        set_value(self._hue_slider, "hue", self._hue_slider.setValue)
        set_value(self._edge_slider, "edge", self._edge_slider.setValue)
        set_value(self._posterize_slider, "posterize", self._posterize_slider.setValue)
        set_value(self._blend_slider, "blend", self._blend_slider.setValue)
        set_value(self._invert_toggle, "invert", self._invert_toggle.setChecked)
        set_value(self._vignette_slider, "vignette", self._vignette_slider.setValue)
        set_value(self._colour_mode_combo, "colour_mode", self._colour_mode_combo.setCurrentText)
        set_value(self._palette_combo, "palette_mode", self._palette_combo.setCurrentText)
        set_value(self._palette_combo, "two_colour_mode", self._palette_combo.setCurrentText)
        self._on_palette_changed(self._palette_combo.currentText())

    def _on_algorithm_changed(self, algorithm: str) -> None:
        for field, value in parameter_defaults(algorithm).items():
            self._parameter_fallbacks[field] = value
        self._rebuild_parameter_controls(algorithm)
        if self._pixel_size_label is not None:
            size = self._current_pixel_size()
            self._pixel_size_label.setText(f"{size:.1f}x" if size < 10 else f"{size:.0f}x")
        self._queue_update()

    def _queue_update(self) -> None:
        if not self._processor.has_image:
            return
        parameters = self._collect_parameter_values()
        defaults = self._parameter_fallbacks
        request = ProcessingRequest(
            algorithm=self._algorithm_combo.currentText(),
            threshold=self._threshold_slider.value(),
            amplitude=float(parameters.get("amplitude", defaults["amplitude"])),
            frequency=int(round(parameters.get("frequency", defaults["frequency"]))),
            period=int(round(parameters.get("period", defaults["period"]))),
            slope=float(parameters.get("slope", defaults["slope"])),
            pixel_size=self._current_pixel_size(),
            glow_radius=self._glow_slider.value(),
            noise_level=self._noise_slider.value() / 100.0,
            sharpen_amount=self._sharpness_slider.value() / 100.0,
            red_scale=self._red_slider.value() / 100.0,
            green_scale=self._green_slider.value() / 100.0,
            blue_scale=self._blue_slider.value() / 100.0,
            colour_mode=self._colour_mode_combo.currentText(),
            palette_mode=self._palette_combo.currentText(),
            colour_a=self._color_a_input.text(),
            colour_b=self._color_b_input.text(),
            full_resolution=False,
            gamma=self._gamma_slider.value() / 100.0,
            contrast=self._contrast_slider.value() / 100.0,
            saturation=self._saturation_slider.value() / 100.0,
            hue_shift=self._hue_slider.value(),
            edge_boost=self._edge_slider.value() / 100.0,
            posterize_levels=self._posterize_slider.value(),
            blend_original=self._blend_slider.value() / 100.0,
            invert_output=self._invert_toggle.isChecked(),
            vignette_strength=self._vignette_slider.value() / 100.0,
            rotation=float(parameters.get("rotation", defaults["rotation"])),
        )
        self._processor.enqueue(request)

    def _on_palette_changed(self, text: str) -> None:
        custom = text == "Custom Two-Tone"
        self._color_a_input.setEnabled(custom)
        self._color_b_input.setEnabled(custom)
        self._queue_update()

    @Slot(QImage, bool)
    def _update_preview(self, image: QImage, full_resolution: bool) -> None:
        pixmap = QPixmap.fromImage(image)
        self._preview_item.setPixmap(pixmap)
        self._scene.setSceneRect(pixmap.rect())
        if full_resolution:
            self.statusBar().showMessage("Full resolution render complete", 5000)

    def _render_full_resolution(self) -> None:
        if not self._processor.has_image:
            QMessageBox.information(self, "No image", "Load an image before rendering.")
            return
        parameters = self._collect_parameter_values()
        defaults = self._parameter_fallbacks
        request = ProcessingRequest(
            algorithm=self._algorithm_combo.currentText(),
            threshold=self._threshold_slider.value(),
            amplitude=float(parameters.get("amplitude", defaults["amplitude"])),
            frequency=int(round(parameters.get("frequency", defaults["frequency"]))),
            period=int(round(parameters.get("period", defaults["period"]))),
            slope=float(parameters.get("slope", defaults["slope"])),
            pixel_size=self._current_pixel_size(),
            glow_radius=self._glow_slider.value(),
            noise_level=self._noise_slider.value() / 100.0,
            sharpen_amount=self._sharpness_slider.value() / 100.0,
            red_scale=self._red_slider.value() / 100.0,
            green_scale=self._green_slider.value() / 100.0,
            blue_scale=self._blue_slider.value() / 100.0,
            colour_mode=self._colour_mode_combo.currentText(),
            palette_mode=self._palette_combo.currentText(),
            colour_a=self._color_a_input.text(),
            colour_b=self._color_b_input.text(),
            full_resolution=True,
            gamma=self._gamma_slider.value() / 100.0,
            contrast=self._contrast_slider.value() / 100.0,
            saturation=self._saturation_slider.value() / 100.0,
            hue_shift=self._hue_slider.value(),
            edge_boost=self._edge_slider.value() / 100.0,
            posterize_levels=self._posterize_slider.value(),
            blend_original=self._blend_slider.value() / 100.0,
            invert_output=self._invert_toggle.isChecked(),
            vignette_strength=self._vignette_slider.value() / 100.0,
            rotation=float(parameters.get("rotation", defaults["rotation"])),
        )
        self._processor.enqueue(request)

    def _on_zoom_changed(self, zoom: float) -> None:
        self._zoom_label.setText(f"Zoom: {int(zoom * 100)}%")

    # ----------------------------------------------------------------- Properties
    @property
    def processor(self) -> ImageProcessor:
        return self._processor
