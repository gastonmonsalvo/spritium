/**
 * imageProcessor.js: Procesamiento de imágenes 100% Client-Side (Canvas + OKLab + K-Means++).
 * Reemplaza a pixel_processor.py para permitir hosting estático sin backend Python.
 */

import { rgbToOklab, parseColorToRgb, DITHER_STRATEGIES } from "./color.js";
import { MAX_GRID_DIM } from "./stateStore.js";

function toHex(r, g, b) {
  return (
    "#" +
    ((1 << 24) | (r << 16) | (g << 8) | b)
      .toString(16)
      .slice(1)
  );
}

/**
 * Inunda desde los 4 bordes del ImageData para volver transparente el fondo conectado.
 * @param {ImageData} imgData
 * @param {number} [tolerance=40]
 * @returns {ImageData}
 */
export function removeConnectedBackground(imgData, tolerance = 40) {
  const { width: w, height: h, data } = imgData;
  const borderR = [];
  const borderG = [];
  const borderB = [];

  for (let x = 0; x < w; x++) {
    const topIdx = x * 4;
    const botIdx = ((h - 1) * w + x) * 4;
    borderR.push(data[topIdx], data[botIdx]);
    borderG.push(data[topIdx + 1], data[botIdx + 1]);
    borderB.push(data[topIdx + 2], data[botIdx + 2]);
  }
  for (let y = 0; y < h; y++) {
    const leftIdx = (y * w) * 4;
    const rightIdx = (y * w + (w - 1)) * 4;
    borderR.push(data[leftIdx], data[rightIdx]);
    borderG.push(data[leftIdx + 1], data[rightIdx + 1]);
    borderB.push(data[leftIdx + 2], data[rightIdx + 2]);
  }

  const median = (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] || 0;
  };
  const bgR = median(borderR);
  const bgG = median(borderG);
  const bgB = median(borderB);
  const tolSq = tolerance * tolerance;

  const isBg = (pixelIndex) => {
    const o = pixelIndex * 4;
    if (data[o + 3] < 16) return true;
    const dr = data[o] - bgR;
    const dg = data[o + 1] - bgG;
    const db = data[o + 2] - bgB;
    return dr * dr + dg * dg + db * db < tolSq;
  };

  const bgMask = new Uint8Array(w * h);
  const queue = [];
  let head = 0;

  const trySeed = (x, y) => {
    const idx = y * w + x;
    if (!bgMask[idx] && isBg(idx)) {
      bgMask[idx] = 1;
      queue.push(x, y);
    }
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  while (head < queue.length) {
    const cx = queue[head++];
    const cy = queue[head++];
    if (cx > 0) trySeed(cx - 1, cy);
    if (cx < w - 1) trySeed(cx + 1, cy);
    if (cy > 0) trySeed(cx, cy - 1);
    if (cy < h - 1) trySeed(cx, cy + 1);
  }

  const out = new ImageData(new Uint8ClampedArray(data), w, h);
  for (let i = 0; i < w * h; i++) {
    if (bgMask[i]) out.data[i * 4 + 3] = 0;
  }
  return out;
}

function computeContainedRect(srcW, srcH, dstW, dstH) {
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const drawW = Math.max(1, Math.round(srcW * scale));
  const drawH = Math.max(1, Math.round(srcH * scale));
  const offsetX = Math.floor((dstW - drawW) / 2);
  const offsetY = Math.floor((dstH - drawH) / 2);
  return { drawW, drawH, offsetX, offsetY };
}

/**
 * Decodifica un File de imagen tal cual viene (1:1 Nearest-Neighbor, sin borrar fondo ni suavizar).
 * Si `targetW`/`targetH` son null, conserva las dimensiones nativas (limitadas a 4..512 px).
 * @param {File} file
 * @param {number|null} [targetW=null]
 * @param {number|null} [targetH=null]
 * @returns {Promise<{imgData: ImageData, width: number, height: number}>}
 */
export async function loadRawSpriteImageData(file, targetW = null, targetH = null) {
  const bitmap = await createImageBitmap(file);
  let w = targetW ? Math.round(targetW) : bitmap.width;
  let h = targetH ? Math.round(targetH) : bitmap.height;

  // Si excede el máximo del editor (MAX_GRID_DIM) en tamaño nativo, escalar proporcionalmente sin suavizado
  if (!targetW && !targetH && (w > MAX_GRID_DIM || h > MAX_GRID_DIM)) {
    const scale = MAX_GRID_DIM / Math.max(w, h);
    w = Math.max(4, Math.round(w * scale));
    h = Math.max(4, Math.round(h * scale));
  } else {
    w = Math.max(4, Math.min(MAX_GRID_DIM, w));
    h = Math.max(4, Math.min(MAX_GRID_DIM, h));
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (targetW || targetH) {
    const { drawW, drawH, offsetX, offsetY } = computeContainedRect(bitmap.width, bitmap.height, w, h);
    const isIntegerDownscale =
      drawW <= bitmap.width &&
      drawH <= bitmap.height &&
      bitmap.width % drawW === 0 &&
      bitmap.height % drawH === 0;
    const isDownscale = (drawW < bitmap.width || drawH < bitmap.height) && !isIntegerDownscale;
    ctx.imageSmoothingEnabled = isDownscale;
    if (isDownscale) ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, offsetX, offsetY, drawW, drawH);
  } else {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0, w, h);
  }
  if (typeof bitmap.close === "function") bitmap.close();

  return {
    imgData: ctx.getImageData(0, 0, w, h),
    width: w,
    height: h,
  };
}

/**
 * Decodifica un File de imagen, opcionalmente quita el fondo perimetral y recorta bounding box,
 * y reescala en un lienzo de `targetWidth x targetHeight` (o `targetSize x targetSize`).
 * @param {File} file
 * @param {number} [targetSize=64]
 * @param {{removeBackground?: boolean, targetWidth?: number|null, targetHeight?: number|null}} [options={}]
 * @returns {Promise<ImageData>}
 */
export async function prepareExternalSprite(
  file,
  targetSize = 64,
  { removeBackground = false, targetWidth = null, targetHeight = null } = {},
) {
  const dstW = Math.max(4, Math.min(MAX_GRID_DIM, Math.round(Number(targetWidth) || Number(targetSize) || 64)));
  const dstH = Math.max(4, Math.min(MAX_GRID_DIM, Math.round(Number(targetHeight) || Number(targetSize) || 64)));
  const bitmap = await createImageBitmap(file);
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = bitmap.width;
  srcCanvas.height = bitmap.height;
  const srcCtx = srcCanvas.getContext("2d");
  srcCtx.drawImage(bitmap, 0, 0);
  if (typeof bitmap.close === "function") bitmap.close();

  if (removeBackground) {
    const rawData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
    const cleaned = removeConnectedBackground(rawData, 40);
    srcCtx.putImageData(cleaned, 0, 0);

    let minX = cleaned.width;
    let minY = cleaned.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < cleaned.height; y++) {
      for (let x = 0; x < cleaned.width; x++) {
        if (cleaned.data[(y * cleaned.width + x) * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const cropX = maxX >= minX ? minX : 0;
    const cropY = maxY >= minY ? minY : 0;
    const cropW = maxX >= minX ? maxX - minX + 1 : cleaned.width;
    const cropH = maxY >= minY ? maxY - minY + 1 : cleaned.height;

    const marginX = Math.max(1, Math.round((dstW * 4) / 64));
    const marginY = Math.max(1, Math.round((dstH * 4) / 64));
    const targetBoxW = Math.max(1, dstW - marginX * 2);
    const targetBoxH = Math.max(1, dstH - marginY * 2);
    const scale = Math.min(targetBoxW / cropW, targetBoxH / cropH);
    const newW = Math.max(1, Math.round(cropW * scale));
    const newH = Math.max(1, Math.round(cropH * scale));
    const offsetX = Math.floor((dstW - newW) / 2);
    const offsetY = Math.floor((dstH - newH) / 2);

    const dstCanvas = document.createElement("canvas");
    dstCanvas.width = dstW;
    dstCanvas.height = dstH;
    const dstCtx = dstCanvas.getContext("2d");
    const isIntegerDownscale = cropW % newW === 0 && cropH % newH === 0;
    dstCtx.imageSmoothingEnabled = !isIntegerDownscale && (newW < cropW || newH < cropH);
    if (dstCtx.imageSmoothingEnabled) dstCtx.imageSmoothingQuality = "high";
    dstCtx.drawImage(srcCanvas, cropX, cropY, cropW, cropH, offsetX, offsetY, newW, newH);
    return dstCtx.getImageData(0, 0, dstW, dstH);
  }

  const dstCanvas = document.createElement("canvas");
  dstCanvas.width = dstW;
  dstCanvas.height = dstH;
  const dstCtx = dstCanvas.getContext("2d");
  const { drawW, drawH, offsetX, offsetY } = computeContainedRect(
    srcCanvas.width,
    srcCanvas.height,
    dstW,
    dstH,
  );
  const isIntegerDownscale = srcCanvas.width % drawW === 0 && srcCanvas.height % drawH === 0;
  dstCtx.imageSmoothingEnabled = !isIntegerDownscale && (drawW < srcCanvas.width || drawH < srcCanvas.height);
  if (dstCtx.imageSmoothingEnabled) dstCtx.imageSmoothingQuality = "high";
  dstCtx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, offsetX, offsetY, drawW, drawH);

  return dstCtx.getImageData(0, 0, dstW, dstH);
}

/**
 * Extrae una grilla de índices y una paleta dinámica #rrggbb con los colores originales.
 * @param {any} imgData
 * @param {number} [alphaThreshold=32]
 */
export function imageDataToDynamicGrid(imgData, alphaThreshold = 32) {
  const { width: w, height: h, data } = imgData;
  const grid = [];
  const paletteMap = { 0: null };
  const colorToIdx = new Map();
  let nextIdx = 1;

  for (let y = 0; y < h; y++) {
    const row = new Array(w);
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (data[o + 3] < alphaThreshold) {
        row[x] = 0;
      } else {
        const hex = toHex(data[o], data[o + 1], data[o + 2]);
        let idx = colorToIdx.get(hex);
        if (idx === undefined) {
          idx = nextIdx++;
          colorToIdx.set(hex, idx);
          paletteMap[idx] = hex;
        }
        row[x] = idx;
      }
    }
    grid.push(row);
  }
  return { grid, paletteMap };
}

/**
 * Cuantiza un ImageData hacia `targetPaletteMap` usando OKLab y estrategia de dithering.
 */
export function quantizeImageDataToPalette(
  imgData,
  targetPaletteMap,
  { alphaThreshold = 32, dither = false, ditherMode = null, ditherStrength = 24 } = {},
) {
  const { width: w, height: h, data } = imgData;
  const entries = [];
  const normalizedPalette = { 0: null };

  for (const [idxStr, col] of Object.entries(targetPaletteMap || {})) {
    const idx = Number(idxStr);
    if (idx === 0 || !col) continue;
    const rgb = parseColorToRgb(col);
    if (!rgb) continue;
    normalizedPalette[idx] = col;
    entries.push({ idx, lab: rgbToOklab(rgb[0], rgb[1], rgb[2]) });
  }

  const mode =
    ditherMode && DITHER_STRATEGIES[ditherMode]
      ? ditherMode
      : dither
        ? "bayer4"
        : "none";
  const ditherFn = DITHER_STRATEGIES[mode];
  const useDither = mode !== "none";
  const cache = new Map();

  const grid = Array.from({ length: h }, (_, y) => {
    const row = new Array(w);
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (data[o + 3] < alphaThreshold || entries.length === 0) {
        row[x] = 0;
        continue;
      }
      let r = data[o];
      let g = data[o + 1];
      let b = data[o + 2];
      if (useDither) {
        const bias = ditherFn(x, y) * ditherStrength;
        r = Math.max(0, Math.min(255, Math.round(r + bias)));
        g = Math.max(0, Math.min(255, Math.round(g + bias)));
        b = Math.max(0, Math.min(255, Math.round(b + bias)));
      }
      const key = (r << 16) | (g << 8) | b;
      let bestIdx = cache.get(key);
      if (bestIdx === undefined) {
        const [pL, pA, pB] = rgbToOklab(r, g, b);
        let bestDist = Infinity;
        bestIdx = entries[0].idx;
        for (let i = 0; i < entries.length; i++) {
          const [tL, tA, tB] = entries[i].lab;
          const dist = (pL - tL) ** 2 + (pA - tA) ** 2 + (pB - tB) ** 2;
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = entries[i].idx;
          }
        }
        cache.set(key, bestIdx);
      }
      row[x] = bestIdx;
    }
    return row;
  });

  return { grid, paletteMap: normalizedPalette };
}

/**
 * Extrae una paleta adaptativa de hasta `maxColors` colores propios usando
 * K-Means++ determinista ponderado por sqrt(frecuencia) en OKLab.
 * @param {any} imgData
 * @param {number} [maxColors=32]
 * @param {number} [alphaThreshold=32]
 */
export function extractAdaptivePalette(imgData, maxColors = 32, alphaThreshold = 32) {
  const { data } = imgData;
  const freqMap = new Map();

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < alphaThreshold) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    freqMap.set(key, (freqMap.get(key) || 0) + 1);
  }

  if (freqMap.size === 0) return { 0: null };

  const unique = [];
  for (const [key, count] of freqMap.entries()) {
    const r = (key >> 16) & 255;
    const g = (key >> 8) & 255;
    const b = key & 255;
    unique.push({ r, g, b, count, lab: rgbToOklab(r, g, b) });
  }

  if (unique.length <= maxColors) {
    unique.sort((a, b) => (0.2126 * a.r + 0.7152 * a.g + 0.0722 * a.b) - (0.2126 * b.r + 0.7152 * b.g + 0.0722 * b.b));
    const pal = { 0: null };
    unique.forEach((u, i) => {
      pal[i + 1] = toHex(u.r, u.g, u.b);
    });
    return pal;
  }

  // Farthest-Point determinista ponderado por sqrt(count)
  const weights = unique.map((u) => Math.sqrt(u.count));
  const centers = new Array(maxColors);
  let firstIdx = 0;
  for (let i = 1; i < unique.length; i++) {
    if (unique[i].count > unique[firstIdx].count) firstIdx = i;
  }
  centers[0] = [...unique[firstIdx].lab];
  const minDistSq = unique.map((u) => {
    const [L, a, b] = u.lab;
    return (L - centers[0][0]) ** 2 + (a - centers[0][1]) ** 2 + (b - centers[0][2]) ** 2;
  });

  for (let k = 1; k < maxColors; k++) {
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < unique.length; i++) {
      const score = minDistSq[i] * weights[i];
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    centers[k] = [...unique[bestIdx].lab];
    for (let i = 0; i < unique.length; i++) {
      const [L, a, b] = unique[i].lab;
      const d = (L - centers[k][0]) ** 2 + (a - centers[k][1]) ** 2 + (b - centers[k][2]) ** 2;
      if (d < minDistSq[i]) minDistSq[i] = d;
    }
  }

  // Refinamiento K-Means ponderado
  const labels = new Int32Array(unique.length);
  for (let iter = 0; iter < 12; iter++) {
    let changed = false;
    for (let i = 0; i < unique.length; i++) {
      const [L, a, b] = unique[i].lab;
      let bestK = 0;
      let bestD = Infinity;
      for (let k = 0; k < maxColors; k++) {
        const d = (L - centers[k][0]) ** 2 + (a - centers[k][1]) ** 2 + (b - centers[k][2]) ** 2;
        if (d < bestD) {
          bestD = d;
          bestK = k;
        }
      }
      if (labels[i] !== bestK) {
        labels[i] = bestK;
        changed = true;
      }
    }
    if (!changed && iter > 0) break;

    const sumL = new Float64Array(maxColors);
    const sumA = new Float64Array(maxColors);
    const sumB = new Float64Array(maxColors);
    const sumW = new Float64Array(maxColors);
    for (let i = 0; i < unique.length; i++) {
      const k = labels[i];
      const w = weights[i];
      sumL[k] += unique[i].lab[0] * w;
      sumA[k] += unique[i].lab[1] * w;
      sumB[k] += unique[i].lab[2] * w;
      sumW[k] += w;
    }
    for (let k = 0; k < maxColors; k++) {
      if (sumW[k] > 0) {
        centers[k][0] = sumL[k] / sumW[k];
        centers[k][1] = sumA[k] / sumW[k];
        centers[k][2] = sumB[k] / sumW[k];
      }
    }
  }

  const chosen = [];
  for (let k = 0; k < maxColors; k++) {
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let sw = 0;
    for (let i = 0; i < unique.length; i++) {
      if (labels[i] !== k) continue;
      const w = unique[i].count;
      sr += unique[i].r * w;
      sg += unique[i].g * w;
      sb += unique[i].b * w;
      sw += w;
    }
    if (sw > 0) {
      chosen.push({
        r: Math.max(0, Math.min(255, Math.round(sr / sw))),
        g: Math.max(0, Math.min(255, Math.round(sg / sw))),
        b: Math.max(0, Math.min(255, Math.round(sb / sw))),
      });
    }
  }

  chosen.sort((a, b) => (0.2126 * a.r + 0.7152 * a.g + 0.0722 * a.b) - (0.2126 * b.r + 0.7152 * b.g + 0.0722 * b.b));
  const palette = { 0: null };
  chosen.forEach((c, idx) => {
    palette[idx + 1] = toHex(c.r, c.g, c.b);
  });
  return palette;
}

/**
 * Reduce la paleta de una grilla existente a `maxColors` colores propios en OKLab.
 * @param {number[][]} grid
 * @param {Record<number, string|null>} paletteMap
 * @param {number} [maxColors=32]
 * @param {boolean} [dither=false]
 */
export function reduceGridColorsClient(grid, paletteMap, maxColors = 32, dither = false) {
  if (!Array.isArray(grid) || grid.length === 0) {
    return { width: 0, height: 0, size: 0, grid: [], palette: { 0: null } };
  }
  const h = grid.length;
  const w = Array.isArray(grid[0]) ? grid[0].length : 0;
  if (w === 0) {
    return { width: 0, height: h, size: 0, grid: grid.map(() => []), palette: { 0: null } };
  }

  const imgData = new ImageData(w, h);
  const rgbCache = new Map();

  for (const [kStr, col] of Object.entries(paletteMap || {})) {
    const k = Number(kStr);
    if (k !== 0 && col) {
      const rgb = parseColorToRgb(col);
      if (rgb) rgbCache.set(k, rgb);
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = grid[y]?.[x];
      if (!idx || idx === 0) continue;
      const rgb = rgbCache.get(idx);
      if (!rgb) continue;
      const o = (y * w + x) * 4;
      imgData.data[o] = rgb[0];
      imgData.data[o + 1] = rgb[1];
      imgData.data[o + 2] = rgb[2];
      imgData.data[o + 3] = 255;
    }
  }

  const adaptive = extractAdaptivePalette(imgData, maxColors, 32);
  const { grid: newGrid, paletteMap: finalPal } = quantizeImageDataToPalette(imgData, adaptive, {
    alphaThreshold: 32,
    dither,
  });

  return { width: w, height: h, size: w, grid: newGrid, palette: finalPal };
}
