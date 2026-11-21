/**
 * layersUI.js: Renderizado del panel de capas, Drag & Drop, renombrado inline y menú contextual.
 */

import { state, pushState, subscribe, notify } from "../core/state.js";
import { setStatus, refreshIcons } from "../ui/index.js";
import { i18n } from "../i18n/I18nService.js";

if (typeof window !== "undefined") {
  i18n.addEventListener("langchange", () => renderLayersUI());
}
import {
  LAYER_BLEND_MODES,
  getSelectedLayerIndices,
  toggleLayerLock,
  selectLayer,
  toggleLayerVisibility,
} from "./layersOps.js";
import {
  addNewLayer,
  addNewFolder,
  toggleFolderCollapsed,
  moveLayerToFolder,
  duplicateLayerAt,
  deleteLayerAt,
  clearLayerAt,
  copyLayerToClipboard,
  cutLayerToClipboard,
  pasteClipboardAsLayer,
} from "./layersCrudOps.js";
import {
  mergeLayerIndices,
  mergeLayerDown,
  mergeSelectedLayers,
  mergeVisibleLayers,
  reorderLayer,
  moveLayerOrder,
} from "./layersMergeAndOrderOps.js";

const VALID_BLEND_MODES = new Set(LAYER_BLEND_MODES.map((m) => m.value));
let draggedLayerIndex = null;
let contextMenuInitialized = false;

subscribe("layers:render", () => renderLayersUI());
subscribe("layers:syncOpacity", () => syncLayerOpacityUI());

function syncLayerOpacityUI() {
  const slider = document.getElementById("layerOpacitySlider");
  const label = document.getElementById("layerOpacityValue");
  const blendSelect = document.getElementById("layerBlendModeSelect");
  const layer = state.layers[state.activeLayerIndex];
  const pct = Math.round((layer?.opacity ?? 1) * 100);
  if (slider) slider.value = String(pct);
  if (label) label.textContent = `${pct}%`;
  if (blendSelect) {
    const mode = layer?.blendMode || "source-over";
    blendSelect.value = VALID_BLEND_MODES.has(mode) ? mode : "source-over";
  }
}

/**
 * Inicia el renombrado inline de una capa reemplazando su etiqueta por un input.
 * @param {HTMLElement} nameSpan
 * @param {number} index
 */
export function startInlineRename(nameSpan, index) {
  const layer = state.layers[index];
  if (!layer || layer.locked) return;
  const input = document.createElement("input");
  input.type = "text";
  input.value = layer.name;
  input.className = "layer-rename-input";

  const commit = () => {
    const val = input.value.trim();
    if (val && val !== layer.name) {
      pushState();
      layer.name = val;
      for (const frame of state.frames || []) {
        if (frame.layers?.[index]) frame.layers[index].name = val;
      }
    }
    renderLayersUI();
  };

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") renderLayersUI();
  });

  nameSpan.replaceWith(input);
  input.focus();
  input.select();
}

/**
 * Activa el renombrado inline sobre la capa actualmente seleccionada.
 */
export function renameActiveLayerInline() {
  const activeSpan = document.querySelector("#layers-list .layer-item.active .layer-name");
  if (activeSpan) {
    startInlineRename(activeSpan, state.activeLayerIndex);
  }
}

// --- MENÚ CONTEXTUAL (CLIC DERECHO EN CAPAS) ---
function hideLayerContextMenu() {
  const menu = document.getElementById("layerContextMenu");
  if (menu) {
    menu.classList.remove("open");
    menu.innerHTML = "";
  }
}

function ensureContextMenuListeners() {
  if (contextMenuInitialized) return;
  contextMenuInitialized = true;
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("layerContextMenu");
    if (menu && !menu.contains(e.target)) hideLayerContextMenu();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideLayerContextMenu();
  });
}

function openLayerContextMenu(e, layerIndex) {
  e.preventDefault();
  e.stopPropagation();
  ensureContextMenuListeners();

  const menu = document.getElementById("layerContextMenu");
  if (!menu) return;

  if (!getSelectedLayerIndices().has(layerIndex)) {
    selectLayer(layerIndex);
  }

  const layer = state.layers[layerIndex];
  const otherLayers = state.layers
    .map((l, idx) => ({ l, idx }))
    .filter((item) => item.idx !== layerIndex)
    .reverse();

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
      hideLayerContextMenu();
      onClick();
    };
    menu.appendChild(btn);
  };

  const addDivider = () => {
    const hr = document.createElement("div");
    hr.className = "ctx-divider";
    menu.appendChild(hr);
  };

  menu.innerHTML = `<div class="ctx-header">${layer.name}${layer.type === "folder" ? ` [${i18n.t("layers.folder_tag")}]` : layer.type === "tilemap" ? " [TM]" : ""}${layer.locked ? ` (${i18n.t("layers.locked_tag")})` : ""}</div>`;
  addItem("plus", i18n.t("layers.new_layer"), () => addNewLayer());
  addItem("folder-plus", i18n.t("layers.new_folder"), () => addNewFolder());
  if (layer.type !== "folder") {
    const folders = state.layers.filter((l) => l?.type === "folder");
    if (layer.folderId) {
      addItem("folder-output", i18n.t("layers.ungroup"), () => moveLayerToFolder(layerIndex, null));
    }
    for (const f of folders) {
      if (f.id === layer.folderId) continue;
      addItem("folder-input", i18n.t("layers.move_to_folder", { name: f.name }), () => moveLayerToFolder(layerIndex, f.id));
    }
  }
  addItem("layout-grid", i18n.t("layers.new_tilemap"), () => notify("tilemap:openNewModal"));
  if (layer.type === "tilemap") {
    addItem("layers", i18n.t("layers.rasterize_tm"), () => notify("tilemap:rasterize", layerIndex), layer.locked);
    addItem("image", i18n.t("layers.exp_tileset_png"), () => notify("tilemap:exportPng"));
    addItem("file-json", i18n.t("layers.exp_tilemap_json"), () => {
      selectLayer(layerIndex);
      notify("tilemap:exportJson");
    });
  } else if (layer.type !== "folder") {
    addItem("layout-grid", i18n.t("layers.convert_to_tm"), () => notify("tilemap:openConvertModal", layerIndex), layer.locked);
  }
  addDivider();
  addItem(layer.locked ? "unlock" : "lock", i18n.t(layer.locked ? "layers.unlock" : "layers.lock"), () => toggleLayerLock(layerIndex));
  addItem("pencil", i18n.t("layers.rename"), () => {
    const rows = document.querySelectorAll("#layers-list .layer-item");
    const domIdx = state.layers.length - 1 - layerIndex;
    const span = rows[domIdx]?.querySelector(".layer-name");
    if (span) startInlineRename(span, layerIndex);
  }, layer.locked);
  addItem("copy-plus", i18n.t("layers.dup"), () => duplicateLayerAt(layerIndex));
  addItem("copy", i18n.t("layers.copy"), () => copyLayerToClipboard(layerIndex));
  addItem("scissors", i18n.t("layers.cut"), () => cutLayerToClipboard(layerIndex), layer.locked);
  addItem("clipboard-paste", i18n.t("layers.paste"), () => pasteClipboardAsLayer(), !state.clipboard);
  addDivider();

  if (getSelectedLayerIndices().size >= 2) {
    addItem("layers", i18n.t("layers.merge_selected", { count: getSelectedLayerIndices().size }), () =>
      mergeSelectedLayers(),
    );
  }
  addItem("eye", i18n.t("layers.merge_visible"), () => mergeVisibleLayers(), state.layers.filter((l) => l.visible).length < 2);

  if (otherLayers.length > 0) {
    const subLabel = document.createElement("div");
    subLabel.className = "ctx-sublabel";
    subLabel.textContent = i18n.t("layers.merge_with");
    menu.appendChild(subLabel);
    for (const target of otherLayers) {
      addItem("arrow-down-to-line", target.l.name, () => mergeLayerIndices([target.idx, layerIndex]));
    }
  }

  addDivider();
  addItem("eraser", i18n.t("layers.clear"), () => clearLayerAt(layerIndex), layer.locked);
  addItem("trash-2", i18n.t("layers.delete"), () => deleteLayerAt(layerIndex), layer.locked || state.layers.length <= 1);

  menu.classList.add("open");
  refreshIcons(menu);
  const maxX = window.innerWidth - 210;
  const maxY = window.innerHeight - Math.min(360, menu.scrollHeight + 16);
  menu.style.left = `${Math.max(8, Math.min(maxX, e.clientX))}px`;
  menu.style.top = `${Math.max(8, Math.min(maxY, e.clientY))}px`;
}

/**
 * Renderiza la lista interactiva de capas con drag & drop, candado y visibilidad.
 */
export function renderLayersUI() {
  const list = document.getElementById("layers-list");
  if (!list) return;
  list.innerHTML = "";
  syncLayerOpacityUI();

  list.oncontextmenu = (e) => {
    if (e.target.closest(".layer-item")) return;
    e.preventDefault();
    e.stopPropagation();
    const menu = document.getElementById("layerContextMenu");
    if (!menu) return;
    menu.innerHTML = `<div class="ctx-header">${i18n.t("layers.panel_header")}</div>`;
    const addAction = (icon, label, fn, disabled = false) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ctx-item";
      btn.innerHTML = `<i data-lucide="${icon}" class="ui-icon-sm"></i><span></span>`;
      btn.querySelector("span").textContent = label;
      btn.disabled = disabled;
      btn.onclick = () => {
        hideLayerContextMenu();
        fn();
      };
      menu.appendChild(btn);
    };
    addAction("plus", i18n.t("layers.new_layer"), () => addNewLayer());
    addAction("clipboard-paste", i18n.t("layers.paste"), () => pasteClipboardAsLayer(), !state.clipboard);
    addAction("eye", i18n.t("layers.merge_visible"), () => mergeVisibleLayers(), state.layers.filter((l) => l.visible).length < 2);
    menu.classList.add("open");
    refreshIcons(menu);
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - 210, e.clientX))}px`;
    menu.style.top = `${Math.max(8, Math.min(window.innerHeight - 200, e.clientY))}px`;
  };

  const btnMergeSel = document.getElementById("btnMergeSelectedLayers");
  if (btnMergeSel) {
    btnMergeSel.disabled = getSelectedLayerIndices().size < 2;
    btnMergeSel.title =
      getSelectedLayerIndices().size >= 2
        ? `Combinar seleccionadas (${getSelectedLayerIndices().size})`
        : "Combinar capas seleccionadas (Ctrl+Clic)";
  }

  const folderById = new Map();
  for (const l of state.layers) {
    if (l?.type === "folder" && l.id) folderById.set(l.id, l);
  }

  // Mostrar de arriba hacia abajo (la capa superior primero)
  for (let i = state.layers.length - 1; i >= 0; i--) {
    const layer = state.layers[i];
    const isFolder = layer.type === "folder";
    const parentFolder = layer.folderId ? folderById.get(layer.folderId) : null;
    if (parentFolder?.collapsed) continue;
    const isActive = i === state.activeLayerIndex;
    const isMultiSelected = getSelectedLayerIndices().has(i);

    const row = document.createElement("div");
    row.className =
      "layer-item" +
      (isActive ? " active" : "") +
      (isMultiSelected && !isActive ? " multi-selected" : "") +
      (isFolder ? " is-folder" : "") +
      (parentFolder ? " in-folder" : "") +
      (layer.locked ? " locked" : "");
    row.draggable = true;
    row.title = i18n.t("layers.row_title");

    const visBtn = document.createElement("button");
    visBtn.type = "button";
    visBtn.className = "layer-mini-btn";
    visBtn.innerHTML = `<i data-lucide="${layer.visible ? "eye" : "eye-off"}" class="ui-icon-sm"></i>`;
    visBtn.title = i18n.t(layer.visible ? "layers.hide" : "layers.show");
    visBtn.onclick = (e) => {
      e.stopPropagation();
      toggleLayerVisibility(i);
    };

    const lockBtn = document.createElement("button");
    lockBtn.type = "button";
    lockBtn.className = "layer-mini-btn" + (layer.locked ? " locked-btn" : "");
    lockBtn.innerHTML = `<i data-lucide="${layer.locked ? "lock" : "unlock"}" class="ui-icon-sm"></i>`;
    lockBtn.title = i18n.t(layer.locked ? "layers.unlock" : "layers.lock_title");
    lockBtn.onclick = (e) => {
      e.stopPropagation();
      toggleLayerLock(i);
    };

    const nameSpan = document.createElement("span");
    nameSpan.className = "layer-name";
    nameSpan.textContent = layer.name;
    nameSpan.ondblclick = (e) => {
      e.stopPropagation();
      if (!layer.locked) startInlineRename(nameSpan, i);
    };

    const tmBadge =
      layer.type === "tilemap"
        ? (() => {
            const b = document.createElement("span");
            b.className = "layer-tilemap-badge";
            b.textContent = "TM";
            b.title = `Capa Tilemap (${layer.tileWidth || 16}×${layer.tileHeight || 16}px)`;
            return b;
          })()
        : null;

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "layer-mini-btn";
    upBtn.innerHTML = `<i data-lucide="chevron-up" class="ui-icon-sm"></i>`;
    upBtn.title = "Subir capa";
    upBtn.disabled = i === state.layers.length - 1;
    upBtn.onclick = (e) => {
      e.stopPropagation();
      moveLayerOrder(i, 1);
    };

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "layer-mini-btn";
    downBtn.innerHTML = `<i data-lucide="chevron-down" class="ui-icon-sm"></i>`;
    downBtn.title = "Bajar capa";
    downBtn.disabled = i === 0;
    downBtn.onclick = (e) => {
      e.stopPropagation();
      moveLayerOrder(i, -1);
    };

    // Drag & Drop entre capas
    row.addEventListener("dragstart", (e) => {
      draggedLayerIndex = i;
      row.classList.add("dragging");
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (draggedLayerIndex !== null && draggedLayerIndex !== i) {
        const rect = row.getBoundingClientRect();
        const draggedLayer = state.layers[draggedLayerIndex];
        const intoFolder = isFolder && draggedLayer?.type !== "folder" && (e.clientY - rect.top) >= rect.height * 0.45;
        row.classList.toggle("drag-into-folder", intoFolder);
        row.classList.toggle("drag-target", !intoFolder);
      }
    });
    row.addEventListener("dragleave", () => {
      row.classList.remove("drag-target", "drag-into-folder");
    });
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      const rect = row.getBoundingClientRect();
      const draggedLayer = draggedLayerIndex !== null ? state.layers[draggedLayerIndex] : null;
      const intoFolder = isFolder && draggedLayer?.type !== "folder" && (e.clientY - rect.top) >= rect.height * 0.45;
      row.classList.remove("drag-target", "drag-into-folder");
      if (draggedLayerIndex !== null && draggedLayerIndex !== i) {
        reorderLayer(draggedLayerIndex, i, { intoFolder });
      }
      draggedLayerIndex = null;
    });
    row.addEventListener("dragend", () => {
      draggedLayerIndex = null;
      row.classList.remove("dragging");
      list.querySelectorAll(".drag-target, .drag-into-folder").forEach((el) => el.classList.remove("drag-target", "drag-into-folder"));
    });

    row.onclick = (e) => selectLayer(i, { toggleMulti: e.ctrlKey || e.metaKey });
    row.oncontextmenu = (e) => openLayerContextMenu(e, i);

    const folderToggleBtn = isFolder
      ? (() => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "layer-mini-btn";
          btn.innerHTML = `<i data-lucide="${layer.collapsed ? "chevron-right" : "chevron-down"}" class="ui-icon-sm"></i><i data-lucide="${layer.collapsed ? "folder" : "folder-open"}" class="ui-icon-sm"></i>`;
          btn.title = i18n.t(layer.collapsed ? "layers.expand_folder" : "layers.collapse_folder");
          btn.onclick = (e) => {
            e.stopPropagation();
            toggleFolderCollapsed(i);
          };
          return btn;
        })()
      : null;

    if (folderToggleBtn) row.append(folderToggleBtn);
    row.append(visBtn, lockBtn, nameSpan);
    if (tmBadge) row.append(tmBadge);
    row.append(upBtn, downBtn);
    list.appendChild(row);
  }
  refreshIcons(list);
  notify("layers:rendered");
}
