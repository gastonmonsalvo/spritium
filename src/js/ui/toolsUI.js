/**
 * toolsUI.js: Estado visual de herramientas, grosor, zoom, espejos, grilla y Tiled Mode.
 */

import { state, getGridDims, isSymmetryActive, getSymmetryPivot } from "../core/state.js";
import { renderAll, applyZoom } from "../canvas/canvas.js";
import { renderRulers } from "../canvas/rulers.js";
import { commitFreeTransform } from "../tools/freeTransform.js";
import { setStatus, refreshIcons } from "./status.js";
import { saveUserPreferences, syncViewTogglesUI } from "./preferences.js";
import { i18n } from "../i18n/I18nService.js";
import { getToolCursorCss } from "./cursors.js";
import { RESOLUTION_PRESETS } from "./components/TopMenuConfig.js";


let lastShapeTool = "rect";
let lastFilterTool = "blur";

/**
 * Activa la última herramienta geométrica usada (rectángulo, círculo o triángulo).
 */
export function selectActiveShapeTool() {
  setTool(lastShapeTool);
}

/**
 * Activa la última herramienta de filtro usada (Blur o Jumble).
 */
export function selectActiveFilterTool() {
  setTool(lastFilterTool);
}

const TILEMAP_PLACE_TOOLS = new Set([
  "pencil",
  "eraser",
  "bucket",
  "eyedropper",
  "line",
  "rect",
  "circle",
  "triangle",
]);

const BRUSH_SIZE_TOOLS = new Set([
  "pencil",
  "eraser",
  "line",
  "rect",
  "circle",
  "triangle",
  "blur",
  "jumble",
  "spray",
]);

const TOOL_MIN_BRUSH_SIZE = {
  spray: 3,
  blur: 3,
  jumble: 3,
};

const PATTERN_MIN_BRUSH_SIZE = {
  checker: 2,
  diag: 2,
  dots: 2,
};

/**
 * Devuelve el grosor mínimo (en px) permitido para la herramienta y patrón activos.
 * @returns {number}
 */
export function getMinBrushSize() {
  const toolMin = TOOL_MIN_BRUSH_SIZE[state.currentTool] || 1;
  const usesPattern =
    !state.activeCustomBrushId &&
    (state.currentTool === "pencil" || state.currentTool === "line");
  const patternMin = usesPattern ? PATTERN_MIN_BRUSH_SIZE[state.activeBrushPattern] || 1 : 1;
  return Math.max(toolMin, patternMin);
}

/**
 * Actualiza el grosor reutilizable (en px) respetando el mínimo de la herramienta/patrón activo.
 * @param {number} size
 * @param {boolean} [announce=true]
 */
export function setBrushSize(size, announce = true) {
  const minSize = getMinBrushSize();
  const clamped = Math.max(minSize, Math.min(256, Math.round(Number(size) || minSize)));
  state.brushSize = clamped;

  const numInput = document.getElementById("brushSizeNumber");
  if (numInput) {
    numInput.min = String(minSize);
    if (Number(numInput.value) !== clamped) {
      numInput.value = String(clamped);
    }
  }

  const slider = document.getElementById("brushSizeInput");
  const sliderVal = Math.min(64, clamped);
  if (slider) {
    slider.min = String(minSize);
    if (Number(slider.value) !== sliderVal) {
      slider.value = String(sliderVal);
    }
  }

  if (announce) {
    setStatus({ key: "log.brush_size", params: { size: clamped } });
  }
}

/** Cambia el modo de la herramienta de línea (straight o curve).
 * @param {string} mode */
export function setLineMode(mode) {
  state.lineMode = mode === "curve" ? "curve" : "straight";
  updateToolOptionsUI(state.currentTool);
  setStatus(
    state.lineMode === "curve"
      ? { key: "log.line_curve", params: { pts: state.curveControlPoints || 1 } }
      : { key: "log.line_straight" },
  );
}

/** Define la cantidad de puntos de control Bézier (1 a 3).
 * @param {number} count */
export function setCurveControlPoints(count) {
  state.curveControlPoints = Math.max(1, Math.min(3, Math.round(Number(count) || 1)));
  updateToolOptionsUI(state.currentTool);
  setStatus({ key: "log.curve_pts", params: { pts: state.curveControlPoints } });
}

/** Define el patrón de trazo para líneas.
 * @param {string} style */
export function setLineStyle(style) {
  const valid = new Set(["solid", "dotted", "dashed", "dashdot"]);
  state.lineStyle = valid.has(style) ? style : "solid";
  updateToolOptionsUI(state.currentTool);
  const labels = {
    solid: "Sólida",
    dotted: "Punteada",
    dashed: "Discontinua",
    dashdot: "Punto y guión",
  };
  setStatus({ key: "log.line_style", params: { style: i18n.t(`log.line_style_${state.lineStyle}`) } });
}

/**
 * Muestra u oculta las opciones contextuales según la herramienta seleccionada.
 * @param {string} toolName
 */
export function updateToolOptionsUI(toolName = state.currentTool) {
  const box = document.getElementById("toolOptionsBox");
  const optLine = document.getElementById("optLineOptions");
  const optShapes = document.getElementById("optShapeSelector");
  const optFilter = document.getElementById("optFilterSelector");
  const optRadius = document.getElementById("optCircleRadius");
  const optFill = document.getElementById("optFillShapes");
  const optPP = document.getElementById("optPixelPerfect");
  const optBrushSize = document.getElementById("optBrushSize");
  const optCustomBrushes = document.getElementById("optCustomBrushes");
  const optMagic = document.getElementById("optMagicWand");
  const optSpray = document.getElementById("optSprayOptions");
  const optFT = document.getElementById("optFreeTransform");

  const ftActive = Boolean(state.freeTransform);
  if (optFT) {
    optFT.style.display = ftActive ? "flex" : "none";
    if (ftActive) {
      const mode = state.freeTransform.mode || "scale";
      document.getElementById("ftModeScale")?.classList.toggle("active", mode === "scale");
      document.getElementById("ftModePerspective")?.classList.toggle("active", mode === "perspective");
      document.getElementById("ftModeSymmetric")?.classList.toggle("active", mode === "symmetric");
    }
  }

  const isShape = toolName === "rect" || toolName === "circle" || toolName === "triangle";
  const isFilter = toolName === "blur" || toolName === "jumble" || toolName === "noise";
  const activeLayer = state.layers?.[state.activeLayerIndex];
  const inTilemapPlaceMode =
    activeLayer?.type === "tilemap" &&
    state.tilemapMode === "tiles" &&
    TILEMAP_PLACE_TOOLS.has(toolName);
  const supportsBrushSize = BRUSH_SIZE_TOOLS.has(toolName);
  const showBrushSize = supportsBrushSize && !inTilemapPlaceMode;
  const showAny = ftActive || isShape || isFilter || showBrushSize || toolName === "magicSelect";

  if (box) box.style.display = showAny ? "flex" : "none";
  if (!ftActive) {
    const paintCanvas = document.getElementById("paintCanvas");
    if (paintCanvas) paintCanvas.style.cursor = getToolCursorCss(toolName);
  }
  if (optLine) {
    const showLineOpts = !inTilemapPlaceMode && (toolName === "line" || isShape);
    optLine.style.display = showLineOpts ? "flex" : "none";
    if (showLineOpts) {
      const mode = state.lineMode || "straight";
      const style = state.lineStyle || "solid";
      const modeRow = document.getElementById("optLineModeRow");
      if (modeRow) modeRow.style.display = toolName === "line" ? "flex" : "none";
      document.getElementById("lineModeStraight")?.classList.toggle("active", mode === "straight");
      document.getElementById("lineModeCurve")?.classList.toggle("active", mode === "curve");
      document.getElementById("lineStyleSolid")?.classList.toggle("active", style === "solid");
      document.getElementById("lineStyleDotted")?.classList.toggle("active", style === "dotted");
      document.getElementById("lineStyleDashed")?.classList.toggle("active", style === "dashed");
      document.getElementById("lineStyleDashdot")?.classList.toggle("active", style === "dashdot");
      const curvePtsRow = document.getElementById("optCurvePoints");
      if (curvePtsRow) curvePtsRow.style.display = toolName === "line" && mode === "curve" ? "flex" : "none";
      const pts = Math.max(1, Math.min(3, Number(state.curveControlPoints) || 1));
      document.getElementById("curvePts1")?.classList.toggle("active", pts === 1);
      document.getElementById("curvePts2")?.classList.toggle("active", pts === 2);
      document.getElementById("curvePts3")?.classList.toggle("active", pts === 3);
      if (toolName === "line") {
        const lineBtn = document.getElementById("toolLine");
        if (lineBtn) {
          const iconName = mode === "curve" ? "spline" : "slash";
          lineBtn.innerHTML = `<i data-lucide="${iconName}" class="ui-icon"></i>`;
          refreshIcons(lineBtn);
        }
      }
    }
  }
  if (optShapes) optShapes.style.display = isShape ? "flex" : "none";
  if (optFilter) optFilter.style.display = isFilter ? "flex" : "none";
  if (optFill) {
    optFill.style.display = isShape ? "flex" : "none";
    const chkFill = document.getElementById("chkFillShapes");
    if (chkFill) chkFill.checked = Boolean(state.fillShapes);
  }
  if (optRadius) {
    optRadius.style.display = !inTilemapPlaceMode && toolName === "circle" ? "flex" : "none";
    const radInput = document.getElementById("circleRadiusInput");
    if (radInput) radInput.value = String(Math.max(0, Math.min(64, Math.round(Number(state.circleRadius) || 0))));
  }
  if (optPP) {
    optPP.style.display = !inTilemapPlaceMode && toolName === "pencil" ? "flex" : "none";
    const chkPP = document.getElementById("chkPixelPerfect");
    if (chkPP) chkPP.checked = state.pixelPerfect !== false;
  }
  if (optBrushSize) optBrushSize.style.display = showBrushSize ? "flex" : "none";
  if (showBrushSize) {
    setBrushSize(state.brushSize, false);
  }
  if (optCustomBrushes) {
    optCustomBrushes.style.display =
      !inTilemapPlaceMode && (toolName === "pencil" || toolName === "line" || isShape) ? "flex" : "none";
  }
  if (optMagic) {
    optMagic.style.display = toolName === "magicSelect" ? "flex" : "none";
    const tolInput = document.getElementById("magicToleranceInput");
    if (tolInput) tolInput.value = String(Math.max(0, Math.min(64, Math.round(Number(state.magicTolerance) || 0))));
    const chkContig = document.getElementById("chkMagicContiguous");
    if (chkContig) chkContig.checked = state.magicContiguous !== false;
  }
  if (optSpray) {
    optSpray.style.display = toolName === "spray" ? "flex" : "none";
    const sprayInput = document.getElementById("sprayDensityInput");
    if (sprayInput) {
      const pct = Math.round(Math.max(0.1, Math.min(1, Number(state.sprayDensity ?? 0.3))) * 100);
      sprayInput.value = String(pct);
    }
  }

  if (isShape) {
    lastShapeTool = toolName;
    const shapeBtn = document.getElementById("toolShapes");
    const iconName = toolName === "circle" ? "circle" : toolName === "triangle" ? "triangle" : "square";
    if (shapeBtn) {
      shapeBtn.innerHTML = `<i data-lucide="${iconName}" class="ui-icon"></i>`;
      refreshIcons(shapeBtn);
    }
    ["shapeBtnRect", "shapeBtnCircle", "shapeBtnTriangle"].forEach((id) => {
      const b = document.getElementById(id);
      if (!b) return;
      const match =
        (id === "shapeBtnRect" && toolName === "rect") ||
        (id === "shapeBtnCircle" && toolName === "circle") ||
        (id === "shapeBtnTriangle" && toolName === "triangle");
      b.classList.toggle("active", match);
    });
  }
  if (isFilter) {
    lastFilterTool = toolName;
    const filterBtn = document.getElementById("toolFilterBrush");
    const iconName = toolName === "jumble" ? "shuffle" : toolName === "noise" ? "sparkles" : "droplet";
    if (filterBtn) {
      filterBtn.innerHTML = `<i data-lucide="${iconName}" class="ui-icon"></i>`;
      refreshIcons(filterBtn);
    }
    document.getElementById("filterBtnBlur")?.classList.toggle("active", toolName === "blur");
    document.getElementById("filterBtnJumble")?.classList.toggle("active", toolName === "jumble");
    document.getElementById("filterBtnNoise")?.classList.toggle("active", toolName === "noise");
  }
}

const MOBILE_TOOL_ICONS = {
  pencil: "pencil",
  eraser: "eraser",
  bucket: "paint-bucket",
  eyedropper: "pipette",
  pan: "hand",
  move: "move",
  line: "slash",
  rect: "square",
  circle: "circle",
  triangle: "triangle",
  select: "square-dashed",
  ellipseSelect: "circle",
  lasso: "lasso",
  magicSelect: "wand-sparkles",
  spray: "spray-can",
  shading: "sun-dim",
  blur: "droplet",
  jumble: "shuffle",
  noise: "sparkles",
  backgroundEraser: "eraser",
};

let previousToolBeforeEyedropper = "pencil";

function syncMobileToolButtonIcon(toolName) {
  const btn = document.getElementById("btnMobileTools");
  if (!btn) return;
  const iconEl = btn.querySelector("i, svg");
  const iconName = MOBILE_TOOL_ICONS[toolName] || "paintbrush";
  if (iconEl) {
    const nextIcon = document.createElement("i");
    nextIcon.setAttribute("data-lucide", iconName);
    nextIcon.className = "ui-icon-sm";
    iconEl.replaceWith(nextIcon);
    refreshIcons(btn);
  }
}

/**
 * Vuelve automáticamente a la herramienta previa luego de usar el Gotero en pantallas táctiles.
 */
export function restorePreviousToolAfterEyedropper() {
  const nextTool = previousToolBeforeEyedropper && previousToolBeforeEyedropper !== "eyedropper"
    ? previousToolBeforeEyedropper
    : "pencil";
  setTool(nextTool);
}

/**
 * Cambia la herramienta activa, actualiza botones, opciones contextuales y estado.
 * @param {string} toolName
 */
export function setTool(toolName) {
  if (toolName === "eyedropper" && state.currentTool && state.currentTool !== "eyedropper") {
    previousToolBeforeEyedropper = state.currentTool;
  }
  if (state.freeTransform) {
    commitFreeTransform();
  }
  if (toolName !== "move") {
    state.floatingSelection = null;
  }
  state.currentTool = toolName;
  document
    .querySelectorAll("#tools .tool-btn")
    .forEach((b) => b.classList.remove("active"));

  const map = {
    pencil: "toolPencil",
    line: "toolLine",
    rect: "toolShapes",
    circle: "toolShapes",
    triangle: "toolShapes",
    blur: "toolFilterBrush",
    jumble: "toolFilterBrush",
    noise: "toolFilterBrush",
    spray: "toolSpray",
    move: "toolMove",
    pan: "toolPan",
    shading: "toolShading",
    bucket: "toolBucket",
    eyedropper: "toolEyedropper",
    eraser: "toolEraser",
    select: "toolSelect",
    ellipseSelect: "toolEllipseSelect",
    lasso: "toolLasso",
    magicSelect: "toolMagicSelect",
    backgroundEraser: "toolBackgroundEraser",
  };

  const targetId = map[toolName];
  if (targetId) {
    document.getElementById(targetId)?.classList.add("active");
  }
  updateToolOptionsUI(toolName);
  syncMobileToolButtonIcon(toolName);
  setStatus({ key: "log.tool_selected", params: { toolKey: toolName, tool: toolName } });
}

/**
 * Sincroniza el estado visual de los botones de simetría, modo de centro (1px vs 2px) e inputs de ejes X/Y.
 */
export function syncSymmetryControlsUI() {
  const doc = typeof document !== "undefined" ? document : null;
  if (!doc) return;

  doc.getElementById("toolMirrorH")?.classList.toggle("active", Boolean(state.mirrorH));
  doc.getElementById("toolMirrorV")?.classList.toggle("active", Boolean(state.mirrorV));
  doc.getElementById("toolMirrorDiagMain")?.classList.toggle("active", Boolean(state.mirrorDiagMain));
  doc.getElementById("toolMirrorDiagAnti")?.classList.toggle("active", Boolean(state.mirrorDiagAnti));
  doc.getElementById("toolMirrorRadial90")?.classList.toggle("active", state.mirrorRadial === "rot90");
  doc.getElementById("toolMirrorRadial45")?.classList.toggle("active", state.mirrorRadial === "oct45");

  const cfgBox = doc.getElementById("symmetryConfigBox");
  if (cfgBox) {
    cfgBox.style.display = isSymmetryActive() ? "flex" : "none";
  }

  const isPixelMode = state.symmetryCenterMode === "pixel";
  doc.getElementById("btnSymModeBetween")?.classList.toggle("active", !isPixelMode);
  doc.getElementById("btnSymModePixel")?.classList.toggle("active", isPixelMode);
  doc.getElementById("btnMoveSymAxis")?.classList.toggle("active", Boolean(state.isMovingSymmetryAxis));

  const { w, h } = getGridDims();
  const { axisX, axisY } = getSymmetryPivot(w, h);
  const xInput = /** @type {HTMLInputElement | null} */ (doc.getElementById("symAxisXInput"));
  const yInput = /** @type {HTMLInputElement | null} */ (doc.getElementById("symAxisYInput"));
  if (xInput && doc.activeElement !== xInput) {
    xInput.max = String(w - 0.5);
    xInput.value = String(axisX);
  }
  if (yInput && doc.activeElement !== yInput) {
    yInput.max = String(h - 0.5);
    yInput.value = String(axisY);
  }
}

/**
 * Activa o desactiva el modo espejo horizontal.
 */
export function toggleMirrorH() {
  state.mirrorH = !state.mirrorH;
  syncSymmetryControlsUI();
  syncViewTogglesUI();
  renderAll();
  setStatus(
    { key: state.mirrorH ? "status.mirror_h_on" : "status.mirror_h_off" },
  );
}

/**
 * Activa o desactiva el modo espejo vertical.
 */
export function toggleMirrorV() {
  state.mirrorV = !state.mirrorV;
  syncSymmetryControlsUI();
  syncViewTogglesUI();
  renderAll();
  setStatus(
    { key: state.mirrorV ? "status.mirror_v_on" : "status.mirror_v_off" },
  );
}

/**
 * Activa o desactiva la simetría radial de 90° (`"rot90"`, 4 ejes) o 45° (`"oct45"`, 8 ejes).
 * @param {"rot90"|"oct45"|string} mode
 */
export function toggleMirrorRadial(mode) {
  const clean = mode === "oct45" ? "oct45" : "rot90";
  state.mirrorRadial = state.mirrorRadial === clean ? "none" : clean;
  syncSymmetryControlsUI();
  syncViewTogglesUI();
  renderAll();
  if (state.mirrorRadial === "rot90") {
    setStatus({ key: "status.mirror_r90_on" });
  } else if (state.mirrorRadial === "oct45") {
    setStatus({ key: "status.mirror_r45_on" });
  } else {
    setStatus({ key: "status.mirror_radial_off" });
  }
}

/**
 * Define la paridad del eje central de simetría: `"between"` (entre píxeles, 2px) o `"pixel"` (sobre píxel, 1px corazón).
 * Si el usuario había desplazado manualmente el eje, ajusta su fracción `.0` / `.5` preservando su zona.
 * @param {"between"|"pixel"|string} mode
 */
export function setSymmetryCenterMode(mode) {
  const next = mode === "pixel" ? "pixel" : "between";
  state.symmetryCenterMode = next;
  const { w, h } = getGridDims();

  if (typeof state.symmetryAxisX === "number") {
    const baseCol = Math.floor(state.symmetryAxisX);
    state.symmetryAxisX = Math.max(0.5, Math.min(w - 0.5, next === "pixel" ? baseCol + 0.5 : Math.max(1, baseCol)));
  }
  if (typeof state.symmetryAxisY === "number") {
    const baseRow = Math.floor(state.symmetryAxisY);
    state.symmetryAxisY = Math.max(0.5, Math.min(h - 0.5, next === "pixel" ? baseRow + 0.5 : Math.max(1, baseRow)));
  }

  syncSymmetryControlsUI();
  renderAll();
  setStatus({ key: next === "pixel" ? "status.sym_mode_pixel" : "status.sym_mode_between" });
}

/**
 * Establece manualmente la coordenada X del eje de simetría (en pasos de 0.5 px).
 * @param {number|string} val
 */
export function setSymmetryAxisX(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return;
  const { w } = getGridDims();
  const snapped = Math.max(0.5, Math.min(w - 0.5, Math.round(num * 2) / 2));
  state.symmetryAxisX = snapped;
  state.symmetryCenterMode = Math.abs((snapped % 1) - 0.5) < 0.01 ? "pixel" : "between";
  syncSymmetryControlsUI();
  renderAll();
}

/**
 * Establece manualmente la coordenada Y del eje de simetría (en pasos de 0.5 px).
 * @param {number|string} val
 */
export function setSymmetryAxisY(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return;
  const { h } = getGridDims();
  const snapped = Math.max(0.5, Math.min(h - 0.5, Math.round(num * 2) / 2));
  state.symmetryAxisY = snapped;
  state.symmetryCenterMode = Math.abs((snapped % 1) - 0.5) < 0.01 ? "pixel" : "between";
  syncSymmetryControlsUI();
  renderAll();
}

/**
 * Restablece la posición `(X, Y)` de los ejes de simetría al centro exacto del lienzo.
 */
export function resetSymmetryAxes() {
  state.symmetryAxisX = null;
  state.symmetryAxisY = null;
  state.isMovingSymmetryAxis = false;
  syncSymmetryControlsUI();
  renderAll();
  setStatus({ key: "status.sym_axes_centered" });
}

/**
 * Activa o desactiva el modo interactivo para arrastrar y posicionar el eje de simetría sobre el lienzo.
 * Una vez que el usuario suelta el clic en el lienzo, el eje vuelve a bloquearse automáticamente para no estorbar al pintar.
 */
export function toggleSymmetryAxisDragMode() {
  state.isMovingSymmetryAxis = !state.isMovingSymmetryAxis;
  syncSymmetryControlsUI();
  setStatus({
    key: state.isMovingSymmetryAxis ? "status.sym_drag_mode_on" : "status.sym_drag_mode_off",
  });
}

/**
 * Posiciona los ejes activos de simetría a partir de una coordenada continua `(rawX, rawY)` del lienzo,
 * ajustando automáticamente a centro de píxel (`.5`) en modo `"pixel"` o a borde entre píxeles (`.0`) en modo `"between"`.
 * @param {number} rawX
 * @param {number} rawY
 */
export function applySymmetryAxisFromCanvasPoint(rawX, rawY) {
  const { w, h } = getGridDims();
  const isPixelMode = state.symmetryCenterMode === "pixel";
  const snapCoord = (val, maxDim) => {
    const snapped = isPixelMode ? Math.floor(val) + 0.5 : Math.round(val);
    return Math.max(0.5, Math.min(maxDim - 0.5, snapped));
  };

  const isRadial =
    state.mirrorRadial === "rot90" ||
    state.mirrorRadial === "oct45" ||
    state.mirrorDiagMain ||
    state.mirrorDiagAnti;
  if (state.mirrorH || isRadial) {
    state.symmetryAxisX = snapCoord(rawX, w);
  }
  if (state.mirrorV || isRadial) {
    state.symmetryAxisY = snapCoord(rawY, h);
  }
  syncSymmetryControlsUI();
  renderAll();
}

/**
 * Activa o desactiva el espejo diagonal principal (`\`, reflexión y = x).
 */
export function toggleMirrorDiagMain() {
  state.mirrorDiagMain = !state.mirrorDiagMain;
  syncSymmetryControlsUI();
  syncViewTogglesUI();
  renderAll();
  setStatus({
    key: state.mirrorDiagMain ? "status.mirror_diag_main_on" : "status.mirror_diag_main_off",
  });
}

/**
 * Activa o desactiva el espejo diagonal inverso (`/`, reflexión y = -x).
 */
export function toggleMirrorDiagAnti() {
  state.mirrorDiagAnti = !state.mirrorDiagAnti;
  syncSymmetryControlsUI();
  syncViewTogglesUI();
  renderAll();
  setStatus({
    key: state.mirrorDiagAnti ? "status.mirror_diag_anti_on" : "status.mirror_diag_anti_off",
  });
}

/**
 * Centra los ejes de simetría exactamente sobre el cuadro de la selección activa (Local Symmetry),
 * ajustando automáticamente el modo `1px` o `2px` según la paridad de la selección.
 */
export function centerSymmetryOnSelection() {
  const sel = state.selection;
  if (!sel || sel.w < 1 || sel.h < 1) {
    setStatus({ key: "status.sym_no_selection" }, true);
    return;
  }
  const { w, h } = getGridDims();
  const cx = Math.max(0.5, Math.min(w - 0.5, Math.round((sel.x + sel.w / 2) * 2) / 2));
  const cy = Math.max(0.5, Math.min(h - 0.5, Math.round((sel.y + sel.h / 2) * 2) / 2));
  state.symmetryAxisX = cx;
  state.symmetryAxisY = cy;
  state.symmetryCenterMode =
    Math.abs((cx % 1) - 0.5) < 0.01 || Math.abs((cy % 1) - 0.5) < 0.01 ? "pixel" : "between";
  state.isMovingSymmetryAxis = false;
  syncSymmetryControlsUI();
  renderAll();
  setStatus({ key: "status.sym_centered_selection" });
}

/**
 * Elimina todas las guías personalizadas arrastradas desde las reglas.
 */
export function clearRulerGuides() {
  const had = Array.isArray(state.rulerGuides) && state.rulerGuides.length > 0;
  state.rulerGuides = [];
  state.activeGuideDrag = null;
  renderAll();
  setStatus({ key: had ? "status.guides_cleared" : "status.guides_empty" });
}

/**
 * Muestra u oculta la cuadrícula del lienzo.
 */
export function toggleGrid() {
  state.showGrid = state.showGrid === false;
  const btn = document.getElementById("btnToggleGrid");
  if (btn) btn.classList.toggle("active", state.showGrid);
  saveUserPreferences();
  syncViewTogglesUI();
  renderAll();
  setStatus({ key: state.showGrid ? "status.grid_on" : "status.grid_off" });
}

/**
 * Muestra u oculta las reglas del lienzo.
 */
export function toggleRulers() {
  state.showRulers = !state.showRulers;
  saveUserPreferences();
  syncViewTogglesUI();
  renderAll();
  setStatus({ key: state.showRulers ? "status.rulers_on" : "status.rulers_off" });
}

/**
 * Muestra u oculta las líneas guía centrales del lienzo (marcas rojas del punto medio).
 */
export function toggleCenterGuides() {
  state.showCenterGuides = state.showCenterGuides === false;
  saveUserPreferences();
  syncViewTogglesUI();
  renderAll();
  renderRulers();
  setStatus({ key: state.showCenterGuides ? "status.center_guides_on" : "status.center_guides_off" });
}

/**
 * Muestra u oculta las coordenadas de cuadrícula bajo el cursor.
 */
export function toggleGridCoords() {
  state.showGridCoords = !state.showGridCoords;
  saveUserPreferences();
  syncViewTogglesUI();
  renderAll();
  setStatus({ key: state.showGridCoords ? "status.grid_coords_on" : "status.grid_coords_off" });
}

/**
 * Muestra u oculta la vista previa precisa del píxel/pincel bajo el cursor.
 */
export function togglePixelCursor() {
  state.showPixelCursor = state.showPixelCursor === false;
  saveUserPreferences();
  syncViewTogglesUI();
  renderAll();
  setStatus(
    { key: state.showPixelCursor ? "status.pixel_cursor_on" : "status.pixel_cursor_off" },
  );
}

/**
 * Actualiza el estado activo de los botones de resolución (16×16 a 512×512).
 * @param {number} w
 * @param {number} [h=w]
 */
export function updateResolutionButtons(w, h = w) {
  const rw = Math.max(1, Math.round(Number(w) || 64));
  const rh = Math.max(1, Math.round(Number(h) || rw));
  let matchedPreset = false;

  for (const res of RESOLUTION_PRESETS) {
    const btn = document.getElementById(`btnRes${res}`);
    const match = rw === res && rh === res;
    if (match) matchedPreset = true;
    if (btn) btn.classList.toggle("active", match);
  }

  const badge = document.getElementById("menuActiveResolutionBadge");
  if (badge) badge.textContent = `${rw}×${rh} ▸`;

  const customBtn = document.getElementById("btnResCustom");
  if (customBtn) {
    customBtn.classList.toggle("active", !matchedPreset);
    const labelEl = customBtn.querySelector(".menu-action-label");
    if (labelEl) {
      const baseCustomLabel = i18n.t("menu.canvas.custom_res");
      labelEl.textContent = matchedPreset
        ? baseCustomLabel
        : baseCustomLabel.replace(/\([^)]*\)/, `(${rw}×${rh})`);
    }
  }

  const wInput = document.getElementById("customResW");
  const hInput = document.getElementById("customResH");
  if (wInput) wInput.value = String(rw);
  if (hInput) hInput.value = String(rh);
  syncSymmetryControlsUI();
}

/**
 * Incrementa el zoom del lienzo en +25%.
 */
export function zoomIn() {
  applyZoom(state.zoom + 0.25);
}

/**
 * Reduce el zoom del lienzo en -25%.
 */
export function zoomOut() {
  applyZoom(state.zoom - 0.25);
}

/**
 * Restablece el zoom del lienzo al 100% (1:1).
 */
export function resetZoom() {
  applyZoom(1);
}


/** Activa o desactiva el modo Tiled (none, both, x, y).
 * @param {string} mode */
export function setTiledMode(mode) {
  const valid = new Set(["none", "both", "x", "y"]);
  const next = valid.has(mode) ? mode : "none";
  state.tiledMode = next;

  document.querySelectorAll("[data-tiled-mode]").forEach((btn) => {
    const isActive = btn.getAttribute("data-tiled-mode") === next;
    btn.classList.toggle("active", isActive);
  });

  const previewLabel = document.querySelector("#previewModuleHeader label");
  if (previewLabel) {
    const labels = {
      none: "Vista 1:1",
      both: "Tiled 3×3",
      x: "Tiled 3×1",
      y: "Tiled 1×3",
    };
    previewLabel.textContent = labels[next];
  }

  applyZoom(state.zoom || 1);
  if (next !== "none" && typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      const container = document.getElementById("canvasContainer");
      if (!container) return;
      container.scrollLeft = Math.max(0, (container.scrollWidth - container.clientWidth) / 2);
      container.scrollTop = Math.max(0, (container.scrollHeight - container.clientHeight) / 2);
    });
  }
  const statusLabels = {
    none: "Tiled Mode desactivado",
    both: "Tiled Mode: Ambos ejes (X + Y)",
    x: "Tiled Mode: Eje X",
    y: "Tiled Mode: Eje Y",
  };
  setStatus({ key: `log.tiled_${next}` });
}

let toolOptionsBound = false;

/**
 * Conecta los controles de opciones contextuales de herramientas con `state`.
 */
export function initToolOptionsControls() {
  if (toolOptionsBound) return;
  toolOptionsBound = true;

  const chkFill = document.getElementById("chkFillShapes");
  if (chkFill) {
    chkFill.checked = Boolean(state.fillShapes);
    chkFill.addEventListener("change", (e) => {
      state.fillShapes = Boolean(e.target.checked);
      setStatus({ key: state.fillShapes ? "log.fill_on" : "log.fill_off" });
    });
  }

  const radInput = document.getElementById("circleRadiusInput");
  if (radInput) {
    radInput.value = String(Math.max(0, Math.min(64, Math.round(Number(state.circleRadius) || 0))));
    const updateRadius = () => {
      if (radInput.value === "") return;
      const val = Math.max(0, Math.min(64, Math.round(Number(radInput.value) || 0)));
      state.circleRadius = val;
      radInput.value = String(val);
    };
    radInput.addEventListener("input", updateRadius);
    radInput.addEventListener("change", () => {
      updateRadius();
      setStatus(state.circleRadius > 0 ? { key: "log.circle_fixed", params: { r: state.circleRadius } } : { key: "log.circle_free" });
    });
  }

  const chkPP = document.getElementById("chkPixelPerfect");
  if (chkPP) {
    chkPP.checked = state.pixelPerfect !== false;
    chkPP.addEventListener("change", (e) => {
      state.pixelPerfect = Boolean(e.target.checked);
      setStatus({ key: state.pixelPerfect ? "log.pp_on" : "log.pp_off" });
    });
  }

  const sprayInput = document.getElementById("sprayDensityInput");
  if (sprayInput) {
    const syncSpray = (announce = false) => {
      if (sprayInput.value === "") return;
      const pct = Math.max(10, Math.min(100, Math.round(Number(sprayInput.value) || 30)));
      state.sprayDensity = pct / 100;
      sprayInput.value = String(pct);
      if (announce) setStatus({ key: "log.spray_density", params: { pct } });
    };
    sprayInput.value = String(Math.round(Math.max(0.1, Math.min(1, Number(state.sprayDensity ?? 0.3))) * 100));
    sprayInput.addEventListener("input", () => syncSpray(false));
    sprayInput.addEventListener("change", () => syncSpray(true));
  }

  const tolInput = document.getElementById("magicToleranceInput");
  if (tolInput) {
    const syncTol = (announce = false) => {
      if (tolInput.value === "") return;
      const val = Math.max(0, Math.min(64, Math.round(Number(tolInput.value) || 0)));
      state.magicTolerance = val;
      tolInput.value = String(val);
      if (announce) setStatus({ key: "log.magic_tol", params: { val } });
    };
    tolInput.value = String(Math.max(0, Math.min(64, Math.round(Number(state.magicTolerance) || 0))));
    tolInput.addEventListener("input", () => syncTol(false));
    tolInput.addEventListener("change", () => syncTol(true));
  }

  const chkContig = document.getElementById("chkMagicContiguous");
  if (chkContig) {
    chkContig.checked = state.magicContiguous !== false;
    chkContig.addEventListener("change", (e) => {
      state.magicContiguous = Boolean(e.target.checked);
      setStatus({ key: state.magicContiguous ? "log.magic_contig" : "log.magic_global" });
    });
  }
}

/**
 * Muestra u oculta el panel lateral izquierdo.
 */
