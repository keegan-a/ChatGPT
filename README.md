# Laser Vertex Lab

A refreshed oscilloscope-inspired visualizer that treats your audio like a laser playground. Upload a track, pick a reactive style, and watch multi-dimensional meshes, neon palettes, and layered oscillators dance in time.

## Running locally
Open `index.html` in any modern browser. No build steps required.

## Controls at a glance
### Audio & sensitivity
- **Audio file**: Upload an audio clip to drive everything.
- **Play / Pause**: Toggle playback.
- **Gain**: Boost analyser energy for harder hits.
- **Sensitivity**: Raises or lowers the beat gate; higher values lock onto transients faster.

### Geometry
- **Dimension (1–5)**: Stack laser projections up to 5D (4D/5D shrink to half/quarter scale for nested echoes).
- **Vertices**: Number of points in the mesh (all vertices connect to each other).
- **Scale**: Resize the projection to keep it on-screen.
- **Spread**: Push depth apart for more parallax.
- **Offset X / Offset Y**: Move the projection anywhere in the viewport (±900px).

### Reactivity
- **Reactive mode**: Choose how motion responds to audio: *Pulse*, *Zig-zag*, *Orbit*, or *Swarm*.
- **Color rate**: Scales how fast hues rotate, with audio energy pushing them faster.
- **Color program**: Choose lighting programs (Rainbow trail, Dotted beam, Striped lines, Retro 90s, Retro 2000s) for RGBW-style motion patterns.
- **Trace trail**: Controls persistence; higher values leave longer ghost trails.
- **Bloom**: Adds weight to line thickness and glow.
- **Hue drift**: Shifts palette hues over time.
- **Palette**: Swap between Aurora, Neon, Sunset, or Monochrome color sets.

### Oscillators & trace
- **Voices**: Number of LFO voices used to wobble geometry.
- **Rate / Depth**: Speed and amount of oscillator modulation.
- **Phase spread**: Fans oscillator phases for stereo-like motion.
- **Timebase**: Speeds up rotation and oscillator timing (oscilloscope-style).
- **Trace gain**: How bright the captured waveform trace appears on the display.

## What changed
- Rebuilt analyser sampling with RMS gain and bass-aware beat gating so audio hits visibly drive motion.
- Added color rate/program controls with RGBW trails (rainbows, dots, stripes, retro palettes) tied to beat and energy for vivid lighting programs.
- Tuned reactive offsets and oscillation depth to give clearer audio-driven displacement while keeping the UI grouped into oscilloscope-like sections.

## Contributing
See `AGENTS.md` for the multi-agent workflow (scope → architecture → tests → implementation → debug → review → docs). Each role has clear responsibilities; follow the sequence to keep changes organized and well-reviewed.
