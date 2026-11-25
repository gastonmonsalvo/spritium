// @ts-check
/**
 * CursorPreviewOverlay.js: Vista previa precisa del cursor, huella de pincel,
 * previsualización de inundación (Balde/Varita) y badge de Gotero.
 */

import { state, getGridDims, isSymmetryActive, getSymmetryPoints } from "../core/state.js";
import { parseColorToRgb } from "../core/color.js";

const PIXEL_CURSOR_SKIP_TOOLS = new Set(["pan", "zoom"]);
const BRUSH_FOOTPRINT_TOOLS = new Set(["pencil", "eraser"]);
const REGION_PREVIEW_TOOLS = new Set(["bucket", "fill", "backgroundEraser", "magicSelect"]);
const MIRROR_CURSOR_TOOLS = new Set(["pencil", "eraser", "line", "rect", "circle", "triangle", "fill", "spray"]);

let fillPreviewCache = null;

/** Limpia la caché espacial de previsualización de inundación. */
export function clearFillPreviewCache() {
  fillPreviewCache = null;
}

function getCustomBrushFootprintOffsets(brush, brushSize) {
  const pixels = brush?.pixels || [];
  if (!pixels.length) return [{ dx: 0, dy: 0 }];
  const bw = Math.max(1, Number(brush.w) || 1);
  const bh = Math.max(1, Number(brush.h) || 1);
  const nativeSize = Math.max(bw, bh);
  const targetSize = Math.max(1, Math.round(Number(brushSize) || nativeSize));
  if (targetSize === nativeSize) return pixels.map((p) => ({ dx: p.dx, dy: p.dy }));

  const halfSrcW = Math.floor(bw / 2);
  const halfSrcH = Math.floor(bh / 2);
  const occupied = new Set(pixels.map((p) => `${p.dx + halfSrcW},${p.dy + halfSrcH}`));
  const scale = targetSize / nativeSize;
  const dstW = Math.max(1, Math.round(bw * scale));
  const dstH = Math.max(1, Math.round(bh * scale));
  const halfDstW = Math.floor(dstW / 2);
  const halfDstH = Math.floor(dstH / 2);
  const out = [];
  for (let dy = 0; dy < dstH; dy++) {
    const sy = Math.min(bh - 1, Math.floor((dy / dstH) * bh));
    for (let dx = 0; dx < dstW; dx++) {
      const sx = Math.min(bw - 1, Math.floor((dx / dstW) * bw));
      if (occupied.has(`${sx},${sy}`)) out.push({ dx: dx - halfDstW, dy: dy - halfDstH });
    }
  }
  return out.length ? out : [{ dx: 0, dy: 0 }];
}

function strokeCellsFootprint(ctx, cx, cy, offsets, cellSize, strokeColor, fillColor, outerShadow, lineW, dashed = false) {
  const cellSet = new Set(offsets.map((o) => `${o.dx},${o.dy}`));
  ctx.fillStyle = fillColor;
  for (const o of offsets) {
    const px = Math.floor((cx + o.dx) * cellSize);
    const py = Math.floor((cy + o.dy) * cellSize);
    ctx.fillRect(px, py, Math.floor((cx + o.dx + 1) * cellSize) - px, Math.floor((cy + o.dy + 1) * cellSize) - py);
  }
  ctx.beginPath();
  for (const o of offsets) {
    const x0 = Math.floor((cx + o.dx) * cellSize);
    const x1 = Math.floor((cx + o.dx + 1) * cellSize);
    const y0 = Math.floor((cy + o.dy) * cellSize);
    const y1 = Math.floor((cy + o.dy + 1) * cellSize);
    if (!cellSet.has(`${o.dx},${o.dy - 1}`)) { ctx.moveTo(x0, y0 + 0.5); ctx.lineTo(x1, y0 + 0.5); }
    if (!cellSet.has(`${o.dx},${o.dy + 1}`)) { ctx.moveTo(x0, y1 - 0.5); ctx.lineTo(x1, y1 - 0.5); }
    if (!cellSet.has(`${o.dx - 1},${o.dy}`)) { ctx.moveTo(x0 + 0.5, y0); ctx.lineTo(x0 + 0.5, y1); }
    if (!cellSet.has(`${o.dx + 1},${o.dy}`)) { ctx.moveTo(x1 - 0.5, y0); ctx.lineTo(x1 - 0.5, y1); }
  }
  const scale = ctx.getTransform().a || 1;
  if (dashed) ctx.setLineDash([Math.max(2, 4 / scale), Math.max(2, 3 / scale)]);
  ctx.strokeStyle = outerShadow;
  ctx.lineWidth = lineW + Math.max(0.5, 0.75 / scale);
  ctx.stroke();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineW;
  ctx.stroke();
  if (dashed) ctx.setLineDash([]);
}

function hexToRgba(hex, alphaMultiplier = 1) {
  const clean = typeof hex === "string" ? hex.replace("#", "").trim() : "";
  if (clean.length !== 6 && clean.length !== 8) return `rgba(56, 189, 248, ${alphaMultiplier})`;
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  const hexAlpha = clean.length === 8 ? (parseInt(clean.slice(6, 8), 16) ?? 255) / 255 : 1;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, hexAlpha * alphaMultiplier)).toFixed(3)})`;
}

function isPixelInActiveSelection(px, py) {
  const sel = state.selection;
  if (!sel) return true;
  if (px < sel.x || py < sel.y || px >= sel.x + sel.w || py >= sel.y + sel.h) return false;
  return sel.mask ? sel.mask[(py - sel.y) * sel.w + (px - sel.x)] === 1 : true;
}

function createColorMatcher(targetVal, tolerance) {
  const targetRgb = tolerance > 0 && targetVal !== 0 ? parseColorToRgb(state.paletteMap?.[targetVal]) : null;
  const tolSq = (tolerance * 2.2) ** 2;
  return (idx) => {
    if (idx === targetVal) return true;
    if (tolerance <= 0 || idx === 0 || targetVal === 0 || !targetRgb) return false;
    const rgb = parseColorToRgb(state.paletteMap?.[idx]);
    if (!rgb) return false;
    const dr = rgb[0] - targetRgb[0], dg = rgb[1] - targetRgb[1], db = rgb[2] - targetRgb[2];
    return dr * dr + dg * dg + db * db <= tolSq;
  };
}

function collectGlobalMatches(grid, w, h, matches, respectSelection) {
  const coords = [], cellsSet = new Set();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = grid[y]?.[x];
      if (idx !== undefined && matches(idx) && (!respectSelection || isPixelInActiveSelection(x, y))) {
        coords.push([x, y]);
        cellsSet.add(y * w + x);
      }
    }
  }
  return { coords, cellsSet };
}

function collectBfsMatches(grid, lx, ly, w, h, matches, respectSelection) {
  const coords = [], cellsSet = new Set();
  const visited = new Uint8Array(w * h);
  const qx = new Int32Array(w * h), qy = new Int32Array(w * h);
  const tiledX = state.tiledMode === "x" || state.tiledMode === "both";
  const tiledY = state.tiledMode === "y" || state.tiledMode === "both";
  let head = 0, tail = 0;
  qx[tail] = lx; qy[tail] = ly; tail++;
  visited[ly * w + lx] = 1;
  while (head < tail) {
    const x = qx[head], y = qy[head]; head++;
    coords.push([x, y]); cellsSet.add(y * w + x);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let nx = x + dx, ny = y + dy;
      if (tiledX) nx = ((nx % w) + w) % w;
      if (tiledY) ny = ((ny % h) + h) % h;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const flat = ny * w + nx;
      if (visited[flat]) continue;
      const nIdx = grid[ny]?.[nx];
      if (nIdx === undefined || !matches(nIdx)) continue;
      if (respectSelection && !isPixelInActiveSelection(nx, ny)) continue;
      visited[flat] = 1; qx[tail] = nx; qy[tail] = ny; tail++;
    }
  }
  return { coords, cellsSet };
}

function getFloodFillPreviewOffsets(lx, ly, w, h, { respectSelection = true, ignoreTransparent = false, tolerance = 0, contiguous = true, skipCache = false } = {}) {
  const grid = state.grid;
  if (!grid || lx < 0 || lx >= w || ly < 0 || ly >= h) return null;
  if (respectSelection && !isPixelInActiveSelection(lx, ly)) return null;
  const targetVal = grid[ly]?.[lx];
  if (targetVal === undefined || (ignoreTransparent && targetVal === 0)) return null;

  const sel = respectSelection ? state.selection : null;
  const selKey = sel ? `${sel.x},${sel.y},${sel.w},${sel.h},${sel.mask ? sel.mask.length : 0}` : "none";
  const cacheKey = `${state.activeFrameIndex}:${state.activeLayerIndex}:${state.currentHistoryActionId}:${state.undoStack.length}:${w}x${h}:${selKey}:${state.tiledMode}:${respectSelection}:${ignoreTransparent}:${tolerance}:${contiguous}`;
  if (!skipCache && fillPreviewCache?.cacheKey === cacheKey && fillPreviewCache.gridRef === grid && fillPreviewCache.targetVal === targetVal && fillPreviewCache.cellsSet.has(ly * w + lx)) {
    return fillPreviewCache.coords.map(([px, py]) => ({ dx: px - lx, dy: py - ly }));
  }

  const matches = createColorMatcher(targetVal, tolerance);
  const { coords, cellsSet } = contiguous
    ? collectBfsMatches(grid, lx, ly, w, h, matches, respectSelection)
    : collectGlobalMatches(grid, w, h, matches, respectSelection);
  if (!skipCache) fillPreviewCache = { cacheKey, gridRef: grid, targetVal, cellsSet, coords };
  return coords.map(([px, py]) => ({ dx: px - lx, dy: py - ly }));
}

function drawEyedropperBadge(ctx, px, py, rx, ry, rw, rh, w, h, maxW, maxH, cellSize, zoom) {
  const lx = ((px % w) + w) % w, ly = ((py % h) + h) % h;
  const cIdx = state.grid?.[ly]?.[lx] ?? 0;
  const sampleHex = cIdx > 0 ? state.paletteMap?.[cIdx] : null;
  if (!sampleHex) return;
  const z = zoom || 1, badgeR = Math.max(5, 10 / z), margin = 5 / z;
  let bx = rx + rw + margin + badgeR, by = ry + rh + margin + badgeR;
  if (bx + badgeR + 2 > maxW * cellSize) bx = rx - margin - badgeR;
  if (by + badgeR + 2 > maxH * cellSize) by = ry - margin - badgeR;
  ctx.beginPath(); ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = sampleHex; ctx.fill();
  ctx.lineWidth = Math.max(1.5, 2.5 / z); ctx.strokeStyle = "rgba(9, 9, 11, 0.88)"; ctx.stroke();
  ctx.lineWidth = Math.max(0.75, 1.25 / z); ctx.strokeStyle = "#ffffff"; ctx.stroke();
}

function tryDrawRegionPreview(ctx, cx, cy, w, h, cellSize, cfg, opacity, outerShadow, lineW) {
  const lx = ((cx % w) + w) % w, ly = ((cy % h) + h) % h;
  const isBgEraser = state.currentTool === "backgroundEraser", isMagic = state.currentTool === "magicSelect";
  const fillOffsets = getFloodFillPreviewOffsets(lx, ly, w, h, {
    respectSelection: !isBgEraser && !isMagic,
    ignoreTransparent: isBgEraser,
    tolerance: isMagic ? (Number(state.magicTolerance) || 0) : 0,
    contiguous: isMagic ? state.magicContiguous !== false : true,
  });
  if (!fillOffsets?.length) return false;
  const activeBucketHex =
    !isBgEraser && !isMagic && cfg.fillUseActiveColor !== false && state.currentColorIndex !== 0
      ? state.paletteMap?.[state.currentColorIndex] || null
      : null;
  const regionHex = isBgEraser
    ? (cfg.bgEraserPreviewColor || "#fb718544")
    : isMagic
      ? (cfg.magicPreviewColor || "#f472b644")
      : (activeBucketHex || cfg.fillPreviewColor || "#38bdf838");
  const activeFillAlpha = Math.max(0.1, Math.min(1, Number(cfg.activeColorAlpha ?? 0.75) || 0.75));
  const fillRgba = activeBucketHex ? hexToRgba(activeBucketHex, activeFillAlpha) : hexToRgba(regionHex, 1);
  ctx.save();
  strokeCellsFootprint(ctx, cx, cy, fillOffsets, cellSize, hexToRgba(regionHex, Math.max(0.65, opacity)), fillRgba, outerShadow, lineW, true);
  if (!isBgEraser && !isMagic && isSymmetryActive()) {
    const covered = new Set(fillOffsets.map(({ dx, dy }) => `${lx + dx},${ly + dy}`));
    const tileBaseX = Math.floor(cx / w) * w;
    const tileBaseY = Math.floor(cy / h) * h;
    const symPts = getSymmetryPoints(lx, ly, w, h);
    ctx.globalAlpha = 0.65;
    for (let i = 1; i < symPts.length; i++) {
      const [sx, sy] = symPts[i];
      if (sx < 0 || sx >= w || sy < 0 || sy >= h || covered.has(`${sx},${sy}`)) continue;
      const symOffsets = getFloodFillPreviewOffsets(sx, sy, w, h, { respectSelection: true, skipCache: true });
      if (!symOffsets?.length) continue;
      for (const { dx, dy } of symOffsets) covered.add(`${sx + dx},${sy + dy}`);
      strokeCellsFootprint(ctx, tileBaseX + sx, tileBaseY + sy, symOffsets, cellSize, hexToRgba(regionHex, Math.max(0.65, opacity)), fillRgba, outerShadow, lineW, true);
    }
  }
  ctx.restore();
  return true;
}

/**
 * Dibuja la vista previa precisa del píxel o área de herramienta bajo el cursor (con soporte de simetría).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cellSize
 * @param {number} zoom
 */
export function drawPixelCursorOverlay(ctx, cellSize, zoom) {
  if (!state.showPixelCursor || !state.cursorPos || state.freeTransform || state.isPlaying) {
    clearFillPreviewCache();
    return;
  }
  if (PIXEL_CURSOR_SKIP_TOOLS.has(state.currentTool)) return;
  const activeLayer = state.layers?.[state.activeLayerIndex];
  if (activeLayer?.type === "tilemap" && state.tilemapMode === "tiles") return;

  const cfg = state.pixelCursorConfig || {};
  const wantsRegionPreview = REGION_PREVIEW_TOOLS.has(state.currentTool) && cfg.fillPreview !== false;

  const { w, h } = getGridDims();
  const maxW = w * (state.tiledMode === "x" || state.tiledMode === "both" ? 3 : 1);
  const maxH = h * (state.tiledMode === "y" || state.tiledMode === "both" ? 3 : 1);
  const { x: cx, y: cy } = state.cursorPos;
  if (cx < 0 || cx >= maxW || cy < 0 || cy >= maxH) return;

  const opacity = Math.max(0.2, Math.min(1, Number(cfg.opacity ?? 0.75) || 0.75));
  const baseStrokePx = Math.max(0.75, Math.min(2.5, Number(cfg.lineWidth ?? 1) || 1));
  const isEraser = state.currentTool === "eraser" || state.currentTool === "backgroundEraser";
  const activePaintHex =
    !isEraser && cfg.useActiveColor !== false && state.currentColorIndex !== 0
      ? state.paletteMap?.[state.currentColorIndex] || null
      : null;
  const baseHex = isEraser ? (cfg.eraserColor || "#f87171ee") : (activePaintHex || cfg.color || "#38bdf8ee");
  const strokeColor = hexToRgba(baseHex, opacity);
  const activeFillAlpha = Math.max(0.1, Math.min(1, Number(cfg.activeColorAlpha ?? 0.75) || 0.75));
  const fillAlpha = isEraser ? opacity * 0.14 : activePaintHex ? activeFillAlpha : opacity * 0.1;
  const fillColor = hexToRgba(baseHex, fillAlpha);
  const outerShadow = `rgba(9, 9, 11, ${(opacity * 0.45).toFixed(2)})`;
  const lineW = Math.max(0.5, baseStrokePx / (zoom || 1));
  const shadowPad = Math.max(0.5, 0.75 / (zoom || 1));

  if (wantsRegionPreview && tryDrawRegionPreview(ctx, cx, cy, w, h, cellSize, cfg, opacity, outerShadow, lineW)) return;

  const isBrushTool = BRUSH_FOOTPRINT_TOOLS.has(state.currentTool);
  const customBrush = isBrushTool && !isEraser && state.activeCustomBrushId ? (state.customBrushes || []).find((b) => b.id === state.activeCustomBrushId) : null;
  const customOffsets = customBrush?.pixels?.length ? getCustomBrushFootprintOffsets(customBrush, state.brushSize) : null;
  const brushSize = isBrushTool ? Math.max(1, Math.min(256, Math.round(Number(state.brushSize) || 1))) : 1;
  const brushStart = -Math.floor((brushSize - 1) / 2);

  const drawAt = (px, py, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (customOffsets) {
      strokeCellsFootprint(ctx, px, py, customOffsets, cellSize, strokeColor, fillColor, outerShadow, lineW);
    } else {
      const rx = Math.floor((px + brushStart) * cellSize), ry = Math.floor((py + brushStart) * cellSize);
      const rw = Math.floor((px + brushStart + brushSize) * cellSize) - rx, rh = Math.floor((py + brushStart + brushSize) * cellSize) - ry;
      ctx.fillStyle = fillColor; ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = outerShadow; ctx.lineWidth = lineW + shadowPad; ctx.strokeRect(rx + 0.5, ry + 0.5, Math.max(1, rw - 1), Math.max(1, rh - 1));
      ctx.strokeStyle = strokeColor; ctx.lineWidth = lineW; ctx.strokeRect(rx + 0.5, ry + 0.5, Math.max(1, rw - 1), Math.max(1, rh - 1));
      if (brushSize > 1 && alpha === 1 && cfg.showCenterDot !== false) {
        const cx0 = Math.floor(px * cellSize), cy0 = Math.floor(py * cellSize);
        ctx.strokeStyle = `rgba(255, 255, 255, ${(opacity * 0.55).toFixed(2)})`;
        ctx.lineWidth = Math.max(0.5, 0.75 / (zoom || 1));
        ctx.strokeRect(cx0 + 0.5, cy0 + 0.5, Math.max(1, Math.floor((px + 1) * cellSize) - cx0 - 1), Math.max(1, Math.floor((py + 1) * cellSize) - cy0 - 1));
      }
      if (state.currentTool === "eyedropper" && alpha === 1) drawEyedropperBadge(ctx, px, py, rx, ry, rw, rh, w, h, maxW, maxH, cellSize, zoom);
    }
    ctx.restore();
  };

  drawAt(cx, cy, 1);
  if (MIRROR_CURSOR_TOOLS.has(state.currentTool) && isSymmetryActive()) {
    const tileBaseX = Math.floor(cx / w) * w, tileBaseY = Math.floor(cy / h) * h;
    const localX = cx - tileBaseX, localY = cy - tileBaseY;
    const symPts = getSymmetryPoints(localX, localY, w, h);
    for (let i = 1; i < symPts.length; i++) {
      const [sx, sy] = symPts[i];
      if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
        drawAt(tileBaseX + sx, tileBaseY + sy, 0.45);
      }
    }
  }
}
