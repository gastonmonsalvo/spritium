/**
 * keyboardShortcuts.js: Undo/Redo, zonas de foco y atajos de teclado globales del editor.
 */

import { state, pushLayerState, undo, redo } from "./core/state.js";
import { renderAll } from "./canvas/canvas.js";
import { startFreeTransform, commitFreeTransform, cancelFreeTransform } from "./tools/freeTransform.js";
import {
  addNewLayer,
  duplicateActiveLayer,
  deleteActiveLayer,
  copyLayerToClipboard,
  cutLayerToClipboard,
  pasteClipboardAsLayer,
  isActiveLayerLocked,
  renameActiveLayerInline,
} from "./workspace/layers.js";
import {
  addFrame,
  selectFrame,
  moveActiveFrame,
  copyActiveFrameToClipboard,
  pasteClipboardAsFrame,
  togglePlayAnimation,
  stopAnimation,
  deleteActiveFrame,
} from "./workspace/frames.js";
import { renameActiveTagInline } from "./workspace/timelineMatrix.js";
import { toggleTilesetPanel, reconcileActiveTilemapLayer } from "./workspace/tilemap.js";
import { clearSelection, selectAll } from "./tools/tools.js";
import { TOOL_STRATEGIES } from "./tools/toolStrategies.js";
import { copySelection, cutSelection, pasteClipboard, nudgeSprite } from "./tools/transforms.js";
import {
  setStatus,
  getRegisteredAction,
  setTool,
  setBrushSize,
  toggleMirrorH,
  toggleMirrorV,
  toggleGrid,
  togglePixelCursor,
  toggleWin98Theme,
} from "./ui/index.js";
import { syncCanvasColorsToPalette } from "./workspace/paletteManager.js";

const CLOSE_MODAL_IDS = [
  "helpModal", "preferencesModal", "languageModal", "aboutModal",
  "tilemapModal", "tilemapImportModal", "newDocModal", "importOptionsModal", "recoveryModal",
  "tagModal", "newPaletteModal", "folderBrowserModal", "exportScaleModal", "customResModal", "noiseFilterModal", "normalMapModal",
];

const SINGLE_KEY_TOOL_MAP = {
  s: "select", q: "lasso", w: "magicSelect", b: "pencil", l: "line",
  r: "rect", c: "circle", u: "triangle", m: "move", h: "pan",
  k: "shading", i: "eyedropper", f: "bucket", t: "bucket", e: "eraser", d: "backgroundEraser",
};

let activeFocusZone = "canvas";

/** Devuelve la zona de foco activa ("canvas" | "layers" | "frames"). */
export function getActiveFocusZone() {
  return activeFocusZone;
}

/** Ejecuta deshacer sobre el historial de estados y actualiza el mensaje de estado. */
export function performUndo() {
  if (state.freeTransform) { cancelFreeTransform(); return; }
  if (undo()) {
    syncCanvasColorsToPalette();
    setStatus({ key: "log.undo_applied" }, false, "pixel");
  }
}

/** Ejecuta rehacer sobre el historial de estados y actualiza el mensaje de estado. */
export function performRedo() {
  if (state.freeTransform) { cancelFreeTransform(); return; }
  if (redo()) {
    syncCanvasColorsToPalette();
    setStatus({ key: "log.redo_applied" }, false, "pixel");
  }
}

function setFocusZone(zone) {
  activeFocusZone = zone;
  document.getElementById("layers-list")?.classList.toggle("layers-focused", zone === "layers");
  document.getElementById("frames-list")?.classList.toggle("frames-focused", zone === "frames");
}

function tryCloseOpenModal(e) {
  if (e.key !== "Escape") return false;
  if (document.getElementById("rgbaPickerPopover")?.classList.contains("open")) return true;
  for (const id of CLOSE_MODAL_IDS) {
    const modal = document.getElementById(id);
    if (modal?.classList.contains("open")) {
      e.preventDefault();
      modal.classList.remove("open");
      return true;
    }
  }
  return false;
}

function handleSpecialKeyAndModes(e) {
  if (e.key === "F2") {
    e.preventDefault();
    if (!(activeFocusZone === "frames" && renameActiveTagInline())) renameActiveLayerInline();
    return true;
  }
  if (e.key === "F1" || (e.key === "?" && !e.ctrlKey && !e.metaKey)) {
    e.preventDefault();
    document.getElementById("helpModal")?.classList.add("open");
    return true;
  }
  if (tryCloseOpenModal(e)) return true;
  if (e.key === "Enter" && TOOL_STRATEGIES.line?.isBending?.()) {
    e.preventDefault(); e.stopPropagation(); TOOL_STRATEGIES.line.commitBend(); return true;
  }
  if (e.key === "Escape" && TOOL_STRATEGIES.line?.isBending?.()) {
    e.preventDefault(); e.stopPropagation(); TOOL_STRATEGIES.line.cancelBend(); return true;
  }
  if (e.key === "Enter" && state.freeTransform) {
    e.preventDefault(); e.stopPropagation(); commitFreeTransform(); return true;
  }
  if (e.key === "Escape" && state.freeTransform) {
    e.preventDefault(); e.stopPropagation(); cancelFreeTransform(); return true;
  }
  if (e.key === "Escape" || (e.ctrlKey && e.key.toLowerCase() === "d")) {
    if (state.selection) {
      e.preventDefault();
      state.selection = null;
      state.floatingSelection = null;
      renderAll();
      setStatus({ key: "log.sel_cancelled" });
    }
    return true;
  }
  return false;
}

function handleDeleteKey(e) {
  if (e.key !== "Delete" && e.key !== "Backspace") return false;
  e.preventDefault();
  if (activeFocusZone === "frames") { deleteActiveFrame(); return true; }
  if (activeFocusZone === "layers") { deleteActiveLayer(); return true; }
  if (isActiveLayerLocked()) { setStatus({ key: "log.layer_locked" }, true); return true; }
  if (state.selection) {
    pushLayerState();
    if (clearSelection()) { reconcileActiveTilemapLayer(); renderAll(); setStatus({ key: "log.sel_cleared" }, false, "pixel"); }
  } else if (state.layers.length > 1) {
    deleteActiveLayer();
  } else {
    pushLayerState();
    for (let y = 0; y < state.grid.length; y++) state.grid[y].fill(0);
    reconcileActiveTilemapLayer();
    state.isDirtySinceImport = true;
    renderAll();
    setStatus({ key: "log.base_layer_cleared" }, false, "pixel");
  }
  return true;
}

function handleModifierShortcuts(e, key, isMod) {
  if (e.altKey && !isMod && key === "t") { e.preventDefault(); e.stopPropagation(); toggleTilesetPanel(); return true; }
  if ((isMod && key === "t") || (e.shiftKey && key === "t" && !isMod)) { e.preventDefault(); e.stopPropagation(); startFreeTransform(); return true; }
  if (isMod && key === "o") { e.preventDefault(); e.stopPropagation(); document.getElementById("projectFileInput")?.click(); return true; }
  if (isMod && key === "z") { e.preventDefault(); performUndo(); return true; }
  if (isMod && key === "y") { e.preventDefault(); performRedo(); return true; }
  if (e.altKey && !isMod && key === "n") {
    e.preventDefault();
    if (activeFocusZone === "layers") addNewLayer();
    else if (activeFocusZone === "frames") addFrame({ duplicate: false });
    else { e.stopPropagation(); getRegisteredAction("openNewDocModal")?.() ?? document.getElementById("newDocModal")?.classList.add("open"); }
    return true;
  }
  if (isMod && key === "j" && activeFocusZone === "layers") { e.preventDefault(); duplicateActiveLayer(); return true; }
  if (e.ctrlKey && key === "j" && activeFocusZone === "frames") { e.preventDefault(); addFrame({ duplicate: true }); return true; }
  if (e.ctrlKey && key === "a" && activeFocusZone === "canvas") { e.preventDefault(); selectAll(); renderAll(); setStatus({ key: "log.sel_all" }); return true; }
  if (e.ctrlKey && key === "c") {
    e.preventDefault();
    if (activeFocusZone === "layers") copyLayerToClipboard();
    else if (activeFocusZone === "frames") copyActiveFrameToClipboard();
    else { const { w, h } = copySelection(); setStatus({ key: "log.copied", params: { w, h } }, false, "pixel"); }
    return true;
  }
  if (e.ctrlKey && key === "x") {
    e.preventDefault();
    if (activeFocusZone === "layers") cutLayerToClipboard();
    else { const { w, h } = cutSelection(); setStatus({ key: "log.cut", params: { w, h } }, false, "pixel"); }
    return true;
  }
  if (e.ctrlKey && key === "v") {
    e.preventDefault();
    if (activeFocusZone === "layers") pasteClipboardAsLayer();
    else if (activeFocusZone === "frames") pasteClipboardAsFrame();
    else if (pasteClipboard()) setStatus({ key: "log.pasted_cursor" }, false, "pixel");
    return true;
  }
  return false;
}

function handleNavigationAndTools(e, key, isMod) {
  if (e.code === "Space" && activeFocusZone === "frames") { e.preventDefault(); togglePlayAnimation(); return; }
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    const dir = e.key === "ArrowLeft" ? -1 : 1;
    if (activeFocusZone === "frames") {
      if (e.shiftKey || e.ctrlKey) moveActiveFrame(dir);
      else { stopAnimation(); selectFrame(Math.max(0, Math.min(state.frames.length - 1, state.activeFrameIndex + dir))); }
    } else nudgeSprite(dir, 0);
    return;
  }
  if (e.key === "ArrowUp") { e.preventDefault(); nudgeSprite(0, -1); return; }
  if (e.key === "ArrowDown") { e.preventDefault(); nudgeSprite(0, 1); return; }
  if (!e.ctrlKey && !e.metaKey && !e.altKey && SINGLE_KEY_TOOL_MAP[key]) { setTool(SINGLE_KEY_TOOL_MAP[key]); return; }
  if (key === "x") { e.preventDefault(); toggleMirrorH(); }
  else if (key === "y" && !e.ctrlKey) { e.preventDefault(); toggleMirrorV(); }
  else if (key === "g") { e.preventDefault(); toggleGrid(); }
  else if (key === "v" && !isMod && !e.altKey) { e.preventDefault(); togglePixelCursor(); }
  else if (key === "p" && !isMod && !e.altKey) { e.preventDefault(); toggleTilesetPanel(); }
  else if (e.key === "[" && !isMod) { e.preventDefault(); setBrushSize((state.brushSize || 1) - 1); }
  else if (e.key === "]" && !isMod) { e.preventDefault(); setBrushSize((state.brushSize || 1) + 1); }
}

const KONAMI_SEQUENCE = [
  "arrowup", "arrowup", "arrowdown", "arrowdown",
  "arrowleft", "arrowright", "arrowleft", "arrowright",
  "b", "a",
];
let konamiIndex = 0;
let konamiLastKeyAt = 0;

function handleKonamiKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) {
    konamiIndex = 0;
    return false;
  }
  const now = Date.now();
  if (now - konamiLastKeyAt > 2500) konamiIndex = 0;
  konamiLastKeyAt = now;

  const key = e.key.toLowerCase();
  if (key === KONAMI_SEQUENCE[konamiIndex]) {
    konamiIndex += 1;
    if (konamiIndex === KONAMI_SEQUENCE.length) {
      konamiIndex = 0;
      e.preventDefault();
      toggleWin98Theme();
      return true;
    }
    return false;
  }
  // Si repite ↑ al inicio de ↑↑↓↓..., conservar prefijo válido
  konamiIndex = key === KONAMI_SEQUENCE[0] ? (konamiIndex === 2 ? 2 : 1) : 0;
  return false;
}

/** Registra atajos de teclado globales del editor. */
export function setupKeyboardShortcuts() {
  document.addEventListener("mousedown", (e) => {
    if (e.target.closest("#layers-list, #layersSection")) setFocusZone("layers");
    else if (e.target.closest("#frames-list, #timelineMatrixWrap, #timelineTagsRow")) setFocusZone("frames");
    else setFocusZone("canvas");
  }, { capture: true });

  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT" || e.target.isContentEditable) return;
    if (handleKonamiKey(e)) return;
    if (!document.getElementById("launcherOverlay")?.classList.contains("hidden")) return;
    if (handleSpecialKeyAndModes(e) || handleDeleteKey(e)) return;

    const key = e.key.toLowerCase();
    const isMod = e.ctrlKey || e.metaKey;
    if (handleModifierShortcuts(e, key, isMod)) return;
    handleNavigationAndTools(e, key, isMod);
  }, { capture: true });
}
