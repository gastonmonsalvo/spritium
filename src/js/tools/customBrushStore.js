/**
 * customBrushStore.js: Almacenamiento, selección, captura desde selección e import/export JSON de pinceles personalizados.
 */

import { state, getGridDims, notify } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { isInsideSelection } from "./tools.js";
import { setStatus } from "../ui/status.js";
import { setTool, setBrushSize } from "../ui/toolsUI.js";
import { i18n } from "../i18n/I18nService.js";
import {
  getBrushNativeSize,
  extractBrushFromGridSelection,
  removeCustomBrushFromList,
  buildCustomBrushesExportPayload,
  parseCustomBrushesPayload,
} from "./customBrushCore.js";

export { getBrushNativeSize };

const CUSTOM_BRUSHES_KEY = "spritium_custom_brushes_v1";

export const BUILTIN_BRUSH_PATTERNS = [
  { id: "solid", labelKey: "brush.pat_solid", titleKey: "brush.pat_solid_title" },
  { id: "checker", labelKey: "brush.pat_checker", titleKey: "brush.pat_checker_title" },
  { id: "diag", labelKey: "brush.pat_diag", titleKey: "brush.pat_diag_title" },
  { id: "dots", labelKey: "brush.pat_dots", titleKey: "brush.pat_dots_title" },
];

/**
 * Carga los pinceles personalizados desde localStorage en `state.customBrushes`.
 */
export function loadUserBrushes() {
  try {
    const raw = localStorage.getItem(CUSTOM_BRUSHES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    state.customBrushes = Array.isArray(parsed) ? parsed : [];
  } catch {
    state.customBrushes = [];
  }
}

/**
 * Persiste `state.customBrushes` en localStorage.
 */
export function saveUserBrushes() {
  try {
    localStorage.setItem(CUSTOM_BRUSHES_KEY, JSON.stringify(state.customBrushes));
  } catch {
    // ignore quota
  }
}

/**
 * Devuelve el pincel personalizado activo o null si se usa un pincel estándar.
 */
export function getActiveCustomBrush() {
  if (!state.activeCustomBrushId) return null;
  return (state.customBrushes || []).find((b) => b.id === state.activeCustomBrushId) || null;
}

/**
 * Activa un patrón de pincel integrado y deselecciona el pincel custom.
 * @param {string} patternId
 */
export function setBrushPattern(patternId) {
  state.activeCustomBrushId = null;
  state.activeBrushPattern = patternId || "solid";
  setBrushSize(state.brushSize, false);
  notify("brushes:active");
  const patObj = BUILTIN_BRUSH_PATTERNS.find((p) => p.id === state.activeBrushPattern);
  setStatus(patObj ? { key: patObj.labelKey } : { key: "brush.pat_solid" });
}

/**
 * Selecciona o alterna un pincel personalizado por ID.
 * @param {string} brushId
 */
export function selectCustomBrush(brushId) {
  if (state.activeCustomBrushId === brushId) {
    state.activeCustomBrushId = null;
  } else {
    state.activeCustomBrushId = brushId;
    state.activeBrushPattern = "solid";
    state.customBrushMode = "color";
  }
  const b = getActiveCustomBrush();
  if (b) {
    setBrushSize(getBrushNativeSize(b), false);
  } else {
    setBrushSize(state.brushSize, false);
  }
  notify("brushes:active");
  setStatus(
    b
      ? {
          key: "brush.custom_active",
          params: { name: b.name, w: b.w, h: b.h, px: getBrushNativeSize(b) },
        }
      : { key: "brush.standard" },
  );
}

/**
 * Alterna el modo de color del pincel personalizado entre color original y tinta.
 */
export function toggleCustomBrushColorMode() {
  state.customBrushMode = state.customBrushMode === "color" ? "tint" : "color";
  notify("brushes:changed");
  setStatus(
    state.customBrushMode === "color"
      ? { key: "brush.mode_orig" }
      : { key: "brush.mode_tint" },
  );
}

/**
 * Crea un pincel personalizado a partir de la selección actual en el lienzo.
 */
export function createBrushFromSelection() {
  if (!state.selection) {
    state.pendingBrushFromSelection = true;
    const selTools = new Set(["select", "ellipseSelect", "triangleSelect", "lasso", "magicSelect"]);
    if (!selTools.has(state.currentTool)) {
      setTool("select");
    }
    setStatus({ key: "brush.select_area" });
    return;
  }
  state.pendingBrushFromSelection = false;
  const brush = extractBrushFromGridSelection({
    grid: state.grid,
    paletteMap: state.paletteMap,
    selection: state.selection,
    dims: getGridDims(),
    isInsideSelectionFn: isInsideSelection,
    name: i18n.t("default.brush_name", { n: (state.customBrushes?.length || 0) + 1 }),
  });

  if (!brush) {
    setStatus({ key: "brush.no_opaque" }, true);
    return;
  }
  if (!Array.isArray(state.customBrushes)) state.customBrushes = [];
  state.customBrushes.push(brush);
  saveUserBrushes();
  state.activeCustomBrushId = brush.id;
  state.activeBrushPattern = "solid";
  state.customBrushMode = "color";
  state.selection = null;
  setTool("pencil");
  setBrushSize(getBrushNativeSize(brush), false);
  notify("brushes:changed");
  renderAll();
  setStatus({
    key: "brush.created",
    params: { w: brush.w, h: brush.h, px: getBrushNativeSize(brush) },
  });
}

/**
 * Elimina un pincel personalizado por ID.
 * @param {string} brushId
 */
export function deleteCustomBrush(brushId) {
  const res = removeCustomBrushFromList(state.customBrushes || [], state.activeCustomBrushId, brushId);
  state.customBrushes = res.customBrushes;
  state.activeCustomBrushId = res.activeCustomBrushId;
  saveUserBrushes();
  notify("brushes:changed");
}

/**
 * Elimina todos los pinceles personalizados persistidos y limpia el estado.
 */
export function resetUserBrushes() {
  state.customBrushes = [];
  state.activeCustomBrushId = null;
  try {
    localStorage.removeItem(CUSTOM_BRUSHES_KEY);
  } catch {
    // ignore
  }
  notify("brushes:changed");
}

/**
 * Exporta todos los pinceles personalizados a .sbrush.json.
 */
export function exportCustomBrushes() {
  const payload = buildCustomBrushesExportPayload(state.customBrushes || []);
  if (!payload) {
    setStatus({ key: "brush.none_to_export" }, true);
    return;
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "spritium_brushes.sbrush.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus({ key: "brush.exported", params: { count: payload.brushes.length } });
}

/**
 * Importa pinceles personalizados desde un archivo .sbrush.json.
 * @param {File} file
 */
export async function importCustomBrushesFile(file) {
  if (!file) return;
  try {
    const imported = parseCustomBrushesPayload(await file.text(), i18n.t("default.imported_name"));
    if (!Array.isArray(state.customBrushes)) state.customBrushes = [];
    state.customBrushes.push(...imported);
    saveUserBrushes();
    notify("brushes:changed");
    setStatus({ key: "brush.imported", params: { count: imported.length } });
  } catch (err) {
    setStatus({ key: "brush.import_err", params: { msg: err.message } }, true);
  }
}
