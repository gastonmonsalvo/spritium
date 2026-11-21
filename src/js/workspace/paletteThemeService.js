/**
 * paletteThemeService.js: Catálogo i18n de paletas, selectores y cuantización perceptual OKLab.
 */

import { state, pushState, cloneGrid, clonePaletteMap, setGridSize } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { quantizeGrid, hasPaintedPixels } from "../core/color.js";
import { setStatus, updateResolutionButtons } from "../ui/index.js";
import { i18n } from "../i18n/I18nService.js";
import { resetLayersWithGrid, syncActiveLayerGrid } from "./layers.js";
import { resetFramesWithCurrentLayers, syncActiveFrame } from "./frames.js";
import { syncAllTilemapLayers, renderTilesetPanelUI } from "./tilemap.js";
import { buildPaletteUI, renderCustomPaletteUI } from "./paletteSwatchesUI.js";

if (typeof window !== "undefined") {
  i18n.addEventListener("langchange", () => populateThemeSelect());
}

/** Resuelve el nombre visible de una paleta/tema usando i18n primero y cayendo en `entry.name` o la clave. */
export function getPaletteDisplayName(key, entry = state.themesCatalog?.[key]) {
  if (!key) return "";
  if (key === "original") return i18n.t("palette.original");
  const nameKey = `palette.${key}.name`;
  const trName = i18n.t(nameKey);
  return trName !== nameKey ? trName : (entry?.name || key);
}

/** Resuelve la descripción visible de una paleta/tema usando i18n o `entry.desc`. */
export function getPaletteDisplayDesc(key, entry = state.themesCatalog?.[key]) {
  if (!key) return "";
  const descKey = `palette.${key}.desc`;
  const trDesc = i18n.t(descKey);
  return trDesc !== descKey ? trDesc : (entry?.desc || "");
}

/** Puebla un `<select>` con las paletas del catálogo usando nombres y descripciones estandarizadas. */
export function populatePaletteSelectOptions(sel, { includeOriginal = false, includeNew = false, selectedValue } = {}) {
  if (!sel || !state.themesCatalog) return;
  sel.innerHTML = "";
  if (includeOriginal) {
    const origOpt = document.createElement("option");
    origOpt.value = "original";
    origOpt.textContent = i18n.t("palette.original");
    sel.appendChild(origOpt);
  }
  Object.entries(state.themesCatalog).forEach(([key, val]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = getPaletteDisplayName(key, val);
    const desc = getPaletteDisplayDesc(key, val);
    if (desc) opt.title = desc;
    sel.appendChild(opt);
  });
  if (includeNew) {
    const newOpt = document.createElement("option");
    newOpt.value = "__new_palette__";
    newOpt.textContent = i18n.t("palette.new");
    sel.appendChild(newOpt);
  }
  if (selectedValue !== undefined) sel.value = selectedValue;
}

/** Puebla el selector de paletas del editor con el catálogo y la opción de crear nueva. */
export function populateThemeSelect() {
  const sel = document.getElementById("themeSelect");
  if (!sel) return;
  populatePaletteSelectOptions(sel, { includeOriginal: Boolean(state.originalImport), includeNew: true, selectedValue: state.currentThemeKey });
}

/** Sincroniza el valor seleccionado en el dropdown de paletas con state.currentThemeKey. */
export function syncThemeSelectValue() {
  const sel = document.getElementById("themeSelect");
  if (sel && sel.value !== state.currentThemeKey) sel.value = state.currentThemeKey;
}

function restoreOriginalImport(recordHistory) {
  if (!state.originalImport) { setStatus({ key: "log.orig_none" }, true); return; }
  if (recordHistory) pushState();
  const origW = state.originalImport.width || state.originalImport.size || 64;
  const origH = state.originalImport.height || state.originalImport.size || origW;
  setGridSize(origW, origH);
  resetLayersWithGrid(cloneGrid(state.originalImport.grid), "Base");
  resetFramesWithCurrentLayers();
  state.paletteMap = clonePaletteMap(state.originalImport.paletteMap);
  state.currentThemeKey = "original";
  state.currentColorIndex = 1;
  state.isDirtySinceImport = false;
  updateResolutionButtons(origW, origH);
  syncThemeSelectValue();
  buildPaletteUI();
  renderCustomPaletteUI();
  renderAll();
  setStatus({ key: "status.original_restored" });
}

function quantizeAllFramesAndTiles(targetColors) {
  let quantizedPalette = { 0: null, ...clonePaletteMap(targetColors) };
  const useOriginal = !state.isDirtySinceImport && state.layers.length === 1 && state.originalImport && state.originalImport.size === state.gridSize;
  if (useOriginal) {
    const res = quantizeGrid(state.originalImport.grid, state.originalImport.paletteMap, targetColors, { dither: state.ditherEnabled });
    state.layers[0].grid = res.grid;
    return res.paletteMap;
  }
  syncActiveFrame();
  for (const frame of state.frames) {
    for (const layer of frame.layers) {
      const res = quantizeGrid(layer.grid, state.paletteMap, targetColors, { dither: state.ditherEnabled });
      layer.grid = res.grid;
      quantizedPalette = res.paletteMap;
    }
  }
  for (const ts of state.tilesets || []) {
    for (let i = 1; i < (ts.tiles?.length || 0); i++) {
      if (ts.tiles[i]?.grid) ts.tiles[i].grid = quantizeGrid(ts.tiles[i].grid, state.paletteMap, targetColors, { dither: state.ditherEnabled }).grid;
    }
  }
  return quantizedPalette;
}

/** Aplica una paleta/bioma sobre el lienzo actual con cuantización perceptual OKLab no destructiva. */
export function applyTheme(themeKey, { recordHistory = true } = {}) {
  if (themeKey === "original") { restoreOriginalImport(recordHistory); return; }
  const theme = state.themesCatalog[themeKey];
  if (!theme) return;
  const targetColors = theme.colors || theme.palette || {};
  const hasPixels = state.layers.some((l) => hasPaintedPixels(l.grid));

  if (hasPixels) {
    if (recordHistory) pushState();
    const quantizedPalette = quantizeAllFramesAndTiles(targetColors);
    syncActiveLayerGrid();
    state.paletteMap = quantizedPalette;
    syncAllTilemapLayers();
    renderTilesetPanelUI();
    state.currentThemeKey = themeKey;
    state.currentColorIndex = quantizedPalette[2] ? 2 : 1;
    state.customColorIndices = [];
    const count = Object.keys(quantizedPalette).filter((k) => Number(k) !== 0).length;
    setStatus({
      key: "status.palette_applied_dither",
      params: { paletteKey: themeKey, name: getPaletteDisplayName(themeKey, theme), count, dither: state.ditherEnabled ? " + Bayer 4x4" : "" },
    });
  } else {
    state.currentThemeKey = themeKey;
    state.paletteMap = { 0: null, ...clonePaletteMap(targetColors) };
    state.currentColorIndex = state.paletteMap[2] ? 2 : 1;
    setStatus({ key: "status.palette_applied", params: { paletteKey: themeKey, name: getPaletteDisplayName(themeKey, theme) } });
  }

  syncThemeSelectValue();
  buildPaletteUI();
  renderCustomPaletteUI();
  renderAll();
}
