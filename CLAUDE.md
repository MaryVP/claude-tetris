# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A playable classic Tetris implemented in vanilla JavaScript with HTML5 Canvas and CSS — no dependencies, no build step, no package.json. The entire game is three files: `index.html`, `style.css`, `game.js`.

## Running the game

There is no build/lint/test tooling. To run:

```bash
start index.html       # Windows: open directly in the browser
```

Or serve it statically (needed for some browser security contexts):

```bash
python3 -m http.server 8000
npx serve .
```

Then open `http://localhost:8000`. There are no automated tests to run.

## Architecture

All game logic lives in `game.js` (~300 lines) as top-level functions operating on module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc. — declared once, reassigned by `init()`). There are no classes, modules, or build step — it's a single script tag.

Key pieces, in the order they matter for making changes:

- **Board model**: `board` is a `ROWS × COLS` matrix (20×10) where each cell is `0` (empty), a color index `1–8` identifying which piece type locked there, or `WILD` (`9`) — a "comodín" cell created by the tint power-up that counts as full for line clears but doesn't collide (pieces can pass through it).
- **Pieces**: `PIECES` defines the 7 standard tetrominoes plus a challenge piece, the "N" (tuerca/nut): a 3×3 ring with an empty center cell that can only be cleared once surrounding rows collapse it. Rotation is computed on the fly via `rotateCW` (transpose + reverse), not stored per-orientation.
- **Collision**: `collide(shape, ox, oy)` is the single source of truth for whether a shape placement is legal (out of bounds or overlapping locked cells). Movement, rotation, ghost-piece projection, and spawn-over-death checks all route through it.
- **Wall kicks**: `tryRotate()` rotates the current piece and, if the naive rotation collides, retries at x-offsets `[-1, 1, -2, 2]` before giving up.
- **Game loop**: `loop(ts)` runs on `requestAnimationFrame`, accumulates elapsed time in `dropAccum`, and advances the piece one row (or locks it) once `dropAccum >= dropInterval`.
- **Locking a piece**: `lockPiece()` → `merge()` (bakes the shape into `board`) or, for a power-up piece, `applyPowerup()` instead → `clearLines()` (removes full rows, updates score/level/speed, and rolls `pendingPowerups` forward every `POWERUP_EVERY` lines) → `spawn()` (promotes `next` to `current`, generates a new `next` — a power-up via `randomPowerup()` if `pendingPowerups > 0`, else a normal piece — and triggers `endGame()` if the new piece immediately collides).
- **Scoring/leveling**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 points/row, soft drop 1 point/row. Level increments every 10 lines; `dropInterval = max(100, 1000 - (level - 1) * 90)`.
- **Power-ups**: `POWERUPS` defines bomb/ray/tint/gravity/freeze. A power-up piece is a 1×1 cell (`makePowerup`) that never merges into `board` — `applyPowerup()` consumes it at the landing cell instead (3×3 clear, row/column clear via `dir` toggled by `tryRotate()`, recolor-to-`WILD` for tint, `compactBoard()` for gravity, or setting `freezeLeft` for freeze). While `freezeLeft > 0`, `loop()` counts it down instead of advancing `dropAccum`, so the piece doesn't auto-drop.
- **Rendering**: `draw()` clears and redraws the whole board canvas every frame (grid, locked blocks, ghost piece at `ghostY()` with `globalAlpha = 0.2`, then the current piece — via `drawPowerup()` instead of `drawBlock()` when it's a power-up piece — plus a translucent overlay while frozen, then `drawEffects()`). `drawNext()` renders the separate next-piece preview canvas.
- **Combo/T-spin/B2B/Perfect Clear**: `lockPiece()` calls `detectTSpin()` (3-corner rule on the T piece's 3×3 bounding box, gated on `lastActionWasRotate`) before merging, then `clearLines()` (now purely mechanical — clears rows and returns the count) feeds `applyScoring(cleared, tSpin)`. `applyScoring()` owns `combo` (increments on any clear, resets to 0 on a non-clearing lock; the line score is multiplied by it), `lastClearWasDifficult` (tracks Tetris/T-spin streaks for the `BTB_MULTIPLIER` bonus), and the Perfect Clear check (`board` fully `0`). `lastActionWasRotate` is set by `tryRotate()` on a successful rotation and cleared by horizontal moves and `spawn()`. Bonus events push to `floatingTexts` (`spawnEffect()`, drained by `updateEffects(dt)` each `loop()` tick, drawn by `drawEffects()`) and play a tone via `playTone()` (Web Audio, no assets).

Input is a single `keydown` listener at the bottom of `game.js` that dispatches to movement/rotation/drop/pause functions and is a no-op while `paused` or `gameOver`.

`index.html` just provides the two `<canvas>` elements (`board` 300×600, `next-canvas` 120×120), the HUD panel, and the pause/game-over overlay markup — all DOM lookups happen once at the top of `game.js`.

## Tunable constants (in `game.js`)

`COLS`, `ROWS`, `BLOCK` (cell size in px), `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS × BLOCK`, `ROWS × BLOCK`).

The README (in Spanish) documents controls and game mechanics in more detail.
