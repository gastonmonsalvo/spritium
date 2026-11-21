/**
 * paletteIO.js: Reducción perceptual OKLab, importación/exportación de paletas (.hex/.gpl) y mezclador RGBA.
 */

import { state, pushState, cloneGrid, clonePaletteMap, setGridSize } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { quantizeGrid, hasPaintedPixels, parseColorToRgb, rgbToHsl, hslToRgb } from "../core/color.js";
import { requestReduceColors } from "../core/api.js";
import { setStatus, updateResolutionButtons, syncWheelFromHex, initRgbaColorPicker, syncRgbaPickerPreview } from "../ui/index.js";
import { resetLayersWithGrid, syncActiveLayerGrid } from "./layers.js";
import { resetFramesWithCurrentLayers, syncActiveFrame } from "./frames.js";
import { syncAllTilemapLayers, renderTilesetPanelUI } from "./tilemap.js";
import { parsePaletteFileContent, serializePaletteToHex, serializePaletteToGpl, saveUserPalette } from "../core/palettes.js";
import {
  populateThemeSelect,
  syncThemeSelectValue,
  getPaletteDisplayName,
  applyTheme,
  buildPaletteUI,
  renderCustomPaletteUI,
  prepareFreeColor,
  getActivePickerRgbaHex,
  highlightCurrentSwatch,
  registerColor,
  manualCustomIndices,
} from "./paletteManager.js";

/**
 * Reduce la paleta del sprite a N colores propios mediante cuantización OKLab.
 */
export async function reduceCurrentPaletteColors(maxColorsArg = null) {
  const sel = document.getElementById("reduceColorCountSelect");
  const resolvedArg = typeof maxColorsArg === "number" && Number.isFinite(maxColorsArg) ? maxColorsArg : null;
  const maxColors = Number(resolvedArg || sel?.value || 32) || 32;

  if (!hasPaintedPixels(state.grid)) {
    setStatus({ key: "log.reduce_no_pixels" }, true);
    return;
  }

  setStatus({ key: "log.reduce_extracting", params: { max: maxColors } });
  try {
    const useOriginalSource =
      !state.isDirtySinceImport &&
      state.originalImport &&
      state.originalImport.size === state.gridSize;
    const srcGrid = useOriginalSource ? state.originalImport.grid : state.grid;
    const srcPalette = useOriginalSource
      ? state.originalImport.paletteMap
      : state.paletteMap;

    const data = await requestReduceColors(
      srcGrid,
      srcPalette,
      maxColors,
      state.ditherEnabled,
    );

    pushState();
    syncActiveFrame();
    const oldPalette = clonePaletteMap(state.paletteMap);
    const activeF = state.activeFrameIndex;
    const activeL = state.activeLayerIndex;

    for (let fi = 0; fi < state.frames.length; fi++) {
      const frame = state.frames[fi];
      for (let li = 0; li < frame.layers.length; li++) {
        const layer = frame.layers[li];
        if (fi === activeF && li === activeL) {
          layer.grid = data.grid;
        } else if (layer.grid) {
          const remapped = quantizeGrid(layer.grid, oldPalette, data.palette, {
            dither: state.ditherEnabled,
          });
          layer.grid = remapped.grid;
        }
      }
    }

    for (const ts of state.tilesets || []) {
      for (let i = 1; i < (ts.tiles?.length || 0); i++) {
        if (ts.tiles[i]?.grid) {
          const tRes = quantizeGrid(ts.tiles[i].grid, oldPalette, data.palette, {
            dither: state.ditherEnabled,
          });
          ts.tiles[i].grid = tRes.grid;
        }
      }
    }

    state.layers = state.frames[activeF].layers;
    syncActiveLayerGrid();
    state.paletteMap = data.palette;
    state.hasCustomReducedPalette = true;
    state.currentThemeKey = "original";
    syncAllTilemapLayers();
    renderTilesetPanelUI();
    state.customColorIndices = [];
    state.currentColorIndex = data.palette[2] ? 2 : 1;

    buildPaletteUI();
    renderCustomPaletteUI();
    renderAll();

    const finalCount = Object.keys(data.palette).filter((k) => Number(k) !== 0).length;
    setStatus({ key: "log.reduce_done", params: { count: finalCount } });
  } catch (err) {
    setStatus({ key: "log.reduce_err", params: { msg: err.message } }, true);
  }
}

/**
 * Agrega el color libre actual a las muestras personalizadas (evitando duplicados).
 */
export function addCustomToPalette() {
  const rgbaHex = getActivePickerRgbaHex();
  const { index, alreadyExists } = registerColor(rgbaHex);
  if (index >= 40) manualCustomIndices.add(index);
  state.currentColorIndex = index;
  highlightCurrentSwatch();
  setStatus(
    alreadyExists
      ? { key: "log.swatch_exists", params: { hex: rgbaHex, idx: index } }
      : { key: "log.swatch_added", params: { hex: rgbaHex } },
  );
}

/**
 * Importa un archivo de paleta (.hex, .gpl, .pal, .json) y lo guarda en el catálogo.
 * @param {File} file
 */
export async function importPaletteFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const { name, colors } = parsePaletteFileContent(file.name, text);
    const key = `custom_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now().toString(36).slice(-4)}`;
    const entry = {
      name,
      desc: "Paleta importada por el usuario",
      colors,
    };
    state.themesCatalog[key] = entry;
    saveUserPalette(key, entry);
    populateThemeSelect();
    applyTheme(key, { recordHistory: true });
    setStatus({ key: "log.pal_imported", params: { name, count: Object.keys(colors).length - 1 } });
  } catch (err) {
    setStatus({ key: "log.pal_import_err", params: { msg: err.message } }, true);
  }
}

/**
 * Exporta la paleta activa a formato .hex o .gpl.
 * @param {string} [format="hex"]
 */
export function exportCurrentPalette(format = "hex") {
  const activeEntry = state.themesCatalog[state.currentThemeKey];
  const activeName =
    (activeEntry ? getPaletteDisplayName(state.currentThemeKey, activeEntry) : "") ||
    document.getElementById("assetName")?.value ||
    "spritium_palette";
  const slug = activeName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "palette";

  const isGpl = format === "gpl";
  const content = isGpl
    ? serializePaletteToGpl(activeName, state.paletteMap)
    : serializePaletteToHex(state.paletteMap);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${slug}.${isGpl ? "gpl" : "hex"}`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus({ key: "log.pal_exported", params: { ext: isGpl ? "gpl" : "hex" } });
}

/**
 * Abre el modal para crear una nueva paleta personalizada (similar al modal de Tag).
 * @param {Object} [options]
 * @param {boolean} [options.empty=false]
 */
export function createNewCustomPalette({ empty = false } = {}) {
  const modal = document.getElementById("newPaletteModal");
  if (!modal) return;
  const nameEl = document.getElementById("newPaletteNameInput");
  const modeEl = document.getElementById("newPaletteModeSelect");
  if (nameEl) nameEl.value = empty ? "Mi Paleta Nueva" : "Mi Paleta";
  if (modeEl) modeEl.value = empty ? "canvas" : "copy";
  modal.classList.add("open");
  nameEl?.focus();
  nameEl?.select();
}

/**
 * Cierra el modal de nueva paleta y restaura la selección del selector de temas si se canceló.
 */
export function closeNewPaletteModal() {
  document.getElementById("newPaletteModal")?.classList.remove("open");
  syncThemeSelectValue();
}

/**
 * Valida los campos del modal `#newPaletteModal` y crea/guarda la nueva paleta personalizada.
 */
export function confirmCreateNewPalette() {
  const rawName = document.getElementById("newPaletteNameInput")?.value || "";
  const cleanName = rawName.trim();
  if (!cleanName) {
    setStatus({ key: "log.pal_name_req" }, true);
    return;
  }
  const empty = (document.getElementById("newPaletteModeSelect")?.value || "copy") === "canvas";
  const key = `user_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now().toString(36).slice(-4)}`;

  let colors;
  if (empty) {
    // Sembrar solo con los colores actualmente pintados en el lienzo (si hay) para no perder píxeles
    colors = { 0: null };
    const layers = state.layers?.length ? state.layers : [{ grid: state.grid }];
    const usedHex = [];
    for (const layer of layers) {
      if (!layer?.grid) continue;
      for (const row of layer.grid) {
        if (!row) continue;
        for (const v of row) {
          if (v && v !== 0 && state.paletteMap[v]) {
            const hex = state.paletteMap[v].toLowerCase();
            if (!usedHex.includes(hex)) usedHex.push(hex);
          }
        }
      }
    }
    usedHex.forEach((hex, i) => {
      colors[i + 1] = hex;
    });
  } else {
    colors = clonePaletteMap(state.paletteMap);
  }

  const entry = {
    name: cleanName,
    desc: "Paleta personalizada guardada",
    colors,
  };
  state.themesCatalog[key] = entry;
  saveUserPalette(key, entry);
  populateThemeSelect();
  if (empty) {
    applyTheme(key, { recordHistory: true });
  } else {
    state.currentThemeKey = key;
    syncThemeSelectValue();
  }
  document.getElementById("newPaletteModal")?.classList.remove("open");
  setStatus({ key: "log.pal_created", params: { name: cleanName } });
}

function rgbArrayToHex(r, g, b) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Inicializa el selector de color libre y el campo HEX sincronizados.
 */
export function setupColorMixer() {
  const picker = document.getElementById("customColorPicker");
  const hexInput = document.getElementById("hexColorInput");
  const alphaInput = document.getElementById("colorAlphaInput");
  const alphaVal = document.getElementById("colorAlphaVal");
  if (!picker) return;

  const syncAlphaLabel = () => {
    if (!alphaInput || !alphaVal) return;
    const a = Math.max(0, Math.min(255, Number(alphaInput.value)));
    alphaVal.textContent = `${Math.round((a / 255) * 100)}%`;
  };

  const syncHex = (rgbaHex) => {
    if (hexInput && document.activeElement !== hexInput) {
      hexInput.value = rgbaHex.toUpperCase();
    }
  };

  const applyFromControls = () => {
    syncAlphaLabel();
    const rgbaHex = getActivePickerRgbaHex();
    syncHex(rgbaHex);
    syncWheelFromHex(rgbaHex);
    syncRgbaPickerPreview(rgbaHex);
    prepareFreeColor(rgbaHex);
  };

  initRgbaColorPicker({
    initialRgbaHex: getActivePickerRgbaHex(),
    onChange: (rgbaHex) => {
      syncAlphaLabel();
      syncHex(rgbaHex);
      syncWheelFromHex(rgbaHex);
      prepareFreeColor(rgbaHex);
    },
  });

  picker.addEventListener("input", applyFromControls);
  picker.addEventListener("change", applyFromControls);
  alphaInput?.addEventListener("input", applyFromControls);
  alphaInput?.addEventListener("change", applyFromControls);

  hexInput?.addEventListener("change", () => {
    const raw = hexInput.value.trim();
    const norm = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{6}$/.test(norm)) {
      picker.value = norm.toLowerCase();
      if (alphaInput) alphaInput.value = "255";
      syncAlphaLabel();
      const full = getActivePickerRgbaHex();
      syncHex(full);
      syncWheelFromHex(full);
      syncRgbaPickerPreview(full);
      prepareFreeColor(full);
    } else if (/^#[0-9a-fA-F]{8}$/.test(norm)) {
      picker.value = norm.slice(0, 7).toLowerCase();
      if (alphaInput) alphaInput.value = String(parseInt(norm.slice(7, 9), 16));
      syncAlphaLabel();
      const full = getActivePickerRgbaHex();
      syncHex(full);
      syncWheelFromHex(full);
      syncRgbaPickerPreview(full);
      prepareFreeColor(full);
    } else {
      syncHex(getActivePickerRgbaHex());
    }
  });

  syncAlphaLabel();
  syncHex(getActivePickerRgbaHex());
}

