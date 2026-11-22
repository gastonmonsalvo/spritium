/**
 * clipboardAndMoveOps.js: Portapapeles (copiar/cortar/pegar), traslación no destructiva, snap y alineación.
 */

import { state, pushState, pushLayerState, createEmptyGrid, getGridDims } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { addNewLayer, isActiveLayerLocked } from "../workspace/layers.js";
import { reconcileActiveTilemapLayer } from "../workspace/tilemap.js";
import { getActiveRegion, isInsideSelection } from "./tools.js";
import { getOpaqueBounds } from "./rotSprite.js";

/** Copia la selección activa (o toda la capa activa) al portapapeles interno. */
export function copySelection() {
  const { x, y, w, h } = getActiveRegion();
  const cells = [];
  for (let r = 0; r < h; r++) {
    const row = [];
    for (let c = 0; c < w; c++) row.push(isInsideSelection(x + c, y + r) ? (state.grid[y + r]?.[x + c] ?? 0) : 0);
    cells.push(row);
  }
  state.clipboard = { w, h, cells };
  return { w, h };
}

/** Corta la selección activa (o toda la capa) al portapapeles dejando transparente. */
export function cutSelection() {
  if (isActiveLayerLocked()) return { w: 0, h: 0 };
  const info = copySelection();
  pushState();
  const { x, y, w, h } = getActiveRegion();
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (isInsideSelection(x + c, y + r) && state.grid[y + r]?.[x + c] !== undefined) state.grid[y + r][x + c] = 0;
    }
  }
  state.isDirtySinceImport = true;
  reconcileActiveTilemapLayer("auto");
  renderAll();
  return info;
}

/** Pega el portapapeles centrado en `state.cursorPos` (o en la selección/centro). */
export function pasteClipboard({ asNewLayer = true } = {}) {
  if (!state.clipboard) return false;
  const { w, h, cells } = state.clipboard, { w: gw, h: gh } = getGridDims();
  let startX = state.cursorPos ? state.cursorPos.x - Math.floor(w / 2) : state.selection ? state.selection.x : Math.max(0, Math.floor((gw - w) / 2));
  let startY = state.cursorPos ? state.cursorPos.y - Math.floor(h / 2) : state.selection ? state.selection.y : Math.max(0, Math.floor((gh - h) / 2));
  startX = Math.max(-w + 1, Math.min(gw - 1, startX));
  startY = Math.max(-h + 1, Math.min(gh - 1, startY));

  const blit = (dst) => {
    for (let r = 0; r < h; r++) {
      const ty = startY + r;
      if (ty < 0 || ty >= gh) continue;
      for (let c = 0; c < w; c++) {
        const tx = startX + c;
        if (tx >= 0 && tx < gw && cells[r][c] !== 0) dst[ty][tx] = cells[r][c];
      }
    }
  };
  if (asNewLayer) {
    const pastedGrid = createEmptyGrid(gw, gh);
    blit(pastedGrid);
    addNewLayer("Pegado", pastedGrid);
    state.isDirtySinceImport = true;
    return true;
  }
  pushState();
  blit(state.grid);
  state.isDirtySinceImport = true;
  reconcileActiveTilemapLayer("auto");
  renderAll();
  return true;
}

function initFloatingSelection(baseGrid, baseSelection, baseOutOfBounds, gw, gh) {
  const { x, y, w, h, mask } = baseSelection;
  const bgGrid = baseGrid.map((row) => [...row]);
  const patch = Array.from({ length: h }, () => new Array(w).fill(0));
  const oobLookup = new Map(baseOutOfBounds.map(([ox, oy, val]) => [`${ox},${oy}`, val]));
  const takenOob = new Set();

  for (let r = 0; r < h; r++) {
    const sy = y + r;
    for (let c = 0; c < w; c++) {
      if (mask && mask[r * w + c] !== 1) continue;
      const sx = x + c;
      if (sx >= 0 && sx < gw && sy >= 0 && sy < gh) { patch[r][c] = baseGrid[sy]?.[sx] ?? 0; bgGrid[sy][sx] = 0; }
      else { const k = `${sx},${sy}`; patch[r][c] = oobLookup.get(k) ?? 0; takenOob.add(k); }
    }
  }
  const bgOutOfBounds = baseOutOfBounds.filter(([ox, oy]) => !takenOob.has(`${ox},${oy}`));
  state.floatingSelection = { layerIndex: state.activeLayerIndex, bgGrid, bgOutOfBounds, patch, w, h, mask, curX: x, curY: y };
}

/**
 * Garantiza que la selección activa esté promovida a `state.floatingSelection` para ediciones no destructivas.
 * @returns {any}
 */
export function ensureFloatingSelection() {
  if (!state.selection) return null;
  if (!state.floatingSelection || state.floatingSelection.layerIndex !== state.activeLayerIndex) {
    const { w: gw, h: gh } = getGridDims();
    const activeLayer = state.layers?.[state.activeLayerIndex];
    const baseOob = activeLayer?.outOfBounds ? activeLayer.outOfBounds.map((p) => [...p]) : [];
    initFloatingSelection(state.grid, state.selection, baseOob, gw, gh);
  }
  return state.floatingSelection;
}

/**
 * Compone `floatingSelection` sobre su `bgGrid` y actualiza `state.grid` y `activeLayer.outOfBounds`.
 * @param {any} [fs=state.floatingSelection]
 */
export function compositeFloatingSelection(fs = state.floatingSelection) {
  if (!fs) return;
  const { w: gw, h: gh } = getGridDims();
  const activeLayer = state.layers?.[state.activeLayerIndex];
  const newOutOfBounds = fs.bgOutOfBounds.map((p) => [...p]);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      state.grid[gy][gx] = fs.bgGrid[gy]?.[gx] ?? 0;
    }
  }
  for (let r = 0; r < fs.h; r++) {
    for (let c = 0; c < fs.w; c++) {
      const val = fs.patch[r]?.[c] ?? 0;
      if (!val) continue;
      const nx = fs.curX + c;
      const ny = fs.curY + r;
      if (nx >= 0 && nx < gw && ny >= 0 && ny < gh) state.grid[ny][nx] = val;
      else newOutOfBounds.push([nx, ny, val]);
    }
  }
  if (activeLayer) activeLayer.outOfBounds = newOutOfBounds;
  state.isDirtySinceImport = true;
}

/** Traslada los píxeles de `baseGrid` (y `baseSelection` si existe) un delta (dx, dy). */
export function translateFromSnapshot(baseGrid, baseSelection, dx, dy, baseOutOfBounds = []) {
  const { w: gw, h: gh } = getGridDims();
  const targetGrid = baseGrid.map((row) => [...row]);
  let newOutOfBounds = [];
  const activeLayer = state.layers?.[state.activeLayerIndex];

  if (baseSelection) {
    if (!state.floatingSelection || state.floatingSelection.layerIndex !== state.activeLayerIndex) {
      initFloatingSelection(baseGrid, baseSelection, baseOutOfBounds, gw, gh);
    }
    const fs = state.floatingSelection;
    fs.curX = baseSelection.x + dx;
    fs.curY = baseSelection.y + dy;
    compositeFloatingSelection(fs);
    state.selection = { ...baseSelection, x: fs.curX, y: fs.curY, w: fs.w, h: fs.h };
    return;
  } else {
    for (let y = 0; y < gh; y++) targetGrid[y].fill(0);
    const place = (nx, ny, val) => {
      if (!val) return;
      if (nx >= 0 && nx < gw && ny >= 0 && ny < gh) targetGrid[ny][nx] = val;
      else newOutOfBounds.push([nx, ny, val]);
    };
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) place(x + dx, y + dy, baseGrid[y][x]);
    for (const [ox, oy, val] of baseOutOfBounds) place(ox + dx, oy + dy, val);
  }

  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) state.grid[y][x] = targetGrid[y][x];
  if (activeLayer) activeLayer.outOfBounds = newOutOfBounds;
  state.isDirtySinceImport = true;
}

/** Desplaza la selección o la capa activa 1 píxel en la dirección (dx, dy). */
export function nudgeSprite(dx, dy) {
  if (isActiveLayerLocked()) return;
  pushState();
  const activeLayer = state.layers?.[state.activeLayerIndex];
  const baseOob = activeLayer?.outOfBounds ? activeLayer.outOfBounds.map((p) => [...p]) : [];
  translateFromSnapshot(state.grid.map((r) => [...r]), state.selection ? { ...state.selection } : null, dx, dy, baseOob);
  reconcileActiveTilemapLayer("auto");
  renderAll();
}

function snapAxis(curMin, curMax, half, limit, boundMin, boundMax, threshold) {
  const curCenter = (curMin + curMax) / 2;
  if (Math.abs(curCenter - half) <= threshold) return { delta: Math.round(half - (boundMin + boundMax + 1) / 2), guide: half };
  if (Math.abs(curMin) <= threshold) return { delta: -boundMin, guide: 0 };
  if (Math.abs(curMax - limit) <= threshold) return { delta: limit - (boundMax + 1), guide: limit };
  return null;
}

/** Calcula el desplazamiento (dx, dy) con bloqueo de eje (Shift) y snap magnético (Ctrl). */
export function computeSnappedDelta(baseGrid, baseSelection, rawDx, rawDy, { lockAxis = false, snapToGuides = false, threshold = 2, baseOutOfBounds = [] } = {}) {
  let dx = rawDx, dy = rawDy, guides = null;
  if (lockAxis) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
  if (!snapToGuides) return { dx, dy, guides };
  const bounds = getOpaqueBounds(baseGrid, baseSelection, baseOutOfBounds);
  if (!bounds) return { dx, dy, guides };
  const { w: gw, h: gh } = getGridDims();
  const sx = snapAxis(bounds.minX + dx, bounds.maxX + 1 + dx, gw / 2, gw, bounds.minX, bounds.maxX, threshold);
  const sy = snapAxis(bounds.minY + dy, bounds.maxY + 1 + dy, gh / 2, gh, bounds.minY, bounds.maxY, threshold);
  guides = {};
  if (sx) { dx = sx.delta; guides.x = sx.guide; }
  if (sy) { dy = sy.delta; guides.y = sy.guide; }
  if (guides.x === undefined && guides.y === undefined) guides = null;
  return { dx, dy, guides };
}

/** Alinea el contenido opaco al centro o márgenes del lienzo. */
export function alignContent(mode) {
  if (isActiveLayerLocked()) return false;
  const activeLayer = state.layers?.[state.activeLayerIndex];
  const baseOob = activeLayer?.outOfBounds ? activeLayer.outOfBounds.map((p) => [...p]) : [];
  const bounds = getOpaqueBounds(state.grid, state.selection, baseOob);
  if (!bounds) return false;
  const { w: gw, h: gh } = getGridDims();
  const offsets = {
    center: [Math.round((gw - bounds.w) / 2) - bounds.minX, Math.round((gh - bounds.h) / 2) - bounds.minY],
    left: [-bounds.minX, 0],
    right: [gw - 1 - bounds.maxX, 0],
    top: [0, -bounds.minY],
    bottom: [0, gh - 1 - bounds.maxY],
  };
  const [dx, dy] = offsets[mode] || [0, 0];
  if (dx === 0 && dy === 0) return false;
  pushLayerState();
  translateFromSnapshot(state.grid.map((r) => [...r]), state.selection ? { ...state.selection } : null, dx, dy, baseOob);
  reconcileActiveTilemapLayer("auto");
  renderAll();
  return true;
}
