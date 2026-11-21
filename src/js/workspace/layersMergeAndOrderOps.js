/**
 * layersMergeAndOrderOps.js: Fusión de capas y reordenamiento en la pila.
 */

import { state, pushState, createEmptyGrid, getGridDims, notify } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { setStatus } from "../ui/index.js";
import { getSelectedLayerIndices, setSelectedLayerIndices, syncActiveLayerGrid, forEachFrameLayers } from "./layersOps.js";
import { moveLayerToFolder } from "./layersCrudOps.js";

function mergeSingleStack(layersStack, sorted, targetIdx, gw, gh) {
  if (!Array.isArray(layersStack) || !layersStack[targetIdx]) return;
  const mergedGrid = createEmptyGrid(gw, gh);
  const oobMap = new Map();

  for (const idx of sorted) {
    const layer = layersStack[idx];
    if (!layer) continue;
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const px = layer.grid?.[y]?.[x] ?? 0;
        if (px !== 0) mergedGrid[y][x] = px;
      }
    }
    for (const [ox, oy, val] of layer.outOfBounds || []) {
      if (val !== 0) oobMap.set(`${ox},${oy}`, [ox, oy, val]);
    }
  }

  const target = layersStack[targetIdx];
  target.grid = mergedGrid;
  target.outOfBounds = Array.from(oobMap.values());
  target.visible = true;
  target.type = "pixel";
  delete target.tileGrid;
  delete target.tilesetId;
  delete target.tileWidth;
  delete target.tileHeight;
  delete target.celGroupId;
  for (let k = sorted.length - 1; k >= 1; k--) {
    if (sorted[k] < layersStack.length) layersStack.splice(sorted[k], 1);
  }
}

/** Combina un conjunto arbitrario de índices de capa en una sola capa (de abajo hacia arriba). */
export function mergeLayerIndices(indicesToMerge) {
  const sorted = [...new Set(indicesToMerge)].filter((i) => i >= 0 && i < state.layers.length).sort((a, b) => a - b);
  if (sorted.length < 2) { setStatus({ key: "log.layer_merge_min2" }, true); return; }
  if (sorted.some((idx) => state.layers[idx]?.locked)) { setStatus({ key: "log.layer_merge_locked" }, true); return; }

  pushState();
  const { w: gw, h: gh } = getGridDims();
  const targetIdx = sorted[0];
  forEachFrameLayers((stack) => mergeSingleStack(stack, sorted, targetIdx, gw, gh));

  state.activeLayerIndex = targetIdx;
  setSelectedLayerIndices([targetIdx]);
  syncActiveLayerGrid();
  state.isDirtySinceImport = true;
  notify("layers:render");
  renderAll();
  setStatus({ key: "log.layer_merged", params: { count: sorted.length, name: state.layers[targetIdx].name } }, false, "pixel");
}

/** Combina la capa activa con la capa inmediatamente inferior. */
export function mergeLayerDown() {
  if (state.activeLayerIndex <= 0) { setStatus({ key: "log.layer_merge_below_none" }, true); return; }
  mergeLayerIndices([state.activeLayerIndex - 1, state.activeLayerIndex]);
}

/** Combina las capas seleccionadas mediante Ctrl+Clic. */
export function mergeSelectedLayers() {
  mergeLayerIndices([...getSelectedLayerIndices()]);
}

/** Combina todas las capas visibles en una sola capa. */
export function mergeVisibleLayers() {
  const visible = state.layers.map((l, idx) => (l.visible ? idx : -1)).filter((idx) => idx >= 0);
  if (visible.length < 2) { setStatus({ key: "log.layer_merge_vis_min2" }, true); return; }
  mergeLayerIndices(visible);
}

/** Reordena una capa moviéndola desde fromIndex hacia toIndex. */
export function reorderLayer(fromIndex, toIndex, { intoFolder = false } = {}) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= state.layers.length || toIndex >= state.layers.length) return;
  const targetLayerObj = state.layers[toIndex];
  const movedLayerObj = state.layers[fromIndex];
  if (intoFolder && targetLayerObj?.type === "folder" && movedLayerObj?.type !== "folder") {
    moveLayerToFolder(fromIndex, targetLayerObj.id);
    return;
  }

  pushState();
  const activeLayerObj = state.layers[state.activeLayerIndex];
  const nextFolderId = movedLayerObj?.type === "folder" || targetLayerObj?.type === "folder" ? null : (targetLayerObj?.folderId || null);
  const insertIdx = fromIndex > toIndex ? Math.min(state.layers.length - 1, toIndex + 1) : toIndex;

  forEachFrameLayers((list) => {
    if (fromIndex >= list.length || toIndex >= list.length) return;
    const [m] = list.splice(fromIndex, 1);
    if (m && m.type !== "folder") m.folderId = nextFolderId;
    list.splice(insertIdx, 0, m);
  });

  state.activeLayerIndex = Math.max(0, state.layers.indexOf(activeLayerObj));
  setSelectedLayerIndices([state.activeLayerIndex]);
  syncActiveLayerGrid();
  notify("layers:render");
  renderAll();
}

/** Desplaza una capa una posición hacia arriba o abajo en la pila. */
export function moveLayerOrder(index, direction) {
  reorderLayer(index, index + direction);
}
