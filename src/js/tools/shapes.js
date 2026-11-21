/**
 * shapes.js: Algoritmos de rasterización geométrica pixel-art sin antialiasing:
 * - Bresenham Line (entero puro) + patrones discretos (sólida, punteada, guiones, punto-guión).
 * - Curvas Bézier de 1 a 3 puntos mediante Algoritmo de De Casteljau + muestreo Bresenham.
 * - Rectángulo, Midpoint Circle simétrico en 8 octantes y Triángulo isósceles.
 */

import { state } from "../core/state.js";
import { plotWithMirror, plotBrushWithMirror, traceBresenhamPoints } from "./tools.js";

/**
 * Determina si el paso `step` debe pintarse según el estilo de línea y grosor.
 * @param {number} step
 * @param {"solid"|"dotted"|"dashed"|"dashdot"} style
 * @param {number} thickness
 * @returns {boolean}
 */
// --- PATRONES DE TRAZO Y LÍNEAS BRESENHAM ---
function shouldPlotPatternStep(step, style, thickness) {
  if (style === "solid" || !style) return true;
  const unit = Math.max(1, thickness);
  if (style === "dotted") {
    return step % (unit + 1) === 0;
  }
  if (style === "dashed") {
    const on = unit * 3;
    const off = unit * 2;
    return step % (on + off) < on;
  }
  if (style === "dashdot") {
    const onLong = unit * 3;
    const gap = unit * 2;
    const onDot = unit;
    const period = onLong + gap + onDot + gap;
    const m = step % period;
    return m < onLong || (m >= onLong + gap && m < onLong + gap + onDot);
  }
  return true;
}

/**
 * Traza una línea recta pixel-perfect entre (x0, y0) y (x1, y1) con algoritmo de Bresenham.
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} colorIndex
 * @param {number} [thickness=1]
 */
export function drawBresenhamLine(x0, y0, x1, y1, colorIndex, thickness = 1) {
  traceBresenhamPoints(x0, y0, x1, y1, (cx, cy) => {
    plotBrushWithMirror(cx, cy, colorIndex, thickness);
  });
  state.isDirtySinceImport = true;
}

/**
 * Traza una línea recta con estilo configurable (solid, dotted, dashed, dashdot).
 */
export function drawStyledLine(x0, y0, x1, y1, colorIndex, thickness = 1, style = "solid") {
  if (style === "solid") {
    drawBresenhamLine(x0, y0, x1, y1, colorIndex, thickness);
    return;
  }
  let step = 0;
  traceBresenhamPoints(x0, y0, x1, y1, (cx, cy) => {
    if (shouldPlotPatternStep(step++, style, thickness)) {
      plotBrushWithMirror(cx, cy, colorIndex, thickness);
    }
  });
  state.isDirtySinceImport = true;
}

// --- CURVAS BÉZIER (ALGORITMO DE DE CASTELJAU) ---
/**
 * Evalúa un punto en una curva Bézier de grado arbitrario (De Casteljau).
 * @param {Array<{x: number, y: number}>} pts
 * @param {number} t
 * @returns {{x: number, y: number}}
 */
function evalDeCasteljau(pts, t) {
  let work = pts.map((p) => ({ x: p.x, y: p.y }));
  while (work.length > 1) {
    const next = [];
    for (let i = 0; i < work.length - 1; i++) {
      next.push({
        x: work[i].x + (work[i + 1].x - work[i].x) * t,
        y: work[i].y + (work[i + 1].y - work[i].y) * t,
      });
    }
    work = next;
  }
  return work[0];
}

/**
 * Traza una curva Bézier pixel-art de 1, 2 o 3 puntos de curvatura desde (x0,y0) hasta (x1,y1).
 * Con 1 punto de control ajusta el vértice para que el arco pase exactamente por el cursor.
 * @param {number} x0
 * @param {number} y0
 * @param {Array<{x: number, y: number}>} controlPoints
 * @param {number} x1
 * @param {number} y1
 * @param {number} colorIndex
 * @param {number} [thickness=1]
 * @param {"solid"|"dotted"|"dashed"|"dashdot"} [style="solid"]
 */
export function drawBezierCurve(
  x0,
  y0,
  controlPoints,
  x1,
  y1,
  colorIndex,
  thickness = 1,
  style = "solid",
) {
  const cps = Array.isArray(controlPoints) ? controlPoints : [];
  let poly;
  if (cps.length === 1) {
    const p = cps[0];
    const cx = 2 * p.x - 0.5 * (x0 + x1);
    const cy = 2 * p.y - 0.5 * (y0 + y1);
    poly = [{ x: x0, y: y0 }, { x: cx, y: cy }, { x: x1, y: y1 }];
  } else {
    poly = [{ x: x0, y: y0 }, ...cps, { x: x1, y: y1 }];
  }

  let estLen = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    estLen += Math.hypot(poly[i + 1].x - poly[i].x, poly[i + 1].y - poly[i].y);
  }
  const samples = Math.max(16, Math.ceil(estLen * 2));

  let prevX = Math.round(x0);
  let prevY = Math.round(y0);
  let step = 0;
  let lastPlottedX = null;
  let lastPlottedY = null;

  const plotPoint = (gx, gy) => {
    if (gx === lastPlottedX && gy === lastPlottedY) return;
    lastPlottedX = gx;
    lastPlottedY = gy;
    if (shouldPlotPatternStep(step++, style, thickness)) {
      plotBrushWithMirror(gx, gy, colorIndex, thickness);
    }
  };

  plotPoint(prevX, prevY);

  for (let i = 1; i <= samples; i++) {
    const pt = evalDeCasteljau(poly, i / samples);
    const bx = Math.round(pt.x);
    const by = Math.round(pt.y);
    if (bx === prevX && by === prevY) continue;
    traceBresenhamPoints(prevX, prevY, bx, by, (sx, sy) => {
      plotPoint(sx, sy);
    });
    prevX = bx;
    prevY = by;
  }

  state.isDirtySinceImport = true;
}

/**
 * Alias compatible para curva cuadrática de 1 punto.
 */
export function drawQuadraticCurve(x0, y0, px, py, x1, y1, colorIndex, thickness = 1, style = "solid") {
  drawBezierCurve(x0, y0, [{ x: px, y: py }], x1, y1, colorIndex, thickness, style);
}

// --- FORMAS GEOMÉTRICAS (RECTÁNGULO, MIDPOINT CIRCLE, TRIÁNGULO) ---
/**
 * Traza un rectángulo alineado a la grilla (contorno o relleno).
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} colorIndex
 * @param {boolean} [filled=false]
 * @param {number} [thickness=1]
 */
export function drawPixelRect(x0, y0, x1, y1, colorIndex, filled = false, thickness = 1, style = "solid") {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);

  if (!filled) {
    drawStyledLine(minX, minY, maxX, minY, colorIndex, thickness, style);
    drawStyledLine(maxX, minY, maxX, maxY, colorIndex, thickness, style);
    drawStyledLine(maxX, maxY, minX, maxY, colorIndex, thickness, style);
    drawStyledLine(minX, maxY, minX, minY, colorIndex, thickness, style);
    return;
  }

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      plotWithMirror(x, y, colorIndex);
    }
  }
  state.isDirtySinceImport = true;
}

/**
 * Traza un círculo simétrico en 8 octantes mediante el algoritmo Midpoint Circle.
 * @param {number} cx Centro X.
 * @param {number} cy Centro Y.
 * @param {number} radius Radio en píxeles.
 * @param {number} colorIndex
 * @param {boolean} [filled=false]
 * @param {number} [thickness=1]
 * @param {"solid"|"dotted"|"dashed"|"dashdot"} [style="solid"]
 */
export function drawMidpointCircle(cx, cy, radius, colorIndex, filled = false, thickness = 1, style = "solid") {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) {
    plotBrushWithMirror(cx, cy, colorIndex, filled ? 1 : thickness);
    state.isDirtySinceImport = true;
    return;
  }

  const plotSpan = (yOff, xSpan) => {
    for (let dx = -xSpan; dx <= xSpan; dx++) {
      plotWithMirror(cx + dx, cy + yOff, colorIndex);
      if (yOff !== 0) plotWithMirror(cx + dx, cy - yOff, colorIndex);
    }
  };

  let x = r;
  let y = 0;
  let err = 1 - x;
  const styledOutline = !filled && style && style !== "solid";
  const ringPts = styledOutline ? new Map() : null;

  const addRingPt = (px, py) => {
    const key = `${px},${py}`;
    if (!ringPts.has(key)) ringPts.set(key, { x: px, y: py });
  };

  while (x >= y) {
    if (filled) {
      plotSpan(y, x);
      plotSpan(x, y);
    } else if (styledOutline) {
      addRingPt(cx + x, cy + y);
      addRingPt(cx - x, cy + y);
      addRingPt(cx + x, cy - y);
      addRingPt(cx - x, cy - y);
      addRingPt(cx + y, cy + x);
      addRingPt(cx - y, cy + x);
      addRingPt(cx + y, cy - x);
      addRingPt(cx - y, cy - x);
    } else {
      plotBrushWithMirror(cx + x, cy + y, colorIndex, thickness);
      plotBrushWithMirror(cx - x, cy + y, colorIndex, thickness);
      plotBrushWithMirror(cx + x, cy - y, colorIndex, thickness);
      plotBrushWithMirror(cx - x, cy - y, colorIndex, thickness);
      plotBrushWithMirror(cx + y, cy + x, colorIndex, thickness);
      plotBrushWithMirror(cx - y, cy + x, colorIndex, thickness);
      plotBrushWithMirror(cx + y, cy - x, colorIndex, thickness);
      plotBrushWithMirror(cx - y, cy - x, colorIndex, thickness);
    }
    y++;
    if (err < 0) {
      err += 2 * y + 1;
    } else {
      x--;
      err += 2 * (y - x + 1);
    }
  }

  if (styledOutline) {
    const sorted = Array.from(ringPts.values()).sort(
      (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
    );
    for (let i = 0; i < sorted.length; i++) {
      if (shouldPlotPatternStep(i, style, thickness)) {
        plotBrushWithMirror(sorted[i].x, sorted[i].y, colorIndex, thickness);
      }
    }
  }
  state.isDirtySinceImport = true;
}

/**
 * Traza un triángulo isósceles pixel-perfect dentro del bounding box (contorno o relleno).
 * @param {any} x0
 * @param {any} y0
 * @param {any} x1
 * @param {any} y1
 * @param {number} colorIndex
 * @param {boolean} [filled=false]
 * @param {number} [thickness=1]
 * @param {"solid"|"dotted"|"dashed"|"dashdot"} [style="solid"]
 */
export function drawPixelTriangle(x0, y0, x1, y1, colorIndex, filled = false, thickness = 1, style = "solid") {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const invertY = y1 < y0;

  const apexX = Math.round((minX + maxX) / 2);
  const apexY = invertY ? maxY : minY;
  const baseY = invertY ? minY : maxY;

  if (!filled) {
    drawStyledLine(apexX, apexY, minX, baseY, colorIndex, thickness, style);
    drawStyledLine(minX, baseY, maxX, baseY, colorIndex, thickness, style);
    drawStyledLine(maxX, baseY, apexX, apexY, colorIndex, thickness, style);
    return;
  }

  const totalH = Math.max(1, Math.abs(baseY - apexY));
  const stepY = baseY >= apexY ? 1 : -1;
  for (let i = 0; i <= totalH; i++) {
    const py = apexY + i * stepY;
    const t = totalH === 0 ? 1 : i / totalH;
    const lx = Math.round(apexX + (minX - apexX) * t);
    const rx = Math.round(apexX + (maxX - apexX) * t);
    const s = Math.min(lx, rx);
    const e = Math.max(lx, rx);
    for (let px = s; px <= e; px++) {
      plotWithMirror(px, py, colorIndex);
    }
  }
  state.isDirtySinceImport = true;
}
