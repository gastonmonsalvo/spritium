/**
 * paletteCore.js: Lógica pura de registro de colores, slots libres y sincronización de paleta con píxeles del lienzo.
 */

export const FREE_BRUSH_IDX = 9999;
export const FREE_SECONDARY_IDX = 9998;

/**
 * Registra un color HEX/RGBA en `paletteMap` y `customColorIndices`, reutilizando su índice si ya existe.
 * @param {Record<number, string>} paletteMap
 * @param {number[]} customColorIndices
 * @param {string} hex
 * @returns {{ index: number, alreadyExists: boolean }}
 */
export function registerColorCore(paletteMap, customColorIndices, hex) {
  const normalized = String(hex || "").toLowerCase();
  for (const [idxStr, col] of Object.entries(paletteMap)) {
    const idx = Number(idxStr);
    if (idx !== FREE_BRUSH_IDX && idx !== FREE_SECONDARY_IDX && idx !== 0 && col?.toLowerCase() === normalized) {
      return { index: idx, alreadyExists: true };
    }
  }
  const existingKeys = Object.keys(paletteMap)
    .map(Number)
    .filter((k) => k !== FREE_BRUSH_IDX && k !== FREE_SECONDARY_IDX);
  const newIdx = Math.max(40, (existingKeys.length > 0 ? Math.max(...existingKeys) : 39) + 1);
  paletteMap[newIdx] = normalized;
  if (!customColorIndices.includes(newIdx)) customColorIndices.push(newIdx);
  return { index: newIdx, alreadyExists: false };
}

/**
 * Prepara un color en el slot primario o secundario reutilizando índice existente o asignando slot libre.
 * @param {Record<number, string>} paletteMap
 * @param {{ currentColorIndex: number, secondaryColorIndex?: number }} stateObj
 * @param {string} hex
 * @param {"primary"|"secondary"} [slot="primary"]
 * @returns {{ index: number, normalized: string, reused: boolean }}
 */
export function prepareFreeColorCore(paletteMap, stateObj, hex, slot = "primary") {
  const isSecondary = slot === "secondary";
  const normalized = String(hex || "").toLowerCase();
  for (const [idxStr, col] of Object.entries(paletteMap)) {
    const idx = Number(idxStr);
    if (idx !== FREE_BRUSH_IDX && idx !== FREE_SECONDARY_IDX && idx !== 0 && col?.toLowerCase() === normalized) {
      if (isSecondary) stateObj.secondaryColorIndex = idx;
      else stateObj.currentColorIndex = idx;
      return { index: idx, normalized, reused: true };
    }
  }
  const freeIdx = isSecondary ? FREE_SECONDARY_IDX : FREE_BRUSH_IDX;
  paletteMap[freeIdx] = normalized;
  if (isSecondary) stateObj.secondaryColorIndex = freeIdx;
  else stateObj.currentColorIndex = freeIdx;
  return { index: freeIdx, normalized, reused: false };
}

/**
 * Reemplaza todas las ocurrencias de `sourceIndex` por `targetIndex` en las grillas de capas.
 * @param {Array<{ grid?: number[][] }>} layers
 * @param {number} sourceIndex
 * @param {number} targetIndex
 */
export function replaceFreeBrushIndex(layers, sourceIndex, targetIndex) {
  for (const layer of layers) {
    if (!layer?.grid) continue;
    for (let y = 0; y < layer.grid.length; y++) {
      const row = layer.grid[y];
      if (!row) continue;
      for (let x = 0; x < row.length; x++) {
        if (row[x] === sourceIndex) row[x] = targetIndex;
      }
    }
  }
}

/**
 * Sincroniza colores usados en píxeles con `paletteMap` y `customColorIndices`, promoviendo slots libres usados
 * y purgando colores personalizados huérfanos no fijados manualmente.
 * @param {{
 *   layers: Array<{ grid?: number[][] }>,
 *   paletteMap: Record<number, string>,
 *   customColorIndices: number[],
 *   manualCustomIndices?: Set<number>,
 *   currentColorIndex?: number,
 *   secondaryColorIndex?: number,
 * }} ctx
 * @returns {{ changed: boolean, customColorIndices: number[], currentColorIndex?: number, secondaryColorIndex?: number }}
 */
export function syncCanvasColorsToPaletteCore(ctx) {
  const { layers, paletteMap, manualCustomIndices = new Set() } = ctx;
  let customColorIndices = ctx.customColorIndices;
  let currentColorIndex = ctx.currentColorIndex;
  let secondaryColorIndex = ctx.secondaryColorIndex;

  let freePrimaryUsed = false;
  let freeSecondaryUsed = false;
  const used = new Set();

  for (const layer of layers) {
    if (!layer?.grid) continue;
    for (const row of layer.grid) {
      if (!row) continue;
      for (const v of row) {
        if (!v) continue;
        if (v === FREE_BRUSH_IDX) freePrimaryUsed = true;
        else if (v === FREE_SECONDARY_IDX) freeSecondaryUsed = true;
        else used.add(v);
      }
    }
  }

  let changed = false;
  for (const [usedFlag, freeIdx, isSecondary] of [
    [freePrimaryUsed, FREE_BRUSH_IDX, false],
    [freeSecondaryUsed, FREE_SECONDARY_IDX, true],
  ]) {
    if (usedFlag && paletteMap[freeIdx]) {
      const { index } = registerColorCore(paletteMap, customColorIndices, paletteMap[freeIdx]);
      replaceFreeBrushIndex(layers, freeIdx, index);
      if (isSecondary && secondaryColorIndex === freeIdx) secondaryColorIndex = index;
      if (!isSecondary && currentColorIndex === freeIdx) currentColorIndex = index;
      used.add(index);
      delete paletteMap[freeIdx];
      changed = true;
    }
  }

  for (const idx of used) {
    if (paletteMap[idx] && idx >= 40 && !customColorIndices.includes(idx)) {
      customColorIndices.push(idx);
      changed = true;
    }
  }

  const beforeLen = customColorIndices.length;
  customColorIndices = customColorIndices.filter((idx) => {
    const keep = used.has(idx) || manualCustomIndices.has(idx);
    if (!keep) delete paletteMap[idx];
    return keep;
  });
  if (customColorIndices.length !== beforeLen) changed = true;

  return { changed, customColorIndices, currentColorIndex, secondaryColorIndex };
}

/**
 * Formatea un color `#rrggbb` + alpha (`0..255`) en `#rrggbb` o `#rrggbbaa`.
 * @param {string} [rgbHex="#ff0055"]
 * @param {number|string|null|undefined} [alphaValue=255]
 * @returns {string}
 */
export function formatPickerRgbaHex(rgbHex = "#ff0055", alphaValue = 255) {
  const rgb = (rgbHex || "#ff0055").toLowerCase();
  const hasAlpha = alphaValue !== null && alphaValue !== undefined && alphaValue !== "";
  const alpha = hasAlpha ? Math.max(0, Math.min(255, Math.round(Number(alphaValue)))) : 255;
  return alpha >= 255 ? rgb : rgb + alpha.toString(16).padStart(2, "0");
}
