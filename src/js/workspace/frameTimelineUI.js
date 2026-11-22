/**
 * frameTimelineUI.js: Renderizado de píldoras de frames en la línea de tiempo y menú contextual por clic derecho.
 */

import { subscribe, state, notify, getSelectedFrameRange } from "../core/state.js";
import { refreshIcons } from "../ui/index.js";
import { i18n } from "../i18n/I18nService.js";
import {
  selectFrame,
  addFrame,
  deleteActiveFrame,
  moveActiveFrame,
  copyActiveFrameToClipboard,
  pasteClipboardAsFrame,
  hasFrameClipboard,
} from "./frameOperations.js";
import { stopAnimation } from "./framePlayback.js";

if (typeof window !== "undefined") {
  i18n.addEventListener("langchange", () => renderFramesUI());
}

let frameContextMenuInitialized = false;

function hideFrameContextMenu() {
  const menu = document.getElementById("frameContextMenu");
  if (menu) menu.classList.remove("open");
}

function ensureFrameContextMenuListeners() {
  if (frameContextMenuInitialized) return;
  frameContextMenuInitialized = true;
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("frameContextMenu");
    if (menu && !menu.contains(/** @type {Node} */ (e.target))) hideFrameContextMenu();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideFrameContextMenu();
  });
}

/**
 * Abre el menú contextual para un fotograma o rango.
 * @param {MouseEvent} e
 * @param {number} frameIndex
 * @param {{from: number, to: number}|null} [frameRange=null]
 */
export function openFrameContextMenu(e, frameIndex, frameRange = null) {
  e.preventDefault();
  e.stopPropagation();
  ensureFrameContextMenuListeners();

  stopAnimation();
  if (frameIndex !== state.activeFrameIndex) {
    selectFrame(frameIndex);
  }

  const menu = document.getElementById("frameContextMenu");
  if (!menu) return;

  const matrixRange = getSelectedFrameRange();
  const activeRange =
    frameRange && frameIndex >= frameRange.from && frameIndex <= frameRange.to
      ? frameRange
      : matrixRange && frameIndex >= matrixRange.from && frameIndex <= matrixRange.to
        ? matrixRange
        : null;
  const tagFrom = activeRange ? activeRange.from : frameIndex;
  const tagTo = activeRange ? activeRange.to : frameIndex;
  const isMulti = tagTo > tagFrom;

  const addItem = (iconName, label, onClick, disabled = false) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ctx-item";
    btn.innerHTML = iconName
      ? `<i data-lucide="${iconName}" class="ui-icon-sm"></i><span></span>`
      : `<span></span>`;
    const spanEl = btn.querySelector("span");
    if (spanEl) spanEl.textContent = label;
    btn.disabled = disabled;
    btn.onclick = () => {
      hideFrameContextMenu();
      onClick();
    };
    menu.appendChild(btn);
  };

  const addDivider = () => {
    const hr = document.createElement("div");
    hr.className = "ctx-divider";
    menu.appendChild(hr);
  };

  menu.innerHTML = `<div class="ctx-header">${isMulti ? `Frames F${tagFrom + 1}–F${tagTo + 1}` : `Frame F${frameIndex + 1}`}</div>`;
  addItem(
    "tag",
    isMulti ? i18n.t("frames.create_tag_range", { from: tagFrom + 1, to: tagTo + 1 }) : i18n.t("frames.create_tag_single", { f: frameIndex + 1 }),
    () => notify("tags:openDialog", { from: tagFrom, to: tagTo }),
  );
  addDivider();
  addItem("plus", i18n.t("frames.new_frame"), () => addFrame({ duplicate: false }));
  addItem("copy-plus", i18n.t("frames.dup_frame"), () => addFrame({ duplicate: true }));
  addItem("copy", i18n.t("frames.copy_frame"), () => copyActiveFrameToClipboard());
  addItem("clipboard-paste", i18n.t("frames.paste_frame"), () => pasteClipboardAsFrame(), !hasFrameClipboard());
  addDivider();
  addItem("arrow-left", i18n.t("frames.move_left"), () => moveActiveFrame(-1), frameIndex <= 0);
  addItem("arrow-right", i18n.t("frames.move_right"), () => moveActiveFrame(1), frameIndex >= state.frames.length - 1);
  addDivider();
  addItem("trash-2", i18n.t("frames.del_frame"), () => deleteActiveFrame(), state.frames.length <= 1);

  menu.classList.add("open");
  refreshIcons(menu);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mw = menu.offsetWidth || 190;
  const mh = menu.offsetHeight || 240;
  menu.style.left = `${Math.min(e.clientX, vw - mw - 8)}px`;
  menu.style.top = `${Math.min(e.clientY, vh - mh - 8)}px`;
}

/**
 * Renderiza las píldoras de frames en la barra de línea de tiempo.
 */
export function renderFramesUI() {
  const list = document.getElementById("frames-list");
  if (!list) return;
  if (!list.dataset.wheelBound) {
    list.dataset.wheelBound = "1";
    list.addEventListener("wheel", (e) => {
      if (list.scrollWidth <= list.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        list.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }
  list.innerHTML = "";

  let activeBtn = null;
  state.frames.forEach((frame, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const isActive = idx === state.activeFrameIndex;
    btn.className = "frame-pill" + (isActive ? " active" : "");
    btn.textContent = frame.name ? `F${idx + 1} · ${frame.name}` : `F${idx + 1}`;
    btn.title = i18n.t("frames.tooltip", { name: frame.name || `Frame ${idx + 1}` });
    if (frame.color) {
      btn.style.borderBottom = `2px solid ${frame.color}`;
    }
    btn.onclick = () => {
      stopAnimation();
      selectFrame(idx);
    };
    btn.oncontextmenu = (e) => openFrameContextMenu(e, idx);
    list.appendChild(btn);
    if (isActive) activeBtn = btn;
  });
  activeBtn?.scrollIntoView({ block: "nearest", inline: "nearest" });
  notify("frames:rendered");
}

subscribe("frames:render", () => renderFramesUI());
