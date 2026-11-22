/**
 * paletteManager.js: Fachada pública de gestión de paletas y registro de colores libres en el lienzo.
 */

import { state } from "../core/state.js";
import { setStatus, openCustomRgbaPopover } from "../ui/index.js";
import {
  FREE_BRUSH_IDX,
  FREE_SECONDARY_IDX,
  manualCustomIndices,
  syncActiveUserPalette,
  renderCustomPaletteUI,
  renderActiveColorsIndicator,
  highlightCurrentSwatch,
  buildPaletteUI,
  swapPrimarySecondaryColors,
  resetSecondaryColorToTransparent,
} from "./paletteSwatchesUI.js";
import {
  getPaletteDisplayName,
  getPaletteDisplayDesc,
  populatePaletteSelectOptions,
  populateThemeSelect,
  syncThemeSelectValue,
  applyTheme,
} from "./paletteThemeService.js";

export {
  manualCustomIndices,
  getPaletteDisplayName,
  getPaletteDisplayDesc,
  populatePaletteSelectOptions,
  populateThemeSelect,
  syncThemeSelectValue,
  applyTheme,
  buildPaletteUI,
  renderCustomPaletteUI,
  renderActiveColorsIndicator,
  swapPrimarySecondaryColors,
  resetSecondaryColorToTransparent,
  highlightCurrentSwatch,
};

/** Registra un color HEX/RGBA en `state.paletteMap` reutilizando su índice si ya existe. */
export function registerColor(hex) {
  const normalized = hex.toLowerCase();
  for (const [idxStr, col] of Object.entries(state.paletteMap)) {
    const idx = Number(idxStr);
    if (idx !== FREE_BRUSH_IDX && idx !== FREE_SECONDARY_IDX && idx !== 0 && col?.toLowerCase() === normalized) {
      return { index: idx, alreadyExists: true };
    }
  }
  const existingKeys = Object.keys(state.paletteMap)
    .map(Number)
    .filter((k) => k !== FREE_BRUSH_IDX && k !== FREE_SECONDARY_IDX);
  const newIdx = Math.max(40, (existingKeys.length > 0 ? Math.max(...existingKeys) : 39) + 1);
  state.paletteMap[newIdx] = normalized;
  if (!state.customColorIndices.includes(newIdx)) state.customColorIndices.push(newIdx);
  syncActiveUserPalette();
  renderCustomPaletteUI();
  return { index: newIdx, alreadyExists: false };
}

/**
 * Abre el selector RGBA/HSLA flotante para editar directamente el color 1° o 2° desde los chips inferiores.
 * @param {"primary"|"secondary"} slot - Slot de color a editar.
 */
export function openSlotColorPicker(slot = "primary") {
  const isSecondary = slot === "secondary";
  const anchorEl = document.getElementById(isSecondary ? "secondaryColorPreview" : "primaryColorPreview");
  if (!anchorEl) return;
  const curIdx = isSecondary ? (state.secondaryColorIndex ?? 0) : state.currentColorIndex;
  const initialHex = (curIdx && state.paletteMap?.[curIdx]) || "#ff0055";
  openCustomRgbaPopover(anchorEl, initialHex, (rgbaHex) => {
    prepareFreeColor(rgbaHex, isSecondary ? "secondary" : "primary");
    highlightCurrentSwatch();
  });
}

/** Prepara el color libre para pintar SIN agregarlo a Personalizados hasta pintar o presionar + Muestra. */
export function prepareFreeColor(hex, slot = "primary") {
  const isSecondary = slot === "secondary";
  const normalized = hex.toLowerCase();
  for (const [idxStr, col] of Object.entries(state.paletteMap)) {
    const idx = Number(idxStr);
    if (idx !== FREE_BRUSH_IDX && idx !== FREE_SECONDARY_IDX && idx !== 0 && col?.toLowerCase() === normalized) {
      if (isSecondary) state.secondaryColorIndex = idx;
      else state.currentColorIndex = idx;
      highlightCurrentSwatch();
      setStatus({ key: "log.color_active", params: { hex: normalized } });
      return;
    }
  }
  const freeIdx = isSecondary ? FREE_SECONDARY_IDX : FREE_BRUSH_IDX;
  state.paletteMap[freeIdx] = normalized;
  if (isSecondary) state.secondaryColorIndex = freeIdx;
  else state.currentColorIndex = freeIdx;
  renderActiveColorsIndicator();
  setStatus({ key: "log.free_ready", params: { hex: normalized } });
}

function replaceFreeBrushIndex(layers, sourceIndex, targetIndex) {
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

/** Asegura que todo color usado en píxeles del lienzo esté visible en la paleta activa / personalizados. */
export function syncCanvasColorsToPalette() {
  const layers = state.layers?.length ? state.layers : [{ grid: state.grid }];
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
  for (const [usedFlag, freeIdx, slotKey] of [
    [freePrimaryUsed, FREE_BRUSH_IDX, "currentColorIndex"],
    [freeSecondaryUsed, FREE_SECONDARY_IDX, "secondaryColorIndex"],
  ]) {
    if (usedFlag && state.paletteMap[freeIdx]) {
      const { index } = registerColor(state.paletteMap[freeIdx]);
      replaceFreeBrushIndex(layers, freeIdx, index);
      if (state[slotKey] === freeIdx) state[slotKey] = index;
      used.add(index);
      delete state.paletteMap[freeIdx];
      changed = true;
    }
  }

  for (const idx of used) {
    if (state.paletteMap[idx] && idx >= 40 && !state.customColorIndices.includes(idx)) {
      state.customColorIndices.push(idx);
      changed = true;
    }
  }

  const beforeLen = state.customColorIndices.length;
  state.customColorIndices = state.customColorIndices.filter((idx) => {
    const keep = used.has(idx) || manualCustomIndices.has(idx);
    if (!keep) delete state.paletteMap[idx];
    return keep;
  });
  if (state.customColorIndices.length !== beforeLen) changed = true;

  if (changed) {
    syncActiveUserPalette();
    renderCustomPaletteUI();
    highlightCurrentSwatch();
  }
}

/** Prepara el color del selector libre para pintar sin duplicarlo en Personalizados. */
export function getActivePickerRgbaHex() {
  const picker = document.getElementById("customColorPicker");
  const alphaInput = document.getElementById("colorAlphaInput");
  const rgbHex = (picker?.value || "#ff0055").toLowerCase();
  const alpha = alphaInput ? Math.max(0, Math.min(255, Math.round(Number(alphaInput.value)))) : 255;
  return alpha >= 255 ? rgbHex : rgbHex + alpha.toString(16).padStart(2, "0");
}

/** Toma el color RGBA actual del selector libre y lo prepara como color activo. */
export function useCustomColor() {
  prepareFreeColor(getActivePickerRgbaHex());
}
