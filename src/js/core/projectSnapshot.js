/**
 * projectSnapshot.js: Construcción y restauración de snapshots serializables del proyecto y miniaturas PNG.
 */

import {
  state,
  pushState,
  setGridSize,
  getGridDims,
  cloneLayers,
  clonePaletteMap,
  cloneTilesets,
  cloneFrameTags,
} from "./state.js";
import { parseColorToRgba } from "./color.js";
import { syncActiveLayerGrid, renderLayersUI } from "../workspace/layers.js";
import { renderTilesetPanelUI, syncAllTilemapLayers } from "../workspace/tilemap.js";
import { syncActiveFrame, stopAnimation, renderFramesUI } from "../workspace/frames.js";
import { populateThemeSelect, buildPaletteUI, renderCustomPaletteUI } from "../workspace/paletteManager.js";
import { renderAll, applyZoom } from "../canvas/canvas.js";
import { renderRulers } from "../canvas/rulers.js";
import { setStatus, updateResolutionButtons } from "../ui/index.js";

function buildColorLut(paletteMap) {
  const lut = new Map();
  for (const [k, hex] of Object.entries(paletteMap || {})) {
    const idx = Number(k);
    if (idx > 0 && hex) {
      const rgba = parseColorToRgba(hex);
      if (rgba) lut.set(idx, rgba);
    }
  }
  return lut;
}

function drawLayerToImageData(layer, gridW, gridH, lut, data) {
  data.fill(0);
  for (let y = 0; y < gridH; y++) {
    const row = layer.grid[y];
    if (!row) continue;
    const rowOff = y * gridW;
    for (let x = 0; x < gridW; x++) {
      const idx = row[x];
      const rgba = idx ? lut.get(idx) : null;
      if (!rgba) continue;
      const p = (rowOff + x) << 2;
      data[p] = rgba[0]; data[p + 1] = rgba[1]; data[p + 2] = rgba[2]; data[p + 3] = rgba[3];
    }
  }
}

/** Genera una miniatura PNG base64 componiendo las capas visibles del primer frame. */
export function renderThumbnailDataUrl(frames, paletteMap, gridW, gridH = gridW) {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = gridW;
  canvas.height = gridH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const frame0 = frames?.[0];
  if (frame0?.layers) {
    const lut = buildColorLut(paletteMap);
    const layerCanvas = document.createElement("canvas");
    layerCanvas.width = gridW;
    layerCanvas.height = gridH;
    const lCtx = layerCanvas.getContext("2d");
    const imgData = lCtx.createImageData(gridW, gridH);

    for (const layer of frame0.layers) {
      if (layer.visible === false || !layer.grid || layer.opacity === 0) continue;
      drawLayerToImageData(layer, gridW, gridH, lut, imgData.data);
      lCtx.putImageData(imgData, 0, 0);
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;
      ctx.globalCompositeOperation = layer.blendMode || "source-over";
      ctx.drawImage(layerCanvas, 0, 0);
      ctx.restore();
    }
  }
  return canvas.toDataURL("image/png");
}

function cloneFrameEntry(f, idx) {
  const copy = {
    id: f.id || `frame_${idx + 1}`,
    durationMs: f.durationMs || 150,
    activeLayerIndex: f.activeLayerIndex || 0,
    layers: cloneLayers(f.layers || []),
  };
  if (f.name) copy.name = f.name;
  if (f.color) copy.color = f.color;
  if (f.colWidth) copy.colWidth = f.colWidth;
  return copy;
}

/** Construye un snapshot serializable completo del proyecto actual. */
export function buildCurrentProjectSnapshot(customName = null) {
  syncActiveFrame();
  const assetName =
    customName ||
    (typeof document !== "undefined" ? document.getElementById("assetName")?.value.trim() : "") ||
    "nuevo_proyecto";
  const framesCopy = state.frames.map(cloneFrameEntry);
  const { w, h } = getGridDims();
  return {
    app: "Spritium",
    version: 1,
    name: assetName,
    gridSize: state.gridSize,
    gridWidth: w,
    gridHeight: h,
    currentThemeKey: state.currentThemeKey,
    paletteMap: clonePaletteMap(state.paletteMap),
    customColorIndices: [...state.customColorIndices],
    activeFrameIndex: state.activeFrameIndex,
    frames: framesCopy,
    frameTags: cloneFrameTags(state.frameTags),
    activeTagId: state.activeTagId || null,
    tilesets: cloneTilesets(state.tilesets),
    activeTilesetId: state.activeTilesetId,
    originalImport: state.originalImport,
    updatedAt: Date.now(),
    thumbnailDataUrl: renderThumbnailDataUrl(framesCopy, state.paletteMap, w, h),
  };
}

/** Restaura un snapshot completo en el estado del editor y refresca toda la UI. */
export function restoreProjectSnapshot(data, label = null, { recordHistory = true } = {}) {
  stopAnimation();
  if (recordHistory) pushState();

  setGridSize(Number(data.gridWidth || data.gridSize), Number(data.gridHeight || data.gridSize));
  state.frames = data.frames.map(cloneFrameEntry);
  state.activeFrameIndex = Math.min(Math.max(0, Number(data.activeFrameIndex) || 0), state.frames.length - 1);
  state.frameTags = cloneFrameTags(data.frameTags || []);
  state.activeTagId = data.activeTagId || null;

  const activeFrame = state.frames[state.activeFrameIndex];
  state.layers = activeFrame.layers;
  state.activeLayerIndex = Math.min(Math.max(0, activeFrame.activeLayerIndex || 0), state.layers.length - 1);
  syncActiveLayerGrid();

  state.paletteMap = clonePaletteMap(data.paletteMap || { 0: null });
  state.customColorIndices = Array.isArray(data.customColorIndices) ? [...data.customColorIndices] : [];
  state.tilesets = cloneTilesets(data.tilesets || []);
  state.activeTilesetId = data.activeTilesetId || (state.tilesets[0]?.id ?? null);
  state.activeTileIndex = state.tilesets[0]?.tiles?.length > 1 ? 1 : 0;
  syncAllTilemapLayers();
  state.originalImport = data.originalImport || null;
  state.currentThemeKey = data.currentThemeKey || "original";
  state.isDirtySinceImport = true;
  state.selection = null;
  state.currentColorIndex = state.paletteMap[2] ? 2 : 1;

  const nameInput = typeof document !== "undefined" ? document.getElementById("assetName") : null;
  if (nameInput) nameInput.value = (data.name || "").trim() || "nuevo_proyecto";

  populateThemeSelect();
  buildPaletteUI();
  renderCustomPaletteUI();
  updateResolutionButtons(state.gridWidth || state.gridSize, state.gridHeight || state.gridSize);
  applyZoom(1);
  renderLayersUI();
  renderFramesUI();
  renderTilesetPanelUI();
  renderAll();
  renderRulers();

  setStatus(label || {
    key: "status.project_restored",
    params: { name: data.name, w: state.gridWidth || state.gridSize, h: state.gridHeight || state.gridSize, frames: state.frames.length },
  });
}
