// @ts-check
/**
 * polygonStrategies.js: Estrategias de herramienta para Polígono (vértice a vértice)
 * y Contorno (lazo de relleno a mano alzada), sin acceso al DOM.
 */

import { state, pushLayerState, cloneGrid, subscribe } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { plotBrushWithMirror, restoreActiveLayerFromSnapshot, traceBresenhamPoints } from "./tools.js";
import { drawPixelPolygon } from "./shapes.js";
import { isPointNearVertex, snapPolygonAngle45 } from "./polygonGeometry.js";
import { setStatus } from "../ui/index.js";
import { cancelSelectionIfOutside, resolveStrokeColor } from "./strategyHelpers.js";

const DOUBLE_CLICK_MS = 400;

function shouldFillPolygons() {
  return state.fillPolygons !== false;
}

/**
 * Construye la estrategia multi-vértice para la herramienta Polígono (`polygon`).
 */
export function createPolygonStrategy() {
  let phase = "idle"; // "idle" | "drawing"
  let vertices = [];
  let baseGrid = null;
  let strokeColor = 1;
  let hoverPt = null;
  let lastClickAt = 0;
  let lastClickPt = null;

  const reset = () => {
    phase = "idle";
    vertices = [];
    baseGrid = null;
    hoverPt = null;
    lastClickAt = 0;
    lastClickPt = null;
    state.polygonPreview = null;
  };

  const renderPreview = (targetPt = null, snapClose = false) => {
    if (!baseGrid || vertices.length === 0) return;
    restoreActiveLayerFromSnapshot(baseGrid);
    const previewVerts =
      targetPt && !snapClose ? [...vertices, targetPt] : vertices;
    drawPixelPolygon(
      previewVerts,
      strokeColor,
      shouldFillPolygons(),
      state.brushSize,
      state.lineStyle || "solid",
    );
    state.polygonPreview = {
      vertices: vertices.map((v) => ({ x: v.x, y: v.y })),
      hoverPt: targetPt ? { x: targetPt.x, y: targetPt.y } : null,
      snapClose,
      isContour: false,
    };
    renderAll();
  };

  const resolveSnappedTarget = (x, y, event) => {
    if (event?.shiftKey && vertices.length > 0) {
      const prev = vertices[vertices.length - 1];
      return snapPolygonAngle45(prev.x, prev.y, x, y);
    }
    return { x: Math.round(x), y: Math.round(y) };
  };

  const isSnapCloseTarget = (pt) =>
    vertices.length >= 3 && isPointNearVertex(pt.x, pt.y, vertices[0].x, vertices[0].y, 1);

  const strategy = {
    hasPendingSession() {
      return phase === "drawing";
    },
    refreshPreview() {
      if (phase !== "drawing" || !baseGrid) return false;
      renderPreview(hoverPt, hoverPt ? isSnapCloseTarget(hoverPt) : false);
      return true;
    },
    commitPolygon() {
      if (phase !== "drawing" || !baseGrid || vertices.length === 0) return false;
      restoreActiveLayerFromSnapshot(baseGrid);
      drawPixelPolygon(
        vertices,
        strokeColor,
        shouldFillPolygons(),
        state.brushSize,
        state.lineStyle || "solid",
      );
      reset();
      renderAll();
      setStatus({ key: "log.polygon_applied" }, false, "pixel");
      return true;
    },
    undoLastVertex() {
      if (phase !== "drawing" || !baseGrid) return false;
      if (vertices.length <= 1) {
        return strategy.cancelPolygon();
      }
      vertices.pop();
      renderPreview(hoverPt, hoverPt ? isSnapCloseTarget(hoverPt) : false);
      setStatus({ key: "log.polygon_vertex", params: { count: vertices.length } });
      return true;
    },
    cancelPolygon() {
      if (phase !== "drawing" || !baseGrid) return false;
      restoreActiveLayerFromSnapshot(baseGrid);
      if (state.undoStack.length > 0) state.undoStack.pop();
      reset();
      renderAll();
      setStatus({ key: "log.polygon_cancelled" });
      return true;
    },
    onDown({ x, y, button, event }) {
      if (phase === "drawing") {
        if (button === 2) {
          strategy.undoLastVertex();
          return;
        }
        if (button !== 0 || !baseGrid) return;

        const pt = resolveSnappedTarget(x, y, event);
        const now = Date.now();
        const isDoubleClickSamePt =
          Boolean(lastClickPt) &&
          lastClickPt.x === pt.x &&
          lastClickPt.y === pt.y &&
          now - lastClickAt < DOUBLE_CLICK_MS;

        if (isSnapCloseTarget(pt) || (vertices.length >= 2 && isDoubleClickSamePt)) {
          strategy.commitPolygon();
          return;
        }

        const last = vertices[vertices.length - 1];
        if (!last || last.x !== pt.x || last.y !== pt.y) {
          vertices.push(pt);
          setStatus({ key: "log.polygon_vertex", params: { count: vertices.length } });
        }
        lastClickAt = now;
        lastClickPt = pt;
        hoverPt = pt;
        renderPreview(pt, isSnapCloseTarget(pt));
        return;
      }

      if (button !== 0 && button !== 2) return;
      cancelSelectionIfOutside(x, y);
      pushLayerState();
      strokeColor = resolveStrokeColor(button);
      baseGrid = cloneGrid(state.grid);
      const startPt = { x: Math.round(x), y: Math.round(y) };
      vertices = [startPt];
      hoverPt = startPt;
      lastClickAt = Date.now();
      lastClickPt = startPt;
      phase = "drawing";
      renderPreview(startPt, false);
      setStatus({ key: "log.polygon_started" });
    },
    onMove({ x, y, event }) {
      if (phase !== "drawing" || !baseGrid) return;
      const pt = resolveSnappedTarget(x, y, event);
      hoverPt = pt;
      renderPreview(pt, isSnapCloseTarget(pt));
    },
    onUp() {},
  };

  subscribe("tool:cancelPending", () => {
    strategy.cancelPolygon();
  });
  subscribe("polygon:refreshPreview", () => {
    strategy.refreshPreview();
  });

  return strategy;
}

/**
 * Construye la estrategia de trazo libre cerrado con relleno automático (`contour`).
 */
export function createContourStrategy() {
  let points = [];
  let baseGrid = null;
  let strokeColor = 1;

  const appendSegment = (tx, ty) => {
    const last = points[points.length - 1];
    if (!last) {
      points.push({ x: tx, y: ty });
      plotBrushWithMirror(tx, ty, strokeColor, state.brushSize);
      return true;
    }
    if (last.x === tx && last.y === ty) return false;
    traceBresenhamPoints(last.x, last.y, tx, ty, (cx, cy) => {
      if (cx !== last.x || cy !== last.y) {
        points.push({ x: cx, y: cy });
        plotBrushWithMirror(cx, cy, strokeColor, state.brushSize);
      }
    });
    return true;
  };

  return {
    onDown({ x, y, button }) {
      if (button !== 0 && button !== 2) return;
      cancelSelectionIfOutside(x, y);
      pushLayerState();
      strokeColor = resolveStrokeColor(button);
      baseGrid = cloneGrid(state.grid);
      const sx = Math.round(x);
      const sy = Math.round(y);
      points = [{ x: sx, y: sy }];
      plotBrushWithMirror(sx, sy, strokeColor, state.brushSize);
      state.polygonPreview = {
        vertices: [{ x: sx, y: sy }],
        hoverPt: { x: sx, y: sy },
        snapClose: false,
        isContour: true,
      };
      renderAll();
    },
    onMove({ x, y }) {
      if (!baseGrid || points.length === 0) return;
      if (appendSegment(Math.round(x), Math.round(y))) {
        state.polygonPreview = {
          vertices: [points[0], points[points.length - 1]],
          hoverPt: points[0],
          snapClose: points.length >= 3,
          isContour: true,
        };
        renderAll();
      }
    },
    onUp() {
      state.polygonPreview = null;
      if (baseGrid && points.length > 0) {
        restoreActiveLayerFromSnapshot(baseGrid);
        drawPixelPolygon(
          points,
          strokeColor,
          shouldFillPolygons(),
          state.brushSize,
          state.lineStyle || "solid",
        );
        setStatus({ key: "log.contour_applied" }, false, "pixel");
      }
      points = [];
      baseGrid = null;
      renderAll();
    },
  };
}
