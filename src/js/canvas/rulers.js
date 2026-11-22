/**
 * rulers.js: Reglas visuales (horizontal y vertical) sincronizadas con la resolución y zoom del lienzo,
 * con indicador en vivo de la coordenada del cursor.
 */

import { CANVAS_PX, state, getGridDims } from "../core/state.js";

function getTickStep(gridSize, cellPx) {
  const idealStep = 48 / Math.max(0.5, cellPx);
  const candidates = [1, 2, 4, 8, 16, 32, 64];
  let step = candidates.find((c) => c >= idealStep) || 64;
  if (gridSize <= 16) step = Math.min(step, 4);
  return step;
}

/**
 * Dibuja las reglas superior e izquierda alineadas con el tamaño visual actual del canvas.
 */
export function renderRulers() {
  if (typeof document === "undefined") return;
  const topCanvas = document.getElementById("rulerTop");
  const leftCanvas = document.getElementById("rulerLeft");
  if (!topCanvas || !leftCanvas) return;

  const wrapper = topCanvas.closest(".canvas-with-rulers");
  if (wrapper) {
    wrapper.classList.toggle("no-rulers", !state.showRulers);
  }
  if (!state.showRulers) return;

  const { w, h } = getGridDims();
  const maxDim = Math.max(w, h);
  const zoom = state.zoom || 1;
  const baseCell = Math.max(1, Math.round(CANVAS_PX / maxDim));
  const cellPx = baseCell * zoom;
  const baseDisplayW = Math.round(w * baseCell * zoom);
  const baseDisplayH = Math.round(h * baseCell * zoom);

  const mode = state.tiledMode || "none";
  const tilesX = mode === "x" || mode === "both" ? 3 : 1;
  const tilesY = mode === "y" || mode === "both" ? 3 : 1;
  const centerTx = tilesX > 1 ? 1 : 0;
  const centerTy = tilesY > 1 ? 1 : 0;
  const displayW = baseDisplayW * tilesX;
  const displayH = baseDisplayH * tilesY;
  const stepX = getTickStep(w, cellPx);
  const stepY = getTickStep(h, cellPx);
  const thickness = 20;

  if (topCanvas.width !== displayW || topCanvas.height !== thickness) {
    topCanvas.width = displayW;
    topCanvas.height = thickness;
  }
  topCanvas.style.width = `${displayW}px`;
  topCanvas.style.height = `${thickness}px`;

  if (leftCanvas.width !== thickness || leftCanvas.height !== displayH) {
    leftCanvas.width = thickness;
    leftCanvas.height = displayH;
  }
  leftCanvas.style.width = `${thickness}px`;
  leftCanvas.style.height = `${displayH}px`;

  const tCtx = topCanvas.getContext("2d");
  const lCtx = leftCanvas.getContext("2d");
  const isLight = document.body?.classList.contains("theme-light");
  const bg = isLight ? "#E8DFCF" : "#18181B";
  const tickColor = isLight ? "#A5947B" : "#52525B";
  const labelColor = isLight ? "#574A3B" : "#8E8E98";

  tCtx.fillStyle = bg;
  tCtx.fillRect(0, 0, displayW, thickness);
  lCtx.fillStyle = bg;
  lCtx.fillRect(0, 0, thickness, displayH);

  // Resaltar celda actual del cursor sobre ambas reglas
  if (state.cursorPos) {
    const cx = Math.floor(state.cursorPos.x * cellPx);
    const cw = Math.max(1, Math.floor((state.cursorPos.x + 1) * cellPx) - cx);
    tCtx.fillStyle = "rgba(59, 130, 246, 0.35)";
    tCtx.fillRect(cx, 0, cw, thickness);

    const cy = Math.floor(state.cursorPos.y * cellPx);
    const ch = Math.max(1, Math.floor((state.cursorPos.y + 1) * cellPx) - cy);
    lCtx.fillStyle = "rgba(59, 130, 246, 0.35)";
    lCtx.fillRect(0, cy, thickness, ch);
  }

  tCtx.strokeStyle = tickColor;
  tCtx.fillStyle = labelColor;
  tCtx.font = "9px monospace";
  tCtx.textBaseline = "top";

  lCtx.strokeStyle = tickColor;
  lCtx.fillStyle = labelColor;
  lCtx.font = "9px monospace";
  lCtx.textBaseline = "top";

  const totalCols = w * tilesX;
  const totalRows = h * tilesY;

  for (let i = 0; i <= totalCols; i++) {
    const localI = i % w;
    const isMajor = localI % stepX === 0;
    const isMinor = !isMajor && stepX >= 4 && localI % (stepX / 2) === 0;
    if (!isMajor && !isMinor) continue;

    const pos = Math.floor(i * cellPx) + 0.5;
    const tickLen = isMajor ? 8 : 4;

    tCtx.beginPath();
    tCtx.moveTo(pos, thickness);
    tCtx.lineTo(pos, thickness - tickLen);
    tCtx.stroke();
    if (isMajor && i < totalCols) {
      tCtx.fillText(String(localI), pos + 2, 2);
    }
  }

  for (let i = 0; i <= totalRows; i++) {
    const localI = i % h;
    const isMajor = localI % stepY === 0;
    const isMinor = !isMajor && stepY >= 4 && localI % (stepY / 2) === 0;
    if (!isMajor && !isMinor) continue;

    const pos = Math.floor(i * cellPx) + 0.5;
    const tickLen = isMajor ? 8 : 4;

    lCtx.beginPath();
    lCtx.moveTo(thickness, pos);
    lCtx.lineTo(thickness - tickLen, pos);
    lCtx.stroke();
    if (isMajor && i < totalRows) {
      lCtx.save();
      lCtx.translate(2, pos + 2);
      lCtx.fillText(String(localI), 0, 0);
      lCtx.restore();
    }
  }

  // Marca central rojiza ligeramente más larga en las reglas para ubicar el medio del lienzo
  if (state.showCenterRulerMarks !== false) {
    const centerTickColor = isLight ? "rgba(185, 28, 28, 0.9)" : "rgba(239, 68, 68, 0.8)";
    if (w >= 4) {
      const midCoordX = w % 2 === 0 ? w / 2 : Math.floor(w / 2) + 0.5;
      tCtx.strokeStyle = centerTickColor;
      tCtx.lineWidth = 1.5;
      for (let tx = 0; tx < tilesX; tx++) {
        const pos = Math.floor((tx * w + midCoordX) * cellPx) + 0.5;
        tCtx.beginPath();
        tCtx.moveTo(pos, thickness);
        tCtx.lineTo(pos, thickness - 13);
        tCtx.stroke();
      }
    }
    if (h >= 4) {
      const midCoordY = h % 2 === 0 ? h / 2 : Math.floor(h / 2) + 0.5;
      lCtx.strokeStyle = centerTickColor;
      lCtx.lineWidth = 1.5;
      for (let ty = 0; ty < tilesY; ty++) {
        const pos = Math.floor((ty * h + midCoordY) * cellPx) + 0.5;
        lCtx.beginPath();
        lCtx.moveTo(thickness, pos);
        lCtx.lineTo(thickness - 13, pos);
        lCtx.stroke();
      }
    }
  }

  // Marcadores de guías arrastradas desde las reglas
  const guides = Array.isArray(state.rulerGuides) ? state.rulerGuides : [];
  const drag = state.activeGuideDrag?.valid ? state.activeGuideDrag : null;
  const allGuides = drag ? [...guides, drag] : guides;
  const isTouchLike = typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)")?.matches || window.innerWidth <= 860);
  const halfW = isTouchLike ? 7 : 5.5;
  const triH = isTouchLike ? 11 : 9;
  for (const g of allGuides) {
    if (g.axis === "v") {
      const pos = Math.floor((centerTx * w + g.pos) * cellPx) + 0.5;
      tCtx.fillStyle = "#10b981";
      tCtx.beginPath();
      tCtx.moveTo(pos - halfW, thickness - triH);
      tCtx.lineTo(pos + halfW, thickness - triH);
      tCtx.lineTo(pos, thickness);
      tCtx.closePath();
      tCtx.fill();
    } else {
      const pos = Math.floor((centerTy * h + g.pos) * cellPx) + 0.5;
      lCtx.fillStyle = "#10b981";
      lCtx.beginPath();
      lCtx.moveTo(thickness - triH, pos - halfW);
      lCtx.lineTo(thickness - triH, pos + halfW);
      lCtx.lineTo(thickness, pos);
      lCtx.closePath();
      lCtx.fill();
    }
  }
}
