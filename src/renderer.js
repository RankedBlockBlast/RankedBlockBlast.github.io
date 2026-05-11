// Canvas 2D renderer — neon / sci-fi aesthetic.
// Mirrors renderer.py. Game logic stays in game.js.

import { PlacePop, LineClear } from "./animations.js";

const GRID_SIZE = 8;
const CELL = 56;
const GRID_PX = GRID_SIZE * CELL;
const MARGIN_X = 56;
const HUD_HEIGHT = 120;
const TRAY_HEIGHT = 200;

export const WINDOW_W = GRID_PX + 2 * MARGIN_X;
export const WINDOW_H = HUD_HEIGHT + GRID_PX + TRAY_HEIGHT;

const GRID_TOP = HUD_HEIGHT;
const GRID_LEFT = MARGIN_X;
const TRAY_TOP = GRID_TOP + GRID_PX + 24;

const BG = [5, 1, 15];
const GRID_LINE = [40, 30, 80];
const EMPTY_CELL = [12, 8, 28];
const HUD_CYAN = [0, 240, 255];
const HUD_MAGENTA = [255, 0, 229];
const INVALID = [255, 50, 80];

const BUTTON_W = 280;
const BUTTON_H = 56;
const BUTTON_GAP = 18;

const BTN_CYAN = [0, 240, 255];
const BTN_PURPLE = [177, 74, 237];
const BTN_MUTED = [170, 190, 230];

const _anchorCache = new Map();
function anchorCell(shape) {
  const key = shape.map((p) => p.join(",")).join("|");
  const cached = _anchorCache.get(key);
  if (cached) return cached;
  const set = new Set(shape.map((p) => p.join(",")));
  const counts = [];
  for (const [r, c] of shape) {
    let n = 0;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      if (set.has(`${r + dr},${c + dc}`)) n++;
    }
    counts.push([[r, c], n]);
  }
  const best = Math.max(...counts.map(([, n]) => n));
  const candidates = counts.filter(([, n]) => n === best).map(([cell]) => cell);
  let anchor;
  if (candidates.length === 1) {
    anchor = candidates[0];
  } else {
    let cr = 0, cc = 0;
    for (const [r, c] of shape) { cr += r; cc += c; }
    cr /= shape.length; cc /= shape.length;
    anchor = candidates.reduce((a, b) => {
      const da = (a[0] - cr) ** 2 + (a[1] - cc) ** 2;
      const db = (b[0] - cr) ** 2 + (b[1] - cc) ** 2;
      return da <= db ? a : b;
    });
  }
  _anchorCache.set(key, anchor);
  return anchor;
}

function rgb(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function font(size) { return `bold ${size}px ui-monospace, "Courier New", monospace`; }

function rectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

function rectIn(rect, x, y) {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.t = 0;
    this._blockCache = new Map();
    this._scanlines = this._buildScanlines();
    this.animations = [];
    this._homeButtons = this._layoutHomeButtons();
    this._continueButton = this._layoutContinueButton();
  }

  _layoutHomeButtons() {
    const firstY = 380;
    const specs = [
      ["single", "SINGLE PLAYER", BTN_CYAN],
      ["multi", "MULTIPLAYER", BTN_PURPLE],
      ["settings", "SETTINGS", BTN_MUTED],
    ];
    const result = {};
    specs.forEach(([key, label, color], i) => {
      const x = Math.floor(WINDOW_W / 2 - BUTTON_W / 2);
      const y = firstY + i * (BUTTON_H + BUTTON_GAP);
      result[key] = { rect: { x, y, w: BUTTON_W, h: BUTTON_H }, label, color };
    });
    return result;
  }

  _layoutContinueButton() {
    const x = Math.floor(WINDOW_W / 2 - BUTTON_W / 2);
    const y = Math.floor(WINDOW_H / 2) + 80;
    return { x, y, w: BUTTON_W, h: BUTTON_H };
  }

  hitHomeButton(pos) {
    for (const [key, { rect }] of Object.entries(this._homeButtons)) {
      if (rectIn(rect, pos.x, pos.y)) return key;
    }
    return null;
  }

  hitContinueButton(pos) {
    return rectIn(this._continueButton, pos.x, pos.y);
  }

  resetAnimations() {
    this.animations.length = 0;
  }

  update(dt) {
    this.t += dt;
    for (const a of this.animations) a.update(dt);
    this.animations = this.animations.filter((a) => !a.done);
  }

  onEvent(event) {
    if (!event) return;
    const clearedSet = new Set(event.clearedCells.map(([cell]) => cell.join(",")));
    const placedOnly = event.placedCells.filter(([r, c]) => !clearedSet.has(`${r},${c}`));
    if (placedOnly.length) {
      let cr = 0, cc = 0;
      for (const [r, c] of placedOnly) { cr += r; cc += c; }
      cr = Math.floor(cr / placedOnly.length);
      cc = Math.floor(cc / placedOnly.length);
      this.animations.push(new PlacePop(placedOnly, event.placedColor, [cr, cc]));
    }
    if (event.clearedCells.length) {
      this.animations.push(new LineClear(event.clearedCells));
    }
  }

  // ---------- public draw ----------

  draw(game, drag) {
    const ctx = this.ctx;
    ctx.fillStyle = rgb(BG);
    ctx.fillRect(0, 0, WINDOW_W, WINDOW_H);
    ctx.drawImage(this._scanlines, 0, 0);
    this._drawHud(game);
    this._drawGrid(game, drag);
    this._drawTray(game, drag);
  }

  drawHome(mousePos) {
    const ctx = this.ctx;
    ctx.fillStyle = rgb(BG);
    ctx.fillRect(0, 0, WINDOW_W, WINDOW_H);
    ctx.drawImage(this._scanlines, 0, 0);

    const pulse = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(this.t * 2.2));

    this._drawGlowText("R A N K E D", WINDOW_W / 2, 130, HUD_CYAN, font(22), "center");

    // pulsing ghost layers behind the title
    ctx.font = font(64);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = (120 * pulse) / 255;
    ctx.fillStyle = rgb(HUD_MAGENTA);
    for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) {
      ctx.fillText("BLOCK  BLAST", WINDOW_W / 2 + dx, 210 + dy);
    }
    ctx.globalAlpha = 1;

    this._drawGlowText("BLOCK  BLAST", WINDOW_W / 2, 210, HUD_MAGENTA, font(64), "center", 22);

    ctx.font = font(16);
    ctx.fillStyle = rgb([160, 180, 220]);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("// NEON  PUZZLE  //", WINDOW_W / 2, 285);

    for (const { rect, label, color } of Object.values(this._homeButtons)) {
      this._drawButton(rect, label, color, rectIn(rect, mousePos.x, mousePos.y));
    }

    ctx.font = font(16);
    ctx.fillStyle = rgb([90, 100, 140]);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("v 0 . 1", WINDOW_W / 2, WINDOW_H - 32);
  }

  drawDeathScreen(game, mousePos) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.82)";
    ctx.fillRect(0, 0, WINDOW_W, WINDOW_H);

    this._drawGlowText("GAME OVER", WINDOW_W / 2, WINDOW_H / 2 - 110,
      [255, 42, 109], font(64), "center", 18);

    ctx.font = font(16);
    ctx.fillStyle = rgb([180, 200, 255]);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("FINAL SCORE", WINDOW_W / 2, WINDOW_H / 2 - 30);

    this._drawGlowText(String(game.score), WINDOW_W / 2, WINDOW_H / 2 + 15,
      HUD_MAGENTA, font(56), "center", 16);

    ctx.font = font(16);
    ctx.fillStyle = rgb(HUD_CYAN);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`HI  ${game.highScore}`, WINDOW_W / 2, WINDOW_H / 2 + 55);

    this._drawButton(
      this._continueButton,
      "CONTINUE",
      HUD_CYAN,
      rectIn(this._continueButton, mousePos.x, mousePos.y),
    );
  }

  _drawButton(rect, label, color, hovered) {
    const ctx = this.ctx;
    const inflate = hovered ? 14 : 8;
    // glow halo
    const layers = [[28, 12], [60, 7], [hovered ? 110 : 50, 2]];
    for (const [alpha, expand] of layers) {
      ctx.fillStyle = rgba(color, alpha / 255);
      rectPath(ctx, rect.x - expand, rect.y - expand,
        rect.w + expand * 2, rect.h + expand * 2, 12);
      ctx.fill();
    }
    // body
    ctx.fillStyle = hovered ? "rgb(20,14,38)" : "rgb(12,8,28)";
    rectPath(ctx, rect.x, rect.y, rect.w, rect.h, 8);
    ctx.fill();
    ctx.strokeStyle = rgb(color);
    ctx.lineWidth = hovered ? 2 : 1;
    rectPath(ctx, rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1, 8);
    ctx.stroke();
    // label
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    if (hovered) {
      this._drawGlowText(label, cx, cy, color, font(22), "center", 12);
    } else {
      ctx.font = font(22);
      ctx.fillStyle = rgb(color);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx, cy);
    }
  }

  // ---------- hit testing ----------

  cellAt(mx, my) {
    if (mx < GRID_LEFT || mx >= GRID_LEFT + GRID_PX) return null;
    if (my < GRID_TOP || my >= GRID_TOP + GRID_PX) return null;
    return [Math.floor((my - GRID_TOP) / CELL), Math.floor((mx - GRID_LEFT) / CELL)];
  }

  trayPieceAt(mx, my, game) {
    if (my < TRAY_TOP || my > TRAY_TOP + 160) return null;
    const slotW = Math.floor((WINDOW_W - 2 * MARGIN_X) / 3);
    for (let i = 0; i < game.pieces.length; i++) {
      if (!game.pieces[i]) continue;
      const sx = MARGIN_X + i * slotW;
      if (mx >= sx && mx <= sx + slotW) return i;
    }
    return null;
  }

  placementOrigin(piece, mouseCell) {
    if (!piece || !mouseCell) return null;
    const [ar, ac] = anchorCell(piece.shape);
    return [mouseCell[0] - ar, mouseCell[1] - ac];
  }

  // ---------- hud / grid / tray ----------

  _drawHud(game) {
    const ctx = this.ctx;
    this._drawGlowText("RANKED  BLOCK  BLAST", MARGIN_X, 44, HUD_CYAN, font(22), "left", 14);

    this._drawGlowText(String(game.score), WINDOW_W - MARGIN_X, 48, HUD_MAGENTA,
      font(56), "right", 16);

    ctx.font = font(16);
    ctx.fillStyle = rgb([180, 200, 255]);
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`HI  ${game.highScore}`, WINDOW_W - MARGIN_X, 86);
  }

  _drawGrid(game, drag) {
    const ctx = this.ctx;
    // base cells
    ctx.fillStyle = rgb(EMPTY_CELL);
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        ctx.fillRect(GRID_LEFT + c * CELL, GRID_TOP + r * CELL, CELL, CELL);
      }
    }
    ctx.strokeStyle = rgb(GRID_LINE);
    ctx.lineWidth = 1;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        ctx.strokeRect(GRID_LEFT + c * CELL + 0.5, GRID_TOP + r * CELL + 0.5, CELL - 1, CELL - 1);
      }
    }

    // cells covered by an active PlacePop are drawn by the animation
    const popCells = new Set();
    for (const a of this.animations) {
      if (a instanceof PlacePop) for (const [r, c] of a.cells) popCells.add(`${r},${c}`);
    }

    // placed blocks with gentle pulse
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const color = game.grid[r][c];
        if (!color || popCells.has(`${r},${c}`)) continue;
        const pulse = 0.85 + 0.15 * Math.sin(this.t * 3 + (r + c) * 0.4);
        const x = GRID_LEFT + c * CELL;
        const y = GRID_TOP + r * CELL;
        this._blitBlock(x, y, color, CELL, pulse);
      }
    }

    // animation overlays
    for (const a of this.animations) {
      if (a instanceof PlacePop) this._drawPlacePop(a);
      else if (a instanceof LineClear) this._drawLineClear(a);
    }

    // ghost preview while dragging
    if (drag && drag.origin) {
      const piece = drag.piece;
      const [r0, c0] = drag.origin;
      const valid = game.canPlace(piece, r0, c0);
      const ghostColor = valid ? piece.color : INVALID;
      for (const [dr, dc] of piece.shape) {
        const r = r0 + dr, c = c0 + dc;
        if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) continue;
        const x = GRID_LEFT + c * CELL;
        const y = GRID_TOP + r * CELL;
        this._blitBlock(x, y, ghostColor, CELL, 0.35);
      }
    }
  }

  _drawPlacePop(anim) {
    for (const cell of anim.cells) {
      const state = anim.cellState(cell);
      if (!state) continue;
      const [scale, flash] = state;
      const [r, c] = cell;
      const cx = GRID_LEFT + c * CELL + CELL / 2;
      const cy = GRID_TOP + r * CELL + CELL / 2;
      const size = Math.max(1, Math.floor(CELL * scale));
      this._blitBlock(cx - size / 2, cy - size / 2, anim.color, size, 1.0);
      if (flash > 0.01) {
        this.ctx.fillStyle = `rgba(255,255,255,${(160 * flash) / 255})`;
        this.ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      }
    }
  }

  _drawLineClear(anim) {
    const [scale, alpha, white] = anim.state();
    const size = Math.max(1, Math.floor(CELL * scale));
    for (const [[r, c], color] of anim.cells) {
      const cx = GRID_LEFT + c * CELL + CELL / 2;
      const cy = GRID_TOP + r * CELL + CELL / 2;
      this._blitBlock(cx - size / 2, cy - size / 2, color, size, alpha);
      if (white > 0.01) {
        this.ctx.fillStyle = `rgba(255,255,255,${(220 * white * alpha) / 255})`;
        this.ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      }
    }
  }

  _drawTray(game, drag) {
    const slotW = Math.floor((WINDOW_W - 2 * MARGIN_X) / 3);
    const slotCenterY = TRAY_TOP + 80;
    const dragging = drag ? drag.pieceIndex : null;
    for (let i = 0; i < game.pieces.length; i++) {
      const piece = game.pieces[i];
      if (!piece || i === dragging) continue;
      const cx = MARGIN_X + i * slotW + slotW / 2;
      this._drawPieceCentered(piece, cx, slotCenterY, Math.floor(CELL * 0.55));
    }

    if (drag) {
      const [mx, my] = drag.mouse;
      this._drawPieceAnchored(drag.piece, mx, my, CELL);
    }
  }

  _drawPieceCentered(piece, cx, cy, cell) {
    const rows = piece.shape.map(([r]) => r);
    const cols = piece.shape.map(([, c]) => c);
    const minR = Math.min(...rows), maxR = Math.max(...rows);
    const minC = Math.min(...cols), maxC = Math.max(...cols);
    const w = (maxC - minC + 1) * cell;
    const h = (maxR - minR + 1) * cell;
    const ox = cx - w / 2;
    const oy = cy - h / 2;
    for (const [dr, dc] of piece.shape) {
      const x = ox + (dc - minC) * cell + cell / 2;
      const y = oy + (dr - minR) * cell + cell / 2;
      this._blitBlock(x - cell / 2, y - cell / 2, piece.color, cell, 1.0);
    }
  }

  _drawPieceAnchored(piece, mouseX, mouseY, cell) {
    const [ar, ac] = anchorCell(piece.shape);
    for (const [dr, dc] of piece.shape) {
      const x = mouseX + (dc - ac) * cell;
      const y = mouseY + (dr - ar) * cell;
      this._blitBlock(x - cell / 2, y - cell / 2, piece.color, cell, 1.0);
    }
  }

  // ---------- low-level block drawing ----------

  _blitBlock(x, y, color, size, alpha) {
    const key = `${color[0]},${color[1]},${color[2]}|${size}`;
    let surf = this._blockCache.get(key);
    if (!surf) {
      surf = this._buildBlockSurface(color, size);
      this._blockCache.set(key, surf);
    }
    const prevAlpha = this.ctx.globalAlpha;
    this.ctx.globalAlpha = prevAlpha * alpha;
    this.ctx.drawImage(surf, x - size / 2, y - size / 2);
    this.ctx.globalAlpha = prevAlpha;
  }

  _buildBlockSurface(color, size) {
    const surf = document.createElement("canvas");
    surf.width = size * 2;
    surf.height = size * 2;
    const c = surf.getContext("2d");
    const pad = Math.floor(size / 2);
    // outer glow halos
    const haloes = [[22, 15], [40, 10], [80, 5]];
    for (const [a, expand] of haloes) {
      c.fillStyle = rgba(color, a / 255);
      rectPath(c, pad - expand, pad - expand, size + expand * 2, size + expand * 2, 10);
      c.fill();
    }
    // core
    c.fillStyle = rgb(color);
    rectPath(c, pad + 2, pad + 2, size - 4, size - 4, 6);
    c.fill();
    // inner brighter border
    const br = [
      Math.min(255, Math.floor(color[0] * 0.4) + 140),
      Math.min(255, Math.floor(color[1] * 0.4) + 140),
      Math.min(255, Math.floor(color[2] * 0.4) + 140),
    ];
    c.strokeStyle = rgb(br);
    c.lineWidth = 2;
    rectPath(c, pad + 5, pad + 5, size - 10, size - 10, 5);
    c.stroke();
    // top highlight bar
    c.fillStyle = "rgba(255,255,255,0.27)";
    rectPath(c, pad + 6, pad + 6, size - 12, Math.max(2, Math.floor(size / 6)), 3);
    c.fill();
    return surf;
  }

  // ---------- text glow ----------

  _drawGlowText(text, x, y, color, fontStr, align, blur = 14) {
    const ctx = this.ctx;
    ctx.font = fontStr;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = rgb(color);
    ctx.shadowColor = rgb(color);
    ctx.shadowBlur = blur;
    ctx.fillText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  // ---------- scanline overlay (static) ----------

  _buildScanlines() {
    const surf = document.createElement("canvas");
    surf.width = WINDOW_W;
    surf.height = WINDOW_H;
    const c = surf.getContext("2d");
    c.fillStyle = "rgba(255,255,255,0.031)";
    for (let y = 0; y < WINDOW_H; y += 3) c.fillRect(0, y, WINDOW_W, 1);
    for (let i = 0; i < 60; i++) {
      const a = (40 * (1 - i / 60)) / 255;
      c.fillStyle = `rgba(0,200,255,${a})`;
      c.fillRect(0, i, WINDOW_W, 1);
    }
    return surf;
  }
}
