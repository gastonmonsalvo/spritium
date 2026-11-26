// @ts-check
/**
 * actionAvailability.js: Guardas declarativas contextuales para habilitar/deshabilitar
 * botones y ítems de menú según el estado actual del editor.
 */

import { state, subscribe } from "../core/state.js";
import { hasPaintedPixels } from "../core/color.js";
import { i18n } from "../i18n/I18nService.js";

/**
 * Construye el snapshot liviano de capacidades del editor en el frame actual.
 * @returns {{
 *   hasPixels: boolean,
 *   hasActiveLayerPixels: boolean,
 *   hasSelection: boolean,
 *   isLocked: boolean,
 *   isFolder: boolean,
 *   frameCount: number,
 *   layerCount: number,
 *   canUndo: boolean,
 *   canRedo: boolean,
 * }}
 */
export function buildActionContext() {
  const activeLayer = state.layers?.[state.activeLayerIndex];
  const isFolder = activeLayer?.type === "folder";
  const hasActiveLayerPixels =
    (!isFolder && hasPaintedPixels(activeLayer?.grid)) ||
    hasPaintedPixels(state.grid);
  const hasPixels =
    hasActiveLayerPixels ||
    (Array.isArray(state.layers) && state.layers.some((l) => l?.type !== "folder" && hasPaintedPixels(l?.grid))) ||
    (Array.isArray(state.frames) && state.frames.some((f) => Array.isArray(f?.layers) && f.layers.some((l) => l?.type !== "folder" && hasPaintedPixels(l?.grid))));
  return {
    hasPixels,
    hasActiveLayerPixels,
    hasSelection: Boolean(state.selection),
    isLocked: Boolean(activeLayer?.locked),
    isFolder,
    frameCount: state.frames?.length || 1,
    layerCount: state.layers?.length || 1,
    canUndo: (state.undoStack?.length || 0) > 0,
    canRedo: (state.redoStack?.length || 0) > 0,
  };
}

const requireEditableLayer = (c) =>
  (!c.isLocked && !c.isFolder) || (c.isFolder ? "guard.folder_active" : "guard.layer_locked");

const requireActiveLayerPixelsAndEditable = (c) => {
  const layerErr = requireEditableLayer(c);
  if (layerErr !== true) return layerErr;
  return c.hasActiveLayerPixels || "guard.empty_layer";
};

/** Tabla declarativa de guardas: retorna `true` o la clave i18n del motivo de bloqueo. */
export const ACTION_GUARDS = {
  undo: (c) => c.canUndo || "guard.no_undo",
  redo: (c) => c.canRedo || "guard.no_redo",
  downloadCurrent: (c) => c.hasPixels || "guard.empty_canvas",
  openExportModal: (c) => c.hasPixels || "guard.empty_canvas",
  exportPureSpritesheetPng: (c) => c.hasPixels || "guard.empty_canvas",
  exportPackedAtlas: (c) => c.hasPixels || "guard.empty_canvas",
  openNormalMapModal: (c) => c.hasPixels || "guard.empty_canvas",
  openDropShadowModal: (c) => c.hasPixels || "guard.empty_canvas",
  openNoiseModal: requireEditableLayer,
  openHslModal: requireActiveLayerPixelsAndEditable,
  outlineAction: requireActiveLayerPixelsAndEditable,
  invertColorsAction: requireActiveLayerPixelsAndEditable,
  startFreeTransform: requireActiveLayerPixelsAndEditable,
  rotSpriteAction: requireActiveLayerPixelsAndEditable,
  deleteActiveFrame: (c) => c.frameCount > 1 || "guard.single_frame",
  deleteActiveLayer: (c) => c.layerCount > 1 || "guard.single_layer",
  deselectAction: (c) => c.hasSelection || "guard.no_selection",
};

/**
 * Evalúa si una acción está habilitada bajo el contexto dado.
 * @param {string} action
 * @param {ReturnType<typeof buildActionContext>} ctx
 * @returns {{ enabled: boolean, reasonKey: string|null }}
 */
export function evaluateAction(action, ctx) {
  const guard = ACTION_GUARDS[action];
  if (!guard) return { enabled: true, reasonKey: null };
  const res = guard(ctx);
  return res === true ? { enabled: true, reasonKey: null } : { enabled: false, reasonKey: String(res) };
}

/**
 * Sincroniza `disabled` y `title` de todos los controles `[data-action]` en el DOM.
 */
export function syncActionAvailability() {
  if (typeof document === "undefined") return;
  const ctx = buildActionContext();
  const els = document.querySelectorAll("[data-action]");
  for (const el of els) {
    const action = el.getAttribute("data-action");
    if (!action || !ACTION_GUARDS[action]) continue;
    const { enabled, reasonKey } = evaluateAction(action, ctx);
    if ("disabled" in el) /** @type {HTMLButtonElement} */ (el).disabled = !enabled;
    el.classList.toggle("is-disabled", !enabled);
    el.setAttribute("aria-disabled", String(!enabled));
    if (!enabled && reasonKey) {
      if (!el.hasAttribute("data-orig-title")) {
        el.setAttribute("data-orig-title", el.getAttribute("title") || "");
      }
      el.setAttribute("title", i18n.t(reasonKey));
    } else if (el.hasAttribute("data-orig-title")) {
      const orig = el.getAttribute("data-orig-title") || "";
      if (orig) el.setAttribute("title", orig);
      else el.removeAttribute("title");
      el.removeAttribute("data-orig-title");
    }
  }
}

let initialized = false;
let syncQueued = false;

function scheduleSyncActionAvailability() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    syncActionAvailability();
  });
}

/** Suscribe la sincronización automática de disponibilidad contextual a los eventos del editor. */
export function initActionAvailability() {
  if (initialized) return;
  initialized = true;
  ["history", "dirty", "layers", "frames", "selection", "canvas:rendered"].forEach((topic) => {
    subscribe(topic, scheduleSyncActionAvailability);
  });
  if (typeof window !== "undefined") {
    i18n.addEventListener("langchange", scheduleSyncActionAvailability);
  }
  syncActionAvailability();
}
