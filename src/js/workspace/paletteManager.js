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
  registerColorCore,
  prepareFreeColorCore,
  syncCanvasColorsToPaletteCore,
  formatPickerRgbaHex,
} from "./paletteCore.js";
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
  const result = registerColorCore(state.paletteMap, state.customColorIndices, hex);
  if (!result.alreadyExists) {
    syncActiveUserPalette();
    renderCustomPaletteUI();
  }
  return result;
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
  const { normalized, reused } = prepareFreeColorCore(state.paletteMap, state, hex, slot);
  if (reused) {
    highlightCurrentSwatch();
    setStatus({ key: "log.color_active", params: { hex: normalized } });
    return;
  }
  renderActiveColorsIndicator();
  setStatus({ key: "log.free_ready", params: { hex: normalized } });
}

/** Asegura que todo color usado en píxeles del lienzo esté visible en la paleta activa / personalizados. */
export function syncCanvasColorsToPalette() {
  const layers = state.layers?.length ? state.layers : [{ grid: state.grid }];
  const res = syncCanvasColorsToPaletteCore({
    layers,
    paletteMap: state.paletteMap,
    customColorIndices: state.customColorIndices,
    manualCustomIndices,
    currentColorIndex: state.currentColorIndex,
    secondaryColorIndex: state.secondaryColorIndex,
  });
  state.customColorIndices = res.customColorIndices;
  state.currentColorIndex = res.currentColorIndex;
  state.secondaryColorIndex = res.secondaryColorIndex;

  if (res.changed) {
    syncActiveUserPalette();
    renderCustomPaletteUI();
    highlightCurrentSwatch();
  }
}

/** Prepara el color del selector libre para pintar sin duplicarlo en Personalizados. */
export function getActivePickerRgbaHex() {
  const picker = document.getElementById("customColorPicker");
  const alphaInput = document.getElementById("colorAlphaInput");
  return formatPickerRgbaHex(picker?.value, alphaInput ? alphaInput.value : 255);
}

/** Toma el color RGBA actual del selector libre y lo prepara como color activo. */
export function useCustomColor() {
  prepareFreeColor(getActivePickerRgbaHex());
}
