/**
 * freeTransform.js: Transformación libre (Shift+T) mediante Homografía Inversa 3×3
 * con muestreo Nearest-Neighbor (sin antialiasing) sobre selección o capa.
 */

import { state, cloneGrid, pushLayerState, createEmptyGrid, getGridDims } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { isInsideSelection } from "./tools.js";
import { isActiveLayerLocked } from "../workspace/layers.js";
import { reconcileActiveTilemapLayer } from "../workspace/tilemap.js";
import { setStatus, updateToolOptionsUI, getToolCursorCss } from "../ui/index.js";
import {
  computeQuadToUnitHomography,
  pointInQuad,
  distToSegment,
  getFreeTransformHandles,
  rotateCornersAroundCenter,
  applyCornerDrag,
  applyEdgeDrag,
} from "./homographyMath.js";

export { getFreeTransformHandles };

function findContentBounds(grid, gw, gh, useSelection, outOfBounds = []) {
  let minX = gw, minY = gh, maxX = -1, maxY = -1;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (useSelection && !isInsideSelection(x, y)) continue;
      if (grid[y]?.[x]) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (!useSelection) {
    for (const [ox, oy, val] of outOfBounds || []) {
      if (!val) continue;
      if (ox < minX) minX = ox; if (ox > maxX) maxX = ox;
      if (oy < minY) minY = oy; if (oy > maxY) maxY = oy;
    }
  }
  return maxX < minX ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Rasteriza `state.freeTransform` en `state.grid` y `activeLayer.outOfBounds` sin recortar. */
export function renderFreeTransformPreview() {
  const ft = state.freeTransform;
  if (!ft) return;
  const { w: gw, h: gh } = getGridDims();
  const { backgroundGrid, backgroundOutOfBounds, srcPatch, srcBounds, corners } = ft;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) state.grid[y][x] = backgroundGrid[y][x];

  const nextOob = backgroundOutOfBounds.map((p) => [...p]);
  const activeLayer = state.layers?.[state.activeLayerIndex];
  const H = computeQuadToUnitHomography(corners);
  if (!H) { if (activeLayer) activeLayer.outOfBounds = nextOob; return; }

  const rawMinX = Math.floor(Math.min(...corners.map((c) => c.x)));
  const rawMaxX = Math.ceil(Math.max(...corners.map((c) => c.x)));
  const rawMinY = Math.floor(Math.min(...corners.map((c) => c.y)));
  const rawMaxY = Math.ceil(Math.max(...corners.map((c) => c.y)));
  const [h00, h01, h02, h10, h11, h12, h20, h21, h22] = H;

  for (let gy = rawMinY; gy <= rawMaxY; gy++) {
    const py = gy + 0.5;
    for (let gx = rawMinX; gx <= rawMaxX; gx++) {
      const px = gx + 0.5, w = h20 * px + h21 * py + h22;
      if (Math.abs(w) < 1e-8) continue;
      const u = (h00 * px + h01 * py + h02) / w, v = (h10 * px + h11 * py + h12) / w;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      const val = srcPatch[Math.floor(v * srcBounds.h)]?.[Math.floor(u * srcBounds.w)] ?? 0;
      if (!val) continue;
      if (gx >= 0 && gx < gw && gy >= 0 && gy < gh) state.grid[gy][gx] = val;
      else nextOob.push([gx, gy, val]);
    }
  }
  if (activeLayer) activeLayer.outOfBounds = nextOob;
}

function buildSourcePatchFromGrid(originalGrid, baseOutOfBounds, gw, gh, hasSelection) {
  const srcBounds = findContentBounds(state.grid, gw, gh, hasSelection, baseOutOfBounds);
  if (!srcBounds) return null;
  const backgroundGrid = createEmptyGrid(gw, gh);
  const backgroundOutOfBounds = hasSelection ? baseOutOfBounds.map((p) => [...p]) : [];
  const srcPatch = Array.from({ length: srcBounds.h }, () => new Array(srcBounds.w).fill(0));

  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const val = originalGrid[y][x];
      if ((hasSelection ? isInsideSelection(x, y) : true) && val !== 0) {
        const lx = x - srcBounds.x, ly = y - srcBounds.y;
        if (ly >= 0 && ly < srcBounds.h && lx >= 0 && lx < srcBounds.w) srcPatch[ly][lx] = val;
      } else backgroundGrid[y][x] = val;
    }
  }
  if (!hasSelection) {
    for (const [ox, oy, val] of baseOutOfBounds) {
      if (!val) continue;
      const lx = ox - srcBounds.x, ly = oy - srcBounds.y;
      if (ly >= 0 && ly < srcBounds.h && lx >= 0 && lx < srcBounds.w) srcPatch[ly][lx] = val;
    }
  }
  return { srcBounds, backgroundGrid, backgroundOutOfBounds, srcPatch };
}

/** Inicia el modo Transformación Libre (Shift+T) sobre la selección o capa activa. */
export function startFreeTransform() {
  if (state.freeTransform) { commitFreeTransform(); return false; }
  if (isActiveLayerLocked()) { setStatus({ key: "log.layer_locked" }, true); return false; }

  const { w: gw, h: gh } = getGridDims();
  const activeLayer = state.layers?.[state.activeLayerIndex];
  const baseOutOfBounds = activeLayer?.outOfBounds ? activeLayer.outOfBounds.map((p) => [...p]) : [];
  const hasSelection = Boolean(state.selection);
  const originalGrid = cloneGrid(state.grid);
  const fs = hasSelection && state.floatingSelection?.layerIndex === state.activeLayerIndex ? state.floatingSelection : null;

  const data = fs
    ? { srcBounds: { x: fs.curX, y: fs.curY, w: fs.w, h: fs.h }, backgroundGrid: fs.bgGrid.map((r) => [...r]), backgroundOutOfBounds: fs.bgOutOfBounds.map((p) => [...p]), srcPatch: fs.patch.map((r) => [...r]) }
    : buildSourcePatchFromGrid(originalGrid, baseOutOfBounds, gw, gh, hasSelection);
  if (!data) { setStatus({ key: "log.ft_no_pixels" }, true); return false; }

  const { x, y, w, h } = data.srcBounds;
  state.freeTransform = {
    originalGrid, baseOutOfBounds, ...data, hadSelection: hasSelection, mode: "scale", angleDeg: 0,
    corners: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
  };
  renderFreeTransformPreview();
  updateToolOptionsUI();
  renderAll();
  setStatus({ key: "log.ft_active" });
  return true;
}

function updateSelectionAfterCommit(transformedGrid, backgroundGrid, corners, gw, gh) {
  let minX = gw, minY = gh, maxX = -1, maxY = -1;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (transformedGrid[y][x] !== backgroundGrid[y][x] || (pointInQuad(x + 0.5, y + 0.5, corners) && transformedGrid[y][x] !== 0)) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) { state.selection = null; return; }
  const w = maxX - minX + 1, h = maxY - minY + 1, mask = new Uint8Array(w * h);
  let allOnes = true;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const gy = minY + r, gx = minX + c;
      const inside = transformedGrid[gy][gx] !== backgroundGrid[gy][gx] || pointInQuad(gx + 0.5, gy + 0.5, corners);
      mask[r * w + c] = inside ? 1 : 0;
      if (!inside) allOnes = false;
    }
  }
  state.selection = allOnes ? { x: minX, y: minY, w, h } : { x: minX, y: minY, w, h, mask };
}

/** Confirma la transformación libre actual y la registra en el historial Undo. */
export function commitFreeTransform() {
  const ft = state.freeTransform;
  if (!ft) return false;
  const activeLayer = state.layers?.[state.activeLayerIndex], { w: gw, h: gh } = getGridDims();
  const transformedGrid = cloneGrid(state.grid);
  const transformedOob = activeLayer?.outOfBounds ? activeLayer.outOfBounds.map((p) => [...p]) : [];

  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) state.grid[y][x] = ft.originalGrid[y][x];
  if (activeLayer) activeLayer.outOfBounds = ft.baseOutOfBounds.map((p) => [...p]);
  pushLayerState();
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) state.grid[y][x] = transformedGrid[y][x];
  if (activeLayer) activeLayer.outOfBounds = transformedOob;
  if (ft.hadSelection) updateSelectionAfterCommit(transformedGrid, ft.backgroundGrid, ft.corners, gw, gh);

  state.freeTransform = null; state.floatingSelection = null; state.isDirtySinceImport = true;
  reconcileActiveTilemapLayer("auto");
  const canvasEl = typeof document !== "undefined" ? document.getElementById("paintCanvas") : null;
  if (canvasEl) canvasEl.style.cursor = getToolCursorCss(state.currentTool);
  updateToolOptionsUI(); renderAll();
  setStatus({ key: "log.ft_applied" }, false, "pixel");
  return true;
}

/** Cancela la transformación libre y restaura los píxeles originales sin ensuciar el historial. */
export function cancelFreeTransform() {
  const ft = state.freeTransform;
  if (!ft) return false;
  const { w: gw, h: gh } = getGridDims();
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) state.grid[y][x] = ft.originalGrid[y][x];
  const activeLayer = state.layers?.[state.activeLayerIndex];
  if (activeLayer && ft.baseOutOfBounds) activeLayer.outOfBounds = ft.baseOutOfBounds.map((p) => [...p]);
  state.freeTransform = null;
  const canvasEl = typeof document !== "undefined" ? document.getElementById("paintCanvas") : null;
  if (canvasEl) canvasEl.style.cursor = getToolCursorCss(state.currentTool);
  updateToolOptionsUI(); renderAll();
  setStatus({ key: "log.ft_cancelled" });
  return true;
}

/** Cambia el submodo de transformación libre ("scale", "perspective", "symmetric"). */
export function setFreeTransformMode(mode) {
  if (!state.freeTransform) return;
  state.freeTransform.mode = ["scale", "perspective", "symmetric"].includes(mode) ? mode : "scale";
  updateToolOptionsUI();
}

/** Rota la transformación libre actual por un delta en grados alrededor de su centro. */
export function rotateFreeTransformBy(deltaDeg) {
  const ft = state.freeTransform;
  if (!ft) return;
  ft.corners = rotateCornersAroundCenter(ft.corners, (deltaDeg * Math.PI) / 180);
  ft.angleDeg = Math.round(((ft.angleDeg || 0) + deltaDeg) * 10) / 10;
  renderFreeTransformPreview();
  renderAll();
}

/** Detecta qué manija o zona de Transformación Libre se encuentra bajo `(gx, gy)`. */
export function hitTestFreeTransform(gx, gy) {
  const ft = state.freeTransform;
  if (!ft?.corners) return null;
  const corners = ft.corners, tol = Math.max(1.6, state.gridSize / 24), handles = getFreeTransformHandles(corners);
  for (const k of ["rot", "tl", "tr", "br", "bl", "t", "r", "b", "l"]) {
    if (Math.hypot(gx - handles[k].x, gy - handles[k].y) <= tol) return k;
  }
  const edgeTol = Math.max(1.2, state.gridSize / 32);
  if (distToSegment(gx, gy, corners[0].x, corners[0].y, corners[1].x, corners[1].y) <= edgeTol) return "t";
  if (distToSegment(gx, gy, corners[1].x, corners[1].y, corners[2].x, corners[2].y) <= edgeTol) return "r";
  if (distToSegment(gx, gy, corners[3].x, corners[3].y, corners[2].x, corners[2].y) <= edgeTol) return "b";
  if (distToSegment(gx, gy, corners[0].x, corners[0].y, corners[3].x, corners[3].y) <= edgeTol) return "l";
  return pointInQuad(gx, gy, corners) ? "move" : "rot";
}

/** Devuelve el cursor CSS adecuado según la zona de Transformación Libre bajo el puntero. */
export function getFreeTransformCursor(rawX, rawY, event) {
  const ft = state.freeTransform;
  if (!ft) return "";
  const hit = hitTestFreeTransform(rawX, rawY);
  const isCtrl = Boolean(event?.ctrlKey || event?.metaKey);
  const skewMode = isCtrl || ft.mode === "perspective" || ft.mode === "symmetric";
  if (hit === "tl" || hit === "br") return "nwse-resize";
  if (hit === "tr" || hit === "bl") return "nesw-resize";
  if (hit === "t" || hit === "b") return skewMode ? "ew-resize" : "ns-resize";
  if (hit === "l" || hit === "r") return skewMode ? "ns-resize" : "ew-resize";
  if (hit === "move") return isCtrl ? "ew-resize" : "move";
  return "grab";
}

/** Crea el controlador de interacción del mouse sobre el lienzo durante Transformación Libre. */
export function createFreeTransformController() {
  let dragType = null, startPos = null, startCorners = null, startAngle = 0;
  return {
    onDown({ rawX, rawY, button }) {
      const ft = state.freeTransform;
      if (!ft || button !== 0) return false;
      dragType = hitTestFreeTransform(rawX, rawY);
      startPos = { x: rawX, y: rawY };
      startCorners = ft.corners.map((c) => ({ ...c }));
      const cx = (startCorners[0].x + startCorners[1].x + startCorners[2].x + startCorners[3].x) / 4;
      const cy = (startCorners[0].y + startCorners[1].y + startCorners[2].y + startCorners[3].y) / 4;
      startAngle = Math.atan2(rawY - cy, rawX - cx);
      return true;
    },
    onMove({ rawX, rawY, event }) {
      const ft = state.freeTransform;
      if (!ft || !dragType || !startPos || !startCorners) return false;
      const dx = rawX - startPos.x, dy = rawY - startPos.y, c = startCorners.map((p) => ({ ...p }));
      const isCtrl = Boolean(event?.ctrlKey || event?.metaKey), isShift = Boolean(event?.shiftKey);
      const effectiveMode = isCtrl && isShift ? "symmetric" : isCtrl ? "perspective" : ft.mode;

      if (dragType === "move") {
        ft.corners = isCtrl
          ? c.map((p, i) => ({ x: p.x + (i < 2 ? dx * 0.5 : -dx * 0.5), y: p.y }))
          : c.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      } else if (dragType === "rot") {
        const cx = (c[0].x + c[1].x + c[2].x + c[3].x) / 4, cy = (c[0].y + c[1].y + c[2].y + c[3].y) / 4;
        let delta = Math.atan2(rawY - cy, rawX - cx) - startAngle;
        if (isShift) delta = Math.round(delta / (Math.PI / 12)) * (Math.PI / 12);
        ft.corners = rotateCornersAroundCenter(c, delta);
      } else if (["tl", "tr", "br", "bl"].includes(dragType)) {
        ft.corners = applyCornerDrag(c, dragType, dx, dy, effectiveMode, isShift);
      } else if (["t", "r", "b", "l"].includes(dragType)) {
        ft.corners = applyEdgeDrag(c, dragType, dx, dy, effectiveMode, isCtrl);
      }
      renderFreeTransformPreview();
      renderAll();
      return true;
    },
    onUp() { dragType = null; startPos = null; startCorners = null; },
  };
}
