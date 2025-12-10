# Laser Vertex Lab

An oscilloscope-inspired canvas visualizer that draws multi-dimensional "laser vertices" responding to an uploaded audio signal. Controls let you sculpt color, distortion, feedback, and dimension from 1D through a duplicated & miniaturized 5D projection.

## Running locally
Open `index.html` in any modern browser. No build step is required.

## Controls
- **Audio file**: Upload an audio clip to drive the visualizer; press **Play** to start.
- **Dimension (1-5D)**: Choose how many dimensional layers to stack. 4D and 5D duplicate the 3D form at 50% and 25% scale for nested projections.
- **Vertices**: Number of points used to form the laser mesh. Every vertex connects to every other.
- **Color**: Pick the laser hue.
- **Display scale**: Shrink or enlarge the projected form to keep it comfortably on screen.
- **Offset X / Offset Y**: Reposition the projection without changing scale to keep it in frame.
- **Color pulse**: Adds audio-reactive hue shifts for shimmering lasers.
- **Background glow**: Higher values increase afterglow for trailing feedback.
- **Distortion / Feedback distortion**: Adds jitter and drift to the geometry.
- **Audio reactiveness / Amplitude spread**: Blend in audio energy to expand the shapes.
- **Audio boost**: Multiply the analyser response so the visuals move dramatically with the track.
- **Reactive style**: Choose how the visuals respond (fluid, beat-pulsing, zig-zag wobble, or strobe).
- **Beat sensitivity**: Tune how easily the detector latches onto peaks to drive pulsing.
- **Waveform mix**: Blend a real-time oscilloscope trace into the scene.
- **Rotation speed**: Adjust the rotation of the projected forms.
- **Laser thickness**: Control line width and point size.
- **Feedback frames**: Generates mirror-like echo frames for infinite tunnel effects.
- **Laser bloom**: Increase glow intensity for brighter beams.
- **Shape overlay / Overlay size**: Add simple shapes (circle, polygon, Lissajous, spiral) that sit on top of the vertices with adjustable scale.
- **Oscillator rate / depth**: Animate overlay shapes with LFO-style movement and tie them to the incoming audio.
- **Osc voices / Phase spread**: Layer multiple oscillators and fan their phases for richer motion.
- **Timebase / Trace brightness**: Control oscilloscope trace speed and brightness for the signal display.
- **Reset wave**: Re-randomizes jitter for a fresh pattern.

## Notes
- Audio playback can be paused/resumed from the play control after it starts.
- The canvas scales to device pixel ratio for crisp lines; resizing the window will update resolution automatically.
