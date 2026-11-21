/**
 * strategyHelpers.js: Helpers compartidos y fábricas de estrategias (sin acceso al DOM).
 */

import { state, pushLayerState, cloneGrid } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { restoreActiveLayerFromSnapshot } from "./tools.js";

// --- HELPERS COMUNES DE ESTRATEGIAS (SIN ACCESO AL DOM) ---
/**
 * Indica si la forma debe dibujarse rellena (Shift presionado o toggle `state.fillShapes`).
 * @param {MouseEvent} [event]
 * @returns {boolean}
 */
export function shouldFillShape(event) {
  return Boolean(event?.shiftKey || state.fillShapes);
}

/**
 * Devuelve el radio fijo configurado para círculos, o `0` si el radio es libre.
 * @returns {number}
 */
export function getFixedCircleRadius() {
  const val = Number(state.circleRadius || 0);
  return Number.isFinite(val) && val > 0 ? Math.round(val) : 0;
}

/**
 * Limpia la selección activa si el puntero hizo clic fuera de su bounding box.
 * @param {number} x
 * @param {number} y
 */
export function cancelSelectionIfOutside(x, y) {
  if (!state.selection) return;
  const { x: sx, y: sy, w: sw, h: sh } = state.selection;
  if (x < sx || x >= sx + sw || y < sy || y >= sy + sh) {
    state.selection = null;
    renderAll();
  }
}

/**
 * Resuelve el índice de color a pintar según el botón del mouse y la herramienta activa.
 * @param {number} button
 * @returns {number}
 */
export function resolveStrokeColor(button) {
  if (state.currentTool === "eraser") return 0;
  return button === 2 ? (state.secondaryColorIndex ?? 0) : state.currentColorIndex;
}

/**
 * Fábrica de estrategias para formas geométricas con preview en vivo (Línea / Rectángulo).
 */
export function createShapeStrategy(drawFn) {
  let start = null;
  let baseGrid = null;

  return {
    onDown({ x, y, button, event }) {
      if (button !== 0 && button !== 2) return;
      pushLayerState();
      start = { x, y };
      baseGrid = cloneGrid(state.grid);
      const col = resolveStrokeColor(button);
      drawFn({ start, x, y }, col, shouldFillShape(event));
      renderAll();
    },
    onMove({ x, y, button, event }) {
      if (!start || !baseGrid) return;
      restoreActiveLayerFromSnapshot(baseGrid);
      const col = resolveStrokeColor(button);
      drawFn({ start, x, y }, col, shouldFillShape(event));
      renderAll();
    },
    onUp() {
      start = null;
      baseGrid = null;
    },
  };
}

// --- TRAZO LIBRE (LÁPIZ PIXEL-PERFECT / GOMA / BALDE) ---
/**
 * Indica si el filtro Pixel-Perfect está habilitado en el estado.
 * @returns {boolean}
 */
export function isPixelPerfectEnabled() {
  return state.pixelPerfect !== false;
}

/**
 * Elimina píxeles redundantes ("codos" en L) de una secuencia de puntos 4/8-conectados.
 */
export function filterPixelPerfectPoints(points) {
  if (points.length < 3) return points;
  const result = [points[0]];
  let i = 1;
  while (i < points.length - 1) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];
    const isDiag =
      Math.abs(prev.x - next.x) === 1 && Math.abs(prev.y - next.y) === 1;
    const isCorner =
      (curr.x === prev.x && curr.y === next.y) ||
      (curr.y === prev.y && curr.x === next.x);

    if (isDiag && isCorner) {
      i++; // Saltar codo redundante
      continue;
    }
    result.push(curr);
    i++;
  }
  result.push(points[points.length - 1]);
  return result;
}

