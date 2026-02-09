"""Qt main window for the Dithering Tool application."""
from __future__ import annotations

from pathlib import Path
from typing import Dict, Optional

from PIL import Image, ImageDraw
from PySide6.QtCore import QObject, QRunnable, Qt, QThreadPool, QTimer, Signal
from PySide6.QtGui import QCloseEvent, QImage, QPixmap
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QFileDialog,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSlider,
    QSpinBox,
    QSplitter,
    QStatusBar,
    QVBoxLayout,
    QWidget,
)

from app.core.dithering import algorithm_names, get_algorithm
from app.core.image_processor import DitheringSettings, ImageProcessor


class WorkerSignals(QObject):
    result = Signal(int, object)
    error = Signal(int, str)


class DitherTask(QRunnable):
    """Run the dithering pipeline in a background thread."""

    def __init__(self, processor: ImageProcessor, settings: DitheringSettings, generation: int, preview: bool) -> None:
        super().__init__()
        self.processor = processor
        self.settings = settings
        self.generation = generation
        self.preview = preview
        self.signals = WorkerSignals()

    def run(self) -> None:  # pragma: no cover - executed in worker threads
        try:
            if self.preview:
                result = self.processor.render_preview(self.settings)
            else:
                result = self.processor.render_full(self.settings)
        except Exception as exc:  # pragma: no cover - surfaced through signal
            self.signals.error.emit(self.generation, str(exc))
            return
        self.signals.result.emit(self.generation, result)


class MainWindow(QMainWindow):
    """Primary window showing the preview and the control sidebar."""

    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("Dithering Tool")
        self.processor = ImageProcessor()
        self.thread_pool = QThreadPool(self)
        self.thread_pool.setMaxThreadCount(1)
        self._generation = 0
        self._last_result = None
        self._original_image: Optional[Image.Image] = None

        self._build_ui()
        self._connect_signals()

        self.update_timer = QTimer(self)
        self.update_timer.setSingleShot(True)
        self.update_timer.timeout.connect(lambda: self._start_task(preview=True))

    # ------------------------------------------------------------------ UI setup
    def _build_ui(self) -> None:
        central = QWidget()
        main_layout = QHBoxLayout(central)
        central.setLayout(main_layout)
        self.setCentralWidget(central)

        splitter = QSplitter(Qt.Horizontal)
        main_layout.addWidget(splitter, 1)

        # Preview panels -------------------------------------------------------
        preview_widget = QWidget()
        preview_layout = QHBoxLayout(preview_widget)
        preview_layout.setContentsMargins(8, 8, 8, 8)

        self.original_label = QLabel("Load an image to begin")
        self.original_label.setAlignment(Qt.AlignCenter)
        self.original_label.setMinimumSize(320, 240)
        self.original_label.setStyleSheet("background:#111; color:#eee; border:1px solid #333;")

        self.dithered_label = QLabel("Dithered preview")
        self.dithered_label.setAlignment(Qt.AlignCenter)
        self.dithered_label.setMinimumSize(320, 240)
        self.dithered_label.setStyleSheet("background:#111; color:#eee; border:1px solid #333;")

        preview_layout.addWidget(self._wrap_with_caption(self.original_label, "Original"))
        preview_layout.addWidget(self._wrap_with_caption(self.dithered_label, "Dithered"))
        splitter.addWidget(preview_widget)

        # Control sidebar -----------------------------------------------------
        controls = QWidget()
        controls_layout = QVBoxLayout(controls)
        controls_layout.setContentsMargins(8, 8, 8, 8)
        controls_layout.setSpacing(12)

        controls_layout.addLayout(self._build_file_buttons())
        controls_layout.addWidget(self._build_algorithm_group())
        controls_layout.addWidget(self._build_palette_group())
        controls_layout.addWidget(self._build_adjustment_group())
        controls_layout.addStretch(1)
        controls_layout.addWidget(self._build_options_group())

        splitter.addWidget(controls)
        splitter.setStretchFactor(0, 3)
        splitter.setStretchFactor(1, 2)

        status = QStatusBar()
        status.showMessage("Ready")
        self.setStatusBar(status)
        self.status_bar = status

    def _wrap_with_caption(self, widget: QWidget, caption: str) -> QWidget:
        container = QWidget()
        layout = QVBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)
        title = QLabel(caption)
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet("color:#ccc; font-weight:bold; padding-bottom:4px;")
        layout.addWidget(title)
        layout.addWidget(widget, 1)
        return container

    def _build_file_buttons(self) -> QHBoxLayout:
        layout = QHBoxLayout()
        self.load_button = QPushButton("Load Image…")
        self.save_button = QPushButton("Save Dithered Image…")
        self.reset_button = QPushButton("Reset")
        self.save_button.setEnabled(False)
        self.reset_button.setEnabled(False)
        layout.addWidget(self.load_button)
        layout.addWidget(self.save_button)
        layout.addWidget(self.reset_button)
        return layout

    def _build_algorithm_group(self) -> QGroupBox:
        group = QGroupBox("Algorithm")
        layout = QFormLayout(group)

        self.algorithm_combo = QComboBox()
        for name in algorithm_names():
            algorithm = get_algorithm(name)
            self.algorithm_combo.addItem(name)
            self.algorithm_combo.setItemData(self.algorithm_combo.count() - 1, algorithm.description, Qt.ToolTipRole)

        self.serpentine_box = QCheckBox("Serpentine scan")
        self.serpentine_box.setChecked(True)

        layout.addRow("Mode", self.algorithm_combo)
        layout.addRow("", self.serpentine_box)
        return group

    def _build_palette_group(self) -> QGroupBox:
        group = QGroupBox("Palette")
        layout = QFormLayout(group)

        self.color_count_spin = QSpinBox()
        self.color_count_spin.setRange(2, 64)
        self.color_count_spin.setValue(8)

        self.palette_combo = QComboBox()
        for name in self.processor.available_palettes:
            self.palette_combo.addItem(name)

        self.palette_preview = QLabel()
        self.palette_preview.setFixedHeight(36)
        self.palette_preview.setMinimumWidth(160)
        self.palette_preview.setAlignment(Qt.AlignCenter)
        self.palette_preview.setStyleSheet("border:1px solid #333; background:#111;")
        self.palette_preview.setScaledContents(True)

        self.load_palette_button = QPushButton("Load Custom Palette…")

        layout.addRow("Colors", self.color_count_spin)
        layout.addRow("Palette", self.palette_combo)
        layout.addRow(self.load_palette_button)
        layout.addRow("Swatches", self.palette_preview)
        return group

    def _build_adjustment_group(self) -> QGroupBox:
        group = QGroupBox("Image Adjustments")
        layout = QVBoxLayout(group)

        self.sliders: Dict[str, QSlider] = {}
        self.value_labels: Dict[str, QLabel] = {}

        layout.addLayout(self._add_slider("brightness", "Brightness", -100, 100, 0, lambda v: f"{v/100:.2f}"))
        layout.addLayout(self._add_slider("contrast", "Contrast", -100, 100, 0, lambda v: f"{v/100:.2f}"))
        layout.addLayout(self._add_slider("gamma", "Gamma", 50, 220, 100, lambda v: f"{v/100:.2f}"))
        layout.addLayout(self._add_slider("blur", "Blur Radius", 0, 50, 0, lambda v: f"{v/10:.1f}px"))
        layout.addLayout(self._add_slider("sharpen", "Sharpen", 0, 100, 0, lambda v: f"{v/100:.2f}"))
        layout.addLayout(self._add_slider("denoise", "Denoise", 0, 100, 0, lambda v: f"{v/100:.2f}"))
        return group

    def _add_slider(self, key: str, label: str, minimum: int, maximum: int, default: int, formatter) -> QHBoxLayout:
        row = QHBoxLayout()
        title = QLabel(label)
        slider = QSlider(Qt.Horizontal)
        slider.setRange(minimum, maximum)
        slider.setValue(default)
        value_label = QLabel(formatter(default))
        value_label.setFixedWidth(70)
        slider.valueChanged.connect(lambda value, f=formatter, lbl=value_label: lbl.setText(f(value)))
        slider.valueChanged.connect(lambda _value: self.schedule_preview())

        row.addWidget(title)
        row.addWidget(slider, 1)
        row.addWidget(value_label)
        self.sliders[key] = slider
        self.value_labels[key] = value_label
        return row

    def _build_options_group(self) -> QGroupBox:
        group = QGroupBox("Options")
        layout = QVBoxLayout(group)
        self.preserve_brightness_box = QCheckBox("Preserve brightness (linear)")
        self.transparent_box = QCheckBox("Transparent background")
        self.transparent_box.setChecked(True)
        layout.addWidget(self.preserve_brightness_box)
        layout.addWidget(self.transparent_box)
        return group

    # ----------------------------------------------------------------- signals
    def _connect_signals(self) -> None:
        self.load_button.clicked.connect(self.load_image)
        self.save_button.clicked.connect(self.save_image)
        self.reset_button.clicked.connect(self.reset_controls)
        self.algorithm_combo.currentIndexChanged.connect(self._on_algorithm_change)
        self.serpentine_box.stateChanged.connect(lambda _state: self.schedule_preview())
        self.color_count_spin.valueChanged.connect(lambda _value: self.schedule_preview())
        self.palette_combo.currentIndexChanged.connect(lambda _value: self.schedule_preview())
        self.load_palette_button.clicked.connect(self._select_palette_file)
        self.preserve_brightness_box.stateChanged.connect(lambda _value: self.schedule_preview())
        self.transparent_box.stateChanged.connect(lambda _value: self.schedule_preview())

    # ----------------------------------------------------------------- actions
    def load_image(self) -> None:
        file_name, _ = QFileDialog.getOpenFileName(
            self,
            "Open Image",
            "",
            "Images (*.png *.jpg *.jpeg *.bmp *.gif)",
        )
        if not file_name:
            return
        try:
            with Image.open(file_name) as opened:
                opened.load()
                if opened.mode not in {"RGB", "RGBA"}:
                    image = opened.convert("RGBA")
                else:
                    image = opened.copy()
        except Exception as exc:
            QMessageBox.critical(self, "Load failed", f"Could not open image: {exc}")
            return
        try:
            self.processor.set_image(image)
        except Exception as exc:
            QMessageBox.critical(self, "Load failed", f"Could not prepare image: {exc}")
            return
        self._original_image = image.copy()
        self._last_result = None
        self._update_original_preview(self._original_image)
        self.save_button.setEnabled(True)
        self.reset_button.setEnabled(True)
        self.status_bar.showMessage(f"Loaded {Path(file_name).name}")
        self.schedule_preview()

    def save_image(self) -> None:
        if not self.processor.has_image:
            return
        settings = self._gather_settings()
        file_name, _ = QFileDialog.getSaveFileName(
            self,
            "Save Dithered Image",
            "dithered.png",
            "Images (*.png *.bmp *.jpg *.gif)",
        )
        if not file_name:
            return
        self.status_bar.showMessage("Rendering full resolution…")
        QApplication.setOverrideCursor(Qt.WaitCursor)
        try:
            result = self.processor.render_full(settings)
            result.image.save(file_name)
        except Exception as exc:
            QMessageBox.critical(self, "Save failed", f"Could not save image: {exc}")
        finally:
            QApplication.restoreOverrideCursor()
        self.status_bar.showMessage(f"Saved {Path(file_name).name}")

    def reset_controls(self) -> None:
        self.algorithm_combo.setCurrentIndex(0)
        self.serpentine_box.setChecked(True)
        self.color_count_spin.setValue(8)
        self.palette_combo.setCurrentIndex(0)
        self.preserve_brightness_box.setChecked(False)
        self.transparent_box.setChecked(True)
        defaults = {
            "brightness": 0,
            "contrast": 0,
            "gamma": 100,
            "blur": 0,
            "sharpen": 0,
            "denoise": 0,
        }
        for key, value in defaults.items():
            self.sliders[key].blockSignals(True)
            self.sliders[key].setValue(value)
            self.sliders[key].blockSignals(False)
        self.schedule_preview()

    def _select_palette_file(self) -> None:
        file_name, _ = QFileDialog.getOpenFileName(
            self,
            "Load Palette",
            "",
            "Palette files (*.png *.jpg *.jpeg *.bmp *.gif *.txt *.pal *.gpl)",
        )
        if not file_name:
            return
        try:
            palette = self.processor.load_palette_from_file(Path(file_name))
        except Exception as exc:
            QMessageBox.critical(self, "Palette load failed", f"Could not load palette: {exc}")
            return
        self.status_bar.showMessage(f"Loaded palette with {len(palette)} colours")
        self.palette_combo.setCurrentText("Custom Palette")
        self.schedule_preview()

    # ---------------------------------------------------------------- updates
    def schedule_preview(self) -> None:
        if not self.processor.has_image:
            return
        self.update_timer.stop()
        self.update_timer.start(200)

    def _start_task(self, preview: bool) -> None:
        if not self.processor.has_image:
            return
        self._generation += 1
        settings = self._gather_settings()
        task = DitherTask(self.processor, settings, self._generation, preview)
        task.signals.result.connect(self._on_task_result)
        task.signals.error.connect(self._on_task_error)
        self.thread_pool.start(task)
        if preview:
            self.status_bar.showMessage("Rendering preview…")

    def _on_task_result(self, generation: int, result) -> None:
        if generation != self._generation:
            return
        self._last_result = result
        pixmap = self._pixmap_from_image(result.image)
        self._update_dithered_preview(pixmap)
        self._update_palette_preview(result.palette)
        self.status_bar.showMessage("Preview ready")

    def _on_task_error(self, generation: int, message: str) -> None:
        if generation != self._generation:
            return
        QMessageBox.critical(self, "Processing error", message)
        self.status_bar.showMessage("Processing error")

    # ---------------------------------------------------------------- helpers
    def _gather_settings(self) -> DitheringSettings:
        settings = DitheringSettings()
        settings.algorithm = self.algorithm_combo.currentText()
        settings.serpentine = self.serpentine_box.isChecked()
        settings.color_count = self.color_count_spin.value()
        settings.palette_mode = self.palette_combo.currentText()
        settings.brightness = self.sliders["brightness"].value() / 100.0
        settings.contrast = self.sliders["contrast"].value() / 100.0
        settings.gamma = max(0.1, self.sliders["gamma"].value() / 100.0)
        settings.blur_radius = self.sliders["blur"].value() / 10.0
        settings.sharpen_amount = self.sliders["sharpen"].value() / 100.0
        settings.denoise_strength = self.sliders["denoise"].value() / 100.0
        settings.preserve_brightness = self.preserve_brightness_box.isChecked()
        settings.transparent_background = self.transparent_box.isChecked()
        return settings

    def _update_original_preview(self, image: Image.Image) -> None:
        pixmap = self._pixmap_from_image(image)
        if pixmap.isNull():
            return
        target_size = self.original_label.size()
        if target_size.width() == 0 or target_size.height() == 0:
            self.original_label.setPixmap(pixmap)
        else:
            self.original_label.setPixmap(
                pixmap.scaled(target_size, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            )

    def _update_dithered_preview(self, pixmap: QPixmap) -> None:
        if pixmap.isNull():
            return
        target_size = self.dithered_label.size()
        if target_size.width() == 0 or target_size.height() == 0:
            self.dithered_label.setPixmap(pixmap)
        else:
            self.dithered_label.setPixmap(
                pixmap.scaled(target_size, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            )

    def resizeEvent(self, event) -> None:  # pragma: no cover - UI callback
        super().resizeEvent(event)
        if self.original_label.pixmap() and self._original_image is not None:
            self._update_original_preview(self._original_image)
        if self.dithered_label.pixmap() and self._last_result is not None:
            pixmap = self._pixmap_from_image(self._last_result.image)
            self._update_dithered_preview(pixmap)

    def closeEvent(self, event: QCloseEvent) -> None:  # pragma: no cover - UI callback
        self.thread_pool.waitForDone(1000)
        super().closeEvent(event)

    def _pixmap_from_image(self, image: Image.Image) -> QPixmap:
        if image.mode not in {"RGB", "RGBA"}:
            converted = image.convert("RGBA")
        else:
            converted = image
        data = converted.tobytes("raw", converted.mode)
        if converted.mode == "RGBA":
            qimage = QImage(data, converted.width, converted.height, QImage.Format_RGBA8888)
        else:
            qimage = QImage(data, converted.width, converted.height, QImage.Format_RGB888)
        return QPixmap.fromImage(qimage.copy())

    def _update_palette_preview(self, palette) -> None:
        try:
            length = len(palette)
        except TypeError:
            length = int(getattr(palette, "size", 0))
        if length == 0:
            self.palette_preview.clear()
            return
        swatch_width = 24
        swatch_height = 24
        if hasattr(palette, "tolist"):
            palette_list = palette.tolist()
        else:
            palette_list = list(palette)
        image = Image.new("RGB", (swatch_width * max(len(palette_list), 1), swatch_height), color=(0, 0, 0))
        draw = ImageDraw.Draw(image)
        for index, colour in enumerate(palette_list):
            x0 = index * swatch_width
            draw.rectangle([x0, 0, x0 + swatch_width - 1, swatch_height], fill=tuple(int(c) for c in colour))
        pixmap = self._pixmap_from_image(image)
        self.palette_preview.setPixmap(pixmap)

    def _on_algorithm_change(self) -> None:
        name = self.algorithm_combo.currentText()
        algorithm = get_algorithm(name)
        if algorithm.kind != "error_diffusion":
            self.serpentine_box.setEnabled(False)
        else:
            self.serpentine_box.setEnabled(True)
        self.schedule_preview()
