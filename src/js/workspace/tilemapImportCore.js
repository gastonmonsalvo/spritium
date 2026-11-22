/**
 * tilemapImportCore.js: Lógica pura de parsing de mapas Tilemap JSON (Spritium y Tiled)
 * y slicing/deduplicación de hojas Tileset desde ImageData.
 */

import { createEmptyGrid } from "../core/state.js";
import { packTileEntry, createEmptyTileGrid } from "../state/TilemapModel.js";

function toHex(r, g, b) {
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function serializeTileGridKey(grid) {
  return grid.map((r) => r.join(",")).join(";");
}

function isTileAllZero(grid) {
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] && row[x] !== 0) return false;
    }
  }
  return true;
}

/**
 * Normaliza una dimensión de tile dentro del rango válido `[2, 512]`.
 * @param {number|string|null|undefined} v
 * @param {number} [fallback=16]
 * @returns {number}
 */
export function clampTileDim(v, fallback = 16) {
  return Math.max(2, Math.min(512, Math.round(Number(v) || fallback)));
}

function decodeTiledTransform(flippedH, flippedV, antiDiag) {
  if (!antiDiag) return { flipH: flippedH, flipV: flippedV, rot: 0 };
  if (!flippedH && !flippedV) return { flipH: false, flipV: true, rot: 1 };
  if (flippedH && !flippedV) return { flipH: false, flipV: false, rot: 1 };
  if (!flippedH && flippedV) return { flipH: false, flipV: false, rot: 3 };
  return { flipH: true, flipV: false, rot: 1 };
}

/**
 * Parsea y normaliza un archivo o payload JSON de mapa Tilemap (formato Spritium o Tiled).
 * @param {string|Object} raw
 * @returns {{layerName: string, tilesetName: string, tileWidth: number, tileHeight: number, cols: number, rows: number, tileCount: number, tileGrid: number[][]}}
 */
export function parseTilemapJsonPayload(raw) {
  const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!obj || typeof obj !== "object") throw new Error("INVALID_TILEMAP_JSON");

  // 1. Formato nativo Spritium
  const isSpritium =
    obj.type === "tilemap" ||
    Array.isArray(obj.grid) ||
    (Array.isArray(obj.data) && Number(obj.cols) > 0 && Number(obj.rows) > 0);
  if (isSpritium) {
    const tileWidth = clampTileDim(obj.tileWidth, 16);
    const tileHeight = clampTileDim(obj.tileHeight, 16);
    const rows = Math.max(
      1,
      Math.round(Number(obj.rows) || (Array.isArray(obj.grid) ? obj.grid.length : 1)),
    );
    const cols = Math.max(
      1,
      Math.round(
        Number(obj.cols) ||
          (Array.isArray(obj.grid?.[0])
            ? obj.grid[0].length
            : Array.isArray(obj.data)
              ? Math.ceil(obj.data.length / rows)
              : 1),
      ),
    );
    const tileGrid = createEmptyTileGrid(cols, rows);
    let maxId = 0;

    if (Array.isArray(obj.grid)) {
      for (let ty = 0; ty < rows; ty++) {
        const srcRow = obj.grid[ty];
        if (!Array.isArray(srcRow)) continue;
        for (let tx = 0; tx < cols; tx++) {
          const cell = srcRow[tx];
          if (cell && typeof cell === "object") {
            const id = Math.max(0, Math.round(Number(cell.id) || 0));
            if (id <= 0) continue;
            if (id > maxId) maxId = id;
            const rot = ((Math.round((Number(cell.rotDeg) || 0) / 90) % 4) + 4) % 4;
            tileGrid[ty][tx] = packTileEntry(id, Boolean(cell.flipH), Boolean(cell.flipV), rot);
          } else {
            const id = Math.max(0, Math.round(Number(cell) || 0));
            if (id > maxId) maxId = id;
            tileGrid[ty][tx] = id > 0 ? packTileEntry(id, false, false, 0) : 0;
          }
        }
      }
    } else if (Array.isArray(obj.data)) {
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          const id = Math.max(0, Math.round(Number(obj.data[ty * cols + tx]) || 0));
          if (id > maxId) maxId = id;
          tileGrid[ty][tx] = id > 0 ? packTileEntry(id, false, false, 0) : 0;
        }
      }
    } else {
      throw new Error("INVALID_TILEMAP_JSON");
    }

    return {
      layerName: String(obj.layerName || "Tilemap"),
      tilesetName: String(obj.tilesetName || obj.layerName || "Tileset"),
      tileWidth,
      tileHeight,
      cols,
      rows,
      tileCount: Math.max(Math.round(Number(obj.tileCount) || 0), maxId),
      tileGrid,
    };
  }

  // 2. Formato Tiled (.tmj / .json)
  if (Array.isArray(obj.layers) && Number(obj.tilewidth) > 0 && Number(obj.tileheight) > 0) {
    const tileLayer = obj.layers.find((l) => l?.type === "tilelayer" && Array.isArray(l.data));
    if (!tileLayer) throw new Error("INVALID_TILEMAP_JSON");
    const tileWidth = clampTileDim(obj.tilewidth, 16);
    const tileHeight = clampTileDim(obj.tileheight, 16);
    const cols = Math.max(1, Math.round(Number(tileLayer.width || obj.width) || 1));
    const rows = Math.max(1, Math.round(Number(tileLayer.height || obj.height) || 1));
    const firstgid = Number(obj.tilesets?.[0]?.firstgid) || 1;
    const tileGrid = createEmptyTileGrid(cols, rows);
    let maxId = 0;

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const rawGid = (Number(tileLayer.data[ty * cols + tx]) || 0) >>> 0;
        if (!rawGid) continue;
        const flipHFlag = Boolean(rawGid & 0x80000000);
        const flipVFlag = Boolean(rawGid & 0x40000000);
        const antiDiag = Boolean(rawGid & 0x20000000);
        const gid = rawGid & 0x1fffffff;
        const id = gid >= firstgid ? gid - firstgid + 1 : 0;
        if (id <= 0) continue;
        if (id > maxId) maxId = id;
        const tr = decodeTiledTransform(flipHFlag, flipVFlag, antiDiag);
        tileGrid[ty][tx] = packTileEntry(id, tr.flipH, tr.flipV, tr.rot);
      }
    }

    const declaredCount = Number(obj.tilesets?.[0]?.tilecount) || 0;
    return {
      layerName: String(tileLayer.name || "Tilemap"),
      tilesetName: String(obj.tilesets?.[0]?.name || tileLayer.name || "Tileset"),
      tileWidth,
      tileHeight,
      cols,
      rows,
      tileCount: Math.max(declaredCount, maxId),
      tileGrid,
    };
  }

  throw new Error("INVALID_TILEMAP_JSON");
}

/**
 * Corta un `ImageData` de hoja Tileset en celdas `tileWidth × tileHeight`, integrando colores en la paleta.
 * @param {{width: number, height: number, data: Uint8ClampedArray|ArrayLike<number>}} imgData
 * @param {{tileWidth?: number, tileHeight?: number, maxTiles?: number|null, skipEmpty?: boolean, dedupe?: boolean, paletteMap?: Record<number, string|null>|null, customColorIndices?: number[]|null, alphaThreshold?: number}} [options]
 * @returns {{tiles: Array<Object|null>, paletteMap: Record<number, string|null>, tileCount: number, sheetCols: number, sheetRows: number}}
 */
export function sliceImageDataToTiles(imgData, options = {}) {
  const tw = clampTileDim(options.tileWidth, 16);
  const th = clampTileDim(options.tileHeight, 16);
  const maxTiles = options.maxTiles ? Math.max(1, Math.round(Number(options.maxTiles))) : null;
  const skipEmpty = Boolean(options.skipEmpty);
  const dedupe = Boolean(options.dedupe);
  const alphaThreshold = Math.max(1, Math.min(255, Number(options.alphaThreshold ?? 16) || 16));

  const useExisting = Boolean(options.paletteMap && typeof options.paletteMap === "object");
  const targetPalette = useExisting ? options.paletteMap : { 0: null };
  const hexToIdx = new Map();
  let nextIdx = 1;

  if (useExisting) {
    let maxExisting = 39;
    for (const [k, hex] of Object.entries(targetPalette)) {
      const idx = Number(k);
      if (idx === 0 || idx === 9999 || !hex) continue;
      hexToIdx.set(String(hex).toLowerCase(), idx);
      if (idx < 9000 && idx > maxExisting) maxExisting = idx;
    }
    nextIdx = maxExisting + 1;
  }

  const sheetCols = Math.max(1, Math.floor((imgData?.width || 0) / tw));
  const sheetRows = Math.max(1, Math.floor((imgData?.height || 0) / th));
  const data = imgData?.data || [];
  const srcW = imgData?.width || 0;
  const srcH = imgData?.height || 0;

  const tiles = [null];
  const seenKeys = new Set();

  outer: for (let ty = 0; ty < sheetRows; ty++) {
    for (let tx = 0; tx < sheetCols; tx++) {
      if (maxTiles && tiles.length - 1 >= maxTiles) break outer;
      const grid = createEmptyGrid(tw, th);
      const ox = tx * tw;
      const oy = ty * th;
      for (let py = 0; py < th; py++) {
        if (oy + py >= srcH) continue;
        for (let px = 0; px < tw; px++) {
          if (ox + px >= srcW) continue;
          const off = ((oy + py) * srcW + (ox + px)) * 4;
          if ((data[off + 3] || 0) < alphaThreshold) continue;
          const hex = toHex(data[off], data[off + 1], data[off + 2]).toLowerCase();
          let cIdx = hexToIdx.get(hex);
          if (cIdx === undefined) {
            cIdx = nextIdx++;
            targetPalette[cIdx] = hex;
            hexToIdx.set(hex, cIdx);
            if (Array.isArray(options.customColorIndices) && !options.customColorIndices.includes(cIdx)) {
              options.customColorIndices.push(cIdx);
            }
          }
          grid[py][px] = cIdx;
        }
      }

      if (skipEmpty && isTileAllZero(grid)) continue;
      if (dedupe) {
        const key = serializeTileGridKey(grid);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
      }

      const idx = tiles.length;
      tiles.push({
        id: `tile_${Date.now()}_${idx}`,
        name: `Tile ${idx}`,
        grid,
      });
    }
  }

  if (tiles.length === 1) {
    tiles.push({
      id: `tile_${Date.now()}_1`,
      name: "Tile 1",
      grid: createEmptyGrid(tw, th),
    });
  }

  return {
    tiles,
    paletteMap: targetPalette,
    tileCount: tiles.length - 1,
    sheetCols,
    sheetRows,
  };
}
