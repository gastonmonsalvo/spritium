/**
 * tools.js: Trazado Bresenham, simetría, pinceles, Jumble, Blur y Spray,
 * más fachada de re-exportación para selectionOps.js y floodAndColorTools.js.
 */

import {
  state,
  pushState,
  getGridDims,
  isSymmetryActive,
  getSymmetryPoints,
} from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { parseColorToRgb, rgbToOklab } from "../core/color.js";
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
 * Jumble Tool: mezcla aleatoriamente los píxeles dentro del área del pincel.
 * @param {number} cx
 * @param {number} cy
 * @param {number} [brushSize=state.brushSize]
 */
export function applyJumbleAt(cx, cy, brushSize = state.brushSize) {
  const { w: gw, h: gh } = getGridDims();
  const radius = Math.max(1, Math.floor(Math.max(1, brushSize) / 2));
  const coords = [];
  const vals = [];

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = wrapCoordX(cx + dx, gw);
      const y = wrapCoordY(cy + dy, gh);
      if (x < 0 || x >= gw || y < 0 || y >= gh) continue;
      if (!isInsideSelection(x, y)) continue;
      coords.push([x, y]);
      vals.push(state.grid[y][x]);
    }
  }

  if (coords.length < 2) return;
  for (let i = coords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = vals[i];
    vals[i] = vals[j];
    vals[j] = tmp;
  }
  for (let i = 0; i < coords.length; i++) {
    const [x, y] = coords[i];
    state.grid[y][x] = vals[i];
  }
  state.isDirtySinceImport = true;
}

function buildPaletteColorEntries({ withOklab = false } = {}) {
  const entries = [];
  for (const [k, hex] of Object.entries(state.paletteMap || {})) {
    const idx = Number(k);
    if (idx <= 0 || !hex) continue;
    const rgb = parseColorToRgb(hex);
    if (!rgb) continue;
    entries.push(withOklab ? { idx, rgb, lab: rgbToOklab(rgb[0], rgb[1], rgb[2]) } : { idx, rgb });
  }
  return entries;
}

function findNearestPaletteEntry(r, g, b, entries, { useOklab = false } = {}) {
  if (!entries.length) return 0;
  let bestIdx = entries[0].idx;
  let bestDist = Infinity;
  if (useOklab) {
    const [tL, tA, tB] = rgbToOklab(r, g, b);
    for (const entry of entries) {
      const dL = tL - entry.lab[0];
      const da = tA - entry.lab[1];
      const db = tB - entry.lab[2];
      const d = dL * dL + da * da + db * db;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = entry.idx;
      }
    }
    return bestIdx;
  }
  for (const entry of entries) {
    const dr = r - entry.rgb[0];
    const dg = g - entry.rgb[1];
    const db = b - entry.rgb[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = entry.idx;
    }
  }
  return bestIdx;
}

function createMulberry32(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Blur Tool: suaviza píxeles dentro del pincel promediando vecindad 3×3
 * y proyectando al índice más cercano de la paleta activa.
 */
export function applyBlurAt(cx, cy, brushSize = state.brushSize) {
  const { w: gw, h: gh } = getGridDims();
  const radius = Math.max(0, Math.floor(Math.max(1, brushSize) / 2));

  const paletteEntries = buildPaletteColorEntries();
  if (paletteEntries.length === 0) return;

  const updates = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = wrapCoordX(cx + dx, gw);
      const y = wrapCoordY(cy + dy, gh);
      if (x < 0 || x >= gw || y < 0 || y >= gh) continue;
      if (!isInsideSelection(x, y)) continue;
      if (state.grid[y][x] === 0) continue;

      let sumR = 0, sumG = 0, sumB = 0, weightSum = 0;
      for (let ny = -1; ny <= 1; ny++) {
        for (let nx = -1; nx <= 1; nx++) {
          const sx = x + nx;
          const sy = y + ny;
          if (sx < 0 || sx >= gw || sy < 0 || sy >= gh) continue;
          const sIdx = state.grid[sy][sx];
          if (!sIdx) continue;
          const sRgb = parseColorToRgb(state.paletteMap[sIdx]);
          if (!sRgb) continue;
          const w = nx === 0 && ny === 0 ? 2 : 1;
          sumR += sRgb[0] * w;
          sumG += sRgb[1] * w;
          sumB += sRgb[2] * w;
          weightSum += w;
        }
      }

      if (weightSum === 0) continue;
      const bestIdx = findNearestPaletteEntry(sumR / weightSum, sumG / weightSum, sumB / weightSum, paletteEntries);
      updates.push([x, y, bestIdx]);
    }
  }

  for (const [x, y, idx] of updates) {
    state.grid[y][x] = idx;
  }
  if (updates.length > 0) state.isDirtySinceImport = true;
}

/**
 * Noise Brush: aplica textura de ruido cuantizada en OKLab a la paleta activa dentro del pincel.
 * @param {number} cx
 * @param {number} cy
 * @param {number} [brushSize=state.brushSize]
 */
export function applyNoiseAt(cx, cy, brushSize = state.brushSize) {
  const { w: gw, h: gh } = getGridDims();
  const radius = Math.max(0, Math.floor(Math.max(1, brushSize) / 2));
  const entries = buildPaletteColorEntries({ withOklab: true });
  if (!entries.length) return;

  const updates = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = wrapCoordX(cx + dx, gw);
      const y = wrapCoordY(cy + dy, gh);
      if (x < 0 || x >= gw || y < 0 || y >= gh) continue;
      if (!isInsideSelection(x, y)) continue;
      const curIdx = state.grid[y][x];
      if (!curIdx) continue;
      const rgb = parseColorToRgb(state.paletteMap[curIdx]);
      if (!rgb) continue;
      if (Math.random() > 0.55) continue;
      const sign = Math.random() < 0.5 ? -1 : 1;
      const delta = sign * (28 + Math.random() * 64);
      const nr = Math.max(0, Math.min(255, rgb[0] + delta));
      const ng = Math.max(0, Math.min(255, rgb[1] + delta));
      const nb = Math.max(0, Math.min(255, rgb[2] + delta));
      updates.push([x, y, findNearestPaletteEntry(nr, ng, nb, entries, { useOklab: true })]);
    }
  }

  for (const [x, y, idx] of updates) {
    state.grid[y][x] = idx;
  }
  if (updates.length > 0) state.isDirtySinceImport = true;
}

/**
 * Filtro de Ruido Pixel-Art Safe para la capa o selección activa, cuantizando en OKLab
 * a los colores de la paleta activa para no introducir colores sucios.
 * @param {{intensity?: number, paintedOnly?: boolean, monochrome?: boolean, seed?: number}} [options]
 * @returns {boolean} True si se modificó al menos un píxel.
 */
export function applyNoiseToRegion({ intensity = 25, paintedOnly = true, monochrome = true, seed = 1 } = {}) {
  const { w: gw, h: gh } = getGridDims();
  const entries = buildPaletteColorEntries({ withOklab: true });
  if (!entries.length) return false;

  const rand = createMulberry32(seed);
  const strength = Math.max(0.05, Math.min(1, (Number(intensity) || 25) / 100)) * 96;
  const fallbackRgb = parseColorToRgb(state.paletteMap[state.currentColorIndex]) || [128, 128, 128];
  let changed = false;

  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (!isInsideSelection(x, y)) continue;
      const curIdx = state.grid[y][x];
      if (paintedOnly && !curIdx) continue;
      const baseRgb = curIdx ? parseColorToRgb(state.paletteMap[curIdx]) || fallbackRgb : fallbackRgb;
      const dR = (rand() * 2 - 1) * strength;
      const dG = monochrome ? dR : (rand() * 2 - 1) * strength;
      const dB = monochrome ? dR : (rand() * 2 - 1) * strength;
      const nr = Math.max(0, Math.min(255, baseRgb[0] + dR));
      const ng = Math.max(0, Math.min(255, baseRgb[1] + dG));
      const nb = Math.max(0, Math.min(255, baseRgb[2] + dB));
      const nextIdx = findNearestPaletteEntry(nr, ng, nb, entries, { useOklab: true });
      if (nextIdx !== curIdx) {
        state.grid[y][x] = nextIdx;
        changed = true;
      }
    }
  }

  if (changed) state.isDirtySinceImport = true;
  return changed;
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

