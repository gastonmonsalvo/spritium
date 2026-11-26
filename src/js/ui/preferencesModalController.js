/**
 * preferencesModalController.js: Controlador de UI y eventos en vivo del modal #preferencesModal.
 */

import { state, subscribe, notify } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { setStatus } from "./status.js";
import { refreshCanvasToolCursor, getReticleSvgBody } from "./cursors.js";
import { encodeReticleCode, decodeReticleCode } from "./reticleShareCode.js";
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
  if (box) {
    box.innerHTML = `<svg width="36" height="36" viewBox="0 0 24 24">${getReticleSvgBody(state.reticleConfig)}</svg>`;
  }
  const codeInput = /** @type {HTMLInputElement|null} */ (document.getElementById("prefReticleCodeInput"));
  if (codeInput && document.activeElement !== codeInput) {
    codeInput.value = encodeReticleCode(state.reticleConfig);
  }
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
  const bgCfg = state.baseGridConfig || DEFAULT_USER_PREFS.baseGridConfig;
  setVal("prefBaseGridMode", bgCfg.mode === "fixed" ? "fixed" : "adaptive");
  setVal("prefBaseGridStepX", bgCfg.stepX ?? bgCfg.step ?? 8);
  setVal("prefBaseGridStepY", bgCfg.stepY ?? bgCfg.step ?? 8);
  const chkContrast = Number(bgCfg.checkerContrast ?? 14) || 14;
  setVal("prefCheckerContrast", chkContrast);
  setText("prefCheckerContrastVal", String(chkContrast));
  const bgStepWrap = document.getElementById("prefBaseGridStepWrap");
  if (bgStepWrap) bgStepWrap.style.display = bgCfg.mode === "fixed" ? "inline-flex" : "none";
  setChecked("chkPrefShowCenterGuides", state.showCenterGuides !== false);
  setChecked("chkPrefShowCenterRulerMarks", state.showCenterRulerMarks !== false);
  setChecked("chkPrefShowRulers", state.showRulers !== false);
  const rCfg = state.rulerConfig || DEFAULT_USER_PREFS.rulerConfig;
  setVal("prefRulerMode", rCfg.mode === "fixed" ? "fixed" : "auto");
  setVal("prefRulerStep", String(rCfg.step || 8));
  const rStepWrap = document.getElementById("prefRulerStepWrap");
  if (rStepWrap) rStepWrap.style.display = rCfg.mode === "fixed" ? "inline-flex" : "none";
  setChecked("chkPrefShowGridCoords", Boolean(state.showGridCoords));
  const gc = state.gridCoordsConfig || DEFAULT_USER_PREFS.gridCoordsConfig;
  setChecked("chkPrefGridCoordsGuides", gc.showGuides !== false);
  setChecked("chkPrefGridCoordsBadge", gc.showBadge !== false);
  setVal("prefGridCoordsOpacity", Math.round((gc.opacity ?? 0.14) * 100));
  setText("prefGridCoordsOpacityVal", `${Math.round((gc.opacity ?? 0.14) * 100)}%`);
  syncSwatchButton("prefGridCoordsColorBtn", gc.color || "#38bdf8");

  const cg = state.customGrid || DEFAULT_USER_PREFS.customGrid;
  setChecked("chkPrefCustomGrid", Boolean(cg.enabled));
  setVal("prefCustomGridW", cg.w || 16);
  setVal("prefCustomGridH", cg.h || 16);
  setChecked("chkPrefCustomGridSnap", Boolean(cg.snap));
  setChecked("chkPrefCustomGridLock", Boolean(cg.lockCell));
  const autoCol = cg.autoColor !== false;
  setChecked("chkPrefCustomGridAutoColor", autoCol);
  const thick = Number(cg.thickness ?? 1) || 1;
  setVal("prefCustomGridThickness", thick);
  setText("prefCustomGridThicknessVal", `${thick} px`);
  setVal("prefCustomGridOpacity", Math.round((cg.opacity ?? 0.45) * 100));
  setText("prefCustomGridOpacityVal", `${Math.round((cg.opacity ?? 0.45) * 100)}%`);
  syncSwatchButton("prefCustomGridColorBtn", cg.color || "#8b5cf6");
  const cgColorBtn = document.getElementById("prefCustomGridColorBtn");
  if (cgColorBtn) cgColorBtn.style.opacity = autoCol ? "0.45" : "1";

  const cguides = state.centerGuidesConfig || DEFAULT_USER_PREFS.centerGuidesConfig;
  const cguidesAuto = cguides.autoColor !== false;
  setChecked("chkPrefCenterGuidesAutoColor", cguidesAuto);
  setChecked("chkPrefCenterGuidesOddHalf", Boolean(cguides.oddHalfLine));
  const cguidesThick = Number(cguides.thickness ?? 1) || 1;
  setVal("prefCenterGuidesThickness", cguidesThick);
  setText("prefCenterGuidesThicknessVal", `${cguidesThick} px`);
  setVal("prefCenterGuidesOpacity", Math.round((cguides.opacity ?? 0.45) * 100));
  setText("prefCenterGuidesOpacityVal", `${Math.round((cguides.opacity ?? 0.45) * 100)}%`);
  syncSwatchButton("prefCenterGuidesColorBtn", cguides.color || "#ef4444");
  const cguidesColorBtn = document.getElementById("prefCenterGuidesColorBtn");
  if (cguidesColorBtn) cguidesColorBtn.style.opacity = cguidesAuto ? "0.45" : "1";

  const ov = state.guidesOverlayConfig || DEFAULT_USER_PREFS.guidesOverlayConfig;
  const ovAuto = ov.autoColor !== false;
  setChecked("chkPrefOverlaysAutoColor", ovAuto);
  const ovThick = Number(ov.thickness ?? 1.5) || 1.5;
  setVal("prefOverlaysThickness", ovThick);
  setText("prefOverlaysThicknessVal", `${ovThick} px`);
  syncSwatchButton("prefMeasureColorBtn", ov.measureColor || "#f59e0b");
  syncSwatchButton("prefResizeColorBtn", ov.resizeColor || "#38bdf8");
  const mBtn = document.getElementById("prefMeasureColorBtn");
  const rBtn = document.getElementById("prefResizeColorBtn");
  if (mBtn) mBtn.style.opacity = ovAuto ? "0.45" : "1";
  if (rBtn) rBtn.style.opacity = ovAuto ? "0.45" : "1";
}

/**
 * Abre el modal de Preferencias de Usuario.
 * @param {string} [initialTab]
 */
export function openPreferencesModal(initialTab = null) {
  syncPreferencesModalControls();
  const modal = document.getElementById("preferencesModal");
  if (typeof initialTab === "string" && initialTab && modal) {
    modal.querySelectorAll(".pref-nav-btn").forEach((b) => {
      const isTarget = b.getAttribute("data-pref-tab") === initialTab;
      b.classList.toggle("active", isTarget);
      b.setAttribute("aria-selected", String(isTarget));
    });
    modal.querySelectorAll(".pref-panel").forEach((p) => {
      p.classList.toggle("active", p.getAttribute("data-pref-panel") === initialTab);
    });
  }
  modal?.classList.add("open");
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

  const navBtns = Array.from(modal.querySelectorAll("[data-pref-tab]"));
  const panels = Array.from(modal.querySelectorAll("[data-pref-panel]"));
  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-pref-tab");
      navBtns.forEach((b) => {
        const isTarget = b === btn;
        b.classList.toggle("active", isTarget);
        b.setAttribute("aria-selected", String(isTarget));
      });
      panels.forEach((p) => p.classList.toggle("active", p.getAttribute("data-pref-panel") === targetTab));
    });
  });

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

  const codeInput = /** @type {HTMLInputElement|null} */ (document.getElementById("prefReticleCodeInput"));
  const applyReticleCodeInput = () => {
    if (!codeInput) return;
    const decoded = decodeReticleCode(codeInput.value);
    if (!decoded) {
      setStatus({ key: "log.reticle_code_invalid" }, true);
      return;
    }
    state.reticleConfig = decoded;
    saveUserPreferences();
    syncPreferencesModalControls();
    refreshCanvasToolCursor();
    setStatus({ key: "log.reticle_code_applied" });
  };
  document.getElementById("btnApplyReticleCode")?.addEventListener("click", applyReticleCodeInput);
  codeInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyReticleCodeInput();
    }
  });
  document.getElementById("btnCopyReticleCode")?.addEventListener("click", async () => {
    const code = encodeReticleCode(state.reticleConfig);
    if (codeInput) codeInput.value = code;
    try {
      await navigator.clipboard?.writeText(code);
      setStatus({ key: "log.reticle_code_copied", params: { code } });
    } catch {
      codeInput?.select();
    }
  });

  // Vista Previa de Píxel (V) y Balde
  bindCheck("chkPrefPixelCursor", (v) => { state.showPixelCursor = v; });
  bindCheck("chkPrefCursorUseActiveColor", (v) => { state.pixelCursorConfig.useActiveColor = v; });
  bindCheck("chkPrefFillUseActiveColor", (v) => { state.pixelCursorConfig.fillUseActiveColor = v; });
  bindCheck("chkPrefFillPreview", (v) => { state.pixelCursorConfig.fillPreview = v; });
  bindCheck("chkPrefCenterDot", (v) => { state.pixelCursorConfig.showCenterDot = v; });
  bindCheck("chkPrefShowGrid", (v) => { state.showGrid = v; });
  const ensureBaseGrid = () => {
    if (!state.baseGridConfig) state.baseGridConfig = { ...DEFAULT_USER_PREFS.baseGridConfig };
    return state.baseGridConfig;
  };
  const bgModeEl = /** @type {HTMLSelectElement|null} */ (document.getElementById("prefBaseGridMode"));
  bgModeEl?.addEventListener("change", () => {
    const mode = bgModeEl.value === "fixed" ? "fixed" : "adaptive";
    ensureBaseGrid().mode = mode;
    const wrap = document.getElementById("prefBaseGridStepWrap");
    if (wrap) wrap.style.display = mode === "fixed" ? "inline-flex" : "none";
    saveUserPreferences();
    renderAll();
  });
  const bindBaseStep = (id, axis) => {
    const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
    el?.addEventListener("input", () => {
      const n = Math.round(Number(el.value));
      if (!Number.isFinite(n) || n < 1 || n > 128) return;
      ensureBaseGrid()[axis] = n;
      saveUserPreferences();
      renderAll();
    });
    el?.addEventListener("change", () => {
      const n = Math.max(1, Math.min(128, Math.round(Number(el.value) || 8)));
      el.value = String(n);
      ensureBaseGrid()[axis] = n;
      saveUserPreferences();
      renderAll();
    });
  };
  bindBaseStep("prefBaseGridStepX", "stepX");
  bindBaseStep("prefBaseGridStepY", "stepY");
  const chkContrastEl = /** @type {HTMLInputElement|null} */ (document.getElementById("prefCheckerContrast"));
  chkContrastEl?.addEventListener("input", () => {
    const val = Math.max(4, Math.min(64, Math.round(Number(chkContrastEl.value) || 14)));
    ensureBaseGrid().checkerContrast = val;
    const lbl = document.getElementById("prefCheckerContrastVal");
    if (lbl) lbl.textContent = String(val);
    saveUserPreferences();
    notify("checker:contrast");
  });
  bindCheck("chkPrefShowCenterGuides", (v) => { state.showCenterGuides = v; });
  bindCheck("chkPrefShowCenterRulerMarks", (v) => { state.showCenterRulerMarks = v; });
  bindCheck("chkPrefShowRulers", (v) => { state.showRulers = v; });
  const ensureRulerCfg = () => {
    if (!state.rulerConfig) state.rulerConfig = { ...DEFAULT_USER_PREFS.rulerConfig };
    return state.rulerConfig;
  };
  const rModeEl = /** @type {HTMLSelectElement|null} */ (document.getElementById("prefRulerMode"));
  rModeEl?.addEventListener("change", () => {
    const mode = rModeEl.value === "fixed" ? "fixed" : "auto";
    ensureRulerCfg().mode = mode;
    const wrap = document.getElementById("prefRulerStepWrap");
    if (wrap) wrap.style.display = mode === "fixed" ? "inline-flex" : "none";
    saveUserPreferences();
    renderAll();
  });
  const rStepEl = /** @type {HTMLSelectElement|null} */ (document.getElementById("prefRulerStep"));
  rStepEl?.addEventListener("change", () => {
    const step = Math.max(1, Math.min(64, Math.round(Number(rStepEl.value) || 8)));
    ensureRulerCfg().step = step;
    saveUserPreferences();
    renderAll();
  });
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

  const ensureCustomGrid = () => {
    if (!state.customGrid) state.customGrid = { ...DEFAULT_USER_PREFS.customGrid };
    return state.customGrid;
  };
  bindCheck("chkPrefCustomGrid", (v) => { ensureCustomGrid().enabled = v; });
  bindCheck("chkPrefCustomGridSnap", (v) => { ensureCustomGrid().snap = v; });
  bindCheck("chkPrefCustomGridLock", (v) => { ensureCustomGrid().lockCell = v; });
  bindCheck("chkPrefCustomGridAutoColor", (v) => {
    ensureCustomGrid().autoColor = v;
    const btn = document.getElementById("prefCustomGridColorBtn");
    if (btn) btn.style.opacity = v ? "0.45" : "1";
  });

  const bindCustomDim = (id, axis) => {
    const el = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
    el?.addEventListener("input", () => {
      const n = Math.round(Number(el.value));
      if (!Number.isFinite(n) || n < 2 || n > 256) return;
      ensureCustomGrid()[axis] = n;
      saveUserPreferences();
      renderAll();
    });
    el?.addEventListener("change", () => {
      const val = Math.max(2, Math.min(256, Math.round(Number(el.value) || 16)));
      el.value = String(val);
      ensureCustomGrid()[axis] = val;
      saveUserPreferences();
      renderAll();
    });
  };
  bindCustomDim("prefCustomGridW", "w");
  bindCustomDim("prefCustomGridH", "h");

  modal.querySelectorAll(".pref-cg-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sz = Number(btn.getAttribute("data-cg-size")) || 32;
      const cg = ensureCustomGrid();
      cg.w = sz;
      cg.h = sz;
      cg.enabled = true;
      syncPreferencesModalControls();
      syncViewTogglesUI();
      saveUserPreferences();
      renderAll();
    });
  });

  const cgOpInput = /** @type {HTMLInputElement|null} */ (document.getElementById("prefCustomGridOpacity"));
  cgOpInput?.addEventListener("input", () => {
    const val = Math.max(10, Math.min(100, Number(cgOpInput.value) || 45));
    ensureCustomGrid().opacity = val / 100;
    const label = document.getElementById("prefCustomGridOpacityVal");
    if (label) label.textContent = `${val}%`;
    saveUserPreferences();
    renderAll();
  });

  const cgThickInput = /** @type {HTMLInputElement|null} */ (document.getElementById("prefCustomGridThickness"));
  cgThickInput?.addEventListener("input", () => {
    const val = Math.max(1, Math.min(3, Math.round((Number(cgThickInput.value) || 1) * 2) / 2));
    ensureCustomGrid().thickness = val;
    const label = document.getElementById("prefCustomGridThicknessVal");
    if (label) label.textContent = `${val} px`;
    saveUserPreferences();
    renderAll();
  });

  const cgColorBtn = document.getElementById("prefCustomGridColorBtn");
  cgColorBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const curHex = state.customGrid?.color || "#8b5cf6";
    openCustomRgbaPopover(cgColorBtn, curHex, (newHex) => {
      const cg = ensureCustomGrid();
      cg.color = newHex;
      cg.autoColor = false;
      const autoEl = /** @type {HTMLInputElement|null} */ (document.getElementById("chkPrefCustomGridAutoColor"));
      if (autoEl) autoEl.checked = false;
      cgColorBtn.style.opacity = "1";
      syncSwatchButton("prefCustomGridColorBtn", newHex);
      saveUserPreferences();
      renderAll();
    });
  });

  const ensureCenterGuides = () => {
    if (!state.centerGuidesConfig) state.centerGuidesConfig = { ...DEFAULT_USER_PREFS.centerGuidesConfig };
    return state.centerGuidesConfig;
  };
  bindCheck("chkPrefCenterGuidesAutoColor", (v) => {
    ensureCenterGuides().autoColor = v;
    const btn = document.getElementById("prefCenterGuidesColorBtn");
    if (btn) btn.style.opacity = v ? "0.45" : "1";
  });
  bindCheck("chkPrefCenterGuidesOddHalf", (v) => { ensureCenterGuides().oddHalfLine = v; });
  const cguidesOpInput = /** @type {HTMLInputElement|null} */ (document.getElementById("prefCenterGuidesOpacity"));
  cguidesOpInput?.addEventListener("input", () => {
    const val = Math.max(10, Math.min(100, Number(cguidesOpInput.value) || 45));
    ensureCenterGuides().opacity = val / 100;
    const label = document.getElementById("prefCenterGuidesOpacityVal");
    if (label) label.textContent = `${val}%`;
    saveUserPreferences();
    renderAll();
  });
  const cguidesThickInput = /** @type {HTMLInputElement|null} */ (document.getElementById("prefCenterGuidesThickness"));
  cguidesThickInput?.addEventListener("input", () => {
    const val = Math.max(0.5, Math.min(3, Math.round((Number(cguidesThickInput.value) || 1) * 2) / 2));
    ensureCenterGuides().thickness = val;
    const label = document.getElementById("prefCenterGuidesThicknessVal");
    if (label) label.textContent = `${val} px`;
    saveUserPreferences();
    renderAll();
  });
  const cguidesColorBtn = document.getElementById("prefCenterGuidesColorBtn");
  cguidesColorBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const curHex = state.centerGuidesConfig?.color || "#ef4444";
    openCustomRgbaPopover(cguidesColorBtn, curHex, (newHex) => {
      const cfg = ensureCenterGuides();
      cfg.color = newHex;
      cfg.autoColor = false;
      const autoEl = /** @type {HTMLInputElement|null} */ (document.getElementById("chkPrefCenterGuidesAutoColor"));
      if (autoEl) autoEl.checked = false;
      cguidesColorBtn.style.opacity = "1";
      syncSwatchButton("prefCenterGuidesColorBtn", newHex);
      saveUserPreferences();
      renderAll();
    });
  });

  const ensureGuidesOverlay = () => {
    if (!state.guidesOverlayConfig) state.guidesOverlayConfig = { ...DEFAULT_USER_PREFS.guidesOverlayConfig };
    return state.guidesOverlayConfig;
  };
  bindCheck("chkPrefOverlaysAutoColor", (v) => {
    ensureGuidesOverlay().autoColor = v;
    const mBtn = document.getElementById("prefMeasureColorBtn");
    const rBtn = document.getElementById("prefResizeColorBtn");
    if (mBtn) mBtn.style.opacity = v ? "0.45" : "1";
    if (rBtn) rBtn.style.opacity = v ? "0.45" : "1";
  });
  const bindOverlayColor = (btnId, key, fallback) => {
    const btn = document.getElementById(btnId);
    btn?.addEventListener("click", (e) => {
      e.stopPropagation();
      const curHex = state.guidesOverlayConfig?.[key] || fallback;
      openCustomRgbaPopover(btn, curHex, (newHex) => {
        const cfg = ensureGuidesOverlay();
        cfg[key] = newHex;
        cfg.autoColor = false;
        const autoEl = /** @type {HTMLInputElement|null} */ (document.getElementById("chkPrefOverlaysAutoColor"));
        if (autoEl) autoEl.checked = false;
        const mBtn = document.getElementById("prefMeasureColorBtn");
        const rBtn = document.getElementById("prefResizeColorBtn");
        if (mBtn) mBtn.style.opacity = "1";
        if (rBtn) rBtn.style.opacity = "1";
        syncSwatchButton(btnId, newHex);
        saveUserPreferences();
        renderAll();
      });
    });
  };
  bindOverlayColor("prefMeasureColorBtn", "measureColor", "#f59e0b");
  bindOverlayColor("prefResizeColorBtn", "resizeColor", "#38bdf8");
  const ovThickInput = /** @type {HTMLInputElement|null} */ (document.getElementById("prefOverlaysThickness"));
  ovThickInput?.addEventListener("input", () => {
    const val = Math.max(0.5, Math.min(3, Math.round((Number(ovThickInput.value) || 1.5) * 2) / 2));
    ensureGuidesOverlay().thickness = val;
    const label = document.getElementById("prefOverlaysThicknessVal");
    if (label) label.textContent = `${val} px`;
    saveUserPreferences();
    renderAll();
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

}
