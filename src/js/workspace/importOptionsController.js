/**
 * importOptionsController.js: Controlador del modal de opciones de importación de imagen (#importOptionsModal).
 */

import { requestUploadImage } from "../core/api.js";
import { parseColorToRgba, hasPaintedPixels } from "../core/color.js";
import { state, MAX_GRID_DIM } from "../core/state.js";
import { populatePaletteSelectOptions } from "./paletteManager.js";
import { setStatus } from "../ui/index.js";
import { i18n } from "../i18n/I18nService.js";
import { handleUploadExternalFile } from "./spriteActions.js";

let pendingImportFile = null;
let pendingImportReuseTab = false;
let importPreviewTimer = null;
let importPreviewSeq = 0;

async function buildCurrentCanvasPngFile() {
  if (typeof document === "undefined") return null;
  const w = Math.max(1, state.gridWidth || state.gridSize || 64);
  const h = Math.max(1, state.gridHeight || state.gridSize || w);
  const layers = state.originalImport?.grid
    ? [{ visible: true, grid: state.originalImport.grid }]
    : (state.layers || []).filter((l) => l?.visible !== false && l?.grid && l.type !== "folder");
  const pal = state.originalImport?.paletteMap || state.paletteMap || {};
  const srcW = state.originalImport?.width || state.originalImport?.size || w;
  const srcH = state.originalImport?.height || state.originalImport?.size || h;

  const canvas = document.createElement("canvas");
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(srcW, srcH);
  for (const layer of layers) {
    for (let y = 0; y < srcH; y++) {
      const row = layer.grid[y];
      if (!row) continue;
      for (let x = 0; x < srcW; x++) {
        const idx = row[x] || 0;
        if (!idx) continue;
        const rgba = parseColorToRgba(pal[idx]);
        if (!rgba) continue;
        const o = (y * srcW + x) * 4;
        img.data[o] = rgba[0];
        img.data[o + 1] = rgba[1];
        img.data[o + 2] = rgba[2];
        img.data[o + 3] = rgba[3];
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return null;
  const nameEl = /** @type {HTMLInputElement|null} */ (document.getElementById("assetName"));
  const baseName = (nameEl?.value || "sprite").trim() || "sprite";
  return new File([blob], `${baseName}.png`, { type: "image/png" });
}

/**
 * Reabre el modal de configuración de importación sobre la imagen original del documento actual.
 */
export async function reopenImportOptionsModal() {
  let file = state.sourceImageFile;
  if (!file) {
    const hasPixels =
      Boolean(state.originalImport?.grid) ||
      (state.layers || []).some((l) => l?.grid && hasPaintedPixels(l.grid));
    if (!hasPixels) {
      setStatus({ key: "log.reimport_none" }, true);
      return;
    }
    file = await buildCurrentCanvasPngFile();
    if (!file) {
      setStatus({ key: "log.reimport_none" }, true);
      return;
    }
    state.sourceImageFile = file;
  }
  openImportModal(file, { asNewLayer: false, isReimport: true });
}

function syncCustomResRowVisibility() {
  const resSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById("importResSelect"));
  const customRow = document.getElementById("importCustomResRow");
  if (!customRow) return;
  customRow.style.display = resSelect?.value === "custom" ? "grid" : "none";
}

function clampImportDim(raw, fallback = 64) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(4, Math.min(MAX_GRID_DIM, n));
}

/**
 * Abre el modal de opciones de importación para un archivo de imagen.
 * @param {File} file
 * @param {{asNewLayer?: boolean, isReimport?: boolean}} [options]
 */
export function openImportModal(file, { asNewLayer = false, isReimport = false } = {}) {
  if (!file) return;
  pendingImportFile = file;
  pendingImportReuseTab = Boolean(isReimport);

  const canvasIsEmpty =
    state.frames.length <= 1 &&
    state.layers.length === 1 &&
    state.layers[0]?.type !== "tilemap" &&
    !(state.layers[0]?.grid && hasPaintedPixels(state.layers[0].grid));
  const defaultAsNewLayer = !isReimport && Boolean(asNewLayer) && !canvasIsEmpty;
  const savedOpts = isReimport ? state.sourceImportOptions : null;

  const modal = document.getElementById("importOptionsModal");
  const titleEl = document.getElementById("importModalTitle");
  const nameInput = /** @type {HTMLInputElement|null} */ (document.getElementById("importAssetName"));
  const modeSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById("importModeSelect"));
  const resSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById("importResSelect"));
  const themeSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById("importThemeSelect"));
  const ditherChk = /** @type {HTMLInputElement|null} */ (document.getElementById("importDitherChk"));

  if (titleEl) {
    titleEl.textContent = i18n.t(defaultAsNewLayer ? "import.title_layer" : "import.title_project");
  }
  if (nameInput) {
    nameInput.value = file.name.replace(/\.[^/.]+$/, "") || "imported_asset";
  }
  if (modeSelect) {
    modeSelect.value = defaultAsNewLayer ? "layer" : "project";
  }
  const customWInput = /** @type {HTMLInputElement|null} */ (document.getElementById("importCustomW"));
  const customHInput = /** @type {HTMLInputElement|null} */ (document.getElementById("importCustomH"));
  if (customWInput) {
    customWInput.value = String(clampImportDim(savedOpts?.targetWidth ?? savedOpts?.targetSize, state.gridWidth || state.gridSize || 64));
  }
  if (customHInput) {
    customHInput.value = String(clampImportDim(savedOpts?.targetHeight ?? savedOpts?.targetSize, state.gridHeight || state.gridSize || 64));
  }
  if (resSelect) {
    if (!savedOpts || savedOpts.keepNativeSize) {
      resSelect.value = "native";
    } else {
      const savedW = savedOpts.targetWidth ?? savedOpts.targetSize;
      const savedH = savedOpts.targetHeight ?? savedOpts.targetSize;
      const presetVal = savedW === savedH ? String(savedW || 64) : "";
      const hasPreset = presetVal && Array.from(resSelect.options).some((o) => o.value === presetVal);
      resSelect.value = hasPreset ? presetVal : "custom";
    }
    if (!resSelect.value) resSelect.value = "native";
    resSelect.disabled = false;
  }
  syncCustomResRowVisibility();
  const convertChk = /** @type {HTMLInputElement|null} */ (document.getElementById("importConvertPixelArtChk"));
  if (convertChk) {
    convertChk.checked = Boolean(savedOpts?.pixelArtConvert);
  }
  const snapperChk = /** @type {HTMLInputElement|null} */ (document.getElementById("importPixelSnapperChk"));
  if (snapperChk) {
    snapperChk.checked = Boolean(savedOpts?.pixelSnapper);
  }
  const removeBgChk = /** @type {HTMLInputElement|null} */ (document.getElementById("importRemoveBgChk"));
  if (removeBgChk) {
    removeBgChk.checked = Boolean(savedOpts?.removeBackground);
  }
  if (themeSelect) {
    populatePaletteSelectOptions(themeSelect, {
      includeOriginal: true,
      selectedValue: savedOpts?.paletteTheme
        ? savedOpts.paletteTheme
        : state.quantizeOnUpload && state.currentThemeKey !== "original"
          ? state.currentThemeKey
          : "original",
    });
  }
  if (ditherChk) {
    ditherChk.checked = savedOpts ? Boolean(savedOpts.dither) : Boolean(state.ditherEnabled);
  }

  if (modeSelect) {
    modeSelect.onchange = () => {
      const isLayer = modeSelect.value === "layer";
      if (titleEl) titleEl.textContent = i18n.t(isLayer ? "import.title_layer" : "import.title_project");
      scheduleImportPreview();
    };
  }
  if (modal) modal.classList.add("open");
  scheduleImportPreview();
}

function readImportFormOptions() {
  const assetName = /** @type {HTMLInputElement|null} */ (document.getElementById("importAssetName"))?.value.trim();
  const mode = /** @type {HTMLSelectElement|null} */ (document.getElementById("importModeSelect"))?.value || "project";
  const asNewLayer = mode === "layer";
  const rawRes = /** @type {HTMLSelectElement|null} */ (document.getElementById("importResSelect"))?.value || "native";
  const keepNativeSize = rawRes === "native";
  const isCustom = rawRes === "custom";
  const fallbackW = state.gridWidth || state.gridSize || 64;
  const fallbackH = state.gridHeight || state.gridSize || 64;
  const targetWidth = keepNativeSize
    ? null
    : isCustom
      ? clampImportDim(/** @type {HTMLInputElement|null} */ (document.getElementById("importCustomW"))?.value, fallbackW)
      : clampImportDim(rawRes, fallbackW);
  const targetHeight = keepNativeSize
    ? null
    : isCustom
      ? clampImportDim(/** @type {HTMLInputElement|null} */ (document.getElementById("importCustomH"))?.value, fallbackH)
      : clampImportDim(rawRes, fallbackH);
  const targetSize = keepNativeSize ? state.gridSize || 64 : Math.max(targetWidth, targetHeight);
  const pixelArtConvert = Boolean(/** @type {HTMLInputElement|null} */ (document.getElementById("importConvertPixelArtChk"))?.checked);
  const pixelSnapper = Boolean(/** @type {HTMLInputElement|null} */ (document.getElementById("importPixelSnapperChk"))?.checked);
  const removeBackground = Boolean(/** @type {HTMLInputElement|null} */ (document.getElementById("importRemoveBgChk"))?.checked);
  const paletteTheme = /** @type {HTMLSelectElement|null} */ (document.getElementById("importThemeSelect"))?.value || "original";
  const dither = Boolean(/** @type {HTMLInputElement|null} */ (document.getElementById("importDitherChk"))?.checked);
  return {
    assetName,
    asNewLayer,
    targetSize,
    targetWidth,
    targetHeight,
    keepNativeSize,
    pixelArtConvert,
    pixelSnapper,
    removeBackground,
    paletteTheme,
    quantize: paletteTheme !== "original",
    dither,
    reuseActiveTab: pendingImportReuseTab,
  };
}

function drawImportPreviewData(data) {
  const canvas = /** @type {HTMLCanvasElement|null} */ (document.getElementById("importPreviewCanvas"));
  const metaEl = document.getElementById("importPreviewMeta");
  if (!canvas || !data?.grid?.length) return;

  const h = data.height || data.grid.length;
  const w = data.width || data.grid[0]?.length || 1;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const img = ctx.createImageData(w, h);
  const buf = img.data;
  const rgbaCache = new Map();
  for (let y = 0; y < h; y++) {
    const row = data.grid[y];
    for (let x = 0; x < w; x++) {
      const idx = row?.[x] || 0;
      if (!idx) continue;
      let rgba = rgbaCache.get(idx);
      if (!rgba) {
        const hex = data.palette?.[idx];
        rgba = hex ? parseColorToRgba(hex) : [0, 0, 0, 0];
        rgbaCache.set(idx, rgba);
      }
      const o = (y * w + x) * 4;
      buf[o] = rgba[0];
      buf[o + 1] = rgba[1];
      buf[o + 2] = rgba[2];
      buf[o + 3] = rgba[3];
    }
  }
  ctx.putImageData(img, 0, 0);

  if (metaEl) {
    const colorCount = Object.keys(data.palette || {}).filter((k) => Number(k) !== 0).length;
    metaEl.textContent = `${w}×${h} · ${i18n.t("modal.import.colors", { count: colorCount })}`;
  }
}

function scheduleImportPreview() {
  if (!pendingImportFile) return;
  if (importPreviewTimer) clearTimeout(importPreviewTimer);
  const metaEl = document.getElementById("importPreviewMeta");
  if (metaEl) metaEl.textContent = "...";

  const seq = ++importPreviewSeq;
  importPreviewTimer = setTimeout(async () => {
    importPreviewTimer = null;
    const file = pendingImportFile;
    if (!file) return;
    try {
      const opts = readImportFormOptions();
      const data = await requestUploadImage(file, { ...opts, saveToHistory: false });
      if (seq !== importPreviewSeq || !pendingImportFile) return;
      drawImportPreviewData(data);
    } catch {
      if (seq === importPreviewSeq && metaEl) metaEl.textContent = "—";
    }
  }, 60);
}

/**
 * Cierra el modal de opciones de importación.
 */
export function closeImportModal() {
  pendingImportFile = null;
  const modal = document.getElementById("importOptionsModal");
  if (modal) modal.classList.remove("open");
}

/**
 * Conecta los eventos de previsualización y envío del modal de opciones de importación.
 * @param {() => void} [onImported]
 */
export function initImportOptionsModal(onImported) {
  const importForm = document.getElementById("importOptionsForm");
  if (!importForm) return;
  const previewInputIds = [
    "importResSelect",
    "importThemeSelect",
    "importConvertPixelArtChk",
    "importPixelSnapperChk",
    "importRemoveBgChk",
    "importDitherChk",
  ];
  for (const id of previewInputIds) {
    document.getElementById(id)?.addEventListener("change", () => {
      if (id === "importResSelect") syncCustomResRowVisibility();
      scheduleImportPreview();
    });
  }
  for (const id of ["importCustomW", "importCustomH"]) {
    document.getElementById(id)?.addEventListener("input", scheduleImportPreview);
    document.getElementById(id)?.addEventListener("change", scheduleImportPreview);
  }

  importForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = pendingImportFile;
    if (!file) {
      closeImportModal();
      return;
    }
    const opts = readImportFormOptions();
    closeImportModal();
    await handleUploadExternalFile(file, opts);
    if (typeof onImported === "function") onImported();
  });
}
