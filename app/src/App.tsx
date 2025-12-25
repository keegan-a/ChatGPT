import { useMemo, useState } from "react";
import { PhyllotaxisPreview } from "./components/PhyllotaxisPreview";
import { RatioType, computePhyllotaxisPoints } from "./utils/phyllotaxis";
import { exportPreviewAsPng } from "./utils/export";
import { PrinterLayoutPlanner } from "./components/PrinterLayoutPlanner";
import "./styles/app.css";

const DEFAULTS = {
  diameter: 0.5,
  edgeSpacing: 0.75,
  holeCount: 200,
  ratioType: "golden" as RatioType,
  customRatio: 120
};

export default function App() {
  const [diameter, setDiameter] = useState(DEFAULTS.diameter);
  const [edgeSpacing, setEdgeSpacing] = useState(DEFAULTS.edgeSpacing);
  const [holeCount, setHoleCount] = useState(DEFAULTS.holeCount);
  const [ratioType, setRatioType] = useState<RatioType>(DEFAULTS.ratioType);
  const [customRatio, setCustomRatio] = useState(DEFAULTS.customRatio);

  const ratio = ratioType === "custom" ? customRatio : ratioType;

  const points = useMemo(
    () =>
      computePhyllotaxisPoints({
        diameter,
        edgeSpacing,
        holeCount,
        ratio
      }),
    [diameter, edgeSpacing, holeCount, ratio]
  );

  return (
    <div className="app">
      <header className="app__header">
        <h1>Phyllotaxis Panel Planner</h1>
        <p>
          Visualise and export hole layouts for a 48″ × 24″ panel with precise
          edge offsets.
        </p>
      </header>
      <main className="app__content">
        <section className="app__controls" aria-label="layout controls">
          <ControlGroup label="Hole diameter (in)">
            <NumberInput value={diameter} min={0.125} step={0.125} onChange={setDiameter} />
          </ControlGroup>
          <ControlGroup label="Edge spacing (in)">
            <NumberInput value={edgeSpacing} min={0} step={0.125} onChange={setEdgeSpacing} />
          </ControlGroup>
          <ControlGroup label="Hole count">
            <NumberInput value={holeCount} min={1} max={2000} step={1} onChange={setHoleCount} />
          </ControlGroup>
          <ControlGroup label="Phyllotaxis ratio">
            <select
              value={ratioType}
              onChange={(event) => setRatioType(event.target.value as RatioType)}
            >
              <option value="golden">Golden angle (137.508°)</option>
              <option value="fibonacci">Fibonacci conjugate (222.492°)</option>
              <option value="custom">Custom angle</option>
            </select>
          </ControlGroup>
          {ratioType === "custom" ? (
            <ControlGroup label="Custom angle (degrees)">
              <NumberInput
                value={customRatio}
                min={0}
                max={360}
                step={0.1}
                onChange={setCustomRatio}
              />
            </ControlGroup>
          ) : null}
          <button
            type="button"
            className="app__export"
            onClick={() => exportPreviewAsPng("phyllotaxis-canvas")}
          >
            Export PNG
          </button>
        </section>
        <section className="app__preview" aria-label="layout preview">
          <PhyllotaxisPreview
            id="phyllotaxis-canvas"
            diameter={diameter}
            edgeSpacing={edgeSpacing}
            holeCount={holeCount}
            ratio={ratio}
            points={points}
          />
        </section>
      </main>
      <PrinterLayoutPlanner points={points} diameter={diameter} />
    </div>
  );
}

interface ControlGroupProps {
  label: string;
  children: React.ReactNode;
}

function ControlGroup({ label, children }: ControlGroupProps) {
  return (
    <label className="control-group">
      <span>{label}</span>
      {children}
    </label>
  );
}

interface NumberInputProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

function NumberInput({ value, min, max, step = 1, onChange }: NumberInputProps) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
