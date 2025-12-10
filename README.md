# Laser Vertex Lab

An oscilloscope-inspired canvas visualizer that draws multi-dimensional "laser vertices" responding to an uploaded audio signal. Controls let you sculpt color, distortion, feedback, and dimension from 1D through a duplicated & miniaturized 5D projection.

## Running locally
Open `index.html` in any modern browser. No build step is required.

## Controls
- **Audio file**: Upload an audio clip to drive the visualizer; press **Play** to start.
- **Dimension (1-5D)**: Choose how many dimensional layers to stack. 4D and 5D duplicate the 3D form at 50% and 25% scale for nested projections.
- **Vertices**: Number of points used to form the laser mesh. Every vertex connects to every other.
- **Color**: Pick the laser hue.
- **Background glow**: Higher values increase afterglow for trailing feedback.
- **Distortion / Feedback distortion**: Adds jitter and drift to the geometry.
- **Audio reactiveness / Amplitude spread**: Blend in audio energy to expand the shapes.
- **Rotation speed**: Adjust the rotation of the projected forms.
- **Laser thickness**: Control line width and point size.
- **Reset wave**: Re-randomizes jitter for a fresh pattern.

## Notes
- Audio playback can be paused/resumed from the play control after it starts.
- The canvas scales to device pixel ratio for crisp lines; resizing the window will update resolution automatically.
