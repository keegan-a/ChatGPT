import { BOARD_HEIGHT_IN, BOARD_WIDTH_IN } from './phyllotaxis'
import type { Hole } from './phyllotaxis'

const EXPORT_DPI = 300

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
  stroke = true,
) {
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
    if (stroke) {
      ctx.stroke()
    }
  })

  // alignment marks on the border of the template
  const markLength = dpi * 0.3
  const offset = dpi * 0.1
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
  for (let x = offset; x <= widthPx - offset; x += dpi * 4) {
    drawMark(x, offset, true)
    drawMark(x, heightPx - offset, true)
  }

  // left and right marks
  for (let y = offset; y <= heightPx - offset; y += dpi * 4) {
    drawMark(offset, y, false)
    drawMark(widthPx - offset, y, false)
  }
}

function createTileImages(
  canvas: HTMLCanvasElement,
  pageSize: PageSize,
  dpi: number,
): string[] {
  const tileWidthPx = Math.round(pageSize.widthIn * dpi)
  const tileHeightPx = Math.round(pageSize.heightIn * dpi)
  const tiles: string[] = []

  for (let y = 0; y < canvas.height; y += tileHeightPx) {
    for (let x = 0; x < canvas.width; x += tileWidthPx) {
      const tileCanvas = document.createElement('canvas')
      tileCanvas.width = tileWidthPx
      tileCanvas.height = tileHeightPx
      const ctx = tileCanvas.getContext('2d')
      if (!ctx) continue
      ctx.drawImage(
        canvas,
        x,
        y,
        tileWidthPx,
        tileHeightPx,
        0,
        0,
        tileWidthPx,
        tileHeightPx,
      )
      tiles.push(tileCanvas.toDataURL('image/png'))
    }
  }

  return tiles
}

export async function exportTemplateImage(holes: Hole[]): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(BOARD_WIDTH_IN * EXPORT_DPI)
  canvas.height = Math.round(BOARD_HEIGHT_IN * EXPORT_DPI)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create export context')
  drawToContext(ctx, holes, EXPORT_DPI)
  return canvas.toDataURL('image/png')
}

export async function printTemplate(holes: Hole[]): Promise<void> {
  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = Math.round(BOARD_WIDTH_IN * EXPORT_DPI)
  exportCanvas.height = Math.round(BOARD_HEIGHT_IN * EXPORT_DPI)
  const ctx = exportCanvas.getContext('2d')
  if (!ctx) throw new Error('Unable to prepare print canvas')
  drawToContext(ctx, holes, EXPORT_DPI)

  const page = await detectPrinterPageSize()
  const tileImages = createTileImages(exportCanvas, page, EXPORT_DPI)

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

  tileImages.forEach((dataUrl, index) => {
    const container = doc.createElement('div')
    container.className = 'page'

    const label = doc.createElement('div')
    label.textContent = `Page ${index + 1} of ${tileImages.length}`
    label.style.position = 'absolute'
    label.style.top = '0.2in'
    label.style.left = '0.3in'
    label.style.fontFamily = 'sans-serif'
    label.style.fontSize = '10pt'
    label.style.color = '#1f2937'

    const image = doc.createElement('img')
    image.src = dataUrl
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
