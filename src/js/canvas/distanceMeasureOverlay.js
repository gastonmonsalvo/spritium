// @ts-check
/**
 * distanceMeasureOverlay.js: Cuentas/cotas estilo Aseprite para medir distancias
 * en X e Y desde el bounding box del contenido (o selección) hasta los bordes del lienzo.
 */

import { state, getGridDims } from "../core/state.js";

const MEASURE_TOOLS = new Set(["move", "select", "ellipseSelect", "triangleSelect", "lasso", "magicSelect"]);
let measureActive = false;

/**
 * Calcula el bounding box de la selección o de los píxeles pintados de la capa activa.
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number, w: number, h: number, left: number, right: number, top: number, bottom: number } | null}
 */
export function computeMeasureBounds() {
  const { w, h } = getGridDims();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  if (state.selection && state.selection.size > 0) {
    for (const key of state.selection) {
      const [sx, sy] = String(key).split(",").map(Number);
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
      if (sx < minX) minX = sx;
      if (sy < minY) minY = sy;
      if (sx + 1 > maxX) maxX = sx + 1;
      if (sy + 1 > maxY) maxY = sy + 1;
    }
  } else {
    const activeLayer = state.layers?.[state.activeLayerIndex];
    const grid = activeLayer?.type !== "folder" ? activeLayer?.grid : null;
    if (!Array.isArray(grid)) return null;
    for (let y = 0; y < Math.min(h, grid.length); y++) {
      const row = grid[y];
      if (!Array.isArray(row)) continue;
      for (let x = 0; x < Math.min(w, row.length); x++) {
        if (row[x] && row[x] !== 0) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x + 1 > maxX) maxX = x + 1;
          if (y + 1 > maxY) maxY = y + 1;
        }
      }
    }
  }

  if (!Number.isFinite(minX)) return null;
  minX = Math.max(0, Math.min(w, minX));
  minY = Math.max(0, Math.min(h, minY));
  maxX = Math.max(0, Math.min(w, maxX));
  maxY = Math.max(0, Math.min(h, maxY));

  return {
    minX,
    minY,
    maxX,
    maxY,
    w,
    h,
    left: minX,
    right: Math.max(0, w - maxX),
    top: minY,
    bottom: Math.max(0, h - maxY),
  };
}

function getOrCreateOverlay(canvas) {
  const host = canvas?.parentElement;
  if (!host) return null;
  let el = document.getElementById("distanceMeasureOverlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "distanceMeasureOverlay";
    el.setAttribute("aria-hidden", "true");
    host.appendChild(el);
  }
  return el;
}

/**
 * Activa/desactiva el modo medición (`Ctrl` presionado) y re-renderiza el overlay.
 * @param {boolean} active
 */
export function setDistanceMeasureActive(active) {
  const next = Boolean(active);
  if (next === measureActive) return;
  measureActive = next;
  renderDistanceMeasureOverlay();
}

/**
 * Renderiza cotas X/Y nítidas (1:1 CSS) desde el bounding box al borde del lienzo.
 */
export function renderDistanceMeasureOverlay() {
  if (typeof document === "undefined") return;
  const canvas = /** @type {HTMLCanvasElement|null} */ (document.getElementById("paintCanvas"));
  if (!canvas) return;
  const overlay = getOrCreateOverlay(canvas);
  if (!overlay) return;

  if (!measureActive || state.isPlaying || !MEASURE_TOOLS.has(state.currentTool)) {
    if (overlay.style.display !== "none") overlay.style.display = "none";
    return;
  }

  const bounds = computeMeasureBounds();
  if (!bounds) {
    if (overlay.style.display !== "none") overlay.style.display = "none";
    return;
  }

  const mode = state.tiledMode || "none";
  const tilesX = mode === "x" || mode === "both" ? 3 : 1;
  const tilesY = mode === "y" || mode === "both" ? 3 : 1;
  const centerTx = Math.floor(tilesX / 2);
  const centerTy = Math.floor(tilesY / 2);

  const canvasW = canvas.clientWidth || canvas.width;
  const canvasH = canvas.clientHeight || canvas.height;
  const cellX = canvasW / (bounds.w * tilesX);
  const cellY = canvasH / (bounds.h * tilesY);

  const originX = centerTx * bounds.w * cellX;
  const originY = centerTy * bounds.h * cellY;
  const canvasEndX = originX + bounds.w * cellX;
  const canvasEndY = originY + bounds.h * cellY;

  const bx0 = originX + bounds.minX * cellX;
  const by0 = originY + bounds.minY * cellY;
  const bx1 = originX + bounds.maxX * cellX;
  const by1 = originY + bounds.maxY * cellY;
  const midX = (bx0 + bx1) / 2;
  const midY = (by0 + by1) / 2;

  const isWin98 = document.body?.classList.contains("theme-win98");
  const isLight = Boolean(state.isLightTheme) || document.body?.classList.contains("theme-light");
  const cfg = state.guidesOverlayConfig || {};
  const auto = cfg.autoColor !== false;
  const thick = Math.max(0.5, Math.min(3, Number(cfg.thickness ?? 1.5) || 1.5));
  const strokeColor = auto
    ? (isWin98 ? "#000080" : isLight ? "#b45309" : "#f59e0b")
    : (cfg.measureColor || "#f59e0b");
  const pillStyle = isWin98
    ? `background:#ffffe1;color:#000000;border:1px solid #000000;border-radius:0;box-shadow:1px 1px 0 #000000;`
    : `background:rgba(15,23,42,0.9);color:${auto && !isLight ? "#fbbf24" : "#fde68a"};border:1px solid ${strokeColor};border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,0.4);`;

  const svgLines = [
    `<rect x="${bx0.toFixed(1)}" y="${by0.toFixed(1)}" width="${Math.max(1, bx1 - bx0).toFixed(1)}" height="${Math.max(1, by1 - by0).toFixed(1)}" fill="none" stroke="${strokeColor}" stroke-width="${thick}" stroke-dasharray="3 2"/>`,
  ];
  const labels = [];
  const addPill = (x, y, text) => {
    labels.push(
      `<div style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;transform:translate(-50%,-50%);${pillStyle}padding:1px 4px;font:600 10px/1.2 var(--font-mono,monospace);white-space:nowrap;">${text}</div>`,
    );
  };

  if (bounds.left > 0) {
    svgLines.push(`<line x1="${originX.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${bx0.toFixed(1)}" y2="${midY.toFixed(1)}" stroke="${strokeColor}" stroke-width="${thick}" stroke-dasharray="3 2"/>`);
    addPill((originX + bx0) / 2, midY - 10, `← ${bounds.left}px`);
  }
  if (bounds.right > 0) {
    svgLines.push(`<line x1="${bx1.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${canvasEndX.toFixed(1)}" y2="${midY.toFixed(1)}" stroke="${strokeColor}" stroke-width="${thick}" stroke-dasharray="3 2"/>`);
    addPill((bx1 + canvasEndX) / 2, midY - 10, `${bounds.right}px →`);
  }
  if (bounds.top > 0) {
    svgLines.push(`<line x1="${midX.toFixed(1)}" y1="${originY.toFixed(1)}" x2="${midX.toFixed(1)}" y2="${by0.toFixed(1)}" stroke="${strokeColor}" stroke-width="${thick}" stroke-dasharray="3 2"/>`);
    addPill(midX + 18, (originY + by0) / 2, `↑ ${bounds.top}px`);
  }
  if (bounds.bottom > 0) {
    svgLines.push(`<line x1="${midX.toFixed(1)}" y1="${by1.toFixed(1)}" x2="${midX.toFixed(1)}" y2="${canvasEndY.toFixed(1)}" stroke="${strokeColor}" stroke-width="${thick}" stroke-dasharray="3 2"/>`);
    addPill(midX + 18, (by1 + canvasEndY) / 2, `↓ ${bounds.bottom}px`);
  }

  overlay.style.display = "block";
  overlay.innerHTML = `<svg width="${canvasW}" height="${canvasH}" style="position:absolute;inset:0;overflow:visible;">${svgLines.join("")}</svg>${labels.join("")}`;
}
