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
import { syncActiveLayerGrid, renderLayersUI } from "../workspace/layers.js";
import { renderTilesetPanelUI, syncAllTilemapLayers } from "../workspace/tilemap.js";
import { syncActiveFrame, stopAnimation, renderFramesUI } from "../workspace/frames.js";
import { populateThemeSelect, buildPaletteUI, renderCustomPaletteUI } from "../workspace/paletteManager.js";
import { renderAll, applyZoom } from "../canvas/canvas.js";
import { renderRulers } from "../canvas/rulers.js";
import { setStatus, updateResolutionButtons } from "../ui/index.js";
import {
  buildColorLut,
  drawLayerToImageData,
  cloneFrameEntry as cloneFrameEntryCore,
  normalizeProjectName,
  assembleProjectSnapshot,
  applySnapshotToState,
} from "./projectSnapshotCore.js";

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

/** Construye un snapshot serializable completo del proyecto actual. */
export function buildCurrentProjectSnapshot(customName = null) {
  syncActiveFrame();
  const assetName =
    customName ||
    (typeof document !== "undefined" ? document.getElementById("assetName")?.value.trim() : "") ||
    "nuevo_proyecto";
  const framesCopy = state.frames.map((f, idx) => cloneFrameEntryCore(f, idx, cloneLayers));
  const dims = getGridDims();
  return assembleProjectSnapshot({
    stateObj: state,
    assetName,
    dims,
    framesCopy,
    thumbnailDataUrl: renderThumbnailDataUrl(framesCopy, state.paletteMap, dims.w, dims.h),
    clonePaletteMapFn: clonePaletteMap,
    cloneFrameTagsFn: cloneFrameTags,
    cloneTilesetsFn: cloneTilesets,
  });
}

/** Restaura un snapshot completo en el estado del editor y refresca toda la UI. */
export function restoreProjectSnapshot(data, label = null, { recordHistory = true } = {}) {
  stopAnimation();
  if (recordHistory) pushState();

  applySnapshotToState({
    data,
    stateObj: state,
    setGridSizeFn: setGridSize,
    cloneLayersFn: cloneLayers,
    clonePaletteMapFn: clonePaletteMap,
    cloneFrameTagsFn: cloneFrameTags,
    cloneTilesetsFn: cloneTilesets,
  });
  syncActiveLayerGrid();
  syncAllTilemapLayers();

  const nameInput = typeof document !== "undefined" ? document.getElementById("assetName") : null;
  if (nameInput) nameInput.value = normalizeProjectName(data.name);

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
