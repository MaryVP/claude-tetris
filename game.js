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

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let nextPowerupAt, pendingPowerups, freezeLeft;

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
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
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
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    while (lines >= nextPowerupAt) {
      pendingPowerups++;
      nextPowerupAt += POWERUP_EVERY;
    }
    updateHUD();
  }
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

function lockPiece() {
  if (current.powerup) {
    applyPowerup();
  } else {
    merge();
  }
  clearLines();
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
  current = next;
  next = pendingPowerups > 0 ? (pendingPowerups--, randomPowerup()) : randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
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

  // ghost
  const gy = ghostY();
  if (current.powerup) {
    drawPowerup(ctx, current.x, gy, current, BLOCK, 0.3);
  } else {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  }

  // current piece
  if (current.powerup) {
    drawPowerup(ctx, current.x, current.y, current, BLOCK);
  } else {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }

  // freeze overlay
  if (freezeLeft > 0) {
    ctx.fillStyle = 'rgba(79, 195, 247, 0.12)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
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

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
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
  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - dt);
    dropAccum = 0;
    updateHUD();
    draw();
    animId = requestAnimationFrame(loop);
    return;
  }
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
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

function init() {
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
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
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

restartBtn.addEventListener('click', init);

init();
