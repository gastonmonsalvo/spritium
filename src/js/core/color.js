/**
 * color.js: Utilidades puras de color, espacio perceptual OKLab y cuantización con Bayer 4x4.
 * Sin dependencias de DOM ni de estado global.
 */

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => v / 16 - 0.5));

const BAYER_8X8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
].map((row) => row.map((v) => v / 64 - 0.5));

export const DITHER_STRATEGIES = {
  none: () => 0,
  bayer4: (x, y) => BAYER_4X4[y & 3][x & 3],
  bayer8: (x, y) => BAYER_8X8[y & 7][x & 7],
};

/**
 * Parsea un color CSS (#rrggbb, #rrggbbaa, #rgb, rgb(...) o rgba(...)) a [r, g, b, a] (0-255).
 * Devuelve null si es nulo o completamente transparente (a === 0).
 * @param {string} colorStr
 */
export function parseColorToRgba(colorStr) {
  if (!colorStr || typeof colorStr !== "string") return null;
  const s = colorStr.trim().toLowerCase();

  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (hex.length !== 6 && hex.length !== 8) return null;
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255;
    if (Number.isNaN(a) || a === 0) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return [r, g, b, a];
  }

  const match = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (match) {
    const alphaFloat = match[4] !== undefined ? parseFloat(match[4]) : 1;
    const a = Math.max(0, Math.min(255, Math.round(alphaFloat * 255)));
    if (a === 0) return null;
    return [
      Math.round(parseFloat(match[1])),
      Math.round(parseFloat(match[2])),
      Math.round(parseFloat(match[3])),
      a,
    ];
  }

  return null;
}

/**
 * Parsea un color CSS (#rrggbb, #rgb, rgb(...) o rgba(...)) a [r, g, b].
 * Devuelve null si es nulo o transparente.
 * @param {number} colorStr
 */
export function parseColorToRgb(colorStr) {
  const rgba = parseColorToRgba(colorStr);
  return rgba ? [rgba[0], rgba[1], rgba[2]] : null;
}

function srgbToLinear(c) {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

/**
 * Convierte sRGB (0-255) al espacio perceptual uniforme OKLab.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function rgbToOklab(r, g, b) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Cuantiza una grilla de índices y su paleta fuente hacia una paleta destino
 * usando distancia euclidiana en OKLab y dithering ordenado Bayer 4x4 opcional.
 */
export function quantizeGrid(
  sourceGrid,
  sourcePaletteMap,
  targetPaletteMap,
  { dither = false, ditherMode = null, ditherStrength = 24 } = {},
) {
  const targetEntries = [];
  const normalizedTargetPalette = { 0: null };

  for (const [idxStr, colorVal] of Object.entries(targetPaletteMap || {})) {
    const idx = Number(idxStr);
    if (idx === 0 || !colorVal) continue;
    const rgb = parseColorToRgb(colorVal);
    if (!rgb) continue;
    normalizedTargetPalette[idx] = colorVal;
    targetEntries.push({
      idx,
      lab: rgbToOklab(rgb[0], rgb[1], rgb[2]),
    });
  }

  if (targetEntries.length === 0) {
    return {
      grid: sourceGrid.map((row) => [...row]),
      paletteMap: { ...normalizedTargetPalette },
    };
  }

  const sourceRgbCache = new Map();
  for (const [idxStr, colorVal] of Object.entries(sourcePaletteMap || {})) {
    const idx = Number(idxStr);
    if (idx === 0 || !colorVal) continue;
    const rgb = parseColorToRgb(colorVal);
    if (rgb) sourceRgbCache.set(idx, rgb);
  }

  const nearestCache = new Map();
  const findNearestIndex = (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    const cached = nearestCache.get(key);
    if (cached !== undefined) return cached;

    const [pL, pA, pB] = rgbToOklab(r, g, b);
    let bestDist = Infinity;
    let bestIdx = targetEntries[0].idx;

    for (let i = 0; i < targetEntries.length; i++) {
      const [tL, tA, tB] = targetEntries[i].lab;
      const dL = pL - tL;
      const dA = pA - tA;
      const dB = pB - tB;
      const dist = dL * dL + dA * dA + dB * dB;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = targetEntries[i].idx;
      }
    }

    nearestCache.set(key, bestIdx);
    return bestIdx;
  };

  const mode =
    ditherMode && DITHER_STRATEGIES[ditherMode]
      ? ditherMode
      : dither
        ? "bayer4"
        : "none";
  const ditherFn = DITHER_STRATEGIES[mode];
  const useDither = mode !== "none";

  const size = sourceGrid.length;
  const newGrid = Array.from({ length: size }, (_, y) => {
    const row = new Array(size);
    const srcRow = sourceGrid[y];
    for (let x = 0; x < size; x++) {
      const oldIdx = srcRow[x];
      if (oldIdx === 0) {
        row[x] = 0;
        continue;
      }
      const rgb = sourceRgbCache.get(oldIdx);
      if (!rgb) {
        row[x] = 0;
        continue;
      }

      if (useDither) {
        const bias = ditherFn(x, y) * ditherStrength;
        const r = clampByte(Math.round(rgb[0] + bias));
        const g = clampByte(Math.round(rgb[1] + bias));
        const b = clampByte(Math.round(rgb[2] + bias));
        row[x] = findNearestIndex(r, g, b);
      } else {
        row[x] = findNearestIndex(rgb[0], rgb[1], rgb[2]);
      }
    }
    return row;
  });

  return { grid: newGrid, paletteMap: normalizedTargetPalette };
}

/**
 * Indica si la grilla contiene al menos un píxel no transparente.
 * @param {number[][]} grid
 */
export function hasPaintedPixels(grid) {
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== 0) return true;
    }
  }
  return false;
}

/**
 * Busca el siguiente índice más claro (+1) u oscuro (-1) dentro de `paletteMap`
 * preservando matiz/croma en el espacio perceptual OKLab (Shading Mode).
 * @param {number} currentIdx
 * @param {Record<number, string|null>} paletteMap
 * @param {1|-1} direction +1 para iluminar, -1 para oscurecer.
 * @returns {number}
 */
export function findShadedColorIndex(currentIdx, paletteMap, direction) {
  if (!currentIdx || !paletteMap?.[currentIdx]) return currentIdx;
  const curRgb = parseColorToRgb(paletteMap[currentIdx]);
  if (!curRgb) return currentIdx;
  const [curL, curA, curB] = rgbToOklab(curRgb[0], curRgb[1], curRgb[2]);

  let bestIdx = currentIdx;
  let bestScore = Infinity;

  for (const [idxStr, col] of Object.entries(paletteMap)) {
    const idx = Number(idxStr);
    if (idx === 0 || idx === currentIdx || !col) continue;
    const rgb = parseColorToRgb(col);
    if (!rgb) continue;
    const [L, a, b] = rgbToOklab(rgb[0], rgb[1], rgb[2]);

    const dL = L - curL;
    if (direction > 0 && dL <= 0.025) continue;
    if (direction < 0 && dL >= -0.025) continue;

    // Penaliza saltos grandes de luminancia y prioriza cercanía de matiz (a, b)
    const chromaDistSq = (a - curA) ** 2 + (b - curB) ** 2;
    const score = chromaDistSq * 4.0 + Math.abs(dL);
    if (score < bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  return bestIdx;
}

/**
 * Convierte un color RGB (0..255) a HSL ([0..360, 0..100, 0..100]).
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
export function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Convierte un color HSL a RGB (0..255).
 * @param {number} h
 * @param {number} s
 * @param {number} l
 */
export function hslToRgb(h, s, l) {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  return [
    Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hn) * 255),
    Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  ];
}
