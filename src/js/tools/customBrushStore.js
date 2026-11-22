/**
 * customBrushStore.js: Almacenamiento, selección, captura desde selección e import/export JSON de pinceles personalizados.
 */

import { state, getGridDims, notify } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { isInsideSelection } from "./tools.js";
import { setStatus } from "../ui/status.js";
import { setTool, setBrushSize } from "../ui/toolsUI.js";
import { i18n } from "../i18n/I18nService.js";

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
 * Calcula el tamaño nativo 1:1 en px del pincel personalizado.
 * @param {{w?: number, h?: number}|null} brush
 * @returns {number}
 */
export function getBrushNativeSize(brush) {
  return Math.max(1, Math.round(Math.max(brush?.w || 1, brush?.h || 1)));
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
    const selTools = new Set(["select", "ellipseSelect", "lasso", "magicSelect"]);
    if (!selTools.has(state.currentTool)) {
      setTool("select");
    }
    setStatus({ key: "brush.select_area" });
    return;
  }
  state.pendingBrushFromSelection = false;
  const { x, y, w, h } = state.selection;
  const { w: gw, h: gh } = getGridDims();
  const captured = [];
  let minC = Infinity;
  let maxC = -Infinity;
  let minR = Infinity;
  let maxR = -Infinity;

  for (let r = 0; r < h; r++) {
    const gy = y + r;
    if (gy < 0 || gy >= gh) continue;
    for (let c = 0; c < w; c++) {
      const gx = x + c;
      if (gx < 0 || gx >= gw) continue;
      if (!isInsideSelection(gx, gy)) continue;
      const idx = state.grid[gy]?.[gx] ?? 0;
      if (!idx || idx === 0) continue;
      const hex = state.paletteMap[idx] || "#ffffff";
      captured.push({ c, r, hex });
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
    }
  }

  if (captured.length === 0) {
    setStatus({ key: "brush.no_opaque" }, true);
    return;
  }

  // Recorta el aire transparente de los bordes para que w/h reflejen el tamaño real del sello.
  const trimmedW = maxC - minC + 1;
  const trimmedH = maxR - minR + 1;
  const halfW = Math.floor(trimmedW / 2);
  const halfH = Math.floor(trimmedH / 2);
  const pixels = captured.map(({ c, r, hex }) => ({
    dx: c - minC - halfW,
    dy: r - minR - halfH,
    hex,
  }));

  const brush = {
    id: `brush_${Date.now()}`,
    name: i18n.t("default.brush_name", { n: (state.customBrushes?.length || 0) + 1 }),
    w: trimmedW,
    h: trimmedH,
    pixels,
  };
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
    params: { w: trimmedW, h: trimmedH, px: getBrushNativeSize(brush) },
  });
}

/**
 * Elimina un pincel personalizado por ID.
 * @param {string} brushId
 */
export function deleteCustomBrush(brushId) {
  state.customBrushes = (state.customBrushes || []).filter((b) => b.id !== brushId);
  if (state.activeCustomBrushId === brushId) {
    state.activeCustomBrushId = null;
  }
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
  const list = state.customBrushes || [];
  if (!list.length) {
    setStatus({ key: "brush.none_to_export" }, true);
    return;
  }
  const payload = {
    app: "Spritium",
    type: "custom_brushes",
    version: 1,
    brushes: list,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "spritium_brushes.sbrush.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus({ key: "brush.exported", params: { count: list.length } });
}

/**
 * Importa pinceles personalizados desde un archivo .sbrush.json.
 * @param {File} file
 */
export async function importCustomBrushesFile(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data?.brushes) ? data.brushes : Array.isArray(data) ? data : [];
    const valid = list.filter((b) => b && Array.isArray(b.pixels) && b.pixels.length > 0);
    if (!valid.length) throw new Error("Archivo sin pinceles válidos.");
    if (!Array.isArray(state.customBrushes)) state.customBrushes = [];
    for (const b of valid) {
      state.customBrushes.push({
        id: `brush_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: String(b.name || i18n.t("default.imported_name")).slice(0, 24),
        w: Number(b.w) || 4,
        h: Number(b.h) || 4,
        pixels: b.pixels,
      });
    }
    saveUserBrushes();
    notify("brushes:changed");
    setStatus({ key: "brush.imported", params: { count: valid.length } });
  } catch (err) {
    setStatus({ key: "brush.import_err", params: { msg: err.message } }, true);
  }
}
