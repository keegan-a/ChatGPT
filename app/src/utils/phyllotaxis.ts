export const DPI = 96;
export const BOARD_DIMENSIONS = { width: 48, height: 24 } as const;

export type RatioType = "golden" | "fibonacci" | "custom";

export interface PhyllotaxisPoint {
  index: number;
  x: number;
  y: number;
  clipped: boolean;
}

export interface ComputePhyllotaxisOptions {
  diameter: number;
  edgeSpacing: number;
  holeCount: number;
  ratio: number | Exclude<RatioType, "custom">;
}

const GOLDEN_ANGLE = 137.50776405003785;
const FIBONACCI_CONJUGATE = 360 - GOLDEN_ANGLE;

export function resolveRatio(ratio: ComputePhyllotaxisOptions["ratio"]): number {
  if (ratio === "golden") return GOLDEN_ANGLE;
  if (ratio === "fibonacci") return FIBONACCI_CONJUGATE;
  return ratio;
}

export function convertInchesToPixels(value: number, dpi = DPI): number {
  return value * dpi;
}

export function computePhyllotaxisPoints({
  diameter,
  edgeSpacing,
  holeCount,
  ratio
}: ComputePhyllotaxisOptions): PhyllotaxisPoint[] {
  const angle = (resolveRatio(ratio) * Math.PI) / 180;
  const centerX = convertInchesToPixels(BOARD_DIMENSIONS.width / 2);
  const centerY = convertInchesToPixels(BOARD_DIMENSIONS.height / 2);
  const radiusLimit = Math.min(BOARD_DIMENSIONS.width, BOARD_DIMENSIONS.height) / 2;
  const maxRadius = convertInchesToPixels(radiusLimit - edgeSpacing - diameter / 2);

  const step = maxRadius / Math.sqrt(holeCount);
  const edgeLimit = {
    left: convertInchesToPixels(edgeSpacing + diameter / 2),
    top: convertInchesToPixels(edgeSpacing + diameter / 2),
    right: convertInchesToPixels(BOARD_DIMENSIONS.width - edgeSpacing - diameter / 2),
    bottom: convertInchesToPixels(BOARD_DIMENSIONS.height - edgeSpacing - diameter / 2)
  } as const;

  const points: PhyllotaxisPoint[] = [];
  let i = 0;

  while (points.length < holeCount && i < holeCount * 5) {
    const currentRadius = step * Math.sqrt(i);
    const x = centerX + currentRadius * Math.cos(angle * i);
    const y = centerY + currentRadius * Math.sin(angle * i);
    const withinBounds =
      x >= edgeLimit.left &&
      x <= edgeLimit.right &&
      y >= edgeLimit.top &&
      y <= edgeLimit.bottom;

    points.push({
      index: i,
      x,
      y,
      clipped: !withinBounds
    });

    i += 1;
  }

  return points.filter((point) => !point.clipped).slice(0, holeCount);
}
