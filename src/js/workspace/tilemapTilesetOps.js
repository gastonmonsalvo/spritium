/**
 * tilemapTilesetOps.js: Operaciones CRUD de tiles, modos de edición y transformaciones del Tileset activo.
 */

import {
  state,
  pushState,
  createEmptyGrid,
  cloneGrid,
  notify,
} from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { setStatus } from "../ui/index.js";
import { i18n } from "../i18n/I18nService.js";
import {
  packTileEntry,
  unpackTileEntry,
  getTilesetById,
  getActiveTileset,
  countTileUsages,
} from "../state/TilemapModel.js";
import { syncAllTilemapLayers } from "./tilemapSync.js";

// --- OPERACIONES DE TILES EN EL TILESET ACTIVO ---

/**
 * Selecciona el índice de tile activo en el Tileset y fuerza el modo `"tiles"`.
 * @param {number} tileIndex
 */
export function selectTileInTileset(tileIndex) {
  const ts = getActiveTileset();
  const maxIdx = ts ? ts.tiles.length - 1 : 0;
  state.activeTileIndex = Math.max(0, Math.min(maxIdx, Number(tileIndex) || 0));
  if (state.tilemapMode !== "tiles") {
    state.tilemapMode = "tiles";
  }
  notify("tilemap:render");
  renderAll();
}

/**
 * Selecciona el Tileset activo por ID y actualiza la selección inicial de tile.
 * @param {string} tilesetId
 */
export function selectActiveTilesetById(tilesetId) {
  const ts = getTilesetById(tilesetId);
  if (!ts) return;
  state.activeTilesetId = ts.id;
  state.activeTileIndex = ts.tiles.length > 1 ? 1 : 0;
  notify("tilemap:render");
}

/**
 * Agrega un nuevo tile vacío al Tileset activo y lo deja seleccionado.
 */
export function addEmptyTileToActiveTileset() {
  const ts = getActiveTileset();
  if (!ts) {
    notify("tilemap:openNewModal");
    return;
  }
  pushState();
  const idx = ts.tiles.length;
  ts.tiles.push({
    id: `tile_${Date.now()}_${idx}`,
    name: `Tile ${idx}`,
    grid: createEmptyGrid(ts.tileWidth, ts.tileHeight),
  });
  state.activeTileIndex = idx;
  notify("tilemap:render");
  setStatus({ key: "log.tm_tile_added", params: { idx, name: ts.name } });
}

/**
 * Duplica el tile activo del Tileset como un nuevo tile independiente.
 */
export function duplicateActiveTile() {
  const ts = getActiveTileset();
  if (!ts || state.activeTileIndex <= 0 || !ts.tiles[state.activeTileIndex]) return;
  pushState();
  const src = ts.tiles[state.activeTileIndex];
  const idx = ts.tiles.length;
  ts.tiles.push({
    id: `tile_${Date.now()}_${idx}`,
    name: i18n.t("default.copy_suffix", { name: src.name || `Tile ${state.activeTileIndex}` }),
    grid: cloneGrid(src.grid),
  });
  state.activeTileIndex = idx;
  notify("tilemap:render");
  setStatus({ key: "log.tm_tile_dup", params: { src: state.activeTileIndex, idx } });
}

function remapTileIndices(ts, oldToNewMap) {
  const visited = new Set();
  const remapLayer = (l) => {
    if (!l || visited.has(l) || l.type !== "tilemap" || l.tilesetId !== ts.id || !Array.isArray(l.tileGrid)) return;
    visited.add(l);
    for (let ty = 0; ty < l.tileGrid.length; ty++) {
      for (let tx = 0; tx < l.tileGrid[ty].length; tx++) {
        const entry = l.tileGrid[ty][tx] || 0;
        const { tileIndex, flipH, flipV, rot } = unpackTileEntry(entry);
        const mapped = oldToNewMap.get(tileIndex) || 0;
        l.tileGrid[ty][tx] = mapped > 0 ? packTileEntry(mapped, flipH, flipV, rot) : 0;
      }
    }
  };
  for (const f of state.frames || []) {
    for (const l of f.layers || []) remapLayer(l);
  }
  for (const l of state.layers || []) remapLayer(l);
}

/**
 * Elimina el tile activo del Tileset (o lo vacía si es el único) y remapea todas las referencias.
 */
export function deleteActiveTile() {
  const ts = getActiveTileset();
  const targetIdx = state.activeTileIndex;
  if (!ts || targetIdx <= 0 || !ts.tiles[targetIdx]) return;
  if (ts.tiles.length <= 2) {
    // Limpiar el contenido si es el único tile del tileset
    pushState();
    ts.tiles[targetIdx].grid = createEmptyGrid(ts.tileWidth, ts.tileHeight);
    syncAllTilemapLayers(ts.id);
    notify("tilemap:render");
    renderAll();
    setStatus({ key: "log.tm_tile_cleared", params: { idx: targetIdx } });
    return;
  }

  pushState();
  const oldToNew = new Map([[0, 0]]);
  const nextTiles = [null];
  for (let i = 1; i < ts.tiles.length; i++) {
    if (i === targetIdx) {
      oldToNew.set(i, 0);
    } else {
      oldToNew.set(i, nextTiles.length);
      nextTiles.push(ts.tiles[i]);
    }
  }
  ts.tiles = nextTiles;
  remapTileIndices(ts, oldToNew);
  state.activeTileIndex = Math.min(targetIdx, ts.tiles.length - 1);
  syncAllTilemapLayers(ts.id);
  notify("tilemap:render");
  renderAll();
  setStatus({ key: "log.tm_tile_deleted", params: { idx: targetIdx } });
}

/**
 * Elimina del Tileset activo todos los tiles que no están colocados en ninguna capa ni fotograma.
 */
export function pruneUnusedTiles() {
  const ts = getActiveTileset();
  if (!ts || ts.tiles.length <= 1) return;
  const counts = countTileUsages(ts);
  const unused = [];
  for (let i = 1; i < ts.tiles.length; i++) {
    if ((counts[i] || 0) === 0) unused.push(i);
  }
  if (unused.length === 0) {
    setStatus({ key: "log.tm_no_unused" });
    return;
  }

  pushState();
  const oldToNew = new Map([[0, 0]]);
  const nextTiles = [null];
  for (let i = 1; i < ts.tiles.length; i++) {
    if ((counts[i] || 0) > 0 || nextTiles.length === 1 && unused.length === ts.tiles.length - 1) {
      if ((counts[i] || 0) === 0 && nextTiles.length === 1) {
        oldToNew.set(i, 1);
        nextTiles.push({
          id: `tile_${Date.now()}_1`,
          name: "Tile 1",
          grid: createEmptyGrid(ts.tileWidth, ts.tileHeight),
        });
      } else {
        oldToNew.set(i, nextTiles.length);
        nextTiles.push(ts.tiles[i]);
      }
    } else {
      oldToNew.set(i, 0);
    }
  }
  ts.tiles = nextTiles;
  remapTileIndices(ts, oldToNew);
  state.activeTileIndex = Math.min(state.activeTileIndex, ts.tiles.length - 1);
  syncAllTilemapLayers(ts.id);
  notify("tilemap:render");
  renderAll();
  setStatus({ key: "log.tm_unused_removed", params: { count: unused.length } });
}

/**
 * Reordena un tile dentro del Tileset activo (índices 1..N) y remapea todas las referencias en capas y frames.
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {boolean}
 */
export function reorderTileInActiveTileset(fromIndex, toIndex) {
  const ts = getActiveTileset();
  if (!ts || ts.tiles.length <= 2) return false;
  const from = Math.round(Number(fromIndex));
  const to = Math.round(Number(toIndex));
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from === to ||
    from < 1 ||
    to < 1 ||
    from >= ts.tiles.length ||
    to >= ts.tiles.length
  ) {
    return false;
  }

  pushState();
  const entries = ts.tiles.slice(1).map((tile, k) => ({ oldIdx: k + 1, tile }));
  const [moved] = entries.splice(from - 1, 1);
  entries.splice(to - 1, 0, moved);

  const oldToNew = new Map([[0, 0]]);
  const nextTiles = [null];
  entries.forEach((entry, k) => {
    const newIdx = k + 1;
    oldToNew.set(entry.oldIdx, newIdx);
    nextTiles.push(entry.tile);
  });

  ts.tiles = nextTiles;
  remapTileIndices(ts, oldToNew);
  state.activeTileIndex = to;
  syncAllTilemapLayers(ts.id);
  notify("tilemap:render");
  renderAll();
  setStatus({ key: "log.tm_tile_reordered", params: { from: from - 1, to: to - 1 } });
  return true;
}

// --- MODOS Y TRANSFORMACIONES ---

/**
 * Cambia el modo de edición de Tilemap ("tiles", "edit-tile" o "auto").
 * @param {string} mode
 */
export function setTilemapMode(mode) {
  if (!["tiles", "edit-tile", "auto"].includes(mode)) return;
  state.tilemapMode = mode;
  notify("tilemap:render");
  renderAll();
  const labels = {
    tiles: "Colocar Tiles (Lápiz/Balde/Formas pintan tiles)",
    "edit-tile": "Editar Tile Fuente (modifica instancias al soltar)",
    auto: "Auto-Tile (crea/deduplica tiles al pintar píxeles)",
  };
  setStatus({ key: `log.tm_mode_${mode}` });
}

/**
 * Alterna el volteo horizontal para la colocación del tile activo.
 */
export function toggleTileFlipH() {
  state.tileFlipH = !state.tileFlipH;
  notify("tilemap:render");
  renderAll();
}

/**
 * Alterna el volteo vertical para la colocación del tile activo.
 */
export function toggleTileFlipV() {
  state.tileFlipV = !state.tileFlipV;
  notify("tilemap:render");
  renderAll();
}

/**
 * Rota la orientación del tile activo en pasos de 90° (o 180° si no es cuadrado).
 */
export function rotateActiveTilePlacement() {
  const ts = getActiveTileset();
  const step = ts && ts.tileWidth !== ts.tileHeight ? 2 : 1;
  state.tileRot = (state.tileRot + step) % 4;
  notify("tilemap:render");
  renderAll();
}

/**
 * Muestra u oculta la grilla cian de límites de tiles sobre el lienzo.
 */
export function toggleTilemapGrid() {
  state.showTilemapGrid = state.showTilemapGrid === false;
  notify("tilemap:render");
  renderAll();
}

/**
 * Ajusta el tamaño de miniatura (32, 40 o 52 px) en la grilla del panel Tileset.
 * @param {number|string} px
 */
export function setTilesetThumbSize(px) {
  const val = Number(px);
  if (![32, 40, 52].includes(val)) return;
  state.tilesetThumbSize = val;
  notify("tilemap:render");
}
