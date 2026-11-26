/**
 * input.js: Traductor de eventos DOM de mouse y rueda hacia TOOL_STRATEGIES,
 * más fachada de re-exportación para keyboardShortcuts.js.
 */

import { state, getGridDims, isSymmetryActive } from "./core/state.js";
import { renderAll, getGridCoordinates, getFloatGridCoordinates, zoomAtClientPoint, trackCanvasPointer } from "./canvas/canvas.js";
import { createFreeTransformController, getFreeTransformCursor } from "./tools/freeTransform.js";
import { renderRulers } from "./canvas/rulers.js";
import { renderGridCoordsOverlay } from "./canvas/gridCoordsOverlay.js";
import { isActiveLayerLocked } from "./workspace/layers.js";
import { syncLinkedCelsForActiveLayer } from "./workspace/timelineMatrix.js";
import { isTilemapTileModeActive, getTilemapToolStrategy, reconcileActiveTilemapLayer } from "./workspace/tilemap.js";
import { pickColorAt, isInsideSelection } from "./tools/tools.js";
import { TOOL_STRATEGIES } from "./tools/toolStrategies.js";
import { getToolCursorCss, setStatus, applySymmetryAxisFromCanvasPoint, syncSymmetryControlsUI, closeMobileDrawers } from "./ui/index.js";
import { highlightCurrentSwatch, syncCanvasColorsToPalette } from "./workspace/paletteManager.js";
import { closeCanvasContextMenu, openCanvasContextMenu } from "./ui/canvasContextMenu.js";
import { getActiveFocusZone, performUndo, performRedo, setupKeyboardShortcuts } from "./keyboardShortcuts.js";

export { performUndo, performRedo, setupKeyboardShortcuts };

const REGION_TOOLS = new Set(["bucket", "fill", "backgroundEraser", "magicSelect"]);
const READ_ONLY_TOOLS = new Set(["select", "ellipseSelect", "triangleSelect", "lasso", "magicSelect", "eyedropper", "zoom", "pan"]);
const SELECTION_CTX_TOOLS = new Set(["select", "ellipseSelect", "triangleSelect", "lasso", "magicSelect", "move"]);
const ALT_SELECTION_TOOLS = new Set(["select", "ellipseSelect", "triangleSelect", "lasso", "magicSelect", "move"]);

function wantsSymmetryAxisDrag(e) {
  if (!isSymmetryActive()) return false;
  if (state.isMovingSymmetryAxis) return true;
  return Boolean(e?.altKey && !e?.ctrlKey && !e?.shiftKey && !ALT_SELECTION_TOOLS.has(state.currentTool));
}

function findRulerGuideHit(e, canvas) {
  const guides = state.rulerGuides;
  if (!Array.isArray(guides) || !guides.length || !canvas) return null;
  const { rawX, rawY } = getFloatGridCoordinates(e, canvas);
  const { w } = getGridDims();
  const cellPx = Math.max(1, (canvas.clientWidth || w) / Math.max(1, w));
  const tol = Math.max(0.35, 8 / cellPx);

  let bestIndex = -1;
  let bestDist = Infinity;
  for (let i = 0; i < guides.length; i++) {
    const g = guides[i];
    const dist = g.axis === "v" ? Math.abs(rawX - g.pos) : Math.abs(rawY - g.pos);
    if (dist <= tol && dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex !== -1 ? { index: bestIndex, guide: guides[bestIndex] } : null;
}

function wantsRegionPreview() {
  return Boolean(state.showPixelCursor) && REGION_TOOLS.has(state.currentTool) && state.pixelCursorConfig?.fillPreview !== false;
}

function updatePanScroll(e, ptr, canvas) {
  const dx = e.clientX - ptr.panStart.clientX;
  const dy = e.clientY - ptr.panStart.clientY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) ptr.panMoved = true;
  const container = document.getElementById("canvasContainer");
  if (container) {
    container.scrollLeft = ptr.panStart.scrollLeft - dx;
    container.scrollTop = ptr.panStart.scrollTop - dy;
  }
  if (canvas) canvas.style.cursor = "grabbing";
}

function setupSpacePanAndContextGuards(canvas, ptr) {
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.repeat) return;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || getActiveFocusZone() === "frames") return;
    e.preventDefault();
    ptr.isSpaceHeld = true;
    if (!ptr.isPanning) canvas.style.cursor = "grab";
  });

  window.addEventListener("keyup", (e) => {
    if (e.code !== "Space") return;
    ptr.isSpaceHeld = false;
    if (!ptr.isPanning) canvas.style.cursor = getToolCursorCss(state.currentTool);
  });

  document.addEventListener("click", (e) => {
    const menu = document.getElementById("canvasContextMenu");
    if (menu?.classList.contains("open") && !menu.contains(e.target)) closeCanvasContextMenu();
  });

  document.addEventListener("contextmenu", (e) => {
    const t = e.target, tag = t?.tagName;
    const isText = (tag === "INPUT" && !["button", "checkbox", "radio", "range", "color", "file", "submit", "reset"].includes(t.type)) || tag === "TEXTAREA" || t?.isContentEditable;
    if (!isText) e.preventDefault();
  });

  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const { x, y } = getGridCoordinates(e, canvas);
    if (SELECTION_CTX_TOOLS.has(state.currentTool) || (state.selection && isInsideSelection(x, y))) {
      openCanvasContextMenu(e.clientX, e.clientY);
    }
  });
}

function handleHoverPreview(x, y, ptr) {
  const cursorKey = `${x}:${y}`;
  const cursorChanged = cursorKey !== ptr.lastCursorCellKey;
  ptr.lastCursorCellKey = cursorKey;
  let needsRender = Boolean((state.showPixelCursor || wantsRegionPreview()) && cursorChanged);

  const activeLayer = state.layers?.[state.activeLayerIndex];
  if (activeLayer?.type === "tilemap" && state.tilemapMode === "tiles") {
    const hoverKey = `${Math.floor(x / (activeLayer.tileWidth || 16))}:${Math.floor(y / (activeLayer.tileHeight || 16))}`;
    if (hoverKey !== ptr.lastHoverTileKey) { ptr.lastHoverTileKey = hoverKey; needsRender = true; }
  } else {
    ptr.lastHoverTileKey = null;
  }
  if (needsRender) renderAll();
}

function handleCanvasMouseDown(e, canvas, ptr) {
  ptr.isMouseDown = true;
  ptr.mouseButton = e.button;
  const { x, y } = getGridCoordinates(e, canvas);
  state.cursorPos = { x, y };

  if (e.button === 1 || (e.button === 0 && (state.currentTool === "pan" || ptr.isSpaceHeld))) {
    e.preventDefault();
    const container = document.getElementById("canvasContainer");
    ptr.isPanning = true;
    ptr.panMoved = false;
    ptr.panStart = { clientX: e.clientX, clientY: e.clientY, scrollLeft: container?.scrollLeft || 0, scrollTop: container?.scrollTop || 0, gridX: x, gridY: y, isMiddle: e.button === 1 };
    canvas.style.cursor = "grabbing";
    return;
  }
  if (
    e.button === 0 &&
    !state.isMovingSymmetryAxis &&
    (state.currentTool === "move" || (e.altKey && !e.ctrlKey && !e.shiftKey && !ALT_SELECTION_TOOLS.has(state.currentTool)))
  ) {
    const hitGuide = findRulerGuideHit(e, canvas);
    if (hitGuide) {
      e.preventDefault();
      ptr.isMouseDown = false;
      ptr.activeStrategy = null;
      state.activeGuideDrag = {
        axis: hitGuide.guide.axis,
        pos: hitGuide.guide.pos,
        valid: true,
        editingIndex: hitGuide.index,
      };
      canvas.style.cursor = hitGuide.guide.axis === "h" ? "row-resize" : "col-resize";
      renderAll();
      return;
    }
  }
  if (e.button === 0 && wantsSymmetryAxisDrag(e)) {
    e.preventDefault();
    ptr.isDraggingSymmetry = true;
    ptr.activeStrategy = null;
    const { rawX, rawY } = getFloatGridCoordinates(e, canvas);
    applySymmetryAxisFromCanvasPoint(rawX, rawY);
    canvas.style.cursor = "move";
    return;
  }
  if (!READ_ONLY_TOOLS.has(state.currentTool) && isActiveLayerLocked()) {
    setStatus({ key: "log.layer_locked" }, true);
    ptr.activeStrategy = null;
    return;
  }
  if (state.freeTransform) {
    const { rawX, rawY } = getFloatGridCoordinates(e, canvas);
    ptr.ftController.onDown({ rawX, rawY, button: e.button, event: e });
    ptr.activeStrategy = null;
    return;
  }
  ptr.usedTilemapStrategy = isTilemapTileModeActive();
  ptr.activeStrategy = ptr.usedTilemapStrategy ? getTilemapToolStrategy(state.currentTool) : (TOOL_STRATEGIES[state.currentTool] || TOOL_STRATEGIES.pencil);
  ptr.activeStrategy.onDown({ x, y, button: e.button, event: e });
}

function handleCanvasMouseMove(e, canvas, ptr) {
  const { x, y } = getGridCoordinates(e, canvas);
  state.cursorPos = { x, y };
  renderRulers();
  renderGridCoordsOverlay();
  if (!ptr.isMouseDown) handleHoverPreview(x, y, ptr);
  if (ptr.isPanning && ptr.panStart) { updatePanScroll(e, ptr, canvas); return; }
  if (ptr.isDraggingSymmetry) {
    const { rawX, rawY } = getFloatGridCoordinates(e, canvas);
    applySymmetryAxisFromCanvasPoint(rawX, rawY);
    canvas.style.cursor = "move";
    return;
  }
  if (state.freeTransform) {
    const { rawX, rawY } = getFloatGridCoordinates(e, canvas);
    canvas.style.cursor = getFreeTransformCursor(rawX, rawY, e);
    if (ptr.isMouseDown && ptr.mouseButton !== 1) ptr.ftController.onMove({ rawX, rawY, event: e });
    return;
  }
  const altGuideHover =
    e.altKey && !e.ctrlKey && !e.shiftKey && !state.isMovingSymmetryAxis && !ALT_SELECTION_TOOLS.has(state.currentTool)
      ? findRulerGuideHit(e, canvas)
      : null;
  const toolCursor = altGuideHover
    ? (altGuideHover.guide.axis === "h" ? "row-resize" : "col-resize")
    : wantsSymmetryAxisDrag(e)
      ? "move"
      : getToolCursorCss(state.currentTool);
  if (canvas.style.cursor !== toolCursor) canvas.style.cursor = toolCursor;
  if (TOOL_STRATEGIES[state.currentTool]?.hasPendingSession?.()) {
    TOOL_STRATEGIES[state.currentTool].onMove({ x, y, button: 0, event: e });
    return;
  }
  if (state.currentTool === "line" && TOOL_STRATEGIES.line?.isBending?.()) {
    TOOL_STRATEGIES.line.onMove({ x, y, button: 0, event: e });
    return;
  }
  if (ptr.isMouseDown && ptr.mouseButton !== 1 && ptr.activeStrategy) {
    ptr.activeStrategy.onMove({ x, y, button: ptr.mouseButton, event: e });
  }
}

function handleWindowMouseUp(e, canvas, ptr) {
  if (ptr.isPanning) {
    if (ptr.panStart?.isMiddle && !ptr.panMoved) pickColorAt(ptr.panStart.gridX, ptr.panStart.gridY, highlightCurrentSwatch);
    ptr.isPanning = false; ptr.panMoved = false; ptr.panStart = null; ptr.isMouseDown = false;
    canvas.style.cursor = ptr.isSpaceHeld ? "grab" : getToolCursorCss(state.currentTool);
    return;
  }
  if (ptr.isDraggingSymmetry) {
    ptr.isDraggingSymmetry = false;
    ptr.isMouseDown = false;
    if (state.isMovingSymmetryAxis) {
      state.isMovingSymmetryAxis = false;
      syncSymmetryControlsUI();
    }
    canvas.style.cursor = getToolCursorCss(state.currentTool);
    setStatus({ key: "status.sym_axis_moved" });
    return;
  }
  if (state.activeGuideDrag) {
    const drag = state.activeGuideDrag;
    state.activeGuideDrag = null;
    if (drag.editingIndex != null && Array.isArray(state.rulerGuides) && state.rulerGuides[drag.editingIndex]) {
      if (drag.valid) {
        state.rulerGuides[drag.editingIndex].pos = drag.pos;
        setStatus({ key: "status.guide_moved", params: { axis: drag.axis === "v" ? "X" : "Y", pos: drag.pos } });
      } else {
        state.rulerGuides.splice(drag.editingIndex, 1);
        setStatus({ key: "status.guide_removed" });
      }
    } else if (drag.valid) {
      if (!Array.isArray(state.rulerGuides)) state.rulerGuides = [];
      state.rulerGuides.push({ id: Date.now() + Math.random(), axis: drag.axis, pos: drag.pos });
      setStatus({ key: "status.guide_added", params: { axis: drag.axis === "v" ? "X" : "Y", pos: drag.pos } });
    }
    canvas.style.cursor = getToolCursorCss(state.currentTool);
    renderAll();
    return;
  }
  if (!ptr.isMouseDown) return;
  ptr.isMouseDown = false;
  if (state.freeTransform) { ptr.ftController.onUp(); return; }
  if (!ptr.activeStrategy) return;
  const { x, y } = getGridCoordinates(e, canvas, { unclampedTiled: state.tiledMode !== "none", unclamped: state.currentTool === "move" });
  ptr.activeStrategy.onUp({ x, y, button: ptr.mouseButton, event: e });
  if (!ptr.usedTilemapStrategy && state.layers?.[state.activeLayerIndex]?.type === "tilemap") reconcileActiveTilemapLayer();
  syncLinkedCelsForActiveLayer();
  ptr.usedTilemapStrategy = false;
  ptr.activeStrategy = null;
  syncCanvasColorsToPalette();
}

/**
 * Registra eventos de mouse, rueda y menú contextual sobre el canvas principal.
 * @param {HTMLCanvasElement} canvas
 */
export function setupMouseEvents(canvas) {
  const ptr = {
    isMouseDown: false, mouseButton: 0, activeStrategy: null, isPanning: false, panMoved: false,
    panStart: null, isSpaceHeld: false, usedTilemapStrategy: false, lastHoverTileKey: null,
    lastCursorCellKey: null, ftController: createFreeTransformController(),
  };

  const touchPointers = new Map();
  let pinchState = null;
  let wasPinching = false;
  let touchStrokePendingUndo = false;
  let touchStrokeStartTime = 0;
  let canvasLongPressTimer = null;
  let canvasLongPressOrigin = null;
  const clearCanvasLongPress = () => {
    if (canvasLongPressTimer) {
      clearTimeout(canvasLongPressTimer);
      canvasLongPressTimer = null;
    }
    canvasLongPressOrigin = null;
  };

  canvas.style.touchAction = "none";
  setupSpacePanAndContextGuards(canvas, ptr);
  canvas.addEventListener("pointerleave", () => {
    state.cursorPos = null; ptr.lastHoverTileKey = null; ptr.lastCursorCellKey = null;
    renderRulers();
    renderGridCoordsOverlay();
    if (state.showPixelCursor || wantsRegionPreview() || state.layers?.[state.activeLayerIndex]?.type === "tilemap") renderAll();
  });
  const handleCanvasWheelZoom = (e) => {
    const container = document.getElementById("canvasContainer");
    if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (container) container.scrollLeft += Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      return;
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (container) container.scrollTop += e.deltaY;
      return;
    }
    e.preventDefault();
    const prevZoom = state.zoom || 1;
    const step = prevZoom >= 4 ? 0.5 : 0.25;
    trackCanvasPointer(e.clientX, e.clientY);
    zoomAtClientPoint(prevZoom + (e.deltaY < 0 ? step : -step), e.clientX, e.clientY);
  };
  const wheelTarget = document.getElementById("canvasContainer") || canvas;
  wheelTarget.addEventListener("wheel", handleCanvasWheelZoom, { passive: false });
  wheelTarget.addEventListener("pointermove", (e) => trackCanvasPointer(e.clientX, e.clientY));
  wheelTarget.addEventListener("pointerleave", () => trackCanvasPointer(null, null));
  canvas.addEventListener("pointerdown", (e) => {
    state.lastPointerType = e.pointerType || "mouse";
    if (e.pointerType === "touch" || e.pointerType === "pen") e.preventDefault();
    if (closeMobileDrawers()) return;
    if (e.pointerType === "touch") {
      touchPointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      if (touchPointers.size === 2) {
        clearCanvasLongPress();
        wasPinching = true;
        if (touchStrokePendingUndo && Date.now() - touchStrokeStartTime < 450) {
          touchStrokePendingUndo = false;
          performUndo();
        }
        ptr.isMouseDown = false;
        ptr.activeStrategy = null;
        const pts = [...touchPointers.values()];
        const container = document.getElementById("canvasContainer");
        pinchState = {
          startDist: Math.max(10, Math.hypot(pts[1].clientX - pts[0].clientX, pts[1].clientY - pts[0].clientY)),
          startZoom: state.zoom || 1,
          midX: (pts[0].clientX + pts[1].clientX) / 2,
          midY: (pts[0].clientY + pts[1].clientY) / 2,
          scrollLeft: container?.scrollLeft || 0,
          scrollTop: container?.scrollTop || 0,
        };
        return;
      }
      if (touchPointers.size > 2 || wasPinching) return;
      const { x: gx, y: gy } = getGridCoordinates(e, canvas);
      if (SELECTION_CTX_TOOLS.has(state.currentTool) || (state.selection && isInsideSelection(gx, gy))) {
        clearCanvasLongPress();
        canvasLongPressOrigin = { x: e.clientX, y: e.clientY };
        const cx = e.clientX;
        const cy = e.clientY;
        canvasLongPressTimer = setTimeout(() => {
          canvasLongPressTimer = null;
          canvasLongPressOrigin = null;
          ptr.isMouseDown = false;
          ptr.activeStrategy = null;
          if (typeof navigator !== "undefined") navigator.vibrate?.(14);
          openCanvasContextMenu(cx, cy);
        }, 480);
      }
      touchStrokePendingUndo = !READ_ONLY_TOOLS.has(state.currentTool) && !isActiveLayerLocked();
      touchStrokeStartTime = Date.now();
    } else {
      touchStrokePendingUndo = false;
    }
    handleCanvasMouseDown(e, canvas, ptr);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (canvasLongPressOrigin && e.pointerType === "touch") {
      if (Math.hypot(e.clientX - canvasLongPressOrigin.x, e.clientY - canvasLongPressOrigin.y) > 6) {
        clearCanvasLongPress();
      }
    }
    if (e.pointerType === "touch" && touchPointers.has(e.pointerId)) {
      touchPointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      if (pinchState && touchPointers.size === 2) {
        const pts = [...touchPointers.values()];
        const dist = Math.max(10, Math.hypot(pts[1].clientX - pts[0].clientX, pts[1].clientY - pts[0].clientY));
        const midX = (pts[0].clientX + pts[1].clientX) / 2;
        const midY = (pts[0].clientY + pts[1].clientY) / 2;
        applyZoom(pinchState.startZoom * (dist / pinchState.startDist));
        const container = document.getElementById("canvasContainer");
        if (container) {
          container.scrollLeft = pinchState.scrollLeft - (midX - pinchState.midX);
          container.scrollTop = pinchState.scrollTop - (midY - pinchState.midY);
        }
        return;
      }
      if (wasPinching) return;
    }
    if (pinchState) return;
    handleCanvasMouseMove(e, canvas, ptr);
  });
  window.addEventListener("pointermove", (e) => {
    if (state.activeGuideDrag) {
      const { rawX, rawY } = getFloatGridCoordinates(e, canvas);
      const { w, h } = getGridDims();
      const drag = state.activeGuideDrag;
      const raw = drag.axis === "h" ? rawY : rawX;
      const limit = drag.axis === "h" ? h : w;
      const snapped = e.altKey ? Math.round(raw * 2) / 2 : Math.round(raw);
      drag.pos = Math.max(0, Math.min(limit, snapped));
      drag.valid = raw >= 0 && raw <= limit;
      if (drag.editingIndex != null && drag.valid && state.rulerGuides?.[drag.editingIndex]) {
        state.rulerGuides[drag.editingIndex].pos = drag.pos;
      }
      renderAll();
      return;
    }
    if (ptr.isPanning && ptr.panStart) { updatePanScroll(e, ptr, null); return; }
    if (!ptr.isMouseDown || ptr.mouseButton === 1 || e.target === canvas) return;
    if (state.freeTransform) { const { rawX, rawY } = getFloatGridCoordinates(e, canvas); ptr.ftController.onMove({ rawX, rawY, event: e }); return; }
    if (!ptr.activeStrategy || (state.currentTool !== "move" && state.tiledMode === "none")) return;
    const { x, y } = getGridCoordinates(e, canvas, { unclampedTiled: state.tiledMode !== "none", unclamped: state.currentTool === "move" });
    ptr.activeStrategy.onMove({ x, y, button: ptr.mouseButton, event: e });
  });
  const clearTouchPointer = (e) => {
    if (e.pointerType !== "touch") return;
    clearCanvasLongPress();
    touchPointers.delete(e.pointerId);
    if (touchPointers.size < 2) pinchState = null;
    if (touchPointers.size === 0) {
      wasPinching = false;
      touchStrokePendingUndo = false;
    }
  };
  window.addEventListener("pointerup", (e) => { clearTouchPointer(e); handleWindowMouseUp(e, canvas, ptr); }, { capture: true });
  window.addEventListener("pointercancel", (e) => { clearTouchPointer(e); handleWindowMouseUp(e, canvas, ptr); }, { capture: true });
  window.addEventListener("blur", () => { touchPointers.clear(); pinchState = null; wasPinching = false; touchStrokePendingUndo = false; ptr.isMouseDown = false; ptr.activeStrategy = null; state.activeGuideDrag = null; ptr.ftController.onUp(); });

  // Arrastrar desde #rulerTop o #rulerLeft para crear/mover guías (clic derecho o soltar fuera quita la guía)
  const bindRulerGuideEvents = (rulerId, axis) => {
    const el = document.getElementById(rulerId);
    if (!el) return;
    el.style.cursor = axis === "h" ? "row-resize" : "col-resize";
    el.style.touchAction = "none";
    const findGuideAlongRuler = (e) => {
      const { rawX, rawY } = getFloatGridCoordinates(e, canvas);
      const { w } = getGridDims();
      const cellPx = Math.max(1, (canvas.clientWidth || w) / Math.max(1, w));
      const hitPx = e.pointerType === "touch" || e.pointerType === "pen" ? 18 : 10;
      const tol = Math.max(0.5, hitPx / cellPx);
      const targetAxis = axis === "h" ? "v" : "h";
      const targetPos = axis === "h" ? rawX : rawY;
      return (state.rulerGuides || []).findIndex(
        (g) => g.axis === targetAxis && Math.abs(g.pos - targetPos) <= tol,
      );
    };
    el.addEventListener("pointerdown", (e) => {
      if (e.button === 2) {
        const idx = findGuideAlongRuler(e);
        if (idx !== -1) {
          state.rulerGuides.splice(idx, 1);
          renderAll();
          setStatus({ key: "status.guide_removed" });
        }
        return;
      }
      if (e.button !== 0) return;
      e.preventDefault();
      const hitIdx = findGuideAlongRuler(e);
      if (hitIdx !== -1) {
        const g = state.rulerGuides[hitIdx];
        state.activeGuideDrag = { axis: g.axis, pos: g.pos, valid: true, editingIndex: hitIdx };
      } else {
        state.activeGuideDrag = { axis, pos: 0, valid: false };
      }
    });
  };
  bindRulerGuideEvents("rulerTop", "h");
  bindRulerGuideEvents("rulerLeft", "v");
}
