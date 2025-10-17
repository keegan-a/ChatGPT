#target photoshop

(function () {
    if (!app.documents.length) {
        alert("Open a document before running the script.");
        return;
    }

    if (typeof ICOFormatOptions === "undefined") {
        alert("Install the ICO (Windows Icon) Format plug-in so Photoshop can write .ico files.");
        return;
    }

    var srcDoc = app.activeDocument;
    if (!srcDoc.saved && !srcDoc.path) {
        alert("Save the document or choose a target folder when prompted.");
    }

    var baseName = decodeURI(srcDoc.name.replace(/\.[^\.]+$/, ""));
    var exportFolder = srcDoc.path ? new Folder(srcDoc.path) : Folder.selectDialog("Select a folder for the icon exports");
    if (!exportFolder) {
        return;
    }

    var sizes = [16, 32, 48, 256];
    var originalRulerUnits = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;
    var srcWidthPx = Math.round(srcDoc.width.as("px"));
    var srcHeightPx = Math.round(srcDoc.height.as("px"));

    try {
        for (var i = 0; i < sizes.length; i++) {
            var size = sizes[i];
            var iconDoc = srcDoc.duplicate(baseName + "_" + size, true);

            if (iconDoc.mode !== DocumentMode.RGB) {
                iconDoc.changeMode(ChangeMode.RGB);
            }

            iconDoc.resizeImage(UnitValue(size, "px"), UnitValue(size, "px"), srcDoc.resolution, ResampleMethod.BICUBICSHARPER);

            if (srcWidthPx > size || srcHeightPx > size) {
                var indexedOpts = new IndexedConversionOptions();
                indexedOpts.palette = PaletteType.LOCALADAPTIVE;
                indexedOpts.colors = 8;
                indexedOpts.dither = Dither.DIFFUSION;
                indexedOpts.ditherAmount = 100;
                indexedOpts.matte = MatteType.NONE;
                indexedOpts.forced = ForcedColors.NONE;

                iconDoc.changeMode(ChangeMode.INDEXEDCOLOR, indexedOpts);
                iconDoc.changeMode(ChangeMode.RGB);
            }

            var outFile = new File(exportFolder.fsName + "/" + baseName + "_" + size + ".ico");
            if (outFile.exists) {
                outFile.remove();
            }

            var icoOptions = new ICOFormatOptions();
            iconDoc.saveAs(outFile, icoOptions, true, Extension.LOWERCASE);

            iconDoc.close(SaveOptions.DONOTSAVECHANGES);
        }
    } catch (err) {
        alert("ICO export failed:\n" + err);
    } finally {
        app.preferences.rulerUnits = originalRulerUnits;
        app.activeDocument = srcDoc;
    }
})();
