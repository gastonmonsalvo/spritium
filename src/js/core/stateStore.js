/**
 * stateStore.js: Store reactivo centralizado, utilidades de clonado, dimensiones de grilla y pub-sub (`subscribe`, `notify`).
 */

export const CANVAS_PX = 512;
export const MAX_GRID_DIM = 1024;

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
  fillPolygons: true,
  noiseBrushMode: "monochrome", // "monochrome" | "rgb" | "grayscale"
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
  maxHistory: 200,
  currentHistoryActionId: 0,

  selection: null,
  floatingSelection: null, // { bgGrid, bgOutOfBounds, patch, w, h, mask, curX, curY }
  lassoPreview: null, // Array de puntos {x, y} mientras se traza el lazo
  polygonPreview: null, // Vista previa de vértices/cierre para Polígono y Contorno
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
 * Actualiza el tamaño de grilla activo (cuadrado o rectangular N×M) en el store.
 * @param {number} newWidth
 * @param {number} [newHeight=newWidth]
 */
export function setGridSize(newWidth, newHeight = newWidth) {
  const w = Math.max(4, Math.min(MAX_GRID_DIM, Math.round(Number(newWidth) || 64)));
  const h = Math.max(4, Math.min(MAX_GRID_DIM, Math.round(Number(newHeight) || w)));
  state.gridWidth = w;
  state.gridHeight = h;
  state.gridSize = Math.max(w, h);
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
