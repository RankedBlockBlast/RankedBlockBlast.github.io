// Entry point — event loop and screen state machine.
// States: "home" -> "game" -> "game_over" -> "home"

import { Game } from "./game.js";
import { Renderer, WINDOW_W, WINDOW_H } from "./renderer.js";
import { Audio } from "./audio.js";

const canvas = document.getElementById("game");

// scale canvas for high-DPI displays
const dpr = window.devicePixelRatio || 1;
canvas.width = WINDOW_W * dpr;
canvas.height = WINDOW_H * dpr;
canvas.style.width = WINDOW_W + "px";
canvas.style.height = WINDOW_H + "px";
canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);

const game = new Game();
const renderer = new Renderer(canvas);
const audio = new Audio();

let state = "home";
let drag = null;
let mousePos = { x: 0, y: 0 };

function eventPos(ev) {
  const rect = canvas.getBoundingClientRect();
  const t = ev.touches ? ev.touches[0] : ev;
  return { x: t.clientX - rect.left, y: t.clientY - rect.top };
}

function onMouseDown(ev) {
  ev.preventDefault();
  audio.init(); // satisfy autoplay gesture requirement on first click
  const pos = eventPos(ev);
  mousePos = pos;

  if (state === "home") {
    const hit = renderer.hitHomeButton(pos);
    if (hit === "single") {
      game.reset();
      renderer.resetAnimations();
      drag = null;
      audio.play("pick");
      state = "game";
    } else if (hit !== null) {
      audio.play("invalid");
    }
    return;
  }

  if (state === "game" && drag === null) {
    const idx = renderer.trayPieceAt(pos.x, pos.y, game);
    if (idx !== null) {
      drag = {
        pieceIndex: idx,
        piece: game.pieces[idx],
        mouse: [pos.x, pos.y],
        origin: null,
      };
      audio.play("pick");
    }
    return;
  }

  if (state === "game_over") {
    if (renderer.hitContinueButton(pos)) {
      audio.play("pick");
      renderer.resetAnimations();
      drag = null;
      state = "home";
    }
  }
}

function onMouseMove(ev) {
  const pos = eventPos(ev);
  mousePos = pos;
  if (state === "game" && drag !== null) {
    drag.mouse = [pos.x, pos.y];
    const cell = renderer.cellAt(pos.x, pos.y);
    drag.origin = renderer.placementOrigin(drag.piece, cell);
  }
}

function onMouseUp(ev) {
  if (state !== "game" || drag === null) return;
  ev.preventDefault();
  let placedEvent = null;
  if (drag.origin !== null) {
    placedEvent = game.place(drag.pieceIndex, drag.origin[0], drag.origin[1]);
  }
  if (placedEvent !== null) {
    audio.play("place");
    renderer.onEvent(placedEvent);
    if (placedEvent.clearedCells.length) {
      const lines = placedEvent.clearedRows.length + placedEvent.clearedCols.length;
      audio.play(lines >= 2 ? "multi_clear" : "clear");
    }
  } else {
    audio.play("invalid");
  }
  drag = null;
}

canvas.addEventListener("mousedown", onMouseDown);
canvas.addEventListener("mousemove", onMouseMove);
window.addEventListener("mouseup", onMouseUp);

// touch support (mobile)
canvas.addEventListener("touchstart", (ev) => { onMouseDown(ev); }, { passive: false });
canvas.addEventListener("touchmove", (ev) => { ev.preventDefault(); onMouseMove(ev); }, { passive: false });
canvas.addEventListener("touchend", (ev) => { ev.preventDefault(); onMouseUp(ev); }, { passive: false });

// ESC -> back to home from game/game_over
window.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && state !== "home") {
    drag = null;
    renderer.resetAnimations();
    state = "home";
  }
});

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  renderer.update(dt);

  if (state === "game" && game.gameOver && renderer.animations.length === 0) {
    state = "game_over";
    audio.play("game_over");
  }

  if (state === "home") {
    renderer.drawHome(mousePos);
  } else {
    renderer.draw(game, drag);
    if (state === "game_over") renderer.drawDeathScreen(game, mousePos);
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
