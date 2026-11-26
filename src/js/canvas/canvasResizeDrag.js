// @ts-check
/**
 * canvasResizeDrag.js: Redimensionado interactivo del lienzo (1:1 sin reescalar píxeles)
 * arrastrando el borde derecho, borde inferior o esquina inferior-derecha mientras se mantiene Alt.
 */

import { state, getGridDims, MAX_GRID_DIM } from "../core/state.js";
import { resizeCanvasCrop } from "../workspace/spriteActions.js";

const EDGE_TOLERANCE_PX = 12;

function getTiledFactors() {
  const mode = state.tiledMode || "none";
  return {
    tilesX: mode === "x" || mode === "both" ? 3 : 1,
    tilesY: mode === "y" || mode === "both" ? 3 : 1,
  };
}

function getOrCreateResizeOverlay() {
  if (typeof document === "undefined") return null;
  let el = document.getElementById("canvasResizeOverlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "canvasResizeOverlay";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
  } else if (el.parentElement !== document.body) {
    document.body.appendChild(el);
  }
  el.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:visible;display:none;";
  return el;
}

/**
 * Detecta si el puntero está sobre el borde derecho, inferior o esquina inferior-derecha del canvas.
 * @param {PointerEvent | MouseEvent} e
 * @param {HTMLCanvasElement} canvas
 * @returns {"ew" | "ns" | "nwse" | null}
 */
export function hitTestCanvasResizeEdge(e, canvas) {
  if (!canvas || !e.altKey || e.ctrlKey || e.shiftKey || state.freeTransform) return null;
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = e.clientX;
  const y = e.clientY;
  if (x < rect.left + 8 || y < rect.top + 8) return null;
  if (x > rect.right + EDGE_TOLERANCE_PX || y > rect.bottom + EDGE_TOLERANCE_PX) return null;

  const nearRight = Math.abs(x - rect.right) <= EDGE_TOLERANCE_PX;
  const nearBottom = Math.abs(y - rect.bottom) <= EDGE_TOLERANCE_PX;
  if (nearRight && nearBottom) return "nwse";
  if (nearRight) return "ew";
  if (nearBottom) return "ns";
  return null;
}

/**
 * Inicializa el controlador de redimensionado del canvas por arrastre con Alt.
 * @param {HTMLCanvasElement} canvas
 */
export function createCanvasResizeDragController(canvas) {
  /** @type {{ mode: "ew"|"ns"|"nwse", startX: number, startY: number, startW: number, startH: number, targetW: number, targetH: number, cellPxX: number, cellPxY: number, lastClientX: number, lastClientY: number, snap8: boolean } | null} */
  let drag = null;

  const snapDim = (val, snap8) => {
    const rounded = snap8 ? Math.round(val / 8) * 8 : Math.round(val);
    const min = snap8 ? 8 : 4;
    return Math.max(min, Math.min(MAX_GRID_DIM, rounded));
  };

  const updateTargets = (clientX, clientY, snap8) => {
    if (!drag) return;
    drag.lastClientX = clientX;
    drag.lastClientY = clientY;
    drag.snap8 = Boolean(snap8);
    const dx = clientX - drag.startX;
    const dy = clientY - drag.startY;
    if (drag.mode === "ew" || drag.mode === "nwse") {
      drag.targetW = snapDim(drag.startW + dx / drag.cellPxX, drag.snap8);
    }
    if (drag.mode === "ns" || drag.mode === "nwse") {
      drag.targetH = snapDim(drag.startH + dy / drag.cellPxY, drag.snap8);
    }
  };

  const renderPreview = () => {
    const overlay = getOrCreateResizeOverlay();
    if (!overlay) return;
    if (!drag) {
      if (overlay.style.display !== "none") overlay.style.display = "none";
      return;
    }
    const pxW = Math.round(drag.targetW * drag.cellPxX);
    const pxH = Math.round(drag.targetH * drag.cellPxY);
    const cursor = drag.mode === "ew" ? "ew-resize" : drag.mode === "ns" ? "ns-resize" : "nwse-resize";
    canvas.style.cursor = cursor;
    const cRect = canvas.getBoundingClientRect();
    const originX = cRect.left + canvas.clientLeft;
    const originY = cRect.top + canvas.clientTop;
    const badgeX = Math.max(70, Math.min(window.innerWidth - 8, originX + pxW));
    const badgeY = Math.max(24, Math.min(window.innerHeight - 28, originY + pxH + 8));
    const isWin98 = document.body?.classList.contains("theme-win98");
    const isLight = Boolean(state.isLightTheme) || document.body?.classList.contains("theme-light");
    const cfg = state.guidesOverlayConfig || {};
    const auto = cfg.autoColor !== false;
    const thick = Math.max(0.5, Math.min(3, Number(cfg.thickness ?? 1.5) || 1.5));
    const strokeColor = auto
      ? (isWin98 ? "#000080" : isLight ? "#1d4ed8" : "#38bdf8")
      : (cfg.resizeColor || "#38bdf8");
    const fillBg = isWin98 ? "rgba(0, 0, 128, 0.08)" : isLight ? "rgba(29, 78, 216, 0.08)" : "rgba(56, 189, 248, 0.08)";
    const badgeStyle = isWin98
      ? `background:#ffffe1;color:#000000;border:1px solid #000000;border-radius:0;box-shadow:1px 1px 0 #000000;`
      : `background:rgba(15,23,42,0.94);color:${auto && !isLight ? "#38bdf8" : "#93c5fd"};border:1px solid ${strokeColor};border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.5);`;
    const badgeText = drag.snap8 ? `${drag.targetW} × ${drag.targetH} px (×8)` : `${drag.targetW} × ${drag.targetH} px`;
    overlay.style.display = "block";
    overlay.innerHTML =
      `<svg style="position:fixed;left:${originX.toFixed(1)}px;top:${originY.toFixed(1)}px;width:${Math.max(2, pxW)}px;height:${Math.max(2, pxH)}px;overflow:visible;pointer-events:none;">` +
      `<rect x="0" y="0" width="${Math.max(1, pxW)}" height="${Math.max(1, pxH)}" fill="${fillBg}" stroke="${strokeColor}" stroke-width="${thick}" stroke-dasharray="5 3"/>` +
      `</svg>` +
      `<div style="position:fixed;left:${badgeX.toFixed(1)}px;top:${badgeY.toFixed(1)}px;transform:translateX(-100%);${badgeStyle}padding:2px 7px;font:600 11px/1.2 var(--font-mono,monospace);white-space:nowrap;">${badgeText}</div>`;
  };

  if (typeof window !== "undefined") {
    const syncShiftKey = (ev) => {
      if (!drag || ev.key !== "Shift") return;
      updateTargets(drag.lastClientX, drag.lastClientY, ev.shiftKey);
      renderPreview();
    };
    window.addEventListener("keydown", syncShiftKey);
    window.addEventListener("keyup", syncShiftKey);
  }

  return {
    isActive: () => Boolean(drag),
    getHoverCursor: (e) => {
      const hit = hitTestCanvasResizeEdge(e, canvas);
      if (!hit) return null;
      return hit === "ew" ? "ew-resize" : hit === "ns" ? "ns-resize" : "nwse-resize";
    },
    onDown: (e) => {
      if (e.button !== 0) return false;
      const mode = hitTestCanvasResizeEdge(e, canvas);
      if (!mode) return false;
      e.preventDefault();
      e.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      const { w, h } = getGridDims();
      const { tilesX, tilesY } = getTiledFactors();
      drag = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        startW: w,
        startH: h,
        targetW: w,
        targetH: h,
        cellPxX: Math.max(1, rect.width / (w * tilesX)),
        cellPxY: Math.max(1, rect.height / (h * tilesY)),
        lastClientX: e.clientX,
        lastClientY: e.clientY,
        snap8: Boolean(e.shiftKey),
      };
      renderPreview();
      return true;
    },
    onMove: (e) => {
      if (!drag) return false;
      const container = document.getElementById("canvasContainer");
      if (container) {
        const cr = container.getBoundingClientRect();
        if (e.clientX > cr.right - 20) container.scrollLeft += 16;
        else if (e.clientX < cr.left + 20) container.scrollLeft -= 16;
        if (e.clientY > cr.bottom - 20) container.scrollTop += 16;
        else if (e.clientY < cr.top + 20) container.scrollTop -= 16;
      }
      updateTargets(e.clientX, e.clientY, e.shiftKey);
      renderPreview();
      return true;
    },
    onUp: () => {
      if (!drag) return false;
      const { targetW, targetH } = drag;
      drag = null;
      renderPreview();
      resizeCanvasCrop(targetW, targetH);
      return true;
    },
    cancel: () => {
      if (!drag) return;
      drag = null;
      renderPreview();
    },
  };
}
