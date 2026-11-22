/**
 * frameOperations.js: Operaciones CRUD de fotogramas, sincronización de capas y portapapeles de frames.
 */

import {
  subscribe,
  state,
  pushState,
  createEmptyGrid,
  cloneLayers,
  getGridDims,
  notify,
  syncLinkedCelsForActiveLayer,
} from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { syncActiveLayerGrid, renderLayersUI } from "./layers.js";
import { setStatus } from "../ui/index.js";

let frameCounter = 1;
let frameClipboard = null;

/**
 * Indica si existe un frame copiado en el portapapeles interno de frames.
 * @returns {boolean}
 */
export function hasFrameClipboard() {
  return Boolean(frameClipboard);
}

/**
 * Crea un nuevo objeto frame con sus capas y duración en milisegundos.
 * @param {Array<Object>} [layers=null]
 * @param {number} [durationMs=150]
 */
export function createFrame(layers = null, durationMs = 150) {
  const { w, h } = getGridDims();
  return {
    id: `frame_${Date.now()}_${frameCounter++}`,
    durationMs,
    layers: layers
      ? cloneLayers(layers)
      : [
          {
            id: `layer_${Date.now()}_${frameCounter}`,
            name: "Base",
            visible: true,
            grid: createEmptyGrid(w, h),
          },
        ],
    activeLayerIndex: 0,
  };
}

function adjustFrameTagsOnInsert(insertIdx) {
  if (!Array.isArray(state.frameTags)) return;
  const maxIdx = Math.max(0, state.frames.length - 1);
  for (const tag of state.frameTags) {
    if (tag.from >= insertIdx) tag.from = Math.min(maxIdx, tag.from + 1);
    if (tag.to >= insertIdx) tag.to = Math.min(maxIdx, tag.to + 1);
  }
}

function adjustFrameTagsOnDelete(deletedIdx) {
  if (!Array.isArray(state.frameTags)) return;
  const maxIdx = Math.max(0, state.frames.length - 1);
  for (const tag of state.frameTags) {
    if (tag.from > deletedIdx) tag.from--;
    if (tag.to >= deletedIdx && tag.to > tag.from) tag.to--;
    tag.from = Math.max(0, Math.min(maxIdx, tag.from));
    tag.to = Math.max(tag.from, Math.min(maxIdx, tag.to));
  }
}

/**
 * Sincroniza las capas e índice activo actuales dentro del frame activo.
 */
export function syncActiveFrame() {
  if (!state.frames || state.frames.length === 0) {
    state.frames = [createFrame(state.layers)];
    state.activeFrameIndex = 0;
  }
  const cur = state.frames[state.activeFrameIndex];
  if (cur) {
    cur.layers = state.layers;
    cur.activeLayerIndex = state.activeLayerIndex;
    syncLinkedCelsForActiveLayer();
  }
}

/**
 * Reinicia la línea de tiempo con un único frame basado en las capas actuales.
 */
export function resetFramesWithCurrentLayers() {
  notify("frames:stop");
  state.frames = [
    {
      id: `frame_${Date.now()}_${frameCounter++}`,
      durationMs: 150,
      layers: state.layers,
      activeLayerIndex: state.activeLayerIndex,
    },
  ];
  state.activeFrameIndex = 0;
  notify("frames:render");
}

/**
 * Cambia al frame indicado por índice y actualiza lienzo y capas.
 * @param {number} index
 */
export function selectFrame(index) {
  if (index < 0 || index >= state.frames.length) return;
  syncActiveFrame();
  const prevLayerIdx = state.activeLayerIndex || 0;
  state.activeFrameIndex = index;
  const target = state.frames[index];
  state.layers = target.layers;
  state.activeLayerIndex = Math.min(
    Math.max(0, prevLayerIdx),
    state.layers.length - 1,
  );
  syncActiveLayerGrid();
  renderLayersUI();
  notify("frames:render");
  renderAll();
}

/**
 * Agrega un frame vacío o duplicado del frame activo manteniendo la estructura de capas.
 * @param {Object} [options]
 */
export function addFrame({ duplicate = false } = {}) {
  notify("frames:stop");
  pushState();
  syncActiveFrame();
  const prevLayerIdx = state.activeLayerIndex || 0;
  const { w, h } = getGridDims();
  const emptyLayerStructure = (state.layers || []).map((l) => {
    const base = {
      id: l.id,
      name: l.name,
      visible: l.visible,
      locked: Boolean(l.locked),
      opacity: l.opacity ?? 1,
      blendMode: l.blendMode || "source-over",
      type: l.type || "pixel",
      grid: createEmptyGrid(w, h),
      outOfBounds: [],
    };
    if (l.type === "tilemap") {
      const tw = l.tileWidth || 16;
      const th = l.tileHeight || 16;
      const cols = Math.max(1, Math.ceil(w / tw));
      const rows = Math.max(1, Math.ceil(h / th));
      base.tilesetId = l.tilesetId || null;
      base.tileWidth = tw;
      base.tileHeight = th;
      base.tileGrid = Array.from({ length: rows }, () => Array(cols).fill(0));
    }
    return base;
  });
  const newFrame = duplicate
    ? createFrame(state.layers, state.frames[state.activeFrameIndex]?.durationMs || 150)
    : createFrame(emptyLayerStructure.length ? emptyLayerStructure : null, 150);

  const insertAt = state.activeFrameIndex + 1;
  state.frames.splice(insertAt, 0, newFrame);
  adjustFrameTagsOnInsert(insertAt);
  state.activeFrameIndex = insertAt;
  state.layers = newFrame.layers;
  state.activeLayerIndex = Math.min(Math.max(0, prevLayerIdx), state.layers.length - 1);
  syncActiveLayerGrid();
  renderLayersUI();
  notify("frames:render");
  renderAll();
  setStatus({ key: duplicate ? "frames.duplicated" : "frames.created", params: { num: insertAt + 1 } });
}

/**
 * Elimina el frame activo manteniendo al menos un frame en el proyecto.
 */
export function deleteActiveFrame() {
  if (state.frames.length <= 1) {
    setStatus({ key: "log.frame_min_one" }, true);
    return;
  }
  notify("frames:stop");
  pushState();
  const removedIdx = state.activeFrameIndex;
  state.frames.splice(removedIdx, 1);
  adjustFrameTagsOnDelete(removedIdx);
  state.activeFrameIndex = Math.max(0, state.activeFrameIndex - 1);
  const target = state.frames[state.activeFrameIndex];
  state.layers = target.layers;
  state.activeLayerIndex = Math.min(
    Math.max(0, target.activeLayerIndex || 0),
    state.layers.length - 1,
  );
  syncActiveLayerGrid();
  renderLayersUI();
  notify("frames:render");
  renderAll();
  setStatus({ key: "frames.deleted", params: { count: state.frames.length } });
}

/**
 * Reordena el frame activo hacia la izquierda (-1) o derecha (+1).
 * @param {number} delta
 */
export function moveActiveFrame(delta) {
  const from = state.activeFrameIndex;
  const to = from + delta;
  if (to < 0 || to >= state.frames.length) return;
  notify("frames:stop");
  pushState();
  const [moved] = state.frames.splice(from, 1);
  state.frames.splice(to, 0, moved);
  state.activeFrameIndex = to;
  notify("frames:render");
  renderAll();
  setStatus({ key: "frames.moved", params: { num: to + 1 } });
}

/**
 * Copia las capas y duración del frame activo al portapapeles de frames.
 */
export function copyActiveFrameToClipboard() {
  syncActiveFrame();
  const frame = state.frames[state.activeFrameIndex];
  if (!frame) return;
  frameClipboard = {
    layers: cloneLayers(frame.layers),
    activeLayerIndex: frame.activeLayerIndex || 0,
    durationMs: frame.durationMs || 150,
  };
  setStatus({ key: "frames.copied", params: { num: state.activeFrameIndex + 1 } });
}

/**
 * Pega el frame copiado inmediatamente después del frame activo.
 */
export function pasteClipboardAsFrame() {
  if (!frameClipboard) return false;
  notify("frames:stop");
  syncActiveFrame();
  pushState();
  const newFrame = createFrame(cloneLayers(frameClipboard.layers), frameClipboard.durationMs);
  newFrame.activeLayerIndex = Math.min(
    Math.max(0, frameClipboard.activeLayerIndex || 0),
    newFrame.layers.length - 1,
  );
  const insertAt = state.activeFrameIndex + 1;
  state.frames.splice(insertAt, 0, newFrame);
  adjustFrameTagsOnInsert(insertAt);
  state.activeFrameIndex = insertAt;
  state.layers = newFrame.layers;
  state.activeLayerIndex = newFrame.activeLayerIndex;
  syncActiveLayerGrid();
  renderLayersUI();
  notify("frames:render");
  renderAll();
  setStatus({ key: "frames.pasted", params: { num: insertAt + 1 } });
  return true;
}

subscribe("frames:syncActive", () => syncActiveFrame());
