// @ts-check
/**
 * NormalMapModal.js: Estudio interactivo de Normal Maps & Iluminación 2D en vivo (bajo demanda, oculto al inicio).
 */

import { state, getGridDims, createEmptyGrid, setGridSize } from "../../core/state.js";
import { renderAll } from "../../canvas/canvas.js";
import { renderRulers } from "../../canvas/rulers.js";
import { generateNormalMapPixels, renderLitSpritePixels } from "../../core/normalMapGenerator.js";
import { renderFrameToOffscreenCanvas } from "../../workspace/spritesheetExporter.js";
import { resetLayersWithGrid } from "../../workspace/layers.js";
import { resetFramesWithCurrentLayers } from "../../workspace/frames.js";
import { openNewDocTab, syncActiveTabSnapshot } from "../../workspace/docTabs.js";
import { buildPaletteUI, renderCustomPaletteUI } from "../../workspace/paletteManager.js";
import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml } from "../components/uiHtml.js";
import { setStatus, refreshIcons } from "../status.js";

let lightPos = { x: 0.3, y: 0.25 };
let viewMode = "lit"; // "lit" | "normal" | "split"
let listenersBound = false;
let animRafId = null;
let animAngle = 0;
let animLastTs = 0;
let animFrameAccum = 0;
let animFrameIdx = 0;

function readOptions() {
  const num = (id, def) => {
    const el = /** @type {HTMLInputElement | null} */ (document.getElementById(id));
    return el ? Number(el.value) : def;
  };
  const chk = (id, def = false) => {
    const el = /** @type {HTMLInputElement | null} */ (document.getElementById(id));
    return el ? el.checked : def;
  };
  const sel = (id, def) => {
    const el = /** @type {HTMLSelectElement | null} */ (document.getElementById(id));
    return el ? el.value : def;
  };
  const detailRatio = num("normalDetailRange", 35) / 100;
  const colorHex = sel("normalLightColor", "#fff0d2");
  const clean = colorHex.replace("#", "");
  const lr = parseInt(clean.slice(0, 2), 16) || 255;
  const lg = parseInt(clean.slice(2, 4), 16) || 240;
  const lb = parseInt(clean.slice(4, 6), 16) || 210;

  return {
    strength: num("normalStrengthRange", 2.5),
    bevelWeight: 1 - detailRatio,
    lumaWeight: detailRatio,
    smoothPasses: num("normalSmoothRange", 1),
    convention: /** @type {"opengl"|"directx"} */ (sel("normalConventionSelect", "opengl")),
    tileable: chk("chkNormalTileable", false),
    ambient: num("normalAmbientRange", 30) / 100,
    lightColor: /** @type {[number, number, number]} */ ([lr, lg, lb]),
  };
}

function getComposedFrameRgba(frameIndex = state.activeFrameIndex ?? 0) {
  const { w, h } = getGridDims();
  const frame = state.frames?.[frameIndex] || { layers: state.layers };
  const off = renderFrameToOffscreenCanvas(frame, w, h);
  const ctx = off.getContext("2d");
  if (!ctx) return { w, h, rgba: new Uint8ClampedArray(w * h * 4) };
  return { w, h, rgba: ctx.getImageData(0, 0, w, h).data };
}

function renderPreview() {
  const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById("normalPreviewCanvas"));
  if (!canvas) return;
  const opts = readOptions();

  const sVal = document.getElementById("normalStrengthVal");
  if (sVal) sVal.textContent = opts.strength.toFixed(1);
  const dVal = document.getElementById("normalDetailVal");
  if (dVal) dVal.textContent = `${Math.round(opts.lumaWeight * 100)}%`;
  const smVal = document.getElementById("normalSmoothVal");
  if (smVal) smVal.textContent = String(opts.smoothPasses);
  const aVal = document.getElementById("normalAmbientVal");
  if (aVal) aVal.textContent = `${Math.round(opts.ambient * 100)}%`;

  const frameIdx = animRafId ? animFrameIdx : (state.activeFrameIndex ?? 0);
  const { w, h, rgba } = getComposedFrameRgba(frameIdx);
  const normals = generateNormalMapPixels(rgba, w, h, opts);
  const lit = renderLitSpritePixels(rgba, normals, w, h, {
    x: lightPos.x,
    y: lightPos.y,
    z: 0.45,
    color: opts.lightColor,
    ambient: opts.ambient,
    intensity: 1.15,
    specular: 0.24,
    convention: opts.convention,
  });

  if (viewMode === "split") {
    canvas.width = w * 2;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(new ImageData(lit, w, h), 0, 0);
    ctx.putImageData(new ImageData(normals, w, h), w, 0);
  } else {
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixels = viewMode === "normal" ? normals : lit;
    ctx.putImageData(new ImageData(pixels, w, h), 0, 0);
  }
  updateLightGizmo(canvas);
}

function updateLightGizmo(canvas) {
  const gizmo = document.getElementById("normalLightGizmo");
  const stage = canvas?.parentElement;
  if (!gizmo || !stage) return;
  if (viewMode === "normal" || canvas.width <= 0 || canvas.height <= 0) {
    gizmo.style.display = "none";
    return;
  }
  const stageRect = stage.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0) {
    gizmo.style.display = "none";
    return;
  }
  const scale = Math.min(canvasRect.width / canvas.width, canvasRect.height / canvas.height);
  const drawW = canvas.width * scale;
  const drawH = canvas.height * scale;
  const litW = viewMode === "split" ? drawW / 2 : drawW;
  const originX = (canvasRect.left - stageRect.left) + (canvasRect.width - drawW) / 2;
  const originY = (canvasRect.top - stageRect.top) + (canvasRect.height - drawH) / 2;
  gizmo.style.display = "block";
  gizmo.style.left = `${originX + lightPos.x * litW}px`;
  gizmo.style.top = `${originY + lightPos.y * drawH}px`;
}

function bindModalEvents() {
  if (listenersBound) return;
  listenersBound = true;
  const ids = [
    "normalStrengthRange",
    "normalDetailRange",
    "normalSmoothRange",
    "normalAmbientRange",
    "normalConventionSelect",
    "chkNormalTileable",
    "normalLightColor",
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("input", renderPreview);
    el.addEventListener("change", renderPreview);
  }

  const canvas = document.getElementById("normalPreviewCanvas");
  if (canvas) {
    canvas.style.touchAction = "none";
    let dragging = false;
    const updateLightFromPointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      lightPos = { x: viewMode === "split" ? Math.min(1, nx * 2) : nx, y: ny };
      renderPreview();
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (animRafId) stopNormalAnim();
      dragging = true;
      updateLightFromPointer(e);
    });
    window.addEventListener("pointermove", (e) => {
      if (dragging) updateLightFromPointer(e);
    });
    window.addEventListener("pointerup", () => { dragging = false; });
    window.addEventListener("pointercancel", () => { dragging = false; });
  }
}

/**
 * Abre el modal de Normal Maps & Iluminación 2D con vista previa interactiva.
 */
export function openNormalMapModal() {
  const modal = document.getElementById("normalMapModal");
  if (!modal) return;
  animFrameIdx = state.activeFrameIndex ?? 0;
  bindModalEvents();
  modal.classList.add("open");
  refreshIcons(modal);
  renderPreview();
}

function stopNormalAnim() {
  if (animRafId) {
    cancelAnimationFrame(animRafId);
    animRafId = null;
  }
  document.getElementById("btnNormalPlayAnim")?.classList.remove("active");
}

/**
 * Cierra el modal de Normal Maps & Iluminación 2D.
 */
export function closeNormalMapModal() {
  stopNormalAnim();
  document.getElementById("normalMapModal")?.classList.remove("open");
}

/**
 * Reproduce o pausa la órbita automática de luz 2D (y los frames si el sprite tiene animación).
 */
export function toggleNormalAnimPreview() {
  const btn = document.getElementById("btnNormalPlayAnim");
  if (animRafId) {
    stopNormalAnim();
    renderPreview();
    return;
  }
  animFrameIdx = state.activeFrameIndex ?? 0;
  animLastTs = performance.now();
  animFrameAccum = 0;
  animAngle = Math.atan2(lightPos.y - 0.5, lightPos.x - 0.5);
  btn?.classList.add("active");

  const step = (now) => {
    if (!animRafId) return;
    const dt = Math.min(0.1, Math.max(0, (now - animLastTs) / 1000));
    animLastTs = now;
    animAngle += dt * 1.8;
    lightPos = {
      x: 0.5 + 0.36 * Math.cos(animAngle),
      y: 0.5 + 0.36 * Math.sin(animAngle),
    };

    const count = Array.isArray(state.frames) ? state.frames.length : 1;
    if (count > 1) {
      const frameDur = 1 / Math.max(1, Number(state.fps) || 8);
      animFrameAccum += dt;
      if (animFrameAccum >= frameDur) {
        animFrameAccum %= frameDur;
        animFrameIdx = (animFrameIdx + 1) % count;
      }
    }

    renderPreview();
    animRafId = requestAnimationFrame(step);
  };
  animRafId = requestAnimationFrame(step);
}

/**
 * Abre el Normal Map generado en una nueva pestaña editable sin tapar ni ensuciar la paleta del sprite original.
 */
export function openNormalMapInNewTab() {
  const opts = readOptions();
  const frameIdx = animRafId ? animFrameIdx : (state.activeFrameIndex ?? 0);
  const { w, h, rgba } = getComposedFrameRgba(frameIdx);
  const normals = generateNormalMapPixels(rgba, w, h, opts);
  const grid = createEmptyGrid(w, h);
  /** @type {Record<number, string | null>} */
  const paletteMap = { 0: null };
  /** @type {number[]} */
  const customIndices = [];
  const existingByHex = new Map();
  let nextIdx = 1;
  const toHex = (r, g, b) =>
    `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toLowerCase()}`;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (normals[o + 3] < 16) continue;
      const hex = toHex(normals[o], normals[o + 1], normals[o + 2]);
      let idx = existingByHex.get(hex);
      if (idx === undefined) {
        idx = nextIdx++;
        paletteMap[idx] = hex;
        existingByHex.set(hex, idx);
        customIndices.push(idx);
      }
      grid[y][x] = idx;
    }
  }

  const baseName = (/** @type {HTMLInputElement | null} */ (document.getElementById("assetName"))?.value || "sprite").trim();
  const normalName = `${baseName}_normal`;

  openNewDocTab(normalName);
  state.sourceImageFile = null;
  state.sourceImportOptions = null;
  state.resBaseSnapshot = null;
  state.originalImport = null;
  state.isDirtySinceImport = false;
  state.selection = null;
  state.currentThemeKey = "original";
  setGridSize(w, h);
  state.paletteMap = paletteMap;
  state.customColorIndices = customIndices;
  state.currentColorIndex = customIndices[0] || 1;

  resetLayersWithGrid(grid, "Normal Map");
  resetFramesWithCurrentLayers();
  syncActiveTabSnapshot(normalName);
  buildPaletteUI();
  renderCustomPaletteUI();
  renderAll();
  renderRulers();
  closeNormalMapModal();
  setStatus({ key: "normal.tab_opened", params: { name: normalName } }, false, "pixel");
}

/**
 * Cambia el modo de visualización del modal (`"lit"`, `"normal"`, `"split"`).
 * @param {"lit"|"normal"|"split"} mode
 */
export function setNormalViewMode(mode) {
  viewMode = ["lit", "normal", "split"].includes(mode) ? mode : "lit";
  document.querySelectorAll("#normalMapModal [data-normal-view]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-normal-view") === viewMode);
  });
  renderPreview();
}

/**
 * Exporta el Normal Map del frame actual como PNG (`_normal.png`).
 */
export function exportNormalMapPng() {
  const opts = readOptions();
  const frameIdx = animRafId ? animFrameIdx : (state.activeFrameIndex ?? 0);
  const { w, h, rgba } = getComposedFrameRgba(frameIdx);
  const normals = generateNormalMapPixels(rgba, w, h, opts);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")?.putImageData(new ImageData(normals, w, h), 0, 0);
  const name = (/** @type {HTMLInputElement | null} */ (document.getElementById("assetName"))?.value || "sprite").trim();
  const a = document.createElement("a");
  a.download = `${name}_normal.png`;
  a.href = c.toDataURL("image/png");
  a.click();
  setStatus({ key: "normal.exported_single", params: { name: a.download } }, false, "pixel");
}

/**
 * Exporta una tira PNG de Normal Maps sincronizada con todos los frames de la animación.
 */
export function exportNormalMapStrip() {
  const opts = readOptions();
  const frames = Array.isArray(state.frames) && state.frames.length > 0 ? state.frames : [{ layers: state.layers }];
  const { w, h } = getGridDims();
  const strip = document.createElement("canvas");
  strip.width = w * frames.length;
  strip.height = h;
  const ctx = strip.getContext("2d");
  if (!ctx) return;

  for (let i = 0; i < frames.length; i++) {
    const { rgba } = getComposedFrameRgba(i);
    const normals = generateNormalMapPixels(rgba, w, h, opts);
    ctx.putImageData(new ImageData(normals, w, h), i * w, 0);
  }

  const name = (/** @type {HTMLInputElement | null} */ (document.getElementById("assetName"))?.value || "sprite").trim();
  const a = document.createElement("a");
  a.download = `${name}_normal_strip_${frames.length}f.png`;
  a.href = strip.toDataURL("image/png");
  a.click();
  setStatus({ key: "normal.exported_strip", params: { name: a.download, count: frames.length } }, false, "pixel");
}

/**
 * Genera el HTML del modal de Normal Maps & Iluminación 2D (`#normalMapModal`).
 * @returns {string}
 */
export function renderNormalMapModal() {
  return `
    <div id="normalMapModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="normalModalTitle" data-backdrop-close="closeNormalMapModal">
      <div class="modal-card import-modal-card">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px">
            <i data-lucide="sun" class="ui-icon-sm" style="color: var(--accent-secondary)"></i>
            <h3 id="normalModalTitle" data-i18n="normal.title">${escapeHtml(i18n.t("normal.title"))}</h3>
          </div>
          <button type="button" class="tool-btn" data-action="closeNormalMapModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>

        <div class="import-modal-body">
          <div class="import-modal-controls">
            <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px">
              <button type="button" class="tool-btn active" data-normal-view="lit" data-action="setNormalViewMode" data-action-arg="lit" style="font-size: 11px; padding: 5px" data-i18n="normal.view_lit">${escapeHtml(i18n.t("normal.view_lit"))}</button>
              <button type="button" class="tool-btn" data-normal-view="normal" data-action="setNormalViewMode" data-action-arg="normal" style="font-size: 11px; padding: 5px" data-i18n="normal.view_normal">${escapeHtml(i18n.t("normal.view_normal"))}</button>
              <button type="button" class="tool-btn" data-normal-view="split" data-action="setNormalViewMode" data-action-arg="split" style="font-size: 11px; padding: 5px" data-i18n="normal.view_split">${escapeHtml(i18n.t("normal.view_split"))}</button>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 11.5px">
                <label for="normalStrengthRange" style="margin: 0" data-i18n="normal.strength">${escapeHtml(i18n.t("normal.strength"))}</label>
                <span id="normalStrengthVal" style="font-family: var(--font-mono)">2.5</span>
              </div>
              <input type="range" id="normalStrengthRange" min="0.5" max="6" step="0.1" value="2.5" />
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 11.5px">
                <label for="normalDetailRange" style="margin: 0" data-i18n="normal.detail_mix">${escapeHtml(i18n.t("normal.detail_mix"))}</label>
                <span id="normalDetailVal" style="font-family: var(--font-mono)">35%</span>
              </div>
              <input type="range" id="normalDetailRange" min="0" max="100" step="5" value="35" />
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 11.5px">
                <label for="normalSmoothRange" style="margin: 0" data-i18n="normal.smooth">${escapeHtml(i18n.t("normal.smooth"))}</label>
                <span id="normalSmoothVal" style="font-family: var(--font-mono)">1</span>
              </div>
              <input type="range" id="normalSmoothRange" min="0" max="4" step="1" value="1" />
            </div>

            <div class="modal-grid-2">
              <div>
                <label for="normalConventionSelect" data-i18n="normal.convention">${escapeHtml(i18n.t("normal.convention"))}</label>
                <select id="normalConventionSelect">
                  <option value="opengl">OpenGL (Godot / Unity)</option>
                  <option value="directx">DirectX (Unreal)</option>
                </select>
              </div>
              <div>
                <label for="normalLightColor" data-i18n="normal.light_color">${escapeHtml(i18n.t("normal.light_color"))}</label>
                <input type="color" id="normalLightColor" value="#fff0d2" style="width: 100%; height: 32px; padding: 2px" />
              </div>
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 11.5px">
                <label for="normalAmbientRange" style="margin: 0" data-i18n="normal.ambient">${escapeHtml(i18n.t("normal.ambient"))}</label>
                <span id="normalAmbientVal" style="font-family: var(--font-mono)">30%</span>
              </div>
              <input type="range" id="normalAmbientRange" min="5" max="80" step="5" value="30" />
            </div>

            <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; font-size: 12px">
              <input type="checkbox" id="chkNormalTileable" />
              <span data-i18n="normal.tileable">${escapeHtml(i18n.t("normal.tileable"))}</span>
            </label>
          </div>

          <div class="import-preview-panel">
            <div class="import-preview-header">
              <span data-i18n="normal.preview_hint">${escapeHtml(i18n.t("normal.preview_hint"))}</span>
              <button type="button" id="btnNormalPlayAnim" class="tool-btn" data-action="toggleNormalAnimPreview">
                <i data-lucide="play" class="ui-icon-xs"></i>
                <span data-i18n="normal.play_anim">${escapeHtml(i18n.t("normal.play_anim"))}</span>
              </button>
            </div>
            <div class="import-preview-stage">
              <canvas id="normalPreviewCanvas" width="64" height="64" style="width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; cursor: grab"></canvas>
              <div id="normalLightGizmo" class="normal-light-gizmo" aria-hidden="true"></div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="tool-btn" data-action="closeNormalMapModal" data-i18n="opt.cancel">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="button" class="tool-btn" data-action="openNormalMapInNewTab" data-i18n="normal.to_layer">${escapeHtml(i18n.t("normal.to_layer"))}</button>
          <button type="button" class="tool-btn" data-action="exportNormalMapStrip" data-i18n="normal.export_strip">${escapeHtml(i18n.t("normal.export_strip"))}</button>
          <button type="button" class="btn-primary" data-action="exportNormalMapPng" data-i18n="normal.export_png">${escapeHtml(i18n.t("normal.export_png"))}</button>
        </div>
      </div>
    </div>
  `;
}
