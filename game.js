'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (nut), silver
  '#f5f5f5', // WILD - comodín, blanco
];

const WILD = 9;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca, hueco en medio
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [400, 800, 1200, 1600]; // sin líneas, single, double, triple
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000]; // indexado por líneas limpiadas
const BTB_MULTIPLIER = 1.5;
const EFFECT_LIFE = 1100; // ms que dura cada texto flotante
const MAX_EFFECTS = 5;

const POWERUP_EVERY = 5;
const FREEZE_MS = 5000;
const DESTROY_SCORE = 10;

const POWERUPS = {
  bomb:    { color: '#ff7043', icon: '💣', label: 'Bomba' },
  ray:     { color: '#fff176', icon: '⚡', label: 'Rayo' },
  tint:    { color: '#ba68c8', icon: '🎨', label: 'Tinte' },
  gravity: { color: '#4db6ac', icon: '🌀', label: 'Gravedad' },
  freeze:  { color: '#4fc3f7', icon: '❄', label: 'Congelar' },
};
const POWERUP_KINDS = Object.keys(POWERUPS);

const QUEUE_LEN = 5;
const ENERGY_MAX = 100;
const ENERGY_PER_LINE = [0, 20, 45, 70, 100]; // indexado por líneas limpiadas
const PEEK_MS = 15000;
const SLOW_TIME_MS = 10000;
const SLOW_TIME_FACTOR = 2;

const SKILLS = {
  peek: { label: 'Ver 5 piezas', icon: '👁' },
  swap: { label: 'Cambiar pieza', icon: '🔄' },
  slow: { label: 'Ralentizar 10s', icon: '🐌' },
  undo: { label: 'Deshacer última', icon: '↩' },
  hold: { label: 'Reservar pieza', icon: '📦' },
};
const SKILL_KEYS = Object.keys(SKILLS);

const GARBAGE_INTERVAL = 10000;
const SURVIVE_TIME = 90000;
const LINES_TIME_LIMIT = 120000;
const LINES_TARGET = 40;
const REVERSE_ROTATION_LEVEL = 3;

const CHALLENGES = {
  lines_time: { desc: `Limpia ${LINES_TARGET} líneas en 2:00`, timeLimit: LINES_TIME_LIMIT, targetLines: LINES_TARGET },
  garbage: { desc: `Sobrevive ${SURVIVE_TIME / 1000}s con basura`, garbageInterval: GARBAGE_INTERVAL, surviveTime: SURVIVE_TIME },
  preset: { desc: 'Tablero con bloques fijos', presetFill: true },
  invisible: { desc: 'Piezas invisibles al tocar la pila', invisibleOnGround: true },
  reverseRotation: { desc: `Rotación inversa desde nivel ${REVERSE_ROTATION_LEVEL}`, reverseFromLevel: REVERSE_ROTATION_LEVEL },
};

const GRID_COLORS = {
  dark: '#22222e',
  light: '#d3d3e0',
};

const THEME_KEY = 'tetris-theme';
const themeSwitch = document.getElementById('theme-switch');
let theme = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';

function applyTheme(nextTheme) {
  theme = nextTheme;
  document.body.classList.toggle('light-theme', theme === 'light');
  themeSwitch.checked = theme === 'light';
  localStorage.setItem(THEME_KEY, theme);
}

themeSwitch.addEventListener('change', () => {
  applyTheme(themeSwitch.checked ? 'light' : 'dark');
});

applyTheme(theme);

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const powerupStatusEl = document.getElementById('powerup-status');
const comboStatusEl = document.getElementById('combo-status');
const challengeStatusSection = document.getElementById('challenge-status-section');
const challengeDescEl = document.getElementById('challenge-desc');
const challengeProgressEl = document.getElementById('challenge-progress');
const menuOverlay = document.getElementById('menu-overlay');
const menuBtn = document.getElementById('menu-btn');
const energyFillEl = document.getElementById('energy-fill');
const energyStatusEl = document.getElementById('energy-status');
const skillOverlay = document.getElementById('skill-overlay');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const queueCanvas = document.getElementById('queue-canvas');
const queueCtx = queueCanvas.getContext('2d');

let board, current, next, queue, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let nextPowerupAt, pendingPowerups, freezeLeft;
let combo, lastClearWasDifficult, lastActionWasRotate, floatingTexts;
let audioCtx;
let challenge, challengeTimeLeft, challengeSurvived, garbageAccum;
let energy, skillMenuOpen, peekLeft, slowLeft, holdPiece, lastLockSnapshot;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function makePowerup(kind) {
  return { type: 0, shape: [[1]], x: Math.floor(COLS / 2), y: 0, powerup: kind, dir: 'h' };
}

function randomPowerup() {
  const kind = POWERUP_KINDS[Math.floor(Math.random() * POWERUP_KINDS.length)];
  return makePowerup(kind);
}

function generateUpcomingPiece() {
  if (pendingPowerups > 0) { pendingPowerups--; return randomPowerup(); }
  return randomPiece();
}

function fillQueue() {
  while (queue.length < QUEUE_LEN) queue.push(generateUpcomingPiece());
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx] && board[ny][nx] !== WILD) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  if (current.powerup) {
    if (current.powerup === 'ray') current.dir = current.dir === 'h' ? 'v' : 'h';
    return;
  }
  const reversed = challenge?.reverseFromLevel && level >= challenge.reverseFromLevel;
  const rotated = reversed ? rotateCW(rotateCW(rotateCW(current.shape))) : rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastActionWasRotate = true;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}

function countTSpinCorners() {
  const corners = [
    [current.y, current.x],
    [current.y, current.x + 2],
    [current.y + 2, current.x],
    [current.y + 2, current.x + 2],
  ];
  let count = 0;
  for (const [r, c] of corners) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c]) count++;
  }
  return count;
}

// Regla de las 3 esquinas: T-spin si la última acción fue rotar y al menos
// 3 de las 4 esquinas de la caja 3×3 de la pieza están ocupadas (o fuera del tablero).
function detectTSpin() {
  return current.type === 3 && !current.powerup && lastActionWasRotate && countTSpinCorners() >= 3;
}

function spawnEffect(text, color) {
  floatingTexts.push({ text, color, life: EFFECT_LIFE, maxLife: EFFECT_LIFE });
  if (floatingTexts.length > MAX_EFFECTS) floatingTexts.shift();
}

function updateEffects(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    floatingTexts[i].life -= dt;
    if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
  }
}

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, duration = 150, type = 'sine', gainVal = 0.15) {
  try {
    const ctxA = ensureAudio();
    const osc = ctxA.createOscillator();
    const gain = ctxA.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainVal;
    osc.connect(gain);
    gain.connect(ctxA.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctxA.currentTime + duration / 1000);
    osc.stop(ctxA.currentTime + duration / 1000);
  } catch (e) {
    // Web Audio no disponible/bloqueada: sin sonido, sin romper el juego.
  }
}

// Aplica puntuación tras fijar una pieza: líneas base, combo, T-spin, B2B y Perfect Clear.
function applyScoring(cleared, tSpin) {
  if (cleared > 0) {
    lines += cleared;
    combo++;
    energy = Math.min(ENERGY_MAX, energy + (ENERGY_PER_LINE[cleared] || 0));

    const isDifficult = cleared === 4 || tSpin;
    let lineScore = tSpin
      ? (TSPIN_SCORES[cleared] ?? TSPIN_SCORES[TSPIN_SCORES.length - 1]) * level
      : (LINE_SCORES[cleared] || 0) * level;

    let b2b = false;
    if (isDifficult && lastClearWasDifficult) {
      lineScore = Math.round(lineScore * BTB_MULTIPLIER);
      b2b = true;
    }
    lastClearWasDifficult = isDifficult;

    lineScore *= combo;
    score += lineScore;

    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    while (lines >= nextPowerupAt) {
      pendingPowerups++;
      nextPowerupAt += POWERUP_EVERY;
    }

    if (tSpin) { spawnEffect(`T-SPIN x${cleared}!`, '#ff8a65'); playTone(660, 180, 'square'); }
    if (b2b) { spawnEffect('BACK-TO-BACK!', '#ffd54f'); playTone(880, 200, 'triangle'); }
    if (combo >= 2) { spawnEffect(`COMBO x${combo}!`, '#4fc3f7'); playTone(440 + combo * 40, 120, 'sine'); }

    if (board.every(row => row.every(v => v === 0))) {
      score += (PERFECT_CLEAR_SCORES[cleared] ?? PERFECT_CLEAR_SCORES[PERFECT_CLEAR_SCORES.length - 1]) * level;
      spawnEffect('PERFECT CLEAR!', '#81c784');
      playTone(1046, 400, 'sine');
    }
  } else {
    combo = 0;
    if (tSpin) {
      score += TSPIN_SCORES[0] * level;
      spawnEffect('T-SPIN!', '#ff8a65');
      playTone(660, 180, 'square');
    }
  }
  updateHUD();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function snapshotBeforeLock() {
  lastLockSnapshot = {
    board: board.map(row => [...row]),
    score, lines, level, dropInterval, combo, lastClearWasDifficult,
    pendingPowerups, nextPowerupAt, energy,
    current: { ...current, shape: current.shape.map(row => [...row]) },
    next: { ...next, shape: next.shape.map(row => [...row]) },
    queue: queue.map(p => ({ ...p, shape: p.shape.map(row => [...row]) })),
  };
}

function lockPiece() {
  snapshotBeforeLock();
  const tSpin = detectTSpin();
  if (current.powerup) {
    applyPowerup();
  } else {
    merge();
  }
  const cleared = clearLines();
  applyScoring(cleared, tSpin);
  if (challenge?.targetLines && lines >= challenge.targetLines) {
    endGame(true);
    return;
  }
  spawn();
}

function applyPowerup() {
  const cx = current.x;
  const cy = current.y;
  switch (current.powerup) {
    case 'bomb': {
      for (let r = cy - 1; r <= cy + 1; r++) {
        if (r < 0 || r >= ROWS) continue;
        for (let c = cx - 1; c <= cx + 1; c++) {
          if (c < 0 || c >= COLS) continue;
          if (board[r][c]) {
            score += DESTROY_SCORE;
            board[r][c] = 0;
          }
        }
      }
      break;
    }
    case 'ray': {
      if (current.dir === 'v') {
        for (let r = 0; r < ROWS; r++) {
          if (board[r][cx]) {
            score += DESTROY_SCORE;
            board[r][cx] = 0;
          }
        }
      } else {
        for (let c = 0; c < COLS; c++) {
          if (board[cy][c]) score += DESTROY_SCORE;
        }
        board.splice(cy, 1);
        board.unshift(new Array(COLS).fill(0));
      }
      break;
    }
    case 'tint': {
      let targetColor = cy + 1 < ROWS ? board[cy + 1][cx] : 0;
      if (!targetColor || targetColor === WILD) {
        const counts = {};
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            if (board[r][c] && board[r][c] !== WILD)
              counts[board[r][c]] = (counts[board[r][c]] || 0) + 1;
        let best = 0, bestCount = 0;
        for (const [colorIdx, count] of Object.entries(counts)) {
          if (count > bestCount) { best = Number(colorIdx); bestCount = count; }
        }
        targetColor = best;
      }
      if (targetColor) {
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            if (board[r][c] === targetColor) board[r][c] = WILD;
      }
      break;
    }
    case 'gravity': {
      compactBoard();
      break;
    }
    case 'freeze': {
      freezeLeft = FREEZE_MS;
      break;
    }
  }
}

function addGarbageRow() {
  if (board[0].some(v => v !== 0)) {
    endGame(false);
    return;
  }
  board.shift();
  const gapCol = Math.floor(Math.random() * COLS);
  const row = Array.from({ length: COLS }, (_, c) => c === gapCol ? 0 : Math.floor(Math.random() * 7) + 1);
  board.push(row);
  if (collide(current.shape, current.x, current.y)) endGame(false);
}

function applyPresetFill() {
  for (let r = ROWS - 6; r < ROWS; r++) {
    let filledCount = 0;
    for (let c = 0; c < COLS; c++) {
      if (Math.random() < 0.55) {
        board[r][c] = Math.floor(Math.random() * 7) + 1;
        filledCount++;
      }
    }
    if (filledCount === COLS) board[r][Math.floor(Math.random() * COLS)] = 0;
  }
}

function compactBoard() {
  for (let c = 0; c < COLS; c++) {
    const colVals = [];
    for (let r = 0; r < ROWS; r++) {
      if (board[r][c]) colVals.push(board[r][c]);
    }
    const emptyCount = ROWS - colVals.length;
    for (let r = 0; r < ROWS; r++) {
      board[r][c] = r < emptyCount ? 0 : colVals[r - emptyCount];
    }
  }
}

function spawn() {
  current = queue.shift();
  fillQueue();
  next = queue[0];
  lastActionWasRotate = false;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  refreshPreviews();
}

function refreshPreviews() {
  drawNext();
  drawHold();
  drawQueue();
}

function doHold() {
  if (holdPiece === null) {
    holdPiece = { type: current.type, shape: PIECES[current.type].map(row => [...row]) };
    current = queue.shift();
    fillQueue();
    next = queue[0];
  } else {
    const stored = holdPiece;
    holdPiece = { type: current.type, shape: PIECES[current.type].map(row => [...row]) };
    const shape = stored.shape.map(row => [...row]);
    current = { type: stored.type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
  }
  lastActionWasRotate = false;
  if (collide(current.shape, current.x, current.y)) endGame();
  refreshPreviews();
}

function doSwap() {
  current = randomPiece();
  lastActionWasRotate = false;
  if (collide(current.shape, current.x, current.y)) endGame();
}

function doUndo() {
  const s = lastLockSnapshot;
  if (!s) return;
  board = s.board.map(row => [...row]);
  score = s.score; lines = s.lines; level = s.level; dropInterval = s.dropInterval;
  combo = s.combo; lastClearWasDifficult = s.lastClearWasDifficult;
  pendingPowerups = s.pendingPowerups; nextPowerupAt = s.nextPowerupAt; energy = s.energy;
  current = { ...s.current, shape: s.current.shape.map(row => [...row]) };
  next = { ...s.next, shape: s.next.shape.map(row => [...row]) };
  queue = s.queue.map(p => ({ ...p, shape: p.shape.map(row => [...row]) }));
  lastLockSnapshot = null;
  refreshPreviews();
}

function activateSkill(key) {
  if (!SKILLS[key]) return;
  energy = 0;
  closeSkillMenu();
  switch (key) {
    case 'peek':
      peekLeft = PEEK_MS;
      spawnEffect('VISIÓN x5!', '#4fc3f7');
      refreshPreviews();
      break;
    case 'swap':
      doSwap();
      spawnEffect('PIEZA CAMBIADA', '#ba68c8');
      break;
    case 'slow':
      slowLeft = SLOW_TIME_MS;
      spawnEffect('TIEMPO LENTO', '#81c784');
      break;
    case 'undo':
      doUndo();
      spawnEffect('DESHECHO', '#ffd54f');
      break;
    case 'hold':
      doHold();
      spawnEffect('PIEZA RESERVADA', '#ff8a65');
      break;
  }
  playTone(700, 200, 'triangle');
  updateHUD();
}

function openSkillMenu() {
  if (energy < ENERGY_MAX || gameOver || paused || skillMenuOpen) return;
  skillMenuOpen = true;
  cancelAnimationFrame(animId);
  skillOverlay.classList.remove('hidden');
}

function closeSkillMenu() {
  if (!skillMenuOpen) return;
  skillMenuOpen = false;
  skillOverlay.classList.add('hidden');
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  if (freezeLeft > 0) {
    powerupStatusEl.textContent = `❄ ${(freezeLeft / 1000).toFixed(1)}s`;
  } else {
    powerupStatusEl.textContent = `en ${nextPowerupAt - lines}`;
  }
  comboStatusEl.textContent = combo >= 2 ? `x${combo}` : '-';

  energyFillEl.style.width = `${energy}%`;
  energyFillEl.classList.toggle('ready', energy >= ENERGY_MAX);
  energyStatusEl.textContent = energy >= ENERGY_MAX ? 'LISTO (C)' : `${energy}/${ENERGY_MAX}`;
  drawQueue();

  if (!challenge) {
    challengeStatusSection.hidden = true;
    return;
  }
  challengeStatusSection.hidden = false;
  challengeDescEl.textContent = challenge.desc;
  if (challenge.timeLimit) {
    const secs = Math.max(0, Math.ceil(challengeTimeLeft / 1000));
    challengeProgressEl.textContent = `${lines}/${challenge.targetLines} líneas · ${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  } else if (challenge.surviveTime) {
    const secs = Math.max(0, Math.ceil((challenge.surviveTime - challengeSurvived) / 1000));
    challengeProgressEl.textContent = `Faltan ${secs}s`;
  } else {
    challengeProgressEl.textContent = '';
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (colorIndex === WILD) {
    context.strokeStyle = '#ffca28';
    context.lineWidth = 2;
    context.setLineDash([4, 3]);
    context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
    context.setLineDash([]);
  }
  context.globalAlpha = 1;
}

function drawPowerup(context, x, y, piece, size, alpha) {
  const def = POWERUPS[piece.powerup];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = def.color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.strokeStyle = 'rgba(0,0,0,0.35)';
  context.lineWidth = 2;
  context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
  context.font = `${Math.floor(size * 0.6)}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#1a1a25';
  let icon = def.icon;
  if (piece.powerup === 'ray') icon = piece.dir === 'v' ? '↕' : '↔';
  context.fillText(icon, x * size + size / 2, y * size + size / 2 + 1);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = GRID_COLORS[theme];
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  const grounded = challenge?.invisibleOnGround && !current.powerup && collide(current.shape, current.x, current.y + 1);

  // ghost
  if (!grounded) {
    const gy = ghostY();
    if (current.powerup) {
      drawPowerup(ctx, current.x, gy, current, BLOCK, 0.3);
    } else {
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c])
            drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
    }
  }

  // current piece
  if (!grounded) {
    if (current.powerup) {
      drawPowerup(ctx, current.x, current.y, current, BLOCK);
    } else {
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
    }
  }

  // freeze overlay
  if (freezeLeft > 0) {
    ctx.fillStyle = 'rgba(79, 195, 247, 0.12)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawEffects();
}

function drawEffects() {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px system-ui, sans-serif';
  floatingTexts.forEach((t, i) => {
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, canvas.width / 2, 80 + i * 26);
  });
  ctx.restore();
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (next.powerup) {
    drawPowerup(nextCtx, 1, 1, next, NB);
    return;
  }
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function drawHold() {
  const HB = 30;
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (!holdPiece) return;
  const shape = holdPiece.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(holdCtx, offX + c, offY + r, shape[r][c], HB);
}

function drawQueue() {
  queueCanvas.hidden = peekLeft <= 0;
  queueCtx.clearRect(0, 0, queueCanvas.width, queueCanvas.height);
  if (peekLeft <= 0) return;
  const QB = 16, SLOT = 3;
  queue.forEach((p, i) => {
    const baseRow = i * SLOT;
    if (p.powerup) {
      drawPowerup(queueCtx, 1, baseRow, p, QB);
      return;
    }
    const shape = p.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) drawBlock(queueCtx, offX + c, baseRow + r, shape[r][c], QB);
  });
}

function endGame(challengeSuccess) {
  gameOver = true;
  cancelAnimationFrame(animId);
  if (challenge) {
    overlayTitle.textContent = challengeSuccess ? '¡DESAFÍO SUPERADO!' : 'DESAFÍO FALLIDO';
  } else {
    overlayTitle.textContent = 'GAME OVER';
  }
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  updateEffects(dt);

  if (challenge?.timeLimit) {
    challengeTimeLeft -= dt;
    if (challengeTimeLeft <= 0) { endGame(false); return; }
  }
  if (challenge?.surviveTime) {
    challengeSurvived += dt;
    if (challengeSurvived >= challenge.surviveTime) { endGame(true); return; }
  }
  if (challenge?.garbageInterval) {
    garbageAccum += dt;
    if (garbageAccum >= challenge.garbageInterval) {
      garbageAccum = 0;
      addGarbageRow();
      if (gameOver) return;
    }
  }
  if (peekLeft > 0) {
    peekLeft = Math.max(0, peekLeft - dt);
    if (peekLeft === 0) drawQueue();
  }
  if (slowLeft > 0) slowLeft = Math.max(0, slowLeft - dt);

  updateHUD();

  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - dt);
    dropAccum = 0;
    updateHUD();
    draw();
    animId = requestAnimationFrame(loop);
    return;
  }
  dropAccum += dt;
  const effectiveDropInterval = slowLeft > 0 ? dropInterval * SLOW_TIME_FACTOR : dropInterval;
  if (dropAccum >= effectiveDropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
      if (gameOver) return;
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init(challengeKey) {
  if (challengeKey !== undefined) challenge = CHALLENGES[challengeKey] || null;
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  nextPowerupAt = POWERUP_EVERY;
  pendingPowerups = 0;
  freezeLeft = 0;
  combo = 0;
  lastClearWasDifficult = false;
  lastActionWasRotate = false;
  floatingTexts = [];
  challengeTimeLeft = challenge?.timeLimit ?? 0;
  challengeSurvived = 0;
  garbageAccum = 0;
  energy = 0;
  skillMenuOpen = false;
  peekLeft = 0;
  slowLeft = 0;
  holdPiece = null;
  lastLockSnapshot = null;
  skillOverlay.classList.add('hidden');
  if (challenge?.presetFill) applyPresetFill();
  queue = [];
  fillQueue();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  menuOverlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (skillMenuOpen) {
    const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code);
    if (idx >= 0 && SKILL_KEYS[idx]) activateSkill(SKILL_KEYS[idx]);
    else if (e.code === 'Escape') closeSkillMenu();
    return;
  }
  if (e.code === 'KeyC') { openSkillMenu(); return; }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastActionWasRotate = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastActionWasRotate = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => init());

menuBtn.addEventListener('click', () => {
  cancelAnimationFrame(animId);
  overlay.classList.add('hidden');
  menuOverlay.classList.remove('hidden');
});

document.querySelectorAll('.challenge-btn').forEach(btn => {
  btn.addEventListener('click', () => init(btn.dataset.challenge));
});

document.querySelectorAll('.skill-btn').forEach(btn => {
  btn.addEventListener('click', () => activateSkill(btn.dataset.skill));
});
