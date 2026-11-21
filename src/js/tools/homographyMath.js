/**
 * homographyMath.js: Matemática pura 2D/3×3 para Transformación Libre (sin DOM ni estado global).
 */

/** Resuelve el sistema 8×8 por eliminación gaussiana para mapear `dst` al cuadrado unitario [0,1]×[0,1]. */
export function computeQuadToUnitHomography(dst) {
  const src = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const A = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dst[i], { x: u, y: v } = src[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let col = 0; col < 8; col++) {
    let pivotRow = col, maxVal = Math.abs(A[col][col]);
    for (let r = col + 1; r < 8; r++) {
      if (Math.abs(A[r][col]) > maxVal) { maxVal = Math.abs(A[r][col]); pivotRow = r; }
    }
    if (maxVal < 1e-9) return null;
    if (pivotRow !== col) [A[col], A[pivotRow]] = [A[pivotRow], A[col]];
    const diag = A[col][col];
    for (let c = col; c < 9; c++) A[col][c] /= diag;
    for (let r = 0; r < 8; r++) {
      if (r === col || Math.abs(A[r][col]) < 1e-12) continue;
      const f = A[r][col];
      for (let c = col; c < 9; c++) A[r][c] -= f * A[col][c];
    }
  }
  return [A[0][8], A[1][8], A[2][8], A[3][8], A[4][8], A[5][8], A[6][8], A[7][8], 1];
}

/** Indica si el punto `(px, py)` cae dentro del cuadrilátero `corners`. */
export function pointInQuad(px, py, corners) {
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const { x: xi, y: yi } = corners[i], { x: xj, y: yj } = corners[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distancia euclidiana mínima desde `(px, py)` al segmento `(ax, ay)-(bx, by)`. */
export function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, lenSq = vx * vx + vy * vy;
  if (lenSq < 1e-8) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / lenSq));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

/** Devuelve los 9 handles en coordenadas de grilla para hit-testing y renderizado. */
export function getFreeTransformHandles(corners) {
  const [tl, tr, br, bl] = corners;
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const t = mid(tl, tr), r = mid(tr, br), b = mid(bl, br), l = mid(tl, bl);
  const edgeDx = tr.x - tl.x, edgeDy = tr.y - tl.y, edgeLen = Math.hypot(edgeDx, edgeDy) || 1;
  const rotDist = Math.max(3, Math.min(8, edgeLen * 0.18));
  return {
    tl, tr, br, bl, t, r, b, l,
    rot: { x: t.x + (edgeDy / edgeLen) * rotDist, y: t.y - (edgeDx / edgeLen) * rotDist },
    topMid: t,
  };
}

/** Rota las 4 esquinas `rad` radianes alrededor de `pivot` (o de su centroide si se omite). */
export function rotateCornersAroundPoint(corners, rad, pivot = null) {
  const cx = pivot?.x ?? (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4;
  const cy = pivot?.y ?? (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return corners.map((p) => {
    const dx = p.x - cx, dy = p.y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
}

/** Rota las 4 esquinas `rad` radianes alrededor de su centroide. */
export function rotateCornersAroundCenter(corners, rad) {
  return rotateCornersAroundPoint(corners, rad, null);
}

/** Aplica arrastre sobre una esquina (`tl`, `tr`, `br`, `bl`) según modo y modificadores. */
export function applyCornerDrag(c, dragType, dx, dy, effectiveMode, isShift) {
  const idxMap = { tl: 0, tr: 1, br: 2, bl: 3 };
  const oppMap = { tl: 2, tr: 3, br: 0, bl: 1 };
  const symMap = { tl: 1, tr: 0, br: 3, bl: 2 };
  const idx = idxMap[dragType];
  if (effectiveMode === "perspective") {
    c[idx] = { x: c[idx].x + dx, y: c[idx].y + dy };
    return c;
  }
  if (effectiveMode === "symmetric") {
    const partner = symMap[dragType];
    c[idx] = { x: c[idx].x + dx, y: c[idx].y + dy };
    c[partner] = { x: c[partner].x - dx, y: c[partner].y + dy };
    return c;
  }
  const opp = c[oppMap[dragType]];
  const vx = c[idx].x - opp.x, vy = c[idx].y - opp.y;
  let sx = Math.abs(vx) > 1e-4 ? (c[idx].x + dx - opp.x) / vx : 1;
  let sy = Math.abs(vy) > 1e-4 ? (c[idx].y + dy - opp.y) / vy : 1;
  if (isShift) {
    const uniform = Math.max(Math.abs(sx), Math.abs(sy));
    sx = Math.sign(sx || 1) * uniform;
    sy = Math.sign(sy || 1) * uniform;
  }
  return c.map((p) => ({ x: opp.x + (p.x - opp.x) * sx, y: opp.y + (p.y - opp.y) * sy }));
}

/** Aplica arrastre sobre un borde (`t`, `r`, `b`, `l`) según modo (skew o escala normal). */
export function applyEdgeDrag(c, dragType, dx, dy, effectiveMode, isCtrl) {
  if (effectiveMode === "perspective" || isCtrl) {
    if (dragType === "t") { c[0].x += dx; c[1].x += dx; }
    else if (dragType === "b") { c[2].x += dx; c[3].x += dx; }
    else if (dragType === "l") { c[0].y += dy; c[3].y += dy; }
    else if (dragType === "r") { c[1].y += dy; c[2].y += dy; }
    return c;
  }
  const pairs = { t: { move: [0, 1], anchor: [3, 2] }, b: { move: [3, 2], anchor: [0, 1] }, l: { move: [0, 3], anchor: [1, 2] }, r: { move: [1, 2], anchor: [0, 3] } };
  const { move, anchor } = pairs[dragType];
  const ax = (c[anchor[0]].x + c[anchor[1]].x) / 2, ay = (c[anchor[0]].y + c[anchor[1]].y) / 2;
  const mx = (c[move[0]].x + c[move[1]].x) / 2, my = (c[move[0]].y + c[move[1]].y) / 2;
  const ux = mx - ax, uy = my - ay, lenSq = ux * ux + uy * uy || 1;
  const proj = ((mx + dx - ax) * ux + (my + dy - ay) * uy) / lenSq;
  for (const i of move) {
    const aPt = c[anchor[move.indexOf(i)]];
    c[i] = { x: aPt.x + ux * proj, y: aPt.y + uy * proj };
  }
  return c;
}
