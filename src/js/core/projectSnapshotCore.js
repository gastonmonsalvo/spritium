/**
 * projectSnapshotCore.js: Lógica pura de LUT de colores, render de buffer RGBA por capa, clonado de frames y restauración de snapshot.
 */

import { parseColorToRgba } from "./color.js";

/**
 * Construye una tabla de búsqueda `index -> [r, g, b, a]` para índices positivos de paleta.
 * @param {Record<number, string|null>} paletteMap
 * @returns {Map<number, number[]>}
 */
export function buildColorLut(paletteMap) {
  const lut = new Map();
  for (const [k, hex] of Object.entries(paletteMap || {})) {
    const idx = Number(k);
    if (idx > 0 && hex) {
      const rgba = parseColorToRgba(hex);
      if (rgba) lut.set(idx, rgba);
    }
  }
  return lut;
}

/**
 * Escribe los píxeles RGBA de una capa sobre un buffer `Uint8ClampedArray` limpio.
 * @param {{ grid: number[][] }} layer
 * @param {number} gridW
 * @param {number} gridH
 * @param {Map<number, number[]>} lut
 * @param {Uint8ClampedArray} data
 */
export function drawLayerToImageData(layer, gridW, gridH, lut, data) {
  data.fill(0);
  for (let y = 0; y < gridH; y++) {
    const row = layer.grid[y];
    if (!row) continue;
    const rowOff = y * gridW;
    for (let x = 0; x < gridW; x++) {
      const idx = row[x];
      const rgba = idx ? lut.get(idx) : null;
      if (!rgba) continue;
      const p = (rowOff + x) << 2;
      data[p] = rgba[0];
      data[p + 1] = rgba[1];
      data[p + 2] = rgba[2];
      data[p + 3] = rgba[3];
    }
  }
}

/**
 * Clona una entrada de frame preservando metadatos opcionales (`name`, `color`, `colWidth`).
 * @param {Record<string, any>} f
 * @param {number} idx
 * @param {(layers: any[]) => any[]} cloneLayersFn
 * @returns {Record<string, any>}
 */
export function cloneFrameEntry(f, idx, cloneLayersFn) {
  const copy = {
    id: f.id || `frame_${idx + 1}`,
    durationMs: f.durationMs || 150,
    activeLayerIndex: f.activeLayerIndex || 0,
    layers: cloneLayersFn(f.layers || []),
  };
  if (f.name) copy.name = f.name;
  if (f.color) copy.color = f.color;
  if (f.colWidth) copy.colWidth = f.colWidth;
  return copy;
}

/**
 * Normaliza el nombre de un proyecto serializado.
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function normalizeProjectName(name) {
  return (name || "").trim() || "nuevo_proyecto";
}

/**
 * Ensambla el objeto snapshot serializable del proyecto.
 * @param {{
 *   stateObj: Record<string, any>,
 *   assetName: string,
 *   dims: { w: number, h: number },
 *   framesCopy: any[],
 *   thumbnailDataUrl?: string,
 *   clonePaletteMapFn: (p: any) => any,
 *   cloneFrameTagsFn: (t: any[]) => any[],
 *   cloneTilesetsFn: (ts: any[]) => any[],
 *   now?: number,
 * }} params
 */
export function assembleProjectSnapshot({
  stateObj,
  assetName,
  dims,
  framesCopy,
  thumbnailDataUrl = "",
  clonePaletteMapFn,
  cloneFrameTagsFn,
  cloneTilesetsFn,
  now = Date.now(),
}) {
  return {
    app: "Spritium",
    version: 1,
    name: assetName,
    gridSize: stateObj.gridSize,
    gridWidth: dims.w,
    gridHeight: dims.h,
    currentThemeKey: stateObj.currentThemeKey,
    paletteMap: clonePaletteMapFn(stateObj.paletteMap),
    customColorIndices: [...stateObj.customColorIndices],
    activeFrameIndex: stateObj.activeFrameIndex,
    frames: framesCopy,
    frameTags: cloneFrameTagsFn(stateObj.frameTags),
    activeTagId: stateObj.activeTagId || null,
    tilesets: cloneTilesetsFn(stateObj.tilesets),
    activeTilesetId: stateObj.activeTilesetId,
    originalImport: stateObj.originalImport,
    updatedAt: now,
    thumbnailDataUrl,
  };
}

/**
 * Aplica un snapshot serializado sobre `stateObj` sin tocar el DOM.
 * @param {{
 *   data: Record<string, any>,
 *   stateObj: Record<string, any>,
 *   setGridSizeFn: (w: number, h: number) => void,
 *   cloneLayersFn: (layers: any[]) => any[],
 *   clonePaletteMapFn: (p: any) => any,
 *   cloneFrameTagsFn: (t: any[]) => any[],
 *   cloneTilesetsFn: (ts: any[]) => any[],
 * }} params
 */
export function applySnapshotToState({
  data,
  stateObj,
  setGridSizeFn,
  cloneLayersFn,
  clonePaletteMapFn,
  cloneFrameTagsFn,
  cloneTilesetsFn,
}) {
  setGridSizeFn(Number(data.gridWidth || data.gridSize), Number(data.gridHeight || data.gridSize));
  stateObj.frames = data.frames.map((f, idx) => cloneFrameEntry(f, idx, cloneLayersFn));
  stateObj.activeFrameIndex = Math.min(
    Math.max(0, Number(data.activeFrameIndex) || 0),
    stateObj.frames.length - 1,
  );
  stateObj.frameTags = cloneFrameTagsFn(data.frameTags || []);
  stateObj.activeTagId = data.activeTagId || null;

  const activeFrame = stateObj.frames[stateObj.activeFrameIndex];
  stateObj.layers = activeFrame.layers;
  stateObj.activeLayerIndex = Math.min(
    Math.max(0, activeFrame.activeLayerIndex || 0),
    stateObj.layers.length - 1,
  );

  stateObj.paletteMap = clonePaletteMapFn(data.paletteMap || { 0: null });
  stateObj.customColorIndices = Array.isArray(data.customColorIndices) ? [...data.customColorIndices] : [];
  stateObj.tilesets = cloneTilesetsFn(data.tilesets || []);
  stateObj.activeTilesetId = data.activeTilesetId || (stateObj.tilesets[0]?.id ?? null);
  stateObj.activeTileIndex = stateObj.tilesets[0]?.tiles?.length > 1 ? 1 : 0;
  stateObj.originalImport = data.originalImport || null;
  stateObj.currentThemeKey = data.currentThemeKey || "original";
  stateObj.isDirtySinceImport = true;
  stateObj.selection = null;
  stateObj.currentColorIndex = stateObj.paletteMap[2] ? 2 : 1;
}
