/**
 * timelineTagsAndCels.js: Gestión de Frame Tags, selección múltiple de cels y menú contextual de cels.
 */

import {
  state,
  pushState,
  cloneGrid,
  createEmptyGrid,
  getGridDims,
  notify,
  getSelectedFrameRange,
  setSelectedFrameRange,
} from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { setStatus, refreshIcons } from "../ui/status.js";
import { selectFrame, syncActiveFrame, renderFramesUI, addFrame } from "./frames.js";
import { renderLayersUI, syncActiveLayerGrid } from "./layers.js";
import { reconcileLayerTilemap } from "./tilemap.js";

let celClipboard = null;
let celContextTarget = null;
let celMenuBound = false;
export const selectedCels = new Set();
let celAnchor = null;

/**
 * Devuelve el ancla actual de selección rectangular de cels.
 * @returns {{layerIdx: number, frameIdx: number}|null}
 */
export function getCelAnchor() {
  return celAnchor;
}

/**
 * Actualiza el ancla de selección rectangular de cels.
 * @param {{layerIdx: number, frameIdx: number}|null} next
 */
export function setCelAnchor(next) {
  celAnchor = next;
}

/**
 * Genera la clave única `"layerIdx:frameIdx"` para identificar una celda en el Set de selección.
 * @param {number} layerIdx
 * @param {number} frameIdx
 * @returns {string}
 */
export function celKey(layerIdx, frameIdx) {
  return `${layerIdx}:${frameIdx}`;
}

/**
 * Devuelve la lista ordenada de celdas `(layerIdx, frameIdx)` actualmente seleccionadas.
 * @returns {Array<{layerIdx: number, frameIdx: number}>}
 */
export function getSelectedCelsList() {
  const frameCount = state.frames?.length || 0;
  const maxLayers = Math.max(
    state.layers?.length || 0,
    ...(state.frames || []).map((fr) => fr.layers?.length || 0),
  );
  const out = [];
  for (const key of selectedCels) {
    const [lStr, fStr] = key.split(":");
    const layerIdx = Number(lStr);
    const frameIdx = Number(fStr);
    if (
      Number.isInteger(layerIdx) &&
      Number.isInteger(frameIdx) &&
      layerIdx >= 0 &&
      layerIdx < maxLayers &&
      frameIdx >= 0 &&
      frameIdx < frameCount
    ) {
      out.push({ layerIdx, frameIdx });
    }
  }
  return out;
}

/**
 * Selecciona una única celda y actualiza el ancla de selección.
 * @param {number} layerIdx
 * @param {number} frameIdx
 */
export function selectSingleCel(layerIdx, frameIdx) {
  selectedCels.clear();
  selectedCels.add(celKey(layerIdx, frameIdx));
  celAnchor = { layerIdx, frameIdx };
}

/**
 * Selecciona un rectángulo continuo de celdas entre `(l0, f0)` y `(l1, f1)`.
 * @param {number} l0
 * @param {number} f0
 * @param {number} l1
 * @param {number} f1
 */
export function selectCelRect(l0, f0, l1, f1) {
  selectedCels.clear();
  const minL = Math.min(l0, l1);
  const maxL = Math.max(l0, l1);
  const minF = Math.min(f0, f1);
  const maxF = Math.max(f0, f1);
  for (let l = minL; l <= maxL; l++) {
    for (let f = minF; f <= maxF; f++) {
      selectedCels.add(celKey(l, f));
    }
  }
}
/**
 * Abre el modal para crear un Frame Tag sobre el rango especificado o seleccionado.
 * @param {number|null} [fromOverride=null]
 * @param {number|null} [toOverride=null]
 */
export function createFrameTagDialog(fromOverride = null, toOverride = null) {
  const modal = document.getElementById("tagModal");
  if (!modal) return;
  const count = state.frames.length;
  const hasOverride = typeof fromOverride === "number" && Number.isFinite(fromOverride);
  const rawFrom = hasOverride
    ? fromOverride
    : getSelectedFrameRange()
      ? getSelectedFrameRange().from
      : state.activeFrameIndex;
  const rawTo = hasOverride
    ? (typeof toOverride === "number" && Number.isFinite(toOverride) ? toOverride : rawFrom)
    : getSelectedFrameRange()
      ? getSelectedFrameRange().to
      : rawFrom;
  const from = Math.max(0, Math.min(count - 1, Math.min(rawFrom, rawTo)));
  const to = Math.max(from, Math.min(count - 1, Math.max(rawFrom, rawTo)));

  const fromEl = document.getElementById("tagFromInput");
  const toEl = document.getElementById("tagToInput");
  const nameEl = document.getElementById("tagNameInput");
  const colorEl = document.getElementById("tagColorInput");

  if (fromEl) {
    fromEl.max = String(count);
    fromEl.value = String(from + 1);
  }
  if (toEl) {
    toEl.max = String(count);
    toEl.value = String(to + 1);
  }
  const palette = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#d97706", "#0891b2"];
  if (colorEl) colorEl.value = palette[(state.frameTags?.length || 0) % palette.length];
  if (nameEl) nameEl.value = "";

  modal.classList.add("open");
  nameEl?.focus();
}

/**
 * Cierra el modal de creación de Frame Tags.
 */
export function closeTagModal() {
  document.getElementById("tagModal")?.classList.remove("open");
}

/**
 * Valida y registra un nuevo Frame Tag desde los valores del modal.
 */
export function confirmCreateFrameTag() {
  const count = state.frames.length;
  const name = (document.getElementById("tagNameInput")?.value || "").trim();
  if (!name) {
    setStatus({ key: "log.tag_name_req" }, true);
    return;
  }
  const rawFrom = Number(document.getElementById("tagFromInput")?.value || 1) - 1;
  const rawTo = Number(document.getElementById("tagToInput")?.value || rawFrom + 1) - 1;
  const from = Math.max(0, Math.min(count - 1, rawFrom));
  const to = Math.max(from, Math.min(count - 1, rawTo));
  const color = document.getElementById("tagColorInput")?.value || "#2563eb";

  if (!Array.isArray(state.frameTags)) state.frameTags = [];
  state.frameTags.push({
    id: `tag_${Date.now()}`,
    name: name.slice(0, 20),
    color,
    from,
    to,
  });
  setSelectedFrameRange(null);
  closeTagModal();
  notify("timeline:render");
  setStatus({ key: "log.tag_created", params: { name, from: from + 1, to: to + 1 } });
}

/**
 * Elimina un Frame Tag por ID y re-renderiza la matriz del timeline.
 * @param {string} tagId
 */
export function deleteFrameTag(tagId) {
  state.frameTags = (state.frameTags || []).filter((t) => t.id !== tagId);
  if (state.activeTagId === tagId) state.activeTagId = null;
  notify("timeline:render");
}

/**
 * Inicia el renombrado inline de un chip de Frame Tag en la barra superior del timeline.
 * @param {HTMLElement} chipEl
 * @param {string} tagId
 */
export function startInlineTagRename(chipEl, tagId) {
  const tag = (state.frameTags || []).find((t) => t.id === tagId);
  if (!tag || !chipEl) return;
  const input = document.createElement("input");
  input.type = "text";
  input.value = tag.name;
  input.maxLength = 20;
  input.className = "tm-frame-rename-input";
  input.style.gridColumn = chipEl.style.gridColumn;
  input.style.width = "100%";
  input.style.height = "20px";

  const commit = () => {
    const val = input.value.trim();
    if (val && val !== tag.name) {
      tag.name = val;
      setStatus({ key: "log.tag_renamed", params: { name: val } });
    }
    notify("timeline:render");
  };

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") notify("timeline:render");
  });

  chipEl.replaceWith(input);
  input.focus();
  input.select();
}

/**
 * Inicia el renombrado inline del Frame Tag activo en la barra superior de tags.
 * @returns {boolean} True si se encontró el chip y se abrió el editor inline.
 */
export function renameActiveTagInline() {
  let tagId = state.activeTagId;
  if (!tagId && Array.isArray(state.frameTags) && state.frameTags.length > 0) {
    const fIdx = state.activeFrameIndex || 0;
    const match =
      state.frameTags.find((t) => fIdx >= t.from && fIdx <= t.to) ||
      state.frameTags[0];
    if (match) {
      tagId = match.id;
      state.activeTagId = tagId;
    }
  }
  if (!tagId) return false;
  const chip = document.querySelector(`#timelineTagsRow .tm-tag-chip[data-tag-id="${tagId}"]`);
  if (!chip) return false;
  startInlineTagRename(chip, tagId);
  return true;
}

/**
 * Selecciona o deselecciona un Frame Tag para restringir el loop de reproducción.
 * @param {string} tagId
 */
export function toggleSelectFrameTag(tagId) {
  state.activeTagId = state.activeTagId === tagId ? null : tagId;
  const tag = (state.frameTags || []).find((t) => t.id === state.activeTagId);
  if (tag) {
    selectFrame(tag.from);
    setStatus({ key: "log.loop_tag", params: { name: tag.name, from: tag.from + 1, to: tag.to + 1 } });
  } else {
    setStatus({ key: "log.loop_all" });
  }
  notify("timeline:render");
}

/**
 * Enlaza la celda `(frameIdx, layerIdx)` con la del fotograma anterior compartiendo `celGroupId`.
 * @param {number} frameIdx
 * @param {number} layerIdx
 */
export function linkCelWithPrevious(frameIdx, layerIdx) {
  if (frameIdx <= 0) {
    setStatus({ key: "log.cel_link_first" }, true);
    return;
  }
  syncActiveFrame();
  pushState();
  const prevLayer = state.frames[frameIdx - 1]?.layers?.[layerIdx];
  const curLayer = state.frames[frameIdx]?.layers?.[layerIdx];
  if (!prevLayer || !curLayer) return;

  const groupId = prevLayer.celGroupId || `cel_${Date.now()}_${layerIdx}`;
  prevLayer.celGroupId = groupId;
  curLayer.celGroupId = groupId;
  curLayer.grid = cloneGrid(prevLayer.grid);
  curLayer.outOfBounds = Array.isArray(prevLayer.outOfBounds)
    ? prevLayer.outOfBounds.map((p) => [...p])
    : [];

  if (frameIdx === state.activeFrameIndex) {
    syncActiveLayerGrid();
  }
  renderAll();
  notify("timeline:render");
  setStatus({ key: "log.cel_linked", params: { a: frameIdx, b: frameIdx + 1 } });
}

/**
 * Desenlaza una celda de su grupo compartido (`celGroupId`) para convertirla en independiente.
 * @param {number} frameIdx
 * @param {number} layerIdx
 */
export function unlinkCelAt(frameIdx, layerIdx) {
  const curLayer = state.frames[frameIdx]?.layers?.[layerIdx];
  if (!curLayer?.celGroupId) return;
  pushState();
  delete curLayer.celGroupId;
  notify("timeline:render");
  setStatus({ key: "log.cel_unlinked", params: { f: frameIdx + 1 } });
}

function handleCelAction(action) {
  if (!celContextTarget) return;
  const { frameIdx, layerIdx } = celContextTarget;
  const targetLayer = state.frames[frameIdx]?.layers?.[layerIdx];
  if (!targetLayer) return;

  const batch = getSelectedCelsList();
  const hasMulti = batch.length > 1 && selectedCels.has(celKey(layerIdx, frameIdx));

  if (action === "linkPrev") {
    if (hasMulti) {
      syncActiveFrame();
      pushState();
      const byLayer = new Map();
      for (const item of batch) {
        if (!byLayer.has(item.layerIdx)) byLayer.set(item.layerIdx, []);
        byLayer.get(item.layerIdx).push(item.frameIdx);
      }
      for (const [lIdx, fList] of byLayer.entries()) {
        fList.sort((a, b) => a - b);
        const baseLayer = state.frames[fList[0]]?.layers?.[lIdx];
        if (!baseLayer) continue;
        const gid = baseLayer.celGroupId || `cel_${Date.now()}_${lIdx}`;
        for (const fIdx of fList) {
          const dst = state.frames[fIdx]?.layers?.[lIdx];
          if (!dst) continue;
          dst.celGroupId = gid;
          dst.grid = cloneGrid(baseLayer.grid);
          dst.outOfBounds = Array.isArray(baseLayer.outOfBounds)
            ? baseLayer.outOfBounds.map((p) => [...p])
            : [];
        }
      }
      syncActiveLayerGrid();
      renderAll();
      notify("timeline:render");
      setStatus({ key: "log.cels_linked_batch", params: { count: batch.length } });
      return;
    }
    linkCelWithPrevious(frameIdx, layerIdx);
  } else if (action === "unlink") {
    if (hasMulti) {
      pushState();
      for (const { layerIdx: l, frameIdx: f } of batch) {
        const cur = state.frames[f]?.layers?.[l];
        if (cur?.celGroupId) delete cur.celGroupId;
      }
      notify("timeline:render");
      setStatus({ key: "log.cels_unlinked_batch", params: { count: batch.length } });
      return;
    }
    unlinkCelAt(frameIdx, layerIdx);
  } else if (action === "copy") {
    syncActiveFrame();
    if (hasMulti) {
      const minL = Math.min(...batch.map((c) => c.layerIdx));
      const minF = Math.min(...batch.map((c) => c.frameIdx));
      const items = [];
      for (const { layerIdx: l, frameIdx: f } of batch) {
        const lObj = state.frames[f]?.layers?.[l];
        if (!lObj) continue;
        items.push({
          dl: l - minL,
          df: f - minF,
          grid: cloneGrid(lObj.grid),
          outOfBounds: Array.isArray(lObj.outOfBounds) ? lObj.outOfBounds.map((p) => [...p]) : [],
        });
      }
      celClipboard = { isBatch: true, items };
      setStatus({ key: "log.cels_copied_clip", params: { count: items.length } });
      return;
    }
    celClipboard = {
      isBatch: false,
      grid: cloneGrid(targetLayer.grid),
      outOfBounds: Array.isArray(targetLayer.outOfBounds)
        ? targetLayer.outOfBounds.map((p) => [...p])
        : [],
    };
    setStatus({ key: "log.cel_copied_clip" });
  } else if (action === "paste") {
    if (!celClipboard) return;
    pushState();
    if (celClipboard.isBatch && Array.isArray(celClipboard.items)) {
      let pasted = 0;
      for (const item of celClipboard.items) {
        const dstF = frameIdx + item.df;
        const dstL = layerIdx + item.dl;
        const dst = state.frames[dstF]?.layers?.[dstL];
        if (!dst) continue;
        delete dst.celGroupId;
        dst.grid = cloneGrid(item.grid);
        dst.outOfBounds = item.outOfBounds.map((p) => [...p]);
        if (dst.type === "tilemap") reconcileLayerTilemap(dst, "auto");
        pasted++;
      }
      syncActiveLayerGrid();
      renderAll();
      notify("timeline:render");
      setStatus({ key: "log.cels_pasted", params: { count: pasted } }, false, "pixel");
      return;
    }
    delete targetLayer.celGroupId;
    targetLayer.grid = cloneGrid(celClipboard.grid);
    targetLayer.outOfBounds = celClipboard.outOfBounds.map((p) => [...p]);
    if (targetLayer.type === "tilemap") reconcileLayerTilemap(targetLayer, "auto");
    if (frameIdx === state.activeFrameIndex) syncActiveLayerGrid();
    renderAll();
    notify("timeline:render");
    setStatus({ key: "log.cel_pasted" }, false, "pixel");
  } else if (action === "clear") {
    pushState();
    const { w, h } = getGridDims();
    if (hasMulti) {
      for (const { layerIdx: l, frameIdx: f } of batch) {
        const dst = state.frames[f]?.layers?.[l];
        if (!dst) continue;
        delete dst.celGroupId;
        dst.grid = createEmptyGrid(w, h);
        dst.outOfBounds = [];
        if (dst.type === "tilemap") reconcileLayerTilemap(dst, "auto");
      }
      syncActiveLayerGrid();
      renderAll();
      notify("timeline:render");
      setStatus({ key: "log.cels_cleared", params: { count: batch.length } }, false, "pixel");
      return;
    }
    delete targetLayer.celGroupId;
    targetLayer.grid = createEmptyGrid(w, h);
    targetLayer.outOfBounds = [];
    if (targetLayer.type === "tilemap") reconcileLayerTilemap(targetLayer, "auto");
    if (frameIdx === state.activeFrameIndex) syncActiveLayerGrid();
    renderAll();
    notify("timeline:render");
    setStatus({ key: "log.cel_cleared" }, false, "pixel");
  } else if (action === "createTag") {
    const frames = hasMulti ? batch.map((c) => c.frameIdx) : [frameIdx];
    const minF = Math.min(...frames);
    const maxF = Math.max(...frames);
    setSelectedFrameRange({ from: minF, to: maxF });
    createFrameTagDialog(minF, maxF);
  }
}

function ensureCelContextMenu() {
  if (celMenuBound) return;
  const menu = document.getElementById("celContextMenu");
  if (!menu) return;
  celMenuBound = true;

  menu.querySelectorAll("[data-cel-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      menu.classList.remove("open");
      handleCelAction(btn.getAttribute("data-cel-action"));
    });
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) menu.classList.remove("open");
  });
}

/**
 * Abre el menú contextual de celda (Crear, Copiar, Pegar, Enlazar, Vaciar) en `(clientX, clientY)`.
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} frameIdx
 * @param {number} layerIdx
 */
export function openCelContextMenu(clientX, clientY, frameIdx, layerIdx) {
  ensureCelContextMenu();
  const menu = document.getElementById("celContextMenu");
  if (!menu) return;
  celContextTarget = { frameIdx, layerIdx };
  menu.classList.add("open");
  const mw = menu.offsetWidth || 190;
  const mh = menu.offsetHeight || 250;
  menu.style.left = `${Math.min(window.innerWidth - mw - 8, clientX)}px`;
  menu.style.top = `${Math.min(window.innerHeight - mh - 8, clientY)}px`;
}
