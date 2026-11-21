// @ts-check
/**
 * OverlayPipeline.js: Pipeline abierto de overlays del lienzo (Open/Closed Principle):
 * - Registro extensible `registerCanvasOverlay(fn)` (ej. Tilemap Grid + Ghost Preview).
 * - Orquestación de Marching Ants, Lazo, Guías Snap, FreeTransform y Cursor Preview.
 */

import { state } from "../core/state.js";
import { drawSnapGuides } from "./GridAndGuidesRenderer.js";
import {
  drawSelectionOverlay as renderSelectionOverlay,
  drawFreeTransformOverlay,
  drawLassoPreview,
} from "./SelectionOverlayRenderer.js";
import { drawPixelCursorOverlay } from "./CursorPreviewOverlay.js";

export { drawFreeTransformOverlay };

const registeredCanvasOverlays = new Set();
let selectionAnimFrame = null;
let selectionDashOffset = 0;
let lastMarchTimestamp = 0;

/**
 * Registra un callback de overlay en el pipeline del lienzo principal.
 * @param {(ctx: CanvasRenderingContext2D, cellSize: number, tileOriginX: number, tileOriginY: number, baseW: number, baseH: number, zoom: number) => void} fn
 */
export function registerCanvasOverlay(fn) {
  if (typeof fn === "function") {
    registeredCanvasOverlays.add(fn);
  }
}

/**
 * Ejecuta todos los overlays registrados sobre el lienzo.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cellSize
 * @param {number} tileOriginX
 * @param {number} tileOriginY
 * @param {number} baseW
 * @param {number} baseH
 * @param {number} zoom
 */
export function runCanvasOverlays(ctx, cellSize, tileOriginX, tileOriginY, baseW, baseH, zoom) {
  for (const overlayFn of registeredCanvasOverlays) {
    overlayFn(ctx, cellSize, tileOriginX, tileOriginY, baseW, baseH, zoom);
  }
}

/**
 * Dibuja el borde animado (Marching Ants) de la selección activa.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cellSize
 */
export function drawSelectionOverlay(ctx, cellSize) {
  renderSelectionOverlay(ctx, cellSize, selectionDashOffset);
}

function scheduleMarchingAnts(onTickRender) {
  if (selectionAnimFrame !== null) return;
  const tick = (now) => {
    selectionAnimFrame = null;
    if (!state.selection) return;
    if (now - lastMarchTimestamp >= 90) {
      lastMarchTimestamp = now;
      selectionDashOffset = (selectionDashOffset + 1) % 8;
      onTickRender();
    } else {
      selectionAnimFrame = requestAnimationFrame(tick);
    }
  };
  selectionAnimFrame = requestAnimationFrame(tick);
}

/**
 * Dibuja los overlays interactivos del tile activo (Lazo, Selección, Guías Snap y FreeTransform).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cellSize
 * @param {number} tileOriginX
 * @param {number} tileOriginY
 * @param {number} baseW
 * @param {number} baseH
 * @param {number} zoom
 * @param {() => void} onTickRender
 */
export function drawSelectionAndGizmosOverlay(ctx, cellSize, tileOriginX, tileOriginY, baseW, baseH, zoom, onTickRender) {
  ctx.save();
  ctx.translate(tileOriginX, tileOriginY);
  drawLassoPreview(ctx, cellSize, state.lassoPreview);

  if (state.selection && !state.freeTransform) {
    drawSelectionOverlay(ctx, cellSize);
    scheduleMarchingAnts(onTickRender);
  } else if (selectionAnimFrame !== null) {
    cancelAnimationFrame(selectionAnimFrame);
    selectionAnimFrame = null;
  }

  drawSnapGuides(ctx, cellSize, baseW, baseH);
  if (state.freeTransform?.corners?.length === 4) {
    drawFreeTransformOverlay(ctx, cellSize, zoom, state.freeTransform.corners, state.freeTransform.pivot || null);
  }
  ctx.restore();
  drawPixelCursorOverlay(ctx, cellSize, zoom);
}
