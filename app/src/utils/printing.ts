import { BOARD_HEIGHT_IN, BOARD_WIDTH_IN } from './phyllotaxis'
import type { Hole } from './phyllotaxis'

const EXPORT_DPI = 300
const MIN_CROSSHAIR_IN = 0.05
const CROSSHAIR_FACTOR = 0.6

export interface AlignmentMarkSettings {
  intervalIn: number
  lengthIn: number
  insetIn: number
}

export interface TemplateRenderOptions {
  alignment: AlignmentMarkSettings
}

export interface PrintOptions extends TemplateRenderOptions {
  mode: 'standard' | 'overlay'
  marginIn: number
  overlapIn: number
}

const DEFAULT_ALIGNMENT: AlignmentMarkSettings = {
  intervalIn: 4,
  lengthIn: 0.3,
  insetIn: 0.1,
}

const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  mode: 'standard',
  marginIn: 0.25,
  overlapIn: 0,
  alignment: DEFAULT_ALIGNMENT,
}

function normalizeAlignment(
  settings?: AlignmentMarkSettings,
): AlignmentMarkSettings {
  const interval = Number.isFinite(settings?.intervalIn)
    ? Math.max(settings!.intervalIn, 0.5)
    : DEFAULT_ALIGNMENT.intervalIn
  const length = Number.isFinite(settings?.lengthIn)
    ? Math.max(settings!.lengthIn, 0.05)
    : DEFAULT_ALIGNMENT.lengthIn
  const inset = Number.isFinite(settings?.insetIn)
    ? Math.max(settings!.insetIn, 0)
    : DEFAULT_ALIGNMENT.insetIn

  return { intervalIn: interval, lengthIn: length, insetIn: inset }
}

function normalizePrintOptions(options?: PrintOptions): PrintOptions {
  if (!options) {
    return { ...DEFAULT_PRINT_OPTIONS, alignment: { ...DEFAULT_ALIGNMENT } }
  }

  const margin = Number.isFinite(options.marginIn) ? Math.max(options.marginIn, 0) : 0
  const overlap = Number.isFinite(options.overlapIn) ? Math.max(options.overlapIn, 0) : 0
  return {
    mode: options.mode === 'overlay' ? 'overlay' : 'standard',
    marginIn: margin,
    overlapIn: options.mode === 'overlay' ? overlap : 0,
    alignment: normalizeAlignment(options.alignment),
  }
}

export interface PageSize {
  widthIn: number
  heightIn: number
}

interface PrinterLike {
  id: string
  isDefault?: boolean
  name?: string
}

interface PrinterCapabilities {
  media_size?: {
    option?: Array<{
      custom_display_name?: string
      name?: string
      width_microns?: number
      height_microns?: number
      is_default?: boolean
    }>
  }
}

async function detectPrinterPageSize(): Promise<PageSize> {
  try {
    const chromeApi = (window as typeof window & {
      chrome?: {
        printing?: {
          getPrinters: (callback: (printers: PrinterLike[]) => void) => void
          getPrinterCapabilities: (
            id: string,
            callback: (capabilities: PrinterCapabilities) => void,
          ) => void
        }
      }
    }).chrome?.printing

    if (chromeApi) {
      const printers = await new Promise<PrinterLike[]>((resolve) => {
        chromeApi.getPrinters(resolve)
      })

      const target = printers.find((printer) => printer.isDefault) ?? printers[0]

      if (target) {
        const capabilities = await new Promise<PrinterCapabilities>((resolve) => {
          chromeApi.getPrinterCapabilities(target.id, resolve)
        })

        const mediaOption =
          capabilities.media_size?.option?.find((option) => option.is_default) ??
          capabilities.media_size?.option?.[0]

        if (mediaOption?.width_microns && mediaOption?.height_microns) {
          const widthIn = mediaOption.width_microns / 25_400
          const heightIn = mediaOption.height_microns / 25_400
          return { widthIn, heightIn }
        }
      }
    }
  } catch (error) {
    console.warn('Printer detection fell back to default size.', error)
  }

  return { widthIn: 8.5, heightIn: 11 }
}

function drawToContext(
  ctx: CanvasRenderingContext2D,
  holes: Hole[],
  dpi: number,
  options?: TemplateRenderOptions,
) {
  const alignment = normalizeAlignment(options?.alignment)
  const widthPx = Math.round(BOARD_WIDTH_IN * dpi)
  const heightPx = Math.round(BOARD_HEIGHT_IN * dpi)

  ctx.clearRect(0, 0, widthPx, heightPx)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, widthPx, heightPx)

  ctx.strokeStyle = '#1f2937'
  ctx.lineWidth = Math.max(1, dpi / 300)

  holes.forEach((hole) => {
    const centerX = hole.x * dpi
    const centerY = hole.y * dpi
    const radius = hole.radius * dpi

    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.stroke()

    const crosshairLengthIn = Math.max(hole.radius * 2 * CROSSHAIR_FACTOR, MIN_CROSSHAIR_IN)
    const crosshairLengthPx = crosshairLengthIn * dpi
    const halfLength = crosshairLengthPx / 2
    const crosshairWidth = Math.max(1, dpi / 600)

    ctx.save()
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = crosshairWidth
    ctx.beginPath()
    ctx.moveTo(centerX - halfLength, centerY)
    ctx.lineTo(centerX + halfLength, centerY)
    ctx.moveTo(centerX, centerY - halfLength)
    ctx.lineTo(centerX, centerY + halfLength)
    ctx.stroke()
    ctx.restore()
  })

  // alignment marks on the border of the template
  const markLength = alignment.lengthIn * dpi
  const offset = alignment.insetIn * dpi
  const interval = alignment.intervalIn * dpi
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = Math.max(1, dpi / 600)

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

  // top and bottom marks
  for (let x = offset; x <= widthPx - offset; x += interval) {
    drawMark(x, offset, true)
    drawMark(x, heightPx - offset, true)
  }

  // left and right marks
  for (let y = offset; y <= heightPx - offset; y += interval) {
    drawMark(offset, y, false)
    drawMark(widthPx - offset, y, false)
  }

  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = Math.max(1, dpi / 200)
  ctx.strokeRect(0, 0, widthPx, heightPx)
}

interface TileImage {
  dataUrl: string
  row: number
  column: number
}

function createTileImages(
  canvas: HTMLCanvasElement,
  pageSize: PageSize,
  dpi: number,
  options: PrintOptions,
): TileImage[] {
  const pageWidthPx = Math.round(pageSize.widthIn * dpi)
  const pageHeightPx = Math.round(pageSize.heightIn * dpi)
  const marginPx = Math.min(Math.round(options.marginIn * dpi), Math.floor(pageWidthPx / 2))
  const marginYPx = Math.min(Math.round(options.marginIn * dpi), Math.floor(pageHeightPx / 2))
  const printableWidthPx = Math.max(pageWidthPx - marginPx * 2, 1)
  const printableHeightPx = Math.max(pageHeightPx - marginYPx * 2, 1)
  const overlapPx = Math.round(options.overlapIn * dpi)
  const stepX = Math.max(options.mode === 'overlay' ? printableWidthPx - overlapPx : printableWidthPx, 1)
  const stepY = Math.max(options.mode === 'overlay' ? printableHeightPx - overlapPx : printableHeightPx, 1)

  const tiles: TileImage[] = []

  let row = 0
  for (let y = 0; y < canvas.height; y += stepY, row += 1) {
    let column = 0
    for (let x = 0; x < canvas.width; x += stepX, column += 1) {
      const tileCanvas = document.createElement('canvas')
      tileCanvas.width = pageWidthPx
      tileCanvas.height = pageHeightPx
      const ctx = tileCanvas.getContext('2d')
      if (!ctx) continue

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, pageWidthPx, pageHeightPx)

      const drawWidth = Math.min(printableWidthPx, canvas.width - x)
      const drawHeight = Math.min(printableHeightPx, canvas.height - y)

      ctx.drawImage(
        canvas,
        x,
        y,
        drawWidth,
        drawHeight,
        marginPx,
        marginYPx,
        drawWidth,
        drawHeight,
      )

      tiles.push({ dataUrl: tileCanvas.toDataURL('image/png'), row, column })
    }
  }

  return tiles
}

export async function exportTemplateImage(
  holes: Hole[],
  options?: TemplateRenderOptions,
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(BOARD_WIDTH_IN * EXPORT_DPI)
  canvas.height = Math.round(BOARD_HEIGHT_IN * EXPORT_DPI)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create export context')
  drawToContext(ctx, holes, EXPORT_DPI, options)
  return canvas.toDataURL('image/png')
}

export async function printTemplate(holes: Hole[], rawOptions?: PrintOptions): Promise<void> {
  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = Math.round(BOARD_WIDTH_IN * EXPORT_DPI)
  exportCanvas.height = Math.round(BOARD_HEIGHT_IN * EXPORT_DPI)
  const ctx = exportCanvas.getContext('2d')
  if (!ctx) throw new Error('Unable to prepare print canvas')
  const options = normalizePrintOptions(rawOptions)
  drawToContext(ctx, holes, EXPORT_DPI, { alignment: options.alignment })

  const page = await detectPrinterPageSize()
  const tileImages = createTileImages(exportCanvas, page, EXPORT_DPI, options)

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('Unable to access print frame document')
  }

  const style = doc.createElement('style')
  style.textContent = `
    @page {
      size: ${page.widthIn}in ${page.heightIn}in;
      margin: 0;
    }
    body {
      margin: 0;
      display: flex;
      flex-wrap: wrap;
    }
    .page {
      width: ${page.widthIn}in;
      height: ${page.heightIn}in;
      page-break-after: always;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img {
      width: ${page.widthIn}in;
      height: ${page.heightIn}in;
      object-fit: contain;
    }
  `
  doc.head.appendChild(style)

  const imagePromises: Promise<void>[] = []

  const maxRow = tileImages.reduce((acc, tile) => Math.max(acc, tile.row), 0)
  const maxColumn = tileImages.reduce((acc, tile) => Math.max(acc, tile.column), 0)

  tileImages.forEach((tile, index) => {
    const container = doc.createElement('div')
    container.className = 'page'

    const label = doc.createElement('div')
    const rowInfo = `Row ${tile.row + 1}/${maxRow + 1}`
    const columnInfo = `Column ${tile.column + 1}/${maxColumn + 1}`
    label.textContent = `Page ${index + 1} of ${tileImages.length} — ${rowInfo}, ${columnInfo}`
    label.style.position = 'absolute'
    label.style.top = '0.2in'
    label.style.left = '0.3in'
    label.style.fontFamily = 'sans-serif'
    label.style.fontSize = '10pt'
    label.style.color = '#1f2937'

    if (options.mode === 'overlay' && options.overlapIn > 0) {
      label.textContent += ` — Overlay ${options.overlapIn.toFixed(2)}"`
    }

    const image = doc.createElement('img')
    image.src = tile.dataUrl
    image.alt = `Template tile ${index + 1}`

    imagePromises.push(
      new Promise<void>((resolve) => {
        image.onload = () => resolve()
        image.onerror = () => resolve()
      }),
    )

    container.style.position = 'relative'
    container.appendChild(image)
    container.appendChild(label)
    doc.body.appendChild(container)
  })

  await Promise.all(imagePromises)

  iframe.contentWindow?.focus()
  iframe.contentWindow?.print()

  setTimeout(() => {
    document.body.removeChild(iframe)
  }, 1000)
}
