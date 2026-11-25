/**
 * timelineMatrix.js: Vista expandida del Timeline estilo Matriz (Capas × Frames)
 * con resizer, drag & drop de frames/cels y barra de Frame Tags.
 */

import {
  state,
  pushState,
  subscribe,
  syncLinkedCelsForActiveLayer,
  getSelectedFrameRange,
  setSelectedFrameRange,
} from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { setStatus, refreshIcons } from "../ui/status.js";
import { addFrame, selectFrame, renderFramesUI, openFrameContextMenu } from "./frames.js";
import { renderLayersUI, syncActiveLayerGrid, toggleLayerVisibility, toggleLayerLock, startInlineRename } from "./layers.js";
import {
  createFrameTagDialog,
  closeTagModal,
  confirmCreateFrameTag,
  deleteFrameTag,
  renameActiveTagInline,
  toggleSelectFrameTag,
  linkCelWithPrevious,
  unlinkCelAt,
} from "./timelineTagsAndCels.js";
import { renderTimelineTagsRow } from "./timelineMatrixTagsView.js";
import { createMatrixCelElement } from "./timelineMatrixCelOps.js";
import { i18n } from "../i18n/I18nService.js";

if (typeof window !== "undefined") {
  i18n.addEventListener("langchange", () => renderTimelineMatrixUI());
}

export {
  syncLinkedCelsForActiveLayer,
  getSelectedFrameRange,
  createFrameTagDialog,
  closeTagModal,
  confirmCreateFrameTag,
  deleteFrameTag,
  renameActiveTagInline,
  toggleSelectFrameTag,
  linkCelWithPrevious,
  unlinkCelAt,
};

subscribe("layers:rendered", () => renderTimelineMatrixUI());
subscribe("frames:rendered", () => renderTimelineMatrixUI());
subscribe("timeline:render", () => renderTimelineMatrixUI());
subscribe("tags:openDialog", (payload) => {
  if (payload && typeof payload.from === "number") createFrameTagDialog(payload.from, payload.to);
  else createFrameTagDialog();
});

const DEFAULT_FRAME_COL_WIDTH = 42;
let activeColResize = null;
let isExpanded = false;
const dragCelState = { current: null };
let dragFrameIndex = null;
let frameAnchorIndex = 0;
let layerColWidth = 182;

function getFrameColWidth(frameObj) {
  const w = Number(frameObj?.colWidth);
  return Number.isFinite(w) && w >= 26 ? Math.min(200, w) : DEFAULT_FRAME_COL_WIDTH;
}

/**
 * Expande o contrae el panel matricial de Capas × Frames y Tags en el timeline.
 */
export function toggleTimelineExpanded() {
  isExpanded = !isExpanded;
  const wrap = document.getElementById("timelineMatrixWrap");
  const btn = document.getElementById("btnToggleTimelineExpand");
  if (wrap) wrap.style.display = isExpanded ? "flex" : "none";
  if (btn) {
    btn.classList.toggle("active", isExpanded);
    btn.title = isExpanded ? "Contraer matriz de Timeline" : "Expandir matriz Capas × Frames y Tags";
  }
  if (isExpanded) renderTimelineMatrixUI();
}

function startInlineFrameRename(headBtn, frameIndex) {
  const fObj = state.frames[frameIndex];
  if (!fObj) return;
  const input = document.createElement("input");
  input.type = "text";
  input.value = fObj.name || `F${frameIndex + 1}`;
  input.className = "tm-frame-rename-input";
  const commit = () => {
    const val = input.value.trim();
    fObj.name = val === `F${frameIndex + 1}` ? "" : val;
    renderFramesUI();
    renderTimelineMatrixUI();
  };
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") renderTimelineMatrixUI();
  });
  headBtn.replaceWith(input);
  input.focus();
  input.select();
}

/**
 * Inicializa el redimensionador vertical de la matriz de timeline y el ajuste de columnas.
 */
export function setupTimelineResizer() {
  const resizer = document.getElementById("timelineResizer");
  const wrap = document.getElementById("timelineMatrixWrap");
  if (!resizer || !wrap) return;

  let dragging = false, startY = 0, startH = 0, openedOnDrag = false;
  resizer.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    openedOnDrag = !isExpanded;
    if (openedOnDrag) {
      toggleTimelineExpanded();
      wrap.style.height = "0px";
      startH = 0;
    } else {
      startH = wrap.getBoundingClientRect().height || 190;
    }
    dragging = true;
    startY = e.clientY;
    resizer.classList.add("dragging");
  });
  window.addEventListener("mousemove", (e) => {
    if (activeColResize) {
      const dx = e.clientX - activeColResize.startX;
      if (activeColResize.type === "layer") {
        layerColWidth = Math.max(120, Math.min(340, Math.round(activeColResize.startW + dx)));
      } else if (activeColResize.type === "frame" && state.frames[activeColResize.frameIndex]) {
        state.frames[activeColResize.frameIndex].colWidth = Math.max(28, Math.min(200, Math.round(activeColResize.startW + dx)));
      }
      renderTimelineMatrixUI();
      return;
    }
    if (!dragging) return;
    const maxH = Math.round(window.innerHeight * 0.75);
    const isTop = Boolean(document.getElementById("moduleFrames")?.classList.contains("module-docked-top"));
    const deltaY = isTop ? (e.clientY - startY) : (startY - e.clientY);
    const minH = openedOnDrag ? 0 : 110;
    wrap.style.height = `${Math.max(minH, Math.min(maxH, Math.round(startH + deltaY)))}px`;
  });
  window.addEventListener("mouseup", (e) => {
    activeColResize = null;
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove("dragging");
    if (openedOnDrag) {
      openedOnDrag = false;
      const moved = Math.abs(e.clientY - startY);
      const currentH = wrap.getBoundingClientRect().height;
      if (moved < 5) {
        wrap.style.height = "";
      } else if (currentH < 48) {
        wrap.style.height = "";
        if (isExpanded) toggleTimelineExpanded();
      }
    }
  });
}

function createCornerHeader() {
  const corner = document.createElement("div");
  corner.className = "tm-corner-cell";
  corner.textContent = i18n.t("matrix.corner_label");
  const handle = document.createElement("span");
  handle.className = "tm-col-resizer";
  handle.title = i18n.t("matrix.resize_layers_title");
  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    activeColResize = { type: "layer", startX: e.clientX, startW: layerColWidth };
  });
  corner.appendChild(handle);
  return corner;
}

function createFrameHeaderCell(f, frameCount) {
  const fObj = state.frames[f];
  const range = getSelectedFrameRange();
  const inRange = Boolean(range && f >= range.from && f <= range.to);
  const head = document.createElement("div");
  head.className = `tm-frame-head${f === state.activeFrameIndex ? " active" : ""}${inRange ? " in-range" : ""}`;
  head.draggable = frameCount > 1;
  head.title = i18n.t("matrix.frame_head_title", { name: fObj.name || `Frame ${f + 1}` });
  if (fObj.color) head.style.borderBottom = `2px solid ${fObj.color}`;

  const label = document.createElement("span");
  label.className = "tm-frame-head-label";
  label.textContent = fObj.name ? `${f + 1}:${fObj.name}` : `${f + 1}`;
  head.appendChild(label);

  const colHandle = document.createElement("span");
  colHandle.className = "tm-col-resizer";
  colHandle.title = i18n.t("matrix.resize_frame_title");
  colHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    activeColResize = { type: "frame", frameIndex: f, startX: e.clientX, startW: getFrameColWidth(fObj) };
  });
  head.appendChild(colHandle);

  head.addEventListener("click", (e) => {
    if (e.target === colHandle) return;
    if (e.shiftKey) {
      const anchor = Math.max(0, Math.min(frameCount - 1, frameAnchorIndex));
      setSelectedFrameRange({ from: Math.min(anchor, f), to: Math.max(anchor, f) });
      selectFrame(f);
      setStatus({ key: "log.range_selected", params: { from: getSelectedFrameRange().from + 1, to: getSelectedFrameRange().to + 1 } });
      renderTimelineMatrixUI();
      return;
    }
    frameAnchorIndex = f;
    setSelectedFrameRange({ from: f, to: f });
    selectFrame(f);
    renderTimelineMatrixUI();
  });
  head.addEventListener("dblclick", (e) => {
    if (e.target !== colHandle) { e.stopPropagation(); startInlineFrameRename(head, f); }
  });
  head.addEventListener("contextmenu", (e) => {
    if (e.target === colHandle) return;
    e.preventDefault();
    e.stopPropagation();
    const r = getSelectedFrameRange();
    if (!r || f < r.from || f > r.to) {
      frameAnchorIndex = f;
      setSelectedFrameRange({ from: f, to: f });
      selectFrame(f);
      renderTimelineMatrixUI();
    }
    openFrameContextMenu(e, f, getSelectedFrameRange());
  });
  head.addEventListener("dragstart", () => { dragFrameIndex = f; });
  head.addEventListener("dragover", (e) => e.preventDefault());
  head.addEventListener("drop", (e) => {
    e.preventDefault();
    if (dragFrameIndex === null || dragFrameIndex === f) { dragFrameIndex = null; return; }
    pushState();
    const [moved] = state.frames.splice(dragFrameIndex, 1);
    state.frames.splice(f, 0, moved);
    state.activeFrameIndex = f;
    syncActiveLayerGrid();
    dragFrameIndex = null;
    renderAll();
    renderFramesUI();
    renderTimelineMatrixUI();
    setStatus({ key: "log.frame_moved", params: { pos: f + 1 } });
  });
  return head;
}

function createLayerRowLabel(l) {
  const meta = state.layers[l];
  const rowLabel = document.createElement("div");
  rowLabel.className = `tm-layer-label${l === state.activeLayerIndex ? " active" : ""}`;

  const mkIconBtn = (icon, opacity, title, onClick) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tm-row-icon-btn";
    btn.innerHTML = `<i data-lucide="${icon}" class="ui-icon-sm"></i>`;
    btn.style.opacity = opacity;
    btn.title = title;
    btn.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
    return btn;
  };

  const curLinked = Boolean(state.frames[state.activeFrameIndex]?.layers?.[l]?.celGroupId);
  const eyeBtn = mkIconBtn(meta.visible ? "eye" : "eye-off", meta.visible ? "1" : "0.4", i18n.t("matrix.toggle_layer_title"), () => { toggleLayerVisibility(l); renderTimelineMatrixUI(); });
  const lockBtn = mkIconBtn(meta.locked ? "lock" : "unlock", meta.locked ? "1" : "0.45", "Bloquear / Desbloquear capa", () => { toggleLayerLock(l); renderTimelineMatrixUI(); });
  const linkBtn = mkIconBtn("link", curLinked ? "1" : "0.45", curLinked ? "Desenlazar cel activo" : "Enlazar cel activo con frame anterior", () => {
    if (curLinked) unlinkCelAt(state.activeFrameIndex, l);
    else linkCelWithPrevious(state.activeFrameIndex, l);
  });

  const nameSpan = document.createElement("span");
  nameSpan.className = "tm-layer-name";
  nameSpan.textContent = meta.name || i18n.t("default.layer_name", { n: l + 1 });
  nameSpan.title = "Doble clic o F2 para renombrar capa";
  nameSpan.addEventListener("dblclick", (e) => { e.stopPropagation(); startInlineRename(nameSpan, l); });

  rowLabel.append(eyeBtn, lockBtn, linkBtn, nameSpan);
  if (meta.type === "tilemap") {
    const tmBadge = document.createElement("span");
    tmBadge.className = "layer-tilemap-badge";
    tmBadge.textContent = "TM";
    tmBadge.title = `Capa Tilemap (${meta.tileWidth || 16}×${meta.tileHeight || 16}px)`;
    rowLabel.appendChild(tmBadge);
  }
  rowLabel.addEventListener("click", () => {
    state.activeLayerIndex = l;
    syncActiveLayerGrid();
    renderLayersUI();
    renderTimelineMatrixUI();
  });
  return rowLabel;
}

/**
 * Renderiza la matriz completa de Capas × Frames y la fila superior de Frame Tags.
 */
export function renderTimelineMatrixUI() {
  if (!isExpanded) return;
  const matrixGrid = document.getElementById("timelineMatrixGrid");
  if (!matrixGrid) return;

  const frameCount = state.frames.length;
  const layerCount = state.layers?.length || 0;
  const frameColsTemplate = state.frames.map((fObj) => `${getFrameColWidth(fObj)}px`).join(" ");

  renderTimelineTagsRow(document.getElementById("timelineTagsRow"), frameCount, layerColWidth, frameColsTemplate, renderTimelineMatrixUI);

  matrixGrid.innerHTML = "";
  matrixGrid.style.gridTemplateColumns = `${layerColWidth}px ${frameColsTemplate} 28px`;
  matrixGrid.appendChild(createCornerHeader());
  for (let f = 0; f < frameCount; f++) matrixGrid.appendChild(createFrameHeaderCell(f, frameCount));

  const addFrameBtn = document.createElement("button");
  addFrameBtn.type = "button";
  addFrameBtn.className = "tm-frame-head";
  addFrameBtn.textContent = "+";
  addFrameBtn.title = i18n.t("matrix.add_frame_title");
  addFrameBtn.style.fontWeight = "700";
  addFrameBtn.addEventListener("click", () => addFrame({ duplicate: false }));
  matrixGrid.appendChild(addFrameBtn);

  for (let l = layerCount - 1; l >= 0; l--) {
    matrixGrid.appendChild(createLayerRowLabel(l));
    for (let f = 0; f < frameCount; f++) {
      matrixGrid.appendChild(createMatrixCelElement(f, l, frameCount, dragCelState, renderTimelineMatrixUI));
    }
    const rowTail = document.createElement("div");
    rowTail.style.height = "26px";
    matrixGrid.appendChild(rowTail);
  }
  refreshIcons(matrixGrid);
}
