// @ts-check
/**
 * DropShadowModal.js: Generador de Sombra Proyectada (Drop / Cast Shadow) en una capa inferior dedicada.
 */

import { state, pushState, createEmptyGrid, getGridDims, notify } from "../../core/state.js";
import { parseColorToRgb } from "../../core/color.js";
import { renderAll } from "../../canvas/canvas.js";
import { buildPaletteUI, renderCustomPaletteUI } from "../../workspace/paletteManager.js";
import { createLayer, syncActiveLayerGrid, setSelectedLayerIndices, forEachFrameLayers } from "../../workspace/layersOps.js";
import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml } from "../components/uiHtml.js";
import { setStatus, refreshIcons } from "../status.js";

let listenersBound = false;

function readShadowOptions() {
  const num = (id, def) => {
    const el = /** @type {HTMLInputElement | null} */ (document.getElementById(id));
    return el ? Number(el.value) : def;
  };
  const chk = (id, def = false) => {
    const el = /** @type {HTMLInputElement | null} */ (document.getElementById(id));
    return el ? el.checked : def;
  };
  const colEl = /** @type {HTMLInputElement | null} */ (document.getElementById("shadowColorInput"));
  return {
    offsetX: num("shadowOffsetX", 2),
    offsetY: num("shadowOffsetY", 3),
    scaleY: num("shadowScaleY", 100) / 100,
    color: (colEl?.value || "#141020").toLowerCase(),
    dither50: chk("chkShadowDither", false),
    snapToPalette: chk("chkShadowSnapPalette", false),
  };
}

function buildShadowMask(srcGrid, w, h, opts) {
  const mask = Array.from({ length: h }, () => new Uint8Array(w));
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (srcGrid[y]?.[x] > 0 && y > maxY) maxY = y;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!srcGrid[y]?.[x]) continue;
      const sx = Math.round(x + opts.offsetX);
      const projY = maxY - (maxY - y) * opts.scaleY + opts.offsetY;
      const sy = Math.round(projY);
      if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
      if (opts.dither50 && ((sx + sy) & 1) !== 0) continue;
      mask[sy][sx] = 1;
    }
  }
  return mask;
}

function renderShadowPreview() {
  const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById("shadowPreviewCanvas"));
  if (!canvas) return;
  const opts = readShadowOptions();
  const oxVal = document.getElementById("shadowOffsetXVal");
  if (oxVal) oxVal.textContent = `${opts.offsetX}px`;
  const oyVal = document.getElementById("shadowOffsetYVal");
  if (oyVal) oyVal.textContent = `${opts.offsetY}px`;
  const scVal = document.getElementById("shadowScaleYVal");
  if (scVal) scVal.textContent = `${Math.round(opts.scaleY * 100)}%`;

  const { w, h } = getGridDims();
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const mask = buildShadowMask(state.grid, w, h, opts);
  const sRgb = parseColorToRgb(opts.color) || [20, 16, 32];
  const img = new ImageData(w, h);
  const alpha = opts.dither50 ? 255 : 150;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const srcIdx = state.grid[y]?.[x] || 0;
      if (srcIdx > 0) {
        const rgb = parseColorToRgb(state.paletteMap[srcIdx]) || [255, 255, 255];
        img.data[o] = rgb[0];
        img.data[o + 1] = rgb[1];
        img.data[o + 2] = rgb[2];
        img.data[o + 3] = 255;
      } else if (mask[y][x]) {
        img.data[o] = sRgb[0];
        img.data[o + 1] = sRgb[1];
        img.data[o + 2] = sRgb[2];
        img.data[o + 3] = alpha;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function bindShadowInputs() {
  if (listenersBound) return;
  listenersBound = true;
  const ids = [
    "shadowOffsetX",
    "shadowOffsetY",
    "shadowScaleY",
    "shadowColorInput",
    "chkShadowDither",
    "chkShadowSnapPalette",
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("input", renderShadowPreview);
    el.addEventListener("change", renderShadowPreview);
  }
}

function resolveShadowColorIndex(hex, snapToPalette) {
  const sRgb = parseColorToRgb(hex) || [20, 16, 32];
  if (snapToPalette) {
    let bestIdx = 1;
    let bestDist = Infinity;
    for (const [k, v] of Object.entries(state.paletteMap || {})) {
      const idx = Number(k);
      if (idx === 0 || idx === 9999 || !v) continue;
      const rgb = parseColorToRgb(v);
      if (!rgb) continue;
      const d = (rgb[0] - sRgb[0]) ** 2 + (rgb[1] - sRgb[1]) ** 2 + (rgb[2] - sRgb[2]) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    }
    return bestIdx;
  }

  for (const [k, v] of Object.entries(state.paletteMap || {})) {
    const idx = Number(k);
    if (idx !== 0 && idx < 9000 && v && v.toLowerCase() === hex) return idx;
  }
  const maxIdx = Math.max(39, ...Object.keys(state.paletteMap || {}).map(Number).filter((n) => n < 9000));
  const nextIdx = maxIdx + 1;
  state.paletteMap[nextIdx] = hex;
  if (!state.customColorIndices.includes(nextIdx)) state.customColorIndices.push(nextIdx);
  return nextIdx;
}

/**
 * Abre el modal de Sombra Proyectada con vista previa en vivo.
 */
export function openDropShadowModal() {
  const modal = document.getElementById("dropShadowModal");
  if (!modal) return;
  bindShadowInputs();
  modal.classList.add("open");
  refreshIcons(modal);
  renderShadowPreview();
}

/**
 * Cierra el modal de Sombra Proyectada.
 */
export function closeDropShadowModal() {
  document.getElementById("dropShadowModal")?.classList.remove("open");
}

/**
 * Crea una capa `"Shadow"` debajo de la capa activa con la sombra proyectada configurada.
 */
export function applyDropShadowModal() {
  const opts = readShadowOptions();
  const { w, h } = getGridDims();
  const mask = buildShadowMask(state.grid, w, h, opts);
  pushState();

  const colorIdx = resolveShadowColorIndex(opts.color, opts.snapToPalette);
  const shadowGrid = createEmptyGrid(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y][x]) shadowGrid[y][x] = colorIdx;
    }
  }

  const insertAt = Math.max(0, state.activeLayerIndex);
  const layerName = i18n.t("modal.shadow.layer_name");
  const shadowLayer = createLayer(layerName, null, shadowGrid);
  shadowLayer.opacity = opts.dither50 ? 1 : 0.6;

  forEachFrameLayers((layersList, fIdx) => {
    const isCurrent = !state.frames?.length || fIdx === state.activeFrameIndex;
    const extra = createLayer(layerName, null, null);
    extra.opacity = shadowLayer.opacity;
    layersList.splice(insertAt, 0, isCurrent ? shadowLayer : extra);
  });

  state.activeLayerIndex = insertAt + 1;
  setSelectedLayerIndices([state.activeLayerIndex]);
  syncActiveLayerGrid();
  buildPaletteUI();
  renderCustomPaletteUI();
  notify("layers:render");
  renderAll();
  closeDropShadowModal();
  setStatus({ key: "status.shadow_applied" }, false, "pixel");
}

/**
 * Genera el HTML del modal de Sombra Proyectada (`#dropShadowModal`).
 * @returns {string}
 */
export function renderDropShadowModal() {
  return `
    <div id="dropShadowModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="shadowModalTitle" data-backdrop-close="closeDropShadowModal">
      <div class="modal-card import-modal-card">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px">
            <i data-lucide="eclipse" class="ui-icon-sm" style="color: var(--accent-secondary)"></i>
            <h3 id="shadowModalTitle" data-i18n="modal.shadow.title">${escapeHtml(i18n.t("modal.shadow.title"))}</h3>
          </div>
          <button type="button" class="tool-btn" data-action="closeDropShadowModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>

        <div class="import-modal-body">
          <div class="import-modal-controls">
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 11.5px">
                <label for="shadowOffsetX" style="margin: 0" data-i18n="modal.shadow.offset_x">${escapeHtml(i18n.t("modal.shadow.offset_x"))}</label>
                <span id="shadowOffsetXVal" style="font-family: var(--font-mono)">2px</span>
              </div>
              <input type="range" id="shadowOffsetX" min="-16" max="16" step="1" value="2" />
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 11.5px">
                <label for="shadowOffsetY" style="margin: 0" data-i18n="modal.shadow.offset_y">${escapeHtml(i18n.t("modal.shadow.offset_y"))}</label>
                <span id="shadowOffsetYVal" style="font-family: var(--font-mono)">3px</span>
              </div>
              <input type="range" id="shadowOffsetY" min="-16" max="16" step="1" value="3" />
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 11.5px">
                <label for="shadowScaleY" style="margin: 0" data-i18n="modal.shadow.flatten">${escapeHtml(i18n.t("modal.shadow.flatten"))}</label>
                <span id="shadowScaleYVal" style="font-family: var(--font-mono)">100%</span>
              </div>
              <input type="range" id="shadowScaleY" min="20" max="100" step="5" value="100" />
            </div>

            <div>
              <label for="shadowColorInput" data-i18n="modal.shadow.color">${escapeHtml(i18n.t("modal.shadow.color"))}</label>
              <input type="color" id="shadowColorInput" value="#141020" style="width: 100%; height: 32px; padding: 2px" />
            </div>

            <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; font-size: 12px">
              <input type="checkbox" id="chkShadowDither" />
              <span data-i18n="modal.shadow.dither">${escapeHtml(i18n.t("modal.shadow.dither"))}</span>
            </label>

            <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; font-size: 12px">
              <input type="checkbox" id="chkShadowSnapPalette" />
              <span data-i18n="modal.shadow.snap_palette">${escapeHtml(i18n.t("modal.shadow.snap_palette"))}</span>
            </label>
          </div>

          <div class="import-preview-panel">
            <div class="import-preview-header">
              <span data-i18n="modal.shadow.preview">${escapeHtml(i18n.t("modal.shadow.preview"))}</span>
            </div>
            <div class="import-preview-stage">
              <canvas id="shadowPreviewCanvas" width="64" height="64" style="width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated"></canvas>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="tool-btn" data-action="closeDropShadowModal" data-i18n="opt.cancel">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="button" class="btn-primary" data-action="applyDropShadowModal" data-i18n="modal.shadow.apply">${escapeHtml(i18n.t("modal.shadow.apply"))}</button>
        </div>
      </div>
    </div>
  `;
}
