/**
 * api.js: Adaptador Client-Side puro (sin backend Python).
 * Provee configuración de paletas, procesamiento local de imágenes, reducción adaptativa
 * e historial privado en localStorage.
 */

import { THEME_PALETTES, getThemesConfig } from "./palettes.js";
import {
  prepareExternalSprite,
  loadRawSpriteImageData,
  removeConnectedBackground,
  imageDataToDynamicGrid,
  quantizeImageDataToPalette,
  reduceGridColorsClient,
} from "./imageProcessor.js";
import { snapMessyPixelArt } from "./pixelSnapper.js";
import { MAX_GRID_DIM } from "./stateStore.js";
import {
  resolveImportTargetDims,
  buildSpriteHistoryList,
  buildUploadedAssetResult,
} from "./apiCore.js";

const LOCAL_SPRITES_KEY = "spritium_local_sprites_v1";

function readLocalSprites() {
  try {
    const raw = localStorage.getItem(LOCAL_SPRITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSpriteToLocalHistory(name, size, grid, palette) {
  try {
    const next = buildSpriteHistoryList(readLocalSprites(), { name, size, grid, palette }, 10);
    localStorage.setItem(LOCAL_SPRITES_KEY, JSON.stringify(next));
  } catch {
    // Ignorar si se supera la cuota de localStorage
  }
}

/**
 * Obtiene el catálogo inicial de paletas y la paleta por defecto.
 */
export async function fetchConfig() {
  return getThemesConfig();
}

/**
 * Lista los sprites guardados en el historial local (localStorage).
 */
export async function fetchHistory() {
  const files = readLocalSprites().map(({ name, category, path }) => ({
    name,
    category,
    path,
  }));
  return { files };
}

/**
 * Procesa una imagen externa (conversión pixel-art opcional y cuantización a paleta) y la guarda localmente.
 * @param {File} file
 * @param {{assetName?: string, paletteTheme?: string, quantize?: boolean, dither?: boolean, targetSize?: number, pixelArtConvert?: boolean, pixelSnapper?: boolean, removeBackground?: boolean, keepNativeSize?: boolean, customPalette?: Object|null}} [options]
 * @returns {Promise<{ok: boolean, asset: Object, quantized: boolean}>}
 */
export async function requestUploadImage(
  file,
  {
    assetName = "imported_asset",
    paletteTheme = "original",
    quantize = false,
    dither = false,
    targetSize = 64,
    targetWidth = null,
    targetHeight = null,
    pixelArtConvert = false,
    pixelSnapper = false,
    removeBackground = false,
    keepNativeSize = false,
    customPalette = null,
    saveToHistory = true,
  } = {},
) {
  let imgData;
  let width;
  let height;
  const { w: resolvedW, h: resolvedH } = resolveImportTargetDims(
    { targetSize, targetWidth, targetHeight },
    MAX_GRID_DIM,
  );

  if (pixelSnapper) {
    const raw = await loadRawSpriteImageData(file, null, null);
    const cleaned = removeBackground ? removeConnectedBackground(raw.imgData, 40) : raw.imgData;
    const snapped = snapMessyPixelArt(cleaned, {
      targetSize: keepNativeSize ? null : Math.max(resolvedW, resolvedH),
      maxColors: 32,
    });
    imgData = snapped.imgData;
    width = snapped.width;
    height = snapped.height;
  } else if (keepNativeSize && !pixelArtConvert) {
    const raw = await loadRawSpriteImageData(file, null, null);
    imgData = removeBackground ? removeConnectedBackground(raw.imgData, 40) : raw.imgData;
    width = raw.width;
    height = raw.height;
  } else if (pixelArtConvert || removeBackground) {
    imgData = await prepareExternalSprite(file, resolvedW, {
      removeBackground,
      targetWidth: resolvedW,
      targetHeight: resolvedH,
    });
    width = resolvedW;
    height = resolvedH;
  } else {
    const raw = await loadRawSpriteImageData(file, resolvedW, resolvedH);
    imgData = raw.imgData;
    width = raw.width;
    height = raw.height;
  }

  const asset = buildUploadedAssetResult({
    imgData,
    width,
    height,
    paletteTheme,
    quantize,
    dither,
    customPalette,
    themePalettes: THEME_PALETTES,
    quantizeFn: quantizeImageDataToPalette,
    extractFn: imageDataToDynamicGrid,
  });

  if (saveToHistory) {
    saveSpriteToLocalHistory(assetName, asset.size, asset.grid, asset.palette);
  }

  return asset;
}

/**
 * Reduce la paleta del sprite a N colores propios mediante cuantización OKLab.
 * @param {number[][]} grid
 * @param {Record<number, string|null>} palette
 * @param {number} maxColors
 * @param {boolean} [dither=false]
 */
export async function requestReduceColors(grid, palette, maxColors, dither = false) {
  return reduceGridColorsClient(grid, palette, maxColors, dither);
}

/**
 * Carga un sprite guardado desde el historial local por su ruta.
 * @param {string} filepath
 */
export async function requestLoadSprite(filepath) {
  const found = readLocalSprites().find((s) => s.path === filepath);
  if (!found) {
    throw new Error("No se encontró el sprite en el historial local.");
  }
  return {
    size: found.size,
    grid: found.grid,
    palette: found.palette,
  };
}
