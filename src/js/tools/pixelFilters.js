/**
 * pixelFilters.js: Filtros de píxeles y ajustes de color/textura (Jumble, Blur, Noise y HSL).
 */

import { state, getGridDims } from "../core/state.js";
import { parseColorToRgb, rgbToOklab } from "../core/color.js";
import { isInsideSelection, wrapCoordX, wrapCoordY } from "./selectionOps.js";

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
 * Jumble Tool: mezcla aleatoriamente (permutación Fisher-Yates) los píxeles dentro del pincel.
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

/**
 * Blur Tool: suaviza píxeles dentro del pincel promediando vecindad 3×3
 * y proyectando al índice más cercano de la paleta activa.
 * @param {number} cx
 * @param {number} cy
 * @param {number} [brushSize=state.brushSize]
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

function rgbToHsl(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s <= 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/**
 * Ajusta Tono (H), Saturación (S) y Brillo (L) sobre la capa o selección activa.
 * @param {{ hueShift?: number, satShift?: number, lightShift?: number, snapToPalette?: boolean }} [opts]
 * @returns {boolean}
 */
export function applyHslToRegion({ hueShift = 0, satShift = 0, lightShift = 0, snapToPalette = true } = {}) {
  if (hueShift === 0 && satShift === 0 && lightShift === 0) return false;
  const { w: gw, h: gh } = getGridDims();
  const entries = snapToPalette ? buildPaletteColorEntries({ withOklab: true }) : [];
  if (snapToPalette && entries.length === 0) return false;

  const existingByHex = new Map();
  let maxIdx = 39;
  if (!snapToPalette) {
    for (const [k, hex] of Object.entries(state.paletteMap || {})) {
      const n = Number(k);
      if (n !== 0 && n < 9000 && hex) {
        existingByHex.set(hex.toLowerCase(), n);
        if (n > maxIdx) maxIdx = n;
      }
    }
  }

  const remap = new Map();
  let changed = false;
  const toHex = (r, g, b) =>
    `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toLowerCase()}`;

  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (!isInsideSelection(x, y)) continue;
      const curIdx = state.grid[y][x];
      if (!curIdx) continue;

      let nextIdx = remap.get(curIdx);
      if (nextIdx === undefined) {
        const rgb = parseColorToRgb(state.paletteMap[curIdx]);
        if (!rgb) {
          nextIdx = curIdx;
        } else {
          const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
          const nh = (((h + hueShift / 360) % 1) + 1) % 1;
          const ns = Math.max(0, Math.min(1, s + satShift / 100));
          const nl = Math.max(0, Math.min(1, l + lightShift / 100));
          const [nr, ng, nb] = hslToRgb(nh, ns, nl);

          if (snapToPalette) {
            nextIdx = findNearestPaletteEntry(nr, ng, nb, entries, { useOklab: true });
          } else {
            const hex = toHex(nr, ng, nb);
            nextIdx = existingByHex.get(hex);
            if (nextIdx === undefined) {
              maxIdx += 1;
              state.paletteMap[maxIdx] = hex;
              existingByHex.set(hex, maxIdx);
              if (!state.customColorIndices.includes(maxIdx)) state.customColorIndices.push(maxIdx);
              nextIdx = maxIdx;
            }
          }
        }
        remap.set(curIdx, nextIdx);
      }

      if (nextIdx !== curIdx) {
        state.grid[y][x] = nextIdx;
        changed = true;
      }
    }
  }

  if (changed) state.isDirtySinceImport = true;
  return changed;
}
