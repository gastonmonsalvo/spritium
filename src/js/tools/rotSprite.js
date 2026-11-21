// @ts-check
/**
 * rotSprite.js: Algoritmo de rotación RotSprite (Xenowhirl) con Scale2x/EPX
 * y proyección perceptual OKLab sobre sesiones acumulativas no destructivas.
 */

import { state, pushLayerState, getGridDims } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { isActiveLayerLocked } from "../workspace/layers.js";
import { reconcileActiveTilemapLayer } from "../workspace/tilemap.js";
import { parseColorToRgb, rgbToOklab } from "../core/color.js";

/** Calcula el bounding box de píxeles no transparentes dentro de `region` (o todo el grid). */
export function getOpaqueBounds(grid, region = null, outOfBounds = []) {
  const gh = grid.length, gw = grid[0]?.length || gh;
  const x0 = region ? Math.max(0, region.x) : 0, y0 = region ? Math.max(0, region.y) : 0;
  const x1 = region ? Math.min(gw, region.x + region.w) : gw, y1 = region ? Math.min(gh, region.y + region.h) : gh;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (grid[y]?.[x]) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  for (const [ox, oy, val] of outOfBounds || []) {
    if (val === 0) continue;
    if (region && (ox < region.x || ox >= region.x + region.w || oy < region.y || oy >= region.y + region.h)) continue;
    if (ox < minX) minX = ox; if (ox > maxX) maxX = ox;
    if (oy < minY) minY = oy; if (oy > maxY) maxY = oy;
  }
  if (maxX < minX) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Escala un buffer plano `w × h` al doble (`2w × 2h`) mediante el filtro Scale2x / EPX. */
export function scale2xFlat(src, w, h) {
  const nw = w * 2, nh = h * 2, out = new Int32Array(nw * nh);
  for (let y = 0; y < h; y++) {
    const yOff = y * w;
    for (let x = 0; x < w; x++) {
      const p = src[yOff + x];
      const a = y > 0 ? src[(y - 1) * w + x] : 0;
      const b = x < w - 1 ? src[yOff + x + 1] : 0;
      const c = x > 0 ? src[yOff + x - 1] : 0;
      const d = y < h - 1 ? src[(y + 1) * w + x] : 0;
      let p1 = p, p2 = p, p3 = p, p4 = p;
      if (c === a && c !== d && a !== b) p1 = a;
      if (a === b && a !== c && b !== d) p2 = b;
      if (d === c && d !== b && c !== a) p3 = c;
      if (b === d && b !== a && d !== c) p4 = d;
      const r0 = y * 2 * nw + x * 2, r1 = r0 + nw;
      out[r0] = p1; out[r0 + 1] = p2; out[r1] = p3; out[r1 + 1] = p4;
    }
  }
  return { data: out, w: nw, h: nh };
}

function syncRotSpriteSession(deg, activeLayer) {
  if (!state.rotSpriteSession || state.rotSpriteSession.layerIndex !== state.activeLayerIndex) {
    state.rotSpriteSession = {
      layerIndex: state.activeLayerIndex,
      baseGrid: state.grid.map((row) => [...row]),
      baseOutOfBounds: activeLayer?.outOfBounds ? activeLayer.outOfBounds.map((p) => [...p]) : [],
      baseSelection: state.selection ? { ...state.selection } : null,
      totalAngle: 0,
    };
  }
  state.rotSpriteSession.totalAngle = (state.rotSpriteSession.totalAngle + deg) % 360;
  return state.rotSpriteSession;
}

function extractPatchAndClearGrid(srcGrid, srcOob, srcSelection, bounds, gw, gh, activeLayer) {
  const { minX, minY, w: bw, h: bh } = bounds;
  const patch = new Int32Array(bw * bh);
  for (let r = 0; r < bh; r++) {
    const gy = minY + r;
    if (gy < 0 || gy >= gh) continue;
    for (let c = 0; c < bw; c++) {
      const gx = minX + c;
      if (gx < 0 || gx >= gw) continue;
      patch[r * bw + c] = srcGrid[gy][gx];
      state.grid[gy][gx] = 0;
    }
  }
  if (!srcSelection) {
    for (const [ox, oy, val] of srcOob) {
      if (!val) continue;
      const lx = ox - minX, ly = oy - minY;
      if (lx >= 0 && lx < bw && ly >= 0 && ly < bh) patch[ly * bw + lx] = val;
    }
    if (activeLayer) activeLayer.outOfBounds = [];
  }
  return patch;
}

function computeTargetRect(srcSelection, bounds, gw, gh) {
  const { minX, minY, maxX, maxY, w: bw, h: bh } = bounds;
  const centerX = (minX + maxX + 1) / 2, centerY = (minY + maxY + 1) / 2;
  if (srcSelection) {
    const dstX0 = srcSelection.x, dstY0 = srcSelection.y;
    const dstX1 = Math.min(gw - 1, srcSelection.x + srcSelection.w - 1);
    const dstY1 = Math.min(gh - 1, srcSelection.y + srcSelection.h - 1);
    return { centerX, centerY, dstX0, dstY0, dstX1, dstY1, outW: Math.max(1, dstX1 - dstX0 + 1), outH: Math.max(1, dstY1 - dstY0 + 1) };
  }
  const diag = Math.ceil(Math.hypot(bw, bh)) + 2;
  const dstX0 = Math.floor(centerX - diag / 2), dstY0 = Math.floor(centerY - diag / 2);
  return { centerX, centerY, dstX0, dstY0, dstX1: Math.min(gw - 1, dstX0 + diag - 1), dstY1: Math.min(gh - 1, dstY0 + diag - 1), outW: diag, outH: diag };
}

function findNearestOklabIndex(r, g, b, usedEntries, oklabCache) {
  const key = (r << 16) | (g << 8) | b;
  const cached = oklabCache.get(key);
  if (cached !== undefined) return cached;
  const [pL, pA, pB] = rgbToOklab(r, g, b);
  let bestDist = Infinity, bestIdx = usedEntries[0].idx;
  for (let i = 0; i < usedEntries.length; i++) {
    const [tL, tA, tB] = usedEntries[i].lab;
    const d = (pL - tL) ** 2 + (pA - tA) ** 2 + (pB - tB) ** 2;
    if (d < bestDist) { bestDist = d; bestIdx = usedEntries[i].idx; }
  }
  oklabCache.set(key, bestIdx);
  return bestIdx;
}

function tryRotateViaCanvasOklab(srcPatch, bounds, rect, totalDeg, gw, gh, srcSelection, activeLayer) {
  if (typeof document === "undefined" || typeof ImageData === "undefined") return false;
  const usedMap = new Map();
  for (let i = 0; i < srcPatch.length; i++) {
    const idx = srcPatch[i];
    if (!idx || usedMap.has(idx)) continue;
    const rgb = parseColorToRgb(state.paletteMap[idx]);
    if (rgb) usedMap.set(idx, { idx, rgb, lab: rgbToOklab(rgb[0], rgb[1], rgb[2]) });
  }
  if (usedMap.size === 0) return false;

  const { w: bw, h: bh } = bounds;
  const { centerX, centerY, dstX0, dstY0, outW, outH } = rect;
  const up2 = scale2xFlat(srcPatch, bw, bh);
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = up2.w; srcCanvas.height = up2.h;
  const sCtx = srcCanvas.getContext("2d");
  if (!sCtx) return false;
  const sImg = sCtx.createImageData(up2.w, up2.h);
  for (let i = 0; i < up2.data.length; i++) {
    const entry = usedMap.get(up2.data[i]);
    if (!entry) continue;
    const o = i * 4;
    sImg.data[o] = entry.rgb[0]; sImg.data[o + 1] = entry.rgb[1]; sImg.data[o + 2] = entry.rgb[2]; sImg.data[o + 3] = 255;
  }
  sCtx.putImageData(sImg, 0, 0);

  const dstCanvas = document.createElement("canvas");
  dstCanvas.width = outW; dstCanvas.height = outH;
  const dCtx = dstCanvas.getContext("2d");
  dCtx.imageSmoothingEnabled = true;
  dCtx.imageSmoothingQuality = "high";
  dCtx.translate(centerX - dstX0, centerY - dstY0);
  dCtx.rotate((totalDeg * Math.PI) / 180);
  dCtx.drawImage(srcCanvas, -bw / 2, -bh / 2, bw, bh);

  const rotatedData = dCtx.getImageData(0, 0, outW, outH).data;
  const usedEntries = Array.from(usedMap.values()), oklabCache = new Map();
  for (let ry = 0; ry < outH; ry++) {
    const gy = dstY0 + ry;
    for (let rx = 0; rx < outW; rx++) {
      const o = (ry * outW + rx) * 4;
      if (rotatedData[o + 3] < 115) continue;
      const bestIdx = findNearestOklabIndex(rotatedData[o], rotatedData[o + 1], rotatedData[o + 2], usedEntries, oklabCache);
      const gx = dstX0 + rx;
      if (gx >= 0 && gx < gw && gy >= 0 && gy < gh) state.grid[gy][gx] = bestIdx;
      else if (!srcSelection && activeLayer) activeLayer.outOfBounds.push([gx, gy, bestIdx]);
    }
  }
  return true;
}

function rotateViaPureScale2xFallback(srcGrid, bounds, rect, totalDeg) {
  const { minX, minY, maxX, maxY, w: bw, h: bh } = bounds;
  let buf = new Int32Array(bw * bh);
  for (let r = 0; r < bh; r++) for (let c = 0; c < bw; c++) buf[r * bw + c] = srcGrid[minY + r][minX + c];
  const passes = Math.max(bw, bh) > 96 ? 2 : 3, scale = 1 << passes;
  let upW = bw, upH = bh;
  for (let i = 0; i < passes; i++) { const res = scale2xFlat(buf, upW, upH); buf = res.data; upW = res.w; upH = res.h; }

  const objCx = (minX + maxX) / 2, objCy = (minY + maxY) / 2, upCx = (upW - 1) / 2, upCy = (upH - 1) / 2;
  const rad = (-totalDeg * Math.PI) / 180, cosA = Math.cos(rad), sinA = Math.sin(rad);
  for (let y = Math.max(0, rect.dstY0); y <= rect.dstY1; y++) {
    const dy = y - objCy;
    for (let x = Math.max(0, rect.dstX0); x <= rect.dstX1; x++) {
      const dx = x - objCx;
      const sx = Math.round((dx * cosA - dy * sinA) * scale + upCx);
      const sy = Math.round((dx * sinA + dy * cosA) * scale + upCy);
      if (sx >= 0 && sx < upW && sy >= 0 && sy < upH && buf[sy * upW + sx] !== 0) state.grid[y][x] = buf[sy * upW + sx];
    }
  }
}

/** Rotación RotSprite (Xenowhirl): recorta a bounds opacos, escala Scale2x y rota en OKLab. */
export function rotSpriteRotate(angleDeg) {
  if (isActiveLayerLocked()) return;
  const deg = Number(angleDeg);
  if (!Number.isFinite(deg) || deg === 0) return;

  const { w: gw, h: gh } = getGridDims();
  const activeLayer = state.layers?.[state.activeLayerIndex];
  const session = syncRotSpriteSession(deg, activeLayer);
  const bounds = getOpaqueBounds(session.baseGrid, session.baseSelection, session.baseSelection ? [] : session.baseOutOfBounds);
  if (!bounds) return;

  pushLayerState(true);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) state.grid[y][x] = session.baseGrid[y][x];
  if (activeLayer) activeLayer.outOfBounds = (session.baseOutOfBounds || []).map((p) => [...p]);

  if (session.totalAngle !== 0) {
    const srcPatch = extractPatchAndClearGrid(session.baseGrid, session.baseOutOfBounds || [], session.baseSelection, bounds, gw, gh, activeLayer);
    const rect = computeTargetRect(session.baseSelection, bounds, gw, gh);
    if (!tryRotateViaCanvasOklab(srcPatch, bounds, rect, session.totalAngle, gw, gh, session.baseSelection, activeLayer)) {
      rotateViaPureScale2xFallback(session.baseGrid, bounds, rect, session.totalAngle);
    }
  }
  state.isDirtySinceImport = true;
  reconcileActiveTilemapLayer("auto");
  renderAll();
}
