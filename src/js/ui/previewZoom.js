// @ts-check
/**
 * previewZoom.js: Zoom con rueda, pan por arrastre y reset con doble clic
 * para los lienzos de vista previa dentro de modales.
 */

import { i18n } from "../i18n/I18nService.js";

const MODAL_PREVIEW_TARGETS = [
  { id: "outlinePreviewCanvas", allowPan: true },
  { id: "shadowPreviewCanvas", allowPan: true },
  { id: "hslPreviewCanvas", allowPan: true },
  { id: "noisePreviewCanvas", allowPan: true },
  { id: "exportPreviewCanvas", allowPan: true },
  { id: "importPreviewCanvas", allowPan: true },
  { id: "normalPreviewCanvas", allowPan: false },
];

/**
 * Habilita zoom con rueda (`1×–8×`), pan arrastrando y reset con doble clic sobre un `<canvas>` de preview.
 * @param {HTMLCanvasElement | null} canvasEl
 * @param {{ allowPan?: boolean, min?: number, max?: number }} [options]
 */
export function attachPreviewZoom(canvasEl, { allowPan = true, min = 1, max = 8 } = {}) {
  if (!canvasEl || canvasEl.dataset.previewZoomBound === "1") return;
  canvasEl.dataset.previewZoomBound = "1";

  const stage = canvasEl.parentElement;
  if (stage) {
    stage.style.overflow = "hidden";
    if (getComputedStyle(stage).position === "static") stage.style.position = "relative";
    if (!stage.nextElementSibling?.classList?.contains("preview-zoom-hint")) {
      const hint = document.createElement("div");
      const hintKey = allowPan ? "preview.zoom_hint" : "preview.zoom_hint_nopan";
      hint.className = "preview-zoom-hint";
      hint.setAttribute("data-i18n", hintKey);
      hint.textContent = i18n.t(hintKey);
      hint.style.cssText = "font-size: 10px; color: var(--text-dim); opacity: 0.78; text-align: center; line-height: 1.25; margin-top: 4px; user-select: none;";
      stage.after(hint);
    }
  }

  let scale = 1;
  let panX = 0;
  let panY = 0;
  let dragStart = null;

  const clampPan = () => {
    if (!stage || scale <= 1) {
      panX = 0;
      panY = 0;
      return;
    }
    const maxX = ((stage.clientWidth || 140) * (scale - 1)) / 2 + 12;
    const maxY = ((stage.clientHeight || 140) * (scale - 1)) / 2 + 12;
    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
  };

  const applyTransform = () => {
    clampPan();
    canvasEl.style.transformOrigin = "center center";
    canvasEl.style.transform = scale === 1 && panX === 0 && panY === 0
      ? ""
      : `translate(${Math.round(panX)}px, ${Math.round(panY)}px) scale(${scale})`;
    if (allowPan) {
      canvasEl.style.cursor = scale > 1 ? (dragStart ? "grabbing" : "grab") : "zoom-in";
    }
  };

  const wheelTarget = stage || canvasEl;
  wheelTarget.addEventListener("wheel", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const prevScale = scale;
    const step = scale >= 4 ? 1 : 0.5;
    scale = Math.max(min, Math.min(max, Number((scale + (e.deltaY < 0 ? step : -step)).toFixed(2))));
    if (scale === prevScale) return;

    if (scale === 1) {
      panX = 0;
      panY = 0;
    } else if (stage) {
      const rect = stage.getBoundingClientRect();
      const ox = e.clientX - (rect.left + rect.width / 2);
      const oy = e.clientY - (rect.top + rect.height / 2);
      const ratio = scale / prevScale;
      panX = panX * ratio - ox * (ratio - 1);
      panY = panY * ratio - oy * (ratio - 1);
    }
    applyTransform();
  }, { passive: false });

  wheelTarget.addEventListener("dblclick", (e) => {
    e.preventDefault();
    scale = 1;
    panX = 0;
    panY = 0;
    applyTransform();
  });

  if (allowPan) {
    canvasEl.style.cursor = "zoom-in";
    canvasEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || scale <= 1) return;
      e.preventDefault();
      dragStart = { x: e.clientX, y: e.clientY, panX, panY };
      applyTransform();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragStart) return;
      panX = dragStart.panX + (e.clientX - dragStart.x);
      panY = dragStart.panY + (e.clientY - dragStart.y);
      applyTransform();
    });
    window.addEventListener("mouseup", () => {
      if (!dragStart) return;
      dragStart = null;
      applyTransform();
    });
  }
}

/** Inicializa el zoom interactivo en todos los lienzos de vista previa de modales. */
export function initModalPreviewZooms() {
  if (typeof document === "undefined") return;
  for (const { id, allowPan } of MODAL_PREVIEW_TARGETS) {
    attachPreviewZoom(/** @type {HTMLCanvasElement | null} */ (document.getElementById(id)), { allowPan });
  }
}
