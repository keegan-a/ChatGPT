# Phyllotaxis Drill Template App

This project provides a browser-based generator for phyllotaxis drilling templates sized for a 48" × 24" sheet of Baltic birch plywood.

## Features

- Real-time preview of holes clipped to the 48" × 24" work area, including crosshair center marks for each hole
- Independent controls for hole diameter, edge-to-edge spacing, total hole count, and divergence angle
- PNG export at 300 DPI with alignment marks that mirror the printer output
- Automated print preparation that tiles the template across detected printer media (with Chrome printing API support) or standard letter pages
- Optional overlay tiling with configurable margins, overlap distance, and alignment mark spacing/length to avoid printer clipping while keeping seams accurate

## Getting Started

```bash
cd app
npm install
npm run dev
```

## Building

```bash
npm run build
```

The production build is output to `app/dist`.
