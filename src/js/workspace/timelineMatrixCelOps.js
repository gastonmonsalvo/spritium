/**
 * timelineMatrixCelOps.js: Celdas de la matriz Capas × Frames (selección, menú contextual y drag & drop).
 */

import { state, pushState, cloneGrid, createEmptyGrid, getGridDims } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { setStatus } from "../ui/status.js";
import { selectFrame, syncActiveFrame } from "./frames.js";
import { renderLayersUI, syncActiveLayerGrid } from "./layers.js";
import { reconcileLayerTilemap } from "./tilemap.js";
import {
  selectedCels,
  getCelAnchor,
  setCelAnchor,
  celKey,
  getSelectedCelsList,
  selectSingleCel,
  selectCelRect,
  openCelContextMenu,
} from "./timelineTagsAndCels.js";
import { i18n } from "../i18n/I18nService.js";

function hasOpaquePixels(grid) {
  if (!Array.isArray(grid)) return false;
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      if (row[x] && row[x] !== 0) return true;
    }
  }
  return false;
}

function clearCelLayer(layerObj, w, h) {
  delete layerObj.celGroupId;
  layerObj.grid = createEmptyGrid(w, h);
  layerObj.outOfBounds = [];
  if (layerObj.type === "tilemap") reconcileLayerTilemap(layerObj, "auto");
}

function applyBatchCelDrop(srcDrag, f, l, isCopy, onRefresh) {
  const df = f - srcDrag.frameIdx;
  const dl = l - srcDrag.layerIdx;
  if (df === 0 && dl === 0) return;
  syncActiveFrame();
  pushState();

  const { w, h } = getGridDims();
  const snapshots = srcDrag.batch
    .map((item) => {
      const sLayer = state.frames[item.frameIdx]?.layers?.[item.layerIdx];
      if (!sLayer) return null;
      return {
        ...item,
        grid: cloneGrid(sLayer.grid),
        outOfBounds: Array.isArray(sLayer.outOfBounds) ? sLayer.outOfBounds.map((p) => [...p]) : [],
      };
    })
    .filter(Boolean);

  if (!isCopy) {
    for (const snap of snapshots) {
      const sLayer = state.frames[snap.frameIdx]?.layers?.[snap.layerIdx];
      if (sLayer) clearCelLayer(sLayer, w, h);
    }
  }

  selectedCels.clear();
  let applied = 0;
  for (const snap of snapshots) {
    const dst = state.frames[snap.frameIdx + df]?.layers?.[snap.layerIdx + dl];
    if (!dst) continue;
    delete dst.celGroupId;
    dst.grid = cloneGrid(snap.grid);
    dst.outOfBounds = snap.outOfBounds.map((p) => [...p]);
    if (dst.type === "tilemap") reconcileLayerTilemap(dst, "auto");
    selectedCels.add(celKey(snap.layerIdx + dl, snap.frameIdx + df));
    applied++;
  }

  syncActiveLayerGrid();
  renderAll();
  onRefresh();
  setStatus({ key: isCopy ? "log.cels_copied" : "log.cels_moved", params: { count: applied } });
}

function applySingleCelDrop(srcDrag, f, l, isCopy, onRefresh) {
  const src = state.frames[srcDrag.frameIdx]?.layers?.[srcDrag.layerIdx];
  const dst = state.frames[f]?.layers?.[l];
  if (!src || !dst || src === dst) return;
  syncActiveFrame();
  pushState();
  dst.grid = cloneGrid(src.grid);
  dst.outOfBounds = Array.isArray(src.outOfBounds) ? src.outOfBounds.map((p) => [...p]) : [];
  if (dst.type === "tilemap") reconcileLayerTilemap(dst, "auto");
  if (!isCopy) {
    const { w, h } = getGridDims();
    clearCelLayer(src, w, h);
  }
  selectSingleCel(l, f);
  syncActiveLayerGrid();
  renderAll();
  onRefresh();
  setStatus({ key: isCopy ? "log.cel_copied_frame" : "log.cel_moved_frame", params: { f: f + 1 } });
}

function handleCelClick(e, f, l, onRefresh) {
  if (e.shiftKey) {
    const anchor = getCelAnchor() || { layerIdx: state.activeLayerIndex || 0, frameIdx: state.activeFrameIndex || 0 };
    selectCelRect(anchor.layerIdx, anchor.frameIdx, l, f);
  } else if (e.ctrlKey || e.metaKey) {
    const key = celKey(l, f);
    if (selectedCels.has(key) && selectedCels.size > 1) selectedCels.delete(key);
    else selectedCels.add(key);
    setCelAnchor({ layerIdx: l, frameIdx: f });
  } else {
    selectSingleCel(l, f);
  }

  if (f !== state.activeFrameIndex) selectFrame(f);
  state.activeLayerIndex = l;
  syncActiveLayerGrid();
  renderLayersUI();
  onRefresh();
  if (selectedCels.size > 1) {
    setStatus({ key: "log.cels_selected", params: { count: selectedCels.size } });
  }
}

/**
 * Crea un nodo de celda interactiva `(layer l, frame f)` dentro de la matriz del timeline.
 * @param {number} f
 * @param {number} l
 * @param {number} frameCount
 * @param {{current: any}} dragCelState
 * @param {() => void} onRefresh
 * @returns {HTMLDivElement}
 */
export function createMatrixCelElement(f, l, frameCount, dragCelState, onRefresh) {
  const celLayer = state.frames[f]?.layers?.[l];
  const hasContent = hasOpaquePixels(celLayer?.grid);
  const gid = celLayer?.celGroupId;
  const linkedLeft = Boolean(gid && f > 0 && state.frames[f - 1]?.layers?.[l]?.celGroupId === gid);
  const linkedRight = Boolean(gid && f < frameCount - 1 && state.frames[f + 1]?.layers?.[l]?.celGroupId === gid);

  const cell = document.createElement("div");
  const isCur = f === state.activeFrameIndex && l === state.activeLayerIndex;
  const isSel = selectedCels.has(celKey(l, f));
  cell.className = `tm-cel-cell${isCur ? " active" : ""}${isSel ? " selected" : ""}`;
  cell.draggable = Boolean(celLayer);
  cell.title = i18n.t("matrix.cell_title", { l: l + 1, f: f + 1 });

  const dot = document.createElement("span");
  dot.className = ["tm-cel-dot", hasContent ? "filled" : "empty", linkedLeft ? "link-left" : "", linkedRight ? "link-right" : ""]
    .filter(Boolean)
    .join(" ");
  cell.appendChild(dot);

  cell.addEventListener("click", (e) => handleCelClick(e, f, l, onRefresh));
  cell.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (!selectedCels.has(celKey(l, f))) {
      selectSingleCel(l, f);
      if (f !== state.activeFrameIndex) selectFrame(f);
      state.activeLayerIndex = l;
      syncActiveLayerGrid();
      renderLayersUI();
      onRefresh();
    }
    openCelContextMenu(e.clientX, e.clientY, f, l);
  });
  cell.addEventListener("dragstart", () => {
    const key = celKey(l, f);
    const batch = selectedCels.size > 1 && selectedCels.has(key) ? getSelectedCelsList() : null;
    dragCelState.current = { frameIdx: f, layerIdx: l, batch };
  });
  cell.addEventListener("dragover", (e) => e.preventDefault());
  cell.addEventListener("drop", (e) => {
    e.preventDefault();
    const srcDrag = dragCelState.current;
    dragCelState.current = null;
    if (!srcDrag) return;
    const isCopy = e.ctrlKey || e.metaKey;
    if (srcDrag.batch && srcDrag.batch.length > 1) applyBatchCelDrop(srcDrag, f, l, isCopy, onRefresh);
    else applySingleCelDrop(srcDrag, f, l, isCopy, onRefresh);
  });

  return cell;
}
