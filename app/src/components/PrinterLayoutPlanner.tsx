import { useEffect, useMemo, useState } from "react";
import {
  BOARD_DIMENSIONS,
  DPI,
  PhyllotaxisPoint,
  convertInchesToPixels
} from "../utils/phyllotaxis";
import { PrinterInfo, createLayoutPlan, discoverPrinters } from "../utils/printLayout";

interface PrinterLayoutPlannerProps {
  points: PhyllotaxisPoint[];
  diameter: number;
}

export function PrinterLayoutPlanner({ points, diameter }: PrinterLayoutPlannerProps) {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    discoverPrinters()
      .then((list) => {
        setPrinters(list);
        setSelectedPrinterId((prev) => prev ?? list[0]?.id ?? null);
      })
      .catch((err) => setError(err.message));
  }, []);

  const plan = useMemo(() => {
    if (!printers.length) return null;

    const printer = printers.find((candidate) => candidate.id === selectedPrinterId);
    if (!printer) return null;

    return createLayoutPlan({
      printer,
      boardSize: BOARD_DIMENSIONS,
      holeDiameter: diameter,
      points
    });
  }, [diameter, points, printers, selectedPrinterId]);

  return (
    <section className="planner" aria-label="print planner">
      <h2>Print &amp; Tile</h2>
      <p>
        Connect to a compatible printer bridge to access device lists automatically. When
        unavailable, the default browser dialog will open when you press print.
      </p>
      {error ? <p className="planner__error">{error}</p> : null}
      <div className="planner__grid">
        <label>
          <span>Printer</span>
          <select
            value={selectedPrinterId ?? ""}
            onChange={(event) => setSelectedPrinterId(event.target.value || null)}
          >
            {printers.length === 0 ? <option value="">Browser print dialog</option> : null}
            {printers.map((printer) => (
              <option key={printer.id} value={printer.id}>
                {printer.name} ({printer.paper.width}" × {printer.paper.height}")
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => window.print()}>
          Print layout
        </button>
      </div>
      {plan ? (
        <div className="planner__plan">
          <h3>Pagination preview</h3>
          <ul>
            {plan.pages.map((page) => (
              <li key={page.index}>
                Page {page.index + 1} &mdash; offset {page.offsetX.toFixed(2)}" ×
                {page.offsetY.toFixed(2)}" with {page.marks.length} alignment marks
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="planner__hint">
          Provide a printer to calculate automatic tiling. The board measures
          {` ${BOARD_DIMENSIONS.width}" × ${BOARD_DIMENSIONS.height}"`} which renders as
          {` ${convertInchesToPixels(BOARD_DIMENSIONS.width, DPI)} × ${convertInchesToPixels(BOARD_DIMENSIONS.height, DPI)} px`}.
        </p>
      )}
    </section>
  );
}
