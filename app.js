const TUNINGS = [
  {
    id: "standard",
    name: "Стандарт E",
    strings: [
      { name: "E2", freq: 82.41 },
      { name: "A2", freq: 110.0 },
      { name: "D3", freq: 146.83 },
      { name: "G3", freq: 196.0 },
      { name: "B3", freq: 246.94 },
      { name: "E4", freq: 329.63 },
    ],
  },
  {
    id: "drop-d",
    name: "Drop D",
    strings: [
      { name: "D2", freq: 73.42 },
      { name: "A2", freq: 110.0 },
      { name: "D3", freq: 146.83 },
      { name: "G3", freq: 196.0 },
      { name: "B3", freq: 246.94 },
      { name: "E4", freq: 329.63 },
    ],
  },
  {
    id: "dadgad",
    name: "DADGAD",
    strings: [
      { name: "D2", freq: 73.42 },
      { name: "A2", freq: 110.0 },
      { name: "D3", freq: 146.83 },
      { name: "G3", freq: 196.0 },
      { name: "A3", freq: 220.0 },
      { name: "D4", freq: 293.66 },
    ],
  },
  {
    id: "open-g",
    name: "Open G",
    strings: [
      { name: "D2", freq: 73.42 },
      { name: "G2", freq: 98.0 },
      { name: "D3", freq: 146.83 },
      { name: "G3", freq: 196.0 },
      { name: "B3", freq: 246.94 },
      { name: "D4", freq: 293.66 },
    ],
  },
  {
    id: "open-d",
    name: "Open D",
    strings: [
      { name: "D2", freq: 73.42 },
      { name: "A2", freq: 110.0 },
      { name: "D3", freq: 146.83 },
      { name: "F#3", freq: 185.0 },
      { name: "A3", freq: 220.0 },
      { name: "D4", freq: 293.66 },
    ],
  },
  {
    id: "half-step-down",
    name: "Полтона вниз (Eb)",
    strings: [
      { name: "Eb2", freq: 77.78 },
      { name: "Ab2", freq: 103.83 },
      { name: "Db3", freq: 138.59 },
      { name: "Gb3", freq: 185.0 },
      { name: "Bb3", freq: 233.08 },
      { name: "Eb4", freq: 311.13 },
    ],
  },
  {
    id: "whole-step-down",
    name: "Тон вниз (D)",
    strings: [
      { name: "D2", freq: 73.42 },
      { name: "G2", freq: 98.0 },
      { name: "C3", freq: 130.81 },
      { name: "F3", freq: 174.61 },
      { name: "A3", freq: 220.0 },
      { name: "D4", freq: 293.66 },
    ],
  },
  {
    id: "drop-c",
    name: "Drop C",
    strings: [
      { name: "C2", freq: 65.41 },
      { name: "G2", freq: 98.0 },
      { name: "C3", freq: 130.81 },
      { name: "F3", freq: 174.61 },
      { name: "A3", freq: 220.0 },
      { name: "D4", freq: 293.66 },
    ],
  },
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
const tuningSelect = document.getElementById("tuningSelect");
const autoModeBtn = document.getElementById("autoModeBtn");
const manualModeBtn = document.getElementById("manualModeBtn");
const stringsTitle = document.querySelector(".strings h2");

let audioContext;
let analyser;
let buffer;
let animationId;
let currentTuning = TUNINGS[0];
let mode = "auto";
let selectedIndex = null;

function buildStringGrid() {
  stringGrid.innerHTML = "";
  currentTuning.strings.forEach((string, index) => {
    const card = document.createElement("div");
    card.className = "string-card";
    card.dataset.index = String(index);

    const name = document.createElement("div");
    name.className = "string-name";
    name.textContent = string.name;

    const freq = document.createElement("div");
    freq.className = "string-freq";
    freq.textContent = `${string.freq.toFixed(2)} Hz`;

    card.appendChild(name);
    card.appendChild(freq);
    card.addEventListener("click", () => {
      setMode("manual");
      selectedIndex = index;
      updateStringGridState(selectedIndex, false);
      subnoteEl.textContent = `Ручной режим: цель — ${string.name}`;
    });
    stringGrid.appendChild(card);
  });
}

function buildTuningSelect() {
  tuningSelect.innerHTML = "";
  TUNINGS.forEach((tuning) => {
    const option = document.createElement("option");
    option.value = tuning.id;
    option.textContent = tuning.name;
    tuningSelect.appendChild(option);
  });
  tuningSelect.value = currentTuning.id;
}

function setTuning(id) {
  const tuning = TUNINGS.find((entry) => entry.id === id);
  if (!tuning) return;
  currentTuning = tuning;
  stringsTitle.textContent = tuning.name;
  selectedIndex = null;
  buildStringGrid();
  updateStringGridState(null, false);
  if (mode === "manual") {
    subnoteEl.textContent = "Выберите струну для ручной настройки";
  }
}

function setMode(nextMode) {
  mode = nextMode;
  autoModeBtn.classList.toggle("active", mode === "auto");
  manualModeBtn.classList.toggle("active", mode === "manual");
  if (mode === "auto") {
    selectedIndex = null;
    subnoteEl.textContent = "Авто: тюнер определяет струну сам";
  } else {
    subnoteEl.textContent = "Выберите струну для ручной настройки";
  }
  updateStringGridState(selectedIndex, false);
}

function updateStatus(message) {
  statusEl.textContent = message;
}

function centsOffFromPitch(frequency, target) {
  return 1200 * Math.log2(frequency / target);
}

function getNearestString(frequency, strings) {
  let closest = strings[0];
  let smallestDiff = Math.abs(frequency - closest.freq);

  for (const string of strings) {
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

function updateStringGridState(activeIndex, tuned) {
  const cards = stringGrid.querySelectorAll(".string-card");
  cards.forEach((card, index) => {
    card.classList.toggle("selected", index === activeIndex);
    card.classList.toggle("tuned", tuned && index === activeIndex);
  });
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
  if (mode === "auto") {
    subnoteEl.textContent = "Авто: тюнер определяет струну сам";
  } else {
    subnoteEl.textContent = "Выберите струну для ручной настройки";
  }
  frequencyEl.textContent = "— Hz";
  targetEl.textContent = "— Hz";
  centsEl.textContent = "— ¢";
  helperEl.textContent = "Подсказка появится тут";
  updateMeter(0);
  updateStringGridState(selectedIndex, false);
}

function updateLoop() {
  analyser.getFloatTimeDomainData(buffer);
  const frequency = autoCorrelate(buffer, audioContext.sampleRate);

  if (frequency === -1) {
    updateStatus("Слушаю... сыграйте струну");
    renderInactive();
  } else if (mode === "manual" && selectedIndex === null) {
    updateStatus("Выберите струну для ручной настройки");
    renderInactive();
  } else {
    const strings = currentTuning.strings;
    let string = null;
    let targetIndex = null;

    if (mode === "manual" && selectedIndex !== null) {
      string = strings[selectedIndex];
      targetIndex = selectedIndex;
    } else {
      string = getNearestString(frequency, strings);
      targetIndex = strings.findIndex((item) => item.name === string.name);
    }

    const cents = centsOffFromPitch(frequency, string.freq);
    const roundedCents = Math.round(cents);

    noteEl.textContent = string.name;
    if (mode === "manual") {
      subnoteEl.textContent = `Ручной режим: цель — ${string.name}`;
    } else {
      subnoteEl.textContent = `Авто: ближайшая струна ${string.name}`;
    }
    frequencyEl.textContent = `${frequency.toFixed(2)} Hz`;
    targetEl.textContent = `${string.freq.toFixed(2)} Hz`;
    centsEl.textContent = `${roundedCents} ¢`;
    updateMeter(roundedCents);
    updateHelper(roundedCents);
    updateStatus("Работаю");
    updateStringGridState(targetIndex, Math.abs(roundedCents) <= 3);
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
buildTuningSelect();
setMode("auto");
stringsTitle.textContent = currentTuning.name;

startBtn.addEventListener("click", start);
tuningSelect.addEventListener("change", (event) => setTuning(event.target.value));
autoModeBtn.addEventListener("click", () => setMode("auto"));
manualModeBtn.addEventListener("click", () => setMode("manual"));
