// @ts-check
/**
 * SelectionOverlayRenderer.js: Renderizado de Marching Ants (máscara y rectángulo),
 * vista previa de Lazo y gizmo de Transformación Libre.
 */

import { state } from "../core/state.js";

function drawMaskFillSpans(ctx, cellSize, x, y, w, h, mask) {
  ctx.fillStyle = "rgba(59, 130, 246, 0.16)";
  for (let r = 0; r < h; r++) {
    const py = Math.floor((y + r) * cellSize);
    const py2 = Math.floor((y + r + 1) * cellSize);
    let c = 0;
    while (c < w) {
      if (mask[r * w + c] !== 1) { c++; continue; }
      const startC = c;
      while (c < w && mask[r * w + c] === 1) c++;
      const px = Math.floor((x + startC) * cellSize);
      const px2 = Math.floor((x + c) * cellSize);
      ctx.fillRect(px, py, px2 - px, py2 - py);
    }
  }
}

function traceMaskHorizontalEdges(ctx, cellSize, x, y, w, h, mask) {
  for (let r = 0; r < h; r++) {
    const pyTop = Math.floor((y + r) * cellSize) + 0.5;
    const pyBot = Math.floor((y + r + 1) * cellSize) + 0.5;
    let c = 0;
    while (c < w) {
      const hasTop = mask[r * w + c] === 1 && (r === 0 || mask[(r - 1) * w + c] !== 1);
      if (!hasTop) { c++; continue; }
      const sc = c;
      while (c < w && mask[r * w + c] === 1 && (r === 0 || mask[(r - 1) * w + c] !== 1)) c++;
      ctx.moveTo(Math.floor((x + sc) * cellSize), pyTop);
      ctx.lineTo(Math.floor((x + c) * cellSize), pyTop);
    }
    c = 0;
    while (c < w) {
      const hasBot = mask[r * w + c] === 1 && (r === h - 1 || mask[(r + 1) * w + c] !== 1);
      if (!hasBot) { c++; continue; }
      const sc = c;
      while (c < w && mask[r * w + c] === 1 && (r === h - 1 || mask[(r + 1) * w + c] !== 1)) c++;
      ctx.moveTo(Math.floor((x + sc) * cellSize), pyBot);
      ctx.lineTo(Math.floor((x + c) * cellSize), pyBot);
    }
  }
}

function traceMaskVerticalEdges(ctx, cellSize, x, y, w, h, mask) {
  for (let c = 0; c < w; c++) {
    const pxLeft = Math.floor((x + c) * cellSize) + 0.5;
    const pxRight = Math.floor((x + c + 1) * cellSize) + 0.5;
    let r = 0;
    while (r < h) {
      const hasLeft = mask[r * w + c] === 1 && (c === 0 || mask[r * w + (c - 1)] !== 1);
      if (!hasLeft) { r++; continue; }
      const sr = r;
      while (r < h && mask[r * w + c] === 1 && (c === 0 || mask[r * w + (c - 1)] !== 1)) r++;
      ctx.moveTo(pxLeft, Math.floor((y + sr) * cellSize));
      ctx.lineTo(pxLeft, Math.floor((y + r) * cellSize));
    }
    r = 0;
    while (r < h) {
      const hasRight = mask[r * w + c] === 1 && (c === w - 1 || mask[r * w + (c + 1)] !== 1);
      if (!hasRight) { r++; continue; }
      const sr = r;
      while (r < h && mask[r * w + c] === 1 && (c === w - 1 || mask[r * w + (c + 1)] !== 1)) r++;
      ctx.moveTo(pxRight, Math.floor((y + sr) * cellSize));
      ctx.lineTo(pxRight, Math.floor((y + r) * cellSize));
    }
  }
}

/**
 * Dibuja el borde animado (Marching Ants) de la selección activa.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cellSize
 * @param {number} [dashOffset=0]
 */
export function drawSelectionOverlay(ctx, cellSize, dashOffset = 0) {
  if (!state.selection) return;
  const { x, y, w, h, mask } = state.selection;
  ctx.save();

  if (mask) {
    drawMaskFillSpans(ctx, cellSize, x, y, w, h, mask);
    ctx.beginPath();
    traceMaskHorizontalEdges(ctx, cellSize, x, y, w, h, mask);
    traceMaskVerticalEdges(ctx, cellSize, x, y, w, h, mask);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.lineDashOffset = -dashOffset + 4;
    ctx.strokeStyle = "#09090b";
    ctx.stroke();
    ctx.restore();
    return;
  }

  const px = Math.floor(x * cellSize);
  const py = Math.floor(y * cellSize);
  const pw = Math.floor((x + w) * cellSize) - px;
  const ph = Math.floor((y + h) * cellSize) - py;
  ctx.fillStyle = "rgba(59, 130, 246, 0.16)";
  ctx.fillRect(px, py, pw, ph);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.lineDashOffset = -dashOffset;
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(px + 0.5, py + 0.5, pw, ph);
  ctx.lineDashOffset = -dashOffset + 4;
  ctx.strokeStyle = "#09090b";
  ctx.strokeRect(px + 0.5, py + 0.5, pw, ph);
  ctx.restore();
}

/**
 * Dibuja el cuadrilátero y las 9 manijas del gizmo de Transformación Libre.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cellSize
 * @param {number} zoom
 * @param {Array<{x: number, y: number}>} corners
 */
export function drawFreeTransformOverlay(ctx, cellSize, zoom, corners) {
  const pts = corners.map((p) => ({ x: p.x * cellSize, y: p.y * cellSize }));
  const topMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  const edgeDx = pts[1].x - pts[0].x;
  const edgeDy = pts[1].y - pts[0].y;
  const edgeLen = Math.hypot(edgeDx, edgeDy) || 1;
  const rotDist = Math.max(18 / zoom, Math.min(36 / zoom, edgeLen * 0.18));
  const rotPt = {
    x: topMid.x + (edgeDy / edgeLen) * rotDist,
    y: topMid.y - (edgeDx / edgeLen) * rotDist,
  };

  ctx.save();
  ctx.lineWidth = 1.5 / zoom;
  ctx.strokeStyle = "#38bdf8";
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(pts[3].x, pts[3].y);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(topMid.x, topMid.y);
  ctx.lineTo(rotPt.x, rotPt.y);
  ctx.stroke();

  ctx.fillStyle = "#38bdf8";
  ctx.strokeStyle = "#09090b";
  ctx.beginPath();
  ctx.arc(rotPt.x, rotPt.y, 4.5 / zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const handles = [
    pts[0], pts[1], pts[2], pts[3],
    mid(pts[0], pts[1]), mid(pts[1], pts[2]), mid(pts[3], pts[2]), mid(pts[0], pts[3]),
  ];
  const hs = 6 / zoom;
  ctx.fillStyle = "#ffffff";
  for (const h of handles) {
    ctx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
    ctx.strokeRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
  }
  ctx.restore();
}

/**
 * Dibuja la vista previa de trazo de Lazo en vivo.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cellSize
 * @param {Array<{x: number, y: number}>} points
 */
export function drawLassoPreview(ctx, cellSize, points) {
  if (!points || points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  points.forEach((pt, idx) => {
    const px = (pt.x + 0.5) * cellSize;
    const py = (pt.y + 0.5) * cellSize;
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.restore();
}
