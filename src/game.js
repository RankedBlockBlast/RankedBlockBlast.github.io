// Pure game logic. No rendering, no I/O, no DOM. Mirrors game.py 1:1.

import { SHAPES, NEON_COLORS } from "./shapes.js";

export const GRID_SIZE = 8;
const PIECES_PER_REFILL = 3;

// Difficulty assist: bias new pieces toward shapes that can clear lines.
// Starts generous, decays each time the assist actually fires.
const PERFECT_START = 0.5;
const PERFECT_FLOOR = 0.2;
const PERFECT_DECAY = 0.03;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class Game {
  constructor() {
    this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    this.score = 0;
    this.highScore = 0;
    this.perfectChance = PERFECT_START;
    this.pieces = [this._makePiece(), this._makePiece(), this._makePiece()];
    this.gameOver = false;
  }

  _makePiece() {
    let shape = null;
    if (Math.random() < this.perfectChance) {
      shape = this._findPerfectShape();
      if (shape) {
        this.perfectChance = Math.max(PERFECT_FLOOR, this.perfectChance - PERFECT_DECAY);
      }
    }
    if (!shape) shape = pick(SHAPES);
    return { shape, color: pick(NEON_COLORS) };
  }

  // Shape whose best placement clears the most lines (>=1). null if none.
  _findPerfectShape() {
    let bestLines = 0;
    let candidates = [];
    for (const shape of SHAPES) {
      let shapeBest = 0;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (!this.canPlace({ shape }, r, c)) continue;
          const lines = this._linesIfPlaced(shape, r, c);
          if (lines > shapeBest) shapeBest = lines;
        }
      }
      if (shapeBest > bestLines) { bestLines = shapeBest; candidates = [shape]; }
      else if (shapeBest === bestLines && bestLines > 0) candidates.push(shape);
    }
    return candidates.length ? pick(candidates) : null;
  }

  _linesIfPlaced(shape, row, col) {
    const placed = new Set();
    for (const [dr, dc] of shape) placed.add(`${row + dr},${col + dc}`);
    let count = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      let full = true;
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c] === null && !placed.has(`${r},${c}`)) { full = false; break; }
      }
      if (full) count++;
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      let full = true;
      for (let r = 0; r < GRID_SIZE; r++) {
        if (this.grid[r][c] === null && !placed.has(`${r},${c}`)) { full = false; break; }
      }
      if (full) count++;
    }
    return count;
  }

  canPlace(piece, row, col) {
    if (!piece) return false;
    for (const [dr, dc] of piece.shape) {
      const r = row + dr, c = col + dc;
      if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false;
      if (this.grid[r][c] !== null) return false;
    }
    return true;
  }

  place(pieceIndex, row, col) {
    if (pieceIndex < 0 || pieceIndex >= this.pieces.length) return null;
    const piece = this.pieces[pieceIndex];
    if (!piece || !this.canPlace(piece, row, col)) return null;

    const placedCells = [];
    for (const [dr, dc] of piece.shape) {
      const r = row + dr, c = col + dc;
      this.grid[r][c] = piece.color;
      placedCells.push([r, c]);
    }
    this.pieces[pieceIndex] = null;

    const { clearedRows, clearedCols, clearedCells } = this._clearLines();

    const cellsPlaced = piece.shape.length;
    const lines = clearedRows.length + clearedCols.length;
    const lineScore = lines > 0 ? lines * 10 * lines : 0;
    const gained = cellsPlaced + lineScore;
    this.score += gained;
    if (this.score > this.highScore) this.highScore = this.score;

    if (this.pieces.every((p) => p === null)) {
      this.pieces = [this._makePiece(), this._makePiece(), this._makePiece()];
    }

    if (this._noMovesAvailable()) this.gameOver = true;

    return {
      placedCells,
      placedColor: piece.color,
      clearedRows,
      clearedCols,
      clearedCells,
      gained,
    };
  }

  _clearLines() {
    const fullRows = [];
    const fullCols = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      if (this.grid[r].every((v) => v !== null)) fullRows.push(r);
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      let full = true;
      for (let r = 0; r < GRID_SIZE; r++) {
        if (this.grid[r][c] === null) { full = false; break; }
      }
      if (full) fullCols.push(c);
    }
    const cleared = new Map();
    for (const r of fullRows) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c] !== null) cleared.set(`${r},${c}`, [[r, c], this.grid[r][c]]);
      }
    }
    for (const c of fullCols) {
      for (let r = 0; r < GRID_SIZE; r++) {
        if (this.grid[r][c] !== null) cleared.set(`${r},${c}`, [[r, c], this.grid[r][c]]);
      }
    }
    for (const r of fullRows) for (let c = 0; c < GRID_SIZE; c++) this.grid[r][c] = null;
    for (const c of fullCols) for (let r = 0; r < GRID_SIZE; r++) this.grid[r][c] = null;
    return {
      clearedRows: fullRows,
      clearedCols: fullCols,
      clearedCells: Array.from(cleared.values()),
    };
  }

  _noMovesAvailable() {
    for (const piece of this.pieces) {
      if (!piece) continue;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (this.canPlace(piece, r, c)) return false;
        }
      }
    }
    return true;
  }

  reset() {
    const prevHigh = this.highScore;
    this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    this.score = 0;
    this.highScore = prevHigh;
    this.perfectChance = PERFECT_START;
    this.pieces = [this._makePiece(), this._makePiece(), this._makePiece()];
    this.gameOver = false;
  }
}
