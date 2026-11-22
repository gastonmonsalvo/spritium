/**
 * history.js: Memento Híbrido empaquetado en buffers binarios `Uint16Array` (incremental por capa y completo),
 * con Undo, Redo y salto directo por `actionId`.
 */

import {
  state,
  notify,
  getGridDims,
  setGridSize,
  cloneGrid,
  clonePaletteMap,
  cloneTilesets,
  cloneFrameTags,
  cloneLayers,
} from "./stateStore.js";

function cloneFrames(frames) {
  return (frames || []).map((f) => {
    const copy = {
      id: f.id,
      durationMs: f.durationMs || 150,
      layers: cloneLayers(f.layers),
      activeLayerIndex: f.activeLayerIndex || 0,
    };
    if (f.name) copy.name = f.name;
    if (f.color) copy.color = f.color;
    if (f.colWidth) copy.colWidth = f.colWidth;
    return copy;
  });
}

function captureFullSnapshot() {
  if (state.frames?.[state.activeFrameIndex]) {
    state.frames[state.activeFrameIndex].layers = state.layers;
    state.frames[state.activeFrameIndex].activeLayerIndex = state.activeLayerIndex;
  }
  return {
    kind: "full",
    size: state.gridSize,
    width: state.gridWidth || state.gridSize,
    height: state.gridHeight || state.gridSize,
    frames: cloneFrames(state.frames),
    activeFrameIndex: state.activeFrameIndex,
    frameTags: cloneFrameTags(state.frameTags),
    activeTagId: state.activeTagId || null,
    tilesets: cloneTilesets(state.tilesets),
    activeTilesetId: state.activeTilesetId,
    paletteMap: clonePaletteMap(state.paletteMap),
    themeKey: state.currentThemeKey,
    isDirtySinceImport: state.isDirtySinceImport,
    customColorIndices: [...state.customColorIndices],
    selection: state.selection ? { ...state.selection } : null,
  };
}

function packGridToUint16(grid, w, h) {
  const buf = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = grid[y];
    if (!row) continue;
    const offset = y * w;
    for (let x = 0; x < w; x++) {
      buf[offset + x] = row[x] || 0;
    }
  }
  return buf;
}

function unpackUint16ToGrid(buf, w, h) {
  const grid = new Array(h);
  for (let y = 0; y < h; y++) {
    const row = new Array(w);
    const offset = y * w;
    for (let x = 0; x < w; x++) {
      row[x] = buf[offset + x];
    }
    grid[y] = row;
  }
  return grid;
}

function captureLayerSnapshot(layerIndex = state.activeLayerIndex) {
  const idx = Math.max(0, Math.min(state.layers.length - 1, layerIndex));
  const layer = state.layers[idx];
  const { w, h } = getGridDims();
  const snap = {
    kind: "layer",
    layerIndex: idx,
    w,
    h,
    packedGrid: packGridToUint16(layer.grid, w, h),
    outOfBounds: Array.isArray(layer?.outOfBounds) ? layer.outOfBounds.map((p) => [...p]) : [],
    isDirtySinceImport: state.isDirtySinceImport,
    selection: state.selection ? { ...state.selection } : null,
  };
  if (layer?.type === "tilemap") {
    snap.isTilemap = true;
    snap.tileGrid = layer.tileGrid ? cloneGrid(layer.tileGrid) : null;
    snap.tilesets = cloneTilesets(state.tilesets);
  }
  return snap;
}

let nextHistoryActionId = 1;

function applySnapshot(snap, oppositeStack) {
  if (snap.kind === "layer" && state.layers[snap.layerIndex]) {
    const opp = captureLayerSnapshot(snap.layerIndex);
    opp.actionId = state.currentHistoryActionId;
    oppositeStack.push(opp);
    if (snap.w && snap.h && (snap.w !== state.gridWidth || snap.h !== state.gridHeight)) {
      setGridSize(snap.w, snap.h);
    }
    const targetLayer = state.layers[snap.layerIndex];
    targetLayer.grid = snap.packedGrid
      ? unpackUint16ToGrid(snap.packedGrid, snap.w, snap.h)
      : cloneGrid(snap.grid);
    targetLayer.outOfBounds = Array.isArray(snap.outOfBounds)
      ? snap.outOfBounds.map((p) => [...p])
      : [];
    if (snap.isTilemap && targetLayer.type === "tilemap") {
      if (snap.tileGrid) targetLayer.tileGrid = cloneGrid(snap.tileGrid);
      if (snap.tilesets) state.tilesets = cloneTilesets(snap.tilesets);
    }
    state.activeLayerIndex = snap.layerIndex;
    state.grid = targetLayer.grid;
    state.isDirtySinceImport = Boolean(snap.isDirtySinceImport);
    state.selection = snap.selection ? { ...snap.selection } : null;
    state.floatingSelection = null;
    state.currentHistoryActionId = snap.actionId ?? 0;
    return;
  }

  const opp = captureFullSnapshot();
  opp.actionId = state.currentHistoryActionId;
  oppositeStack.push(opp);
  setGridSize(snap.width || snap.size, snap.height || snap.size);
  if (snap.tilesets) state.tilesets = cloneTilesets(snap.tilesets);
  if (snap.activeTilesetId !== undefined) state.activeTilesetId = snap.activeTilesetId;
  if (snap.frameTags) state.frameTags = cloneFrameTags(snap.frameTags);
  if (snap.activeTagId !== undefined) state.activeTagId = snap.activeTagId;
  if (snap.frames && snap.frames.length > 0) {
    state.frames = cloneFrames(snap.frames);
    state.activeFrameIndex = Math.min(
      Math.max(0, snap.activeFrameIndex || 0),
      state.frames.length - 1,
    );
    const activeFrame = state.frames[state.activeFrameIndex];
    state.layers = activeFrame.layers;
    state.activeLayerIndex = Math.min(
      Math.max(0, activeFrame.activeLayerIndex || 0),
      state.layers.length - 1,
    );
    state.grid = state.layers[state.activeLayerIndex].grid;
  }
  if (snap.paletteMap) state.paletteMap = snap.paletteMap;
  if (snap.themeKey) state.currentThemeKey = snap.themeKey;
  state.isDirtySinceImport = Boolean(snap.isDirtySinceImport);
  if (snap.customColorIndices) state.customColorIndices = snap.customColorIndices;
  state.selection = snap.selection ? { ...snap.selection } : null;
  state.floatingSelection = null;
  state.resBaseSnapshot = null;
  state.currentHistoryActionId = snap.actionId ?? 0;
}

/**
 * Guarda un Memento completo (usar en cambios estructurales: capas, resolución, tema).
 */
export function pushState() {
  state.resBaseSnapshot = null;
  state.rotSpriteSession = null;
  const snap = captureFullSnapshot();
  const actionId = nextHistoryActionId++;
  snap.actionId = state.currentHistoryActionId;
  state.currentHistoryActionId = actionId;
  state.undoStack.push(snap);
  if (state.undoStack.length > state.maxHistory) {
    state.undoStack.shift();
  }
  state.redoStack = [];
  notify("dirty");
}

/**
 * Guarda un Memento incremental de la capa activa (O(N²) de 1 sola capa).
 * @param {boolean} [keepRotSession=false]
 */
export function pushLayerState(keepRotSession = false) {
  state.resBaseSnapshot = null;
  if (!keepRotSession) state.rotSpriteSession = null;
  const snap = captureLayerSnapshot(state.activeLayerIndex);
  const actionId = nextHistoryActionId++;
  snap.actionId = state.currentHistoryActionId;
  state.currentHistoryActionId = actionId;
  state.undoStack.push(snap);
  if (state.undoStack.length > state.maxHistory) {
    state.undoStack.shift();
  }
  state.redoStack = [];
  notify("dirty");
}

/**
 * Revierte al estado anterior del historial Memento y notifica a los suscriptores.
 */
export function undo() {
  if (state.undoStack.length === 0) return false;
  applySnapshot(state.undoStack.pop(), state.redoStack);
  notify("history");
  return true;
}

/**
 * Reaplica el estado siguiente del historial de rehacer y notifica a los suscriptores.
 */
export function redo() {
  if (state.redoStack.length === 0) return false;
  applySnapshot(state.redoStack.pop(), state.undoStack);
  notify("history");
  return true;
}

/**
 * Viaja directamente en la pila de historial hasta el estado posterior a `targetActionId`.
 * @param {number} targetActionId
 */
export function jumpToHistoryAction(targetActionId) {
  if (typeof targetActionId !== "number") return false;
  if (state.currentHistoryActionId === targetActionId) return false;

  const inUndo = state.undoStack.some((s) => s.actionId === targetActionId);
  if (inUndo) {
    while (
      state.undoStack.length > 0 &&
      state.currentHistoryActionId !== targetActionId
    ) {
      applySnapshot(state.undoStack.pop(), state.redoStack);
    }
    notify("history");
    return true;
  }

  const inRedo = state.redoStack.some((s) => s.actionId === targetActionId);
  if (inRedo) {
    while (
      state.redoStack.length > 0 &&
      state.currentHistoryActionId !== targetActionId
    ) {
      applySnapshot(state.redoStack.pop(), state.undoStack);
    }
    notify("history");
    return true;
  }

  return false;
}
