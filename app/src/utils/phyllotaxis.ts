export const BOARD_WIDTH_IN = 48
export const BOARD_HEIGHT_IN = 24

export interface PhyllotaxisParams {
  holeCount: number
  holeDiameter: number
  spacing: number
  angleDeg: number
}

export interface Hole {
  x: number
  y: number
  radius: number
}

export interface PhyllotaxisResult {
  holes: Hole[]
  attempts: number
}

const SAFETY_MULTIPLIER = 40

export function generatePhyllotaxis({
  holeCount,
  holeDiameter,
  spacing,
  angleDeg,
}: PhyllotaxisParams): PhyllotaxisResult {
  const desiredCount = Math.max(0, Math.floor(holeCount))
  const radius = Math.max(0, holeDiameter / 2)
  const centerSpacing = Math.max(holeDiameter + spacing, holeDiameter)
  const angleRad = (angleDeg * Math.PI) / 180
  const width = BOARD_WIDTH_IN
  const height = BOARD_HEIGHT_IN
  const marginX = radius
  const marginY = radius

  const holes: Hole[] = []
  let n = 0
  const attemptLimit = Math.max(desiredCount * SAFETY_MULTIPLIER, desiredCount + 1)

  while (holes.length < desiredCount && n < attemptLimit) {
    const r = centerSpacing * Math.sqrt(n + 1)
    const theta = (n + 1) * angleRad
    const centerX = r * Math.cos(theta)
    const centerY = r * Math.sin(theta)

    const x = width / 2 + centerX
    const y = height / 2 + centerY

    if (
      x >= marginX &&
      x <= width - marginX &&
      y >= marginY &&
      y <= height - marginY
    ) {
      holes.push({ x, y, radius })
    }

    n += 1
  }

  return { holes, attempts: n }
}

export interface SpacingStats {
  minCenterDistance: number | null
  minEdgeSpacing: number | null
  averageEdgeSpacing: number | null
}

export function computeSpacingStats(holes: Hole[], holeDiameter: number): SpacingStats {
  if (holes.length < 2) {
    return {
      minCenterDistance: null,
      minEdgeSpacing: null,
      averageEdgeSpacing: null,
    }
  }

  let minCenter: number | null = null
  let totalEdgeSpacing = 0
  let comparisons = 0

  for (let i = 0; i < holes.length; i += 1) {
    const a = holes[i]
    for (let j = i + 1; j < holes.length; j += 1) {
      const b = holes[j]
      const dx = a.x - b.x
      const dy = a.y - b.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (minCenter === null || dist < minCenter) {
        minCenter = dist
      }
      totalEdgeSpacing += Math.max(dist - holeDiameter, 0)
      comparisons += 1
    }
  }

  return {
    minCenterDistance: minCenter,
    minEdgeSpacing: minCenter !== null ? Math.max(minCenter - holeDiameter, 0) : null,
    averageEdgeSpacing:
      comparisons > 0 ? Math.max(totalEdgeSpacing / comparisons, 0) : null,
  }
}
