/**
 * preferencesModalController.js: Controlador de UI y eventos en vivo del modal #preferencesModal.
 */

import { state, subscribe } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { setStatus } from "./status.js";
import { refreshCanvasToolCursor, getReticleSvgBody } from "./cursors.js";
import { openCustomRgbaPopover, closeRgbaPopover } from "./rgbaPopover.js";
import {
  USER_PREFS_STORAGE_KEY,
  DEFAULT_USER_PREFS,
  hexToCssRgba,
  syncViewTogglesUI,
  applyUserPreferencesObject,
  saveUserPreferences,
} from "./preferencesStore.js";

function syncSwatchButton(btnId, hexVal) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.style.setProperty("--picker-rgba", hexToCssRgba(hexVal));
  btn.title = `${hexVal.toUpperCase()} — Clic para editar en RGBA / HSLA / HEX`;
}

function renderReticlePreview() {
  const box = document.getElementById("prefReticlePreview");
  if (!box) return;
  box.innerHTML = `<svg width="36" height="36" viewBox="0 0 24 24">${getReticleSvgBody(state.reticleConfig)}</svg>`;
}

/**
 * Sincroniza los controles del modal #preferencesModal con el estado actual.
 */
export function syncPreferencesModalControls() {
  const cfg = state.pixelCursorConfig || DEFAULT_USER_PREFS.pixelCursorConfig;
  const ret = state.reticleConfig || DEFAULT_USER_PREFS.reticleConfig;
  const setChecked = (id, val) => {
    const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
    if (el) el.checked = Boolean(val);
  };
  const setVal = (id, val) => {
    const el = /** @type {HTMLInputElement|HTMLSelectElement|null} */ (document.getElementById(id));
    if (el) el.value = String(val);
  };
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  // 1. Mira del Ratón (Estilo CS)
  setVal("prefReticleShape", ret.shape || "crosshair");
  setVal("prefReticleSize", ret.size ?? 6);
  setText("prefReticleSizeVal", `${ret.size ?? 6}`);
  setVal("prefReticleThickness", ret.thickness ?? 1.5);
  setText("prefReticleThicknessVal", `${ret.thickness ?? 1.5}`);
  setVal("prefReticleGap", ret.gap ?? 2);
  setText("prefReticleGapVal", `${ret.gap ?? 2}`);
  setChecked("chkPrefReticleDot", ret.dot !== false);
  setChecked("chkPrefReticleOutline", ret.outline !== false);
  syncSwatchButton("prefReticleColorBtn", ret.color || "#ffffffff");
  renderReticlePreview();

  // 2. Vista Previa de Píxel (V) y Balde
  setChecked("chkPrefPixelCursor", state.showPixelCursor);
  setChecked("chkPrefCursorUseActiveColor", cfg.useActiveColor !== false);
  setChecked("chkPrefFillUseActiveColor", cfg.fillUseActiveColor !== false);
  setVal("prefCursorActiveAlpha", Math.round((cfg.activeColorAlpha ?? 0.75) * 100));
  setText("prefCursorActiveAlphaVal", `${Math.round((cfg.activeColorAlpha ?? 0.75) * 100)}%`);
  setChecked("chkPrefFillPreview", cfg.fillPreview !== false);
  setChecked("chkPrefCenterDot", cfg.showCenterDot !== false);
  setVal("prefCursorLineWidth", cfg.lineWidth ?? 1);
  setText("prefCursorLineWidthVal", `${Number(cfg.lineWidth ?? 1).toFixed(2).replace(/\.00$/, "")} px`);
  setVal("prefCursorOpacity", Math.round((cfg.opacity ?? 0.75) * 100));
  setText("prefCursorOpacityVal", `${Math.round((cfg.opacity ?? 0.75) * 100)}%`);
  syncSwatchButton("prefCursorColorBtn", cfg.color || "#38bdf8ee");
  syncSwatchButton("prefEraserColorBtn", cfg.eraserColor || "#f87171ee");
  syncSwatchButton("prefFillColorBtn", cfg.fillPreviewColor || "#38bdf838");
  syncSwatchButton("prefMagicColorBtn", cfg.magicPreviewColor || "#f472b644");
  syncSwatchButton("prefBgEraserColorBtn", cfg.bgEraserPreviewColor || "#fb718544");

  // 3. Lienzo y Guías
  setChecked("chkPrefShowGrid", state.showGrid !== false);
  setChecked("chkPrefShowCenterGuides", state.showCenterGuides !== false);
  setChecked("chkPrefShowCenterRulerMarks", state.showCenterRulerMarks !== false);
  setChecked("chkPrefShowRulers", state.showRulers !== false);
  setChecked("chkPrefShowGridCoords", Boolean(state.showGridCoords));
  const gc = state.gridCoordsConfig || DEFAULT_USER_PREFS.gridCoordsConfig;
  setChecked("chkPrefGridCoordsGuides", gc.showGuides !== false);
  setChecked("chkPrefGridCoordsBadge", gc.showBadge !== false);
  setVal("prefGridCoordsOpacity", Math.round((gc.opacity ?? 0.14) * 100));
  setText("prefGridCoordsOpacityVal", `${Math.round((gc.opacity ?? 0.14) * 100)}%`);
  syncSwatchButton("prefGridCoordsColorBtn", gc.color || "#38bdf8");
}

/**
 * Abre el modal de Preferencias de Usuario.
 */
export function openPreferencesModal() {
  syncPreferencesModalControls();
  document.getElementById("preferencesModal")?.classList.add("open");
}

/**
 * Cierra el modal de Preferencias de Usuario y su popover RGBA si estuviera abierto.
 */
export function closePreferencesModal() {
  closeRgbaPopover();
  document.getElementById("preferencesModal")?.classList.remove("open");
  syncViewTogglesUI();
  refreshCanvasToolCursor();
  renderAll();
}

/**
 * Restablece únicamente las preferencias de usuario del modal a sus valores de fábrica.
 */
export function resetUserPreferences() {
  try {
    localStorage.removeItem(USER_PREFS_STORAGE_KEY);
  } catch {
    // ignore
  }
  applyUserPreferencesObject(DEFAULT_USER_PREFS, { persist: false });
  setStatus({ key: "log.prefs_reset" });
}

/**
 * Inicializa los listeners en vivo del modal de Preferencias.
 */
export function initPreferencesModal() {
  const modal = document.getElementById("preferencesModal");
  if (!modal || modal.dataset.bound === "1") return;
  modal.dataset.bound = "1";

  subscribe("prefs:changed", syncPreferencesModalControls);

  const bindCheck = (id, applyFn, refreshReticle = false) => {
    const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
    el?.addEventListener("change", () => {
      applyFn(Boolean(el.checked));
      saveUserPreferences();
      syncViewTogglesUI();
      if (refreshReticle) {
        renderReticlePreview();
        refreshCanvasToolCursor();
      } else {
        refreshCanvasToolCursor();
        renderAll();
      }
    });
  };

  // Mira del Ratón (CS)
  const shapeSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById("prefReticleShape"));
  shapeSelect?.addEventListener("change", () => {
    state.reticleConfig.shape = shapeSelect.value || "crosshair";
    saveUserPreferences();
    renderReticlePreview();
    refreshCanvasToolCursor();
  });

  const bindReticleRange = (inputId, valId, key) => {
    const el = /** @type {HTMLInputElement|null} */ (document.getElementById(inputId));
    el?.addEventListener("input", () => {
      const val = Number(el.value);
      state.reticleConfig[key] = val;
      const lbl = document.getElementById(valId);
      if (lbl) lbl.textContent = String(val);
      saveUserPreferences();
      renderReticlePreview();
      refreshCanvasToolCursor();
    });
  };

  bindReticleRange("prefReticleSize", "prefReticleSizeVal", "size");
  bindReticleRange("prefReticleThickness", "prefReticleThicknessVal", "thickness");
  bindReticleRange("prefReticleGap", "prefReticleGapVal", "gap");
  bindCheck("chkPrefReticleDot", (v) => { state.reticleConfig.dot = v; }, true);
  bindCheck("chkPrefReticleOutline", (v) => { state.reticleConfig.outline = v; }, true);

  const reticleBtn = document.getElementById("prefReticleColorBtn");
  reticleBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    openCustomRgbaPopover(reticleBtn, state.reticleConfig.color || "#ffffffff", (newRgbaHex) => {
      state.reticleConfig.color = newRgbaHex;
      syncSwatchButton("prefReticleColorBtn", newRgbaHex);
      saveUserPreferences();
      renderReticlePreview();
      refreshCanvasToolCursor();
    });
  });

  // Vista Previa de Píxel (V) y Balde
  bindCheck("chkPrefPixelCursor", (v) => { state.showPixelCursor = v; });
  bindCheck("chkPrefCursorUseActiveColor", (v) => { state.pixelCursorConfig.useActiveColor = v; });
  bindCheck("chkPrefFillUseActiveColor", (v) => { state.pixelCursorConfig.fillUseActiveColor = v; });
  bindCheck("chkPrefFillPreview", (v) => { state.pixelCursorConfig.fillPreview = v; });
  bindCheck("chkPrefCenterDot", (v) => { state.pixelCursorConfig.showCenterDot = v; });
  bindCheck("chkPrefShowGrid", (v) => { state.showGrid = v; });
  bindCheck("chkPrefShowCenterGuides", (v) => { state.showCenterGuides = v; });
  bindCheck("chkPrefShowCenterRulerMarks", (v) => { state.showCenterRulerMarks = v; });
  bindCheck("chkPrefShowRulers", (v) => { state.showRulers = v; });
  bindCheck("chkPrefShowGridCoords", (v) => { state.showGridCoords = v; });
  bindCheck("chkPrefGridCoordsGuides", (v) => {
    state.gridCoordsConfig = { ...DEFAULT_USER_PREFS.gridCoordsConfig, ...state.gridCoordsConfig, showGuides: v };
  });
  bindCheck("chkPrefGridCoordsBadge", (v) => {
    state.gridCoordsConfig = { ...DEFAULT_USER_PREFS.gridCoordsConfig, ...state.gridCoordsConfig, showBadge: v };
  });

  const gcOpInput = /** @type {HTMLInputElement|null} */ (document.getElementById("prefGridCoordsOpacity"));
  gcOpInput?.addEventListener("input", () => {
    const pct = Math.max(5, Math.min(60, Number(gcOpInput.value) || 14));
    state.gridCoordsConfig = { ...DEFAULT_USER_PREFS.gridCoordsConfig, ...state.gridCoordsConfig, opacity: pct / 100 };
    const label = document.getElementById("prefGridCoordsOpacityVal");
    if (label) label.textContent = `${pct}%`;
    saveUserPreferences();
    renderAll();
  });

  const gcColorBtn = document.getElementById("prefGridCoordsColorBtn");
  gcColorBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const curHex = state.gridCoordsConfig?.color || "#38bdf8";
    openCustomRgbaPopover(gcColorBtn, curHex, (newHex) => {
      state.gridCoordsConfig = { ...DEFAULT_USER_PREFS.gridCoordsConfig, ...state.gridCoordsConfig, color: newHex };
      syncSwatchButton("prefGridCoordsColorBtn", newHex);
      saveUserPreferences();
      renderAll();
    });
  });

  const lwInput = /** @type {HTMLInputElement|null} */ (document.getElementById("prefCursorLineWidth"));
  lwInput?.addEventListener("input", () => {
    const val = Math.max(0.75, Math.min(2.5, Number(lwInput.value) || 1));
    state.pixelCursorConfig.lineWidth = val;
    const label = document.getElementById("prefCursorLineWidthVal");
    if (label) label.textContent = `${val.toFixed(2).replace(/\.00$/, "")} px`;
    saveUserPreferences();
    renderAll();
  });

  const activeAlphaInput = /** @type {HTMLInputElement|null} */ (document.getElementById("prefCursorActiveAlpha"));
  activeAlphaInput?.addEventListener("input", () => {
    const pct = Math.max(10, Math.min(100, Number(activeAlphaInput.value) || 75));
    state.pixelCursorConfig.activeColorAlpha = pct / 100;
    const label = document.getElementById("prefCursorActiveAlphaVal");
    if (label) label.textContent = `${pct}%`;
    saveUserPreferences();
    renderAll();
  });

  const opInput = /** @type {HTMLInputElement|null} */ (document.getElementById("prefCursorOpacity"));
  opInput?.addEventListener("input", () => {
    const pct = Math.max(20, Math.min(100, Number(opInput.value) || 75));
    state.pixelCursorConfig.opacity = pct / 100;
    const label = document.getElementById("prefCursorOpacityVal");
    if (label) label.textContent = `${pct}%`;
    saveUserPreferences();
    renderAll();
  });

  const bindPixelSwatch = (btnId, key, fallbackHex) => {
    const btn = document.getElementById(btnId);
    btn?.addEventListener("click", (e) => {
      e.stopPropagation();
      const curHex = state.pixelCursorConfig[key] || fallbackHex;
      openCustomRgbaPopover(btn, curHex, (newRgbaHex) => {
        state.pixelCursorConfig[key] = newRgbaHex;
        syncSwatchButton(btnId, newRgbaHex);
        saveUserPreferences();
        renderAll();
      });
    });
  };

  bindPixelSwatch("prefCursorColorBtn", "color", "#38bdf8ee");
  bindPixelSwatch("prefEraserColorBtn", "eraserColor", "#f87171ee");
  bindPixelSwatch("prefFillColorBtn", "fillPreviewColor", "#38bdf838");
  bindPixelSwatch("prefMagicColorBtn", "magicPreviewColor", "#f472b644");
  bindPixelSwatch("prefBgEraserColorBtn", "bgEraserPreviewColor", "#fb718544");

  document.getElementById("btnResetPreferences")?.addEventListener("click", resetUserPreferences);
}
