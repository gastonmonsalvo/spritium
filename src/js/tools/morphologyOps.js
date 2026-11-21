/**
 * morphologyOps.js: Contorno morfológico (+1px / -1px) y desplazamiento toroidal (Wrap / Seamless).
 */

import { state, pushState, pushLayerState, getGridDims } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { isActiveLayerLocked } from "../workspace/layers.js";
import { reconcileActiveTilemapLayer } from "../workspace/tilemap.js";
import { isInsideSelection } from "./tools.js";

/** Agrega un contorno de 1px (4-conectado) alrededor de píxeles opacos usando el color activo. */
export function applyOutline() {
  if (isActiveLayerLocked()) return 0;
  const outlineColor = state.currentColorIndex || 1;
  const { w: gw, h: gh } = getGridDims();
  const toOutline = [];

  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (state.grid[y]?.[x] !== 0 || !isInsideSelection(x, y)) continue;
      const hasOpaque = (y > 0 && state.grid[y - 1][x] !== 0) || (y < gh - 1 && state.grid[y + 1][x] !== 0) ||
        (x > 0 && state.grid[y][x - 1] !== 0) || (x < gw - 1 && state.grid[y][x + 1] !== 0);
      if (hasOpaque) toOutline.push([x, y]);
    }
  }
  if (toOutline.length === 0) return 0;
  pushState();
  for (const [x, y] of toOutline) state.grid[y][x] = outlineColor;
  state.isDirtySinceImport = true;
  reconcileActiveTilemapLayer("auto");
  renderAll();
  return toOutline.length;
}

/** Elimina 1px del borde exterior (erosión morfológica 4-conectada) en la selección o capa activa. */
export function erodeOutline() {
  if (isActiveLayerLocked()) return 0;
  const { w: gw, h: gh } = getGridDims();
  const toRemove = [];

  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (!state.grid[y]?.[x] || !isInsideSelection(x, y)) continue;
      const touchesZero = y === 0 || y === gh - 1 || x === 0 || x === gw - 1 ||
        state.grid[y - 1][x] === 0 || state.grid[y + 1][x] === 0 ||
        state.grid[y][x - 1] === 0 || state.grid[y][x + 1] === 0;
      if (touchesZero) toRemove.push([x, y]);
    }
  }
  if (toRemove.length === 0) return 0;
  pushState();
  for (const [x, y] of toRemove) state.grid[y][x] = 0;
  state.isDirtySinceImport = true;
  reconcileActiveTilemapLayer("auto");
  renderAll();
  return toRemove.length;
}

/** Desplaza la capa activa (o selección rectangular) de forma toroidal (Wrap / Seamless). */
export function shiftCanvasWrap(dx, dy) {
  if (isActiveLayerLocked()) return false;
  const { w: gw, h: gh } = getGridDims();
  if (gw <= 0 || gh <= 0) return false;
  const sel = state.selection;
  const rx = sel ? Math.max(0, sel.x) : 0, ry = sel ? Math.max(0, sel.y) : 0;
  const rw = sel ? Math.min(gw - rx, sel.w) : gw, rh = sel ? Math.min(gh - ry, sel.h) : gh;
  if (rw <= 0 || rh <= 0) return false;

  pushLayerState();
  const activeLayer = state.layers?.[state.activeLayerIndex];
  const src = state.grid.map((row) => [...row]);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const sx = (((x - dx) % rw) + rw) % rw, sy = (((y - dy) % rh) + rh) % rh;
      state.grid[ry + y][rx + x] = src[ry + sy][rx + sx];
    }
  }
  if (activeLayer) activeLayer.grid = state.grid;
  reconcileActiveTilemapLayer("auto");
  renderAll();
  return true;
}
