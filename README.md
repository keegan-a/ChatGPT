# Phyllotaxis Panel Planner

This repository contains a Vite + React + TypeScript application that renders phyllotaxis-based drilling templates for 48" × 24" acoustic or lighting panels. The tool offers immediate feedback as you tweak layout parameters, export-ready previews, and helper utilities for printing or tiling the design.

## Getting started

```bash
cd app
npm install
npm run dev
```

Visit `http://localhost:5173` and start adjusting the panel parameters.

### Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server with hot module replacement. |
| `npm run build` | Type-check and build the production bundle. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint against the TypeScript/React source. |
| `npm run test` | Execute unit tests with Vitest. |

## Features

- **Phyllotaxis renderer** – Computes hole locations using the golden angle, Fibonacci conjugate, or a custom ratio. The renderer respects edge spacing, hole diameter, and board bounds, clipping anything beyond the 48" × 24" work area.
- **Interactive controls** – Update hole count, edge spacing, ratios, and hole diameter with instant canvas feedback.
- **PNG export** – Capture the current layout as a PNG directly from the browser.
- **Print tiling helper** – Determine pagination for standard printers or external bridge integrations and display alignment mark placements.

## Printer connectivity & tiling

Browsers do not expose printer lists directly. The app attempts to detect a global `window.__printerBridge__` integration that must expose a `listPrinters(): Promise<PrinterInfo[]>` method. Without the bridge, the UI falls back to a placeholder "Browser managed printer" entry and uses the standard print dialog when you press **Print layout**.

Each printer entry should provide the printable paper size in inches. The tiling module computes how many sheets are required to cover the full 48" × 24" panel and adds four corner alignment marks per page with a minimum inset of 0.25" or half of the configured hole diameter.

### Desktop bridge example

If you plan to print directly to a networked device, expose the following global API before the React app mounts:

```js
window.__printerBridge__ = {
  async listPrinters() {
    return [
      {
        id: "canon-pro-6100",
        name: "Canon PRO-6100",
        paper: { width: 24, height: 36 },
        printableArea: { width: 23.5, height: 35.5 }
      }
    ];
  }
};
```

The planner will automatically paginate the layout and update the alignment marks per page.

## Testing

Unit tests cover the phyllotaxis placement logic. Run them with:

```bash
cd app
npm test
```

CI (GitHub Actions) installs dependencies, lints, builds, and runs tests to ensure the app remains healthy.
