// @ts-check
/**
 * TilemapModel.js: Modelo de dominio puro para Tilesets y capas Tilemap (0 acceso al DOM).
 * Contiene el empaquetado binario de 32 bits por celda (tileIndex + FlipH + FlipV + Rot90°),
 * las transformaciones matriciales directa/inversa y la sincronización `tileGrid <-> layer.grid`.
 */

import { state, createEmptyGrid, cloneGrid, getGridDims } from "../core/state.js";

let tilesetSeq = 1;

/**
 * Empaqueta índice de tile (0..65535), Flip H, Flip V y rotación (0..3 × 90°) en un entero de 32 bits.
 * @param {number} tileIndex
 * @param {boolean} [flipH=false]
 * @param {boolean} [flipV=false]
 * @param {number} [rot=0]
 * @returns {number}
 */
export function packTileEntry(tileIndex, flipH = false, flipV = false, rot = 0) {
  const idx = Math.max(0, Math.min(0xffff, Math.round(Number(tileIndex) || 0)));
  if (idx === 0) return 0;
  const r = ((Math.round(Number(rot) || 0) % 4) + 4) % 4;
  return (idx & 0xffff) | (flipH ? 0x10000 : 0) | (flipV ? 0x20000 : 0) | ((r & 3) << 18);
}

/**
 * Desempaqueta una entrada de `tileGrid[ty][tx]`.
 * @param {number} entry
 * @returns {{tileIndex: number, flipH: boolean, flipV: boolean, rot: number}}
 */
export function unpackTileEntry(entry) {
  const val = Number(entry) || 0;
  return {
    tileIndex: val & 0xffff,
    flipH: Boolean(val & 0x10000),
    flipV: Boolean(val & 0x20000),
    rot: (val >>> 18) & 3,
  };
}

/**
 * Calcula las coordenadas destino `[dx, dy]` de un píxel `(sx, sy)` del tile tras aplicar flips y rotación.
 * @param {number} sx
 * @param {number} sy
 * @param {number} tileW
 * @param {number} tileH
 * @param {boolean} flipH
 * @param {boolean} flipV
 * @param {number} rot
 * @returns {[number, number]}
 */
export function forwardTileCoords(sx, sy, tileW, tileH, flipH, flipV, rot) {
  let x = flipH ? tileW - 1 - sx : sx;
  let y = flipV ? tileH - 1 - sy : sy;
  const r = ((rot % 4) + 4) % 4;
  if (r === 2) {
    x = tileW - 1 - x;
    y = tileH - 1 - y;
  } else if (r === 1 && tileW === tileH) {
    const nx = tileH - 1 - y;
    const ny = x;
    x = nx;
    y = ny;
  } else if (r === 3 && tileW === tileH) {
    const nx = y;
    const ny = tileW - 1 - x;
    x = nx;
    y = ny;
  }
  return [x, y];
}

/**
 * Devuelve una matriz `tileH × tileW` con los píxeles del tile transformados según Flip H/V y Rot.
 * @param {number[][]} tileGrid
 * @param {number} tileW
 * @param {number} tileH
 * @param {boolean} [flipH=false]
 * @param {boolean} [flipV=false]
 * @param {number} [rot=0]
 * @returns {number[][]}
 */
export function getTransformedTilePixels(tileGrid, tileW, tileH, flipH = false, flipV = false, rot = 0) {
  const out = createEmptyGrid(tileW, tileH);
  if (!tileGrid) return out;
  for (let sy = 0; sy < tileH; sy++) {
    const row = tileGrid[sy];
    if (!row) continue;
    for (let sx = 0; sx < tileW; sx++) {
      const [dx, dy] = forwardTileCoords(sx, sy, tileW, tileH, flipH, flipV, rot);
      if (out[dy] && out[dy][dx] !== undefined) {
        out[dy][dx] = row[sx] || 0;
      }
    }
  }
  return out;
}

/**
 * Inverso exacto de `getTransformedTilePixels` para llevar un bloque del lienzo al tile fuente.
 * @param {number[][]} blockGrid
 * @param {number} tileW
 * @param {number} tileH
 * @param {boolean} [flipH=false]
 * @param {boolean} [flipV=false]
 * @param {number} [rot=0]
 * @returns {number[][]}
 */
export function getInverseTransformedTilePixels(blockGrid, tileW, tileH, flipH = false, flipV = false, rot = 0) {
  const src = createEmptyGrid(tileW, tileH);
  if (!blockGrid) return src;
  for (let sy = 0; sy < tileH; sy++) {
    for (let sx = 0; sx < tileW; sx++) {
      const [dx, dy] = forwardTileCoords(sx, sy, tileW, tileH, flipH, flipV, rot);
      src[sy][sx] = blockGrid[dy]?.[dx] ?? 0;
    }
  }
  return src;
}

/**
 * Obtiene un Tileset por su ID.
 * @param {string|null|undefined} tilesetId
 * @returns {import('../types.js').Tileset|null}
 */
export function getTilesetById(tilesetId) {
  if (!tilesetId) return null;
  return (state.tilesets || []).find((ts) => ts.id === tilesetId) || null;
}

/**
 * Devuelve el Tileset asociado a la capa activa o el seleccionado globalmente.
 * @returns {import('../types.js').Tileset|null}
 */
export function getActiveTileset() {
  if (state.activeTilesetId) {
    const byId = getTilesetById(state.activeTilesetId);
    if (byId) return byId;
  }
  const activeLayer = state.layers?.[state.activeLayerIndex];
  if (activeLayer?.type === "tilemap" && activeLayer.tilesetId) {
    const layerTs = getTilesetById(activeLayer.tilesetId);
    if (layerTs) return layerTs;
  }
  return state.tilesets?.[0] || null;
}

/**
 * Devuelve la capa activa si es de tipo `"tilemap"`, o `null` en caso contrario.
 * @returns {import('../types.js').Layer|null}
 */
export function getActiveTilemapLayer() {
  const layer = state.layers?.[state.activeLayerIndex];
  return layer?.type === "tilemap" ? layer : null;
}

/**
 * Calcula las dimensiones en celdas `(cols, rows)` y en píxeles `(tileW, tileH, w, h)` para una capa Tilemap.
 * @param {import('../types.js').Layer|null|undefined} layer
 */
export function getTileGridDims(layer) {
  const { w, h } = getGridDims();
  const tw = Math.max(1, Number(layer?.tileWidth) || 16);
  const th = Math.max(1, Number(layer?.tileHeight) || 16);
  return {
    cols: Math.max(1, Math.ceil(w / tw)),
    rows: Math.max(1, Math.ceil(h / th)),
    tileW: tw,
    tileH: th,
    w,
    h,
  };
}

/**
 * Crea una matriz vacía `rows × cols` de entradas de tile inicializadas en `0`.
 * @param {number} cols
 * @param {number} rows
 * @returns {number[][]}
 */
export function createEmptyTileGrid(cols, rows) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

/**
 * Asegura que `layer.tileGrid` coincida con las dimensiones `cols × rows` actuales del lienzo.
 * @param {import('../types.js').Layer|null|undefined} layer
 */
export function ensureLayerTileGridDimensions(layer) {
  if (!layer || layer.type !== "tilemap") return;
  const { cols, rows } = getTileGridDims(layer);
  if (!Array.isArray(layer.tileGrid)) {
    layer.tileGrid = createEmptyTileGrid(cols, rows);
    return;
  }
  if (layer.tileGrid.length !== rows || (layer.tileGrid[0]?.length || 0) !== cols) {
    const next = createEmptyTileGrid(cols, rows);
    const copyRows = Math.min(rows, layer.tileGrid.length);
    for (let ty = 0; ty < copyRows; ty++) {
      const copyCols = Math.min(cols, layer.tileGrid[ty]?.length || 0);
      for (let tx = 0; tx < copyCols; tx++) {
        next[ty][tx] = layer.tileGrid[ty][tx] || 0;
      }
    }
    layer.tileGrid = next;
  }
}

/**
 * Crea un Tileset nuevo en `state.tilesets`. Índice 0 es siempre `null` (vacío).
 * @param {string} name
 * @param {number} [tileWidth=16]
 * @param {number} [tileHeight=16]
 * @param {number[][][]} [initialTileGrids=[]]
 * @returns {import('../types.js').Tileset}
 */
export function createTileset(name, tileWidth = 16, tileHeight = 16, initialTileGrids = []) {
  if (!Array.isArray(state.tilesets)) state.tilesets = [];
  const tw = Math.max(2, Math.min(512, Math.round(Number(tileWidth) || 16)));
  const th = Math.max(2, Math.min(512, Math.round(Number(tileHeight) || 16)));
  const id = `ts_${Date.now()}_${tilesetSeq++}`;
  /** @type {Array<import('../types.js').TileItem|null>} */
  const tiles = [null];
  if (Array.isArray(initialTileGrids) && initialTileGrids.length > 0) {
    initialTileGrids.forEach((g, idx) => {
      tiles.push({
        id: `tile_${Date.now()}_${idx + 1}`,
        name: `Tile ${idx + 1}`,
        grid: cloneGrid(g),
      });
    });
  } else {
    tiles.push({
      id: `tile_${Date.now()}_1`,
      name: "Tile 1",
      grid: createEmptyGrid(tw, th),
    });
  }
  const ts = {
    id,
    name: name || `Tileset ${state.tilesets.length + 1}`,
    tileWidth: tw,
    tileHeight: th,
    tiles,
  };
  state.tilesets.push(ts);
  state.activeTilesetId = ts.id;
  state.activeTileIndex = ts.tiles.length > 1 ? 1 : 0;
  return ts;
}

/**
 * Sincroniza el `grid[y][x]` rasterizado de una capa Tilemap a partir de su `tileGrid` y su `tileset`.
 * @param {import('../types.js').Layer|null|undefined} layer
 */
export function syncTilemapLayerToGrid(layer) {
  if (!layer || layer.type !== "tilemap") return;
  const tileset = getTilesetById(layer.tilesetId);
  const { cols, rows, tileW, tileH, w, h } = getTileGridDims(layer);
  ensureLayerTileGridDimensions(layer);

  if (!Array.isArray(layer.grid) || layer.grid.length !== h || (layer.grid[0]?.length || 0) !== w) {
    layer.grid = createEmptyGrid(w, h);
  }
  const grid = layer.grid;
  const tileGrid = layer.tileGrid || [];

  const transformedCache = new Map();
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const entry = tileGrid[ty]?.[tx] || 0;
      const { tileIndex, flipH, flipV, rot } = unpackTileEntry(entry);
      const tileObj = tileIndex > 0 ? tileset?.tiles?.[tileIndex] : null;
      let pixels = null;
      if (tileObj?.grid) {
        if (!flipH && !flipV && rot === 0) {
          pixels = tileObj.grid;
        } else {
          let cached = transformedCache.get(entry);
          if (!cached) {
            cached = getTransformedTilePixels(tileObj.grid, tileW, tileH, flipH, flipV, rot);
            transformedCache.set(entry, cached);
          }
          pixels = cached;
        }
      }

      const ox = tx * tileW;
      const oy = ty * tileH;
      const maxPy = Math.min(tileH, h - oy);
      const maxPx = Math.min(tileW, w - ox);
      for (let py = 0; py < maxPy; py++) {
        const dstRow = grid[oy + py];
        const srcRow = pixels?.[py];
        for (let px = 0; px < maxPx; px++) {
          dstRow[ox + px] = srcRow ? (srcRow[px] || 0) : 0;
        }
      }
    }
  }
}

/**
 * Cuenta cuántas celdas usan cada índice de tile del Tileset en todos los frames del documento.
 * @param {import('../types.js').Tileset} tileset
 * @returns {number[]}
 */
export function countTileUsages(tileset) {
  const counts = new Array(tileset.tiles.length).fill(0);
  const scanLayer = (l) => {
    if (!l || l.type !== "tilemap" || l.tilesetId !== tileset.id || !Array.isArray(l.tileGrid)) return;
    for (const row of l.tileGrid) {
      for (const entry of row) {
        const { tileIndex } = unpackTileEntry(entry);
        if (tileIndex > 0 && tileIndex < counts.length) counts[tileIndex]++;
      }
    }
  };
  if (Array.isArray(state.frames) && state.frames.length > 0) {
    for (const f of state.frames) {
      for (const l of f.layers || []) scanLayer(l);
    }
  } else {
    for (const l of state.layers || []) scanLayer(l);
  }
  return counts;
}
