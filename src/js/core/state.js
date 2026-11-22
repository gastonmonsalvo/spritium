/**
 * state.js: Store reactivo centralizado con:
 * - Observer / Pub-Sub (`subscribe`, `notify`) para desacoplar estado y UI.
 * - Memento Híbrido empaquetado en buffers binarios `Uint16Array` (incremental por capa y completo).
 * - Paleta indexada por capa (`layers` + `outOfBounds`) y respaldo no destructivo `originalImport`.
 */

export const CANVAS_PX = 512;

/**
 * Crea una matriz bidimensional height×width inicializada en 0 (transparente).
 * @param {number} [width=64]
 * @param {number} [height=width]
 */
export function createEmptyGrid(width = 64, height = width) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  return Array.from({ length: h }, () => Array(w).fill(0));
}

/**
 * Clona profundamente una grilla bidimensional de índices de color.
 * @param {number[][]} grid
 */
export function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

/**
 * Clona un diccionario de paleta índice -> #rrggbb.
 * @param {Record<number, string|null>} paletteMap
 */
export function clonePaletteMap(paletteMap) {
  return { ...(paletteMap || {}) };
}

/**
 * Clona profundamente una colección de Tilesets (cada tile es null o `{ id, name, grid }`).
 * @param {Array<Object>} tilesets
 */
export function cloneTilesets(tilesets) {
  return (tilesets || []).map((ts) => ({
    id: ts.id,
    name: ts.name,
    tileWidth: ts.tileWidth || 16,
    tileHeight: ts.tileHeight || 16,
    tiles: (ts.tiles || []).map((t) =>
      t
        ? {
            id: t.id,
            name: t.name || "",
            grid: cloneGrid(t.grid),
          }
        : null,
    ),
  }));
}

/**
 * Clona profundamente la lista de Tags de animación (`frameTags`).
 * @param {Array<Object>} tags
 */
export function cloneFrameTags(tags) {
  return (tags || []).map((t) => ({
    id: t.id,
    name: t.name || "Tag",
    color: t.color || "#2563eb",
    from: Number(t.from) || 0,
    to: Number(t.to) || 0,
  }));
}

/**
 * Clona profundamente un arreglo de capas incluyendo opacidad, bloqueo, modo de fusión, linked cels, tilemap y outOfBounds.
 * @param {Array<Object>} layers
 */
export function cloneLayers(layers) {
  return (layers || []).map((layer) => {
    const cloned = {
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: Boolean(layer.locked),
      opacity: layer.opacity ?? 1,
      blendMode: layer.blendMode || "source-over",
      type: layer.type || "pixel",
      tilesetId: layer.tilesetId || null,
      tileWidth: layer.tileWidth || 16,
      tileHeight: layer.tileHeight || 16,
      tileGrid: layer.tileGrid ? cloneGrid(layer.tileGrid) : null,
      grid: layer.grid ? cloneGrid(layer.grid) : null,
      outOfBounds: layer.outOfBounds ? layer.outOfBounds.map((p) => [...p]) : [],
    };
    if (layer.folderId) cloned.folderId = layer.folderId;
    if (layer.collapsed) cloned.collapsed = true;
    if (layer.celGroupId) cloned.celGroupId = layer.celGroupId;
    return cloned;
  });
}

const initialGrid = createEmptyGrid(64);
const initialLayers = [
  {
    id: "layer_base",
    name: "Base",
    visible: true,
    grid: initialGrid,
  },
];

export const state = {
  gridSize: 64,
  gridWidth: 64,
  gridHeight: 64,
  layers: initialLayers,
  activeLayerIndex: 0,
  grid: initialGrid, // Siempre apunta a layers[activeLayerIndex].grid

  frames: [
    {
      id: "frame_1",
      durationMs: 150,
      layers: initialLayers,
      activeLayerIndex: 0,
    },
  ],
  activeFrameIndex: 0,
  frameTags: [], // Array<{ id, name, color, from, to }>
  activeTagId: null,
  onionSkin: false,
  onionSkinConfig: {
    prevCount: 1,
    nextCount: 0,
    opacity: 0.3,
    mode: "normal", // "normal" | "redblue"
  },
  isPlaying: false,

  currentTool: "pencil",
  brushSize: 1,
  activeBrushPattern: "solid", // "solid" | "checker" | "diag" | "dots"
  activeCustomBrushId: null,
  customBrushMode: "color", // "color" | "tint"
  customBrushes: [],
  lineMode: "straight", // "straight" | "curve"
  lineStyle: "solid", // "solid" | "dotted" | "dashed" | "dashdot"
  curveControlPoints: 1, // 1 | 2 | 3 puntos de curvatura
  currentColorIndex: 1,
  secondaryColorIndex: 0,
  currentThemeKey: "db32",
  themesCatalog: {},
  paletteMap: {},

  originalImport: null,
  sourceImageFile: null, // File original en memoria para reescalar limpio entre resoluciones
  resBaseSnapshot: null, // Respaldo de mayor resolución antes de bajar (para 64 -> 32 -> 64)
  rotSpriteSession: null, // Snapshot base para rotación acumulativa no destructiva
  isDirtySinceImport: false,
  customColorIndices: [],
  ditherEnabled: false,
  quantizeOnUpload: false,

  undoStack: [],
  redoStack: [],
  maxHistory: 100,
  currentHistoryActionId: 0,

  selection: null,
  floatingSelection: null, // { bgGrid, bgOutOfBounds, patch, w, h, mask, curX, curY }
  lassoPreview: null, // Array de puntos {x, y} mientras se traza el lazo
  isSelecting: false,
  selectStart: null,
  clipboard: null,
  freeTransform: null,
  cursorPos: null,
  snapGuides: null, // { x?: number, y?: number } líneas guía al hacer snap con Ctrl
  zoom: 1,
  showGrid: true,
  showCenterGuides: true,
  showCenterRulerMarks: true,
  showRulers: true,
  showGridCoords: false,
  gridCoordsConfig: {
    color: "#38bdf8",
    opacity: 0.14,
    showGuides: true,
    showBadge: true,
  },
  showPixelCursor: false,
  pixelCursorConfig: {
    opacity: 0.75,
    lineWidth: 1,
    useActiveColor: true,
    fillUseActiveColor: true,
    activeColorAlpha: 0.75,
    color: "#38bdf8ee",
    eraserColor: "#f87171ee",
    fillPreviewColor: "#38bdf838",
    magicPreviewColor: "#f472b644",
    bgEraserPreviewColor: "#fb718544",
    fillPreview: true,
    showCenterDot: true,
  },
  reticleConfig: {
    shape: "crosshair", // "crosshair" | "circle" | "square" | "dot"
    color: "#ffffffff",
    size: 6,
    thickness: 1.5,
    gap: 2,
    dot: true,
    outline: true,
  },
  mirrorH: false,
  mirrorV: false,
  mirrorDiagMain: false, // "\" diagonal reflection (y = x)
  mirrorDiagAnti: false, // "/" diagonal reflection (y = -x)
  mirrorRadial: "none", // "none" | "rot90" | "oct45"
  symmetryCenterMode: "between", // "between" (Par / 2px) | "pixel" (Impar / 1px Corazón)
  symmetryAxisX: null, // null = auto center, or custom number in grid units (step 0.5)
  symmetryAxisY: null, // null = auto center, or custom number in grid units (step 0.5)
  isMovingSymmetryAxis: false,
  rulerGuides: [], // Array<{ id: number, axis: "h" | "v", pos: number }>
  activeGuideDrag: null, // { axis: "h" | "v", pos: number, valid: boolean } | null
  tiledMode: "none",

  tilesets: [], // Array<{ id, name, tileWidth, tileHeight, tiles }>
  activeTilesetId: null,
  activeTileIndex: 1,
  tilemapMode: "tiles", // "tiles" | "edit-tile" | "auto"
  tileFlipH: false,
  tileFlipV: false,
  tileRot: 0, // 0 = 0°, 1 = 90°, 2 = 180°, 3 = 270°
  showTilesetPanel: false,
  showTilemapGrid: true,
  tilesetThumbSize: 40,
};

// --- OBSERVER / PUB-SUB ---
const listeners = new Map();

/**
 * Suscribe un callback a un tópico de estado ("grid", "layers", "palette", "history", "tool").
 * @param {string} topic
 * @param {Function} callback
 * @returns {Function} Función para desuscribirse.
 */
export function subscribe(topic, callback) {
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic).add(callback);
  return () => listeners.get(topic)?.delete(callback);
}

/**
 * Notifica a todos los suscriptores de un tópico.
 * @param {string} topic
 * @param {*} [payload]
 */
export function notify(topic, payload) {
  const subs = listeners.get(topic);
  if (!subs) return;
  for (const fn of subs) {
    fn(payload);
  }
}

/**
 * Devuelve las dimensiones reales {w, h} del lienzo activo.
 * @returns {{w: number, h: number}}
 */
export function getGridDims() {
  const w = state.gridWidth || state.gridSize || 64;
  const h = state.gridHeight || state.gridSize || 64;
  return { w, h };
}

/**
 * Indica si hay al menos un modo de simetría activo (H, V o Radial 90°/45°).
 * @returns {boolean}
 */
export function isSymmetryActive() {
  return Boolean(
    state.mirrorH ||
      state.mirrorV ||
      state.mirrorDiagMain ||
      state.mirrorDiagAnti ||
      state.mirrorRadial === "rot90" ||
      state.mirrorRadial === "oct45",
  );
}

/**
 * Calcula la posición efectiva del eje/centro de simetría `(axisX, axisY)` en unidades de grilla.
 * - Cuando `axis` es entero (ej. `32.0`), el eje cae ENTRE dos píxeles (modo Par / 2px).
 * - Cuando `axis` termina en `.5` (ej. `31.5`), el eje pasa por el CENTRO del píxel `31` (modo Impar / 1px Corazón).
 * @param {number} [w]
 * @param {number} [h]
 * @returns {{ axisX: number, axisY: number, isPixelCenterX: boolean, isPixelCenterY: boolean }}
 */
export function getSymmetryPivot(w, h) {
  const dims = w && h ? { w, h } : getGridDims();
  const isPixelMode = state.symmetryCenterMode === "pixel";
  const defaultX = isPixelMode ? Math.floor((dims.w - 1) / 2) + 0.5 : Math.floor(dims.w / 2);
  const defaultY = isPixelMode ? Math.floor((dims.h - 1) / 2) + 0.5 : Math.floor(dims.h / 2);

  const clampAxis = (val, maxDim, fallback) => {
    if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
    const snapped = Math.round(val * 2) / 2;
    return Math.max(0.5, Math.min(maxDim - 0.5, snapped));
  };

  const axisX = clampAxis(state.symmetryAxisX, dims.w, defaultX);
  const axisY = clampAxis(state.symmetryAxisY, dims.h, defaultY);
  const isPixelCenterX = Math.abs((axisX % 1) - 0.5) < 0.01;
  const isPixelCenterY = Math.abs((axisY % 1) - 0.5) < 0.01;

  return { axisX, axisY, isPixelCenterX, isPixelCenterY };
}

/**
 * Genera todas las coordenadas `[px, py]` simétricas para un punto `(x, y)` según los modos
 * activos (`mirrorH`, `mirrorV`, `mirrorRadial: "rot90" | "oct45"`) y el pivote `(axisX, axisY)`.
 * @param {number} x
 * @param {number} y
 * @param {number} [w]
 * @param {number} [h]
 * @returns {Array<[number, number]>} Lista deduplicada de coordenadas `[px, py]`.
 */
export function getSymmetryPoints(x, y, w, h) {
  const dims = w && h ? { w, h } : getGridDims();
  if (!isSymmetryActive()) return [[x, y]];

  const { axisX, axisY } = getSymmetryPivot(dims.w, dims.h);
  const dx = x + 0.5 - axisX;
  const dy = y + 0.5 - axisY;

  /** @type {Array<[number, number]>} */
  let vecs = [[dx, dy]];

  if (state.mirrorRadial === "oct45") {
    vecs = [
      [dx, dy],
      [-dx, dy],
      [dx, -dy],
      [-dx, -dy],
      [dy, dx],
      [-dy, dx],
      [dy, -dx],
      [-dy, -dx],
    ];
  } else {
    if (state.mirrorRadial === "rot90") {
      vecs = [
        [dx, dy],
        [-dy, dx],
        [-dx, -dy],
        [dy, -dx],
      ];
    }
    if (state.mirrorH) {
      const len = vecs.length;
      for (let i = 0; i < len; i++) {
        vecs.push([-vecs[i][0], vecs[i][1]]);
      }
    }
    if (state.mirrorV) {
      const len = vecs.length;
      for (let i = 0; i < len; i++) {
        vecs.push([vecs[i][0], -vecs[i][1]]);
      }
    }
    if (state.mirrorDiagMain) {
      const len = vecs.length;
      for (let i = 0; i < len; i++) {
        vecs.push([vecs[i][1], vecs[i][0]]);
      }
    }
    if (state.mirrorDiagAnti) {
      const len = vecs.length;
      for (let i = 0; i < len; i++) {
        vecs.push([-vecs[i][1], -vecs[i][0]]);
      }
    }
  }

  const seen = new Set();
  /** @type {Array<[number, number]>} */
  const out = [];
  for (const [tx, ty] of vecs) {
    const px = Math.round(axisX + tx - 0.5);
    const py = Math.round(axisY + ty - 0.5);
    const key = `${px},${py}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push([px, py]);
    }
  }
  return out;
}

/**
 * Actualiza el tamaño de grilla activo (cuadrado o rectangular N×M) en el store.
 * @param {number} newWidth
 * @param {number} [newHeight=newWidth]
 */
export function setGridSize(newWidth, newHeight = newWidth) {
  const w = Math.max(4, Math.min(512, Math.round(Number(newWidth) || 64)));
  const h = Math.max(4, Math.min(512, Math.round(Number(newHeight) || w)));
  state.gridWidth = w;
  state.gridHeight = h;
  state.gridSize = Math.max(w, h);
}

// --- MEMENTO HÍBRIDO (COMPLETO E INCREMENTAL POR CAPA) ---
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

let selectedFrameRange = null;

/**
 * Devuelve el rango de fotogramas seleccionado en el timeline (`{from, to}` o `null`).
 * @returns {{from: number, to: number}|null}
 */
export function getSelectedFrameRange() {
  return selectedFrameRange;
}

/**
 * Actualiza el rango de fotogramas seleccionado en el timeline.
 * @param {{from: number, to: number}|null} range
 */
export function setSelectedFrameRange(range) {
  selectedFrameRange = range;
}

/**
 * Sincroniza la grilla de la capa activa hacia todas las celdas enlazadas con el mismo `celGroupId`.
 */
export function syncLinkedCelsForActiveLayer() {
  const activeLayer = state.layers?.[state.activeLayerIndex];
  const groupId = activeLayer?.celGroupId;
  if (!groupId || !Array.isArray(state.frames)) return;
  for (let fi = 0; fi < state.frames.length; fi++) {
    if (fi === state.activeFrameIndex) continue;
    const frame = state.frames[fi];
    for (const l of frame?.layers || []) {
      if (l?.celGroupId === groupId) {
        l.grid = cloneGrid(state.grid);
        l.outOfBounds = Array.isArray(activeLayer.outOfBounds)
          ? activeLayer.outOfBounds.map((p) => [...p])
          : [];
      }
    }
  }
}
