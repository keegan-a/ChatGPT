import { describe, expect, it } from "vitest";
import {
  BOARD_DIMENSIONS,
  computePhyllotaxisPoints,
  convertInchesToPixels,
  resolveRatio
} from "./phyllotaxis";

describe("phyllotaxis", () => {
  it("resolves named ratios", () => {
    expect(resolveRatio("golden")).toBeCloseTo(137.5078, 3);
    expect(resolveRatio("fibonacci")).toBeCloseTo(222.4922, 3);
  });

  it("generates the requested number of points within the board", () => {
    const result = computePhyllotaxisPoints({
      diameter: 0.5,
      edgeSpacing: 0.75,
      holeCount: 120,
      ratio: "golden"
    });

    expect(result).toHaveLength(120);
    result.forEach((point) => {
      expect(point.x).toBeGreaterThanOrEqual(convertInchesToPixels(0.75));
      expect(point.y).toBeGreaterThanOrEqual(convertInchesToPixels(0.75));
      expect(point.x).toBeLessThanOrEqual(
        convertInchesToPixels(BOARD_DIMENSIONS.width - 0.75)
      );
      expect(point.y).toBeLessThanOrEqual(
        convertInchesToPixels(BOARD_DIMENSIONS.height - 0.75)
      );
    });
  });

  it("supports custom ratios", () => {
    const custom = computePhyllotaxisPoints({
      diameter: 0.5,
      edgeSpacing: 0.5,
      holeCount: 80,
      ratio: 90
    });

    const golden = computePhyllotaxisPoints({
      diameter: 0.5,
      edgeSpacing: 0.5,
      holeCount: 80,
      ratio: "golden"
    });

    expect(custom[10].x).not.toBeCloseTo(golden[10].x);
    expect(custom[10].y).not.toBeCloseTo(golden[10].y);
  });
});
