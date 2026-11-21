/**
 * canvasContextMenu.js: Menú contextual (clic derecho) sobre el lienzo principal.
 */

import { state, pushLayerState } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { startFreeTransform } from "../tools/freeTransform.js";
import { isActiveLayerLocked } from "../workspace/layers.js";
import { reconcileActiveTilemapLayer } from "../workspace/tilemap.js";
import { syncCanvasColorsToPalette } from "../workspace/paletteManager.js";
import { clearSelection, selectAll, invertSelection, isInsideSelection } from "../tools/tools.js";
import {
  copySelection,
  cutSelection,
  pasteClipboard,
  flipSelectionOrCanvas,
  rotate90SelectionOrCanvas,
} from "../tools/transforms.js";
import { setStatus, refreshIcons } from "./index.js";
import { i18n } from "../i18n/I18nService.js";

/**
 * Cierra el menú contextual del lienzo.
 */
export function closeCanvasContextMenu() {
  document.getElementById("canvasContextMenu")?.classList.remove("open");
}

/**
 * Abre el menú contextual del lienzo en la posición (clientX, clientY).
 * @param {number} clientX
 * @param {number} clientY
 */
export function openCanvasContextMenu(clientX, clientY) {
  const menu = document.getElementById("canvasContextMenu");
  if (!menu) return;

  const hasSelection = Boolean(state.selection);
  const hasClipboard = Boolean(state.clipboard);
  const locked = isActiveLayerLocked();

  const items = [
    {
      icon: "copy",
      label: i18n.t("ctx.copy"),
      disabled: false,
      action: () => {
        const { w, h } = copySelection();
        setStatus({ key: "log.copied", params: { w, h } }, false, "pixel");
      },
    },
    {
      icon: "scissors",
      label: i18n.t("ctx.cut"),
      disabled: locked,
      action: () => {
        const { w, h } = cutSelection();
        setStatus({ key: "log.cut", params: { w, h } }, false, "pixel");
      },
    },
    {
      icon: "clipboard-paste",
      label: i18n.t("ctx.paste"),
      disabled: !hasClipboard,
      action: () => {
        if (pasteClipboard()) setStatus({ key: "log.pasted" }, false, "pixel");
      },
    },
    {
      icon: "paint-bucket",
      label: i18n.t("ctx.fill_sel"),
      disabled: !hasSelection || locked,
      action: () => {
        if (!state.selection) return;
        pushLayerState();
        const { x, y, w, h } = state.selection;
        for (let r = y; r < y + h; r++) {
          for (let c = x; c < x + w; c++) {
            if (isInsideSelection(c, r) && state.grid[r] && state.grid[r][c] !== undefined) {
              state.grid[r][c] = state.currentColorIndex;
            }
          }
        }
        state.isDirtySinceImport = true;
        reconcileActiveTilemapLayer();
        syncCanvasColorsToPalette();
        renderAll();
        setStatus({ key: "log.sel_filled" }, false, "pixel");
      },
    },
    {
      icon: "eraser",
      label: i18n.t("ctx.clear_sel"),
      disabled: !hasSelection || locked,
      action: () => {
        pushLayerState();
        if (clearSelection()) {
          reconcileActiveTilemapLayer();
          syncCanvasColorsToPalette();
          renderAll();
          setStatus({ key: "log.sel_cleared" }, false, "pixel");
        }
      },
    },
    { divider: true },
    {
      icon: "contrast",
      label: i18n.t("ctx.invert_sel"),
      disabled: false,
      action: () => {
        invertSelection();
        renderAll();
        setStatus(state.selection ? { key: "log.sel_inverted" } : { key: "log.sel_empty" });
      },
    },
    {
      icon: "box-select",
      label: i18n.t("ctx.select_all"),
      disabled: false,
      action: () => {
        selectAll();
        renderAll();
        setStatus({ key: "log.sel_all" });
      },
    },
    {
      icon: "x-circle",
      label: i18n.t("ctx.deselect"),
      disabled: !hasSelection,
      action: () => {
        state.selection = null;
        renderAll();
        setStatus({ key: "log.sel_cancelled" });
      },
    },
    { divider: true },
    {
      icon: "flip-horizontal-2",
      label: i18n.t("ctx.flip_h"),
      disabled: locked,
      action: () => {
        flipSelectionOrCanvas("h");
        setStatus({ key: "log.flipped_h" }, false, "pixel");
      },
    },
    {
      icon: "flip-vertical-2",
      label: i18n.t("ctx.flip_v"),
      disabled: locked,
      action: () => {
        flipSelectionOrCanvas("v");
        setStatus({ key: "log.flipped_v" }, false, "pixel");
      },
    },
    {
      icon: "rotate-cw",
      label: i18n.t("ctx.rotate_90"),
      disabled: locked,
      action: () => {
        rotate90SelectionOrCanvas();
        setStatus({ key: "log.rotated_90_short" }, false, "pixel");
      },
    },
  ];

  menu.innerHTML = `<div class="ctx-header">${i18n.t("ctx.canvas_header")}</div>`;
  for (const item of items) {
    if (item.divider) {
      const div = document.createElement("div");
      div.className = "ctx-divider";
      menu.appendChild(div);
      continue;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ctx-item";
    btn.disabled = Boolean(item.disabled);
    btn.innerHTML = `<i data-lucide="${item.icon}" class="ui-icon-sm"></i><span>${item.label}</span>`;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      closeCanvasContextMenu();
      item.action();
    });
    menu.appendChild(btn);
  }

  menu.classList.add("open");
  refreshIcons(menu);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mw = menu.offsetWidth || 200;
  const mh = menu.offsetHeight || 260;
  const left = vw <= 640
    ? Math.max(12, Math.round((vw - mw) / 2))
    : Math.max(8, Math.min(clientX, vw - mw - 8));
  const bottomPad = vw <= 860 ? 60 : 8;
  const top = Math.max(8, Math.min(clientY, vh - mh - bottomPad));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}
