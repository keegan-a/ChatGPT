import { BOARD_DIMENSIONS } from "./phyllotaxis";

export interface PrinterInfo {
  id: string;
  name: string;
  paper: {
    width: number;
    height: number;
  };
  printableArea?: {
    width: number;
    height: number;
  };
}

export interface LayoutMark {
  x: number;
  y: number;
}

export interface LayoutPage {
  index: number;
  offsetX: number;
  offsetY: number;
  marks: LayoutMark[];
}

export interface PrinterLayoutPlan {
  board: typeof BOARD_DIMENSIONS;
  pages: LayoutPage[];
  paper: PrinterInfo["paper"];
}

interface LayoutPlanOptions {
  printer: PrinterInfo;
  boardSize: typeof BOARD_DIMENSIONS;
  points: { x: number; y: number }[];
  holeDiameter: number;
}

type PrinterBridge = {
  listPrinters: () => Promise<PrinterInfo[]>;
};

declare global {
  interface Window {
    __printerBridge__?: PrinterBridge;
  }
}

const DEFAULT_PAPER = { width: 8.5, height: 11 } as const;

export async function discoverPrinters(): Promise<PrinterInfo[]> {
  if (typeof window === "undefined") return [];

  if (window.__printerBridge__?.listPrinters) {
    return window.__printerBridge__.listPrinters();
  }

  // Browser print dialogs do not expose printer lists; fall back to placeholder entry.
  return [
    {
      id: "browser",
      name: "Browser managed printer",
      paper: DEFAULT_PAPER
    }
  ];
}

export function createLayoutPlan({
  printer,
  boardSize,
  points: _points,
  holeDiameter
}: LayoutPlanOptions): PrinterLayoutPlan {
  const paper = printer.paper ?? DEFAULT_PAPER;
  const printableWidth = printer.printableArea?.width ?? paper.width;
  const printableHeight = printer.printableArea?.height ?? paper.height;

  const cols = Math.ceil(boardSize.width / printableWidth);
  const rows = Math.ceil(boardSize.height / printableHeight);

  const pages: LayoutPage[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      const offsetX = col * printableWidth;
      const offsetY = row * printableHeight;
      const marks = createAlignmentMarks(
        offsetX,
        offsetY,
        printableWidth,
        printableHeight,
        holeDiameter
      );

      pages.push({ index, offsetX, offsetY, marks });
    }
  }

  return { board: boardSize, pages, paper };
}

function createAlignmentMarks(
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  holeDiameter: number
): LayoutMark[] {
  const marks: LayoutMark[] = [];
  const inset = Math.max(0.25, holeDiameter / 2);

  marks.push({ x: offsetX + inset, y: offsetY + inset });
  marks.push({ x: offsetX + width - inset, y: offsetY + inset });
  marks.push({ x: offsetX + inset, y: offsetY + height - inset });
  marks.push({ x: offsetX + width - inset, y: offsetY + height - inset });

  return marks;
}
