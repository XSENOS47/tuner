const STRINGS = [
  { name: "E2", freq: 82.41 },
  { name: "A2", freq: 110.0 },
  { name: "D3", freq: 146.83 },
  { name: "G3", freq: 196.0 },
  { name: "B3", freq: 246.94 },
  { name: "E4", freq: 329.63 },
];

const startBtn = document.getElementById("startBtn");
const statusEl = document.getElementById("status");
const noteEl = document.getElementById("note");
const subnoteEl = document.getElementById("subnote");
const frequencyEl = document.getElementById("frequency");
const targetEl = document.getElementById("target");
const centsEl = document.getElementById("cents");
const helperEl = document.getElementById("helper");
const needleEl = document.getElementById("needle");
const stringGrid = document.getElementById("stringGrid");

let audioContext;
let analyser;
let buffer;
let animationId;

function buildStringGrid() {
  STRINGS.forEach((string) => {
    const card = document.createElement("div");
    card.className = "string-card";

    const name = document.createElement("div");
    name.className = "string-name";
    name.textContent = string.name;

    const freq = document.createElement("div");
    freq.className = "string-freq";
    freq.textContent = `${string.freq.toFixed(2)} Hz`;

    card.appendChild(name);
    card.appendChild(freq);
    stringGrid.appendChild(card);
  });
}

function updateStatus(message) {
  statusEl.textContent = message;
}

function centsOffFromPitch(frequency, target) {
  return 1200 * Math.log2(frequency / target);
}

function getNearestString(frequency) {
  let closest = STRINGS[0];
  let smallestDiff = Math.abs(frequency - closest.freq);

  for (const string of STRINGS) {
    const diff = Math.abs(frequency - string.freq);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closest = string;
    }
  }

  return closest;
}

function autoCorrelate(buffer, sampleRate) {
  const size = buffer.length;
  let rms = 0;

  for (let i = 0; i < size; i += 1) {
    const value = buffer[i];
    rms += value * value;
  }

  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return -1;

  let r1 = 0;
  let r2 = size - 1;
  const threshold = 0.2;

  for (let i = 0; i < size / 2; i += 1) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i;
      break;
    }
  }

  for (let i = 1; i < size / 2; i += 1) {
    if (Math.abs(buffer[size - i]) < threshold) {
      r2 = size - i;
      break;
    }
  }

  const trimmed = buffer.slice(r1, r2);
  const trimmedSize = trimmed.length;
  const correlations = new Array(trimmedSize).fill(0);

  for (let i = 0; i < trimmedSize; i += 1) {
    for (let j = 0; j < trimmedSize - i; j += 1) {
      correlations[i] += trimmed[j] * trimmed[j + i];
    }
  }

  let dip = 0;
  while (correlations[dip] > correlations[dip + 1]) {
    dip += 1;
  }

  let maxValue = -1;
  let maxPos = -1;
  for (let i = dip; i < trimmedSize; i += 1) {
    if (correlations[i] > maxValue) {
      maxValue = correlations[i];
      maxPos = i;
    }
  }

  if (maxPos === -1) return -1;

  let t0 = maxPos;
  if (t0 > 0 && t0 < trimmedSize - 1) {
    const x1 = correlations[t0 - 1];
    const x2 = correlations[t0];
    const x3 = correlations[t0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;

    if (a) {
      t0 -= b / (2 * a);
    }
  }

  return sampleRate / t0;
}

function updateMeter(cents) {
  const clamped = Math.max(-50, Math.min(50, cents));
  const rotation = (clamped / 50) * 45;
  needleEl.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
}

function updateHelper(cents) {
  if (Math.abs(cents) <= 3) {
    helperEl.textContent = "Идеально! Можно переходить к следующей струне.";
    helperEl.style.borderLeftColor = "#60b77b";
    return;
  }

  if (cents < 0) {
    helperEl.textContent = "Слишком низко — подтяните струну вверх.";
    helperEl.style.borderLeftColor = "#d45e4a";
    return;
  }

  helperEl.textContent = "Слишком высоко — немного ослабьте струну.";
  helperEl.style.borderLeftColor = "#d45e4a";
}

function renderInactive() {
  noteEl.textContent = "—";
  subnoteEl.textContent = "Выберите струну и сыграйте ноту";
  frequencyEl.textContent = "— Hz";
  targetEl.textContent = "— Hz";
  centsEl.textContent = "— ¢";
  helperEl.textContent = "Подсказка появится тут";
  updateMeter(0);
}

function updateLoop() {
  analyser.getFloatTimeDomainData(buffer);
  const frequency = autoCorrelate(buffer, audioContext.sampleRate);

  if (frequency === -1) {
    updateStatus("Слушаю... сыграйте струну");
    renderInactive();
  } else {
    const string = getNearestString(frequency);
    const cents = centsOffFromPitch(frequency, string.freq);
    const roundedCents = Math.round(cents);

    noteEl.textContent = string.name;
    subnoteEl.textContent = `Ближайшая струна ${string.name}`;
    frequencyEl.textContent = `${frequency.toFixed(2)} Hz`;
    targetEl.textContent = `${string.freq.toFixed(2)} Hz`;
    centsEl.textContent = `${roundedCents} ¢`;
    updateMeter(roundedCents);
    updateHelper(roundedCents);
    updateStatus("Работаю");
  }

  animationId = requestAnimationFrame(updateLoop);
}

async function start() {
  try {
    updateStatus("Запрашиваю доступ к микрофону...");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    buffer = new Float32Array(analyser.fftSize);

    startBtn.disabled = true;
    updateStatus("Слушаю... сыграйте струну");
    animationId = requestAnimationFrame(updateLoop);
  } catch (error) {
    updateStatus("Не удалось получить доступ к микрофону");
    helperEl.textContent = "Проверьте, что в Safari разрешен микрофон для этой страницы.";
    console.error(error);
  }
}

buildStringGrid();
renderInactive();
startBtn.addEventListener("click", start);
