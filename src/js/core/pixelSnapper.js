// @ts-check
/**
 * pixelSnapper.js: Algoritmo de 4 pasos (Quantize -> Edge Profiles -> Walk Cuts -> Mode Resampling)
 * para rescatar pixel art "messy" (IA, reescalados con mixels o compresión JPEG) a sprites 1:1 nítidos.
 */

import { extractAdaptivePalette, quantizeImageDataToPalette } from "./imageProcessor.js";

/**
 * Paso 1: Reduce colores cercanos en OKLab (sin dithering) para eliminar halos JPEG/antialiasing
 * antes de detectar los bordes de la grilla de píxeles.
 * @param {ImageData} imgData
 * @param {number} [maxColors=32]
 * @returns {ImageData}
 */
export function quantizeColorsForSnap(imgData, maxColors = 32) {
  const { width: w, height: h, data } = imgData;
  const paletteMap = extractAdaptivePalette(imgData, maxColors, 32) || { 0: null };
  const { grid } = quantizeImageDataToPalette(imgData, paletteMap, { alphaThreshold: 32, dither: false });
  const out = new ImageData(w, h);
  const outData = out.data;
  const rgbaCache = new Map();

  for (const [k, hex] of Object.entries(paletteMap)) {
    const idx = Number(k);
    if (!idx || !hex) continue;
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16) || 0;
    const g = parseInt(clean.slice(2, 4), 16) || 0;
    const b = parseInt(clean.slice(4, 6), 16) || 0;
    rgbaCache.set(idx, [r, g, b, 255]);
  }

  for (let y = 0; y < h; y++) {
    const row = grid[y];
    for (let x = 0; x < w; x++) {
      const idx = row[x];
      const o = (y * w + x) * 4;
      if (!idx) {
        outData[o] = 0;
        outData[o + 1] = 0;
        outData[o + 2] = 0;
        outData[o + 3] = 0;
      } else {
        const rgba = rgbaCache.get(idx) || [data[o], data[o + 1], data[o + 2], 255];
        outData[o] = rgba[0];
        outData[o + 1] = rgba[1];
        outData[o + 2] = rgba[2];
        outData[o + 3] = rgba[3];
      }
    }
  }
  return out;
}

/**
 * Paso 2: Calcula los perfiles de energía de borde horizontal (`profileX`) y vertical (`profileY`).
 * @param {ImageData} imgData
 * @returns {{ profileX: Float64Array, profileY: Float64Array }}
 */
export function computeEdgeProfiles(imgData) {
  const { width: w, height: h, data } = imgData;
  const profileX = new Float64Array(w);
  const profileY = new Float64Array(h);

  for (let y = 0; y < h; y++) {
    const rowBase = y * w * 4;
    for (let x = 1; x < w; x++) {
      const i1 = rowBase + x * 4;
      const i0 = i1 - 4;
      const diff =
        Math.abs(data[i1] - data[i0]) +
        Math.abs(data[i1 + 1] - data[i0 + 1]) +
        Math.abs(data[i1 + 2] - data[i0 + 2]) +
        2 * Math.abs(data[i1 + 3] - data[i0 + 3]);
      profileX[x] += diff;
    }
  }

  for (let y = 1; y < h; y++) {
    const row1 = y * w * 4;
    const row0 = (y - 1) * w * 4;
    for (let x = 0; x < w; x++) {
      const i1 = row1 + x * 4;
      const i0 = row0 + x * 4;
      const diff =
        Math.abs(data[i1] - data[i0]) +
        Math.abs(data[i1 + 1] - data[i0 + 1]) +
        Math.abs(data[i1 + 2] - data[i0 + 2]) +
        2 * Math.abs(data[i1 + 3] - data[i0 + 3]);
      profileY[y] += diff;
    }
  }

  return { profileX, profileY };
}

function estimateDominantStep(profile, length) {
  let maxVal = 0;
  for (let i = 1; i < length; i++) {
    if (profile[i] > maxVal) maxVal = profile[i];
  }
  if (maxVal <= 0) return Math.max(1, length / 64);

  const threshold = maxVal * 0.12;
  const peaks = [];
  for (let i = 1; i < length - 1; i++) {
    if (profile[i] >= threshold && profile[i] >= profile[i - 1] && profile[i] >= profile[i + 1]) {
      peaks.push(i);
    }
  }
  if (peaks.length < 3) return Math.max(2, length / 64);

  const gaps = new Map();
  for (let i = 1; i < peaks.length; i++) {
    const gap = peaks[i] - peaks[i - 1];
    if (gap >= 2 && gap <= Math.min(64, Math.floor(length / 4))) {
      gaps.set(gap, (gaps.get(gap) || 0) + 1);
    }
  }
  if (gaps.size === 0) return Math.max(2, length / 64);

  let bestGap = 4;
  let bestScore = -1;
  for (const [gap, count] of gaps.entries()) {
    const neighborCount = count + (gaps.get(gap - 1) || 0) * 0.5 + (gaps.get(gap + 1) || 0) * 0.5;
    if (neighborCount > bestScore) {
      bestScore = neighborCount;
      bestGap = gap;
    }
  }
  return Math.max(1.5, bestGap);
}

/**
 * Paso 3: Camina sobre el perfil de bordes eligiendo cortes óptimos `cuts[]` con tolerancia a mixels.
 * @param {Float64Array} profile
 * @param {number} length
 * @param {number} step
 * @returns {number[]}
 */
export function walkCuts(profile, length, step) {
  const safeStep = Math.max(1, step);
  const cuts = [0];
  let cur = 0;

  while (cur + safeStep * 1.35 < length) {
    const ideal = cur + safeStep;
    const minSearch = Math.max(cur + 1, Math.floor(cur + safeStep * 0.65));
    const maxSearch = Math.min(length - Math.max(1, Math.floor(safeStep * 0.55)), Math.ceil(cur + safeStep * 1.35));
    if (minSearch > maxSearch) break;

    let bestPos = Math.round(ideal);
    let bestScore = -1;
    for (let p = minSearch; p <= maxSearch; p++) {
      const distPenalty = 1 - (Math.abs(p - ideal) / (safeStep * 0.7)) * 0.25;
      const score = (profile[p] + 1) * distPenalty;
      if (score > bestScore) {
        bestScore = score;
        bestPos = p;
      }
    }
    if (bestPos <= cur) bestPos = cur + 1;
    if (bestPos >= length) break;
    cuts.push(bestPos);
    cur = bestPos;
  }

  if (cuts[cuts.length - 1] !== length) {
    cuts.push(length);
  }
  return cuts;
}

/**
 * Paso 4: Remuestrea cada celda `[cutsX[i]..cutsX[i+1]] × [cutsY[j]..cutsY[j+1]]` tomando el color modal.
 * @param {ImageData} imgData
 * @param {number[]} cutsX
 * @param {number[]} cutsY
 * @returns {ImageData}
 */
export function resampleByMode(imgData, cutsX, cutsY) {
  const srcW = imgData.width;
  const data = imgData.data;
  const outW = Math.max(1, cutsX.length - 1);
  const outH = Math.max(1, cutsY.length - 1);
  const out = new ImageData(outW, outH);
  const outData = out.data;

  for (let cy = 0; cy < outH; cy++) {
    const y0 = cutsY[cy];
    const y1 = Math.max(y0 + 1, cutsY[cy + 1]);
    for (let cx = 0; cx < outW; cx++) {
      const x0 = cutsX[cx];
      const x1 = Math.max(x0 + 1, cutsX[cx + 1]);
      const counts = new Map();
      let transparentCount = 0;
      let totalCount = 0;

      for (let y = y0; y < y1; y++) {
        const rowOff = y * srcW * 4;
        for (let x = x0; x < x1; x++) {
          const o = rowOff + x * 4;
          totalCount++;
          if (data[o + 3] < 128) {
            transparentCount++;
            continue;
          }
          const key = ((data[o] << 16) | (data[o + 1] << 8) | data[o + 2]) >>> 0;
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }

      const dstOff = (cy * outW + cx) * 4;
      if (counts.size === 0 || transparentCount > totalCount * 0.55) {
        outData[dstOff] = 0;
        outData[dstOff + 1] = 0;
        outData[dstOff + 2] = 0;
        outData[dstOff + 3] = 0;
        continue;
      }

      let bestKey = 0;
      let bestCount = -1;
      for (const [key, cnt] of counts.entries()) {
        if (cnt > bestCount) {
          bestCount = cnt;
          bestKey = key;
        }
      }
      outData[dstOff] = (bestKey >> 16) & 255;
      outData[dstOff + 1] = (bestKey >> 8) & 255;
      outData[dstOff + 2] = bestKey & 255;
      outData[dstOff + 3] = 255;
    }
  }

  return out;
}

/**
 * Ejecuta el pipeline completo de Pixel Snapper (Quantize -> Edge Profiles -> Walk Cuts -> Mode Resampling).
 * @param {ImageData} imgData
 * @param {{ targetSize?: number|null, maxColors?: number }} [options]
 * @returns {{ imgData: ImageData, width: number, height: number }}
 */
export function snapMessyPixelArt(imgData, { targetSize = null, maxColors = 32 } = {}) {
  const { width: w, height: h } = imgData;
  const quantized = quantizeColorsForSnap(imgData, maxColors);
  const { profileX, profileY } = computeEdgeProfiles(quantized);

  let stepX;
  let stepY;
  if (targetSize && targetSize >= 4) {
    stepX = w / targetSize;
    stepY = h / targetSize;
  } else {
    const estX = estimateDominantStep(profileX, w);
    const estY = estimateDominantStep(profileY, h);
    const unified = Math.abs(estX - estY) <= 1.5 ? (estX + estY) / 2 : estX;
    stepX = unified;
    stepY = Math.abs(estX - estY) <= 1.5 ? unified : estY;
  }

  const cutsX = walkCuts(profileX, w, stepX);
  const cutsY = walkCuts(profileY, h, stepY);
  const snapped = resampleByMode(quantized, cutsX, cutsY);
  return { imgData: snapped, width: snapped.width, height: snapped.height };
}
