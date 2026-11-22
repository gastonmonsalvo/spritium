/**
 * spriteActions.js: Casos de uso de sprite (importación externa, generación IA, historial, resolución y descarga).
 */

import {
  fetchHistory,
  requestLoadSprite,
  requestUploadImage,
} from "../core/api.js";
import {
  state,
  MAX_GRID_DIM,
  pushState,
  setGridSize,
  getGridDims,
  cloneGrid,
  cloneLayers,
  clonePaletteMap,
  notify,
} from "../core/state.js";
import { renderAll, applyZoom } from "../canvas/canvas.js";
import { setStatus, updateResolutionButtons } from "../ui/index.js";
import { i18n } from "../i18n/I18nService.js";
import {
  manualCustomIndices,
  populateThemeSelect,
  buildPaletteUI,
  renderCustomPaletteUI,
} from "./paletteManager.js";
import { resetLayersWithGrid, syncActiveLayerGrid, addNewLayer } from "./layers.js";
import { resetFramesWithCurrentLayers, syncActiveFrame } from "./frames.js";
import { ensureLayerTileGridDimensions, syncTilemapLayerToGrid } from "../state/TilemapModel.js";
import { saveRecentProject } from "../core/storage.js";
import { openNewDocTab, syncActiveTabSnapshot } from "./docTabs.js";
import { showConfirmDialog } from "../ui/modals/ConfirmModal.js";

/**
 * Actualiza la lista del historial local si existe el selector en el DOM.
 */
export async function refreshHistoryList() {
  const sel = document.getElementById("historySelect");
  if (!sel) return;
  try {
    const data = await fetchHistory();
    sel.innerHTML = "";
    data.files.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.path;
      opt.textContent = `${f.category} / ${f.name}`;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error("Error historial:", e);
  }
}

/**
 * Procesa e importa una imagen externa al lienzo con cuantización y dithering opcionales.
 * @param {File} file
 * @param {Object} [options={}]
 */
export async function handleUploadExternalFile(file, options = {}) {
  if (!file) return;
  if (!/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
    setStatus({ key: "log.img_bad_fmt" }, true);
    return;
  }

  const assetNameInput = document.getElementById("assetName");
  const assetName =
    options.assetName?.trim() ||
    assetNameInput?.value.trim() ||
    file.name.replace(/\.[^/.]+$/, "") ||
    "imported_asset";

  const requestedTheme = options.paletteTheme ?? (
    state.currentThemeKey && state.currentThemeKey !== "original"
      ? state.currentThemeKey
      : "original"
  );
  const quantize =
    options.quantize !== undefined
      ? Boolean(options.quantize) && requestedTheme !== "original"
      : Boolean(state.quantizeOnUpload) && requestedTheme !== "original";
  const dither = options.dither !== undefined ? Boolean(options.dither) : state.ditherEnabled;

  const resSelect = document.getElementById("uploadResolutionSelect");
  const keepNativeSize =
    options.keepNativeSize !== undefined
      ? Boolean(options.keepNativeSize)
      : !options.asNewLayer && !options.targetSize && !options.targetWidth && !options.targetHeight && !options.pixelArtConvert;
  const fallbackSize = Number(options.targetSize || resSelect?.value || state.gridSize || 64) || 64;
  const targetWidth = Math.max(4, Math.min(MAX_GRID_DIM, Math.round(Number(options.targetWidth || fallbackSize) || 64)));
  const targetHeight = Math.max(4, Math.min(MAX_GRID_DIM, Math.round(Number(options.targetHeight || fallbackSize) || 64)));
  const targetSize = Math.max(targetWidth, targetHeight);
  const pixelArtConvert = Boolean(options.pixelArtConvert);
  const pixelSnapper = Boolean(options.pixelSnapper);
  const removeBackground = Boolean(options.removeBackground);

  setStatus(
    pixelArtConvert
      ? { key: "log.img_convert_pa", params: { w: targetWidth, h: targetHeight } }
      : keepNativeSize
        ? { key: "log.img_open_native" }
        : { key: "log.img_importing", params: { w: targetWidth, h: targetHeight } },
  );

  try {
    const data = await requestUploadImage(file, {
      assetName,
      paletteTheme: requestedTheme,
      quantize,
      dither,
      targetSize,
      targetWidth,
      targetHeight,
      pixelArtConvert,
      pixelSnapper,
      removeBackground,
      keepNativeSize,
    });

    if (!options.asNewLayer && !options.reuseActiveTab) {
      openNewDocTab(assetName);
      options._tabOpened = true;
    }

    if (options.asNewLayer) {
      // Importar al lienzo actual como capa nueva integrando colores a la paleta activa
      const remap = new Map();
      const existingByHex = new Map();
      for (const [idxStr, col] of Object.entries(state.paletteMap)) {
        if (Number(idxStr) !== 0 && col) existingByHex.set(col.toLowerCase(), Number(idxStr));
      }
      let maxIdx = Math.max(39, ...Object.keys(state.paletteMap).map(Number).filter((n) => n < 9000));
      let { w: gw, h: gh } = getGridDims();
      const srcH = data.grid.length;
      const srcW = data.grid[0]?.length || 0;
      if (
        (srcW > gw || srcH > gh) &&
        srcW <= MAX_GRID_DIM &&
        srcH <= MAX_GRID_DIM &&
        (await showConfirmDialog({
          title: i18n.t("import.confirm_expand_title"),
          message: i18n.t("import.confirm_expand_canvas", { imgW: srcW, imgH: srcH, curW: gw, curH: gh }),
          confirmText: i18n.t("import.confirm_expand_yes"),
          cancelText: i18n.t("import.confirm_expand_no"),
        }))
      ) {
        await changeResolution(Math.max(gw, srcW), Math.max(gh, srcH));
        ({ w: gw, h: gh } = getGridDims());
      }
      const newGrid = Array.from({ length: gh }, () => new Array(gw).fill(0));
      const newOutOfBounds = [];
      const offX = srcW !== gw ? Math.floor((gw - srcW) / 2) : 0;
      const offY = srcH !== gh ? Math.floor((gh - srcH) / 2) : 0;

      for (let sy = 0; sy < srcH; sy++) {
        const dy = sy + offY;
        for (let sx = 0; sx < srcW; sx++) {
          const dx = sx + offX;
          const srcIdx = data.grid[sy][sx];
          if (!srcIdx || srcIdx === 0) continue;
          let mapped = remap.get(srcIdx);
          if (mapped === undefined) {
            const hex = data.palette?.[srcIdx]?.toLowerCase();
            if (!hex) {
              mapped = 0;
            } else if (existingByHex.has(hex)) {
              mapped = existingByHex.get(hex);
            } else {
              maxIdx += 1;
              state.paletteMap[maxIdx] = hex;
              existingByHex.set(hex, maxIdx);
              if (!state.customColorIndices.includes(maxIdx)) {
                state.customColorIndices.push(maxIdx);
              }
              mapped = maxIdx;
            }
            remap.set(srcIdx, mapped);
          }
          if (!mapped) continue;
          if (dx >= 0 && dx < gw && dy >= 0 && dy < gh) {
            newGrid[dy][dx] = mapped;
          } else {
            newOutOfBounds.push([dx, dy, mapped]);
          }
        }
      }

      state.sourceImageFile = file;
      state.sourceImportOptions = {
        keepNativeSize,
        targetSize,
        targetWidth,
        targetHeight,
        pixelArtConvert,
        pixelSnapper,
        removeBackground,
        paletteTheme: requestedTheme,
        dither,
      };
      state.originalImport = null;
      state.isDirtySinceImport = true;
      state.resBaseSnapshot = null;
      addNewLayer(assetName || i18n.t("default.imported_name"), newGrid);
      const importedLayer = state.layers?.[state.activeLayerIndex];
      if (importedLayer && newOutOfBounds.length > 0) {
        importedLayer.outOfBounds = newOutOfBounds;
      }
      populateThemeSelect();
      buildPaletteUI();
      renderCustomPaletteUI();
      renderAll();
      setStatus({ key: "log.img_layer_added", params: { name: assetName || i18n.t("default.imported_name") } });
      return;
    }

    pushState();
    state.sourceImageFile = file;
    state.sourceImportOptions = {
      keepNativeSize,
      targetSize,
      targetWidth,
      targetHeight,
      pixelArtConvert,
      pixelSnapper,
      removeBackground,
      paletteTheme: requestedTheme,
      dither,
    };
    state.hasCustomReducedPalette = false;
    state.resBaseSnapshot = null;
    state.isDirtySinceImport = false;
    state.customColorIndices = [];
    manualCustomIndices.clear();
    const dstW = data.width || data.size || targetSize;
    const dstH = data.height || data.size || targetSize;
    setGridSize(dstW, dstH);
    resetLayersWithGrid(data.grid, "Base");
    resetFramesWithCurrentLayers();
    state.paletteMap = data.palette || { 0: null };

    if (data.quantized) {
      state.originalImport = null;
      state.currentThemeKey = data.theme || requestedTheme;
    } else {
      state.originalImport = {
        size: state.gridSize,
        width: dstW,
        height: dstH,
        grid: cloneGrid(data.grid),
        paletteMap: clonePaletteMap(state.paletteMap),
      };
      state.currentThemeKey = "original";
    }

    const validIndices = Object.keys(state.paletteMap)
      .map(Number)
      .filter((n) => n > 0 && n !== 9999 && Boolean(state.paletteMap[n]))
      .sort((a, b) => a - b);
    state.currentColorIndex = validIndices[0] ?? 1;
    if (!state.paletteMap[state.secondaryColorIndex]) {
      state.secondaryColorIndex = validIndices[1] ?? validIndices[0] ?? 0;
    }
    populateThemeSelect();
    buildPaletteUI();
    renderCustomPaletteUI();
    updateResolutionButtons(dstW, dstH);
    applyZoom(1);
    renderAll();

    const colorCount = validIndices.length;
    setStatus(
      data.quantized
        ? { key: "log.img_quantized", params: { theme: requestedTheme, count: colorCount } }
        : { key: "log.img_imported", params: { count: colorCount, w: dstW, h: dstH } },
    );
    const nameEl = document.getElementById("assetName");
    if (nameEl) nameEl.value = assetName;
    syncActiveTabSnapshot(assetName);
    await saveRecentProject();
    await refreshHistoryList();
  } catch (err) {
    setStatus({ key: "log.img_import_err", params: { msg: err.message } }, true);
  }
}

/**
 * Carga el sprite seleccionado del historial local.
 */
export async function loadSelectedSprite() {
  const sel = document.getElementById("historySelect");
  if (!sel || !sel.value) return;

  setStatus({ key: "log.sprite_loading" });
  try {
    const data = await requestLoadSprite(sel.value);
    pushState();

    state.originalImport = null;
    state.isDirtySinceImport = false;
    state.customColorIndices = [];
    setGridSize(data.size);
    resetLayersWithGrid(data.grid, "Base");
    resetFramesWithCurrentLayers();

    if (data.palette) {
      state.paletteMap = data.palette;
    } else {
      const targetTheme =
        state.currentThemeKey === "original"
          ? Object.keys(state.themesCatalog)[0] || "db32"
          : state.currentThemeKey;
      state.currentThemeKey = targetTheme;
      if (state.themesCatalog[targetTheme]) {
        state.paletteMap = { 0: null, ...clonePaletteMap(state.themesCatalog[targetTheme].colors) };
      }
    }

    populateThemeSelect();
    buildPaletteUI();
    renderCustomPaletteUI();
    updateResolutionButtons(data.size);
    renderAll();
    setStatus({ key: "log.sprite_loaded", params: { size: data.size } });
  } catch (err) {
    setStatus({ key: "log.sprite_load_err", params: { msg: err.message } }, true);
  }
}

function sampleDominantBlockColor(oldGrid, oldSize, targetSize, x, y) {
  const xStart = Math.floor((x * oldSize) / targetSize);
  const xEnd = Math.max(xStart + 1, Math.ceil(((x + 1) * oldSize) / targetSize));
  const yStart = Math.floor((y * oldSize) / targetSize);
  const yEnd = Math.max(yStart + 1, Math.ceil(((y + 1) * oldSize) / targetSize));

  const counts = new Map();
  let bestColor = 0;
  let bestCount = 0;

  for (let sy = yStart; sy < Math.min(oldSize, yEnd); sy++) {
    const srcRow = oldGrid[sy];
    for (let sx = xStart; sx < Math.min(oldSize, xEnd); sx++) {
      const c = srcRow[sx];
      if (c === 0) continue;
      const nextCount = (counts.get(c) || 0) + 1;
      counts.set(c, nextCount);
      if (nextCount > bestCount) {
        bestCount = nextCount;
        bestColor = c;
      }
    }
  }
  return bestColor;
}

/**
 * Redimensiona o remuestrea todas las capas y frames a la resolución objetivo.
 * @param {number} targetSize
 */
export async function changeResolution(targetWidth, targetHeight = targetWidth) {
  const dstW = Math.max(4, Math.min(MAX_GRID_DIM, Math.round(Number(targetWidth) || 64)));
  const dstH = Math.max(4, Math.min(MAX_GRID_DIM, Math.round(Number(targetHeight) || dstW)));
  const { w: curW, h: curH } = getGridDims();
  if (curW === dstW && curH === dstH) return;
  const prevResBase = state.resBaseSnapshot;
  pushState();
  state.resBaseSnapshot = prevResBase;

  // Redimensionar / remuestrear capas desde resBaseSnapshot (sin re-ejecutar quitar fondo ni re-cuantizar)
  syncActiveFrame();
  if (!state.resBaseSnapshot) {
    state.resBaseSnapshot = {
      size: state.gridSize,
      w: curW,
      h: curH,
      frames: state.frames.map((f) => ({
        id: f.id,
        durationMs: f.durationMs,
        activeLayerIndex: f.activeLayerIndex,
        layers: cloneLayers(f.layers),
      })),
    };
  }

  const srcW = state.resBaseSnapshot.w || state.resBaseSnapshot.size;
  const srcH = state.resBaseSnapshot.h || state.resBaseSnapshot.size;
  const srcFrames = state.resBaseSnapshot.frames;

  const resampleGrid = (oldGrid) => {
    if (dstW === srcW && dstH === srcH) return cloneGrid(oldGrid);
    const newGrid = [];
    if (dstW === dstH && srcW === srcH && dstW < srcW) {
      for (let y = 0; y < dstH; y++) {
        const row = new Array(dstW);
        for (let x = 0; x < dstW; x++) {
          row[x] = sampleDominantBlockColor(oldGrid, srcW, dstW, x, y);
        }
        newGrid.push(row);
      }
    } else {
      for (let y = 0; y < dstH; y++) {
        const row = new Array(dstW);
        const srcY = Math.min(srcH - 1, Math.floor((y * srcH) / dstH));
        for (let x = 0; x < dstW; x++) {
          const srcX = Math.min(srcW - 1, Math.floor((x * srcW) / dstW));
          row[x] = oldGrid[srcY]?.[srcX] ?? 0;
        }
        newGrid.push(row);
      }
    }
    return newGrid;
  };

  setGridSize(dstW, dstH);
  for (let fi = 0; fi < state.frames.length; fi++) {
    const srcFrame = srcFrames[fi] || state.frames[fi];
    for (let li = 0; li < state.frames[fi].layers.length; li++) {
      const lObj = state.frames[fi].layers[li];
      const srcLayer = srcFrame.layers[li] || lObj;
      if (!lObj || lObj.type === "folder") continue;
      if (lObj.type === "tilemap") {
        if (srcLayer?.tileGrid) {
          lObj.tileGrid = cloneGrid(srcLayer.tileGrid);
        }
        ensureLayerTileGridDimensions(lObj);
        syncTilemapLayerToGrid(lObj);
      } else if (srcLayer?.grid) {
        lObj.grid = resampleGrid(srcLayer.grid);
      }
    }
  }
  state.layers = state.frames[state.activeFrameIndex].layers;
  syncActiveLayerGrid();
  notify("tilemap:render");
  state.selection = null;
  updateResolutionButtons(dstW, dstH);
  applyZoom(state.zoom || 1);
  setStatus({ key: "log.res_changed", params: { w: dstW, h: dstH } });
}

/**
 * Compone las capas visibles del frame activo y descarga la imagen como PNG.
 */
export function downloadCurrent() {
  const { w, h } = getGridDims();
  const offCanvas = document.createElement("canvas");
  offCanvas.width = w;
  offCanvas.height = h;
  const offCtx = offCanvas.getContext("2d");

  for (const layer of state.layers) {
    if (!layer.visible || !layer.grid) continue;
    const alpha = layer.opacity ?? 1;
    if (alpha <= 0) continue;
    offCtx.save();
    offCtx.globalAlpha = alpha;
    offCtx.globalCompositeOperation = layer.blendMode || "source-over";
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = layer.grid[y]?.[x];
        if (idx !== 0 && state.paletteMap[idx]) {
          offCtx.fillStyle = state.paletteMap[idx];
          offCtx.fillRect(x, y, 1, 1);
        }
      }
    }
    offCtx.globalCompositeOperation = "source-over";
    offCtx.restore();
  }

  const name = document.getElementById("assetName")?.value || "sprite";
  const link = document.createElement("a");
  link.download = `${name}_${w}x${h}.png`;
  link.href = offCanvas.toDataURL("image/png");
  link.click();
  setStatus({ key: "log.png_saved", params: { name: link.download } });
}
