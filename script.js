const canvas = document.getElementById("display");
const ctx = canvas.getContext("2d");

const controls = {
  dimension: document.getElementById("dimension"),
  vertexCount: document.getElementById("vertexCount"),
  color: document.getElementById("color"),
  feedback: document.getElementById("feedback"),
  distortion: document.getElementById("distortion"),
  audioReact: document.getElementById("audioReact"),
  rotation: document.getElementById("rotation"),
  thickness: document.getElementById("thickness"),
  spread: document.getElementById("spread"),
  feedbackDistortion: document.getElementById("feedbackDistortion"),
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
let audioBufferSource;
let dataArray;
let isPlaying = false;
let audioReady = false;
let hasStarted = false;
let currentBuffer;
let phase = 0;

const state = {
  vertices: [],
  rotation: 0,
  jitterSeed: Math.random() * 1000,
};

function setupAudio(buffer) {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioBufferSource) {
    audioBufferSource.stop();
  }

  audioBufferSource = audioContext.createBufferSource();
  audioBufferSource.buffer = buffer;
  currentBuffer = buffer;
  hasStarted = false;
  isPlaying = false;

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  audioBufferSource.connect(analyser);
  analyser.connect(audioContext.destination);

  audioBufferSource.onended = () => {
    isPlaying = false;
    hasStarted = false;
    controls.playPause.textContent = "Play";
  };
}

async function loadAudio(file) {
  const arrayBuffer = await file.arrayBuffer();
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  const buffer = await audioContext.decodeAudioData(arrayBuffer);
  setupAudio(buffer);
  audioReady = true;
  controls.playPause.disabled = false;
}

controls.audioInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  loadAudio(file);
});

controls.playPause.addEventListener("click", () => {
  if (!audioReady || !audioContext || !currentBuffer) return;

  if (!hasStarted) {
    setupAudio(currentBuffer);
    audioContext.resume();
    audioBufferSource.start(0);
    hasStarted = true;
    isPlaying = true;
    controls.playPause.textContent = "Pause";
    return;
  }

  if (isPlaying) {
    audioContext.suspend();
    isPlaying = false;
    controls.playPause.textContent = "Resume";
  } else {
    audioContext.resume();
    isPlaying = true;
    controls.playPause.textContent = "Pause";
  }
});

controls.reset.addEventListener("click", () => {
  state.jitterSeed = Math.random() * 1000;
  phase = 0;
});

function getAudioLevel() {
  if (!analyser || !dataArray) return 0;
  analyser.getByteFrequencyData(dataArray);
  const peak = dataArray.reduce((acc, v) => Math.max(acc, v), 0);
  return peak / 255;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function jitterNoise(index, scale) {
  return (
    Math.sin(index * 12.9898 + state.jitterSeed + phase * 0.2) * 43758.5453 % 1
  ) * scale;
}

function getVertices(dimension, count, audioLevel) {
  const vertices = [];
  const distortion = Number(controls.distortion.value);
  const spread = Number(controls.spread.value);
  const baseRadius = canvas.height * 0.22;
  const radius = lerp(baseRadius, baseRadius * (1.5 + spread), audioLevel * Number(controls.audioReact.value));

  if (dimension === 1) {
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1 || 1);
      const x = lerp(-radius, radius, t);
      const y = jitterNoise(i, distortion * 20) + (audioLevel - 0.5) * radius * 0.3;
      vertices.push({ x, y, z: 0 });
    }
    return vertices;
  }

  if (dimension === 2) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + phase * 0.05;
      const r = radius * (1 + jitterNoise(i, distortion * 0.15));
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
    const r = radius * (1 + jitterNoise(i, distortion * 0.08));
    const x = Math.cos(phi) * Math.sin(theta) * r;
    const y = Math.sin(phi) * Math.sin(theta) * r;
    const z = Math.cos(theta) * r * (1 + audioLevel * 0.5);
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
    x: x1 * perspective + canvas.width / 2,
    y: y1 * perspective + canvas.height / 2,
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

function render() {
  const feedback = Number(controls.feedback.value);
  ctx.fillStyle = `rgba(3, 12, 7, ${feedback})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();

  const audioLevel = getAudioLevel();
  const dimension = Number(controls.dimension.value);
  const vertexCount = Number(controls.vertexCount.value);
  state.vertices = getVertices(dimension, vertexCount, audioLevel);

  const color = controls.color.value;
  ctx.strokeStyle = color;
  ctx.lineWidth = Number(controls.thickness.value);
  ctx.shadowBlur = 12 + audioLevel * 20;
  ctx.shadowColor = color;

  const offsetStrength = Number(controls.feedbackDistortion.value);
  const distortion = Number(controls.distortion.value);

  const projected = state.vertices.map((v, i) => {
    const wobble = jitterNoise(i, distortion * 4 + audioLevel * 8);
    const projectedPoint = project({
      x: v.x + wobble,
      y: v.y + wobble,
      z: v.z + wobble,
    });
    projectedPoint.x += Math.sin(phase * 0.1 + i) * offsetStrength;
    projectedPoint.y += Math.cos(phase * 0.1 + i) * offsetStrength;
    return projectedPoint;
  });

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

  ctx.fillStyle = color;
  projected.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5 + audioLevel * 2, 0, Math.PI * 2);
    ctx.fill();
  });

  state.rotation += Number(controls.rotation.value);
  phase += 1;
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
