// @ts-check
/**
 * HslModal.js: Modal y controlador del ajuste de Tono, Saturación y Brillo (HSL) con vista previa en vivo.
 */

import { state, cloneGrid, clonePaletteMap, pushLayerState, getGridDims } from "../../core/state.js";
import { parseColorToRgb } from "../../core/color.js";
import { renderAll } from "../../canvas/canvas.js";
import { applyHslToRegion } from "../../tools/tools.js";
import { isActiveLayerLocked } from "../../workspace/layers.js";
import { buildPaletteUI, renderCustomPaletteUI } from "../../workspace/paletteManager.js";
import { reconcileActiveTilemapLayer } from "../../workspace/tilemap.js";
import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml } from "../components/uiHtml.js";
import { setStatus, refreshIcons } from "../status.js";

/** @type {number[][] | null} */
let hslBaseGrid = null;
/** @type {Record<number, string | null> | null} */
let hslBasePalette = null;
/** @type {number[] | null} */
let hslBaseCustomIndices = null;
let listenersBound = false;

function readHslOptions() {
  const num = (id, def) => {
    const el = /** @type {HTMLInputElement | null} */ (document.getElementById(id));
    return el ? Number(el.value) : def;
  };
  const chk = /** @type {HTMLInputElement | null} */ (document.getElementById("chkHslSnapPalette"));
  return {
    hueShift: num("hslHueRange", 0),
    satShift: num("hslSatRange", 0),
    lightShift: num("hslLightRange", 0),
    snapToPalette: chk ? chk.checked : false,
  };
}

function restoreBaseState() {
  if (!hslBaseGrid || !hslBasePalette) return;
  const { w, h } = getGridDims();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      state.grid[y][x] = hslBaseGrid[y]?.[x] ?? 0;
    }
  }
  state.paletteMap = clonePaletteMap(hslBasePalette);
  state.customColorIndices = [...(hslBaseCustomIndices || [])];
}

function renderHslPreviewCanvas() {
  const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById("hslPreviewCanvas"));
  if (!canvas) return;
  const { w, h } = getGridDims();
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = state.grid[y]?.[x] || 0;
      if (!idx) continue;
      const rgb = parseColorToRgb(state.paletteMap[idx]);
      if (!rgb) continue;
      const o = (y * w + x) * 4;
      img.data[o] = rgb[0];
      img.data[o + 1] = rgb[1];
      img.data[o + 2] = rgb[2];
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function previewHslOnCanvas() {
  if (!hslBaseGrid) return;
  restoreBaseState();
  const opts = readHslOptions();
  const hVal = document.getElementById("hslHueVal");
  if (hVal) hVal.textContent = `${opts.hueShift > 0 ? "+" : ""}${opts.hueShift}°`;
  const sVal = document.getElementById("hslSatVal");
  if (sVal) sVal.textContent = `${opts.satShift > 0 ? "+" : ""}${opts.satShift}%`;
  const lVal = document.getElementById("hslLightVal");
  if (lVal) lVal.textContent = `${opts.lightShift > 0 ? "+" : ""}${opts.lightShift}%`;
  applyHslToRegion(opts);
  renderHslPreviewCanvas();
  renderAll();
}

function bindHslInputs() {
  if (listenersBound) return;
  listenersBound = true;
  for (const id of ["hslHueRange", "hslSatRange", "hslLightRange", "chkHslSnapPalette"]) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("input", previewHslOnCanvas);
    el.addEventListener("change", previewHslOnCanvas);
  }
}

/**
 * Abre el modal de ajuste HSL con vista previa en vivo sobre la capa o selección activa.
 */
export function openHslModal() {
  if (isActiveLayerLocked()) {
    setStatus({ key: "log.layer_locked" }, true);
    return;
  }
  const modal = document.getElementById("hslFilterModal");
  if (!modal) return;
  hslBaseGrid = cloneGrid(state.grid);
  hslBasePalette = clonePaletteMap(state.paletteMap);
  hslBaseCustomIndices = [...(state.customColorIndices || [])];
  bindHslInputs();
  resetHslModal();
  modal.classList.add("open");
  refreshIcons(modal);
}

/**
 * Restablece los deslizadores HSL a cero sin cerrar el modal.
 */
export function resetHslModal() {
  for (const id of ["hslHueRange", "hslSatRange", "hslLightRange"]) {
    const el = /** @type {HTMLInputElement | null} */ (document.getElementById(id));
    if (el) el.value = "0";
  }
  previewHslOnCanvas();
}

/**
 * Cierra el modal de ajuste HSL restaurando la capa original si no se confirmó.
 */
export function closeHslModal() {
  const modal = document.getElementById("hslFilterModal");
  if (hslBaseGrid) {
    restoreBaseState();
    hslBaseGrid = null;
    hslBasePalette = null;
    hslBaseCustomIndices = null;
    renderAll();
  }
  modal?.classList.remove("open");
}

/**
 * Aplica el ajuste HSL actual registrando un paso limpio en el historial Undo/Redo.
 */
export function applyHslModal() {
  if (!hslBaseGrid) {
    closeHslModal();
    return;
  }
  const opts = readHslOptions();
  restoreBaseState();
  pushLayerState();
  const changed = applyHslToRegion(opts);
  hslBaseGrid = null;
  hslBasePalette = null;
  hslBaseCustomIndices = null;
  document.getElementById("hslFilterModal")?.classList.remove("open");
  if (changed) {
    buildPaletteUI();
    renderCustomPaletteUI();
    reconcileActiveTilemapLayer("auto");
    setStatus({ key: "status.hsl_applied" }, false, "pixel");
  }
  renderAll();
}

/**
 * Genera el HTML del modal de ajuste HSL (`#hslFilterModal`).
 * @returns {string}
 */
export function renderHslModal() {
  return `
    <div id="hslFilterModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="hslModalTitle" data-backdrop-close="closeHslModal">
      <div class="modal-card import-modal-card">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px">
            <i data-lucide="palette" class="ui-icon-sm" style="color: var(--accent-secondary)"></i>
            <h3 id="hslModalTitle" data-i18n="modal.hsl.title">${escapeHtml(i18n.t("modal.hsl.title"))}</h3>
          </div>
          <button type="button" class="tool-btn" data-action="closeHslModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>

        <div class="import-modal-body">
          <div class="import-modal-controls">
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px">
                <label for="hslHueRange" style="margin: 0" data-i18n="modal.hsl.hue">${escapeHtml(i18n.t("modal.hsl.hue"))}</label>
                <span id="hslHueVal" style="font-family: var(--font-mono); color: var(--accent-secondary)">0°</span>
              </div>
              <input type="range" id="hslHueRange" min="-180" max="180" step="5" value="0" />
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px">
                <label for="hslSatRange" style="margin: 0" data-i18n="modal.hsl.sat">${escapeHtml(i18n.t("modal.hsl.sat"))}</label>
                <span id="hslSatVal" style="font-family: var(--font-mono); color: var(--accent-secondary)">0%</span>
              </div>
              <input type="range" id="hslSatRange" min="-100" max="100" step="5" value="0" />
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px">
                <label for="hslLightRange" style="margin: 0" data-i18n="modal.hsl.light">${escapeHtml(i18n.t("modal.hsl.light"))}</label>
                <span id="hslLightVal" style="font-family: var(--font-mono); color: var(--accent-secondary)">0%</span>
              </div>
              <input type="range" id="hslLightRange" min="-100" max="100" step="5" value="0" />
            </div>

            <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; font-size: 12px">
              <input type="checkbox" id="chkHslSnapPalette" />
              <span data-i18n="modal.hsl.snap_palette">${escapeHtml(i18n.t("modal.hsl.snap_palette"))}</span>
            </label>
          </div>

          <div class="import-preview-panel">
            <div class="import-preview-header">
              <span data-i18n="modal.shadow.preview">${escapeHtml(i18n.t("modal.shadow.preview"))}</span>
            </div>
            <div class="import-preview-stage">
              <canvas id="hslPreviewCanvas" width="64" height="64" style="width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated"></canvas>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="tool-btn" data-action="resetHslModal" data-i18n="modal.hsl.reset">${escapeHtml(i18n.t("modal.hsl.reset"))}</button>
          <button type="button" class="tool-btn" data-action="closeHslModal" data-i18n="opt.cancel">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="button" class="btn-primary" data-action="applyHslModal" data-i18n="modal.hsl.apply">${escapeHtml(i18n.t("modal.hsl.apply"))}</button>
        </div>
      </div>
    </div>
  `;
}
