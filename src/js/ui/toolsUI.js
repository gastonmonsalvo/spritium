/**
 * toolsUI.js: Estado visual de herramientas, grosor, modo línea/curva y opciones contextuales.
 */

import { state } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { commitFreeTransform } from "../tools/freeTransform.js";
import { setStatus, refreshIcons } from "./status.js";
import { i18n } from "../i18n/I18nService.js";
import { getToolCursorCss } from "./cursors.js";


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

  const numInput = typeof document !== "undefined" ? document.getElementById("brushSizeNumber") : null;
  if (numInput) {
    numInput.min = String(minSize);
    if (Number(numInput.value) !== clamped) {
      numInput.value = String(clamped);
    }
  }

  const slider = typeof document !== "undefined" ? document.getElementById("brushSizeInput") : null;
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
  if (typeof document === "undefined") return;
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
  if (typeof document !== "undefined") {
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
  }
  setStatus({ key: "log.tool_selected", params: { toolKey: toolName, tool: toolName } });
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
