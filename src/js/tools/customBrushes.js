/**
 * customBrushes.js: Pinceles personalizados y patrones de dithering a mano alzada.
 * Permite crear pinceles desde la selección activa, persistirlos en localStorage
 * e importarlos/exportarlos en formato JSON (.sbrush.json).
 */

import { state, getGridDims } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { isInsideSelection } from "./tools.js";
import { setStatus } from "../ui/status.js";
import { setTool, setBrushSize } from "../ui/toolsUI.js";
import { i18n } from "../i18n/I18nService.js";

if (typeof window !== "undefined") {
  i18n.addEventListener("langchange", () => renderCustomBrushesUI());
}

const CUSTOM_BRUSHES_KEY = "spritium_custom_brushes_v1";

export const BUILTIN_BRUSH_PATTERNS = [
  { id: "solid", labelKey: "brush.pat_solid", titleKey: "brush.pat_solid_title" },
  { id: "checker", labelKey: "brush.pat_checker", titleKey: "brush.pat_checker_title" },
  { id: "diag", labelKey: "brush.pat_diag", titleKey: "brush.pat_diag_title" },
  { id: "dots", labelKey: "brush.pat_dots", titleKey: "brush.pat_dots_title" },
];

function loadUserBrushes() {
  try {
    const raw = localStorage.getItem(CUSTOM_BRUSHES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    state.customBrushes = Array.isArray(parsed) ? parsed : [];
  } catch {
    state.customBrushes = [];
  }
}

function saveUserBrushes() {
  try {
    localStorage.setItem(CUSTOM_BRUSHES_KEY, JSON.stringify(state.customBrushes));
  } catch {
    // ignore quota
  }
}

/** Devuelve el pincel personalizado activo o null si se usa un pincel estándar. */
export function getActiveCustomBrush() {
  if (!state.activeCustomBrushId) return null;
  return (state.customBrushes || []).find((b) => b.id === state.activeCustomBrushId) || null;
}

/** Activa un patrón de pincel integrado y deselecciona el pincel custom.
 * @param {string} patternId */
export function setBrushPattern(patternId) {
  state.activeCustomBrushId = null;
  state.activeBrushPattern = patternId || "solid";
  setBrushSize(state.brushSize, false);
  syncCustomBrushesActiveUI();
  const patObj = BUILTIN_BRUSH_PATTERNS.find((p) => p.id === state.activeBrushPattern);
  setStatus(patObj ? { key: patObj.labelKey } : { key: "brush.pat_solid" });
}

/** Calcula el tamaño nativo 1:1 en px del pincel personalizado.
 * @param {{w?: number, h?: number}|null} brush
 * @returns {number} */
function getBrushNativeSize(brush) {
  return Math.max(1, Math.round(Math.max(brush?.w || 1, brush?.h || 1)));
}

/** Selecciona o alterna un pincel personalizado por ID.
 * @param {string} brushId */
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
  syncCustomBrushesActiveUI();
  setStatus(
    b
      ? {
          key: "brush.custom_active",
          params: { name: b.name, w: b.w, h: b.h, px: getBrushNativeSize(b) },
        }
      : { key: "brush.standard" },
  );
}

/** Alterna el modo de color del pincel personalizado entre color original y tinta. */
export function toggleCustomBrushColorMode() {
  state.customBrushMode = state.customBrushMode === "color" ? "tint" : "color";
  renderCustomBrushesUI();
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
  renderCustomBrushesUI();
  renderAll();
  setStatus({
    key: "brush.created",
    params: { w: trimmedW, h: trimmedH, px: getBrushNativeSize(brush) },
  });
}

/** Elimina un pincel personalizado por ID.
 * @param {string} brushId */
export function deleteCustomBrush(brushId) {
  state.customBrushes = (state.customBrushes || []).filter((b) => b.id !== brushId);
  if (state.activeCustomBrushId === brushId) {
    state.activeCustomBrushId = null;
  }
  saveUserBrushes();
  renderCustomBrushesUI();
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
  renderCustomBrushesUI();
}

function renameCustomBrushInline(brushId, nameEl) {
  const brush = (state.customBrushes || []).find((b) => b.id === brushId);
  if (!brush || !nameEl || !nameEl.parentElement) return;

  const input = document.createElement("input");
  input.type = "text";
  input.value = brush.name || "";
  input.maxLength = 24;
  input.style.cssText =
    "font-size: 11px; padding: 2px 5px; width: 100%; border-radius: 4px; border: 1px solid var(--border-focus); background: var(--bg-input); color: var(--text-primary); outline: none;";

  let finished = false;
  const commit = (save) => {
    if (finished) return;
    finished = true;
    if (save) {
      const next = input.value.trim();
      if (next && next !== brush.name) {
        brush.name = next.slice(0, 24);
        saveUserBrushes();
        setStatus({ key: "brush.renamed", params: { name: brush.name } });
      }
    }
    renderCustomBrushesUI();
  };

  input.addEventListener("click", (e) => e.stopPropagation());
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") commit(true);
    else if (e.key === "Escape") commit(false);
  });
  input.addEventListener("blur", () => commit(true));

  nameEl.replaceWith(input);
  input.focus();
  input.select();
}

function drawBrushThumbnail(canvasEl, brush) {
  if (!canvasEl || !brush?.pixels?.length) return;
  const cw = canvasEl.width;
  const ch = canvasEl.height;
  const ctx = canvasEl.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, cw, ch);
  ctx.imageSmoothingEnabled = false;

  const bw = Math.max(1, Number(brush.w) || 1);
  const bh = Math.max(1, Number(brush.h) || 1);
  const halfW = Math.floor(bw / 2);
  const halfH = Math.floor(bh / 2);

  const off = document.createElement("canvas");
  off.width = bw;
  off.height = bh;
  const oCtx = off.getContext("2d");
  for (const p of brush.pixels) {
    const sx = p.dx + halfW;
    const sy = p.dy + halfH;
    if (sx < 0 || sy < 0 || sx >= bw || sy >= bh) continue;
    oCtx.fillStyle = p.hex || "#ffffff";
    oCtx.fillRect(sx, sy, 1, 1);
  }

  const scale = Math.min((cw - 2) / bw, (ch - 2) / bh);
  const dw = Math.max(1, Math.round(bw * scale));
  const dh = Math.max(1, Math.round(bh * scale));
  const dx = Math.floor((cw - dw) / 2);
  const dy = Math.floor((ch - dh) / 2);
  ctx.drawImage(off, dx, dy, dw, dh);
}

let isBrushMenuOpen = false;

function positionBrushMenu() {
  const trigger = document.getElementById("btnCustomBrushDropdown");
  const menu = document.getElementById("customBrushDropdownMenu");
  if (!trigger || !menu) return;
  const rect = trigger.getBoundingClientRect();
  menu.style.width = `${Math.max(200, Math.round(rect.width))}px`;
  const menuW = menu.offsetWidth || Math.round(rect.width);
  const menuH = Math.min(280, menu.scrollHeight || 220);
  const left = Math.max(8, Math.min(window.innerWidth - menuW - 8, rect.left));
  const fitsBelow = rect.bottom + 4 + menuH <= window.innerHeight - 8;
  const top = fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - menuH - 4);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

/** Cierra el menú desplegable de pinceles personalizados. */
export function closeCustomBrushMenu() {
  isBrushMenuOpen = false;
  const menu = document.getElementById("customBrushDropdownMenu");
  const trigger = document.getElementById("btnCustomBrushDropdown");
  if (menu) menu.classList.remove("open");
  if (trigger) trigger.setAttribute("aria-expanded", "false");
}

/** Alterna la apertura del menú desplegable de pinceles personalizados.
 * @param {Event} [event] */
export function toggleCustomBrushMenu(event) {
  event?.stopPropagation?.();
  isBrushMenuOpen = !isBrushMenuOpen;
  const menu = document.getElementById("customBrushDropdownMenu");
  const trigger = document.getElementById("btnCustomBrushDropdown");
  if (menu) menu.classList.toggle("open", isBrushMenuOpen);
  if (trigger) trigger.setAttribute("aria-expanded", String(isBrushMenuOpen));
  if (isBrushMenuOpen) {
    positionBrushMenu();
  }
}

/** Exporta todos los pinceles personalizados a .sbrush.json. */
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

/** Importa pinceles personalizados desde un archivo .sbrush.json.
 * @param {File} file */
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
    renderCustomBrushesUI();
    setStatus({ key: "brush.imported", params: { count: valid.length } });
  } catch (err) {
    setStatus({ key: "brush.import_err", params: { msg: err.message } }, true);
  }
}

function syncCustomBrushesActiveUI() {
  const patContainer = document.getElementById("brushPatternPresets");
  if (patContainer) {
    const activePat = state.activeCustomBrushId ? null : state.activeBrushPattern || "solid";
    for (const btn of patContainer.querySelectorAll("[data-pattern-id]")) {
      btn.classList.toggle("active", btn.dataset.patternId === activePat);
    }
  }

  const activeBrush = getActiveCustomBrush();
  const trigger = document.getElementById("btnCustomBrushDropdown");
  const labelEl = document.getElementById("activeCustomBrushLabel");
  const thumbEl = document.getElementById("activeCustomBrushThumb");
  if (trigger) trigger.classList.toggle("has-active", Boolean(activeBrush));
  if (labelEl) {
    labelEl.textContent = activeBrush
      ? `${activeBrush.name} (${activeBrush.w}×${activeBrush.h})`
      : i18n.t("brush.custom_none_count", { count: (state.customBrushes || []).length });
  }
  if (thumbEl) {
    if (activeBrush) {
      thumbEl.style.display = "block";
      drawBrushThumbnail(thumbEl, activeBrush);
    } else {
      thumbEl.style.display = "none";
    }
  }

  const userContainer = document.getElementById("userBrushesList");
  if (userContainer) {
    for (const row of userContainer.querySelectorAll("[data-brush-id]")) {
      row.classList.toggle("active", row.dataset.brushId === state.activeCustomBrushId);
    }
  }

  const modeBtn = document.getElementById("btnCustomBrushMode");
  if (modeBtn) {
    const isColor = state.customBrushMode === "color";
    modeBtn.textContent = i18n.t(isColor ? "brush.mode_btn_color" : "brush.mode_btn_tint");
    modeBtn.classList.toggle("active", isColor);
    modeBtn.style.display = state.activeCustomBrushId ? "inline-flex" : "none";
  }
}

function buildPatternIconSvg(patternId) {
  if (!patternId || patternId === "solid") {
    return '<svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="1"/></svg>';
  }
  if (patternId === "dots") {
    return (
      '<svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">' +
      '<rect x="1.8" y="1.8" width="2.6" height="2.6"/>' +
      '<rect x="7.6" y="1.8" width="2.6" height="2.6"/>' +
      '<rect x="1.8" y="7.6" width="2.6" height="2.6"/>' +
      '<rect x="7.6" y="7.6" width="2.6" height="2.6"/>' +
      "</svg>"
    );
  }
  const rects = [];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const on = patternId === "checker" ? ((x + y) & 1) === 0 : (x + y) % 3 === 0;
      if (on) rects.push(`<rect x="${x * 3}" y="${y * 3}" width="2.4" height="2.4"/>`);
    }
  }
  return `<svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">${rects.join("")}</svg>`;
}

/** Renderiza la grilla de patrones integrados y pinceles personalizados. */
export function renderCustomBrushesUI() {
  const patContainer = document.getElementById("brushPatternPresets");
  if (patContainer) {
    patContainer.innerHTML = "";
    const activePat = state.activeCustomBrushId ? null : state.activeBrushPattern || "solid";
    for (const p of BUILTIN_BRUSH_PATTERNS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.patternId = p.id;
      btn.className = `tool-btn${activePat === p.id ? " active" : ""}`;
      btn.style.cssText = "padding: 4px 2px; display: inline-flex; align-items: center; justify-content: center;";
      const label = i18n.t(p.labelKey);
      const title = i18n.t(p.titleKey);
      btn.title = `${label} — ${title}`;
      btn.setAttribute("aria-label", label);
      btn.innerHTML = buildPatternIconSvg(p.id);
      btn.addEventListener("click", () => setBrushPattern(p.id));
      patContainer.appendChild(btn);
    }
  }

  const userContainer = document.getElementById("userBrushesList");
  if (userContainer) {
    userContainer.innerHTML = "";
    const list = state.customBrushes || [];
    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "brush-picker-empty";
      empty.textContent = i18n.t("brush.empty_list");
      userContainer.appendChild(empty);
    } else {
      for (const b of list) {
        const row = document.createElement("div");
        row.dataset.brushId = b.id;
        row.className = `brush-picker-row${state.activeCustomBrushId === b.id ? " active" : ""}`;

        const itemBtn = document.createElement("button");
        itemBtn.type = "button";
        itemBtn.className = "brush-picker-item-btn";
        const nativePx = getBrushNativeSize(b);
        itemBtn.title = i18n.t("brush.item_title", { name: b.name, w: b.w, h: b.h, px: nativePx });

        const thumb = document.createElement("canvas");
        thumb.className = "brush-thumb-md";
        thumb.width = 24;
        thumb.height = 24;
        drawBrushThumbnail(thumb, b);

        const info = document.createElement("div");
        info.className = "brush-picker-item-info";

        const nameSpan = document.createElement("span");
        nameSpan.className = "brush-picker-item-name";
        nameSpan.textContent = b.name;

        const dimsSpan = document.createElement("span");
        dimsSpan.className = "brush-picker-item-dims";
        dimsSpan.textContent = `${b.w}×${b.h} · ${nativePx} px`;

        info.append(nameSpan, dimsSpan);
        itemBtn.append(thumb, info);

        itemBtn.addEventListener("click", () => {
          selectCustomBrush(b.id);
          closeCustomBrushMenu();
        });

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "brush-picker-action";
        editBtn.title = i18n.t("brush.rename_title");
        editBtn.textContent = "✎";
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          renameCustomBrushInline(b.id, nameSpan);
        });

        const del = document.createElement("button");
        del.type = "button";
        del.className = "brush-picker-action";
        del.title = i18n.t("brush.delete_title");
        del.textContent = "×";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteCustomBrush(b.id);
        });

        row.append(itemBtn, editBtn, del);
        userContainer.appendChild(row);
      }
    }
  }

  syncCustomBrushesActiveUI();
}

/** Carga los pinceles personalizados persistidos y registra los listeners del menú. */
export function initCustomBrushes() {
  loadUserBrushes();
  const input = document.getElementById("brushFileInput");
  input?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) importCustomBrushesFile(file);
    e.target.value = "";
  });

  const trigger = document.getElementById("btnCustomBrushDropdown");
  trigger?.addEventListener("click", toggleCustomBrushMenu);

  document.addEventListener("click", (e) => {
    if (!isBrushMenuOpen) return;
    const picker = document.getElementById("customBrushPicker");
    if (picker && !picker.contains(e.target)) {
      closeCustomBrushMenu();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isBrushMenuOpen) {
      closeCustomBrushMenu();
    }
  });

  renderCustomBrushesUI();
}
