const canvas = document.getElementById("display");
const ctx = canvas.getContext("2d");
const audioElement = document.getElementById("audioPlayer");

const controls = {
  dimension: document.getElementById("dimension"),
  vertexCount: document.getElementById("vertexCount"),
  color: document.getElementById("color"),
  displayScale: document.getElementById("displayScale"),
  colorPulse: document.getElementById("colorPulse"),
  offsetX: document.getElementById("offsetX"),
  offsetY: document.getElementById("offsetY"),
  feedback: document.getElementById("feedback"),
  distortion: document.getElementById("distortion"),
  audioReact: document.getElementById("audioReact"),
  audioBoost: document.getElementById("audioBoost"),
  reactiveStyle: document.getElementById("reactiveStyle"),
  beatSensitivity: document.getElementById("beatSensitivity"),
  waveformMix: document.getElementById("waveformMix"),
  rotation: document.getElementById("rotation"),
  thickness: document.getElementById("thickness"),
  spread: document.getElementById("spread"),
  feedbackDistortion: document.getElementById("feedbackDistortion"),
  mirrorIntensity: document.getElementById("mirrorIntensity"),
  bloom: document.getElementById("bloom"),
  shapeMode: document.getElementById("shapeMode"),
  shapeSize: document.getElementById("shapeSize"),
  oscRate: document.getElementById("oscRate"),
  oscDepth: document.getElementById("oscDepth"),
  oscVoices: document.getElementById("oscVoices"),
  phaseSpread: document.getElementById("phaseSpread"),
  timebase: document.getElementById("timebase"),
  traceBrightness: document.getElementById("traceBrightness"),
  playPause: document.getElementById("playPause"),
  reset: document.getElementById("reset"),
  audioInput: document.getElementById("audioInput"),
};

const values = document.querySelectorAll(".value");
values.forEach((val) => {
  const forId = val.dataset.for;
  const input = document.getElementById(forId);
  if (!input) return;
  const update = () => {
    const suffix = forId === "dimension" ? "D" : "";
    val.textContent = `${Number(input.value).toFixed(input.step && Number(input.step) < 1 ? 2 : 0)}${suffix}`;
  };
  input.addEventListener("input", update);
  update();
});

let audioContext;
let analyser;
let dataArray;
let timeDomainArray;
let mediaElementSource;
let isPlaying = false;
let audioReady = false;
let currentObjectUrl;
let phase = 0;

const state = {
  vertices: [],
  rotation: 0,
  jitterSeed: Math.random() * 1000,
  beat: 0,
  beatAvg: 0,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hexToHSL(hex) {
  const sanitized = hex.replace("#", "");
  const num = parseInt(sanitized, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const rP = r / 255;
  const gP = g / 255;
  const bP = b / 255;
  const max = Math.max(rP, gP, bP);
  const min = Math.min(rP, gP, bP);
  let h;
  let s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rP:
        h = (gP - bP) / d + (gP < bP ? 6 : 0);
        break;
      case gP:
        h = (bP - rP) / d + 2;
        break;
      default:
        h = (rP - gP) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }) {
  const c = (1 - Math.abs(2 * l / 100 - 1)) * (s / 100);
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l / 100 - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (v) => {
    const hex = Math.round((v + m) * 255).toString(16).padStart(2, "0");
    return hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function setupAnalyser() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (!analyser) {
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    timeDomainArray = new Uint8Array(analyser.fftSize);
  }
}

async function loadAudio(file) {
  if (!file) return;
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
  }
  currentObjectUrl = URL.createObjectURL(file);
  audioElement.pause();
  audioElement.currentTime = 0;
  audioElement.src = currentObjectUrl;
  await audioElement.load?.();

  setupAnalyser();

  if (mediaElementSource) {
    mediaElementSource.disconnect();
  }
  mediaElementSource = audioContext.createMediaElementSource(audioElement);
  mediaElementSource.connect(analyser);
  analyser.connect(audioContext.destination);

  audioReady = true;
  isPlaying = false;
  controls.playPause.disabled = false;
  controls.playPause.textContent = "Play";
}

controls.audioInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  loadAudio(file);
});

controls.playPause.addEventListener("click", () => {
  if (!audioReady || !audioContext || !analyser) return;

  audioContext.resume();

  if (audioElement.paused) {
    audioElement.play();
    isPlaying = true;
    controls.playPause.textContent = "Pause";
  } else {
    audioElement.pause();
    isPlaying = false;
    controls.playPause.textContent = "Resume";
  }
});

audioElement.addEventListener("ended", () => {
  isPlaying = false;
  controls.playPause.textContent = "Play";
});

controls.reset.addEventListener("click", () => {
  state.jitterSeed = Math.random() * 1000;
  phase = 0;
});

function getAudioMetrics() {
  if (!analyser || !dataArray || !timeDomainArray) {
    return { level: 0, bass: 0, mid: 0, treble: 0, waveform: [] };
  }

  analyser.getByteFrequencyData(dataArray);
  analyser.getByteTimeDomainData(timeDomainArray);

  const fftSize = dataArray.length;
  const level = dataArray.reduce((acc, v) => acc + v, 0) / (fftSize * 255);
  const energy = Math.sqrt(
    timeDomainArray.reduce((acc, v) => {
      const centered = v - 128;
      return acc + centered * centered;
    }, 0) / timeDomainArray.length
  ) / 128;

  const band = (start, end) => {
    let sum = 0;
    for (let i = start; i < end; i++) sum += dataArray[i];
    return sum / ((end - start) * 255);
  };

  const bass = band(0, Math.floor(fftSize * 0.12));
  const mid = band(Math.floor(fftSize * 0.12), Math.floor(fftSize * 0.45));
  const treble = band(Math.floor(fftSize * 0.45), fftSize);

  const waveform = Array.from(timeDomainArray, (v) => (v - 128) / 128);

  const blendedLevel = (level * 0.6 + energy * 0.4) * Number(controls.audioBoost.value);
  const scaledLevel = clamp(Math.pow(blendedLevel, 0.85) * 1.35, 0, 1.6);

  // Beat detector: track a slow average, trigger when energy surpasses it by sensitivity
  state.beatAvg = lerp(state.beatAvg || scaledLevel, scaledLevel, 0.08);
  const sensitivity = Number(controls.beatSensitivity.value);
  if (scaledLevel > state.beatAvg + sensitivity * 0.25) {
    state.beat = 1;
  } else {
    state.beat = lerp(state.beat, 0, 0.1);
  }

  return {
    level: scaledLevel,
    bass,
    mid,
    treble,
    waveform,
    beat: state.beat,
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function jitterNoise(index, scale) {
  return (
    Math.sin(index * 12.9898 + state.jitterSeed + phase * 0.2) * 43758.5453 % 1
  ) * scale;
}

function getVertices(dimension, count, metrics) {
  const vertices = [];
  const distortion = Number(controls.distortion.value);
  const spread = Number(controls.spread.value);
  const scale = Number(controls.displayScale.value);
  const baseRadius = canvas.height * 0.22 * scale;
  const react = Number(controls.audioReact.value);
  const radius = lerp(
    baseRadius,
    baseRadius * (1.8 + spread + metrics.bass * 0.8),
    clamp(metrics.level * react, 0, 1)
  );

  if (dimension === 1) {
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1 || 1);
      const x = lerp(-radius, radius, t);
      const y = jitterNoise(i, distortion * 24 + metrics.mid * 8) + (metrics.level - 0.5) * radius * 0.6;
      vertices.push({ x, y, z: 0 });
    }
    return vertices;
  }

  if (dimension === 2) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + phase * 0.05;
      const r = radius * (1 + jitterNoise(i, distortion * 0.2 + metrics.mid * 0.1));
      vertices.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        z: 0,
      });
    }
    return vertices;
  }

  // 3D and higher
  for (let i = 0; i < count; i++) {
    const theta = Math.acos(1 - 2 * ((i + 0.5) / count));
    const phi = Math.PI * (1 + Math.sqrt(5)) * i;
    const r = radius * (1 + jitterNoise(i, distortion * 0.1 + metrics.treble * 0.06));
    const x = Math.cos(phi) * Math.sin(theta) * r;
    const y = Math.sin(phi) * Math.sin(theta) * r;
    const z = Math.cos(theta) * r * (1 + metrics.level * 0.5);
    vertices.push({ x, y, z });
  }

  if (dimension >= 4) {
    const scaled = vertices.map((v) => ({
      x: v.x * 0.5,
      y: v.y * 0.5,
      z: v.z * 0.5,
    }));
    vertices.push(...scaled);
  }

  if (dimension >= 5) {
    const scaled = vertices.map((v) => ({
      x: v.x * 0.5,
      y: v.y * 0.5,
      z: v.z * 0.5,
    }));
    vertices.push(...scaled);
  }

  return vertices;
}

function project(point) {
  const a = state.rotation;

  // rotate around y and x for motion
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);
  const cosB = Math.cos(a * 0.8);
  const sinB = Math.sin(a * 0.8);

  const x1 = point.x * cosA - point.z * sinA;
  const z1 = point.x * sinA + point.z * cosA;
  const y1 = point.y * cosB - z1 * sinB;
  const z2 = point.y * sinB + z1 * cosB;

  const distance = 420;
  const perspective = distance / (distance + z2 + 1);

  return {
    x: x1 * perspective + canvas.width / 2 + Number(controls.offsetX.value),
    y: y1 * perspective + canvas.height / 2 + Number(controls.offsetY.value),
  };
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(158, 250, 165, 0.08)";
  ctx.lineWidth = 1;
  const step = 40;
  for (let x = 0; x < canvas.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOverlay(laserColor, audioLevel) {
  const mode = controls.shapeMode.value;
  if (!mode || mode === "none") return;

  const scale = Number(controls.displayScale.value);
  const size = Number(controls.shapeSize.value);
  const baseRadius = canvas.height * 0.22 * scale * size;
  const depth = Number(controls.oscDepth.value);
  const rate = Number(controls.oscRate.value);
  const voices = Number(controls.oscVoices.value);
  const spread = (Number(controls.phaseSpread.value) * Math.PI) / 180;
  let oscSum = 0;
  for (let v = 0; v < voices; v++) {
    oscSum += Math.sin(phase * 0.02 * rate + v * spread + audioLevel * 3);
  }
  const osc = (oscSum / voices) * depth;
  const modulation = 1 + osc + audioLevel * depth * 0.8;
  const cx = canvas.width / 2 + Number(controls.offsetX.value);
  const cy = canvas.height / 2 + Number(controls.offsetY.value);

  ctx.save();
  ctx.strokeStyle = laserColor;
  ctx.lineWidth = Math.max(1, Number(controls.thickness.value) * 0.6);
  ctx.globalAlpha = 0.55 + audioLevel * 0.35;
  ctx.shadowBlur = Number(controls.bloom.value) * 0.5;
  ctx.shadowColor = laserColor;
  ctx.globalCompositeOperation = "lighter";

  const drawLissajous = () => {
    const points = 220;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const t = (i / points) * Math.PI * 2;
      const x = cx + Math.sin(t * 3 + phase * 0.01) * baseRadius * modulation;
      const y = cy + Math.sin(t * 4 + phase * 0.015) * baseRadius * modulation * 0.8;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  const drawSpiral = () => {
    const turns = 4;
    const steps = 240;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI * 2 * turns + phase * 0.01;
      const r = baseRadius * modulation * (0.2 + t);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  const drawPolygon = () => {
    const sides = 6;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2 + phase * 0.01;
      const wobble = Math.sin(i * 0.8 + phase * 0.05) * depth * 12;
      const r = baseRadius * modulation + wobble;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  };

  switch (mode) {
    case "circle":
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * modulation, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "polygon":
      drawPolygon();
      break;
    case "lissajous":
      drawLissajous();
      break;
    case "spiral":
      drawSpiral();
      break;
    default:
      break;
  }

  ctx.restore();
}

function drawWaveform(metrics, laserColor) {
  const mix = Number(controls.waveformMix.value);
  if (mix <= 0.001 || !metrics.waveform.length) return;

  const timebase = Number(controls.timebase.value);
  const brightness = Number(controls.traceBrightness.value);
  const cx = canvas.width / 2 + Number(controls.offsetX.value);
  const cy = canvas.height / 2 + Number(controls.offsetY.value);
  const scale = Number(controls.displayScale.value);
  const width = canvas.width * 0.7 * scale;
  const height = canvas.height * 0.32 * scale;

  ctx.save();
  ctx.translate(cx - width / 2, cy);
  ctx.globalAlpha = clamp(mix * (0.4 + metrics.level * 0.6), 0, 1);
  ctx.strokeStyle = laserColor;
  ctx.lineWidth = Math.max(1, Number(controls.thickness.value) * 0.8);
  ctx.shadowBlur = Number(controls.bloom.value) * 0.4 * brightness;
  ctx.shadowColor = laserColor;
  ctx.globalCompositeOperation = "screen";

  ctx.beginPath();
  metrics.waveform.forEach((v, i) => {
    const t = (i / metrics.waveform.length) * timebase;
    const x = (t / timebase) * width;
    const y = -v * height * (0.6 + metrics.bass * 0.8);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = `rgba(255,255,255,${0.18 * brightness})`;
  ctx.lineWidth = 1;
  ctx.moveTo(0, 0);
  ctx.lineTo(width, 0);
  ctx.stroke();

  ctx.restore();
}

function render() {
  const metrics = getAudioMetrics();
  const audioLevel = metrics.level;
  const feedback = Number(controls.feedback.value);
  ctx.fillStyle = `rgba(3, 12, 7, ${feedback})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

    const mirrorIntensity = Number(controls.mirrorIntensity.value);
    if (mirrorIntensity > 0.001) {
      const cssWidth = canvas.width / devicePixelRatio;
      const cssHeight = canvas.height / devicePixelRatio;
      const mirrorScale = clamp(1 - mirrorIntensity * 0.14 - audioLevel * 0.05, 0.7, 0.98);
      const dx = (cssWidth - cssWidth * mirrorScale) / 2;
      const dy = (cssHeight - cssHeight * mirrorScale) / 2;
      ctx.save();
      ctx.globalAlpha = mirrorIntensity * 0.9;
      ctx.globalCompositeOperation = "screen";
      ctx.drawImage(canvas, dx, dy, cssWidth * mirrorScale, cssHeight * mirrorScale);
      ctx.restore();
    }

  drawGrid();

  const dimension = Number(controls.dimension.value);
  const vertexCount = Number(controls.vertexCount.value);
  state.vertices = getVertices(dimension, vertexCount, metrics);

  const baseHSL = hexToHSL(controls.color.value);
  const pulse = Number(controls.colorPulse.value);
  const pulseInfluence = pulse * (0.4 + audioLevel * 0.9 + metrics.beat * 0.6);
  const laserHue = (baseHSL.h + phase * 0.25 + audioLevel * 220 * pulse + metrics.beat * 65) % 360;
  const laserColor = hslToHex({
    h: laserHue,
    s: clamp(baseHSL.s * (1 + pulseInfluence * 0.9) + metrics.bass * 32, 0, 100),
    l: clamp(baseHSL.l * (0.9 + pulseInfluence * 0.6) + metrics.beat * 10 - pulse * 4, 8, 92),
  });

  const bloom = Number(controls.bloom.value);
  ctx.strokeStyle = laserColor;
  ctx.lineWidth = Number(controls.thickness.value) * (1 + audioLevel * 0.6 + metrics.beat * 0.6);
  ctx.shadowBlur = bloom + audioLevel * (10 + pulse * 24) + metrics.beat * 20;
  ctx.shadowColor = laserColor;

  const offsetStrength = Number(controls.feedbackDistortion.value);
  const distortion = Number(controls.distortion.value);

  const reactiveMode = controls.reactiveStyle.value;
  const zigzagPhase = reactiveMode === "zigzag" ? Math.sin(phase * 0.07) * (12 + metrics.level * 18) : 0;

  const projected = state.vertices.map((v, i) => {
    const wobble = jitterNoise(i, distortion * 6 + audioLevel * 12 + metrics.treble * 7);
    const zigzag = reactiveMode === "zigzag" ? Math.sin(i * 0.9 + phase * 0.2) * (6 + metrics.level * 28 + metrics.beat * 12) : 0;
    const pulseScale = reactiveMode === "pulse" ? 1 + metrics.beat * 0.9 + metrics.level * 0.25 : 1;
    const projectedPoint = project({
      x: (v.x + wobble + zigzagPhase) * pulseScale,
      y: (v.y + wobble + zigzag) * pulseScale,
      z: v.z + wobble,
    });
    projectedPoint.x += Math.sin(phase * 0.1 + i) * offsetStrength * (1 + metrics.level * 0.8);
    projectedPoint.y += Math.cos(phase * 0.1 + i) * offsetStrength * (1 + metrics.level * 0.8);
    return projectedPoint;
  });

  const strobe = controls.reactiveStyle.value === "strobe" ? 0.45 + metrics.treble * 1.05 : 1;
  ctx.globalAlpha = clamp(0.65 * strobe, 0.12, 1);

  ctx.beginPath();
  for (let i = 0; i < projected.length; i++) {
    for (let j = i + 1; j < projected.length; j++) {
      const a = projected[i];
      const b = projected[j];
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
  }
  ctx.stroke();

  if (projected.length > 2) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.4 + audioLevel * 0.35 + metrics.beat * 0.4;
    ctx.strokeStyle = `hsla(${(laserHue + 120) % 360}, 90%, 70%, 0.7)`;
    ctx.lineWidth = Math.max(1, Number(controls.thickness.value) * 0.6);
    ctx.beginPath();
    ctx.moveTo(projected[0].x, projected[0].y);
    for (let i = 1; i < projected.length; i++) {
      ctx.lineTo(projected[i].x, projected[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  drawOverlay(laserColor, audioLevel);
  drawWaveform(metrics, laserColor);

  ctx.fillStyle = laserColor;
  projected.forEach((p, i) => {
    ctx.beginPath();
    const pulseRadius = 2.5 + audioLevel * 2.5 + Math.sin(phase * 0.05 + i) * 0.8 * pulse + metrics.beat * 3;
    ctx.arc(p.x, p.y, pulseRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  state.rotation += Number(controls.rotation.value) * (controls.reactiveStyle.value === "strobe" ? 1.5 : 1);
  phase += 1 + metrics.level * 0.6;
  requestAnimationFrame(render);
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
}

window.addEventListener("resize", resize);
resize();
render();
