// @ts-check
/**
 * tilemapExporter.js: Exportadores puros de Tileset PNG y Tilemap JSON (formato compatible con Tiled).
 * Separado de tilemap.js para mantener cohesión (SRP) y grafo de dependencias acíclico.
 */

import { state } from "../core/state.js";
import { parseColorToRgba } from "../core/color.js";
import { setStatus } from "../ui/status.js";
import {
  unpackTileEntry,
  getTilesetById,
  getActiveTileset,
  getActiveTilemapLayer,
  getTileGridDims,
  ensureLayerTileGridDimensions,
} from "../state/TilemapModel.js";

/**
 * Exporta el Tileset activo como una hoja PNG empaquetada en grilla.
 */
export function exportActiveTilesetPng() {
  const ts = getActiveTileset();
  if (!ts || ts.tiles.length <= 1) {
    setStatus({ key: "log.tm_no_tiles" }, true);
    return;
  }
  const tileCount = ts.tiles.length - 1;
  const cols = tileCount <= 8 ? tileCount : Math.ceil(Math.sqrt(tileCount));
  const rows = Math.ceil(tileCount / cols);
  const canvas = document.createElement("canvas");
  canvas.width = cols * ts.tileWidth;
  canvas.height = rows * ts.tileHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const imgData = ctx.createImageData(canvas.width, canvas.height);

  for (let i = 1; i <= tileCount; i++) {
    const tObj = ts.tiles[i];
    if (!tObj?.grid) continue;
    const tx = (i - 1) % cols;
    const ty = Math.floor((i - 1) / cols);
    const ox = tx * ts.tileWidth;
    const oy = ty * ts.tileHeight;
    for (let py = 0; py < ts.tileHeight; py++) {
      for (let px = 0; px < ts.tileWidth; px++) {
        const cIdx = tObj.grid[py]?.[px] || 0;
        if (!cIdx) continue;
        const rgba = parseColorToRgba(state.paletteMap?.[cIdx]);
        if (!rgba) continue;
        const off = ((oy + py) * canvas.width + (ox + px)) * 4;
        imgData.data[off] = rgba[0];
        imgData.data[off + 1] = rgba[1];
        imgData.data[off + 2] = rgba[2];
        imgData.data[off + 3] = rgba[3];
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const assetEl = /** @type {HTMLInputElement|null} */ (document.getElementById("assetName"));
  const proj = assetEl?.value.trim() || "spritium";
  const safeTs = (ts.name || "tileset").toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${proj}_${safeTs}_tileset.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus({ key: "log.tm_ts_exported", params: { count: tileCount, w: canvas.width, h: canvas.height } });
  }, "image/png");
}

/**
 * Exporta la capa Tilemap activa en formato JSON estructurado (con arreglo lineal y matriz detallada).
 */
export function exportActiveTilemapJson() {
  const layer = getActiveTilemapLayer();
  if (!layer) {
    setStatus({ key: "log.tm_need_layer" }, true);
    return;
  }
  const ts = getTilesetById(layer.tilesetId);
  const { cols, rows, tileW, tileH } = getTileGridDims(layer);
  ensureLayerTileGridDimensions(layer);

  const linearData = [];
  const gridDetailed = [];
  for (let ty = 0; ty < rows; ty++) {
    const rowOut = [];
    for (let tx = 0; tx < cols; tx++) {
      const entry = layer.tileGrid[ty]?.[tx] || 0;
      const { tileIndex, flipH, flipV, rot } = unpackTileEntry(entry);
      // En formato Tiled: bits 31=FlipH, 30=FlipV, 29=AntiDiag
      linearData.push(tileIndex);
      rowOut.push({ id: tileIndex, flipH, flipV, rotDeg: rot * 90 });
    }
    gridDetailed.push(rowOut);
  }

  const payload = {
    app: "Spritium",
    type: "tilemap",
    layerName: layer.name,
    tilesetName: ts?.name || "Tileset",
    tileWidth: tileW,
    tileHeight: tileH,
    cols,
    rows,
    tileCount: ts ? Math.max(0, ts.tiles.length - 1) : 0,
    data: linearData,
    grid: gridDetailed,
  };

  const assetEl = /** @type {HTMLInputElement|null} */ (document.getElementById("assetName"));
  const proj = assetEl?.value.trim() || "spritium";
  const safeLayer = (layer.name || "tilemap").toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${proj}_${safeLayer}_tilemap.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus({ key: "log.tm_json_exported", params: { cols, rows } });
}
