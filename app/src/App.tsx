import { useCallback, useMemo, useState } from 'react'
import { PhyllotaxisPreview } from './components/PhyllotaxisPreview'
import type { PhyllotaxisPreviewHandle } from './components/PhyllotaxisPreview'
import type {
  AlignmentMarkSettings,
  PrintOptions,
  TemplateRenderOptions,
} from './utils/printing'
import { BOARD_HEIGHT_IN, BOARD_WIDTH_IN } from './utils/phyllotaxis'
import './index.css'

const PREVIEW_DPI = 96

const ANGLE_OPTIONS = [
  { id: 'golden', label: 'Golden Angle (137.508°)', value: 137.50776405003785 },
  { id: 'silver', label: 'Silver Angle (153.435°)', value: 153.434948822922 },
  { id: 'bronze', label: 'Bronze Angle (140.116°)', value: 140.116 },
  { id: 'custom', label: 'Custom Angle', value: 137.5 },
] as const

type AngleOptionId = (typeof ANGLE_OPTIONS)[number]['id']

function formatInches(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—'
  return `${value.toFixed(3)}"`
}

function clampPositive(value: number, fallback: number): number {
  if (Number.isFinite(value) && value > 0) return value
  return fallback
}

function App() {
  const [holeDiameter, setHoleDiameter] = useState(0.25)
  const [spacing, setSpacing] = useState(1)
  const [holeCount, setHoleCount] = useState(1500)
  const [angleOption, setAngleOption] = useState<AngleOptionId>('golden')
  const [customAngle, setCustomAngle] = useState(137.5)
  const [printMargin, setPrintMargin] = useState(0.25)
  const [overlayEnabled, setOverlayEnabled] = useState(false)
  const [overlayOverlap, setOverlayOverlap] = useState(0.5)
  const [alignmentInterval, setAlignmentInterval] = useState(4)
  const [alignmentLength, setAlignmentLength] = useState(0.3)
  const [alignmentInset, setAlignmentInset] = useState(0.1)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [summary, setSummary] = useState({
    actualHoles: 0,
    attempts: 0,
    spacing: {
      minCenter: null as number | null,
      minEdge: null as number | null,
      averageEdge: null as number | null,
    },
  })

  const angleDeg = useMemo(() => {
    if (angleOption === 'custom') {
      return clampPositive(customAngle, 137.5)
    }
    const option = ANGLE_OPTIONS.find((item) => item.id === angleOption)
    return option?.value ?? 137.50776405003785
  }, [angleOption, customAngle])

  const alignmentSettings = useMemo<AlignmentMarkSettings>(
    () => ({
      intervalIn: Math.max(alignmentInterval, 0.5),
      lengthIn: Math.max(alignmentLength, 0.05),
      insetIn: Math.max(alignmentInset, 0),
    }),
    [alignmentInterval, alignmentLength, alignmentInset],
  )

  const renderOptions = useMemo<TemplateRenderOptions>(
    () => ({ alignment: alignmentSettings }),
    [alignmentSettings],
  )

  const printOptions = useMemo<PrintOptions>(
    () => ({
      mode: overlayEnabled ? 'overlay' : 'standard',
      marginIn: Math.max(printMargin, 0),
      overlapIn: overlayEnabled ? Math.max(overlayOverlap, 0) : 0,
      alignment: alignmentSettings,
    }),
    [alignmentSettings, overlayEnabled, overlayOverlap, printMargin],
  )

  const [previewHandle, setPreviewHandle] = useState<PhyllotaxisPreviewHandle | null>(null)

  const handleExport = useCallback(async () => {
    if (!previewHandle) return
    try {
      setErrorMessage(null)
      setStatusMessage('Preparing PNG export…')
      await previewHandle.exportAsImage()
      setStatusMessage('PNG exported. Check your downloads folder.')
    } catch (error) {
      console.error(error)
      setStatusMessage(null)
      setErrorMessage((error as Error).message)
    }
  }, [previewHandle])

  const handlePrint = useCallback(async () => {
    if (!previewHandle) return
    try {
      setErrorMessage(null)
      setStatusMessage('Sending template to printer…')
      await previewHandle.printTemplate()
      setStatusMessage('Print job prepared. Use your printer dialog to finish printing.')
    } catch (error) {
      console.error(error)
      setStatusMessage(null)
      setErrorMessage((error as Error).message)
    }
  }, [previewHandle])

  return (
    <div className="layout">
      <header className="layout__header">
        <h1>Phyllotaxis Drill Template</h1>
        <p>
          Configure a {BOARD_WIDTH_IN}" × {BOARD_HEIGHT_IN}" board. All dimensions are handled in
          inches.
        </p>
      </header>
      <main className="layout__main">
        <section className="panel panel--controls">
          <h2>Pattern Controls</h2>
          <div className="control">
            <label htmlFor="holeDiameter">Hole diameter</label>
            <div className="control__input">
              <input
                id="holeDiameter"
                type="number"
                min="0.01"
                step="0.01"
                value={holeDiameter}
                onChange={(event) => setHoleDiameter(clampPositive(Number(event.target.value), 0.25))}
              />
              <span className="unit">in</span>
            </div>
          </div>

          <div className="control">
            <label htmlFor="spacing">Edge-to-edge spacing</label>
            <div className="control__input">
              <input
                id="spacing"
                type="number"
                min="0"
                step="0.01"
                value={spacing}
                onChange={(event) => setSpacing(Math.max(Number(event.target.value), 0))}
              />
              <span className="unit">in</span>
            </div>
            <p className="control__help">
              Sets the distance between the outer edges of adjacent holes. Center spacing is always
              diameter + spacing.
            </p>
          </div>

          <div className="control">
            <label htmlFor="holeCount">Total holes to keep</label>
            <div className="control__input">
              <input
                id="holeCount"
                type="number"
                min="1"
                step="1"
                value={holeCount}
                onChange={(event) => setHoleCount(Math.max(Number(event.target.value), 1))}
              />
            </div>
          </div>

          <div className="control">
            <label htmlFor="angle">Angle ratio</label>
            <select
              id="angle"
              value={angleOption}
              onChange={(event) => setAngleOption(event.target.value as AngleOptionId)}
            >
              {ANGLE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {angleOption === 'custom' && (
              <div className="control__input control__input--stacked">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={customAngle}
                  onChange={(event) => setCustomAngle(Number(event.target.value))}
                />
                <span className="unit">degrees</span>
              </div>
            )}
          </div>

          <h3>Print &amp; Export</h3>
          <div className="control">
            <label htmlFor="printMargin">Printable margin per side</label>
            <div className="control__input">
              <input
                id="printMargin"
                type="number"
                min="0"
                step="0.01"
                value={printMargin}
                onChange={(event) => setPrintMargin(Math.max(Number(event.target.value), 0))}
              />
              <span className="unit">in</span>
            </div>
            <p className="control__help">
              Reserving a margin helps avoid printer clipping while keeping scale accurate.
            </p>
          </div>

          <div className="control control--checkbox">
            <label htmlFor="overlayEnabled">
              <input
                id="overlayEnabled"
                type="checkbox"
                checked={overlayEnabled}
                onChange={(event) => setOverlayEnabled(event.target.checked)}
              />
              <span>Enable overlay tiling</span>
            </label>
            <p className="control__help">
              Adds overlap between sheets so they can be layered without gaps. Disable to use edge
              to edge tiling.
            </p>
          </div>

          {overlayEnabled && (
            <div className="control">
              <label htmlFor="overlayOverlap">Overlay amount</label>
              <div className="control__input">
                <input
                  id="overlayOverlap"
                  type="number"
                  min="0"
                  step="0.01"
                  value={overlayOverlap}
                  onChange={(event) => setOverlayOverlap(Math.max(Number(event.target.value), 0))}
                />
                <span className="unit">in</span>
              </div>
              <p className="control__help">
                Determines how far each sheet should overlap its neighbors on every side.
              </p>
            </div>
          )}

          <h3>Alignment marks</h3>
          <div className="control">
            <label htmlFor="alignmentInterval">Mark spacing</label>
            <div className="control__input">
              <input
                id="alignmentInterval"
                type="number"
                min="0.5"
                step="0.1"
                value={alignmentInterval}
                onChange={(event) => setAlignmentInterval(Math.max(Number(event.target.value), 0.5))}
              />
              <span className="unit">in</span>
            </div>
            <p className="control__help">Distance between tick marks around the board perimeter.</p>
          </div>

          <div className="control">
            <label htmlFor="alignmentLength">Mark length</label>
            <div className="control__input">
              <input
                id="alignmentLength"
                type="number"
                min="0.05"
                step="0.01"
                value={alignmentLength}
                onChange={(event) => setAlignmentLength(Math.max(Number(event.target.value), 0.05))}
              />
              <span className="unit">in</span>
            </div>
          </div>

          <div className="control">
            <label htmlFor="alignmentInset">Mark inset</label>
            <div className="control__input">
              <input
                id="alignmentInset"
                type="number"
                min="0"
                step="0.01"
                value={alignmentInset}
                onChange={(event) => setAlignmentInset(Math.max(Number(event.target.value), 0))}
              />
              <span className="unit">in</span>
            </div>
            <p className="control__help">
              Controls how far each mark sits inside the board outline.
            </p>
          </div>

          <div className="actions">
            <button type="button" onClick={handleExport}>
              Export PNG
            </button>
            <button type="button" onClick={handlePrint}>
              Print template
            </button>
          </div>

          {(statusMessage || errorMessage) && (
            <div className="status" data-type={errorMessage ? 'error' : 'info'}>
              {errorMessage ?? statusMessage}
            </div>
          )}
        </section>

        <section className="panel panel--preview">
          <div className="panel__header">
            <h2>Preview</h2>
            <div className="metrics">
              <div>
                <span className="metrics__label">Holes rendered</span>
                <span className="metrics__value">{summary.actualHoles}</span>
              </div>
              <div>
                <span className="metrics__label">Attempts (including clipped)</span>
                <span className="metrics__value">{summary.attempts}</span>
              </div>
              <div>
                <span className="metrics__label">Min edge spacing</span>
                <span className="metrics__value">{formatInches(summary.spacing.minEdge)}</span>
              </div>
              <div>
                <span className="metrics__label">Average edge spacing</span>
                <span className="metrics__value">{formatInches(summary.spacing.averageEdge)}</span>
              </div>
            </div>
          </div>
          <PhyllotaxisPreview
            holeDiameter={holeDiameter}
            spacing={spacing}
            holeCount={holeCount}
            angleDeg={angleDeg}
            renderOptions={renderOptions}
            printOptions={printOptions}
            onHoleSummary={(details) => setSummary(details)}
            ref={setPreviewHandle}
          />
          <div className="notes">
            <p>
              The preview uses a {PREVIEW_DPI} DPI canvas and automatically omits holes that would
              fall outside the 48" × 24" work area.
            </p>
            <p>
              Printing will detect printer dimensions when available via Chrome printing APIs and
              otherwise tile the template on standard letter paper.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
