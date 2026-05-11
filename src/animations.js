// Visual animation state — pure data + timing. Renderer draws them.

function easeOutCubic(p) { return 1 - (1 - p) ** 3; }
function easeInQuad(p) { return p * p; }

export class PlacePop {
  static GROW = 0.18;
  static SETTLE = 0.14;
  static RIPPLE_STEP = 0.045;

  constructor(cells, color, anchor) {
    this.cells = cells.slice();
    this.color = color;
    this.anchor = anchor;
    this.elapsed = 0;
    let maxDist = 0;
    for (const [r, c] of this.cells) {
      const d = Math.max(Math.abs(r - anchor[0]), Math.abs(c - anchor[1]));
      if (d > maxDist) maxDist = d;
    }
    this.duration = PlacePop.GROW + PlacePop.SETTLE + maxDist * PlacePop.RIPPLE_STEP;
  }

  update(dt) { this.elapsed += dt; }
  get done() { return this.elapsed >= this.duration; }

  cellState(cell) {
    const dist = Math.max(Math.abs(cell[0] - this.anchor[0]), Math.abs(cell[1] - this.anchor[1]));
    const t = this.elapsed - dist * PlacePop.RIPPLE_STEP;
    if (t <= 0) return null;
    if (t < PlacePop.GROW) {
      const p = t / PlacePop.GROW;
      const e = easeOutCubic(p);
      return [e * 1.18, e];
    }
    if (t < PlacePop.GROW + PlacePop.SETTLE) {
      const p = (t - PlacePop.GROW) / PlacePop.SETTLE;
      return [1.18 - 0.18 * p, 1.0 - p];
    }
    return [1.0, 0.0];
  }
}

export class LineClear {
  static FLASH = 0.12;
  static FADE = 0.35;

  constructor(cellsWithColor) {
    this.cells = cellsWithColor.slice();
    this.elapsed = 0;
    this.duration = LineClear.FLASH + LineClear.FADE;
  }

  update(dt) { this.elapsed += dt; }
  get done() { return this.elapsed >= this.duration; }

  state() {
    const t = this.elapsed;
    if (t < LineClear.FLASH) {
      const p = t / LineClear.FLASH;
      return [1.0 + p * 0.2, 1.0, p];
    }
    const p = Math.min(1.0, (t - LineClear.FLASH) / LineClear.FADE);
    const eased = easeInQuad(p);
    return [1.2 + eased * 0.7, 1.0 - eased, 1.0 - p * 0.7];
  }
}
