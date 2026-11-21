/**
 * transforms.js: Espejado, rotaciones discretas (90°/180°) y fachada pública de transformaciones.
 */

import { state, pushState, getGridDims } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { isActiveLayerLocked } from "../workspace/layers.js";
import { reconcileActiveTilemapLayer } from "../workspace/tilemap.js";
import { getActiveRegion } from "./tools.js";
import { rotSpriteRotate, getOpaqueBounds } from "./rotSprite.js";
import { copySelection, cutSelection, pasteClipboard, translateFromSnapshot, nudgeSprite, computeSnappedDelta, alignContent } from "./clipboardAndMoveOps.js";
import { applyOutline, erodeOutline, shiftCanvasWrap } from "./morphologyOps.js";

export {
  rotSpriteRotate,
  getOpaqueBounds,
  copySelection,
  cutSelection,
  pasteClipboard,
  translateFromSnapshot,
  nudgeSprite,
  computeSnappedDelta,
  alignContent,
  applyOutline,
  erodeOutline,
  shiftCanvasWrap,
};

function remapOutOfBounds(activeLayer, mapCoord) {
  if (state.selection || !activeLayer?.outOfBounds?.length) return;
  const { w: gw, h: gh } = getGridDims();
  const nextOob = [];
  for (const [ox, oy, val] of activeLayer.outOfBounds) {
    const [nx, ny] = mapCoord(ox, oy, gw, gh);
    if (nx >= 0 && nx < gw && ny >= 0 && ny < gh) state.grid[ny][nx] = val;
    else nextOob.push([nx, ny, val]);
  }
  activeLayer.outOfBounds = nextOob;
}

/** Voltea horizontal ("h") o verticalmente ("v") la selección o la capa activa. */
export function flipSelectionOrCanvas(axis) {
  if (isActiveLayerLocked()) return;
  pushState();
  const { x, y, w, h } = getActiveRegion();
  const snapshot = Array.from({ length: h }, (_, r) => state.grid[y + r].slice(x, x + w));
  const activeLayer = state.layers?.[state.activeLayerIndex];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      state.grid[y + r][x + c] = snapshot[axis === "v" ? h - 1 - r : r][axis === "h" ? w - 1 - c : c];
    }
  }
  remapOutOfBounds(activeLayer, (ox, oy, gw, gh) => [axis === "h" ? gw - 1 - ox : ox, axis === "v" ? gh - 1 - oy : oy]);
  state.isDirtySinceImport = true;
  reconcileActiveTilemapLayer("auto");
  renderAll();
}

/** Rota 90° en sentido horario la selección activa o toda la capa. */
export function rotate90SelectionOrCanvas() {
  if (isActiveLayerLocked()) return;
  const { x, y, w, h } = getActiveRegion(), { w: gw, h: gh } = getGridDims();
  pushState();
  const activeLayer = state.layers?.[state.activeLayerIndex];
  const snapshot = Array.from({ length: h }, (_, r) => {
    const row = state.grid[y + r].slice(x, x + w);
    for (let c = 0; c < w; c++) state.grid[y + r][x + c] = 0;
    return row;
  });
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ny = y + c, nx = x + (h - 1 - r);
      if (ny >= 0 && ny < gh && nx >= 0 && nx < gw) state.grid[ny][nx] = snapshot[r][c];
    }
  }
  remapOutOfBounds(activeLayer, (ox, oy, wMax) => [wMax - 1 - oy, ox]);
  if (state.selection) state.selection = { x, y, w: Math.min(h, gw - x), h: Math.min(w, gh - y) };
  state.isDirtySinceImport = true;
  reconcileActiveTilemapLayer("auto");
  renderAll();
}

/** Rota 180° la selección o la capa activa (incluyendo outOfBounds). */
export function rotate180SelectionOrCanvas() {
  if (isActiveLayerLocked()) return;
  const { x, y, w, h } = getActiveRegion();
  pushState();
  const activeLayer = state.layers?.[state.activeLayerIndex];
  const snapshot = Array.from({ length: h }, (_, r) => state.grid[y + r].slice(x, x + w));
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) state.grid[y + r][x + c] = snapshot[h - 1 - r][w - 1 - c];
  }
  remapOutOfBounds(activeLayer, (ox, oy, gw, gh) => [gw - 1 - ox, gh - 1 - oy]);
  state.isDirtySinceImport = true;
  reconcileActiveTilemapLayer("auto");
  renderAll();
}
