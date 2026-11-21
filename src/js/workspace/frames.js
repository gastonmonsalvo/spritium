/**
 * frames.js: Línea de tiempo modular (Frames, Onion Skin, Reproducción y Export Spritesheet PNG + JSON).
 */

import {
  subscribe,
  state,
  pushState,
  createEmptyGrid,
  cloneLayers,
  getGridDims,
  notify,
  syncLinkedCelsForActiveLayer,
  getSelectedFrameRange,
} from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { parseColorToRgba } from "../core/color.js";
import { syncActiveLayerGrid, renderLayersUI } from "./layers.js";
import { setStatus, refreshIcons } from "../ui/index.js";
import { i18n } from "../i18n/I18nService.js";

if (typeof window !== "undefined") {
  i18n.addEventListener("langchange", () => renderFramesUI());
}
import {
  renderFrameToOffscreenCanvas,
  exportPureSpritesheetPng,
  exportPackedAtlas,
  exportSpritesheet,
} from "./spritesheetExporter.js";

export {
  renderFrameToOffscreenCanvas,
  exportPureSpritesheetPng,
  exportPackedAtlas,
  exportSpritesheet,
};

let frameCounter = 1;
let playTimer = null;
let frameClipboard = null;
let frameContextMenuInitialized = false;

/**
 * Crea un nuevo objeto frame con sus capas y duración en milisegundos.
 * @param {Array<Object>} [layers=null]
 * @param {number} [durationMs=150]
 */
export function createFrame(layers = null, durationMs = 150) {
  const { w, h } = getGridDims();
  return {
    id: `frame_${Date.now()}_${frameCounter++}`,
    durationMs,
    layers: layers
      ? cloneLayers(layers)
      : [
          {
            id: `layer_${Date.now()}_${frameCounter}`,
            name: "Base",
            visible: true,
            grid: createEmptyGrid(w, h),
          },
        ],
    activeLayerIndex: 0,
  };
}

function adjustFrameTagsOnInsert(insertIdx) {
  if (!Array.isArray(state.frameTags)) return;
  const maxIdx = Math.max(0, state.frames.length - 1);
  for (const tag of state.frameTags) {
    if (tag.from >= insertIdx) tag.from = Math.min(maxIdx, tag.from + 1);
    if (tag.to >= insertIdx) tag.to = Math.min(maxIdx, tag.to + 1);
  }
}

function adjustFrameTagsOnDelete(deletedIdx) {
  if (!Array.isArray(state.frameTags)) return;
  const maxIdx = Math.max(0, state.frames.length - 1);
  for (const tag of state.frameTags) {
    if (tag.from > deletedIdx) tag.from--;
    if (tag.to >= deletedIdx && tag.to > tag.from) tag.to--;
    tag.from = Math.max(0, Math.min(maxIdx, tag.from));
    tag.to = Math.max(tag.from, Math.min(maxIdx, tag.to));
  }
}

/**
 * Sincroniza las capas e índice activo actuales dentro del frame activo.
 */
export function syncActiveFrame() {
  if (!state.frames || state.frames.length === 0) {
    state.frames = [createFrame(state.layers)];
    state.activeFrameIndex = 0;
  }
  const cur = state.frames[state.activeFrameIndex];
  if (cur) {
    cur.layers = state.layers;
    cur.activeLayerIndex = state.activeLayerIndex;
    syncLinkedCelsForActiveLayer();
  }
}

/**
 * Reinicia la línea de tiempo con un único frame basado en las capas actuales.
 */
export function resetFramesWithCurrentLayers() {
  stopAnimation();
  state.frames = [
    {
      id: `frame_${Date.now()}_${frameCounter++}`,
      durationMs: 150,
      layers: state.layers,
      activeLayerIndex: state.activeLayerIndex,
    },
  ];
  state.activeFrameIndex = 0;
  renderFramesUI();
}

/**
 * Cambia al frame indicado por índice y actualiza lienzo y capas.
 * @param {number} index
 */
export function selectFrame(index) {
  if (index < 0 || index >= state.frames.length) return;
  syncActiveFrame();
  const prevLayerIdx = state.activeLayerIndex || 0;
  state.activeFrameIndex = index;
  const target = state.frames[index];
  state.layers = target.layers;
  state.activeLayerIndex = Math.min(
    Math.max(0, prevLayerIdx),
    state.layers.length - 1,
  );
  syncActiveLayerGrid();
  renderLayersUI();
  renderFramesUI();
  renderAll();
}

/**
 * Agrega un frame vacío o duplicado del frame activo manteniendo la estructura de capas.
 * @param {Object} [options]
 */
export function addFrame({ duplicate = false } = {}) {
  stopAnimation();
  pushState();
  syncActiveFrame();
  const prevLayerIdx = state.activeLayerIndex || 0;
  const { w, h } = getGridDims();
  const emptyLayerStructure = (state.layers || []).map((l) => {
    const base = {
      id: l.id,
      name: l.name,
      visible: l.visible,
      locked: Boolean(l.locked),
      opacity: l.opacity ?? 1,
      blendMode: l.blendMode || "source-over",
      type: l.type || "pixel",
      grid: createEmptyGrid(w, h),
      outOfBounds: [],
    };
    if (l.type === "tilemap") {
      const tw = l.tileWidth || 16;
      const th = l.tileHeight || 16;
      const cols = Math.max(1, Math.ceil(w / tw));
      const rows = Math.max(1, Math.ceil(h / th));
      base.tilesetId = l.tilesetId || null;
      base.tileWidth = tw;
      base.tileHeight = th;
      base.tileGrid = Array.from({ length: rows }, () => Array(cols).fill(0));
    }
    return base;
  });
  const newFrame = duplicate
    ? createFrame(state.layers, state.frames[state.activeFrameIndex]?.durationMs || 150)
    : createFrame(emptyLayerStructure.length ? emptyLayerStructure : null, 150);

  const insertAt = state.activeFrameIndex + 1;
  state.frames.splice(insertAt, 0, newFrame);
  adjustFrameTagsOnInsert(insertAt);
  state.activeFrameIndex = insertAt;
  state.layers = newFrame.layers;
  state.activeLayerIndex = Math.min(Math.max(0, prevLayerIdx), state.layers.length - 1);
  syncActiveLayerGrid();
  renderLayersUI();
  renderFramesUI();
  renderAll();
  setStatus({ key: duplicate ? "frames.duplicated" : "frames.created", params: { num: insertAt + 1 } });
}

/**
 * Elimina el frame activo manteniendo al menos un frame en el proyecto.
 */
export function deleteActiveFrame() {
  if (state.frames.length <= 1) {
    setStatus({ key: "log.frame_min_one" }, true);
    return;
  }
  stopAnimation();
  pushState();
  const removedIdx = state.activeFrameIndex;
  state.frames.splice(removedIdx, 1);
  adjustFrameTagsOnDelete(removedIdx);
  state.activeFrameIndex = Math.max(0, state.activeFrameIndex - 1);
  const target = state.frames[state.activeFrameIndex];
  state.layers = target.layers;
  state.activeLayerIndex = Math.min(
    Math.max(0, target.activeLayerIndex || 0),
    state.layers.length - 1,
  );
  syncActiveLayerGrid();
  renderLayersUI();
  renderFramesUI();
  renderAll();
  setStatus({ key: "frames.deleted", params: { count: state.frames.length } });
}

/**
 * Reordena el frame activo hacia la izquierda (-1) o derecha (+1).
 * @param {number} delta
 */
export function moveActiveFrame(delta) {
  const from = state.activeFrameIndex;
  const to = from + delta;
  if (to < 0 || to >= state.frames.length) return;
  stopAnimation();
  pushState();
  const [moved] = state.frames.splice(from, 1);
  state.frames.splice(to, 0, moved);
  state.activeFrameIndex = to;
  renderFramesUI();
  renderAll();
  setStatus({ key: "frames.moved", params: { num: to + 1 } });
}

/**
 * Copia las capas y duración del frame activo al portapapeles de frames.
 */
export function copyActiveFrameToClipboard() {
  syncActiveFrame();
  const frame = state.frames[state.activeFrameIndex];
  if (!frame) return;
  frameClipboard = {
    layers: cloneLayers(frame.layers),
    activeLayerIndex: frame.activeLayerIndex || 0,
    durationMs: frame.durationMs || 150,
  };
  setStatus({ key: "frames.copied", params: { num: state.activeFrameIndex + 1 } });
}

/**
 * Pega el frame copiado inmediatamente después del frame activo.
 */
export function pasteClipboardAsFrame() {
  if (!frameClipboard) return false;
  stopAnimation();
  syncActiveFrame();
  pushState();
  const newFrame = createFrame(cloneLayers(frameClipboard.layers), frameClipboard.durationMs);
  newFrame.activeLayerIndex = Math.min(
    Math.max(0, frameClipboard.activeLayerIndex || 0),
    newFrame.layers.length - 1,
  );
  const insertAt = state.activeFrameIndex + 1;
  state.frames.splice(insertAt, 0, newFrame);
  adjustFrameTagsOnInsert(insertAt);
  state.activeFrameIndex = insertAt;
  state.layers = newFrame.layers;
  state.activeLayerIndex = newFrame.activeLayerIndex;
  syncActiveLayerGrid();
  renderLayersUI();
  renderFramesUI();
  renderAll();
  setStatus({ key: "frames.pasted", params: { num: insertAt + 1 } });
  return true;
}

/**
 * Activa o desactiva la visualización translúcida del frame anterior (Onion Skin).
 */
export function toggleOnionSkin() {
  state.onionSkin = !state.onionSkin;
  const btn = document.getElementById("btnOnionSkin");
  if (btn) btn.classList.toggle("active", state.onionSkin);
  renderAll();
  setStatus({ key: state.onionSkin ? "log.onion_on" : "log.onion_off" });
}

/**
 * Configura parámetros de Onion Skin (opacidad, modo Normal / Red-Blue, frames previos y siguientes).
 * @param {"mode"|"opacity"|"prevCount"|"nextCount"} key
 * @param {string|number} value
 */
export function setOnionSkinOption(key, value) {
  if (!state.onionSkinConfig) {
    state.onionSkinConfig = { prevCount: 1, nextCount: 0, opacity: 0.3, mode: "normal" };
  }
  if (key === "mode") {
    state.onionSkinConfig.mode = value === "redblue" ? "redblue" : "normal";
    document.getElementById("onionModeNormal")?.classList.toggle("active", state.onionSkinConfig.mode === "normal");
    document.getElementById("onionModeRedBlue")?.classList.toggle("active", state.onionSkinConfig.mode === "redblue");
  } else if (key === "opacity") {
    const op = Math.max(0.1, Math.min(0.8, Number(value) || 0.3));
    state.onionSkinConfig.opacity = op;
    const label = document.getElementById("onionOpacityVal");
    if (label) label.textContent = `${Math.round(op * 100)}%`;
  } else if (key === "prevCount") {
    state.onionSkinConfig.prevCount = Math.max(0, Math.min(3, Math.round(Number(value) || 0)));
  } else if (key === "nextCount") {
    state.onionSkinConfig.nextCount = Math.max(0, Math.min(2, Math.round(Number(value) || 0)));
  }
  if (!state.onionSkin) {
    state.onionSkin = true;
    document.getElementById("btnOnionSkin")?.classList.add("active");
  }
  renderAll();
}

/**
 * Detiene la reproducción de la animación por frames.
 */
export function stopAnimation() {
  if (playTimer !== null) {
    clearTimeout(playTimer);
    playTimer = null;
  }
  state.isPlaying = false;
  const btn = document.getElementById("btnPlayAnim");
  if (btn) {
    btn.classList.remove("active");
    btn.innerHTML = `<i data-lucide="play" class="ui-icon-sm"></i><span>Play</span>`;
    refreshIcons(btn);
  }
}

/**
 * Alterna entre reproducir y detener la animación de frames según el FPS.
 */
export function togglePlayAnimation() {
  if (state.isPlaying) {
    stopAnimation();
    renderAll();
    return;
  }
  if (state.frames.length <= 1) {
    setStatus({ key: "log.play_min_two" }, true);
    return;
  }
  state.isPlaying = true;
  const btn = document.getElementById("btnPlayAnim");
  if (btn) {
    btn.classList.add("active");
    btn.innerHTML = `<i data-lucide="square" class="ui-icon-sm"></i><span>Stop</span>`;
    refreshIcons(btn);
  }

  const step = () => {
    if (!state.isPlaying) return;
    const tag = state.activeTagId
      ? (state.frameTags || []).find((t) => t.id === state.activeTagId)
      : null;
    const minIdx = tag ? Math.max(0, tag.from) : 0;
    const maxIdx = tag ? Math.min(state.frames.length - 1, tag.to) : state.frames.length - 1;
    let nextIdx = state.activeFrameIndex + 1;
    if (nextIdx > maxIdx || nextIdx < minIdx) nextIdx = minIdx;
    selectFrame(nextIdx);
    const fpsInput = document.getElementById("animFpsInput");
    const fps = Math.max(1, Math.min(60, Number(fpsInput?.value || 8)));
    playTimer = setTimeout(step, Math.round(1000 / fps));
  };
  step();
}

/** Detiene la animación y salta al primer fotograma. */
export function goToFirstFrame() {
  stopAnimation();
  selectFrame(0);
}

/** Detiene la animación y retrocede al fotograma anterior. */
export function goToPrevFrame() {
  stopAnimation();
  if (state.frames.length === 0) return;
  selectFrame((state.activeFrameIndex - 1 + state.frames.length) % state.frames.length);
}

/** Detiene la animación y avanza al siguiente fotograma. */
export function goToNextFrame() {
  stopAnimation();
  if (state.frames.length === 0) return;
  selectFrame((state.activeFrameIndex + 1) % state.frames.length);
}

/** Detiene la animación y salta al último fotograma. */
export function goToLastFrame() {
  stopAnimation();
  selectFrame(Math.max(0, state.frames.length - 1));
}


subscribe("frames:syncActive", () => syncActiveFrame());

function hideFrameContextMenu() {
  const menu = document.getElementById("frameContextMenu");
  if (menu) menu.classList.remove("open");
}

function ensureFrameContextMenuListeners() {
  if (frameContextMenuInitialized) return;
  frameContextMenuInitialized = true;
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("frameContextMenu");
    if (menu && !menu.contains(e.target)) hideFrameContextMenu();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideFrameContextMenu();
  });
}

/** Abre el menú contextual para un fotograma o rango. */
export function openFrameContextMenu(e, frameIndex, frameRange = null) {
  e.preventDefault();
  e.stopPropagation();
  ensureFrameContextMenuListeners();

  stopAnimation();
  if (frameIndex !== state.activeFrameIndex) {
    selectFrame(frameIndex);
  }

  const menu = document.getElementById("frameContextMenu");
  if (!menu) return;

  const matrixRange = getSelectedFrameRange();
  const activeRange =
    frameRange && frameIndex >= frameRange.from && frameIndex <= frameRange.to
      ? frameRange
      : matrixRange && frameIndex >= matrixRange.from && frameIndex <= matrixRange.to
        ? matrixRange
        : null;
  const tagFrom = activeRange ? activeRange.from : frameIndex;
  const tagTo = activeRange ? activeRange.to : frameIndex;
  const isMulti = tagTo > tagFrom;

  const addItem = (iconName, label, onClick, disabled = false) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ctx-item";
    btn.innerHTML = iconName
      ? `<i data-lucide="${iconName}" class="ui-icon-sm"></i><span></span>`
      : `<span></span>`;
    btn.querySelector("span").textContent = label;
    btn.disabled = disabled;
    btn.onclick = () => {
      hideFrameContextMenu();
      onClick();
    };
    menu.appendChild(btn);
  };

  const addDivider = () => {
    const hr = document.createElement("div");
    hr.className = "ctx-divider";
    menu.appendChild(hr);
  };

  menu.innerHTML = `<div class="ctx-header">${isMulti ? `Frames F${tagFrom + 1}–F${tagTo + 1}` : `Frame F${frameIndex + 1}`}</div>`;
  addItem(
    "tag",
    isMulti ? i18n.t("frames.create_tag_range", { from: tagFrom + 1, to: tagTo + 1 }) : i18n.t("frames.create_tag_single", { f: frameIndex + 1 }),
    () => notify("tags:openDialog", { from: tagFrom, to: tagTo }),
  );
  addDivider();
  addItem("plus", i18n.t("frames.new_frame"), () => addFrame({ duplicate: false }));
  addItem("copy-plus", i18n.t("frames.dup_frame"), () => addFrame({ duplicate: true }));
  addItem("copy", i18n.t("frames.copy_frame"), () => copyActiveFrameToClipboard());
  addItem("clipboard-paste", i18n.t("frames.paste_frame"), () => pasteClipboardAsFrame(), !frameClipboard);
  addDivider();
  addItem("arrow-left", i18n.t("frames.move_left"), () => moveActiveFrame(-1), frameIndex <= 0);
  addItem("arrow-right", i18n.t("frames.move_right"), () => moveActiveFrame(1), frameIndex >= state.frames.length - 1);
  addDivider();
  addItem("trash-2", i18n.t("frames.del_frame"), () => deleteActiveFrame(), state.frames.length <= 1);

  menu.classList.add("open");
  refreshIcons(menu);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mw = menu.offsetWidth || 190;
  const mh = menu.offsetHeight || 240;
  menu.style.left = `${Math.min(e.clientX, vw - mw - 8)}px`;
  menu.style.top = `${Math.min(e.clientY, vh - mh - 8)}px`;
}

/**
 * Renderiza las píldoras de frames en la barra de línea de tiempo.
 */
export function renderFramesUI() {
  const list = document.getElementById("frames-list");
  if (!list) return;
  if (!list.dataset.wheelBound) {
    list.dataset.wheelBound = "1";
    list.addEventListener("wheel", (e) => {
      if (list.scrollWidth <= list.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        list.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }
  list.innerHTML = "";

  let activeBtn = null;
  state.frames.forEach((frame, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const isActive = idx === state.activeFrameIndex;
    btn.className = "frame-pill" + (isActive ? " active" : "");
    btn.textContent = frame.name ? `F${idx + 1} · ${frame.name}` : `F${idx + 1}`;
    btn.title = i18n.t("frames.tooltip", { name: frame.name || `Frame ${idx + 1}` });
    if (frame.color) {
      btn.style.borderBottom = `2px solid ${frame.color}`;
    }
    btn.onclick = () => {
      stopAnimation();
      selectFrame(idx);
    };
    btn.oncontextmenu = (e) => openFrameContextMenu(e, idx);
    list.appendChild(btn);
    if (isActive) activeBtn = btn;
  });
  activeBtn?.scrollIntoView({ block: "nearest", inline: "nearest" });
  notify("frames:rendered");
}

