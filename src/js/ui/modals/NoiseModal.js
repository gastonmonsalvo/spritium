// @ts-check
/**
 * NoiseModal.js: Modal y controlador del filtro de Ruido Pixel-Art Safe (con vista previa en vivo).
 */

import { state, cloneGrid, pushLayerState, getGridDims } from "../../core/state.js";
import { parseColorToRgb } from "../../core/color.js";
import { renderAll } from "../../canvas/canvas.js";
import { applyNoiseToRegion } from "../../tools/tools.js";
import { isActiveLayerLocked } from "../../workspace/layers.js";
import { reconcileActiveTilemapLayer } from "../../workspace/tilemap.js";
import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml } from "../components/uiHtml.js";
import { setStatus, refreshIcons } from "../status.js";

/** @type {number[][] | null} */
let noiseBaseGrid = null;
let noiseSeed = 1337;
let listenersBound = false;

function readNoiseFormOptions() {
  const intensityEl = /** @type {HTMLInputElement | null} */ (document.getElementById("noiseIntensityRange"));
  const paintedEl = /** @type {HTMLInputElement | null} */ (document.getElementById("chkNoisePaintedOnly"));
  const monoEl = /** @type {HTMLInputElement | null} */ (document.getElementById("chkNoiseMonochrome"));
  const grayEl = /** @type {HTMLInputElement | null} */ (document.getElementById("chkNoiseGrayscale"));
  return {
    intensity: Math.max(5, Math.min(100, Number(intensityEl?.value) || 25)),
    paintedOnly: paintedEl ? paintedEl.checked : true,
    monochrome: monoEl ? monoEl.checked : true,
    grayscale: grayEl ? grayEl.checked : false,
    seed: noiseSeed,
  };
}

function restoreBaseGrid() {
  if (!noiseBaseGrid) return;
  const { w, h } = getGridDims();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      state.grid[y][x] = noiseBaseGrid[y]?.[x] ?? 0;
    }
  }
}

function renderNoisePreviewCanvas() {
  const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById("noisePreviewCanvas"));
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

function previewNoiseOnCanvas() {
  if (!noiseBaseGrid) return;
  restoreBaseGrid();
  const opts = readNoiseFormOptions();
  const monoEl = /** @type {HTMLInputElement | null} */ (document.getElementById("chkNoiseMonochrome"));
  if (monoEl) monoEl.disabled = opts.grayscale;
  const valEl = document.getElementById("noiseIntensityVal");
  if (valEl) valEl.textContent = `${opts.intensity}%`;
  applyNoiseToRegion(opts);
  renderNoisePreviewCanvas();
  renderAll();
}

function bindNoiseModalInputs() {
  if (listenersBound) return;
  listenersBound = true;
  for (const id of ["noiseIntensityRange", "chkNoisePaintedOnly", "chkNoiseMonochrome", "chkNoiseGrayscale"]) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("input", previewNoiseOnCanvas);
    el.addEventListener("change", previewNoiseOnCanvas);
  }
}

/**
 * Abre el modal del filtro de Ruido con vista previa en vivo sobre la capa o selección activa.
 */
export function openNoiseModal() {
  if (isActiveLayerLocked()) {
    setStatus({ key: "log.layer_locked" }, true);
    return;
  }
  const modal = document.getElementById("noiseFilterModal");
  if (!modal) return;
  noiseBaseGrid = cloneGrid(state.grid);
  noiseSeed = Math.floor(Math.random() * 1_000_000) + 1;
  bindNoiseModalInputs();
  modal.classList.add("open");
  refreshIcons(modal);
  previewNoiseOnCanvas();
}

/**
 * Cierra el modal de Ruido restaurando la capa original si no se confirmó.
 */
export function closeNoiseModal() {
  const modal = document.getElementById("noiseFilterModal");
  if (noiseBaseGrid) {
    restoreBaseGrid();
    noiseBaseGrid = null;
    renderAll();
  }
  modal?.classList.remove("open");
}

/**
 * Genera una nueva semilla aleatoria y actualiza la vista previa del filtro de Ruido.
 */
export function randomizeNoiseSeed() {
  noiseSeed = Math.floor(Math.random() * 1_000_000) + 1;
  previewNoiseOnCanvas();
}

/**
 * Aplica el filtro de Ruido actual registrando un paso limpio en el historial Undo/Redo.
 */
export function applyNoiseModal() {
  if (!noiseBaseGrid) {
    closeNoiseModal();
    return;
  }
  const opts = readNoiseFormOptions();
  restoreBaseGrid();
  pushLayerState();
  const changed = applyNoiseToRegion(opts);
  noiseBaseGrid = null;
  document.getElementById("noiseFilterModal")?.classList.remove("open");
  if (changed) {
    reconcileActiveTilemapLayer("auto");
    setStatus({ key: "status.noise_applied", params: { intensity: opts.intensity } }, false, "pixel");
  }
  renderAll();
}

/**
 * Genera el HTML del modal del filtro de Ruido (`#noiseFilterModal`).
 * @returns {string}
 */
export function renderNoiseModal() {
  return `
    <div id="noiseFilterModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="noiseModalTitle" data-backdrop-close="closeNoiseModal">
      <div class="modal-card import-modal-card">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px">
            <i data-lucide="sparkles" class="ui-icon-sm" style="color: var(--accent-secondary)"></i>
            <h3 id="noiseModalTitle" data-i18n="modal.noise.title">${escapeHtml(i18n.t("modal.noise.title"))}</h3>
          </div>
          <button type="button" class="tool-btn" data-action="closeNoiseModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>

        <div class="import-modal-body">
          <div class="import-modal-controls">
            <div style="display: flex; flex-direction: column; gap: 4px">
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px">
                <label for="noiseIntensityRange" style="margin: 0; font-weight: 600" data-i18n="modal.noise.intensity">${escapeHtml(i18n.t("modal.noise.intensity"))}</label>
                <span id="noiseIntensityVal" style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary)">25%</span>
              </div>
              <input type="range" id="noiseIntensityRange" min="5" max="100" step="5" value="25" />
            </div>

            <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; font-size: 12px">
              <input type="checkbox" id="chkNoisePaintedOnly" checked />
              <span data-i18n="modal.noise.painted_only">${escapeHtml(i18n.t("modal.noise.painted_only"))}</span>
            </label>

            <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; font-size: 12px">
              <input type="checkbox" id="chkNoiseMonochrome" checked />
              <span data-i18n="modal.noise.monochrome">${escapeHtml(i18n.t("modal.noise.monochrome"))}</span>
            </label>

            <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; font-size: 12px">
              <input type="checkbox" id="chkNoiseGrayscale" />
              <span data-i18n="modal.noise.grayscale">${escapeHtml(i18n.t("modal.noise.grayscale"))}</span>
            </label>

            <button type="button" class="tool-btn" data-action="randomizeNoiseSeed" style="justify-content: center; gap: 6px; padding: 6px 10px">
              <i data-lucide="dices" class="ui-icon-sm"></i>
              <span data-i18n="modal.noise.reseed">${escapeHtml(i18n.t("modal.noise.reseed"))}</span>
            </button>
          </div>

          <div class="import-preview-panel">
            <div class="import-preview-header">
              <span data-i18n="modal.shadow.preview">${escapeHtml(i18n.t("modal.shadow.preview"))}</span>
            </div>
            <div class="import-preview-stage">
              <canvas id="noisePreviewCanvas" width="64" height="64" style="width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated"></canvas>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="tool-btn" data-action="closeNoiseModal" data-i18n="opt.cancel">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="button" class="btn-primary" data-action="applyNoiseModal" data-i18n="opt.apply">${escapeHtml(i18n.t("opt.apply"))}</button>
        </div>
      </div>
    </div>
  `;
}
