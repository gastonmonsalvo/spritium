/**
 * transforms.js: Espejado, rotaciones discretas (90°/180°) y fachada pública de transformaciones.
 */

import { state, pushLayerState, getGridDims } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { isActiveLayerLocked } from "../workspace/layers.js";
import { reconcileActiveTilemapLayer } from "../workspace/tilemap.js";
import { rotSpriteRotate, getOpaqueBounds } from "./rotSprite.js";
import {
  copySelection,
  cutSelection,
  pasteClipboard,
  translateFromSnapshot,
  nudgeSprite,
  computeSnappedDelta,
  alignContent,
  ensureFloatingSelection,
  compositeFloatingSelection,
} from "./clipboardAndMoveOps.js";
import { applyOutline, erodeOutline, shiftCanvasWrap } from "./morphologyOps.js";
import { commitFreeTransform } from "./freeTransform.js";

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
  if (!activeLayer?.outOfBounds?.length) return;
  const { w: gw, h: gh } = getGridDims();
  const nextOob = [];
  for (const [ox, oy, val] of activeLayer.outOfBounds) {
    const [nx, ny] = mapCoord(ox, oy, gw, gh);
    if (nx >= 0 && nx < gw && ny >= 0 && ny < gh) state.grid[ny][nx] = val;
    else nextOob.push([nx, ny, val]);
  }
  activeLayer.outOfBounds = nextOob;
}

function transformFloatingSelection(kind) {
  const fs = ensureFloatingSelection();
  if (!fs) return;

  const oldW = fs.w;
  const oldH = fs.h;
  const oldPatch = fs.patch;
  const oldMask = fs.mask;

  let newW = oldW;
  let newH = oldH;
  if (kind === "rot90") {
    newW = oldH;
    newH = oldW;
    const cx = fs.curX + oldW / 2;
    const cy = fs.curY + oldH / 2;
    fs.curX = Math.round(cx - newW / 2);
    fs.curY = Math.round(cy - newH / 2);
  }

  const newPatch = Array.from({ length: newH }, () => new Array(newW).fill(0));
  const newMask = oldMask ? new Uint8Array(newW * newH) : undefined;

  for (let r = 0; r < oldH; r++) {
    for (let c = 0; c < oldW; c++) {
      let nr = r;
      let nc = c;
      if (kind === "flipH") nc = oldW - 1 - c;
      else if (kind === "flipV") nr = oldH - 1 - r;
      else if (kind === "rot180") {
        nr = oldH - 1 - r;
        nc = oldW - 1 - c;
      } else if (kind === "rot90") {
        nr = c;
        nc = oldH - 1 - r;
      }
      newPatch[nr][nc] = oldPatch[r]?.[c] ?? 0;
      if (newMask && oldMask) {
        newMask[nr * newW + nc] = oldMask[r * oldW + c];
      }
    }
  }

  fs.w = newW;
  fs.h = newH;
  fs.patch = newPatch;
  fs.mask = newMask;
  state.selection = newMask
    ? { x: fs.curX, y: fs.curY, w: newW, h: newH, mask: newMask }
    : { x: fs.curX, y: fs.curY, w: newW, h: newH };

  compositeFloatingSelection(fs);
}

/** Voltea horizontal ("h") o verticalmente ("v") la selección o la capa activa. */
export function flipSelectionOrCanvas(axis) {
  if (isActiveLayerLocked()) return;
  if (state.freeTransform) commitFreeTransform();
  pushLayerState();

  if (state.selection) {
    transformFloatingSelection(axis === "v" ? "flipV" : "flipH");
  } else {
    const { w, h } = getGridDims();
    const activeLayer = state.layers?.[state.activeLayerIndex];
    const snapshot = Array.from({ length: h }, (_, r) => state.grid[r].slice(0, w));
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        state.grid[r][c] = snapshot[axis === "v" ? h - 1 - r : r][axis === "h" ? w - 1 - c : c];
      }
    }
    remapOutOfBounds(activeLayer, (ox, oy, gw, gh) => [axis === "h" ? gw - 1 - ox : ox, axis === "v" ? gh - 1 - oy : oy]);
    state.isDirtySinceImport = true;
  }

  reconcileActiveTilemapLayer("auto");
  renderAll();
}

/** Rota 90° en sentido horario la selección activa o toda la capa. */
export function rotate90SelectionOrCanvas() {
  if (isActiveLayerLocked()) return;
  if (state.freeTransform) commitFreeTransform();
  pushLayerState();

  if (state.selection) {
    transformFloatingSelection("rot90");
  } else {
    const { w: gw, h: gh } = getGridDims();
    const activeLayer = state.layers?.[state.activeLayerIndex];
    const snapshot = Array.from({ length: gh }, (_, r) => {
      const row = state.grid[r].slice(0, gw);
      state.grid[r].fill(0);
      return row;
    });
    const nextOob = [];
    for (let r = 0; r < gh; r++) {
      for (let c = 0; c < gw; c++) {
        const val = snapshot[r][c];
        if (!val) continue;
        const ny = c;
        const nx = gh - 1 - r;
        if (ny >= 0 && ny < gh && nx >= 0 && nx < gw) state.grid[ny][nx] = val;
        else nextOob.push([nx, ny, val]);
      }
    }
    if (activeLayer?.outOfBounds?.length) {
      for (const [ox, oy, val] of activeLayer.outOfBounds) {
        if (!val) continue;
        const ny = ox;
        const nx = gh - 1 - oy;
        if (ny >= 0 && ny < gh && nx >= 0 && nx < gw) state.grid[ny][nx] = val;
        else nextOob.push([nx, ny, val]);
      }
    }
    if (activeLayer) activeLayer.outOfBounds = nextOob;
    state.isDirtySinceImport = true;
  }

  reconcileActiveTilemapLayer("auto");
  renderAll();
}

/** Rota 180° la selección o la capa activa (incluyendo outOfBounds). */
export function rotate180SelectionOrCanvas() {
  if (isActiveLayerLocked()) return;
  if (state.freeTransform) commitFreeTransform();
  pushLayerState();

  if (state.selection) {
    transformFloatingSelection("rot180");
  } else {
    const { w, h } = getGridDims();
    const activeLayer = state.layers?.[state.activeLayerIndex];
    const snapshot = Array.from({ length: h }, (_, r) => state.grid[r].slice(0, w));
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) state.grid[r][c] = snapshot[h - 1 - r][w - 1 - c];
    }
    remapOutOfBounds(activeLayer, (ox, oy, gw, gh) => [gw - 1 - ox, gh - 1 - oy]);
    state.isDirtySinceImport = true;
  }

  reconcileActiveTilemapLayer("auto");
  renderAll();
}
