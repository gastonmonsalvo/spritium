/**
 * layersOps.js: Modelo base de capas, bloqueos, selección, visibilidad, opacidad y modos de fusión.
 */

import { state, pushState, createEmptyGrid, cloneGrid, getGridDims, notify } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { setStatus } from "../ui/index.js";
import { i18n } from "../i18n/I18nService.js";

let layerCounter = 1;
let selectedLayerIndices = new Set([0]);

/** Devuelve el Set de índices de capas actualmente multi-seleccionadas. */
export function getSelectedLayerIndices() {
  return selectedLayerIndices;
}

/** Reemplaza el conjunto de índices seleccionados (uso interno entre módulos de capas). */
export function setSelectedLayerIndices(indices) {
  selectedLayerIndices = new Set(indices);
}

/** Aplica `fn(layersList, frameIdx)` en todos los frames (o sobre `state.layers` si no hay frames). */
export function forEachFrameLayers(fn) {
  if (Array.isArray(state.frames) && state.frames.length > 0) {
    state.frames.forEach((frame, fIdx) => {
      if (!Array.isArray(frame.layers)) frame.layers = [];
      fn(frame.layers, fIdx);
      if (fIdx === state.activeFrameIndex) state.layers = frame.layers;
    });
  } else {
    fn(state.layers, 0);
  }
}

export const LAYER_BLEND_MODES = [
  { value: "source-over", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn", label: "Color Burn" },
];

const VALID_BLEND_MODES = new Set(LAYER_BLEND_MODES.map((m) => m.value));

/**
 * Crea un objeto capa con grilla, opacidad, modo de fusión y estado de bloqueo.
 * @param {string} name
 * @param {number|null} [size=null]
 * @param {number[][]|null} [grid=null]
 * @param {number} [opacity=1]
 * @param {boolean} [locked=false]
 * @param {string} [blendMode="source-over"]
 */
export function createLayer(name, size = null, grid = null, opacity = 1, locked = false, blendMode = "source-over") {
  const { w, h } = size ? { w: size, h: size } : getGridDims();
  return {
    id: `layer_${Date.now()}_${layerCounter++}`,
    name: name || i18n.t("default.layer_name", { n: state.layers.length + 1 }),
    visible: true,
    locked,
    opacity,
    blendMode: VALID_BLEND_MODES.has(blendMode) ? blendMode : "source-over",
    grid: grid ? cloneGrid(grid) : createEmptyGrid(w, h),
    outOfBounds: [],
  };
}

/** Indica si la capa indicada está bloqueada (propia o por su carpeta padre). */
export function isLayerLocked(layer, layersList = state.layers) {
  if (!layer) return false;
  if (layer.locked) return true;
  if (layer.folderId && Array.isArray(layersList)) {
    const parent = layersList.find((l) => l?.type === "folder" && l.id === layer.folderId);
    if (parent?.locked) return true;
  }
  return false;
}

/** Indica si la capa activa está bloqueada contra edición (o es una carpeta). */
export function isActiveLayerLocked() {
  const active = state.layers?.[state.activeLayerIndex];
  if (!active) return false;
  return active.type === "folder" || isLayerLocked(active, state.layers);
}

/** Bloquea o desbloquea la capa indicada. */
export function toggleLayerLock(index = state.activeLayerIndex) {
  const layer = state.layers[index];
  if (!layer) return;
  pushState();
  const nextLocked = !layer.locked;
  layer.locked = nextLocked;
  for (const frame of state.frames || []) {
    if (frame.layers?.[index]) frame.layers[index].locked = nextLocked;
  }
  notify("layers:render");
  setStatus({ key: nextLocked ? "log.layer_locked_ok" : "log.layer_unlocked_named", params: { name: layer.name } });
}

/** Mantiene state.grid sincronizado con la grilla de la capa activa. */
export function syncActiveLayerGrid() {
  if (!state.layers || state.layers.length === 0) {
    state.layers = [createLayer("Base", null)];
    state.activeLayerIndex = 0;
  }
  if (state.activeLayerIndex < 0 || state.activeLayerIndex >= state.layers.length) {
    state.activeLayerIndex = 0;
  }
  state.grid = state.layers[state.activeLayerIndex].grid;
  if (selectedLayerIndices.size === 0) {
    selectedLayerIndices = new Set([state.activeLayerIndex]);
  }
  notify("layers:syncOpacity");
  notify("tilemap:syncActiveLayer");
}

/** Reemplaza la pila de capas por una única capa base con la grilla dada. */
export function resetLayersWithGrid(grid, name = "Base") {
  state.layers = [createLayer(name, null, grid)];
  state.activeLayerIndex = 0;
  selectedLayerIndices = new Set([0]);
  state.frameTags = [];
  state.activeTagId = null;
  state.tilesets = [];
  state.activeTilesetId = null;
  state.activeTileIndex = 1;
  syncActiveLayerGrid();
  notify("layers:render");
  notify("tilemap:render");
}

/** Cambia el modo de fusión (globalCompositeOperation) de la capa activa y redibuja. */
export function setActiveLayerBlendMode(mode) {
  const layer = state.layers[state.activeLayerIndex];
  if (!layer) return;
  const resolved = VALID_BLEND_MODES.has(mode) ? mode : "source-over";
  if ((layer.blendMode || "source-over") === resolved) return;
  pushState();
  layer.blendMode = resolved;
  notify("layers:render");
  renderAll();
  const label = LAYER_BLEND_MODES.find((m) => m.value === resolved)?.label || resolved;
  setStatus({ key: "log.layer_blend", params: { name: layer.name, mode: label } });
}

/** Ajusta la opacidad (0..100%) de la capa activa y redibuja. */
export function setActiveLayerOpacity(percent) {
  const layer = state.layers[state.activeLayerIndex];
  if (!layer) return;
  layer.opacity = Math.max(0, Math.min(1, Number(percent) / 100));
  const label = document.getElementById("layerOpacityValue");
  if (label) label.textContent = `${Math.round(layer.opacity * 100)}%`;
  renderAll();
}

/** Selecciona una capa (o alterna multiselección con Ctrl+Clic). */
export function selectLayer(index, { toggleMulti = false } = {}) {
  if (index < 0 || index >= state.layers.length) return;
  if (toggleMulti) {
    if (selectedLayerIndices.has(index) && selectedLayerIndices.size > 1) selectedLayerIndices.delete(index);
    else selectedLayerIndices.add(index);
  } else {
    selectedLayerIndices = new Set([index]);
  }
  state.activeLayerIndex = index;
  syncActiveLayerGrid();
  notify("layers:render");
  setStatus(
    selectedLayerIndices.size > 1
      ? { key: "log.layer_multi_selected", params: { count: selectedLayerIndices.size, name: state.layers[index].name } }
      : { key: "log.layer_active", params: { name: state.layers[index].name } },
  );
}

/** Alterna la visibilidad de la capa indicada. */
export function toggleLayerVisibility(index) {
  const layer = state.layers[index];
  if (!layer) return;
  pushState();
  const nextVis = !layer.visible;
  layer.visible = nextVis;
  for (const frame of state.frames || []) {
    if (frame.layers?.[index]) frame.layers[index].visible = nextVis;
  }
  notify("layers:render");
  renderAll();
}
