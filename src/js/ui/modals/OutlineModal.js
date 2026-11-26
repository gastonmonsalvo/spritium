// @ts-check
/**
 * OutlineModal.js: Modal avanzado de Contorno (estilo Aseprite) con matriz de 8 direcciones,
 * grosor, modo exterior/interior/erosionar, picker RGBA propio y vista previa en vivo.
 */

import { state, getGridDims } from "../../core/state.js";
import { parseColorToRgb } from "../../core/color.js";
import { applyOutline, computeOutlineCells, FOUR_WAY_DIRS, EIGHT_WAY_DIRS } from "../../tools/morphologyOps.js";
import { buildPaletteUI, renderCustomPaletteUI } from "../../workspace/paletteManager.js";
import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml } from "../components/uiHtml.js";
import { setStatus, refreshIcons } from "../status.js";
import { openCustomRgbaPopover, closeRgbaPopover } from "../rgbaPopover.js";
import { hexToCssRgba } from "../preferencesStore.js";

const DIR_BUTTONS = [
  { id: "nw", dx: -1, dy: -1, glyph: "↖", active: false },
  { id: "n", dx: 0, dy: -1, glyph: "↑", active: true },
  { id: "ne", dx: 1, dy: -1, glyph: "↗", active: false },
  { id: "w", dx: -1, dy: 0, glyph: "←", active: true },
  { id: "center", dx: 0, dy: 0, glyph: "●", isCenter: true },
  { id: "e", dx: 1, dy: 0, glyph: "→", active: true },
  { id: "sw", dx: -1, dy: 1, glyph: "↙", active: false },
  { id: "s", dx: 0, dy: 1, glyph: "↓", active: true },
  { id: "se", dx: 1, dy: 1, glyph: "↘", active: false },
];

let listenersBound = false;
let customOutlineHex = "#000000ff";

function syncCustomColorBtn() {
  const btn = document.getElementById("outlineCustomColorBtn");
  if (!btn) return;
  btn.style.setProperty("--picker-rgba", hexToCssRgba(customOutlineHex));
  btn.title = customOutlineHex.toUpperCase();
}

function getSelectedDirs() {
  const btns = Array.from(document.querySelectorAll("#outlineDirGrid .outline-dir-btn.active"));
  return btns
    .map((b) => [Number(b.getAttribute("data-dx")), Number(b.getAttribute("data-dy"))])
    .filter(([dx, dy]) => dx !== 0 || dy !== 0);
}

function setDirPreset(dirs) {
  const dirSet = new Set(dirs.map(([dx, dy]) => `${dx},${dy}`));
  document.querySelectorAll("#outlineDirGrid .outline-dir-btn[data-dx]").forEach((btn) => {
    const key = `${btn.getAttribute("data-dx")},${btn.getAttribute("data-dy")}`;
    btn.classList.toggle("active", dirSet.has(key));
  });
}

function readOutlineOptions() {
  const thicknessEl = /** @type {HTMLInputElement | null} */ (document.getElementById("outlineThickness"));
  const modeEl = /** @type {HTMLSelectElement | null} */ (document.getElementById("outlineModeSelect"));
  const colorSrcEl = /** @type {HTMLSelectElement | null} */ (document.getElementById("outlineColorSource"));

  const colorSource = colorSrcEl?.value || "primary";
  let previewHex = customOutlineHex;
  if (colorSource === "primary") {
    previewHex = state.paletteMap?.[state.currentColorIndex || 1] || "#000000";
  } else if (colorSource === "secondary") {
    previewHex = state.paletteMap?.[state.secondaryColorIndex || 1] || "#000000";
  }

  const rawMode = modeEl?.value;
  const mode = /** @type {"outside"|"inside"|"erode"} */ (
    rawMode === "inside" || rawMode === "erode" ? rawMode : "outside"
  );

  return {
    dirs: getSelectedDirs(),
    thickness: Math.max(1, Math.min(4, Number(thicknessEl?.value || 1))),
    mode,
    colorSource,
    previewHex,
  };
}

function resolveOutlineColorIndex(colorSource, customHex) {
  if (colorSource === "primary") return state.currentColorIndex || 1;
  if (colorSource === "secondary") return state.secondaryColorIndex || 1;

  const hex = (customHex || "#000000").toLowerCase();
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

function renderOutlinePreview() {
  const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById("outlinePreviewCanvas"));
  if (!canvas) return;
  const opts = readOutlineOptions();

  const thickVal = document.getElementById("outlineThicknessVal");
  if (thickVal) thickVal.textContent = `${opts.thickness}px`;

  const colorRow = document.getElementById("outlineColorSourceRow");
  if (colorRow) colorRow.style.display = opts.mode === "erode" ? "none" : "flex";

  const customRow = document.getElementById("outlineCustomColorRow");
  if (customRow) customRow.style.display = opts.mode !== "erode" && opts.colorSource === "custom" ? "flex" : "none";

  const { w, h } = getGridDims();
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const cells = computeOutlineCells(state.grid, w, h, {
    dirs: opts.dirs,
    thickness: opts.thickness,
    mode: opts.mode,
    respectSelection: true,
  });
  const cellSet = new Set(cells.map(([x, y]) => `${x},${y}`));
  const outRgb = parseColorToRgb(opts.previewHex) || [0, 0, 0];
  const img = new ImageData(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (cellSet.has(`${x},${y}`)) {
        if (opts.mode === "erode") continue;
        img.data[o] = outRgb[0];
        img.data[o + 1] = outRgb[1];
        img.data[o + 2] = outRgb[2];
        img.data[o + 3] = 255;
      } else {
        const idx = state.grid[y]?.[x] || 0;
        if (idx > 0) {
          const rgb = parseColorToRgb(state.paletteMap?.[idx]) || [255, 255, 255];
          img.data[o] = rgb[0];
          img.data[o + 1] = rgb[1];
          img.data[o + 2] = rgb[2];
          img.data[o + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function bindOutlineListeners() {
  if (listenersBound) return;
  listenersBound = true;

  const gridEl = document.getElementById("outlineDirGrid");
  gridEl?.addEventListener("click", (e) => {
    const btn = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest("button") : null);
    if (!btn) return;
    if (btn.id === "outlineCenterToggle") {
      const activeCount = getSelectedDirs().length;
      setDirPreset(activeCount === 8 ? FOUR_WAY_DIRS : EIGHT_WAY_DIRS);
    } else if (btn.hasAttribute("data-dx")) {
      btn.classList.toggle("active");
    }
    renderOutlinePreview();
  });

  document.getElementById("btnOutlinePreset4")?.addEventListener("click", () => {
    setDirPreset(FOUR_WAY_DIRS);
    renderOutlinePreview();
  });
  document.getElementById("btnOutlinePreset8")?.addEventListener("click", () => {
    setDirPreset(EIGHT_WAY_DIRS);
    renderOutlinePreview();
  });
  document.getElementById("btnOutlinePresetShadow")?.addEventListener("click", () => {
    setDirPreset([[1, 0], [0, 1], [1, 1]]);
    renderOutlinePreview();
  });

  const customBtn = document.getElementById("outlineCustomColorBtn");
  customBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openCustomRgbaPopover(customBtn, customOutlineHex, (newHex) => {
      customOutlineHex = newHex;
      syncCustomColorBtn();
      renderOutlinePreview();
    });
  });

  ["outlineThickness", "outlineModeSelect", "outlineColorSource"].forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener("input", renderOutlinePreview);
    el?.addEventListener("change", renderOutlinePreview);
  });
}

/** Abre el modal avanzado de Contorno con vista previa en vivo. */
export function openOutlineModal() {
  const modal = document.getElementById("outlineModal");
  if (!modal) return;
  bindOutlineListeners();
  const baseHex = state.paletteMap?.[state.currentColorIndex || 1] || "#000000";
  customOutlineHex = baseHex.length === 7 ? `${baseHex}ff` : baseHex;
  syncCustomColorBtn();
  modal.classList.add("open");
  refreshIcons(modal);
  renderOutlinePreview();
}

/** Cierra el modal avanzado de Contorno. */
export function closeOutlineModal() {
  closeRgbaPopover();
  document.getElementById("outlineModal")?.classList.remove("open");
}

/** Aplica el contorno configurado sobre la selección o capa activa. */
export function applyOutlineModal() {
  const opts = readOutlineOptions();
  const colorIndex = opts.mode === "erode" ? 0 : resolveOutlineColorIndex(opts.colorSource, opts.previewHex);
  const count = applyOutline({
    dirs: opts.dirs,
    thickness: opts.thickness,
    mode: opts.mode,
    colorIndex,
  });
  if (opts.mode !== "erode" && opts.colorSource === "custom") {
    buildPaletteUI();
    renderCustomPaletteUI();
  }
  closeOutlineModal();
  setStatus(
    opts.mode === "erode"
      ? (count > 0 ? { key: "log.erode_applied", params: { count } } : { key: "log.erode_none" })
      : (count > 0 ? { key: "log.outline_applied", params: { count } } : { key: "log.outline_none" }),
    false,
    count > 0 ? "pixel" : "ui",
  );
}

/** Genera el HTML del modal avanzado de Contorno (`#outlineModal`). */
export function renderOutlineModal() {
  const dirButtonsHtml = DIR_BUTTONS.map((d) => {
    if (d.isCenter) {
      return `<button type="button" id="outlineCenterToggle" class="outline-dir-btn outline-dir-center" data-i18n-title="modal.outline.toggle_all" title="${escapeHtml(i18n.t("modal.outline.toggle_all"))}">${d.glyph}</button>`;
    }
    return `<button type="button" class="outline-dir-btn${d.active ? " active" : ""}" data-dx="${d.dx}" data-dy="${d.dy}">${d.glyph}</button>`;
  }).join("");

  return `
    <div id="outlineModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="outlineModalTitle" data-backdrop-close="closeOutlineModal">
      <div class="modal-card" style="max-width: 520px;">
        <div class="modal-header">
          <h3 id="outlineModalTitle" data-i18n="modal.outline.title">${escapeHtml(i18n.t("modal.outline.title"))}</h3>
          <button type="button" class="tool-btn" data-action="closeOutlineModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>

        <div class="modal-body" style="display: grid; grid-template-columns: minmax(0, 1fr) 156px; gap: 16px; align-items: start; font-size: 12px;">
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div>
                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 6px;" data-i18n="modal.outline.matrix">${escapeHtml(i18n.t("modal.outline.matrix"))}</div>
                <div id="outlineDirGrid" class="outline-dir-grid">${dirButtonsHtml}</div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 5px; flex: 1;">
                <button type="button" id="btnOutlinePreset4" class="tool-btn" style="padding: 4px 8px; font-size: 11px;" data-i18n="modal.outline.preset4">${escapeHtml(i18n.t("modal.outline.preset4"))}</button>
                <button type="button" id="btnOutlinePreset8" class="tool-btn" style="padding: 4px 8px; font-size: 11px;" data-i18n="modal.outline.preset8">${escapeHtml(i18n.t("modal.outline.preset8"))}</button>
                <button type="button" id="btnOutlinePresetShadow" class="tool-btn" style="padding: 4px 8px; font-size: 11px;" data-i18n="modal.outline.preset_shadow">${escapeHtml(i18n.t("modal.outline.preset_shadow"))}</button>
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <label for="outlineModeSelect" data-i18n="modal.outline.mode">${escapeHtml(i18n.t("modal.outline.mode"))}</label>
              <select id="outlineModeSelect" style="width: 156px; padding: 4px 6px;">
                <option value="outside" selected data-i18n="modal.outline.mode_outside">${escapeHtml(i18n.t("modal.outline.mode_outside"))}</option>
                <option value="inside" data-i18n="modal.outline.mode_inside">${escapeHtml(i18n.t("modal.outline.mode_inside"))}</option>
                <option value="erode" data-i18n="modal.outline.mode_erode">${escapeHtml(i18n.t("modal.outline.mode_erode"))}</option>
              </select>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <label for="outlineThickness" data-i18n="modal.outline.thickness">${escapeHtml(i18n.t("modal.outline.thickness"))}</label>
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="range" id="outlineThickness" min="1" max="4" step="1" value="1" style="width: 112px;" />
                <span id="outlineThicknessVal" style="min-width: 32px; text-align: right; color: var(--text-secondary);">1px</span>
              </div>
            </div>

            <div id="outlineColorSourceRow" style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <label for="outlineColorSource" data-i18n="modal.outline.color">${escapeHtml(i18n.t("modal.outline.color"))}</label>
              <select id="outlineColorSource" style="width: 156px; padding: 4px 6px;">
                <option value="primary" selected data-i18n="modal.outline.color_primary">${escapeHtml(i18n.t("modal.outline.color_primary"))}</option>
                <option value="secondary" data-i18n="modal.outline.color_secondary">${escapeHtml(i18n.t("modal.outline.color_secondary"))}</option>
                <option value="custom" data-i18n="modal.outline.color_custom">${escapeHtml(i18n.t("modal.outline.color_custom"))}</option>
              </select>
            </div>

            <div id="outlineCustomColorRow" style="display: none; align-items: center; justify-content: space-between; gap: 10px;">
              <label for="outlineCustomColorBtn" data-i18n="modal.outline.custom_hex">${escapeHtml(i18n.t("modal.outline.custom_hex"))}</label>
              <button type="button" id="outlineCustomColorBtn" class="rgba-picker-btn" style="width: 32px; height: 22px;"></button>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
            <span style="font-size: 11px; color: var(--text-secondary);" data-i18n="modal.outline.preview">${escapeHtml(i18n.t("modal.outline.preview"))}</span>
            <div class="preview-canvas" style="width: 140px; height: 140px; overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center;">
              <canvas id="outlinePreviewCanvas" width="64" height="64" style="width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; display: block;"></canvas>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="tool-btn" data-action="closeOutlineModal" data-i18n="opt.cancel">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="button" class="btn-primary" data-action="applyOutlineModal" data-i18n="opt.apply">${escapeHtml(i18n.t("opt.apply"))}</button>
        </div>
      </div>
    </div>
  `;
}
