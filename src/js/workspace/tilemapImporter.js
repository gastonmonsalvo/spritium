/**
 * tilemapImporter.js: Importación de Tilesets PNG y Mapas Tilemap JSON (formato Spritium o Tiled).
 * Soporta tres modos: solo PNG (corte en grilla), PNG + JSON (reconstrucción exacta con flips/rotaciones)
 * y solo JSON (aplicación del mapa sobre el Tileset activo compatible).
 */

import {
  state,
  MAX_GRID_DIM,
  pushState,
  setGridSize,
  getGridDims,
  createEmptyGrid,
  cloneGrid,
  notify,
} from "../core/state.js";
import {
  getActiveTileset,
  createEmptyTileGrid,
  ensureLayerTileGridDimensions,
  syncTilemapLayerToGrid,
} from "../state/TilemapModel.js";
import {
  clampTileDim,
  parseTilemapJsonPayload,
  sliceImageDataToTiles,
} from "./tilemapImportCore.js";

export { parseTilemapJsonPayload, sliceImageDataToTiles };
import { renderAll, applyZoom } from "../canvas/canvas.js";
import { setStatus, updateResolutionButtons, refreshIcons } from "../ui/index.js";
import { i18n } from "../i18n/I18nService.js";
import { renderLayersUI, syncActiveLayerGrid, resetLayersWithGrid } from "./layers.js";
import { resetFramesWithCurrentLayers } from "./frames.js";
import {
  populateThemeSelect,
  buildPaletteUI,
  renderCustomPaletteUI,
  manualCustomIndices,
} from "./paletteManager.js";
import { openNewDocTab, syncActiveTabSnapshot } from "./docTabs.js";

let importSeq = 1;

const importState = {
  pngFile: null,
  pngImgData: null,
  pngWidth: 0,
  pngHeight: 0,
  jsonFile: null,
  parsedJson: null,
  wired: false,
};

async function loadImageFileToImageData(file) {
  const bitmap = await createImageBitmap(file);
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("NO_CANVAS_CTX");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0);
  if (typeof bitmap.close === "function") bitmap.close();
  return { imgData: ctx.getImageData(0, 0, w, h), width: w, height: h };
}

function getModalEl(id) {
  return typeof document !== "undefined" ? document.getElementById(id) : null;
}

async function assignPngFile(file) {
  if (!file) return;
  try {
    const loaded = await loadImageFileToImageData(file);
    importState.pngFile = file;
    importState.pngImgData = loaded.imgData;
    importState.pngWidth = loaded.width;
    importState.pngHeight = loaded.height;
  } catch {
    importState.pngFile = null;
    importState.pngImgData = null;
    importState.pngWidth = 0;
    importState.pngHeight = 0;
  }
  syncTilemapImportModalUI();
}

async function assignJsonFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = parseTilemapJsonPayload(text);
    importState.jsonFile = file;
    importState.parsedJson = parsed;
  } catch {
    importState.jsonFile = null;
    importState.parsedJson = null;
    setStatus({ key: "modal.tm_import.bad_json" }, true);
  }
  syncTilemapImportModalUI();
}

function syncTilemapImportModalUI() {
  const pngInfo = getModalEl("tmImportPngInfo");
  const jsonInfo = getModalEl("tmImportJsonInfo");
  const btnClearPng = getModalEl("btnClearTmPng");
  const btnClearJson = getModalEl("btnClearTmJson");
  const wEl = /** @type {HTMLInputElement|null} */ (getModalEl("tmImportWidthInput"));
  const hEl = /** @type {HTMLInputElement|null} */ (getModalEl("tmImportHeightInput"));
  const targetSel = /** @type {HTMLSelectElement|null} */ (getModalEl("tmImportTargetMode"));
  const pngOnlyBox = getModalEl("tmImportPngOnlyOpts");
  const jsonOptsBox = getModalEl("tmImportJsonOpts");
  const resizeChk = /** @type {HTMLInputElement|null} */ (getModalEl("chkTmImportResizeCanvas"));
  const summaryEl = getModalEl("tmImportSummary");
  const submitBtn = /** @type {HTMLButtonElement|null} */ (getModalEl("btnConfirmTilemapImport"));

  if (pngInfo) {
    pngInfo.textContent = importState.pngFile
      ? `${importState.pngFile.name} (${importState.pngWidth}×${importState.pngHeight}px)`
      : i18n.t("modal.tm_import.none");
  }
  if (btnClearPng) btnClearPng.style.display = importState.pngFile ? "inline-flex" : "none";

  const pj = importState.parsedJson;
  if (jsonInfo) {
    jsonInfo.textContent = pj && importState.jsonFile
      ? `${importState.jsonFile.name} (${pj.cols}×${pj.rows} · ${pj.tileWidth}×${pj.tileHeight}px)`
      : i18n.t("modal.tm_import.optional");
  }
  if (btnClearJson) btnClearJson.style.display = importState.jsonFile ? "inline-flex" : "none";

  if (pj && wEl && hEl) {
    wEl.value = String(pj.tileWidth);
    hEl.value = String(pj.tileHeight);
  }
  if (wEl) wEl.disabled = Boolean(pj);
  if (hEl) hEl.disabled = Boolean(pj);
  if (typeof document !== "undefined") {
    document.querySelectorAll("[data-tm-import-preset]").forEach((b) => {
      /** @type {HTMLButtonElement} */ (b).disabled = Boolean(pj);
    });
  }

  if (pngOnlyBox) pngOnlyBox.style.display = !pj ? "flex" : "none";
  if (jsonOptsBox) jsonOptsBox.style.display = pj ? "flex" : "none";

  const targetMode = targetSel?.value || "current";
  if (resizeChk) {
    if (targetMode === "project") {
      resizeChk.checked = true;
      resizeChk.disabled = true;
    } else {
      resizeChk.disabled = false;
    }
  }

  const tw = clampTileDim(wEl?.value, 16);
  const th = clampTileDim(hEl?.value, 16);
  const activeTs = getActiveTileset();
  const hasPng = Boolean(importState.pngImgData);

  let valid = false;
  let warn = false;
  let msg = i18n.t("modal.tm_import.hint_empty");

  if (hasPng && pj) {
    const sheetCols = Math.max(1, Math.floor(importState.pngWidth / tw));
    const sheetRows = Math.max(1, Math.floor(importState.pngHeight / th));
    const tiles = pj.tileCount || sheetCols * sheetRows;
    msg = i18n.t("modal.tm_import.sum_full", {
      tiles,
      w: tw,
      h: th,
      cols: pj.cols,
      rows: pj.rows,
      mw: pj.cols * tw,
      mh: pj.rows * th,
    });
    valid = true;
  } else if (hasPng) {
    const cols = Math.max(1, Math.floor(importState.pngWidth / tw));
    const rows = Math.max(1, Math.floor(importState.pngHeight / th));
    msg = i18n.t("modal.tm_import.sum_png", { slots: cols * rows, cols, rows, w: tw, h: th });
    valid = true;
  } else if (pj) {
    const canApplyJsonOnly =
      targetMode === "current" &&
      Boolean(activeTs) &&
      activeTs.tileWidth === tw &&
      activeTs.tileHeight === th;
    if (canApplyJsonOnly) {
      msg = i18n.t("modal.tm_import.sum_json", {
        cols: pj.cols,
        rows: pj.rows,
        name: activeTs.name,
      });
      valid = true;
    } else {
      msg = i18n.t("modal.tm_import.warn_need_png", { w: tw, h: th });
      warn = true;
      valid = false;
    }
  }

  if (summaryEl) {
    summaryEl.textContent = msg;
    summaryEl.classList.toggle("is-warn", warn);
  }
  if (submitBtn) submitBtn.disabled = !valid;
}

function wireTilemapImportModalInputs() {
  if (importState.wired) return;
  importState.wired = true;

  const multiInput = /** @type {HTMLInputElement|null} */ (getModalEl("tmImportMultiInput"));
  const pngInput = /** @type {HTMLInputElement|null} */ (getModalEl("tmImportPngInput"));
  const jsonInput = /** @type {HTMLInputElement|null} */ (getModalEl("tmImportJsonInput"));

  multiInput?.addEventListener("change", async () => {
    const files = Array.from(multiInput.files || []);
    multiInput.value = "";
    for (const f of files) {
      const lower = f.name.toLowerCase();
      if (lower.endsWith(".json") || lower.endsWith(".tmj") || f.type === "application/json") {
        await assignJsonFile(f);
      } else if (f.type.startsWith("image/") || /\.(png|webp|gif|bmp|jpe?g)$/i.test(lower)) {
        await assignPngFile(f);
      }
    }
  });

  pngInput?.addEventListener("change", async () => {
    const file = pngInput.files?.[0];
    pngInput.value = "";
    if (file) await assignPngFile(file);
  });

  jsonInput?.addEventListener("change", async () => {
    const file = jsonInput.files?.[0];
    jsonInput.value = "";
    if (file) await assignJsonFile(file);
  });

  for (const id of [
    "tmImportTargetMode",
    "tmImportWidthInput",
    "tmImportHeightInput",
    "chkTmImportSkipEmpty",
    "chkTmImportDedupe",
    "chkTmImportCreateLayer",
    "chkTmImportResizeCanvas",
  ]) {
    getModalEl(id)?.addEventListener("change", syncTilemapImportModalUI);
    getModalEl(id)?.addEventListener("input", syncTilemapImportModalUI);
  }
}

function resizeAllProjectLayersKeepingContent(newW, newH) {
  setGridSize(newW, newH);
  const visited = new Set();
  const resizeLayer = (l) => {
    if (!l || visited.has(l) || l.type === "folder") return;
    visited.add(l);
    if (l.type === "tilemap") {
      ensureLayerTileGridDimensions(l);
      syncTilemapLayerToGrid(l);
      return;
    }
    const next = createEmptyGrid(newW, newH);
    const old = l.grid || [];
    const copyH = Math.min(newH, old.length);
    for (let y = 0; y < copyH; y++) {
      const row = old[y];
      if (!row) continue;
      const copyW = Math.min(newW, row.length);
      for (let x = 0; x < copyW; x++) {
        next[y][x] = row[x] || 0;
      }
    }
    l.grid = next;
  };
  for (const f of state.frames || []) {
    for (const l of f.layers || []) resizeLayer(l);
  }
  for (const l of state.layers || []) resizeLayer(l);
}

/**
 * Abre el modal de importación de Tileset PNG y/o Mapa Tilemap JSON.
 */
export function openTilemapImportModal() {
  const modal = getModalEl("tilemapImportModal");
  if (!modal) return;
  wireTilemapImportModalInputs();

  importState.pngFile = null;
  importState.pngImgData = null;
  importState.pngWidth = 0;
  importState.pngHeight = 0;
  importState.jsonFile = null;
  importState.parsedJson = null;

  const activeTs = getActiveTileset();
  const wEl = /** @type {HTMLInputElement|null} */ (getModalEl("tmImportWidthInput"));
  const hEl = /** @type {HTMLInputElement|null} */ (getModalEl("tmImportHeightInput"));
  const targetSel = /** @type {HTMLSelectElement|null} */ (getModalEl("tmImportTargetMode"));
  const skipChk = /** @type {HTMLInputElement|null} */ (getModalEl("chkTmImportSkipEmpty"));
  const dedupeChk = /** @type {HTMLInputElement|null} */ (getModalEl("chkTmImportDedupe"));
  const createChk = /** @type {HTMLInputElement|null} */ (getModalEl("chkTmImportCreateLayer"));
  const resizeChk = /** @type {HTMLInputElement|null} */ (getModalEl("chkTmImportResizeCanvas"));

  if (targetSel) targetSel.value = "current";
  if (wEl) wEl.value = String(activeTs?.tileWidth || 16);
  if (hEl) hEl.value = String(activeTs?.tileHeight || 16);
  if (skipChk) skipChk.checked = true;
  if (dedupeChk) dedupeChk.checked = true;
  if (createChk) createChk.checked = true;
  if (resizeChk) resizeChk.checked = true;

  syncTilemapImportModalUI();
  modal.classList.add("open");
  refreshIcons(modal);
}

/**
 * Cierra el modal de importación de Tilemap / Tileset y libera archivos temporales.
 */
export function closeTilemapImportModal() {
  importState.pngFile = null;
  importState.pngImgData = null;
  importState.jsonFile = null;
  importState.parsedJson = null;
  getModalEl("tilemapImportModal")?.classList.remove("open");
}

/**
 * Aplica un preset de ancho y alto de tile en el modal de importación Tilemap.
 * @param {number} w
 * @param {number} h
 */
export function setTilemapImportPreset(w, h) {
  if (importState.parsedJson) return;
  const wEl = /** @type {HTMLInputElement|null} */ (getModalEl("tmImportWidthInput"));
  const hEl = /** @type {HTMLInputElement|null} */ (getModalEl("tmImportHeightInput"));
  if (wEl) wEl.value = String(w);
  if (hEl) hEl.value = String(h);
  syncTilemapImportModalUI();
}

/**
 * Limpia uno de los slots de archivo ("png" o "json") del modal de importación Tilemap.
 * @param {"png"|"json"|string} slot
 */
export function clearTilemapImportSlot(slot) {
  if (slot === "png") {
    importState.pngFile = null;
    importState.pngImgData = null;
    importState.pngWidth = 0;
    importState.pngHeight = 0;
  } else if (slot === "json") {
    importState.jsonFile = null;
    importState.parsedJson = null;
  }
  syncTilemapImportModalUI();
}

/**
 * Confirma e importa el Tileset PNG, el Mapa JSON o la combinación PNG + JSON al proyecto.
 */
export async function confirmTilemapImportModal() {
  const submitBtn = /** @type {HTMLButtonElement|null} */ (getModalEl("btnConfirmTilemapImport"));
  if (submitBtn?.disabled) return;

  const targetMode = /** @type {HTMLSelectElement|null} */ (getModalEl("tmImportTargetMode"))?.value || "current";
  const tw = clampTileDim(/** @type {HTMLInputElement|null} */ (getModalEl("tmImportWidthInput"))?.value, 16);
  const th = clampTileDim(/** @type {HTMLInputElement|null} */ (getModalEl("tmImportHeightInput"))?.value, 16);
  const skipEmpty = Boolean(/** @type {HTMLInputElement|null} */ (getModalEl("chkTmImportSkipEmpty"))?.checked);
  const dedupe = Boolean(/** @type {HTMLInputElement|null} */ (getModalEl("chkTmImportDedupe"))?.checked);
  const createLayerFlag = Boolean(/** @type {HTMLInputElement|null} */ (getModalEl("chkTmImportCreateLayer"))?.checked);
  const resizeCanvasFlag = Boolean(/** @type {HTMLInputElement|null} */ (getModalEl("chkTmImportResizeCanvas"))?.checked);

  const pj = importState.parsedJson;
  const pngImgData = importState.pngImgData;
  const pngBaseName = (importState.pngFile?.name || "").replace(/\.[^/.]+$/, "");
  const jsonBaseName = (importState.jsonFile?.name || "").replace(/\.[^/.]+$/, "");
  const baseName = pj?.layerName || pngBaseName || jsonBaseName || "Tilemap";

  if (!pngImgData && !pj) return;

  if (targetMode === "project") {
    if (!pngImgData) return;
    openNewDocTab(baseName);
    pushState();

    const { w: curW, h: curH } = getGridDims();
    const dstW = pj ? Math.max(4, Math.min(MAX_GRID_DIM, pj.cols * tw)) : Math.max(tw, Math.min(MAX_GRID_DIM, curW || 64));
    const dstH = pj ? Math.max(4, Math.min(MAX_GRID_DIM, pj.rows * th)) : Math.max(th, Math.min(MAX_GRID_DIM, curH || 64));

    setGridSize(dstW, dstH);
    resetLayersWithGrid(createEmptyGrid(dstW, dstH), baseName);
    resetFramesWithCurrentLayers();
    state.sourceImageFile = null;
    state.sourceImportOptions = null;
    state.resBaseSnapshot = null;
    state.isDirtySinceImport = true;
    state.customColorIndices = [];
    manualCustomIndices.clear();

    const sliced = sliceImageDataToTiles(pngImgData, {
      tileWidth: tw,
      tileHeight: th,
      maxTiles: pj ? pj.tileCount : null,
      skipEmpty: !pj && skipEmpty,
      dedupe: !pj && dedupe,
      paletteMap: null,
    });
    state.paletteMap = sliced.paletteMap;
    state.originalImport = null;
    state.currentThemeKey = "original";

    const validIndices = Object.keys(state.paletteMap)
      .map(Number)
      .filter((n) => n > 0 && n !== 9999 && Boolean(state.paletteMap[n]))
      .sort((a, b) => a - b);
    state.currentColorIndex = validIndices[0] ?? 1;
    state.secondaryColorIndex = validIndices[1] ?? 0;

    const ts = {
      id: `ts_${Date.now()}_${importSeq++}`,
      name: pj?.tilesetName || `${baseName} (${tw}×${th})`,
      tileWidth: tw,
      tileHeight: th,
      tiles: sliced.tiles,
    };
    state.tilesets = [ts];
    state.activeTilesetId = ts.id;
    state.activeTileIndex = ts.tiles.length > 1 ? 1 : 0;

    if (pj || createLayerFlag) {
      const layer = state.layers[0];
      const cols = Math.max(1, Math.ceil(dstW / tw));
      const rows = Math.max(1, Math.ceil(dstH / th));
      layer.type = "tilemap";
      layer.tilesetId = ts.id;
      layer.tileWidth = tw;
      layer.tileHeight = th;
      layer.tileGrid = pj ? cloneGrid(pj.tileGrid) : createEmptyTileGrid(cols, rows);
      ensureLayerTileGridDimensions(layer);
      syncTilemapLayerToGrid(layer);
      state.tilemapMode = "tiles";
    }

    populateThemeSelect();
    buildPaletteUI();
    renderCustomPaletteUI();
    updateResolutionButtons(dstW, dstH);
    applyZoom(1);
    syncActiveLayerGrid();
    notify("tilemap:showPanel", { visible: true, silent: true, auto: true });
    renderLayersUI();
    notify("tilemap:render");
    renderAll();
    syncActiveTabSnapshot(baseName);

    const tileCount = ts.tiles.length - 1;
    closeTilemapImportModal();
    if (pj) {
      setStatus({ key: "log.tm_imported_full", params: { name: baseName, tiles: tileCount, cols: pj.cols, rows: pj.rows } });
    } else {
      setStatus({ key: "log.tm_imported_tileset", params: { name: ts.name, tiles: tileCount, w: tw, h: th } });
    }
    return;
  }

  // Modo "current": agregar al proyecto actual
  pushState();
  state.isDirtySinceImport = true;
  if (pj && resizeCanvasFlag) {
    const dstW = Math.max(4, Math.min(MAX_GRID_DIM, pj.cols * tw));
    const dstH = Math.max(4, Math.min(MAX_GRID_DIM, pj.rows * th));
    resizeAllProjectLayersKeepingContent(dstW, dstH);
    updateResolutionButtons(dstW, dstH);
  }

  let ts = null;
  if (pngImgData) {
    const sliced = sliceImageDataToTiles(pngImgData, {
      tileWidth: tw,
      tileHeight: th,
      maxTiles: pj ? pj.tileCount : null,
      skipEmpty: !pj && skipEmpty,
      dedupe: !pj && dedupe,
      paletteMap: state.paletteMap,
      customColorIndices: state.customColorIndices,
    });
    if (!Array.isArray(state.tilesets)) state.tilesets = [];
    ts = {
      id: `ts_${Date.now()}_${importSeq++}`,
      name: pj?.tilesetName || pngBaseName || `Tileset ${tw}×${th}`,
      tileWidth: tw,
      tileHeight: th,
      tiles: sliced.tiles,
    };
    state.tilesets.push(ts);
    state.activeTilesetId = ts.id;
    state.activeTileIndex = ts.tiles.length > 1 ? 1 : 0;
    buildPaletteUI();
    renderCustomPaletteUI();
  } else {
    ts = getActiveTileset();
    if (!ts || ts.tileWidth !== tw || ts.tileHeight !== th) {
      closeTilemapImportModal();
      return;
    }
  }

  if (pj || createLayerFlag) {
    const { w, h } = getGridDims();
    const cols = Math.max(1, Math.ceil(w / tw));
    const rows = Math.max(1, Math.ceil(h / th));
    const insertAt = Math.min(state.layers.length, state.activeLayerIndex + 1);
    const makeLayer = (isCurrentFrame) => {
      const layerObj = {
        id: `layer_${Date.now()}_${importSeq++}`,
        name: baseName,
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "source-over",
        type: "tilemap",
        tilesetId: ts.id,
        tileWidth: tw,
        tileHeight: th,
        tileGrid: isCurrentFrame && pj ? cloneGrid(pj.tileGrid) : createEmptyTileGrid(cols, rows),
        grid: createEmptyGrid(w, h),
        outOfBounds: [],
      };
      ensureLayerTileGridDimensions(layerObj);
      syncTilemapLayerToGrid(layerObj);
      return layerObj;
    };

    if (Array.isArray(state.frames) && state.frames.length > 0) {
      state.frames.forEach((f, fIdx) => {
        if (!Array.isArray(f.layers)) f.layers = [];
        const layerObj = makeLayer(fIdx === state.activeFrameIndex);
        f.layers.splice(insertAt, 0, layerObj);
        if (fIdx === state.activeFrameIndex) state.layers = f.layers;
      });
    } else {
      state.layers.splice(insertAt, 0, makeLayer(true));
    }
    state.activeLayerIndex = insertAt;
    state.tilemapMode = "tiles";
  }

  syncActiveLayerGrid();
  notify("tilemap:showPanel", { visible: true, silent: true, auto: true });
  renderLayersUI();
  notify("tilemap:render");
  renderAll();

  const tileCount = ts.tiles.length - 1;
  closeTilemapImportModal();
  if (pngImgData && pj) {
    setStatus({ key: "log.tm_imported_full", params: { name: baseName, tiles: tileCount, cols: pj.cols, rows: pj.rows } });
  } else if (pngImgData) {
    setStatus({ key: "log.tm_imported_tileset", params: { name: ts.name, tiles: tileCount, w: tw, h: th } });
  } else if (pj) {
    setStatus({ key: "log.tm_imported_map", params: { name: baseName, cols: pj.cols, rows: pj.rows } });
  }
}
