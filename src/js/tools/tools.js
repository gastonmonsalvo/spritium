/**
 * tools.js: Trazado Bresenham, simetría, pinceles y Spray,
 * más fachada de re-exportación para selectionOps.js, floodAndColorTools.js y pixelFilters.js.
 */

import {
  state,
  pushState,
  getGridDims,
  isSymmetryActive,
  getSymmetryPoints,
} from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import {
  getActiveRegion,
  isInsideSelection,
  cloneSelection,
  getSelectionMode,
  combineSelections,
  wrapCoordX,
  wrapCoordY,
  clearSelection,
  magicSelectAt,
  selectAll,
  invertSelection,
} from "./selectionOps.js";
import {
  floodFill,
  pickColorAt,
  removeConnectedColor,
  replaceColorInActiveLayer,
  replaceColorWithTransparent,
} from "./floodAndColorTools.js";
import {
  applyJumbleAt,
  applyBlurAt,
  applyNoiseAt,
  applyNoiseToRegion,
  applyHslToRegion,
} from "./pixelFilters.js";

export {
  getActiveRegion,
  isInsideSelection,
  cloneSelection,
  getSelectionMode,
  combineSelections,
  wrapCoordX,
  wrapCoordY,
  clearSelection,
  magicSelectAt,
  selectAll,
  invertSelection,
  floodFill,
  pickColorAt,
  removeConnectedColor,
  replaceColorInActiveLayer,
  replaceColorWithTransparent,
  applyJumbleAt,
  applyBlurAt,
  applyNoiseAt,
  applyNoiseToRegion,
  applyHslToRegion,
};

/**
 * Pinta un píxel en (x, y) aplicando espejado horizontal/vertical.
 * @param {number} x
 * @param {number} y
 * @param {number} colorIndex
 */
export function plotWithMirror(x, y, colorIndex) {
  const { w, h } = getGridDims();
  const wx = wrapCoordX(x, w);
  const wy = wrapCoordY(y, h);
  const symPoints = getSymmetryPoints(wx, wy, w, h);

  for (const [rawPx, rawPy] of symPoints) {
    const px = state.tiledMode === "x" || state.tiledMode === "both" ? wrapCoordX(rawPx, w) : rawPx;
    const py = state.tiledMode === "y" || state.tiledMode === "both" ? wrapCoordY(rawPy, h) : rawPy;
    if (px < 0 || px >= w || py < 0 || py >= h) continue;
    if (isInsideSelection(px, py) && state.grid[py]?.[px] !== undefined) {
      state.grid[py][px] = colorIndex;
    }
  }
}

/**
 * Calcula los desplazamientos relativos [start, end] para un pincel/grosor cuadrado de `size` px.
 * @param {number} [size=state.brushSize]
 * @returns {{start: number, end: number, size: number}}
 */
export function getBrushOffsets(size = state.brushSize) {
  const clamped = Math.max(1, Math.min(256, Math.round(Number(size) || 1)));
  const start = -Math.floor((clamped - 1) / 2);
  return { start, end: start + clamped - 1, size: clamped };
}

/**
 * Pinta un sello de grosor `brushSize` centrado en (cx, cy) respetando selección y espejos H/V.
 * @param {number} cx
 * @param {number} cy
 * @param {number} colorIndex
 * @param {number} [brushSize=state.brushSize]
 */
function matchesBrushPattern(x, y, pattern) {
  if (!pattern || pattern === "solid") return true;
  if (pattern === "checker") return ((x + y) & 1) === 0;
  if (pattern === "diag") return (((x + y) % 3) + 3) % 3 === 0;
  if (pattern === "dots") return (x & 1) === 0 && (y & 1) === 0;
  return true;
}

function resolveColorIndexForHex(hex) {
  const norm = String(hex || "").toLowerCase();
  for (const [k, v] of Object.entries(state.paletteMap)) {
    const num = Number(k);
    if (num > 0 && v && v.toLowerCase() === norm) return num;
  }
  const existingKeys = Object.keys(state.paletteMap).map(Number).filter((n) => n > 0);
  const nextIdx = existingKeys.length ? Math.max(...existingKeys) + 1 : 1;
  state.paletteMap[nextIdx] = norm;
  return nextIdx;
}

const BRUSH_PATTERN_TOOLS = new Set(["pencil", "line", "rect", "circle", "triangle"]);

/**
 * Pinta un sello de pincel (estándar o personalizado) respetando los ejes de simetría.
 * @param {number} cx
 * @param {number} cy
 * @param {number} colorIndex
 * @param {number} [brushSize=state.brushSize]
 */
export function plotBrushWithMirror(cx, cy, colorIndex, brushSize = state.brushSize) {
  const allowBrushPattern = BRUSH_PATTERN_TOOLS.has(state.currentTool);

  if (colorIndex !== 0 && allowBrushPattern && state.activeCustomBrushId) {
    const brush = (state.customBrushes || []).find((b) => b.id === state.activeCustomBrushId);
    if (brush?.pixels?.length) {
      const useOrigColor = state.customBrushMode === "color";
      const bw = Math.max(1, Number(brush.w) || 1);
      const bh = Math.max(1, Number(brush.h) || 1);
      const nativeSize = Math.max(bw, bh);
      const targetSize = Math.max(1, Math.round(Number(brushSize) || nativeSize));

      if (targetSize === nativeSize) {
        for (const p of brush.pixels) {
          const idx = useOrigColor ? resolveColorIndexForHex(p.hex) : colorIndex;
          plotWithMirror(cx + p.dx, cy + p.dy, idx);
        }
        return;
      }

      // Escalar el pincel personalizado proporcionalmente al tamaño de pincel elegido (Nearest-Neighbor)
      const halfSrcW = Math.floor(bw / 2);
      const halfSrcH = Math.floor(bh / 2);
      const srcMap = new Map();
      for (const p of brush.pixels) {
        const sx = p.dx + halfSrcW;
        const sy = p.dy + halfSrcH;
        srcMap.set(`${sx},${sy}`, p.hex);
      }

      const scale = targetSize / nativeSize;
      const dstW = Math.max(1, Math.round(bw * scale));
      const dstH = Math.max(1, Math.round(bh * scale));
      const halfDstW = Math.floor(dstW / 2);
      const halfDstH = Math.floor(dstH / 2);

      for (let dy = 0; dy < dstH; dy++) {
        const sy = Math.min(bh - 1, Math.floor((dy / dstH) * bh));
        for (let dx = 0; dx < dstW; dx++) {
          const sx = Math.min(bw - 1, Math.floor((dx / dstW) * bw));
          const hex = srcMap.get(`${sx},${sy}`);
          if (!hex) continue;
          const idx = useOrigColor ? resolveColorIndexForHex(hex) : colorIndex;
          plotWithMirror(cx + (dx - halfDstW), cy + (dy - halfDstH), idx);
        }
      }
      return;
    }
  }

  const pat = allowBrushPattern ? (state.activeBrushPattern || "solid") : "solid";
  const { start, end, size } = getBrushOffsets(brushSize);
  if (size <= 1) {
    if (colorIndex === 0 || matchesBrushPattern(cx, cy, pat)) {
      plotWithMirror(cx, cy, colorIndex);
    }
    return;
  }
  for (let dy = start; dy <= end; dy++) {
    for (let dx = start; dx <= end; dx++) {
      const px = cx + dx;
      const py = cy + dy;
      if (colorIndex === 0 || matchesBrushPattern(px, py, pat)) {
        plotWithMirror(px, py, colorIndex);
      }
    }
  }
}

/**
 * Recorre todos los puntos enteros entre (x0, y0) y (x1, y1) con el algoritmo de Bresenham.
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {(x: number, y: number) => void} onPoint
 */
export function traceBresenhamPoints(x0, y0, x1, y1, onPoint) {
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    onPoint(cx, cy);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
}

/**
 * Copia in-place un snapshot de grilla dentro de la capa activa sin romper la referencia.
 * @param {number[][]} baseGrid
 */
export function restoreActiveLayerFromSnapshot(baseGrid) {
  const { w, h } = getGridDims();
  for (let y = 0; y < h; y++) {
    const srcRow = baseGrid[y];
    const dstRow = state.grid[y];
    if (!srcRow || !dstRow) continue;
    for (let x = 0; x < w; x++) {
      dstRow[x] = srcRow[x];
    }
  }
}

/**
 * Aplica la herramienta de pincel, goma o tarro en la coordenada (x, y).
 * @param {number} x
 * @param {number} y
 * @param {boolean} [isRightClick=false]
 */
export function applyToolAt(x, y, isRightClick = false) {
  const tx = wrapCoordX(x);
  const ty = wrapCoordY(y);
  const colorIndex =
    state.currentTool === "eraser"
      ? 0
      : isRightClick
        ? (state.secondaryColorIndex ?? 0)
        : state.currentColorIndex;

  if (state.currentTool === "bucket") {
    if (!isInsideSelection(tx, ty)) return;
    pushState();
    floodFill(tx, ty, colorIndex);
    state.isDirtySinceImport = true;
    renderAll();
    return;
  }

  const size = Math.max(1, Math.round(state.brushSize || 1));
  if (size <= 1) {
    if (!isInsideSelection(tx, ty)) return;
    if (!state.grid[ty] || state.grid[ty][tx] === undefined) return;
    if (state.grid[ty][tx] === colorIndex && !isSymmetryActive()) return;
  }

  plotBrushWithMirror(tx, ty, colorIndex, size);
  state.isDirtySinceImport = true;
  renderAll();
}

/**
 * Spray Tool (Aerógrafo): rocía píxeles aleatorios dentro de un disco de diámetro `brushSize`
 * con distribución uniforme (`r = R * sqrt(random)`).
 */
export function applySprayAt(cx, cy, colorIndex, brushSize = state.brushSize, density = 0.25) {
  const diameter = Math.max(2, Math.round(brushSize));
  const radius = diameter / 2;
  const area = Math.PI * radius * radius;
  const drops = Math.max(1, Math.round(area * Math.max(0.05, Math.min(1, density)) * 0.35));

  for (let i = 0; i < drops; i++) {
    const r = radius * Math.sqrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const px = Math.round(cx + r * Math.cos(theta));
    const py = Math.round(cy + r * Math.sin(theta));
    plotWithMirror(px, py, colorIndex);
  }
  state.isDirtySinceImport = true;
}

