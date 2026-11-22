/**
 * symmetryUI.js: Controles de simetría, espejos (H/V/diagonal/radial) y posicionamiento de ejes.
 */

import { state, getGridDims, isSymmetryActive, getSymmetryPivot } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { setStatus } from "./status.js";
import { syncViewTogglesUI } from "./preferences.js";

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
