/**
 * preferences.js: Preferencias de usuario persistentes (Mira del Mouse estilo CS, Vista Previa de Píxel, Grilla, Reglas).
 */

import { state } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { setStatus } from "./status.js";
import { refreshCanvasToolCursor, getReticleSvgBody } from "./cursors.js";
import { openCustomRgbaPopover, closeRgbaPopover } from "./rgbaPopover.js";

export const USER_PREFS_STORAGE_KEY = "spritium_user_prefs_v1";

export const DEFAULT_USER_PREFS = Object.freeze({
  showPixelCursor: false,
  showGrid: true,
  showCenterGuides: true,
  showCenterRulerMarks: true,
  showRulers: true,
  showGridCoords: false,
  pixelCursorConfig: Object.freeze({
    opacity: 0.75,
    lineWidth: 1,
    useActiveColor: true,
    fillUseActiveColor: true,
    activeColorAlpha: 0.75,
    color: "#38bdf8ee",
    eraserColor: "#f87171ee",
    fillPreviewColor: "#38bdf838",
    magicPreviewColor: "#f472b644",
    bgEraserPreviewColor: "#fb718544",
    fillPreview: true,
    showCenterDot: true,
  }),
  reticleConfig: Object.freeze({
    shape: "crosshair",
    color: "#ffffffff",
    size: 6,
    thickness: 1.5,
    gap: 2,
    dot: true,
    outline: true,
  }),
  gridCoordsConfig: Object.freeze({
    color: "#38bdf8",
    opacity: 0.14,
    showGuides: true,
    showBadge: true,
  }),
});

function isHexColor(v) {
  return typeof v === "string" && /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v.trim());
}

function hexToCssRgba(hex) {
  const clean = String(hex || "").replace("#", "").trim();
  if (clean.length !== 6 && clean.length !== 8) return "rgba(56, 189, 248, 1)";
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  const a = clean.length === 8 ? (parseInt(clean.slice(6, 8), 16) ?? 255) / 255 : 1;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

/**
 * Normaliza un objeto de preferencias asegurando límites válidos.
 * @param {any} raw
 */
export function normalizeUserPreferences(raw) {
  const cfg = raw?.pixelCursorConfig || {};
  const ret = raw?.reticleConfig || {};
  const gcoords = raw?.gridCoordsConfig || {};
  const opacity = Math.max(0.2, Math.min(1, Number(cfg.opacity ?? DEFAULT_USER_PREFS.pixelCursorConfig.opacity) || 0.75));
  const activeColorAlpha = Math.max(0.1, Math.min(1, Number(cfg.activeColorAlpha ?? DEFAULT_USER_PREFS.pixelCursorConfig.activeColorAlpha) || 0.75));
  const gcOpacity = Math.max(0.05, Math.min(0.6, Number(gcoords.opacity ?? DEFAULT_USER_PREFS.gridCoordsConfig.opacity) || 0.14));
  const lineWidth = Math.max(0.75, Math.min(2.5, Number(cfg.lineWidth ?? DEFAULT_USER_PREFS.pixelCursorConfig.lineWidth) || 1));

  const validShapes = new Set(["crosshair", "circle", "square", "dot"]);
  const shape = validShapes.has(ret.shape) ? ret.shape : "crosshair";
  const size = Math.max(3, Math.min(10, Number(ret.size ?? DEFAULT_USER_PREFS.reticleConfig.size) || 6));
  const thickness = Math.max(1, Math.min(3, Number(ret.thickness ?? DEFAULT_USER_PREFS.reticleConfig.thickness) || 1.5));
  const gap = Math.max(0, Math.min(5, Number(ret.gap ?? DEFAULT_USER_PREFS.reticleConfig.gap)));

  return {
    showPixelCursor: typeof raw?.showPixelCursor === "boolean" ? raw.showPixelCursor : DEFAULT_USER_PREFS.showPixelCursor,
    showGrid: typeof raw?.showGrid === "boolean" ? raw.showGrid : DEFAULT_USER_PREFS.showGrid,
    showCenterGuides: typeof raw?.showCenterGuides === "boolean" ? raw.showCenterGuides : DEFAULT_USER_PREFS.showCenterGuides,
    showCenterRulerMarks: typeof raw?.showCenterRulerMarks === "boolean" ? raw.showCenterRulerMarks : DEFAULT_USER_PREFS.showCenterRulerMarks,
    showRulers: typeof raw?.showRulers === "boolean" ? raw.showRulers : DEFAULT_USER_PREFS.showRulers,
    showGridCoords: typeof raw?.showGridCoords === "boolean" ? raw.showGridCoords : DEFAULT_USER_PREFS.showGridCoords,
    pixelCursorConfig: {
      opacity,
      lineWidth,
      useActiveColor:
        typeof cfg.useActiveColor === "boolean"
          ? cfg.useActiveColor
          : DEFAULT_USER_PREFS.pixelCursorConfig.useActiveColor,
      fillUseActiveColor:
        typeof cfg.fillUseActiveColor === "boolean"
          ? cfg.fillUseActiveColor
          : DEFAULT_USER_PREFS.pixelCursorConfig.fillUseActiveColor,
      activeColorAlpha,
      color: isHexColor(cfg.color) ? cfg.color.trim() : DEFAULT_USER_PREFS.pixelCursorConfig.color,
      eraserColor: isHexColor(cfg.eraserColor) ? cfg.eraserColor.trim() : DEFAULT_USER_PREFS.pixelCursorConfig.eraserColor,
      fillPreviewColor: isHexColor(cfg.fillPreviewColor) ? cfg.fillPreviewColor.trim() : DEFAULT_USER_PREFS.pixelCursorConfig.fillPreviewColor,
      magicPreviewColor: isHexColor(cfg.magicPreviewColor) ? cfg.magicPreviewColor.trim() : DEFAULT_USER_PREFS.pixelCursorConfig.magicPreviewColor,
      bgEraserPreviewColor: isHexColor(cfg.bgEraserPreviewColor) ? cfg.bgEraserPreviewColor.trim() : DEFAULT_USER_PREFS.pixelCursorConfig.bgEraserPreviewColor,
      fillPreview: typeof cfg.fillPreview === "boolean" ? cfg.fillPreview : DEFAULT_USER_PREFS.pixelCursorConfig.fillPreview,
      showCenterDot: typeof cfg.showCenterDot === "boolean" ? cfg.showCenterDot : DEFAULT_USER_PREFS.pixelCursorConfig.showCenterDot,
    },
    reticleConfig: {
      shape,
      color: isHexColor(ret.color) ? ret.color.trim() : DEFAULT_USER_PREFS.reticleConfig.color,
      size,
      thickness,
      gap: Number.isFinite(gap) ? gap : 2,
      dot: typeof ret.dot === "boolean" ? ret.dot : DEFAULT_USER_PREFS.reticleConfig.dot,
      outline: typeof ret.outline === "boolean" ? ret.outline : DEFAULT_USER_PREFS.reticleConfig.outline,
    },
    gridCoordsConfig: {
      color: isHexColor(gcoords.color) ? gcoords.color.trim() : DEFAULT_USER_PREFS.gridCoordsConfig.color,
      opacity: gcOpacity,
      showGuides: typeof gcoords.showGuides === "boolean" ? gcoords.showGuides : DEFAULT_USER_PREFS.gridCoordsConfig.showGuides,
      showBadge: typeof gcoords.showBadge === "boolean" ? gcoords.showBadge : DEFAULT_USER_PREFS.gridCoordsConfig.showBadge,
    },
  };
}

/**
 * Devuelve un snapshot serializable de las preferencias actuales del usuario.
 */
export function getUserPreferencesPayload() {
  return normalizeUserPreferences({
    showPixelCursor: state.showPixelCursor,
    showGrid: state.showGrid,
    showCenterGuides: state.showCenterGuides,
    showCenterRulerMarks: state.showCenterRulerMarks,
    showRulers: state.showRulers,
    showGridCoords: state.showGridCoords,
    pixelCursorConfig: state.pixelCursorConfig,
    reticleConfig: state.reticleConfig,
    gridCoordsConfig: state.gridCoordsConfig,
  });
}

/**
 * Sincroniza los indicadores del menú Vista y botones de barra con el estado actual.
 */
export function syncViewTogglesUI() {
  const toggleActive = (id, active) => {
    document.getElementById(id)?.classList.toggle("active", Boolean(active));
  };
  toggleActive("menuGrid", state.showGrid !== false);
  toggleActive("menuCenterGuides", state.showCenterGuides !== false);
  toggleActive("menuCenterRulerMarks", state.showCenterRulerMarks !== false);
  toggleActive("menuRulers", state.showRulers !== false);
  toggleActive("menuGridCoords", Boolean(state.showGridCoords));
  toggleActive("menuPixelCursor", Boolean(state.showPixelCursor));
  toggleActive("menuMirrorH", Boolean(state.mirrorH));
  toggleActive("menuMirrorV", Boolean(state.mirrorV));
  toggleActive("menuMirrorDiagMain", Boolean(state.mirrorDiagMain));
  toggleActive("menuMirrorDiagAnti", Boolean(state.mirrorDiagAnti));
  toggleActive("menuMirrorRadial90", state.mirrorRadial === "rot90");
  toggleActive("menuMirrorRadial45", state.mirrorRadial === "oct45");
  toggleActive("menuLeftPanel", !document.getElementById("sidebar")?.classList.contains("collapsed"));
  toggleActive("menuRightPanel", !document.getElementById("rightSidebar")?.classList.contains("collapsed"));
  toggleActive("menuBottomPanel", !document.getElementById("moduleFrames")?.classList.contains("collapsed"));

  const gridBtn = document.getElementById("btnToggleGrid");
  if (gridBtn) gridBtn.classList.toggle("active", state.showGrid !== false);
}

/**
 * Aplica un objeto de preferencias al estado activo y actualiza la UI.
 * @param {any} raw
 * @param {{persist?: boolean}} [options]
 */
export function applyUserPreferencesObject(raw, { persist = true } = {}) {
  const prefs = normalizeUserPreferences(raw);
  state.showPixelCursor = prefs.showPixelCursor;
  state.showGrid = prefs.showGrid;
  state.showCenterGuides = prefs.showCenterGuides;
  state.showCenterRulerMarks = prefs.showCenterRulerMarks;
  state.showRulers = prefs.showRulers;
  state.showGridCoords = prefs.showGridCoords;
  state.pixelCursorConfig = { ...prefs.pixelCursorConfig };
  state.reticleConfig = { ...prefs.reticleConfig };
  state.gridCoordsConfig = { ...prefs.gridCoordsConfig };

  if (persist) saveUserPreferences();
  syncViewTogglesUI();
  syncPreferencesModalControls();
  refreshCanvasToolCursor();
  renderAll();
}

/**
 * Guarda las preferencias actuales en localStorage.
 */
export function saveUserPreferences() {
  try {
    localStorage.setItem(USER_PREFS_STORAGE_KEY, JSON.stringify(getUserPreferencesPayload()));
  } catch {
    // ignore storage quota/privacy errors
  }
}

/**
 * Carga preferencias persistidas desde localStorage al iniciar la app.
 */
export function loadUserPreferences() {
  try {
    const raw = localStorage.getItem(USER_PREFS_STORAGE_KEY);
    if (!raw) {
      syncViewTogglesUI();
      refreshCanvasToolCursor();
      return;
    }
    applyUserPreferencesObject(JSON.parse(raw), { persist: false });
  } catch {
    syncViewTogglesUI();
    refreshCanvasToolCursor();
  }
}

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
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(val);
  };
  const setVal = (id, val) => {
    const el = document.getElementById(id);
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

  const bindCheck = (id, applyFn, refreshReticle = false) => {
    const el = document.getElementById(id);
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
  const shapeSelect = document.getElementById("prefReticleShape");
  shapeSelect?.addEventListener("change", () => {
    state.reticleConfig.shape = shapeSelect.value || "crosshair";
    saveUserPreferences();
    renderReticlePreview();
    refreshCanvasToolCursor();
  });

  const bindReticleRange = (inputId, valId, key) => {
    const el = document.getElementById(inputId);
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

  const gcOpInput = document.getElementById("prefGridCoordsOpacity");
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

  const lwInput = document.getElementById("prefCursorLineWidth");
  lwInput?.addEventListener("input", () => {
    const val = Math.max(0.75, Math.min(2.5, Number(lwInput.value) || 1));
    state.pixelCursorConfig.lineWidth = val;
    const label = document.getElementById("prefCursorLineWidthVal");
    if (label) label.textContent = `${val.toFixed(2).replace(/\.00$/, "")} px`;
    saveUserPreferences();
    renderAll();
  });

  const activeAlphaInput = document.getElementById("prefCursorActiveAlpha");
  activeAlphaInput?.addEventListener("input", () => {
    const pct = Math.max(10, Math.min(100, Number(activeAlphaInput.value) || 75));
    state.pixelCursorConfig.activeColorAlpha = pct / 100;
    const label = document.getElementById("prefCursorActiveAlphaVal");
    if (label) label.textContent = `${pct}%`;
    saveUserPreferences();
    renderAll();
  });

  const opInput = document.getElementById("prefCursorOpacity");
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
