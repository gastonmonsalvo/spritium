/**
 * selectionStrategies.js: Estrategias de selección (Rectangular, Elipse, Lazo y Varita Mágica).
 */

import { state, getGridDims } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { magicSelectAt, cloneSelection, getSelectionMode, combineSelections } from "./tools.js";
import { setStatus } from "../ui/index.js";
import { createBrushFromSelection } from "./customBrushes.js";

function buildShapeSelectionMask(shapeType, w, h, invertY) {
  const mask = new Uint8Array(w * h);
  if (shapeType === "ellipse") {
    const rx = w / 2;
    const ry = h / 2;
    for (let r = 0; r < h; r++) {
      const ny = (r + 0.5 - ry) / ry;
      for (let c = 0; c < w; c++) {
        const nx = (c + 0.5 - rx) / rx;
        if (nx * nx + ny * ny <= 1) {
          mask[r * w + c] = 1;
        }
      }
    }
    return mask;
  }

  // Triángulo isósceles pixel-perfect dentro del bounding box (consistente con drawPixelTriangle)
  const apexX = Math.round((w - 1) / 2);
  const apexY = invertY ? h - 1 : 0;
  const stepY = invertY ? -1 : 1;
  const totalH = Math.max(1, h - 1);
  for (let i = 0; i <= totalH; i++) {
    const py = apexY + i * stepY;
    const t = i / totalH;
    const lx = Math.round(apexX + (0 - apexX) * t);
    const rx = Math.round(apexX + (w - 1 - apexX) * t);
    const s = Math.min(lx, rx);
    const e = Math.max(lx, rx);
    for (let px = s; px <= e; px++) {
      mask[py * w + px] = 1;
    }
  }
  return mask;
}

function createBoxSelectStrategy(shapeType = "rect") {
  let baseSelection = null;
  let mode = "replace";

  const clampX = (v) => Math.max(0, Math.min(getGridDims().w - 1, v));
  const clampY = (v) => Math.max(0, Math.min(getGridDims().h - 1, v));

  return {
    onDown({ x, y, button, event }) {
      if (button !== 0) return;
      state.floatingSelection = null;
      const sx = clampX(x);
      const sy = clampY(y);
      mode = getSelectionMode(event);
      baseSelection = mode === "replace" ? null : cloneSelection(state.selection);
      state.isSelecting = true;
      state.selectStart = { x: sx, y: sy };
      state.selection = combineSelections(baseSelection, { x: sx, y: sy, w: 1, h: 1 }, mode);
      renderAll();
    },
    onMove({ x, y, event }) {
      if (!state.isSelecting || !state.selectStart) return;
      let tx = clampX(x);
      let ty = clampY(y);
      if (event?.shiftKey && mode === "replace") {
        const dx = tx - state.selectStart.x;
        const dy = ty - state.selectStart.y;
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        tx = clampX(state.selectStart.x + (dx >= 0 ? side : -side));
        ty = clampY(state.selectStart.y + (dy >= 0 ? side : -side));
      }
      const x1 = Math.min(state.selectStart.x, tx);
      const y1 = Math.min(state.selectStart.y, ty);
      const x2 = Math.max(state.selectStart.x, tx);
      const y2 = Math.max(state.selectStart.y, ty);
      const w = x2 - x1 + 1;
      const h = y2 - y1 + 1;

      let shapeSel = { x: x1, y: y1, w, h };
      if (shapeType !== "rect" && w > 1 && h > 1) {
        const mask = buildShapeSelectionMask(shapeType, w, h, ty < state.selectStart.y);
        shapeSel = { x: x1, y: y1, w, h, mask };
      }

      state.selection = combineSelections(baseSelection, shapeSel, mode);
      renderAll();
    },
    onUp() {
      if (state.isSelecting) {
        state.isSelecting = false;
        baseSelection = null;
        if (state.pendingBrushFromSelection && state.selection) {
          createBrushFromSelection();
          return;
        }
        renderAll();
      }
    },
  };
}

export const selectStrategy = createBoxSelectStrategy("rect");
export const ellipseSelectStrategy = createBoxSelectStrategy("ellipse");
export const triangleSelectStrategy = createBoxSelectStrategy("triangle");

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x + 0.5;
    const yi = poly[i].y + 0.5;
    const xj = poly[j].x + 0.5;
    const yj = poly[j].y + 0.5;
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export const lassoStrategy = (() => {
  let points = [];
  let baseSelection = null;
  let mode = "replace";

  const clampX = (v) => Math.max(0, Math.min(getGridDims().w - 1, v));
  const clampY = (v) => Math.max(0, Math.min(getGridDims().h - 1, v));

  const appendSegment = (x1, y1) => {
    const last = points[points.length - 1];
    if (last.x === x1 && last.y === y1) return false;
    let cx = last.x;
    let cy = last.y;
    const dx = Math.abs(x1 - cx);
    const dy = Math.abs(y1 - cy);
    const sx = cx < x1 ? 1 : -1;
    const sy = cy < y1 ? 1 : -1;
    let err = dx - dy;
    while (cx !== x1 || cy !== y1) {
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
      points.push({ x: cx, y: cy });
    }
    return true;
  };

  return {
    onDown({ x, y, button, event }) {
      if (button !== 0) return;
      mode = getSelectionMode(event);
      baseSelection = mode === "replace" ? null : cloneSelection(state.selection);
      if (mode === "replace") {
        state.selection = null;
      }
      points = [{ x: clampX(x), y: clampY(y) }];
      state.lassoPreview = points;
      renderAll();
    },
    onMove({ x, y }) {
      if (points.length === 0) return;
      if (appendSegment(clampX(x), clampY(y))) {
        state.lassoPreview = points;
        renderAll();
      }
    },
    onUp() {
      state.lassoPreview = null;
      if (points.length < 3) {
        points = [];
        baseSelection = null;
        renderAll();
        return;
      }

      const { w: gw, h: gh } = getGridDims();
      let minX = gw;
      let minY = gh;
      let maxX = 0;
      let maxY = 0;
      for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      const mask = new Uint8Array(w * h);

      // Incluir el contorno del lazo + interior por ray-casting
      for (const p of points) {
        mask[(p.y - minY) * w + (p.x - minX)] = 1;
      }
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (mask[r * w + c] === 0 && pointInPolygon(minX + c + 0.5, minY + r + 0.5, points)) {
            mask[r * w + c] = 1;
          }
        }
      }

      const lassoSel = { x: minX, y: minY, w, h, mask };
      state.selection = combineSelections(baseSelection, lassoSel, mode);
      points = [];
      baseSelection = null;
      if (state.pendingBrushFromSelection && state.selection) {
        createBrushFromSelection();
        return;
      }
      renderAll();
      setStatus(
        state.selection
          ? { key: "log.sel_lasso", params: { w: state.selection.w, h: state.selection.h } }
          : { key: "log.sel_empty" },
      );
    },
  };
})();



export const magicSelectStrategy = {
  onDown({ x, y, button, event }) {
    if (button !== 0) return;
    const tol = Math.max(0, Math.min(64, Number(state.magicTolerance || 0)));
    const mode = getSelectionMode(event);
    const contiguous =
      event?.shiftKey && mode === "replace"
        ? false
        : state.magicContiguous !== false;
    if (magicSelectAt(x, y, { tolerance: tol, contiguous, mode })) {
      if (state.pendingBrushFromSelection && state.selection) {
        createBrushFromSelection();
        return;
      }
      renderAll();
      setStatus(
        state.selection
          ? { key: "log.sel_magic", params: { w: state.selection.w, h: state.selection.h } }
          : { key: "log.sel_empty" },
      );
    }
  },
  onMove() {},
  onUp() {},
};

// --- LÍNEA RECTA Y CURVA DE CASTELJAU (1-3 PUNTOS) ---
