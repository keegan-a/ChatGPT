import { useEffect, useRef } from "react";
import { BOARD_DIMENSIONS, DPI, PhyllotaxisPoint } from "../utils/phyllotaxis";

export interface PhyllotaxisPreviewProps {
  id?: string;
  diameter: number;
  edgeSpacing: number;
  holeCount: number;
  ratio: number | "golden" | "fibonacci";
  points: PhyllotaxisPoint[];
}

export function PhyllotaxisPreview({
  id,
  diameter,
  edgeSpacing,
  holeCount,
  ratio,
  points
}: PhyllotaxisPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = BOARD_DIMENSIONS.width * DPI;
    const height = BOARD_DIMENSIONS.height * DPI;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);

    ctx.fillStyle = "#38bdf8";

    const radius = (diameter / 2) * DPI;

    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
    ctx.font = `${14}px Inter, system-ui, sans-serif`;
    ctx.fillText(
      `${holeCount} holes · ${diameter.toFixed(3)}" dia · ${edgeSpacing.toFixed(2)}" edge · ratio ${formatRatioLabel(ratio)}`,
      16,
      height - 24
    );
  }, [diameter, edgeSpacing, holeCount, points, ratio]);

  return (
    <canvas
      id={id}
      ref={canvasRef}
      width={BOARD_DIMENSIONS.width * DPI}
      height={BOARD_DIMENSIONS.height * DPI}
      className="phyllotaxis-preview"
      aria-label="Phyllotaxis board preview"
    />
  );
}

function formatRatioLabel(ratio: PhyllotaxisPreviewProps["ratio"]) {
  if (ratio === "golden") return "137.508°";
  if (ratio === "fibonacci") return "222.492°";
  return `${Number(ratio).toFixed(2)}°`;
}
