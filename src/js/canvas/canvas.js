/**
 * canvas.js: Rendering con escala adaptativa (64 o 32).
 */
import { CANVAS_PX, state, getGridDims } from "../core/state.js";
import { renderRulers } from "./rulers.js";
import { renderGridCoordsOverlay } from "./gridCoordsOverlay.js";
import { parseColorToRgba } from "../core/color.js";
import {
  drawAdaptivePixelGrid,
  drawCanvasCenterGuides,
  drawRulerGuides,
  drawSymmetryAxes,
  drawTiledCenterBorder,
  drawSnapGuides,
} from "./GridAndGuidesRenderer.js";
import {
  registerCanvasOverlay,
  runCanvasOverlays,
  drawSelectionAndGizmosOverlay,
} from "./OverlayPipeline.js";

export { registerCanvasOverlay, drawSnapGuides };

let ctx = null;
let tiledFrameBuffer = null;
let onionFrameBuffer = null;

function drawOnionSkinLayer(targetCtx, frameLayers, drawLayersStack, baseW, baseH, alpha, tintHex) {
  if (!frameLayers?.length || alpha <= 0) return;
  if (!tintHex) {
    drawLayersStack(targetCtx, frameLayers, alpha);
    return;
  }
  if (!onionFrameBuffer) onionFrameBuffer = document.createElement("canvas");
  if (onionFrameBuffer.width !== baseW || onionFrameBuffer.height !== baseH) {
    onionFrameBuffer.width = baseW;
    onionFrameBuffer.height = baseH;
  }
  const oCtx = onionFrameBuffer.getContext("2d");
  oCtx.clearRect(0, 0, baseW, baseH);
  oCtx.globalCompositeOperation = "source-over";
  drawLayersStack(oCtx, frameLayers, 1);
  oCtx.globalCompositeOperation = "source-atop";
  oCtx.fillStyle = tintHex;
  oCtx.fillRect(0, 0, baseW, baseH);
  oCtx.globalCompositeOperation = "source-over";

  targetCtx.save();
  targetCtx.globalAlpha = alpha;
  targetCtx.drawImage(onionFrameBuffer, 0, 0);
  targetCtx.restore();
}

function drawOnionSkinOverlays(targetCtx, drawLayersStack, baseW, baseH) {
  if (!state.onionSkin || state.isPlaying || !Array.isArray(state.frames)) return;
  const cfg = state.onionSkinConfig || { prevCount: 1, nextCount: 0, opacity: 0.3, mode: "normal" };
  const baseAlpha = Math.max(0.05, Math.min(0.9, Number(cfg.opacity) || 0.3));
  const isRedBlue = cfg.mode === "redblue";

  const prevCount = Math.max(0, Math.min(3, Number(cfg.prevCount) ?? 1));
  for (let d = prevCount; d >= 1; d--) {
    const idx = state.activeFrameIndex - d;
    if (idx < 0) continue;
    const frame = state.frames[idx];
    if (!frame?.layers) continue;
    const alpha = baseAlpha * Math.pow(0.65, d - 1);
    drawOnionSkinLayer(targetCtx, frame.layers, drawLayersStack, baseW, baseH, alpha, isRedBlue ? "#ef4444" : null);
  }

  const nextCount = Math.max(0, Math.min(2, Number(cfg.nextCount) ?? 0));
  for (let d = nextCount; d >= 1; d--) {
    const idx = state.activeFrameIndex + d;
    if (idx >= state.frames.length) continue;
    const frame = state.frames[idx];
    if (!frame?.layers) continue;
    const alpha = baseAlpha * Math.pow(0.65, d - 1);
    drawOnionSkinLayer(targetCtx, frame.layers, drawLayersStack, baseW, baseH, alpha, isRedBlue ? "#3b82f6" : null);
  }
}


// --- DIMENSIONES, INICIALIZACIÓN Y CONTRASTE ADAPTATIVO ---
/**
 * Calcula las dimensiones base del lienzo en píxeles de pantalla y el tamaño de celda.
 * @returns {{w: number, h: number, cellSize: number, baseW: number, baseH: number}}
 */
export function getCanvasBasePx() {
  const { w, h } = getGridDims();
  const maxDim = Math.max(w, h);
  const cellSize = Math.max(1, Math.round(CANVAS_PX / maxDim));
  return {
    w,
    h,
    cellSize,
    baseW: w * cellSize,
    baseH: h * cellSize,
  };
}


/**
 * Devuelve la cantidad de tiles visibles en X e Y según state.tiledMode.
 * @returns {{tilesX: number, tilesY: number, centerTx: number, centerTy: number}}
 */
export function getTiledDimensions() {
  const mode = state.tiledMode || "none";
  const tilesX = mode === "x" || mode === "both" ? 3 : 1;
  const tilesY = mode === "y" || mode === "both" ? 3 : 1;
  return {
    tilesX,
    tilesY,
    centerTx: tilesX === 3 ? 1 : 0,
    centerTy: tilesY === 3 ? 1 : 0,
  };
}

let layerBufferCanvas = null;
let layerBufferCtx = null;
let layerBufferImageData = null;

function ensureLayerBuffer(w, h) {
  if (!layerBufferCanvas) {
    layerBufferCanvas = document.createElement("canvas");
    layerBufferCtx = layerBufferCanvas.getContext("2d");
  }
  if (layerBufferCanvas.width !== w || layerBufferCanvas.height !== h) {
    layerBufferCanvas.width = w;
    layerBufferCanvas.height = h;
    layerBufferImageData = layerBufferCtx.createImageData(w, h);
  } else if (!layerBufferImageData) {
    layerBufferImageData = layerBufferCtx.createImageData(w, h);
  }
  return { canvas: layerBufferCanvas, ctx: layerBufferCtx, imageData: layerBufferImageData };
}

function buildPaletteRgbaLut() {
  const lut = new Map();
  for (const [k, colorStr] of Object.entries(state.paletteMap || {})) {
    const idx = Number(k);
    if (idx > 0 && colorStr) {
      const rgba = parseColorToRgba(colorStr);
      if (rgba) lut.set(idx, rgba);
    }
  }
  return lut;
}

function rasterizeLayerGridToBuffer(grid, w, h, rgbaLut) {
  const { canvas, ctx: bCtx, imageData } = ensureLayerBuffer(w, h);
  const data = imageData.data;
  data.fill(0);

  for (let y = 0; y < h; y++) {
    const row = grid[y];
    if (!row) continue;
    const rowOffset = y * w;
    for (let x = 0; x < w; x++) {
      const colorIdx = row[x];
      if (!colorIdx) continue;
      const rgba = rgbaLut.get(colorIdx);
      if (!rgba) continue;
      const p = (rowOffset + x) << 2;
      data[p] = rgba[0];
      data[p + 1] = rgba[1];
      data[p + 2] = rgba[2];
      data[p + 3] = rgba[3];
    }
  }
  bCtx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Inicializa el contexto 2D del lienzo principal y realiza el primer renderizado.
 * @param {HTMLCanvasElement} canvasElement
 */
export function initCanvas(canvasElement) {
  ctx = canvasElement.getContext("2d", { willReadFrequently: true });
  renderAll();
}

function syncCheckerboardToGrid(screenPixelSize) {
  const canvasEl = ctx?.canvas;
  if (!canvasEl) return;

  let tilePx = screenPixelSize;
  if (screenPixelSize < 3) tilePx = screenPixelSize * 16;
  else if (screenPixelSize < 5) tilePx = screenPixelSize * 8;
  else if (screenPixelSize < 8) tilePx = screenPixelSize * 4;

  const patternPx = Math.max(4, tilePx * 2);
  canvasEl.style.backgroundSize = `${patternPx}px ${patternPx}px`;
  canvasEl.style.backgroundPosition = "0 0";
}


// --- RENDER PRINCIPAL (COMPOSICIÓN, TILED MODE Y OVERLAYS) ---
/**
 * Redibuja el lienzo completo: capas visibles, onion skin, grilla adaptativa, ejes, selección y reglas.
 */
// --- RENDER PRINCIPAL (COMPOSICIÓN, TILED MODE Y OVERLAYS) ---
/** Redibuja el lienzo completo: capas visibles, onion skin, grilla adaptativa, ejes, selección y reglas. */
export function renderAll() {
  if (!ctx) return;

  const { w, h, cellSize, baseW, baseH } = getCanvasBasePx();
  const { tilesX, tilesY, centerTx, centerTy } = getTiledDimensions();
  const totalW = baseW * tilesX;
  const totalH = baseH * tilesY;
  if (ctx.canvas.width !== totalW || ctx.canvas.height !== totalH) {
    ctx.canvas.width = totalW;
    ctx.canvas.height = totalH;
  }

  ctx.clearRect(0, 0, totalW, totalH);

  const rgbaLut = buildPaletteRgbaLut();
  const drawLayersStack = (targetCtx, layersStack, baseAlpha = 1) => {
    const folderById = new Map();
    for (const l of layersStack) {
      if (l?.type === "folder" && l.id) folderById.set(l.id, l);
    }
    for (const layer of layersStack) {
      if (!layer.visible || !layer.grid || layer.type === "folder") continue;
      let folderAlpha = 1;
      if (layer.folderId) {
        const parent = folderById.get(layer.folderId);
        if (parent) {
          if (!parent.visible) continue;
          folderAlpha = parent.opacity ?? 1;
        }
      }
      const layerAlpha = baseAlpha * (layer.opacity ?? 1) * folderAlpha;
      if (layerAlpha <= 0) continue;
      const buf = rasterizeLayerGridToBuffer(layer.grid, w, h, rgbaLut);
      targetCtx.save();
      targetCtx.imageSmoothingEnabled = false;
      targetCtx.globalAlpha = layerAlpha;
      targetCtx.globalCompositeOperation = layer.blendMode || "source-over";
      targetCtx.drawImage(buf, 0, 0, baseW, baseH);
      targetCtx.globalCompositeOperation = "source-over";
      targetCtx.restore();
    }
  };

  const layersToDraw =
    state.layers && state.layers.length > 0
      ? state.layers
      : [{ visible: true, grid: state.grid }];

  const isTiled = tilesX > 1 || tilesY > 1;
  if (!isTiled) {
    drawOnionSkinOverlays(ctx, drawLayersStack, baseW, baseH);
    drawLayersStack(ctx, layersToDraw, 1);
  } else {
    if (!tiledFrameBuffer) {
      tiledFrameBuffer = document.createElement("canvas");
    }
    if (tiledFrameBuffer.width !== baseW || tiledFrameBuffer.height !== baseH) {
      tiledFrameBuffer.width = baseW;
      tiledFrameBuffer.height = baseH;
    }
    const bCtx = tiledFrameBuffer.getContext("2d");
    bCtx.clearRect(0, 0, baseW, baseH);
    drawOnionSkinOverlays(bCtx, drawLayersStack, baseW, baseH);
    drawLayersStack(bCtx, layersToDraw, 1);

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        ctx.save();
        ctx.globalAlpha = tx === centerTx && ty === centerTy ? 1 : 0.85;
        ctx.drawImage(tiledFrameBuffer, tx * baseW, ty * baseH);
        ctx.restore();
      }
    }
  }

  // 2. Grilla LOD progresiva + contraste adaptativo a la luminancia del fondo + checkerboard sincronizado
  const zoom = state.zoom || 1;
  const screenPixelSize = cellSize * zoom;
  syncCheckerboardToGrid(screenPixelSize);


  const tileOriginX = centerTx * baseW;
  const tileOriginY = centerTy * baseH;

  drawAdaptivePixelGrid(ctx, layersToDraw, w, h, cellSize, tilesX, tilesY, totalW, totalH, zoom);
  drawCanvasCenterGuides(ctx, tileOriginX, tileOriginY, baseW, baseH, w, h, zoom);
  drawRulerGuides(ctx, tileOriginX, tileOriginY, baseW, baseH, w, h, zoom);

  runCanvasOverlays(ctx, cellSize, tileOriginX, tileOriginY, baseW, baseH, zoom);
  drawSymmetryAxes(ctx, tileOriginX, tileOriginY, baseW, baseH);
  if (isTiled) {
    drawTiledCenterBorder(ctx, isTiled, tileOriginX, tileOriginY, baseW, baseH, zoom);
  }
  drawSelectionAndGizmosOverlay(ctx, cellSize, tileOriginX, tileOriginY, baseW, baseH, zoom, renderAll);

  // 5. Miniatura en vivo, reglas y coordenadas de cuadrícula
  renderPreview();
  renderRulers();
  renderGridCoordsOverlay();
}

// --- COORDENADAS, ZOOM, PREVIEW 1:1 Y GRILLA ---
/**
 * Convierte coordenadas de evento de mouse a coordenadas continuas (sin redondear) en la grilla.
 * @param {MouseEvent} e
 * @param {HTMLCanvasElement} canvasElement
 * @returns {{rawX: number, rawY: number}}
 */
export function getFloatGridCoordinates(e, canvasElement) {
  const rect = canvasElement.getBoundingClientRect();
  const { cellSize, baseW, baseH } = getCanvasBasePx();
  const { tilesX, tilesY, centerTx, centerTy } = getTiledDimensions();
  const scaleX = (baseW * tilesX) / rect.width;
  const scaleY = (baseH * tilesY) / rect.height;
  const rawX = (e.clientX - rect.left) * scaleX - centerTx * baseW;
  const rawY = (e.clientY - rect.top) * scaleY - centerTy * baseH;
  return { rawX: rawX / cellSize, rawY: rawY / cellSize };
}


/**
 * Convierte un evento de puntero a coordenadas discretas (x, y) de la grilla de píxeles.
 * @param {MouseEvent} e
 * @param {HTMLCanvasElement} canvasElement
 * @param {{unclampedTiled?: boolean, unclamped?: boolean}} [options]
 * @returns {{x: number, y: number}}
 */
export function getGridCoordinates(e, canvasElement, { unclampedTiled = false, unclamped = false } = {}) {
  const rect = canvasElement.getBoundingClientRect();
  const { w, h, cellSize, baseW, baseH } = getCanvasBasePx();
  const { tilesX, tilesY } = getTiledDimensions();
  const scaleX = (baseW * tilesX) / rect.width;
  const scaleY = (baseH * tilesY) / rect.height;

  const rawX = (e.clientX - rect.left) * scaleX;
  const rawY = (e.clientY - rect.top) * scaleY;

  const x = Math.floor(rawX / cellSize);
  const y = Math.floor(rawY / cellSize);

  const tiledX = state.tiledMode === "x" || state.tiledMode === "both";
  const tiledY = state.tiledMode === "y" || state.tiledMode === "both";
  const maxX = w * tilesX - 1;
  const maxY = h * tilesY - 1;

  return {
    x: unclamped || (tiledX && unclampedTiled) ? x : Math.max(0, Math.min(maxX, x)),
    y: unclamped || (tiledY && unclampedTiled) ? y : Math.max(0, Math.min(maxY, y)),
  };
}

/**
 * Aplica el nivel de zoom (50% a 800%), ajusta el tamaño del canvas y actualiza reglas.
 * @param {number} newZoom
 */
/**
 * Ajusta el zoom del lienzo para que entre completo y centrado dentro del contenedor visible.
 */
export function fitZoomToViewport() {
  const container = document.getElementById("canvasContainer");
  if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) return;
  const { baseW, baseH } = getCanvasBasePx();
  const availW = Math.max(96, container.clientWidth - 40);
  const availH = Math.max(96, container.clientHeight - 40);
  const targetZoom = Math.min(availW / baseW, availH / baseH);
  applyZoom(Math.max(0.25, Math.min(4, targetZoom)));
}

/**
 * Aplica un factor de zoom (`0.25–16`), redimensionando el canvas y actualizando reglas/overlays.
 * @param {number} newZoom
 */
export function applyZoom(newZoom) {
  state.zoom = Math.max(0.25, Math.min(16, Number(Number(newZoom).toFixed(2))));

  const canvas = document.getElementById("paintCanvas");
  const container = document.getElementById("canvasContainer");
  if (!canvas) return;

  const { baseW, baseH } = getCanvasBasePx();
  const { tilesX, tilesY } = getTiledDimensions();
  const internalW = baseW * tilesX;
  const internalH = baseH * tilesY;
  if (canvas.width !== internalW || canvas.height !== internalH) {
    canvas.width = internalW;
    canvas.height = internalH;
  }

  const scaledW = Math.round(baseW * tilesX * state.zoom);
  const scaledH = Math.round(baseH * tilesY * state.zoom);

  canvas.style.width = `${scaledW}px`;
  canvas.style.height = `${scaledH}px`;

  if (container) {
    container.style.placeItems =
      scaledW > container.clientWidth || scaledH > container.clientHeight
        ? "start"
        : "center";
  }

  const pct = Math.round(state.zoom * 100);
  const zoomText = document.getElementById("zoomLevelText");
  if (zoomText) {
    zoomText.textContent = `${pct}%`;
  }
  const zoomSlider = document.getElementById("zoomSlider");
  if (zoomSlider && Number(zoomSlider.value) !== pct) {
    zoomSlider.value = String(pct);
  }
  renderAll();
}

if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    const canvas = document.getElementById("paintCanvas");
    const container = document.getElementById("canvasContainer");
    if (!canvas || !container) return;
    const scaledW = canvas.offsetWidth;
    const scaledH = canvas.offsetHeight;
    container.style.placeItems =
      scaledW > container.clientWidth || scaledH > container.clientHeight
        ? "start"
        : "center";
  });
}
let previewTileBuffer = null;

/**
 * Renderiza la vista previa 1:1 (o mosaico 3×3 / 3×1 / 1×3 en Tiled Mode) componiendo todas las capas visibles.
 */
export function renderPreview() {
  const preview = document.getElementById("previewCanvas");
  if (!preview) return;

  const pCtx = preview.getContext("2d");
  const { w, h } = getGridDims();
  const mode = state.tiledMode || "none";
  const tilesX = mode === "x" || mode === "both" ? 3 : 1;
  const tilesY = mode === "y" || mode === "both" ? 3 : 1;
  const targetW = w * tilesX;
  const targetH = h * tilesY;

  if (preview.width !== targetW || preview.height !== targetH) {
    preview.width = targetW;
    preview.height = targetH;
  }
  preview.style.aspectRatio = `${targetW} / ${targetH}`;

  pCtx.clearRect(0, 0, targetW, targetH);

  const layersToDraw =
    state.layers && state.layers.length > 0
      ? state.layers
      : [{ visible: true, grid: state.grid }];

  const previewRgbaLut = buildPaletteRgbaLut();
  const drawSingleTile = (targetCtx) => {
    for (const layer of layersToDraw) {
      if (!layer.visible || !layer.grid) continue;
      const layerAlpha = layer.opacity ?? 1;
      if (layerAlpha <= 0) continue;
      const buf = rasterizeLayerGridToBuffer(layer.grid, w, h, previewRgbaLut);
      targetCtx.save();
      targetCtx.imageSmoothingEnabled = false;
      targetCtx.globalAlpha = layerAlpha;
      targetCtx.globalCompositeOperation = layer.blendMode || "source-over";
      targetCtx.drawImage(buf, 0, 0, w, h);
      targetCtx.globalCompositeOperation = "source-over";
      targetCtx.restore();
    }
  };

  if (tilesX === 1 && tilesY === 1) {
    drawSingleTile(pCtx);
    return;
  }

  if (!previewTileBuffer) {
    previewTileBuffer = document.createElement("canvas");
  }
  if (previewTileBuffer.width !== w || previewTileBuffer.height !== h) {
    previewTileBuffer.width = w;
    previewTileBuffer.height = h;
  }
  const bCtx = previewTileBuffer.getContext("2d");
  bCtx.clearRect(0, 0, w, h);
  drawSingleTile(bCtx);

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      pCtx.drawImage(previewTileBuffer, tx * w, ty * h);
    }
  }

  // Resalta el tile central para distinguir las uniones
  const cx = tilesX === 3 ? w : 0;
  const cy = tilesY === 3 ? h : 0;
  pCtx.save();
  pCtx.strokeStyle = "rgba(16, 185, 129, 0.75)";
  pCtx.lineWidth = Math.max(1, Math.round(Math.max(w, h) / 32));
  pCtx.strokeRect(cx + 0.5, cy + 0.5, w - 1, h - 1);
  pCtx.restore();
}

// Dibuja las líneas divisorias entre cada píxel del sprite
function drawPixelGrid(ctx, cellSize) {
  // Solo mostrar la cuadrícula si cada celda mide al menos 6px en pantalla
  // (evita que se vuelva un manchón gris cuando estás alejado)
  if (cellSize < 6) return;

  const size = state.gridSize || 64;
  const totalPx = size * cellSize;

  ctx.save();
  ctx.beginPath();
  ctx.lineWidth = 1;
  // Línea semitransparente para que no tape los colores del sprite
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";

  for (let i = 0; i <= size; i++) {
    const pos = Math.round(i * cellSize) + 0.5;

    // Líneas verticales
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, totalPx);

    // Líneas horizontales
    ctx.moveTo(0, pos);
    ctx.lineTo(totalPx, pos);
  }

  ctx.stroke();

  // Subdivisión cada 8 o 16 píxeles un poco más marcada
  const blockSize = 8;
  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";

  for (let i = 0; i <= size; i += blockSize) {
    const pos = Math.round(i * cellSize) + 0.5;
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, totalPx);
    ctx.moveTo(0, pos);
    ctx.lineTo(totalPx, pos);
  }
  ctx.stroke();

  ctx.restore();
}

