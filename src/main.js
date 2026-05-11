// Entry point — event loop and screen state machine.
// States: "home" -> "game" -> "game_over" -> "home"

import { Game } from "./game.js";
import { Renderer, WINDOW_W, WINDOW_H, GRID_BOTTOM_CENTER_Y } from "./renderer.js";
import { Audio } from "./audio.js";

const canvas = document.getElementById("game");

// Fit canvas to viewport while keeping the internal WINDOW_W x WINDOW_H coordinate system.
// Internal bitmap stays at WINDOW_W*dpr so rendering quality doesn't drop on shrink.
function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.min(window.innerWidth / WINDOW_W, window.innerHeight / WINDOW_H);
  canvas.width = WINDOW_W * dpr;
  canvas.height = WINDOW_H * dpr;
  canvas.style.width = WINDOW_W * scale + "px";
  canvas.style.height = WINDOW_H * scale + "px";
  canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
}
fitCanvas();
window.addEventListener("resize", fitCanvas);
window.addEventListener("orientationchange", fitCanvas);

const game = new Game();
const renderer = new Renderer(canvas);
const audio = new Audio();

let state = "home";
let drag = null;
let mousePos = { x: 0, y: 0 };


function eventPos(ev) {
  const rect = canvas.getBoundingClientRect();
  const t = (ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]) || ev;
  const sx = WINDOW_W / rect.width;
  const sy = WINDOW_H / rect.height;
  return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
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
    } else if (hit === "multi") {
      audio.play("pick");
      state = "multiplayer";
    } else if (hit !== null) {
      audio.play("invalid");
    }
    return;
  }

  if (state === "multiplayer") {
    const hit = renderer.hitMultiplayerButton(pos);
    if (hit === "back") {
      audio.play("pick");
      state = "home";
    } else if (hit !== null) {
      audio.play("invalid");
    }
    return;
  }

  if (state === "game" && drag === null) {
    if (renderer.hitTitleButton(pos)) {
      audio.play("pick");
      state = "confirm_quit";
      return;
    }
    const idx = renderer.trayPieceAt(pos.x, pos.y, game);
    if (idx !== null) {
      // Lift the piece up so its anchor sits at the grid's bottom row.
      // Remember the offset (finger -> piece) so the piece keeps that gap
      // as the finger moves up.
      const liftOffset = Math.max(0, pos.y - GRID_BOTTOM_CENTER_Y);
      const ly = pos.y - liftOffset;
      drag = {
        pieceIndex: idx,
        piece: game.pieces[idx],
        mouse: [pos.x, ly],
        liftOffset,
        origin: renderer.placementOrigin(game.pieces[idx], renderer.cellAt(pos.x, ly)),
      };
      audio.play("pick");
    }
    return;
  }

  if (state === "confirm_quit") {
    const hit = renderer.hitConfirmButton(pos);
    if (hit === "yes") {
      audio.play("pick");
      renderer.resetAnimations();
      drag = null;
      state = "home";
    } else if (hit === "no") {
      audio.play("pick");
      state = "game";
    } else if (hit !== null) {
      audio.play("invalid");
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
    const ly = pos.y - drag.liftOffset;
    drag.mouse = [pos.x, ly];
    const cell = renderer.cellAt(pos.x, ly);
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
  if (ev.key === "Escape") {
    if (state === "confirm_quit") {
      state = "game";
    } else if (state !== "home") {
      drag = null;
      renderer.resetAnimations();
      state = "home";
    }
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
  } else if (state === "multiplayer") {
    renderer.drawMultiplayer(mousePos);
  } else {
    renderer.draw(game, drag);
    if (state === "game_over") renderer.drawDeathScreen(game, mousePos);
    else if (state === "confirm_quit") renderer.drawConfirmQuit(mousePos);
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
