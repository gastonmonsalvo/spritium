/**
 * tilemapSync.js: Creación, conversión y reconciliación de capas Tilemap <-> Tileset.
 */

import {
  state,
  pushState,
  createEmptyGrid,
  cloneGrid,
  getGridDims,
  notify,
} from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { renderLayersUI, syncActiveLayerGrid } from "./layers.js";
import { setStatus } from "../ui/index.js";
import {
  packTileEntry,
  unpackTileEntry,
  getTransformedTilePixels,
  getInverseTransformedTilePixels,
  getTilesetById,
  getActiveTilemapLayer,
  getTileGridDims,
  createEmptyTileGrid,
  ensureLayerTileGridDimensions,
  createTileset,
  syncTilemapLayerToGrid,
} from "../state/TilemapModel.js";

let tilesetSeq = 1;

function buildTilemapLayerObject(name, tileset, cols, rows, gridW, gridH) {
  return {
    id: `layer_${Date.now()}_${tilesetSeq++}`,
    name: name || `Tilemap ${state.layers.length + 1}`,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: "source-over",
    type: "tilemap",
    tilesetId: tileset.id,
    tileWidth: tileset.tileWidth,
    tileHeight: tileset.tileHeight,
    tileGrid: createEmptyTileGrid(cols, rows),
    grid: createEmptyGrid(gridW, gridH),
    outOfBounds: [],
  };
}

/**
 * Agrega una nueva capa Tilemap sincronizada en todos los frames del documento.
 */
export function addNewTilemapLayer({
  name = null,
  tileWidth = 16,
  tileHeight = 16,
  tilesetId = null,
} = {}) {
  pushState();
  const { w, h } = getGridDims();
  const tw = Math.max(2, Math.min(512, Math.round(Number(tileWidth) || 16)));
  const th = Math.max(2, Math.min(512, Math.round(Number(tileHeight) || 16)));

  let tileset = tilesetId ? getTilesetById(tilesetId) : null;
  if (!tileset || tileset.tileWidth !== tw || tileset.tileHeight !== th) {
    tileset = createTileset(`Tileset ${tw}×${th}`, tw, th);
  } else {
    state.activeTilesetId = tileset.id;
  }

  const cols = Math.max(1, Math.ceil(w / tw));
  const rows = Math.max(1, Math.ceil(h / th));
  const insertAt = state.activeLayerIndex + 1;
  const layerName = name || `Tilemap ${state.layers.length + 1}`;

  if (Array.isArray(state.frames) && state.frames.length > 0) {
    state.frames.forEach((frame, fIdx) => {
      if (!Array.isArray(frame.layers)) frame.layers = [];
      const layerObj = buildTilemapLayerObject(layerName, tileset, cols, rows, w, h);
      frame.layers.splice(insertAt, 0, layerObj);
      if (fIdx === state.activeFrameIndex) state.layers = frame.layers;
    });
  } else {
    state.layers.splice(insertAt, 0, buildTilemapLayerObject(layerName, tileset, cols, rows, w, h));
  }

  const hasAnyTilePixels = tileset.tiles.some((t, idx) => idx > 0 && t?.grid && !isGridAllZero(t.grid));
  state.activeLayerIndex = insertAt;
  state.activeTileIndex = tileset.tiles.length > 1 ? 1 : 0;
  state.tilemapMode = hasAnyTilePixels ? "tiles" : "auto";
  state.isDirtySinceImport = true;
  syncActiveLayerGrid();
  notify("tilemap:showPanel", { visible: true, silent: true, auto: true });
  renderLayersUI();
  notify("tilemap:render");
  renderAll();
  setStatus({ key: "log.tm_created", params: { name: layerName, w: tw, h: th } });
}

// --- SINCRONIZACIÓN Y RECONCILIACIÓN (MODO TILES / EDIT-TILE / AUTO) ---

function serializeGridKey(grid) {
  return grid.map((r) => r.join(",")).join(";");
}

function isGridAllZero(grid) {
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] && row[x] !== 0) return false;
    }
  }
  return true;
}

function gridsEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let y = 0; y < a.length; y++) {
    const ra = a[y];
    const rb = b[y];
    if (!ra || !rb || ra.length !== rb.length) return false;
    for (let x = 0; x < ra.length; x++) {
      if ((ra[x] || 0) !== (rb[x] || 0)) return false;
    }
  }
  return true;
}

function extractBlock(grid, startX, startY, tw, th) {
  const block = createEmptyGrid(tw, th);
  for (let py = 0; py < th; py++) {
    const row = grid[startY + py];
    if (!row) continue;
    for (let px = 0; px < tw; px++) {
      const val = row[startX + px];
      if (val !== undefined) block[py][px] = val;
    }
  }
  return block;
}

function buildTilesetKeyMap(tileset) {
  const keyMap = new Map();
  for (let i = 1; i < tileset.tiles.length; i++) {
    const t = tileset.tiles[i];
    if (t?.grid) keyMap.set(serializeGridKey(t.grid), i);
  }
  return keyMap;
}

function findOrCreateTileInTileset(tileset, block, { allowCreate = true, keyMap = null } = {}) {
  const map = keyMap || buildTilesetKeyMap(tileset);
  const key = serializeGridKey(block);
  if (map.has(key)) return map.get(key);
  if (!allowCreate) return 0;

  // Si el primer tile (#1) es un placeholder vacío sin usar, reutilizarlo antes de crear #2
  if (tileset.tiles.length === 2 && tileset.tiles[1]?.grid && isGridAllZero(tileset.tiles[1].grid)) {
    map.delete(serializeGridKey(tileset.tiles[1].grid));
    tileset.tiles[1].grid = cloneGrid(block);
    map.set(key, 1);
    return 1;
  }

  const newIdx = tileset.tiles.length;
  tileset.tiles.push({
    id: `tile_${Date.now()}_${newIdx}`,
    name: `Tile ${newIdx}`,
    grid: cloneGrid(block),
  });
  map.set(key, newIdx);
  return newIdx;
}

/**
 * Resincroniza la grilla de píxeles de todas las capas Tilemap en todos los frames.
 * @param {string|null} [tilesetId=null]
 */
export function syncAllTilemapLayers(tilesetId = null) {
  const visited = new Set();
  for (const frame of state.frames || []) {
    for (const l of frame.layers || []) {
      if (l?.type === "tilemap" && (!tilesetId || l.tilesetId === tilesetId)) {
        visited.add(l);
        syncTilemapLayerToGrid(l);
      }
    }
  }
  for (const l of state.layers || []) {
    if (!visited.has(l) && l?.type === "tilemap" && (!tilesetId || l.tilesetId === tilesetId)) {
      syncTilemapLayerToGrid(l);
    }
  }
  syncActiveLayerGrid();
}

/**
 * Reconcilia cambios realizados por herramientas de píxeles sobre una capa Tilemap
 * en modo `"edit-tile"` (actualiza tile fuente y propaga) o `"auto"` (crea/deduplica tiles).
 * @param {Object} layer
 * @param {"edit-tile"|"auto"|null} [modeOverride=null]
 */
export function reconcileLayerTilemap(layer, modeOverride = null) {
  if (!layer || layer.type !== "tilemap") return false;
  const tileset = getTilesetById(layer.tilesetId);
  if (!tileset) return false;

  const mode = modeOverride || state.tilemapMode || "auto";
  if (mode === "tiles") {
    syncTilemapLayerToGrid(layer);
    return false;
  }

  ensureLayerTileGridDimensions(layer);
  const { cols, rows, tileW, tileH } = getTileGridDims(layer);

  if (mode === "edit-tile") {
    let editedTileIndex = 0;
    let changed = false;

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const block = extractBlock(layer.grid, tx * tileW, ty * tileH, tileW, tileH);
        const entry = layer.tileGrid[ty]?.[tx] || 0;
        const { tileIndex, flipH, flipV, rot } = unpackTileEntry(entry);

        if (tileIndex > 0 && tileset.tiles[tileIndex]) {
          const expected = getTransformedTilePixels(
            tileset.tiles[tileIndex].grid,
            tileW,
            tileH,
            flipH,
            flipV,
            rot,
          );
          if (!gridsEqual(block, expected)) {
            tileset.tiles[tileIndex].grid = getInverseTransformedTilePixels(
              block,
              tileW,
              tileH,
              flipH,
              flipV,
              rot,
            );
            editedTileIndex = tileIndex;
            changed = true;
          }
        } else if (!isGridAllZero(block)) {
          const newIdx = findOrCreateTileInTileset(tileset, block, { allowCreate: true });
          layer.tileGrid[ty][tx] = packTileEntry(newIdx, false, false, 0);
          editedTileIndex = newIdx;
          changed = true;
        }
      }
    }

    if (changed) {
      syncAllTilemapLayers(tileset.id);
      if (editedTileIndex > 0) state.activeTileIndex = editedTileIndex;
      notify("tilemap:render");
      renderAll();
      if (editedTileIndex > 0) {
        setStatus({ key: "log.tm_tile_updated", params: { idx: editedTileIndex } });
      }
    }
    return changed;
  }

  // Modo "auto": deduplicar o crear tiles nuevos automáticamente por celda modificada
  let createdCount = 0;
  let updated = false;
  const keyMap = buildTilesetKeyMap(tileset);
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const block = extractBlock(layer.grid, tx * tileW, ty * tileH, tileW, tileH);
      if (isGridAllZero(block)) {
        if (layer.tileGrid[ty][tx] !== 0) {
          layer.tileGrid[ty][tx] = 0;
          updated = true;
        }
        continue;
      }

      const prevEntry = layer.tileGrid[ty]?.[tx] || 0;
      const { tileIndex: prevIdx, flipH: pFH, flipV: pFV, rot: pRot } = unpackTileEntry(prevEntry);
      if (prevIdx > 0 && tileset.tiles[prevIdx]) {
        const expected = getTransformedTilePixels(
          tileset.tiles[prevIdx].grid,
          tileW,
          tileH,
          pFH,
          pFV,
          pRot,
        );
        if (gridsEqual(block, expected)) continue;
      }

      const beforeLen = tileset.tiles.length;
      const matchedIdx = findOrCreateTileInTileset(tileset, block, { allowCreate: true, keyMap });
      if (tileset.tiles.length > beforeLen) createdCount++;
      const nextEntry = packTileEntry(matchedIdx, false, false, 0);
      if (layer.tileGrid[ty][tx] !== nextEntry) {
        layer.tileGrid[ty][tx] = nextEntry;
        state.activeTileIndex = matchedIdx;
        updated = true;
      }
    }
  }

  if (updated || createdCount > 0) {
    syncTilemapLayerToGrid(layer);
    notify("tilemap:render");
    renderAll();
    if (createdCount > 0) {
      setStatus({ key: "log.tm_auto_added", params: { count: createdCount } });
    }
  }
  return updated || createdCount > 0;
}

/**
 * Reconcilia la capa activa si es de tipo Tilemap.
 * @param {"edit-tile"|"auto"|null} [modeOverride=null]
 */
export function reconcileActiveTilemapLayer(modeOverride = null) {
  const layer = getActiveTilemapLayer();
  if (!layer) return false;
  return reconcileLayerTilemap(layer, modeOverride);
}

// --- CONVERSIÓN CAPA <-> TILEMAP ---

/**
 * Convierte una capa normal de píxeles en capa Tilemap deduplicando sus tiles en el Tileset.
 */
export function convertLayerToTilemap(
  layerIndex = state.activeLayerIndex,
  tileWidth = 16,
  tileHeight = 16,
  tilesetId = null,
) {
  const resolvedIndex =
    typeof layerIndex === "number" && Number.isFinite(layerIndex) ? layerIndex : state.activeLayerIndex;
  const targetLayer = state.layers?.[resolvedIndex];
  if (!targetLayer) return;
  if (targetLayer.type === "folder") {
    setStatus({ key: "log.tm_no_folder" }, true);
    return;
  }
  if (targetLayer.type === "tilemap") {
    setStatus({ key: "log.tm_already" }, true);
    return;
  }

  pushState();
  if (resolvedIndex === state.activeLayerIndex && state.grid) {
    targetLayer.grid = state.grid;
  }
  if (state.frames?.[state.activeFrameIndex]) {
    state.frames[state.activeFrameIndex].layers = state.layers;
  }
  const tw = Math.max(2, Math.min(512, Math.round(Number(tileWidth) || 16)));
  const th = Math.max(2, Math.min(512, Math.round(Number(tileHeight) || 16)));
  const { w, h } = getGridDims();
  const cols = Math.max(1, Math.ceil(w / tw));
  const rows = Math.max(1, Math.ceil(h / th));

  let tileset = tilesetId ? getTilesetById(tilesetId) : null;
  if (!tileset || tileset.tileWidth !== tw || tileset.tileHeight !== th) {
    tileset = {
      id: `ts_${Date.now()}_${tilesetSeq++}`,
      name: `${targetLayer.name} (${tw}×${th})`,
      tileWidth: tw,
      tileHeight: th,
      tiles: [null],
    };
    if (!Array.isArray(state.tilesets)) state.tilesets = [];
    state.tilesets.push(tileset);
  }

  const keyMap = buildTilesetKeyMap(tileset);
  const convertSingleFrameLayer = (l) => {
    if (!l) return;
    const tGrid = createEmptyTileGrid(cols, rows);
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const block = extractBlock(l.grid, tx * tw, ty * th, tw, th);
        if (isGridAllZero(block)) {
          tGrid[ty][tx] = 0;
        } else {
          const tileIdx = findOrCreateTileInTileset(tileset, block, { allowCreate: true, keyMap });
          tGrid[ty][tx] = packTileEntry(tileIdx, false, false, 0);
        }
      }
    }
    l.type = "tilemap";
    l.tilesetId = tileset.id;
    l.tileWidth = tw;
    l.tileHeight = th;
    l.tileGrid = tGrid;
    syncTilemapLayerToGrid(l);
  };

  if (Array.isArray(state.frames) && state.frames.length > 0) {
    for (const frame of state.frames) {
      convertSingleFrameLayer(frame.layers?.[resolvedIndex]);
    }
    state.layers = state.frames[state.activeFrameIndex].layers;
  } else {
    convertSingleFrameLayer(targetLayer);
  }

  if (tileset.tiles.length <= 1) {
    tileset.tiles.push({
      id: `tile_${Date.now()}_1`,
      name: "Tile 1",
      grid: createEmptyGrid(tw, th),
    });
  }

  const hasAnyTilePixels = tileset.tiles.some((t, idx) => idx > 0 && t?.grid && !isGridAllZero(t.grid));
  state.activeLayerIndex = resolvedIndex;
  state.activeTilesetId = tileset.id;
  state.activeTileIndex = tileset.tiles.length > 1 ? 1 : 0;
  state.tilemapMode = hasAnyTilePixels ? "tiles" : "auto";
  state.isDirtySinceImport = true;
  syncActiveLayerGrid();
  notify("tilemap:showPanel", { visible: true, silent: true, auto: true });
  renderLayersUI();
  notify("tilemap:render");
  renderAll();
  const count = tileset.tiles.length - 1;
  setStatus({ key: "log.tm_converted", params: { name: targetLayer.name, count, w: tw, h: th } });
}

/**
 * Convierte una capa Tilemap en una capa normal de píxeles conservando su dibujo actual.
 * @param {number} [layerIndex=state.activeLayerIndex]
 */
export function rasterizeTilemapLayer(layerIndex = state.activeLayerIndex) {
  const resolvedIndex =
    typeof layerIndex === "number" && Number.isFinite(layerIndex) ? layerIndex : state.activeLayerIndex;
  const layer = state.layers?.[resolvedIndex];
  if (!layer || layer.type !== "tilemap") return;
  pushState();

  const clearProps = (l) => {
    if (!l || l.type !== "tilemap") return;
    syncTilemapLayerToGrid(l);
    l.type = "pixel";
    delete l.tilesetId;
    delete l.tileWidth;
    delete l.tileHeight;
    delete l.tileGrid;
  };

  if (Array.isArray(state.frames) && state.frames.length > 0) {
    for (const frame of state.frames) {
      clearProps(frame.layers?.[resolvedIndex]);
    }
    state.layers = state.frames[state.activeFrameIndex].layers;
  } else {
    clearProps(layer);
  }

  syncActiveLayerGrid();
  renderLayersUI();
  notify("tilemap:render");
  renderAll();
  setStatus({ key: "log.tm_rasterized", params: { name: layer.name } });
}

