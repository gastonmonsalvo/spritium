/**
 * viewControlsUI.js: Toggles visuales del lienzo (grilla, reglas, guías centrales, coordenadas, cursor), zoom, resolución y Tiled Mode.
 */

import { state } from "../core/state.js";
import { renderAll, applyZoom } from "../canvas/canvas.js";
import { renderRulers } from "../canvas/rulers.js";
import { setStatus } from "./status.js";
import { saveUserPreferences, syncViewTogglesUI } from "./preferences.js";
import { i18n } from "../i18n/I18nService.js";
import { RESOLUTION_PRESETS } from "./components/TopMenuConfig.js";
import { syncSymmetryControlsUI } from "./symmetryUI.js";

/**
 * Elimina todas las guías personalizadas arrastradas desde las reglas.
 */
export function clearRulerGuides() {
  const had = Array.isArray(state.rulerGuides) && state.rulerGuides.length > 0;
  state.rulerGuides = [];
  state.activeGuideDrag = null;
  renderAll();
  setStatus({ key: had ? "status.guides_cleared" : "status.guides_empty" });
}

/**
 * Muestra u oculta la cuadrícula del lienzo.
 */
export function toggleGrid() {
  state.showGrid = state.showGrid === false;
  const btn = document.getElementById("btnToggleGrid");
  if (btn) btn.classList.toggle("active", state.showGrid);
  saveUserPreferences();
  syncViewTogglesUI();
  renderAll();
  setStatus({ key: state.showGrid ? "status.grid_on" : "status.grid_off" });
}

/** Alterna la visibilidad de la sub-grilla personalizable (N×M). */
export function toggleCustomGrid() {
  if (!state.customGrid) state.customGrid = { enabled: false, w: 16, h: 16, color: "#8b5cf6", autoColor: true, thickness: 1, opacity: 0.45, snap: false, lockCell: false };
  state.customGrid.enabled = !state.customGrid.enabled;
  saveUserPreferences();
  syncViewTogglesUI();
  renderAll();
  setStatus({
    key: state.customGrid.enabled ? "status.custom_grid_on" : "status.custom_grid_off",
    params: { w: state.customGrid.w, h: state.customGrid.h },
  });
}

/**
 * Muestra u oculta las reglas del lienzo.
 */
export function toggleRulers() {
  state.showRulers = !state.showRulers;
  saveUserPreferences();
  syncViewTogglesUI();
  renderAll();
  setStatus({ key: state.showRulers ? "status.rulers_on" : "status.rulers_off" });
}

/**
 * Muestra u oculta las líneas guía rojas del centro sobre el lienzo.
 */
export function toggleCenterGuides() {
  state.showCenterGuides = state.showCenterGuides === false;
  saveUserPreferences();
  syncViewTogglesUI();
  renderAll();
  setStatus({ key: state.showCenterGuides ? "status.center_guides_on" : "status.center_guides_off" });
}

/**
 * Muestra u oculta las marcas rojas del centro sobre las reglas.
 */
export function toggleCenterRulerMarks() {
  state.showCenterRulerMarks = state.showCenterRulerMarks === false;
  saveUserPreferences();
  syncViewTogglesUI();
  renderRulers();
  setStatus({ key: state.showCenterRulerMarks ? "status.center_ruler_marks_on" : "status.center_ruler_marks_off" });
}

/**
 * Muestra u oculta las coordenadas de cuadrícula bajo el cursor.
 */
export function toggleGridCoords() {
  state.showGridCoords = !state.showGridCoords;
  saveUserPreferences();
  syncViewTogglesUI();
  renderAll();
  setStatus({ key: state.showGridCoords ? "status.grid_coords_on" : "status.grid_coords_off" });
}

/**
 * Muestra u oculta la vista previa precisa del píxel/pincel bajo el cursor.
 */
export function togglePixelCursor() {
  state.showPixelCursor = state.showPixelCursor === false;
  saveUserPreferences();
  syncViewTogglesUI();
  renderAll();
  setStatus(
    { key: state.showPixelCursor ? "status.pixel_cursor_on" : "status.pixel_cursor_off" },
  );
}

/**
 * Actualiza el estado activo de los botones de resolución (16×16 a 512×512).
 * @param {number} w
 * @param {number} [h=w]
 */
export function updateResolutionButtons(w, h = w) {
  if (typeof document === "undefined") return;
  const rw = Math.max(1, Math.round(Number(w) || 64));
  const rh = Math.max(1, Math.round(Number(h) || rw));
  let matchedPreset = false;

  for (const res of RESOLUTION_PRESETS) {
    const btn = document.getElementById(`btnRes${res}`);
    const match = rw === res && rh === res;
    if (match) matchedPreset = true;
    if (btn) btn.classList.toggle("active", match);
  }

  const badge = document.getElementById("menuActiveResolutionBadge");
  if (badge) badge.textContent = `${rw}×${rh} ▸`;

  const customBtn = document.getElementById("btnResCustom");
  if (customBtn) {
    customBtn.classList.toggle("active", !matchedPreset);
    const labelEl = customBtn.querySelector(".menu-action-label");
    if (labelEl) {
      const baseCustomLabel = i18n.t("menu.canvas.custom_res");
      labelEl.textContent = matchedPreset
        ? baseCustomLabel
        : baseCustomLabel.replace(/\([^)]*\)/, `(${rw}×${rh})`);
    }
  }

  const wInput = document.getElementById("customResW");
  const hInput = document.getElementById("customResH");
  if (wInput) wInput.value = String(rw);
  if (hInput) hInput.value = String(rh);
  syncSymmetryControlsUI();
}

/**
 * Incrementa el zoom del lienzo en +25%.
 */
export function zoomIn() {
  applyZoom(state.zoom + 0.25);
}

/**
 * Reduce el zoom del lienzo en -25%.
 */
export function zoomOut() {
  applyZoom(state.zoom - 0.25);
}

/**
 * Restablece el zoom del lienzo al 100% (1:1).
 */
export function resetZoom() {
  applyZoom(1);
}

/**
 * Activa o desactiva el modo Tiled (none, both, x, y).
 * @param {string} mode
 */
export function setTiledMode(mode) {
  const valid = new Set(["none", "both", "x", "y"]);
  const next = valid.has(mode) ? mode : "none";
  state.tiledMode = next;

  if (typeof document !== "undefined") {
    document.querySelectorAll("[data-tiled-mode]").forEach((btn) => {
      const isActive = btn.getAttribute("data-tiled-mode") === next;
      btn.classList.toggle("active", isActive);
    });

    const previewLabel = document.querySelector("#previewModuleHeader label");
    if (previewLabel) {
      const labels = {
        none: "Vista 1:1",
        both: "Tiled 3×3",
        x: "Tiled 3×1",
        y: "Tiled 1×3",
      };
      previewLabel.textContent = labels[next];
    }
  }

  applyZoom(state.zoom || 1);
  if (next !== "none" && typeof requestAnimationFrame === "function" && typeof document !== "undefined") {
    requestAnimationFrame(() => {
      const container = document.getElementById("canvasContainer");
      if (!container) return;
      container.scrollLeft = Math.max(0, (container.scrollWidth - container.clientWidth) / 2);
      container.scrollTop = Math.max(0, (container.scrollHeight - container.clientHeight) / 2);
    });
  }
  setStatus({ key: `log.tiled_${next}` });
}
