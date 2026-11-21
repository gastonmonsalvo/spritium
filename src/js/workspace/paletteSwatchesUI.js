/**
 * paletteSwatchesUI.js: Renderizado de swatches activos/personalizados, menú contextual y chips de color 1°/2°.
 */

import { state, pushState, clonePaletteMap } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { syncTilemapLayerToGrid } from "../state/TilemapModel.js";
import { setStatus, refreshIcons } from "../ui/index.js";
import { i18n } from "../i18n/I18nService.js";
import { saveUserPalette } from "../core/palettes.js";

export const FREE_BRUSH_IDX = 9999;
export const manualCustomIndices = new Set();

function getRampLabel(idx) {
  if (idx === 1) return "Contorno";
  if (idx >= 2 && idx <= 8) return "Bronce/Tierra";
  if (idx >= 9 && idx <= 15) return "Acero/Sombra";
  if (idx >= 16 && idx <= 20) return "Azul/Cristal";
  if (idx >= 21 && idx <= 24) return "Hueso/Luz";
  if (idx >= 25 && idx <= 32) return "Piedra/Gris";
  return "Vegetación/Acento";
}

/** Sincroniza los cambios de la paleta activa si pertenece al catálogo del usuario. */
export function syncActiveUserPalette() {
  const key = state.currentThemeKey;
  if (!key || (!key.startsWith("user_") && !key.startsWith("custom_"))) return;
  const entry = state.themesCatalog[key];
  if (!entry) return;
  entry.colors = clonePaletteMap(state.paletteMap);
  saveUserPalette(key, entry);
  buildPaletteUI();
}

function purgeColorFromGrid(grid, idx, replacementIdx = 0) {
  if (!Array.isArray(grid)) return false;
  let touched = false;
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      if (row[x] === idx) {
        row[x] = replacementIdx;
        touched = true;
      }
    }
  }
  return touched;
}

function purgeColorFromLayers(idx, replacementIdx = 0) {
  const visited = new Set();
  const layersToClean = [];
  for (const frame of state.frames || []) {
    for (const l of frame?.layers || []) {
      if (l && !visited.has(l)) {
        visited.add(l);
        layersToClean.push(l);
      }
    }
  }
  for (const l of state.layers || []) {
    if (l && !visited.has(l)) {
      visited.add(l);
      layersToClean.push(l);
    }
  }
  if (layersToClean.length === 0 && state.grid) {
    purgeColorFromGrid(state.grid, idx, replacementIdx);
  }
  for (const ts of state.tilesets || []) {
    for (let i = 1; i < (ts?.tiles?.length || 0); i++) {
      if (ts.tiles[i]?.grid) purgeColorFromGrid(ts.tiles[i].grid, idx, replacementIdx);
    }
  }
  for (const layer of layersToClean) {
    if (layer.type === "tilemap") {
      syncTilemapLayerToGrid(layer);
    } else {
      if (layer.grid) purgeColorFromGrid(layer.grid, idx, replacementIdx);
      if (Array.isArray(layer.outOfBounds) && layer.outOfBounds.length) {
        if (replacementIdx === 0) {
          layer.outOfBounds = layer.outOfBounds.filter(([, , val]) => val !== idx);
        } else {
          for (const entry of layer.outOfBounds) {
            if (entry[2] === idx) entry[2] = replacementIdx;
          }
        }
      }
    }
  }
}

function replacePaletteColorAcrossProject(oldIdx, newIdx, oldHex) {
  if (oldIdx === newIdx || !state.paletteMap?.[newIdx]) return;
  pushState();
  purgeColorFromLayers(oldIdx, newIdx);
  const newHex = state.paletteMap[newIdx];
  state.isDirtySinceImport = true;
  renderAll();
  setStatus({ key: "log.swatch_replaced", params: { from: oldHex, to: newHex } });
}

function deletePaletteColorAndPixels(idx, hex) {
  pushState();
  manualCustomIndices.delete(idx);
  state.customColorIndices = state.customColorIndices.filter((i) => i !== idx);
  purgeColorFromLayers(idx);
  delete state.paletteMap[idx];
  const validKeys = Object.keys(state.paletteMap)
    .map(Number)
    .filter((k) => k > 0 && k !== FREE_BRUSH_IDX && Boolean(state.paletteMap[k]))
    .sort((a, b) => a - b);
  if (state.currentColorIndex === idx) {
    state.currentColorIndex = validKeys[0] ?? 0;
  }
  if (state.secondaryColorIndex === idx) {
    state.secondaryColorIndex = 0;
  }
  syncActiveUserPalette();
  highlightCurrentSwatch();
  renderAll();
  setStatus({ key: "log.free_deleted", params: { hex } });
}

function attachSwatchDeleteButton(swatch, idx, hex) {
  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "swatch-delete-btn";
  delBtn.textContent = "×";
  delBtn.title = i18n.t("title.swatch_delete");
  delBtn.setAttribute("aria-label", i18n.t("title.swatch_delete"));
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    deletePaletteColorAndPixels(idx, hex);
  });
  delBtn.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  swatch.appendChild(delBtn);
}

function openSwatchContextMenu(clientX, clientY, idx, hex) {
  const menu = document.getElementById("canvasContextMenu");
  if (!menu) return;

  const items = [
    { icon: "pipette", label: i18n.t("ctx.swatch_use_p1"), action: () => { state.currentColorIndex = idx; highlightCurrentSwatch(); setStatus({ key: "log.free_p1", params: { hex } }); } },
    { icon: "brush", label: i18n.t("ctx.swatch_use_p2"), action: () => { state.secondaryColorIndex = idx; highlightCurrentSwatch(); setStatus({ key: "log.free_p2", params: { hex } }); } },
    ...(state.currentColorIndex && state.currentColorIndex !== idx && state.paletteMap?.[state.currentColorIndex]
      ? [{
          icon: "replace",
          label: i18n.t("ctx.swatch_replace_p1", { hex: state.paletteMap[state.currentColorIndex] }),
          action: () => replacePaletteColorAcrossProject(idx, state.currentColorIndex, hex),
        }]
      : []),
    ...(state.secondaryColorIndex && state.secondaryColorIndex !== idx && state.paletteMap?.[state.secondaryColorIndex]
      ? [{
          icon: "replace",
          label: i18n.t("ctx.swatch_replace_p2", { hex: state.paletteMap[state.secondaryColorIndex] }),
          action: () => replacePaletteColorAcrossProject(idx, state.secondaryColorIndex, hex),
        }]
      : []),
    {
      icon: "x", label: i18n.t("ctx.swatch_remove_custom"),
      action: () => {
        manualCustomIndices.delete(idx);
        state.customColorIndices = state.customColorIndices.filter((i) => i !== idx);
        if (state.currentColorIndex === idx) state.currentColorIndex = 1;
        syncActiveUserPalette();
        highlightCurrentSwatch();
        setStatus({ key: "log.free_removed", params: { hex } });
      },
    },
    {
      icon: "trash-2", label: i18n.t("ctx.swatch_delete_all"),
      action: () => deletePaletteColorAndPixels(idx, hex),
    },
  ];

  menu.innerHTML = `<div class="ctx-header">${i18n.t("ctx.swatch_header", { hex })}</div>`;
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ctx-item";
    btn.innerHTML = `<i data-lucide="${item.icon}" class="ui-icon-sm"></i><span>${item.label}</span>`;
    btn.addEventListener("click", (ev) => { ev.stopPropagation(); menu.classList.remove("open"); item.action(); });
    menu.appendChild(btn);
  }
  menu.classList.add("open");
  refreshIcons(menu);
  menu.style.left = `${Math.min(clientX, window.innerWidth - (menu.offsetWidth || 200) - 8)}px`;
  menu.style.top = `${Math.min(clientY, window.innerHeight - (menu.offsetHeight || 130) - 8)}px`;
}

/** Renderiza los swatches de la paleta activa en `#palette-bar`. */
export function buildPaletteUI() {
  const bar = document.getElementById("palette-bar");
  if (!bar || !state.paletteMap) return;
  bar.innerHTML = "";
  const entries = Object.entries(state.paletteMap);
  const customSet = new Set(state.customColorIndices || []);
  const maxSwatches = 128;
  let rendered = 0;

  for (const [idxStr, hexColor] of entries) {
    const idx = Number(idxStr);
    if (idx === 0 || idx === FREE_BRUSH_IDX || customSet.has(idx) || !hexColor) continue;
    if (rendered >= maxSwatches) break;
    rendered++;

    const swatch = document.createElement("div");
    swatch.className = "color-swatch" + (idx === state.currentColorIndex ? " active" : "") + (idx === state.secondaryColorIndex ? " secondary-active" : "");
    swatch.style.backgroundColor = hexColor;
    const rampName = getRampLabel(idx);
    swatch.title = `[#${idx}] ${rampName} (${hexColor}) · Clic Izq: 1° | Clic Der: 2°`;
    swatch.addEventListener("click", () => { state.currentColorIndex = idx; highlightCurrentSwatch(); setStatus({ key: "log.swatch_p1", params: { idx, ramp: rampName, hex: hexColor } }); });
    swatch.addEventListener("contextmenu", (e) => { e.preventDefault(); state.secondaryColorIndex = idx; highlightCurrentSwatch(); setStatus({ key: "log.swatch_p2", params: { idx, ramp: rampName, hex: hexColor } }); });
    attachSwatchDeleteButton(swatch, idx, hexColor);
    bar.appendChild(swatch);
  }
  renderActiveColorsIndicator();

  const totalColors = entries.filter(([k, v]) => Number(k) !== 0 && v).length;
  if (totalColors > maxSwatches) {
    const note = document.createElement("div");
    note.style.cssText = "grid-column: 1 / -1; font-size: 10px; color: #a1a1aa; padding-top: 4px;";
    note.textContent = i18n.t("palette.trunc_note", { max: maxSwatches, total: totalColors });
    bar.appendChild(note);
  }
}

/** Renderiza la barra de muestras libres personalizadas. */
export function renderCustomPaletteUI() {
  const container = document.getElementById("custom-palette-bar");
  if (!container || !state.paletteMap) return;
  container.innerHTML = "";

  const validIndices = state.customColorIndices.filter((idx) => Boolean(state.paletteMap[idx]));
  if (validIndices.length === 0) {
    const empty = document.createElement("div");
    empty.className = "palette-empty-hint";
    empty.textContent = i18n.t("palette.no_custom_swatches");
    container.appendChild(empty);
    return;
  }

  for (const idx of validIndices) {
    const col = state.paletteMap[idx];
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.background = col;
    swatch.title = `Color Libre #${idx}: ${col} (Clic Der: opciones)`;
    if (state.currentColorIndex === idx) swatch.classList.add("active");
    if (state.secondaryColorIndex === idx) swatch.classList.add("secondary-active");
    swatch.onclick = () => { state.currentColorIndex = idx; highlightCurrentSwatch(); setStatus({ key: "log.free_sel", params: { hex: col } }); };
    swatch.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); openSwatchContextMenu(e.clientX, e.clientY, idx, col); });
    attachSwatchDeleteButton(swatch, idx, col);
    container.appendChild(swatch);
  }
}

/** Actualiza los chips visuales de color primario (1°) y secundario (2°). */
export function renderActiveColorsIndicator() {
  const pEl = document.getElementById("primaryColorPreview");
  const sEl = document.getElementById("secondaryColorPreview");
  if (pEl) {
    const pCol = state.paletteMap?.[state.currentColorIndex];
    pEl.classList.toggle("is-transparent", !pCol || state.currentColorIndex === 0);
    pEl.style.backgroundColor = pCol && state.currentColorIndex !== 0 ? pCol : "";
  }
  if (sEl) {
    const sIdx = state.secondaryColorIndex ?? 0;
    const sCol = sIdx !== 0 ? state.paletteMap?.[sIdx] : null;
    sEl.classList.toggle("is-transparent", !sCol);
    sEl.style.backgroundColor = sCol || "";
  }
}

/** Intercambia el color primario (1°) y secundario (2°) si el secundario no es transparente. */
export function swapPrimarySecondaryColors() {
  const prevPrimary = state.currentColorIndex;
  const prevSecondary = state.secondaryColorIndex ?? 0;
  if (prevSecondary === 0) { setStatus({ key: "log.swap_transparent" }, true); return; }
  state.currentColorIndex = prevSecondary;
  state.secondaryColorIndex = prevPrimary;
  highlightCurrentSwatch();
  setStatus({ key: "log.colors_swapped" });
}

/** Restablece el color secundario (clic derecho) a transparente (0). */
export function resetSecondaryColorToTransparent() {
  state.secondaryColorIndex = 0;
  highlightCurrentSwatch();
  setStatus({ key: "log.p2_reset" });
}

/** Resalta el swatch correspondiente al color activo. */
export function highlightCurrentSwatch() {
  document.querySelectorAll(".color-swatch").forEach((el) => el.classList.remove("active", "secondary-active"));
  buildPaletteUI();
  renderCustomPaletteUI();
  renderActiveColorsIndicator();
}
