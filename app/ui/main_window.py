"""Main window and UI composition for the dithering studio."""
from __future__ import annotations

from pathlib import Path
from typing import Callable

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QAction, QImage, QPixmap
from PySide6.QtWidgets import (
    QComboBox,
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

        self._processor = ImageProcessor(self._update_preview)
        self._preset_manager = PresetManager(Path.home() / ".dither_studio" / "presets")

        self._source_path: Path | None = None
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
        panel_layout.addWidget(self._build_colour_controls())
        panel_layout.addWidget(self._build_output_controls())
        panel_layout.addStretch(1)

        return panel

    # ---------------------------------------------------------------- Algorithms
    def _build_algorithm_controls(self) -> QWidget:
        box = QGroupBox("Render Settings")
        layout = QFormLayout(box)

        self._algorithm_combo = QComboBox()
        self._algorithm_combo.addItems(self._processor.available_algorithms)
        self._algorithm_combo.currentTextChanged.connect(self._queue_update)
        layout.addRow("Algorithm", self._algorithm_combo)

        self._threshold_slider = self._make_slider(0, 255, 127, self._queue_update)
        layout.addRow("Threshold", self._threshold_slider)

        self._amplitude_slider = self._make_slider(0, 200, 100, self._queue_update)
        layout.addRow("Amplitude", self._amplitude_slider)

        self._frequency_slider = self._make_slider(1, 20, 5, self._queue_update)
        layout.addRow("Frequency", self._frequency_slider)

        self._period_slider = self._make_slider(1, 64, 8, self._queue_update)
        layout.addRow("Period", self._period_slider)

        self._slope_slider = self._make_slider(-100, 100, 0, self._queue_update)
        layout.addRow("Slope", self._slope_slider)

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

    # --------------------------------------------------------------- Colour Tools
    def _build_colour_controls(self) -> QWidget:
        box = QGroupBox("Colour Controls")
        layout = QFormLayout(box)

        self._red_slider = self._make_slider(0, 200, 100, self._queue_update)
        self._green_slider = self._make_slider(0, 200, 100, self._queue_update)
        self._blue_slider = self._make_slider(0, 200, 100, self._queue_update)

        layout.addRow("Red", self._red_slider)
        layout.addRow("Green", self._green_slider)
        layout.addRow("Blue", self._blue_slider)

        self._two_color_toggle = QComboBox()
        self._two_color_toggle.addItems(["Disabled", "Custom Two-Tone"])
        self._two_color_toggle.currentTextChanged.connect(self._queue_update)
        layout.addRow("Palette", self._two_color_toggle)

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
        return {
            "algorithm": self._algorithm_combo.currentText(),
            "threshold": self._threshold_slider.value(),
            "amplitude": self._amplitude_slider.value(),
            "frequency": self._frequency_slider.value(),
            "period": self._period_slider.value(),
            "slope": self._slope_slider.value(),
            "glow": self._glow_slider.value(),
            "noise": self._noise_slider.value(),
            "sharpen": self._sharpness_slider.value(),
            "red": self._red_slider.value(),
            "green": self._green_slider.value(),
            "blue": self._blue_slider.value(),
            "two_colour_mode": self._two_color_toggle.currentText(),
            "colour_a": self._color_a_input.text(),
            "colour_b": self._color_b_input.text(),
        }

    def _apply_settings(self, settings: dict) -> None:
        def set_value(widget, key, setter: Callable):
            if key in settings:
                setter(settings[key])

        set_value(self._algorithm_combo, "algorithm", self._algorithm_combo.setCurrentText)
        set_value(self._threshold_slider, "threshold", self._threshold_slider.setValue)
        set_value(self._amplitude_slider, "amplitude", self._amplitude_slider.setValue)
        set_value(self._frequency_slider, "frequency", self._frequency_slider.setValue)
        set_value(self._period_slider, "period", self._period_slider.setValue)
        set_value(self._slope_slider, "slope", self._slope_slider.setValue)
        set_value(self._glow_slider, "glow", self._glow_slider.setValue)
        set_value(self._noise_slider, "noise", self._noise_slider.setValue)
        set_value(self._sharpness_slider, "sharpen", self._sharpness_slider.setValue)
        set_value(self._red_slider, "red", self._red_slider.setValue)
        set_value(self._green_slider, "green", self._green_slider.setValue)
        set_value(self._blue_slider, "blue", self._blue_slider.setValue)
        set_value(self._two_color_toggle, "two_colour_mode", self._two_color_toggle.setCurrentText)
        set_value(self._color_a_input, "colour_a", self._color_a_input.setText)
        set_value(self._color_b_input, "colour_b", self._color_b_input.setText)

    def _queue_update(self) -> None:
        if not self._processor.has_image:
            return
        request = ProcessingRequest(
            algorithm=self._algorithm_combo.currentText(),
            threshold=self._threshold_slider.value(),
            amplitude=self._amplitude_slider.value() / 100.0,
            frequency=self._frequency_slider.value(),
            period=self._period_slider.value(),
            slope=self._slope_slider.value() / 100.0,
            glow_radius=self._glow_slider.value(),
            noise_level=self._noise_slider.value() / 100.0,
            sharpen_amount=self._sharpness_slider.value() / 100.0,
            red_scale=self._red_slider.value() / 100.0,
            green_scale=self._green_slider.value() / 100.0,
            blue_scale=self._blue_slider.value() / 100.0,
            two_colour_mode=self._two_color_toggle.currentText(),
            colour_a=self._color_a_input.text(),
            colour_b=self._color_b_input.text(),
            full_resolution=False,
        )
        self._processor.enqueue(request)

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
        request = ProcessingRequest(
            algorithm=self._algorithm_combo.currentText(),
            threshold=self._threshold_slider.value(),
            amplitude=self._amplitude_slider.value() / 100.0,
            frequency=self._frequency_slider.value(),
            period=self._period_slider.value(),
            slope=self._slope_slider.value() / 100.0,
            glow_radius=self._glow_slider.value(),
            noise_level=self._noise_slider.value() / 100.0,
            sharpen_amount=self._sharpness_slider.value() / 100.0,
            red_scale=self._red_slider.value() / 100.0,
            green_scale=self._green_slider.value() / 100.0,
            blue_scale=self._blue_slider.value() / 100.0,
            two_colour_mode=self._two_color_toggle.currentText(),
            colour_a=self._color_a_input.text(),
            colour_b=self._color_b_input.text(),
            full_resolution=True,
        )
        self._processor.enqueue(request)

    def _on_zoom_changed(self, zoom: float) -> None:
        self._zoom_label.setText(f"Zoom: {int(zoom * 100)}%")

    # ----------------------------------------------------------------- Properties
    @property
    def processor(self) -> ImageProcessor:
        return self._processor
