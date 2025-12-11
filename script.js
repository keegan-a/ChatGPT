const canvas = document.getElementById("display");
const ctx = canvas.getContext("2d");
const audio = document.getElementById("audioPlayer");

const controls = {
  audioInput: document.getElementById("audioInput"),
  playPause: document.getElementById("playPause"),
  gain: document.getElementById("gain"),
  sensitivity: document.getElementById("sensitivity"),
  dimension: document.getElementById("dimension"),
  vertexCount: document.getElementById("vertexCount"),
  scale: document.getElementById("scale"),
  spread: document.getElementById("spread"),
  offsetX: document.getElementById("offsetX"),
  offsetY: document.getElementById("offsetY"),
  reactiveMode: document.getElementById("reactiveMode"),
  colorRate: document.getElementById("colorRate"),
  colorProgram: document.getElementById("colorProgram"),
  trail: document.getElementById("trail"),
  bloom: document.getElementById("bloom"),
  hueDrift: document.getElementById("hueDrift"),
  palette: document.getElementById("palette"),
  oscVoices: document.getElementById("oscVoices"),
  oscRate: document.getElementById("oscRate"),
  oscDepth: document.getElementById("oscDepth"),
  phaseSpread: document.getElementById("phaseSpread"),
  timebase: document.getElementById("timebase"),
  traceGain: document.getElementById("traceGain"),
};

const values = document.querySelectorAll(".value");
values.forEach((val) => {
  const input = document.getElementById(val.dataset.for);
  if (!input) return;
  const update = () => (val.textContent = Number(input.value).toFixed(input.step && Number(input.step) < 1 ? 2 : 0));
  input.addEventListener("input", update);
  update();
});

let audioCtx;
let analyser;
let dataArray;
let timeArray;
let source;
let isPlaying = false;
let objectUrl;

const state = {
  time: 0,
  beatEnergy: 0,
  beat: 0,
  hue: 140,
  rotation: 0,
};

const palettes = {
  aurora: [180, 210, 150],
  neon: [120, 280, 320],
  sunset: [20, 35, 300],
  mono: [140, 140, 140],
  retro90: [290, 320, 170, 45],
  retro2000: [200, 160, 30, 340],
};

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);
}

window.addEventListener("resize", resize);
resize();

function setupAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (!analyser) {
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    timeArray = new Uint8Array(analyser.fftSize);
  }
}

async function loadFile(file) {
  if (!file) return;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;
  audio.load();
  setupAudio();
  if (source) source.disconnect();
  source = audioCtx.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  controls.playPause.textContent = "Play";
  isPlaying = false;
}

controls.audioInput.addEventListener("change", (e) => loadFile(e.target.files[0]));

controls.playPause.addEventListener("click", async () => {
  if (!audio.src) return;
  setupAudio();
  await audioCtx.resume();
  if (audio.paused) {
    audio.play();
    controls.playPause.textContent = "Pause";
    isPlaying = true;
  } else {
    audio.pause();
    controls.playPause.textContent = "Play";
    isPlaying = false;
  }
});

function hueForPalette() {
  const set = palettes[controls.palette.value] || palettes.aurora;
  const rate = Number(controls.colorRate.value);
  const base = set[Math.floor(((state.time * rate) / 2.5) % set.length)];
  const drift = Number(controls.hueDrift.value);
  return (base + state.hue + drift) % 360;
}

function programColor(program, idx, total, hueBase, level, beat) {
  const progress = (idx / total + state.time * 0.25) % 1;
  const glow = 0.5 + level * 0.4 + beat * 0.3;
  const white = 12 + beat * 50 + level * 30;
  const sat = 90;

  switch (program) {
    case "rainbow": {
      const hue = (hueBase + progress * 360 + beat * 30) % 360;
      return `hsla(${hue}, ${sat}%, ${60 + glow * 10}%, ${0.7 + glow * 0.2})`;
    }
    case "dots": {
      const stepHue = (hueBase + idx * 22 + beat * 45) % 360;
      const blink = 0.45 + (Math.sin(state.time * 8 + idx) + 1) * 0.25 + level * 0.4;
      return `hsla(${stepHue}, ${sat}%, ${50 + white}%, ${Math.min(1, blink)})`;
    }
    case "lines": {
      const hue = (hueBase + Math.floor(progress * 8) * 30 + level * 90) % 360;
      return `hsla(${hue}, 85%, ${55 + white * 0.2}%, ${0.6 + glow * 0.3})`;
    }
    case "retro90": {
      const set = palettes.retro90;
      const hue = set[Math.floor(progress * set.length) % set.length];
      return `hsla(${(hue + hueBase * 0.2) % 360}, 88%, ${55 + white * 0.15}%, ${0.65 + glow * 0.25})`;
    }
    case "retro2000": {
      const set = palettes.retro2000;
      const hue = set[Math.floor(progress * set.length) % set.length];
      return `hsla(${(hue + hueBase * 0.15 + beat * 24) % 360}, 94%, ${50 + white * 0.25}%, ${0.7 + glow * 0.25})`;
    }
    default:
      return `hsla(${hueBase}, ${sat}%, ${58 + white * 0.2}%, ${0.7 + glow * 0.2})`;
  }
}

function sampleAudio() {
  if (!analyser) return { level: 0, beat: 0 };
  analyser.getByteFrequencyData(dataArray);
  analyser.getByteTimeDomainData(timeArray);

  const gain = Number(controls.gain.value);
  const norm = dataArray.map((v) => v / 255);
  const rms = Math.sqrt(norm.reduce((a, b) => a + b * b, 0) / norm.length);
  const level = Math.min(1, Math.pow(rms * gain * 2, 1.1));

  const bassBins = dataArray.slice(0, Math.max(8, Math.floor(dataArray.length * 0.12)));
  const bassAvg = bassBins.reduce((a, b) => a + b, 0) / bassBins.length / 255;

  const sensitivity = Number(controls.sensitivity.value);
  state.beatEnergy = state.beatEnergy * 0.82 + bassAvg * 0.18;
  const beat = bassAvg > state.beatEnergy * (1 + 0.2 * sensitivity) ? 1 : 0;
  if (beat) state.beatEnergy = bassAvg * 1.05;

  return { level, beat, waveform: [...timeArray] };
}

function oscillator(t, audioLevel) {
  const voices = Number(controls.oscVoices.value);
  const rate = Number(controls.oscRate.value);
  const depth = Number(controls.oscDepth.value);
  const spread = (Number(controls.phaseSpread.value) * Math.PI) / 180;
  let sum = 0;
  for (let i = 0; i < voices; i++) {
    sum += Math.sin((t * rate + i * spread) * controls.timebase.value + audioLevel * 6);
  }
  return (sum / voices) * depth;
}

function clearCanvas(trail) {
  ctx.fillStyle = `rgba(5, 8, 16, ${1 - trail})`;
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

function drawWaveform(waveform, color, level) {
  const gain = Number(controls.traceGain.value);
  if (!waveform || gain <= 0) return;
  ctx.save();
  ctx.translate(20, canvas.clientHeight - 120);
  ctx.scale(canvas.clientWidth - 40, 80);
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.globalAlpha = Math.min(1, gain + level * 0.6);
  ctx.beginPath();
  waveform.forEach((v, i) => {
    const x = i / waveform.length;
    const y = (v / 255 - 0.5) * 0.8 + 0.5;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function buildVertices(dim, count, radius, level, osc) {
  const verts = [];
  const angleStep = (Math.PI * 2) / count;
  for (let i = 0; i < count; i++) {
    const a = i * angleStep + state.rotation;
    const wobble = Math.sin(i * 0.6 + state.time * 0.8 + level * 3) * (radius * 0.08) + osc;
    verts.push({
      x: Math.cos(a) * (radius + wobble),
      y: Math.sin(a) * (radius + wobble),
      z: Math.sin(a * dim) * (radius * 0.15 + level * 80),
    });
  }
  return verts;
}

function project({ x, y, z }, depth) {
  const scale = 1 / (1 + depth * 0.0025 * z);
  return { x: x * scale, y: y * scale };
}

function drawMesh(vertices, colorFn, lineWidth) {
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const a = vertices[i];
      const b = vertices[j];
      ctx.strokeStyle = colorFn(i + j, vertices.length + i + j);
      ctx.lineWidth = lineWidth;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 12 + Number(controls.bloom.value) * 24;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
}

function reactiveOffset(mode, level, beat, i) {
  switch (mode) {
    case "pulse":
      return Math.sin(state.time * 2 + i) * level * 120 + beat * 60;
    case "zigzag":
      return ((i % 2 === 0 ? -1 : 1) * level * 180) + Math.sin(state.time * 6 + i) * 30;
    case "orbit":
      return Math.sin(state.time * 1.4 + i * 0.6) * 160 * level;
    case "swarm":
      return (Math.random() - 0.5) * 220 * level + beat * 80;
    default:
      return 0;
  }
}

function renderFrame() {
  requestAnimationFrame(renderFrame);
  const { level, beat, waveform } = sampleAudio();
  state.time += 0.016;
  state.rotation += 0.0015 * Number(controls.timebase.value) + level * 0.02 + beat * 0.015;
  const colorRate = Number(controls.colorRate.value);
  state.hue = (state.hue + (0.4 + level * 10) * colorRate + beat * 40 * colorRate) % 360;

  clearCanvas(Number(controls.trail.value));
  ctx.save();
  const centerX = canvas.clientWidth / 2 + Number(controls.offsetX.value);
  const centerY = canvas.clientHeight / 2 + Number(controls.offsetY.value);
  ctx.translate(centerX, centerY);

  const dim = Number(controls.dimension.value);
  const layers = Math.max(1, dim);
  const count = Number(controls.vertexCount.value);
  const scale = Number(controls.scale.value);
  const baseRadius = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.32 * scale;
  const osc = oscillator(state.time, level);
  const mode = controls.reactiveMode.value;
  const lineWidth = 1.2 + level * 3 + Number(controls.bloom.value) * 2;
  const program = controls.colorProgram.value;

  for (let i = 0; i < layers; i++) {
    const layerScale = i === 0 ? 1 : i === 3 ? 0.5 : i === 4 ? 0.25 : 1 - i * 0.18;
    const offset = reactiveOffset(mode, level, beat, i) + osc * 0.2 + beat * 40;
    const radius = baseRadius * layerScale + offset;
    const verts = buildVertices(dim, count, radius, level, osc);
    const projected = verts.map((v) => {
      const spread = Number(controls.spread.value);
      return project({ x: v.x, y: v.y, z: v.z + spread * (i * 0.4) }, i + 1);
    });

    const hue = hueForPalette();
    const colorFn = (idx, total) => programColor(program, idx, total, (hue + i * 18) % 360, level, beat);
    drawMesh(projected, colorFn, lineWidth + beat * 2 + level * 1.5);
  }

  ctx.restore();

  const traceHue = hueForPalette();
  drawWaveform(
    waveform,
    `hsla(${traceHue}, 100%, 70%, ${0.4 + Number(controls.traceGain.value)})`,
    level
  );
}

requestAnimationFrame(renderFrame);
