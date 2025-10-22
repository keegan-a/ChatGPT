import { useCallback, useMemo, useState } from 'react'
import { PhyllotaxisPreview } from './components/PhyllotaxisPreview'
import type { PhyllotaxisPreviewHandle } from './components/PhyllotaxisPreview'
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
