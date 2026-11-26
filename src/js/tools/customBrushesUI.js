/**
 * customBrushesUI.js: Menú desplegable, miniaturas y renombrado inline de pinceles personalizados.
 */

import { state, subscribe } from "../core/state.js";
import { setStatus } from "../ui/status.js";
import { i18n } from "../i18n/I18nService.js";
import {
  BUILTIN_BRUSH_PATTERNS,
  loadUserBrushes,
  saveUserBrushes,
  getBrushNativeSize,
  getActiveCustomBrush,
  setBrushPattern,
  selectCustomBrush,
  deleteCustomBrush,
  importCustomBrushesFile,
} from "./customBrushStore.js";

if (typeof window !== "undefined") {
  i18n.addEventListener("langchange", () => renderCustomBrushesUI());
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
  if (!oCtx) return;
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

/**
 * Cierra el menú desplegable de pinceles personalizados.
 */
export function closeCustomBrushMenu() {
  isBrushMenuOpen = false;
  const menu = document.getElementById("customBrushDropdownMenu");
  const trigger = document.getElementById("btnCustomBrushDropdown");
  if (menu) menu.classList.remove("open");
  if (trigger) trigger.setAttribute("aria-expanded", "false");
}

/**
 * Alterna la apertura del menú desplegable de pinceles personalizados.
 * @param {Event} [event]
 */
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

function syncCustomBrushesActiveUI() {
  const patContainer = document.getElementById("brushPatternPresets");
  if (patContainer) {
    const activePat = state.activeCustomBrushId ? null : state.activeBrushPattern || "solid";
    for (const btn of patContainer.querySelectorAll("[data-pattern-id]")) {
      const htmlBtn = /** @type {HTMLElement} */ (btn);
      htmlBtn.classList.toggle("active", htmlBtn.dataset.patternId === activePat);
    }
  }

  const activeBrush = getActiveCustomBrush();
  const trigger = document.getElementById("btnCustomBrushDropdown");
  const labelEl = document.getElementById("activeCustomBrushLabel");
  const thumbEl = /** @type {HTMLCanvasElement|null} */ (document.getElementById("activeCustomBrushThumb"));
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
      const htmlRow = /** @type {HTMLElement} */ (row);
      htmlRow.classList.toggle("active", htmlRow.dataset.brushId === state.activeCustomBrushId);
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
      const on = patternId === "checker"
        ? ((x + y) & 1) === 0
        : patternId === "diag2"
          ? (((x - y) % 3) + 3) % 3 === 0
          : (x + y) % 3 === 0;
      if (on) rects.push(`<rect x="${x * 3}" y="${y * 3}" width="2.4" height="2.4"/>`);
    }
  }
  return `<svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">${rects.join("")}</svg>`;
}

/**
 * Renderiza la grilla de patrones integrados y pinceles personalizados.
 */
export function renderCustomBrushesUI() {
  const patContainer = document.getElementById("brushPatternPresets");
  if (patContainer) {
    patContainer.innerHTML = "";
    const activePat = state.activeCustomBrushId ? null : state.activeBrushPattern || "solid";
    for (const p of BUILTIN_BRUSH_PATTERNS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.patternId = p.id;
      const isDiagGroup = p.id === "diag" && (activePat === "diag" || activePat === "diag2");
      const isActive = isDiagGroup || activePat === p.id;
      btn.className = `tool-btn${isActive ? " active" : ""}`;
      btn.style.cssText = "position: relative; padding: 4px 2px; display: inline-flex; align-items: center; justify-content: center;";
      const effectivePat = isDiagGroup ? activePat : p.id;
      const label = i18n.t(effectivePat === "diag2" ? "brush.pat_diag2" : p.labelKey);
      const title = i18n.t(effectivePat === "diag2" ? "brush.pat_diag2_title" : p.titleKey);
      btn.title = `${label} — ${title}`;
      btn.setAttribute("aria-label", label);
      const toggleHint = p.id === "diag"
        ? `<span aria-hidden="true" style="position:absolute; right:2px; bottom:1px; font-size:8px; line-height:1; opacity:0.8;">⇄</span>`
        : "";
      btn.innerHTML = buildPatternIconSvg(effectivePat) + toggleHint;
      btn.addEventListener("click", () => {
        if (p.id === "diag" && !state.activeCustomBrushId) {
          setBrushPattern(state.activeBrushPattern === "diag" ? "diag2" : "diag");
          renderCustomBrushesUI();
          return;
        }
        setBrushPattern(p.id);
      });
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

/**
 * Carga los pinceles personalizados persistidos y registra los listeners del menú.
 */
export function initCustomBrushes() {
  loadUserBrushes();
  subscribe("brushes:changed", renderCustomBrushesUI);
  subscribe("brushes:active", syncCustomBrushesActiveUI);

  const input = /** @type {HTMLInputElement|null} */ (document.getElementById("brushFileInput"));
  input?.addEventListener("change", (e) => {
    const target = /** @type {HTMLInputElement} */ (e.target);
    const file = target.files?.[0];
    if (file) importCustomBrushesFile(file);
    target.value = "";
  });

  const trigger = document.getElementById("btnCustomBrushDropdown");
  trigger?.addEventListener("click", toggleCustomBrushMenu);

  document.addEventListener("click", (e) => {
    if (!isBrushMenuOpen) return;
    const picker = document.getElementById("customBrushPicker");
    if (picker && !picker.contains(/** @type {Node} */ (e.target))) {
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
