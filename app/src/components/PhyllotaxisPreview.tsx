import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  BOARD_HEIGHT_IN,
  BOARD_WIDTH_IN,
  computeSpacingStats,
  generatePhyllotaxis,
} from '../utils/phyllotaxis'
import type { Hole } from '../utils/phyllotaxis'
import {
  exportTemplateImage,
  printTemplate,
  type PrintOptions,
  type TemplateRenderOptions,
} from '../utils/printing'

const PREVIEW_DPI = 96

export interface PhyllotaxisPreviewProps {
  holeDiameter: number
  spacing: number
  holeCount: number
  angleDeg: number
  renderOptions: TemplateRenderOptions
  printOptions: PrintOptions
  onHoleSummary?: (summary: {
    actualHoles: number
    attempts: number
    spacing: {
      minCenter: number | null
      minEdge: number | null
      averageEdge: number | null
    }
  }) => void
}

export interface PhyllotaxisPreviewHandle {
  exportAsImage: () => Promise<void>
  printTemplate: () => Promise<void>
}

export const PhyllotaxisPreview = forwardRef<PhyllotaxisPreviewHandle, PhyllotaxisPreviewProps>(
  ({ holeDiameter, spacing, holeCount, angleDeg, renderOptions, printOptions, onHoleSummary }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const [holes, setHoles] = useState<Hole[]>([])
    const [drawingError, setDrawingError] = useState<string | null>(null)

    const canvasWidth = Math.round(BOARD_WIDTH_IN * PREVIEW_DPI)
    const canvasHeight = Math.round(BOARD_HEIGHT_IN * PREVIEW_DPI)

    const pattern = useMemo(() => {
      try {
        const result = generatePhyllotaxis({
          holeCount,
          holeDiameter,
          spacing,
          angleDeg,
        })
        return result
      } catch (error) {
        console.error(error)
        return { holes: [], attempts: 0 }
      }
    }, [angleDeg, holeCount, holeDiameter, spacing])

    useEffect(() => {
      setHoles(pattern.holes)
      const stats = computeSpacingStats(pattern.holes, holeDiameter)
      onHoleSummary?.({
        actualHoles: pattern.holes.length,
        attempts: pattern.attempts,
        spacing: {
          minCenter: stats.minCenterDistance,
          minEdge: stats.minEdgeSpacing,
          averageEdge: stats.averageEdgeSpacing,
        },
      })
    }, [pattern, onHoleSummary, holeDiameter])

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      try {
        setDrawingError(null)
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)
        ctx.fillStyle = '#f9fafb'
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)

        holes.forEach((hole) => {
          const centerX = hole.x * PREVIEW_DPI
          const centerY = hole.y * PREVIEW_DPI
          const radius = hole.radius * PREVIEW_DPI

          ctx.strokeStyle = '#111827'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
          ctx.stroke()

          const crosshairLength = Math.max(radius * 1.2, 6)
          const halfLength = crosshairLength / 2
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(centerX - halfLength, centerY)
          ctx.lineTo(centerX + halfLength, centerY)
          ctx.moveTo(centerX, centerY - halfLength)
          ctx.lineTo(centerX, centerY + halfLength)
          ctx.stroke()
        })

        const alignment = renderOptions.alignment
        if (alignment) {
          const markLength = Math.max(alignment.lengthIn * PREVIEW_DPI, 2)
          const offset = Math.max(alignment.insetIn * PREVIEW_DPI, 0)
          const interval = Math.max(alignment.intervalIn * PREVIEW_DPI, 2)
          ctx.strokeStyle = '#3b82f6'
          ctx.lineWidth = 1

          const drawMark = (x: number, y: number, horizontal: boolean) => {
            ctx.beginPath()
            if (horizontal) {
              ctx.moveTo(x - markLength / 2, y)
              ctx.lineTo(x + markLength / 2, y)
            } else {
              ctx.moveTo(x, y - markLength / 2)
              ctx.lineTo(x, y + markLength / 2)
            }
            ctx.stroke()
          }

          for (let x = offset; x <= canvasWidth - offset; x += interval) {
            drawMark(x, offset, true)
            drawMark(x, canvasHeight - offset, true)
          }

          for (let y = offset; y <= canvasHeight - offset; y += interval) {
            drawMark(offset, y, false)
            drawMark(canvasWidth - offset, y, false)
          }
        }

        // outline of the board
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2
        ctx.strokeRect(0, 0, canvasWidth, canvasHeight)
      } catch (error) {
        console.error(error)
        setDrawingError('Unable to render preview')
      }
    }, [canvasWidth, canvasHeight, holes, renderOptions])

    useImperativeHandle(
      ref,
      () => ({
        exportAsImage: async () => {
          if (!holes.length) throw new Error('No holes to export')
          const dataUrl = await exportTemplateImage(holes, renderOptions)
          const link = document.createElement('a')
          link.href = dataUrl
          link.download = `phyllotaxis-template-${Date.now()}.png`
          link.click()
        },
        printTemplate: async () => {
          if (!holes.length) throw new Error('No holes to print')
          await printTemplate(holes, printOptions)
        },
      }),
      [holes, printOptions, renderOptions],
    )

    return (
      <div className="preview">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="preview__canvas"
        />
        {drawingError && <p className="preview__error">{drawingError}</p>}
        {!holes.length && !drawingError && (
          <p className="preview__empty">No holes within the 48" × 24" boundary.</p>
        )}
      </div>
    )
  },
)

PhyllotaxisPreview.displayName = 'PhyllotaxisPreview'
