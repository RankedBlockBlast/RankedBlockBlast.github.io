// Pure game logic. No rendering, no I/O, no DOM. Mirrors game.py 1:1.

import { SHAPES, NEON_COLORS } from "./shapes.js";

export const GRID_SIZE = 8;
const PIECES_PER_REFILL = 3;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function newPiece() {
  return { shape: pick(SHAPES), color: pick(NEON_COLORS) };
}

export class Game {
  constructor() {
    this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    this.score = 0;
    this.highScore = 0;
    this.pieces = [newPiece(), newPiece(), newPiece()];
    this.gameOver = false;
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
      this.pieces = [newPiece(), newPiece(), newPiece()];
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
    this.pieces = [newPiece(), newPiece(), newPiece()];
    this.gameOver = false;
  }
}
