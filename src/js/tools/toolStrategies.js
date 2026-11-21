/**
 * toolStrategies.js: Patrón Strategy ({ onDown, onMove, onUp }) para las herramientas del lienzo.
 */

import { state, pushLayerState, cloneGrid, getGridDims } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import {
  applyToolAt,
  pickColorAt,
  plotWithMirror,
  plotBrushWithMirror,
  traceBresenhamPoints,
  removeConnectedColor,
  replaceColorInActiveLayer,
  replaceColorWithTransparent,
  restoreActiveLayerFromSnapshot,
  applyJumbleAt,
  applyBlurAt,
  applyNoiseAt,
  applySprayAt,
} from "./tools.js";
import {
  drawBresenhamLine,
  drawStyledLine,
  drawBezierCurve,
  drawPixelRect,
  drawMidpointCircle,
  drawPixelTriangle,
} from "./shapes.js";
import { translateFromSnapshot, computeSnappedDelta } from "./transforms.js";
import { findShadedColorIndex } from "../core/color.js";
import { setStatus, restorePreviousToolAfterEyedropper } from "../ui/index.js";
import { highlightCurrentSwatch } from "../workspace/paletteManager.js";
import {
  shouldFillShape,
  getFixedCircleRadius,
  cancelSelectionIfOutside,
  resolveStrokeColor,
  createShapeStrategy,
  isPixelPerfectEnabled,
  filterPixelPerfectPoints,
} from "./strategyHelpers.js";
import {
  selectStrategy,
  ellipseSelectStrategy,
  lassoStrategy,
  magicSelectStrategy,
} from "./selectionStrategies.js";

const strokeStrategy = (() => {
  let ppBaseGrid = null;
  let ppPoints = [];
  let lastPt = null;

  const appendInterpolated = (tx, ty) => {
    const last = ppPoints[ppPoints.length - 1];
    if (last.x === tx && last.y === ty) return false;
    traceBresenhamPoints(last.x, last.y, tx, ty, (cx, cy) => {
      if (cx !== last.x || cy !== last.y) {
        ppPoints.push({ x: cx, y: cy });
      }
    });
    return true;
  };

  return {
    onDown({ x, y, button, event }) {
      if (button !== 0 && button !== 2) return;
      cancelSelectionIfOutside(x, y);
      if (state.currentTool === "bucket" && event?.shiftKey) {
        const targetColor = state.grid[y]?.[x];
        const nextColor = resolveStrokeColor(button);
        pushLayerState();
        if (replaceColorInActiveLayer(targetColor, nextColor)) {
          renderAll();
          setStatus({ key: "log.color_layer_replaced" }, false, "pixel");
        }
        return;
      }
      if (state.currentTool !== "bucket") {
        pushLayerState();
      }
      if (
        state.currentTool === "pencil" &&
        button === 0 &&
        isPixelPerfectEnabled() &&
        (state.brushSize || 1) <= 1
      ) {
        ppBaseGrid = cloneGrid(state.grid);
        ppPoints = [{ x, y }];
        lastPt = null;
        plotWithMirror(x, y, state.currentColorIndex);
        state.isDirtySinceImport = true;
        renderAll();
        return;
      }
      ppBaseGrid = null;
      ppPoints = [];
      lastPt = state.currentTool === "bucket" ? null : { x, y };
      applyToolAt(x, y, button === 2);
    },
    onMove({ x, y, button }) {
      if (state.currentTool === "bucket") return;
      if (ppBaseGrid && ppPoints.length > 0 && button === 0) {
        if (!appendInterpolated(x, y)) return;
        const cleanPts = filterPixelPerfectPoints(ppPoints);
        restoreActiveLayerFromSnapshot(ppBaseGrid);
        for (const pt of cleanPts) {
          plotWithMirror(pt.x, pt.y, state.currentColorIndex);
        }
        state.isDirtySinceImport = true;
        renderAll();
        return;
      }
      if (lastPt && (lastPt.x !== x || lastPt.y !== y)) {
        const col = resolveStrokeColor(button);
        traceBresenhamPoints(lastPt.x, lastPt.y, x, y, (px, py) => {
          plotBrushWithMirror(px, py, col, state.brushSize);
        });
        lastPt = { x, y };
        state.isDirtySinceImport = true;
        renderAll();
        return;
      }
      applyToolAt(x, y, button === 2);
    },
    onUp() {
      ppBaseGrid = null;
      ppPoints = [];
      lastPt = null;
    },
  };
})();

const shadingStrategy = (() => {
  let visited = new Set();

  const shadeAt = (x, y, button) => {
    const key = `${x},${y}`;
    if (visited.has(key)) return;
    visited.add(key);

    const curIdx = state.grid[y]?.[x];
    if (!curIdx || curIdx === 0) return;

    const dir = button === 2 ? -1 : 1;
    const nextIdx = findShadedColorIndex(curIdx, state.paletteMap, dir);
    if (nextIdx !== curIdx) {
      plotWithMirror(x, y, nextIdx);
      state.isDirtySinceImport = true;
      renderAll();
    }
  };

  return {
    onDown({ x, y, button }) {
      if (button !== 0 && button !== 2) return;
      visited = new Set();
      pushLayerState();
      shadeAt(x, y, button);
    },
    onMove({ x, y, button }) {
      shadeAt(x, y, button);
    },
    onUp() {
      visited.clear();
    },
  };
})();

const circleStrategy = (() => {
  let start = null;
  let baseGrid = null;

  return {
    onDown({ x, y, button, event }) {
      if (button !== 0 && button !== 2) return;
      pushLayerState();
      start = { x, y };
      baseGrid = cloneGrid(state.grid);
      const col = resolveStrokeColor(button);
      const fixedR = getFixedCircleRadius();
      drawMidpointCircle(x, y, fixedR, col, shouldFillShape(event), state.brushSize, state.lineStyle || "solid");
      setStatus({ key: "log.circle_radius", params: { r: fixedR } }, false, "pixel");
      renderAll();
    },
    onMove({ x, y, button, event }) {
      if (!start || !baseGrid) return;
      restoreActiveLayerFromSnapshot(baseGrid);
      const col = resolveStrokeColor(button);
      const filled = shouldFillShape(event);
      const fixedR = getFixedCircleRadius();
      const style = state.lineStyle || "solid";

      if (fixedR > 0) {
        drawMidpointCircle(x, y, fixedR, col, filled, state.brushSize, style);
        setStatus({ key: "log.circle_center_fixed", params: { x, y, r: fixedR } }, false, "pixel");
      } else {
        const r = Math.round(Math.hypot(x - start.x, y - start.y));
        drawMidpointCircle(start.x, start.y, r, col, filled, state.brushSize, style);
        setStatus({ key: "log.circle_radius", params: { r } }, false, "pixel");
      }
      renderAll();
    },
    onUp() {
      start = null;
      baseGrid = null;
    },
  };
})();

const moveStrategy = (() => {
  let start = null;
  let baseGrid = null;
  let baseOutOfBounds = [];
  let baseSelection = null;

  return {
    onDown({ x, y, button }) {
      if (button !== 0) return;
      pushLayerState();
      start = { x, y };
      baseGrid = cloneGrid(state.grid);
      const activeLayer = state.layers?.[state.activeLayerIndex];
      baseOutOfBounds = activeLayer?.outOfBounds
        ? activeLayer.outOfBounds.map((p) => [...p])
        : [];
      baseSelection = state.selection ? { ...state.selection } : null;
      state.snapGuides = null;
    },
    onMove({ x, y, event }) {
      if (!start || !baseGrid) return;
      const { dx, dy, guides } = computeSnappedDelta(
        baseGrid,
        baseSelection,
        x - start.x,
        y - start.y,
        {
          lockAxis: Boolean(event?.shiftKey),
          snapToGuides: Boolean(event?.ctrlKey),
          baseOutOfBounds,
        },
      );
      state.snapGuides = guides;
      translateFromSnapshot(baseGrid, baseSelection, dx, dy, baseOutOfBounds);
      renderAll();
    },
    onUp() {
      start = null;
      baseGrid = null;
      baseOutOfBounds = [];
      baseSelection = null;
      if (state.snapGuides) {
        state.snapGuides = null;
        renderAll();
      }
    },
  };
})();

// --- SELECCIÓN (RECTÁNGULO, ELIPSE/CÍRCULO, LAZO RAY-CASTING Y VARITA) ---

const eyedropperStrategy = {
  onDown({ x, y, button }) {
    if (button !== 0 && button !== 2) return;
    pickColorAt(x, y, highlightCurrentSwatch, button === 2);
    const isTouchOrMobile =
      state.lastPointerType === "touch" ||
      state.lastPointerType === "pen" ||
      (typeof window !== "undefined" && window.innerWidth <= 860);
    if (button === 0 && isTouchOrMobile) {
      restorePreviousToolAfterEyedropper();
    }
  },
  onMove() {},
  onUp() {},
};

const backgroundEraserStrategy = {
  onDown({ x, y, button }) {
    if (button === 0) {
      pushLayerState();
      if (removeConnectedColor(x, y)) {
        renderAll();
        setStatus({ key: "log.bg_connected_removed" }, false, "pixel");
      }
    } else if (button === 2) {
      pushLayerState();
      const targetColor = state.grid[y]?.[x];
      if (replaceColorWithTransparent(targetColor)) {
        renderAll();
        setStatus({ key: "log.color_layer_removed" }, false, "pixel");
      }
    }
  },
  onMove() {},
  onUp() {},
};

// --- LÍNEA RECTA Y CURVA DE CASTELJAU (1-3 PUNTOS) ---
function snapLineEndpoint(x0, y0, x1, y1, snap45) {
  if (!snap45) return { x: x1, y: y1 };
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return { x: x1, y: y1 };
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return {
    x: x0 + Math.round(Math.cos(angle) * dist),
    y: y0 + Math.round(Math.sin(angle) * dist),
  };
}

const lineStrategy = (() => {
  let phase = "idle"; // "idle" | "straight" | "pickEnd" | "bend"
  let start = null;
  let end = null;
  let controlPoints = [];
  let baseGrid = null;
  let strokeColor = 1;

  const reset = () => {
    phase = "idle";
    start = null;
    end = null;
    controlPoints = [];
    baseGrid = null;
  };

  const getMaxPoints = () => Math.max(1, Math.min(3, Number(state.curveControlPoints) || 1));

  const renderCurve = (hoverPt = null) => {
    if (!baseGrid || !start || !end) return;
    restoreActiveLayerFromSnapshot(baseGrid);
    const pts = hoverPt ? [...controlPoints, hoverPt] : controlPoints;
    drawBezierCurve(
      start.x,
      start.y,
      pts,
      end.x,
      end.y,
      strokeColor,
      state.brushSize,
      state.lineStyle || "solid",
    );
    renderAll();
  };

  return {
    isBending() {
      return phase === "pickEnd" || phase === "bend";
    },
    commitBend() {
      if (phase !== "pickEnd" && phase !== "bend") return false;
      if (phase === "bend" && controlPoints.length > 0) {
        renderCurve(null);
      }
      reset();
      renderAll();
      setStatus({ key: "log.curve_applied" }, false, "pixel");
      return true;
    },
    cancelBend() {
      if ((phase !== "pickEnd" && phase !== "bend") || !baseGrid) return false;
      restoreActiveLayerFromSnapshot(baseGrid);
      if (state.undoStack.length > 0) state.undoStack.pop();
      reset();
      renderAll();
      setStatus({ key: "log.curve_cancelled" });
      return true;
    },
    onDown({ x, y, button, event }) {
      if (phase === "pickEnd") {
        if (button === 2) {
          this.cancelBend();
          return;
        }
        if (button !== 0 || !baseGrid || !start) return;
        const pt = snapLineEndpoint(start.x, start.y, x, y, Boolean(event?.shiftKey));
        if (pt.x === start.x && pt.y === start.y) return;
        end = pt;
        controlPoints = [];
        phase = "bend";
        renderCurve({ x, y });
        setStatus({ key: "log.curve_bend_start", params: { max: getMaxPoints() } });
        return;
      }

      if (phase === "bend") {
        if (button === 2) {
          this.cancelBend();
          return;
        }
        if (button !== 0 || !baseGrid || !start || !end) return;
        controlPoints.push({ x, y });
        const maxPts = getMaxPoints();
        if (controlPoints.length >= maxPts) {
          renderCurve(null);
          reset();
          setStatus({ key: "log.curve_applied" }, false, "pixel");
          return;
        }
        renderCurve({ x, y });
        setStatus(
          { key: "log.curve_bend_next", params: { idx: controlPoints.length + 1, max: maxPts } },
        );
        return;
      }

      if (button !== 0 && button !== 2) return;
      pushLayerState();
      strokeColor = resolveStrokeColor(button);
      start = { x, y };
      end = { x, y };
      controlPoints = [];
      baseGrid = cloneGrid(state.grid);
      phase = state.lineMode === "curve" ? "pickEnd" : "straight";
      drawStyledLine(x, y, x, y, strokeColor, state.brushSize, state.lineStyle || "solid");
      renderAll();
      if (phase === "pickEnd") {
        setStatus({ key: "log.curve_pick_end" });
      }
    },
    onMove({ x, y, event }) {
      if (!baseGrid || !start) return;
      if (phase === "bend" && end) {
        renderCurve({ x, y });
        return;
      }

      if (phase !== "straight" && phase !== "pickEnd") return;
      const pt = snapLineEndpoint(start.x, start.y, x, y, Boolean(event?.shiftKey));
      end = pt;
      restoreActiveLayerFromSnapshot(baseGrid);
      drawStyledLine(
        start.x,
        start.y,
        pt.x,
        pt.y,
        strokeColor,
        state.brushSize,
        state.lineStyle || "solid",
      );
      renderAll();
    },
    onUp({ x, y, event }) {
      if (phase === "pickEnd" && start) {
        const pt = snapLineEndpoint(start.x, start.y, x, y, Boolean(event?.shiftKey));
        // Si arrastró desde A hasta B (>= 2px), pasa directo a curvar; si fue clic en A, espera el 2° clic en B
        if (Math.hypot(pt.x - start.x, pt.y - start.y) >= 2) {
          end = pt;
          controlPoints = [];
          phase = "bend";
          setStatus({ key: "log.curve_bend_start", params: { max: getMaxPoints() } });
        }
        return;
      }
      if (phase === "bend") return;
      reset();
    },
  };
})();

const filterBrushStrategy = (() => {
  let lastPt = null;
  const applyAt = (x, y) => {
    if (state.currentTool === "jumble") {
      applyJumbleAt(x, y, state.brushSize);
    } else if (state.currentTool === "noise") {
      applyNoiseAt(x, y, state.brushSize);
    } else {
      applyBlurAt(x, y, state.brushSize);
    }
  };
  return {
    onDown({ x, y, button }) {
      if (button !== 0) return;
      pushLayerState();
      lastPt = { x, y };
      applyAt(x, y);
      renderAll();
    },
    onMove({ x, y }) {
      if (!lastPt) return;
      traceBresenhamPoints(lastPt.x, lastPt.y, x, y, (px, py) => {
        applyAt(px, py);
      });
      lastPt = { x, y };
      renderAll();
    },
    onUp() {
      lastPt = null;
    },
  };
})();

const sprayStrategy = (() => {
  let activeButton = 0;
  const getDensity = () =>
    Math.max(0.1, Math.min(1, Number(state.sprayDensity ?? 0.3)));
  return {
    onDown({ x, y, button }) {
      if (button !== 0 && button !== 2) return;
      pushLayerState();
      activeButton = button;
      const col = resolveStrokeColor(button);
      applySprayAt(x, y, col, Math.max(3, state.brushSize), getDensity());
      renderAll();
    },
    onMove({ x, y }) {
      const col = resolveStrokeColor(activeButton);
      applySprayAt(x, y, col, Math.max(3, state.brushSize), getDensity());
      renderAll();
    },
    onUp() {},
  };
})();

// --- TABLA DE DESPACHO STRATEGY ---
export const TOOL_STRATEGIES = {
  pencil: strokeStrategy,
  eraser: strokeStrategy,
  bucket: strokeStrategy,
  spray: sprayStrategy,
  blur: filterBrushStrategy,
  jumble: filterBrushStrategy,
  noise: filterBrushStrategy,
  line: lineStrategy,
  rect: createShapeStrategy(({ start, x, y }, col, filled) =>
    drawPixelRect(start.x, start.y, x, y, col, filled, state.brushSize, state.lineStyle || "solid"),
  ),
  circle: circleStrategy,
  triangle: createShapeStrategy(({ start, x, y }, col, filled) =>
    drawPixelTriangle(start.x, start.y, x, y, col, filled, state.brushSize, state.lineStyle || "solid"),
  ),
  move: moveStrategy,
  shading: shadingStrategy,
  select: selectStrategy,
  ellipseSelect: ellipseSelectStrategy,
  lasso: lassoStrategy,
  magicSelect: magicSelectStrategy,
  eyedropper: eyedropperStrategy,
  backgroundEraser: backgroundEraserStrategy,
};

