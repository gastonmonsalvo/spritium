/**
 * symmetryMath.js: Cálculos geométricos puros de simetría (H/V, diagonal, radial 90°/45° y pivote 1px/2px).
 */

import { state, getGridDims } from "./stateStore.js";

/**
 * Indica si hay al menos un modo de simetría activo (H, V o Radial 90°/45°).
 * @returns {boolean}
 */
export function isSymmetryActive() {
  return Boolean(
    state.mirrorH ||
      state.mirrorV ||
      state.mirrorDiagMain ||
      state.mirrorDiagAnti ||
      state.mirrorRadial === "rot90" ||
      state.mirrorRadial === "oct45",
  );
}

/**
 * Calcula la posición efectiva del eje/centro de simetría `(axisX, axisY)` en unidades de grilla.
 * - Cuando `axis` es entero (ej. `32.0`), el eje cae ENTRE dos píxeles (modo Par / 2px).
 * - Cuando `axis` termina en `.5` (ej. `31.5`), el eje pasa por el CENTRO del píxel `31` (modo Impar / 1px Corazón).
 * @param {number} [w]
 * @param {number} [h]
 * @returns {{ axisX: number, axisY: number, isPixelCenterX: boolean, isPixelCenterY: boolean }}
 */
export function getSymmetryPivot(w, h) {
  const dims = w && h ? { w, h } : getGridDims();
  const isPixelMode = state.symmetryCenterMode === "pixel";
  const defaultX = isPixelMode ? Math.floor((dims.w - 1) / 2) + 0.5 : Math.floor(dims.w / 2);
  const defaultY = isPixelMode ? Math.floor((dims.h - 1) / 2) + 0.5 : Math.floor(dims.h / 2);

  const clampAxis = (val, maxDim, fallback) => {
    if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
    const snapped = Math.round(val * 2) / 2;
    return Math.max(0.5, Math.min(maxDim - 0.5, snapped));
  };

  const axisX = clampAxis(state.symmetryAxisX, dims.w, defaultX);
  const axisY = clampAxis(state.symmetryAxisY, dims.h, defaultY);
  const isPixelCenterX = Math.abs((axisX % 1) - 0.5) < 0.01;
  const isPixelCenterY = Math.abs((axisY % 1) - 0.5) < 0.01;

  return { axisX, axisY, isPixelCenterX, isPixelCenterY };
}

/**
 * Genera todas las coordenadas `[px, py]` simétricas para un punto `(x, y)` según los modos
 * activos (`mirrorH`, `mirrorV`, `mirrorRadial: "rot90" | "oct45"`) y el pivote `(axisX, axisY)`.
 * @param {number} x
 * @param {number} y
 * @param {number} [w]
 * @param {number} [h]
 * @returns {Array<[number, number]>} Lista deduplicada de coordenadas `[px, py]`.
 */
export function getSymmetryPoints(x, y, w, h) {
  const dims = w && h ? { w, h } : getGridDims();
  if (!isSymmetryActive()) return [[x, y]];

  const { axisX, axisY } = getSymmetryPivot(dims.w, dims.h);
  const dx = x + 0.5 - axisX;
  const dy = y + 0.5 - axisY;

  /** @type {Array<[number, number]>} */
  let vecs = [[dx, dy]];

  if (state.mirrorRadial === "oct45") {
    vecs = [
      [dx, dy],
      [-dx, dy],
      [dx, -dy],
      [-dx, -dy],
      [dy, dx],
      [-dy, dx],
      [dy, -dx],
      [-dy, -dx],
    ];
  } else {
    if (state.mirrorRadial === "rot90") {
      vecs = [
        [dx, dy],
        [-dy, dx],
        [-dx, -dy],
        [dy, -dx],
      ];
    }
    if (state.mirrorH) {
      const len = vecs.length;
      for (let i = 0; i < len; i++) {
        vecs.push([-vecs[i][0], vecs[i][1]]);
      }
    }
    if (state.mirrorV) {
      const len = vecs.length;
      for (let i = 0; i < len; i++) {
        vecs.push([vecs[i][0], -vecs[i][1]]);
      }
    }
    if (state.mirrorDiagMain) {
      const len = vecs.length;
      for (let i = 0; i < len; i++) {
        vecs.push([vecs[i][1], vecs[i][0]]);
      }
    }
    if (state.mirrorDiagAnti) {
      const len = vecs.length;
      for (let i = 0; i < len; i++) {
        vecs.push([-vecs[i][1], -vecs[i][0]]);
      }
    }
  }

  const seen = new Set();
  /** @type {Array<[number, number]>} */
  const out = [];
  for (const [tx, ty] of vecs) {
    const px = Math.round(axisX + tx - 0.5);
    const py = Math.round(axisY + ty - 0.5);
    const key = `${px},${py}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push([px, py]);
    }
  }
  return out;
}
