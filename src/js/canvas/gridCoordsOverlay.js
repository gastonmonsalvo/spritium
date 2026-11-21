/**
 * gridCoordsOverlay.js: Indicador visual de coordenadas de cuadrícula bajo el cursor
 * (resalta la fila y columna activas y muestra una etiqueta flotante X/Y).
 */

import { CANVAS_PX, state, getGridDims } from "../core/state.js";

function hexToRgbTuple(hex) {
  const clean = String(hex || "").replace("#", "").trim();
  if (clean.length !== 6 && clean.length !== 8) return [56, 189, 248];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return [56, 189, 248];
  return [r, g, b];
}

/**
 * Actualiza el overlay de coordenadas de cuadrícula según `state.showGridCoords` y `state.cursorPos`.
 */
export function renderGridCoordsOverlay() {
  if (typeof document === "undefined") return;
  const overlay = document.getElementById("gridCoordsOverlay");
  if (!overlay) return;

  if (!state.showGridCoords || !state.cursorPos || state.isPlaying) {
    if (overlay.style.display !== "none") overlay.style.display = "none";
    return;
  }

  const { w, h } = getGridDims();
  const maxDim = Math.max(w, h);
  const zoom = state.zoom || 1;
  const baseCell = Math.max(1, Math.round(CANVAS_PX / maxDim));
  const cellPx = baseCell * zoom;

  const mode = state.tiledMode || "none";
  const tilesX = mode === "x" || mode === "both" ? 3 : 1;
  const tilesY = mode === "y" || mode === "both" ? 3 : 1;
  const totalCols = w * tilesX;
  const totalRows = h * tilesY;

  const { x, y } = state.cursorPos;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x >= totalCols || y < 0 || y >= totalRows) {
    if (overlay.style.display !== "none") overlay.style.display = "none";
    return;
  }

  const cfg = state.gridCoordsConfig || {};
  const showGuides = cfg.showGuides !== false;
  const showBadge = cfg.showBadge !== false;
  if (!showGuides && !showBadge) {
    if (overlay.style.display !== "none") overlay.style.display = "none";
    return;
  }

  if (overlay.style.display !== "block") overlay.style.display = "block";

  const colEl = overlay.querySelector(".grid-coords-col");
  const rowEl = overlay.querySelector(".grid-coords-row");
  const badgeEl = overlay.querySelector(".grid-coords-badge");
  if (!colEl || !rowEl || !badgeEl) return;

  const [r, g, b] = hexToRgbTuple(cfg.color);
  const fillAlpha = Math.max(0.05, Math.min(0.6, Number(cfg.opacity ?? 0.14) || 0.14));
  const lineAlpha = Math.min(0.95, Math.max(0.28, fillAlpha * 2.6));
  const fillCss = `rgba(${r}, ${g}, ${b}, ${fillAlpha.toFixed(3)})`;
  const lineCss = `rgba(${r}, ${g}, ${b}, ${lineAlpha.toFixed(3)})`;

  const left = Math.floor(x * cellPx);
  const top = Math.floor(y * cellPx);
  const colW = Math.max(1, Math.floor((x + 1) * cellPx) - left);
  const rowH = Math.max(1, Math.floor((y + 1) * cellPx) - top);

  colEl.style.display = showGuides ? "block" : "none";
  rowEl.style.display = showGuides ? "block" : "none";
  if (showGuides) {
    colEl.style.width = `${colW}px`;
    colEl.style.background = fillCss;
    colEl.style.boxShadow = `inset 1px 0 0 ${lineCss}, inset -1px 0 0 ${lineCss}`;
    colEl.style.transform = `translate3d(${left}px, 0, 0)`;

    rowEl.style.height = `${rowH}px`;
    rowEl.style.background = fillCss;
    rowEl.style.boxShadow = `inset 0 1px 0 ${lineCss}, inset 0 -1px 0 ${lineCss}`;
    rowEl.style.transform = `translate3d(0, ${top}px, 0)`;
  }

  badgeEl.style.display = showBadge ? "block" : "none";
  if (showBadge) {
    const localX = ((x % w) + w) % w;
    const localY = ((y % h) + h) % h;
    const label = `X:${localX} Y:${localY}`;
    if (badgeEl.textContent !== label) badgeEl.textContent = label;
    badgeEl.style.borderColor = `rgba(${r}, ${g}, ${b}, ${Math.min(0.95, lineAlpha + 0.15).toFixed(3)})`;

    const overlayW = overlay.clientWidth || Math.round(totalCols * cellPx);
    const overlayH = overlay.clientHeight || Math.round(totalRows * cellPx);
    const badgeW = badgeEl.offsetWidth || 68;
    const badgeH = badgeEl.offsetHeight || 18;
    const gap = 8;

    let bx = left + colW + gap;
    if (bx + badgeW > overlayW - 4) bx = left - badgeW - gap;
    bx = Math.max(4, Math.min(overlayW - badgeW - 4, bx));

    let by = top + rowH + gap;
    if (by + badgeH > overlayH - 4) by = top - badgeH - gap;
    by = Math.max(4, Math.min(overlayH - badgeH - 4, by));

    badgeEl.style.transform = `translate3d(${Math.round(bx)}px, ${Math.round(by)}px, 0)`;
  }
}
