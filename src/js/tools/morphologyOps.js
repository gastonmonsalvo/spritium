/**
 * morphologyOps.js: Contorno morfológico (+1px / -1px) y desplazamiento toroidal (Wrap / Seamless).
 */

import { state, pushState, pushLayerState, getGridDims } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { isActiveLayerLocked } from "../workspace/layers.js";
import { reconcileActiveTilemapLayer } from "../workspace/tilemap.js";
import { isInsideSelection } from "./tools.js";

export const FOUR_WAY_DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
export const EIGHT_WAY_DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/**
 * Calcula las coordenadas `[x, y]` que recibirán contorno según direcciones, grosor y modo.
 * @param {number[][]} grid
 * @param {number} gw
 * @param {number} gh
 * @param {{ dirs?: number[][], thickness?: number, mode?: "outside"|"inside", respectSelection?: boolean }} [options]
 * @returns {Array<[number, number]>}
 */
export function computeOutlineCells(grid, gw, gh, { dirs = FOUR_WAY_DIRS, thickness = 1, mode = "outside", respectSelection = true } = {}) {
  if (!grid || gw <= 0 || gh <= 0 || !dirs?.length) return [];
  const steps = Math.max(1, Math.min(8, Math.round(Number(thickness) || 1)));
  const work = grid.map((row) => [...row]);
  const added = [];
  const seen = new Set();
  const canEdit = (x, y) => !respectSelection || isInsideSelection(x, y);

  for (let step = 0; step < steps; step++) {
    const passCells = [];
    if (mode === "inside" || mode === "erode") {
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          if (!work[y]?.[x] || !canEdit(x, y)) continue;
          const touchesBorder = dirs.some(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            return nx < 0 || nx >= gw || ny < 0 || ny >= gh || work[ny][nx] === 0;
          });
          if (touchesBorder) passCells.push([x, y]);
        }
      }
      for (const [x, y] of passCells) {
        work[y][x] = 0;
        const key = `${x},${y}`;
        if (!seen.has(key)) { seen.add(key); added.push([x, y]); }
      }
    } else {
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          if (!work[y]?.[x]) continue;
          for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
            if (work[ny][nx] !== 0 || !canEdit(nx, ny)) continue;
            const key = `${nx},${ny}`;
            if (!seen.has(key)) { seen.add(key); passCells.push([nx, ny]); }
          }
        }
      }
      for (const [x, y] of passCells) {
        work[y][x] = 1;
        added.push([x, y]);
      }
    }
    if (passCells.length === 0) break;
  }
  return added;
}

/** Agrega o erosiona un contorno configurable (direcciones, grosor, exterior/interior/erosionar). */
export function applyOutline(options = {}) {
  if (isActiveLayerLocked()) return 0;
  const targetColor = options.mode === "erode" ? 0 : (options.colorIndex ?? (state.currentColorIndex || 1));
  const { w: gw, h: gh } = getGridDims();
  const toOutline = computeOutlineCells(state.grid, gw, gh, options);
  if (toOutline.length === 0) return 0;
  pushState();
  for (const [x, y] of toOutline) state.grid[y][x] = targetColor;
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
