/**
 * layersCrudOps.js: Creación, carpetas, duplicado, eliminación, limpieza y portapapeles de capas.
 */

import { state, pushState, createEmptyGrid, cloneGrid, getGridDims, notify } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { setStatus } from "../ui/index.js";
import { i18n } from "../i18n/I18nService.js";
import { createLayer, syncActiveLayerGrid, setSelectedLayerIndices, forEachFrameLayers } from "./layersOps.js";

function cloneTilemapMeta(src, dst) {
  if (src.type !== "tilemap") return;
  dst.type = "tilemap";
  dst.tilesetId = src.tilesetId;
  dst.tileWidth = src.tileWidth || 16;
  dst.tileHeight = src.tileHeight || 16;
  dst.tileGrid = src.tileGrid ? cloneGrid(src.tileGrid) : null;
}

/** Agrega una nueva capa vacía o con grilla inicial encima de la activa. */
export function addNewLayer(name = null, grid = null) {
  pushState();
  const insertAt = state.activeLayerIndex + 1;
  const layerName = name || i18n.t("default.layer_name", { n: state.layers.length + 1 });
  const layer = createLayer(layerName, null, grid);

  forEachFrameLayers((layersList, fIdx) => {
    const isCurrent = !state.frames?.length || fIdx === state.activeFrameIndex;
    layersList.splice(insertAt, 0, isCurrent ? layer : createLayer(layerName, null, null));
  });

  state.activeLayerIndex = insertAt;
  setSelectedLayerIndices([insertAt]);
  syncActiveLayerGrid();
  notify("layers:render");
  renderAll();
  setStatus({ key: "log.layer_added", params: { name: layer.name } });
  return layer;
}

/** Agrega una nueva carpeta de capas vacía encima de la capa activa. */
export function addNewFolder(name = null) {
  pushState();
  const insertAt = state.activeLayerIndex + 1;
  const folderName = name || i18n.t("default.folder_name", { n: state.layers.filter((l) => l.type === "folder").length + 1 });
  const folderId = `folder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const buildFolder = () => ({
    id: folderId, name: folderName, visible: true, locked: false, opacity: 1,
    blendMode: "source-over", type: "folder", collapsed: false, grid: null, outOfBounds: [],
  });

  forEachFrameLayers((layersList) => layersList.splice(insertAt, 0, buildFolder()));
  state.activeLayerIndex = insertAt;
  setSelectedLayerIndices([insertAt]);
  notify("layers:render");
  renderAll();
  setStatus({ key: "log.folder_created", params: { name: folderName } });
}

/** Alterna el estado colapsado/expandido de una carpeta de capas. */
export function toggleFolderCollapsed(index) {
  const folder = state.layers?.[index];
  if (!folder || folder.type !== "folder") return;
  const next = !folder.collapsed;
  folder.collapsed = next;
  for (const frame of state.frames || []) {
    if (frame.layers?.[index]?.type === "folder") frame.layers[index].collapsed = next;
  }
  notify("layers:render");
}

/** Mueve una capa dentro o fuera de una carpeta (o null para raíz) en todos los frames. */
export function moveLayerToFolder(layerIndex, folderId = null) {
  const layer = state.layers?.[layerIndex];
  if (!layer || layer.type === "folder") return;
  pushState();

  forEachFrameLayers((list) => {
    const target = list[layerIndex];
    if (!target) return;
    target.folderId = folderId || null;
    if (!folderId) return;
    const fIdx = list.findIndex((l) => l?.type === "folder" && l.id === folderId);
    if (fIdx !== -1 && layerIndex !== fIdx - 1) {
      const [moved] = list.splice(layerIndex, 1);
      const newFolderIdx = list.findIndex((l) => l?.type === "folder" && l.id === folderId);
      list.splice(Math.max(0, newFolderIdx), 0, moved);
    }
  });

  const newIdx = state.layers.indexOf(layer);
  if (newIdx !== -1) state.activeLayerIndex = newIdx;
  setSelectedLayerIndices([state.activeLayerIndex]);
  syncActiveLayerGrid();
  notify("layers:render");
  renderAll();
  setStatus({ key: folderId ? "log.layer_moved_folder" : "log.layer_moved_root", params: { name: layer.name } });
}

/** Duplica la capa en el índice indicado en todos los frames. */
export function duplicateLayerAt(index = state.activeLayerIndex) {
  const src = state.layers[index];
  if (!src) return;
  pushState();
  const copyName = i18n.t("default.copy_suffix", { name: src.name });

  forEachFrameLayers((layersList) => {
    const fSrc = layersList[index] || src;
    const copy = createLayer(copyName, null, fSrc.grid || null, fSrc.opacity ?? 1, false, fSrc.blendMode || "source-over");
    cloneTilemapMeta(fSrc, copy);
    layersList.splice(index + 1, 0, copy);
  });

  state.activeLayerIndex = index + 1;
  setSelectedLayerIndices([state.activeLayerIndex]);
  syncActiveLayerGrid();
  notify("layers:render");
  renderAll();
  setStatus({ key: "log.layer_duplicated", params: { name: copyName } });
}

/** Duplica la capa activa. */
export function duplicateActiveLayer() {
  duplicateLayerAt(state.activeLayerIndex);
}

/** Elimina la capa en el índice indicado en todos los frames si no está bloqueada y queda al menos una. */
export function deleteLayerAt(index = state.activeLayerIndex) {
  const target = state.layers[index];
  if (target?.locked) { setStatus({ key: "log.layer_locked_named", params: { name: target.name } }, true); return; }
  if (state.layers.length <= 1) { setStatus({ key: "log.layer_min_one" }, true); return; }

  pushState();
  const removedName = target?.name || i18n.t("default.layer_name", { n: index + 1 });
  forEachFrameLayers((layersList) => {
    if (layersList.length > 1 && index < layersList.length) layersList.splice(index, 1);
  });

  state.activeLayerIndex = Math.max(0, Math.min(state.activeLayerIndex, state.layers.length - 1));
  setSelectedLayerIndices([state.activeLayerIndex]);
  syncActiveLayerGrid();
  state.isDirtySinceImport = true;
  notify("layers:render");
  renderAll();
  setStatus({ key: "log.layer_deleted", params: { name: removedName } });
}

/** Elimina la capa activa. */
export function deleteActiveLayer() {
  deleteLayerAt(state.activeLayerIndex);
}

/** Vacía todos los píxeles de la capa indicada si no está bloqueada. */
export function clearLayerAt(index = state.activeLayerIndex) {
  const layer = state.layers[index];
  if (!layer) return;
  if (layer.locked) { setStatus({ key: "log.layer_locked_named", params: { name: layer.name } }, true); return; }
  pushState();
  for (let y = 0; y < layer.grid.length; y++) layer.grid[y].fill(0);
  if (layer.type === "tilemap" && Array.isArray(layer.tileGrid)) {
    for (let ty = 0; ty < layer.tileGrid.length; ty++) layer.tileGrid[ty].fill(0);
  }
  layer.outOfBounds = [];
  state.isDirtySinceImport = true;
  renderAll();
  if (layer.type === "tilemap") notify("tilemap:render");
  setStatus({ key: "log.layer_cleared", params: { name: layer.name } }, false, "pixel");
}

/** Copia el contenido completo de la capa indicada al portapapeles. */
export function copyLayerToClipboard(index = state.activeLayerIndex) {
  const layer = state.layers[index];
  if (!layer) return;
  const { w, h } = getGridDims();
  state.clipboard = { w, h, cells: cloneGrid(layer.grid) };
  setStatus({ key: "log.layer_copied", params: { name: layer.name } });
}

/** Copia y vacía la capa indicada si no está bloqueada. */
export function cutLayerToClipboard(index = state.activeLayerIndex) {
  const layer = state.layers[index];
  if (!layer) return;
  if (layer.locked) { setStatus({ key: "log.layer_locked_named", params: { name: layer.name } }, true); return; }
  copyLayerToClipboard(index);
  clearLayerAt(index);
  setStatus({ key: "log.layer_cut", params: { name: layer.name } }, false, "pixel");
}

/** Pega el portapapeles centrado como una nueva capa. */
export function pasteClipboardAsLayer() {
  if (!state.clipboard) { setStatus({ key: "log.layer_clipboard_empty" }, true); return; }
  const { w, h, cells } = state.clipboard;
  const { w: gw, h: gh } = getGridDims();
  const newGrid = createEmptyGrid(gw, gh);
  const startX = Math.max(0, Math.floor((gw - w) / 2));
  const startY = Math.max(0, Math.floor((gh - h) / 2));

  for (let r = 0; r < h; r++) {
    const ty = startY + r;
    if (ty < 0 || ty >= gh) continue;
    for (let c = 0; c < w; c++) {
      const tx = startX + c;
      if (tx >= 0 && tx < gw && cells[r][c] !== 0) newGrid[ty][tx] = cells[r][c];
    }
  }
  addNewLayer(i18n.t("default.pasted_name"), newGrid);
}
