// @ts-check
/**
 * polygonGeometry.js: Matemática pura y rasterización pixel-art sin dependencias del DOM.
 * - Normalización de vértices y snap angular a 45°.
 * - Trazado Bresenham de segmentos y contorno cerrado.
 * - Relleno SOTA Scanline Even-Odd exacto en centros de píxel (x + 0.5, y + 0.5).
 */

/**
 * Sanitiza y normaliza una lista de vértices a coordenadas enteras sin duplicados consecutivos.
 * Si el último vértice coincide con el primero (con >= 2 puntos), lo colapsa para evitar aristas nulas.
 * @param {Array<{x: number, y: number}>} vertices
 * @returns {Array<{x: number, y: number}>}
 */
export function normalizePolygonVertices(vertices) {
  if (!Array.isArray(vertices) || vertices.length === 0) return [];
  const cleaned = [];
  for (const pt of vertices) {
    if (!pt || typeof pt !== "object") continue;
    const x = Math.round(Number(pt.x));
    const y = Math.round(Number(pt.y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const prev = cleaned[cleaned.length - 1];
    if (!prev || prev.x !== x || prev.y !== y) {
      cleaned.push({ x, y });
    }
  }
  if (cleaned.length > 1) {
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if (first.x === last.x && first.y === last.y) {
      cleaned.pop();
    }
  }
  return cleaned;
}

/**
 * Ajusta (x1, y1) al múltiplo de 45° más cercano respecto al vértice previo (x0, y0).
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {{x: number, y: number}}
 */
export function snapPolygonAngle45(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return { x: Math.round(x1), y: Math.round(y1) };
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return {
    x: Math.round(x0 + Math.cos(angle) * dist),
    y: Math.round(y0 + Math.sin(angle) * dist),
  };
}

/**
 * Determina si el punto A se encuentra dentro de un radio euclídeo respecto del punto B.
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @param {number} [radius=1]
 * @returns {boolean}
 */
export function isPointNearVertex(ax, ay, bx, by, radius = 1) {
  const r = Math.max(0, Number(radius) || 0);
  return Math.hypot(bx - ax, by - ay) <= r;
}

/**
 * Calcula todos los puntos enteros de un segmento cerrado mediante el algoritmo de Bresenham.
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {Array<{x: number, y: number}>}
 */
export function computeBresenhamSegment(x0, y0, x1, y1) {
  let cx = Math.round(x0);
  let cy = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(tx) || !Number.isFinite(ty)) {
    return [];
  }

  const pts = [{ x: cx, y: cy }];
  const dx = Math.abs(tx - cx);
  const dy = Math.abs(ty - cy);
  const sx = cx < tx ? 1 : -1;
  const sy = cy < ty ? 1 : -1;
  let err = dx - dy;

  while (cx !== tx || cy !== ty) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
    pts.push({ x: cx, y: cy });
  }
  return pts;
}

/**
 * Traza la lista deduplicada de píxeles que forman el perímetro cerrado de un polígono.
 * @param {Array<{x: number, y: number}>} vertices
 * @returns {Array<{x: number, y: number}>}
 */
export function traceClosedPolygonOutline(vertices) {
  const verts = normalizePolygonVertices(vertices);
  if (verts.length === 0) return [];
  if (verts.length === 1) return [{ x: verts[0].x, y: verts[0].y }];

  const seen = new Set();
  const out = [];
  const pushUnique = (x, y) => {
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x, y });
  };

  const edgeCount = verts.length === 2 ? 1 : verts.length;
  for (let i = 0; i < edgeCount; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const seg = computeBresenhamSegment(a.x, a.y, b.x, b.y);
    for (const pt of seg) {
      pushUnique(pt.x, pt.y);
    }
  }
  return out;
}

/**
 * Rasteriza el relleno interior de un polígono arbitrario (convexo, cóncavo o auto-intersectante)
 * usando regla par-impar (Even-Odd) Scanline en centros de píxel (x + 0.5, y + 0.5).
 * Por defecto incluye además el perímetro Bresenham cerrado para evitar huecos en puntas finas.
 * @param {Array<{x: number, y: number}>} vertices
 * @param {{ includeOutline?: boolean }} [options]
 * @returns {Array<{x: number, y: number}>}
 */
export function scanlineFillPolygon(vertices, options = {}) {
  const includeOutline = options?.includeOutline !== false;
  const verts = normalizePolygonVertices(vertices);
  if (verts.length === 0) return [];
  if (verts.length < 3) {
    return traceClosedPolygonOutline(verts);
  }

  const seen = new Set();
  const out = [];
  const pushUnique = (x, y) => {
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x, y });
  };

  if (includeOutline) {
    for (const pt of traceClosedPolygonOutline(verts)) {
      pushUnique(pt.x, pt.y);
    }
  }

  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of verts) {
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }

  const n = verts.length;
  for (let py = minY; py <= maxY; py++) {
    const sy = py + 0.5;
    const intersections = [];

    for (let i = 0, j = n - 1; i < n; j = i++) {
      if (verts[j].y === py && verts[i].y === py) {
        const sx = Math.min(verts[j].x, verts[i].x);
        const ex = Math.max(verts[j].x, verts[i].x);
        for (let px = sx; px <= ex; px++) {
          pushUnique(px, py);
        }
        continue;
      }
      const ay = verts[j].y + 0.5;
      const by = verts[i].y + 0.5;
      if ((ay > sy) === (by > sy)) continue;

      const ax = verts[j].x + 0.5;
      const bx = verts[i].x + 0.5;
      const ix = ax + ((sy - ay) * (bx - ax)) / (by - ay);
      intersections.push(ix);
    }

    intersections.sort((a, b) => a - b);
    for (let k = 0; k + 1 < intersections.length; k += 2) {
      const startX = Math.ceil(intersections[k] - 0.5);
      const endX = Math.floor(intersections[k + 1] - 0.5);
      for (let px = startX; px <= endX; px++) {
        pushUnique(px, py);
      }
    }
  }

  return out;
}
