/**
 * preferencesStore.js: Schema, normalización, persistencia en localStorage y sincronización de estado de preferencias.
 */

import { state, notify } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { refreshCanvasToolCursor } from "./cursors.js";

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
  customGrid: Object.freeze({
    enabled: false,
    w: 16,
    h: 16,
    color: "#8b5cf6",
    autoColor: true,
    thickness: 1,
    opacity: 0.45,
    snap: false,
    lockCell: false,
  }),
  centerGuidesConfig: Object.freeze({
    color: "#ef4444",
    autoColor: true,
    thickness: 1,
    opacity: 0.45,
    oddHalfLine: false,
  }),
  guidesOverlayConfig: Object.freeze({
    autoColor: true,
    measureColor: "#f59e0b",
    resizeColor: "#38bdf8",
    thickness: 1.5,
  }),
  baseGridConfig: Object.freeze({
    mode: "adaptive",
    stepX: 8,
    stepY: 8,
    checkerContrast: 14,
  }),
});

function isHexColor(v) {
  return typeof v === "string" && /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v.trim());
}

/**
 * Convierte un color hexadecimal `#rrggbb` o `#rrggbbaa` a `rgba(...)` CSS.
 * @param {string} hex
 * @returns {string}
 */
export function hexToCssRgba(hex) {
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
  const cgrid = raw?.customGrid || {};
  const cguides = raw?.centerGuidesConfig || {};
  const goverlays = raw?.guidesOverlayConfig || {};
  const bgrid = raw?.baseGridConfig || {};
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
    customGrid: {
      enabled: typeof cgrid.enabled === "boolean" ? cgrid.enabled : DEFAULT_USER_PREFS.customGrid.enabled,
      w: Math.max(2, Math.min(256, Math.round(Number(cgrid.w ?? DEFAULT_USER_PREFS.customGrid.w) || 16))),
      h: Math.max(2, Math.min(256, Math.round(Number(cgrid.h ?? DEFAULT_USER_PREFS.customGrid.h) || 16))),
      color: isHexColor(cgrid.color) ? cgrid.color.trim() : DEFAULT_USER_PREFS.customGrid.color,
      autoColor: typeof cgrid.autoColor === "boolean" ? cgrid.autoColor : DEFAULT_USER_PREFS.customGrid.autoColor,
      thickness: Math.max(1, Math.min(3, Math.round((Number(cgrid.thickness ?? DEFAULT_USER_PREFS.customGrid.thickness) || 1) * 2) / 2)),
      opacity: Math.max(0.1, Math.min(1, Number(cgrid.opacity ?? DEFAULT_USER_PREFS.customGrid.opacity) || 0.45)),
      snap: typeof cgrid.snap === "boolean" ? cgrid.snap : DEFAULT_USER_PREFS.customGrid.snap,
      lockCell: typeof cgrid.lockCell === "boolean" ? cgrid.lockCell : DEFAULT_USER_PREFS.customGrid.lockCell,
    },
    centerGuidesConfig: {
      color: isHexColor(cguides.color) ? cguides.color.trim() : DEFAULT_USER_PREFS.centerGuidesConfig.color,
      autoColor: typeof cguides.autoColor === "boolean" ? cguides.autoColor : DEFAULT_USER_PREFS.centerGuidesConfig.autoColor,
      thickness: Math.max(0.5, Math.min(3, Math.round((Number(cguides.thickness ?? DEFAULT_USER_PREFS.centerGuidesConfig.thickness) || 1) * 2) / 2)),
      opacity: Math.max(0.1, Math.min(1, Number(cguides.opacity ?? DEFAULT_USER_PREFS.centerGuidesConfig.opacity) || 0.45)),
      oddHalfLine: typeof cguides.oddHalfLine === "boolean" ? cguides.oddHalfLine : DEFAULT_USER_PREFS.centerGuidesConfig.oddHalfLine,
    },
    guidesOverlayConfig: {
      autoColor: typeof goverlays.autoColor === "boolean" ? goverlays.autoColor : DEFAULT_USER_PREFS.guidesOverlayConfig.autoColor,
      measureColor: isHexColor(goverlays.measureColor) ? goverlays.measureColor.trim() : DEFAULT_USER_PREFS.guidesOverlayConfig.measureColor,
      resizeColor: isHexColor(goverlays.resizeColor) ? goverlays.resizeColor.trim() : DEFAULT_USER_PREFS.guidesOverlayConfig.resizeColor,
      thickness: Math.max(0.5, Math.min(3, Math.round((Number(goverlays.thickness ?? DEFAULT_USER_PREFS.guidesOverlayConfig.thickness) || 1.5) * 2) / 2)),
    },
    baseGridConfig: {
      mode: bgrid.mode === "fixed" ? "fixed" : "adaptive",
      stepX: Math.max(1, Math.min(128, Math.round(Number(bgrid.stepX ?? bgrid.step ?? DEFAULT_USER_PREFS.baseGridConfig.stepX) || 8))),
      stepY: Math.max(1, Math.min(128, Math.round(Number(bgrid.stepY ?? bgrid.step ?? DEFAULT_USER_PREFS.baseGridConfig.stepY) || 8))),
      checkerContrast: Math.max(4, Math.min(64, Math.round(Number(bgrid.checkerContrast ?? DEFAULT_USER_PREFS.baseGridConfig.checkerContrast) || 14))),
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
    customGrid: state.customGrid,
    centerGuidesConfig: state.centerGuidesConfig,
    guidesOverlayConfig: state.guidesOverlayConfig,
    baseGridConfig: state.baseGridConfig,
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
  toggleActive("menuCustomGrid", Boolean(state.customGrid?.enabled));
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
  state.customGrid = { ...prefs.customGrid };
  state.centerGuidesConfig = { ...prefs.centerGuidesConfig };
  state.guidesOverlayConfig = { ...prefs.guidesOverlayConfig };
  state.baseGridConfig = { ...prefs.baseGridConfig };

  if (persist) saveUserPreferences();
  syncViewTogglesUI();
  notify("prefs:changed");
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
