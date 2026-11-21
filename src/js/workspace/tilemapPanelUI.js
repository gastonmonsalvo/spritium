/**
 * tilemapPanelUI.js: Modal de creación/conversión Tilemap, panel lateral de Tileset e inicialización.
 */

import {
  state,
  subscribe,
} from "../core/state.js";
import { parseColorToRgba } from "../core/color.js";
import { renderAll, registerCanvasOverlay } from "../canvas/canvas.js";
import { setStatus, refreshIcons, updateToolOptionsUI } from "../ui/index.js";
import { i18n } from "../i18n/I18nService.js";
import {
  getTransformedTilePixels,
  getActiveTileset,
  getActiveTilemapLayer,
  countTileUsages,
} from "../state/TilemapModel.js";
import {
  exportActiveTilesetPng,
  exportActiveTilemapJson,
} from "./tilemapExporter.js";
import {
  addNewTilemapLayer,
  convertLayerToTilemap,
  rasterizeTilemapLayer,
  syncAllTilemapLayers,
} from "./tilemapSync.js";
import { drawTilemapCanvasOverlay } from "./tilemapTools.js";
import {
  selectTileInTileset,
  deleteActiveTile,
  duplicateActiveTile,
  setTilemapMode,
  reorderTileInActiveTileset,
} from "./tilemapTilesetOps.js";

let tilemapModalContext = { mode: "new", convertLayerIndex: null };
let draggedTileIndex = null;
let tilesetPanelPinnedByUser = false;
let tilesetPanelAutoOpened = false;
let lastSyncedLayerKey = null;

// --- MODAL NUEVA CAPA / CONVERTIR A TILEMAP ---

/**
 * Abre el modal para crear una nueva capa Tilemap desde cero.
 */
export function openNewTilemapModal() {
  openTilemapModalInternal("new", null);
}

/**
 * Abre el modal para convertir una capa pixel existente en capa Tilemap.
 * @param {number} [layerIndex=state.activeLayerIndex]
 */
export function openConvertLayerToTilemapModal(layerIndex = state.activeLayerIndex) {
  const resolvedIndex =
    typeof layerIndex === "number" && Number.isFinite(layerIndex) ? layerIndex : state.activeLayerIndex;
  const layer = state.layers?.[resolvedIndex];
  if (!layer) return;
  if (layer.type === "folder") {
    setStatus({ key: "log.tm_no_folder" }, true);
    return;
  }
  if (layer.type === "tilemap") {
    setStatus({ key: "log.tm_already" }, true);
    return;
  }
  openTilemapModalInternal("convert", resolvedIndex);
}

function openTilemapModalInternal(mode, convertLayerIndex) {
  tilemapModalContext = { mode, convertLayerIndex };
  const modal = document.getElementById("tilemapModal");
  if (!modal) return;

  const titleEl = document.getElementById("tilemapModalTitle");
  const nameEl = document.getElementById("tilemapNameInput");
  const wEl = document.getElementById("tilemapWidthInput");
  const hEl = document.getElementById("tilemapHeightInput");
  const tsSelect = document.getElementById("tilemapModalTilesetSelect");
  const confirmBtn = document.getElementById("btnConfirmTilemapModal");

  if (mode === "convert") {
    const srcLayer = state.layers?.[convertLayerIndex];
    if (titleEl) titleEl.textContent = i18n.t("tilemap.convert_modal_title");
    if (nameEl) {
      nameEl.value = srcLayer?.name || "Tilemap";
      nameEl.disabled = true;
    }
    if (confirmBtn) confirmBtn.textContent = i18n.t("tilemap.convert_btn");
  } else {
    if (titleEl) titleEl.textContent = i18n.t("modal.tilemap.title");
    if (nameEl) {
      nameEl.value = `Tilemap ${state.layers.length + 1}`;
      nameEl.disabled = false;
    }
    if (confirmBtn) confirmBtn.textContent = i18n.t("tilemap.create_btn");
  }

  const activeTs = getActiveTileset();
  const defW = activeTs?.tileWidth || 16;
  const defH = activeTs?.tileHeight || 16;
  if (wEl) wEl.value = String(defW);
  if (hEl) hEl.value = String(defH);

  if (tsSelect) {
    tsSelect.innerHTML = `<option value="__new__">+ Crear nuevo Tileset</option>`;
    for (const ts of state.tilesets || []) {
      const opt = document.createElement("option");
      opt.value = ts.id;
      opt.textContent = `${ts.name} (${ts.tileWidth}×${ts.tileHeight}px · ${ts.tiles.length - 1} tiles)`;
      if (mode !== "convert" && ts.id === state.activeTilesetId) opt.selected = true;
      tsSelect.appendChild(opt);
    }
  }

  modal.classList.add("open");
  (mode === "convert" ? wEl : nameEl)?.focus();
}

/**
 * Aplica un preset de ancho y alto de tile en los inputs del modal Tilemap.
 * @param {number} w
 * @param {number} h
 */
export function setTilemapModalPreset(w, h) {
  const wEl = document.getElementById("tilemapWidthInput");
  const hEl = document.getElementById("tilemapHeightInput");
  if (wEl) wEl.value = String(w);
  if (hEl) hEl.value = String(h);
}

/**
 * Cierra el modal de creación o conversión a capa Tilemap.
 */
export function closeTilemapModal() {
  document.getElementById("tilemapModal")?.classList.remove("open");
}

/**
 * Confirma el modal Tilemap y crea o convierte la capa según el contexto activo.
 */
export function confirmTilemapModal() {
  const name = (document.getElementById("tilemapNameInput")?.value || "").trim() || "Tilemap";
  const tileWidth = Math.max(2, Math.min(512, Number(document.getElementById("tilemapWidthInput")?.value || 16)));
  const tileHeight = Math.max(2, Math.min(512, Number(document.getElementById("tilemapHeightInput")?.value || 16)));
  const rawTsId = document.getElementById("tilemapModalTilesetSelect")?.value || "__new__";
  const tilesetId = rawTsId === "__new__" ? null : rawTsId;

  closeTilemapModal();
  if (tilemapModalContext.mode === "convert" && tilemapModalContext.convertLayerIndex !== null) {
    convertLayerToTilemap(tilemapModalContext.convertLayerIndex, tileWidth, tileHeight, tilesetId);
  } else {
    addNewTilemapLayer({ name, tileWidth, tileHeight, tilesetId });
  }
}

// --- VISIBILIDAD Y RENDERIZADO DEL PANEL IZQUIERDO ---

/**
 * Muestra u oculta el panel del Tileset y despliega el sidebar izquierdo si es necesario.
 * @param {boolean} visible
 * @param {{silent?: boolean}} [options]
 */
export function setTilesetPanelVisible(visible, { silent = false, fromAuto = false } = {}) {
  const show = Boolean(visible);
  if (!fromAuto) {
    tilesetPanelPinnedByUser = show;
    tilesetPanelAutoOpened = false;
  }
  const mod = document.getElementById("moduleTileset");
  const wasVisible = mod ? mod.style.display !== "none" : Boolean(state.showTilesetPanel);
  state.showTilesetPanel = show;
  if (mod) {
    mod.style.display = show ? "flex" : "none";
  }
  document.getElementById("menuTilesetPanel")?.classList.toggle("active", show);
  if (show) {
    // Asegurar que el sidebar izquierdo esté desplegado si el módulo está acoplado ahí
    const sidebar = document.getElementById("sidebar");
    const btnExpandLeft = document.getElementById("btnExpandLeft");
    if (sidebar && mod && sidebar.contains(mod)) {
      sidebar.classList.remove("collapsed");
      sidebar.classList.remove("all-modules-floating");
      btnExpandLeft?.classList.remove("visible");
    }
    renderTilesetPanelUI();
    if (!wasVisible && typeof mod?.scrollIntoView === "function") {
      mod.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
  updateToolOptionsUI();
  if (!silent) {
    setStatus({ key: show ? "log.tm_panel_show" : "log.tm_panel_hide" });
  }
}

function syncTilesetPanelForActiveLayer({ forceOpen = false } = {}) {
  const activeLayer = state.layers?.[state.activeLayerIndex] || null;
  const layerKey = activeLayer ? `${activeLayer.id || state.activeLayerIndex}:${activeLayer.type || "pixel"}` : "none";
  const layerChanged = layerKey !== lastSyncedLayerKey;
  lastSyncedLayerKey = layerKey;

  if (activeLayer?.type === "tilemap") {
    if (activeLayer.tilesetId) state.activeTilesetId = activeLayer.tilesetId;
    if (forceOpen || layerChanged) {
      if (!tilesetPanelPinnedByUser) tilesetPanelAutoOpened = true;
      setTilesetPanelVisible(true, { silent: true, fromAuto: true });
    } else if (state.showTilesetPanel) {
      renderTilesetPanelUI();
    }
  } else if (layerChanged && tilesetPanelAutoOpened && !tilesetPanelPinnedByUser && state.showTilesetPanel) {
    tilesetPanelAutoOpened = false;
    setTilesetPanelVisible(false, { silent: true, fromAuto: true });
  } else if (state.showTilesetPanel) {
    renderTilesetPanelUI();
  }
  updateToolOptionsUI();
}

/**
 * Alterna (o fuerza) la visibilidad del panel Tileset / Tilemap.
 * @param {boolean|null} [force=null]
 */
export function toggleTilesetPanel(force = null) {
  const mod = document.getElementById("moduleTileset");
  const currentlyVisible = mod ? mod.style.display !== "none" : Boolean(state.showTilesetPanel);
  const next = typeof force === "boolean" ? force : !currentlyVisible;
  setTilesetPanelVisible(next);
}

function drawTileCanvasThumbnail(canvas, tileGrid, tileW, tileH, flipH = false, flipV = false, rot = 0) {
  if (!canvas) return;
  canvas.width = tileW;
  canvas.height = tileH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, tileW, tileH);
  if (!tileGrid) return;

  const pixels =
    flipH || flipV || rot !== 0
      ? getTransformedTilePixels(tileGrid, tileW, tileH, flipH, flipV, rot)
      : tileGrid;
  const imgData = ctx.createImageData(tileW, tileH);
  for (let y = 0; y < tileH; y++) {
    for (let x = 0; x < tileW; x++) {
      const cIdx = pixels[y]?.[x] || 0;
      if (!cIdx) continue;
      const rgba = parseColorToRgba(state.paletteMap?.[cIdx]);
      if (!rgba) continue;
      const off = (y * tileW + x) * 4;
      imgData.data[off] = rgba[0];
      imgData.data[off + 1] = rgba[1];
      imgData.data[off + 2] = rgba[2];
      imgData.data[off + 3] = rgba[3];
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Renderiza el panel lateral completo de Tileset / Tilemap (selector, modos, grilla de tiles y acciones).
 */
export function renderTilesetPanelUI() {
  const mod = document.getElementById("moduleTileset");
  const isVisible = Boolean(state.showTilesetPanel && mod && mod.style.display !== "none");
  document.getElementById("menuTilesetPanel")?.classList.toggle("active", isVisible);
  if (!mod || !state.showTilesetPanel) return;

  const activeLayer = getActiveTilemapLayer();
  const ts = getActiveTileset();

  // Selector de Tilesets
  const selectEl = document.getElementById("tilesetSelect");
  if (selectEl) {
    selectEl.innerHTML = "";
    if (!state.tilesets || state.tilesets.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = i18n.t("tilemap.no_tilesets");
      selectEl.appendChild(opt);
      selectEl.disabled = true;
    } else {
      selectEl.disabled = false;
      for (const item of state.tilesets) {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = `${item.name} (${item.tileWidth}×${item.tileHeight})`;
        if (ts && item.id === ts.id) opt.selected = true;
        selectEl.appendChild(opt);
      }
    }
  }

  // Botones de modo
  const modeButtons = {
    tiles: "btnTileModeTiles",
    "edit-tile": "btnTileModeEdit",
    auto: "btnTileModeAuto",
  };
  for (const [mKey, btnId] of Object.entries(modeButtons)) {
    document.getElementById(btnId)?.classList.toggle("active", state.tilemapMode === mKey);
  }

  // Botones Flip / Rot / Grid / ThumbSize
  document.getElementById("btnTileFlipH")?.classList.toggle("active", Boolean(state.tileFlipH));
  document.getElementById("btnTileFlipV")?.classList.toggle("active", Boolean(state.tileFlipV));
  const rotBtn = document.getElementById("btnTileRot");
  if (rotBtn) {
    rotBtn.classList.toggle("active", (state.tileRot || 0) !== 0);
    const labelSpan = rotBtn.querySelector("span");
    if (labelSpan) labelSpan.textContent = `${(state.tileRot || 0) * 90}°`;
  }
  document.getElementById("btnTileGridToggle")?.classList.toggle("active", state.showTilemapGrid !== false);

  [32, 40, 52].forEach((sz) => {
    document
      .getElementById(`btnTileSize${sz}`)
      ?.classList.toggle("active", (state.tilesetThumbSize || 40) === sz);
  });

  // Banner informativo si la capa activa NO es tilemap
  const noticeEl = document.getElementById("tilemapLayerNotice");
  const rawActive = state.layers?.[state.activeLayerIndex];
  if (noticeEl) {
    if (!activeLayer) {
      noticeEl.style.display = "flex";
      if (rawActive?.type === "folder") {
        noticeEl.innerHTML = `<span>Capa actual: <b>Carpeta</b> (elegí una capa de píxeles)</span>`;
      } else {
        noticeEl.innerHTML = `<span>${i18n.t("tilemap.current_normal")} <b>${i18n.t("tilemap.normal_tag")}</b></span><button type="button" class="tool-btn" data-action="openConvertLayerToTilemapModal" style="font-size: 10px; padding: 2px 6px">${i18n.t("tilemap.convert_btn")}</button>`;
      }
    } else {
      noticeEl.style.display = "none";
    }
  }

  // Grilla grande del Tileset
  const gridEl = document.getElementById("tilesetGridContainer");
  if (gridEl) {
    gridEl.innerHTML = "";
    const thumbSize = state.tilesetThumbSize || 40;
    gridEl.style.setProperty("--tile-thumb-size", `${thumbSize}px`);

    if (!ts) {
      gridEl.innerHTML = `<div class="tileset-empty-state">${i18n.t("tilemap.empty_hint")}</div>`;
    } else {
      const counts = countTileUsages(ts);

      // Slots 1..N mostrados desde #0 en la grilla
      for (let i = 1; i < ts.tiles.length; i++) {
        const tileObj = ts.tiles[i];
        if (!tileObj) continue;
        const displayIdx = i - 1;
        const card = document.createElement("button");
        card.type = "button";
        card.draggable = true;
        card.dataset.tileIndex = String(i);
        card.className = `tileset-tile-card${state.activeTileIndex === i ? " active" : ""}`;
        card.title = i18n.t("tilemap.uses_title", { name: tileObj.name || `Tile #${displayIdx}`, count: counts[i] || 0 });

        const thumb = document.createElement("canvas");
        thumb.className = "tileset-tile-thumb";
        drawTileCanvasThumbnail(
          thumb,
          tileObj.grid,
          ts.tileWidth,
          ts.tileHeight,
          state.activeTileIndex === i && state.tileFlipH,
          state.activeTileIndex === i && state.tileFlipV,
          state.activeTileIndex === i ? state.tileRot : 0,
        );

        const idTag = document.createElement("span");
        idTag.className = "tileset-tile-id";
        idTag.textContent = `#${displayIdx}`;

        const countTag = document.createElement("span");
        countTag.className = "tileset-tile-uses";
        countTag.textContent = counts[i] > 0 ? `${counts[i]}×` : "";

        card.append(thumb, idTag);
        if (counts[i] > 0) card.appendChild(countTag);
        card.onclick = () => selectTileInTileset(i);

        card.addEventListener("dragstart", (e) => {
          draggedTileIndex = i;
          card.classList.add("dragging");
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(i));
          }
        });
        card.addEventListener("dragover", (e) => {
          if (draggedTileIndex === null || draggedTileIndex === i) return;
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
          const rect = card.getBoundingClientRect();
          const insertAfter = e.clientX >= rect.left + rect.width / 2;
          card.classList.toggle("drag-over-before", !insertAfter);
          card.classList.toggle("drag-over-after", insertAfter);
        });
        card.addEventListener("dragleave", () => {
          card.classList.remove("drag-over-before", "drag-over-after");
        });
        card.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
          card.classList.remove("drag-over-before", "drag-over-after");
          const rawFrom = draggedTileIndex ?? Number(e.dataTransfer?.getData("text/plain"));
          const rect = card.getBoundingClientRect();
          const insertAfter = e.clientX >= rect.left + rect.width / 2;
          const from = Number(rawFrom);
          const to = from < i ? (insertAfter ? i : i - 1) : (insertAfter ? i + 1 : i);
          draggedTileIndex = null;
          if (Number.isFinite(from) && from !== to) {
            reorderTileInActiveTileset(from, to);
          }
        });
        card.addEventListener("dragend", () => {
          draggedTileIndex = null;
          card.classList.remove("dragging", "drag-over-before", "drag-over-after");
        });

        gridEl.appendChild(card);
      }
    }
  }

  // Inspector del Tile seleccionado
  const previewCanvas = document.getElementById("activeTilePreviewCanvas");
  const infoTitle = document.getElementById("activeTileInfoTitle");
  const infoMeta = document.getElementById("activeTileInfoMeta");
  if (ts && state.activeTileIndex > 0 && ts.tiles[state.activeTileIndex]) {
    const tObj = ts.tiles[state.activeTileIndex];
    const counts = countTileUsages(ts);
    drawTileCanvasThumbnail(
      previewCanvas,
      tObj.grid,
      ts.tileWidth,
      ts.tileHeight,
      state.tileFlipH,
      state.tileFlipV,
      state.tileRot,
    );
    if (infoTitle) infoTitle.textContent = `Tile #${state.activeTileIndex - 1}`;
    if (infoMeta) {
      const trFlags = [
        state.tileFlipH ? "H" : "",
        state.tileFlipV ? "V" : "",
        state.tileRot ? `${state.tileRot * 90}°` : "",
      ]
        .filter(Boolean)
        .join(" ");
      infoMeta.textContent = `${i18n.t("tilemap.active_meta", { w: ts.tileWidth, h: ts.tileHeight, count: counts[state.activeTileIndex] || 0 })}${trFlags ? ` · ${trFlags}` : ""}`;
    }
  } else {
    if (previewCanvas) {
      const pCtx = previewCanvas.getContext("2d");
      pCtx?.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
    if (infoTitle) infoTitle.textContent = ts ? i18n.t("tilemap.empty_slot0") : i18n.t("tilemap.no_tile");
    if (infoMeta) infoMeta.textContent = ts ? i18n.t("tilemap.eraser_meta", { w: ts.tileWidth, h: ts.tileHeight }) : i18n.t("tilemap.no_tileset");
  }

  refreshIcons(mod);
}

/**
 * Inicializa suscripciones del subsistema Tilemap (sincronización en Undo/Redo y actualización de UI).
 */
export function initTilemapModule() {
  registerCanvasOverlay(drawTilemapCanvasOverlay);
  subscribe("history", () => {
    syncAllTilemapLayers();
    syncTilesetPanelForActiveLayer();
  });
  subscribe("tilemap:render", () => {
    renderTilesetPanelUI();
    updateToolOptionsUI();
  });
  subscribe("tilemap:syncActiveLayer", () => syncTilesetPanelForActiveLayer());
  i18n.addEventListener("langchange", () => renderTilesetPanelUI());
  subscribe("tilemap:showPanel", (opts) => {
    const fromAuto = Boolean(opts?.auto);
    const visible = Boolean(opts?.visible ?? true);
    if (fromAuto && visible && !tilesetPanelPinnedByUser) tilesetPanelAutoOpened = true;
    setTilesetPanelVisible(visible, { silent: Boolean(opts?.silent), fromAuto });
  });
  subscribe("tilemap:openNewModal", () => openNewTilemapModal());
  subscribe("tilemap:openConvertModal", (layerIdx) => openConvertLayerToTilemapModal(layerIdx));
  subscribe("tilemap:rasterize", (layerIdx) => rasterizeTilemapLayer(layerIdx));
  subscribe("tilemap:exportPng", () => exportActiveTilesetPng());
  subscribe("tilemap:exportJson", () => exportActiveTilemapJson());
  const initialLayer = state.layers?.[state.activeLayerIndex];
  if (initialLayer?.type === "tilemap") {
    syncTilesetPanelForActiveLayer();
  } else {
    setTilesetPanelVisible(Boolean(state.showTilesetPanel), { silent: true, fromAuto: true });
  }
}
