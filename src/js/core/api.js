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
    const cleanName = `${(name || "sprite").trim().replace(/\s+/g, "_")}_${size}x${size}.png`;
    const list = readLocalSprites().filter((s) => s.name !== cleanName);
    list.unshift({
      name: cleanName,
      category: `${size}x${size}`,
      path: `local://${cleanName}`,
      size,
      grid,
      palette,
    });
    localStorage.setItem(LOCAL_SPRITES_KEY, JSON.stringify(list.slice(0, 10)));
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
 * @param {{assetName?: string, paletteTheme?: string, quantize?: boolean, dither?: boolean, targetSize?: number, pixelArtConvert?: boolean, removeBackground?: boolean, keepNativeSize?: boolean, customPalette?: Object|null}} [options]
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
    pixelArtConvert = false,
    removeBackground = false,
    keepNativeSize = false,
    customPalette = null,
    saveToHistory = true,
  } = {},
) {
  let imgData;
  let width;
  let height;

  if (keepNativeSize && !pixelArtConvert) {
    const raw = await loadRawSpriteImageData(file, null, null);
    imgData = removeBackground ? removeConnectedBackground(raw.imgData, 40) : raw.imgData;
    width = raw.width;
    height = raw.height;
  } else if (pixelArtConvert || removeBackground) {
    const size = Math.max(4, Math.min(512, Number(targetSize) || 64));
    imgData = await prepareExternalSprite(file, size, { removeBackground });
    width = size;
    height = size;
  } else {
    const raw = await loadRawSpriteImageData(file, targetSize, targetSize);
    imgData = raw.imgData;
    width = raw.width;
    height = raw.height;
  }

  const size = Math.max(width, height);
  const themeKey = (paletteTheme || "original").toLowerCase().trim();

  let result;
  let quantized = false;

  if (customPalette && typeof customPalette === "object") {
    result = quantizeImageDataToPalette(imgData, customPalette, {
      alphaThreshold: 16,
      dither: Boolean(dither),
    });
    quantized = true;
  } else if (quantize && themeKey !== "original" && THEME_PALETTES[themeKey]) {
    result = quantizeImageDataToPalette(imgData, THEME_PALETTES[themeKey].colors, {
      alphaThreshold: 16,
      dither: Boolean(dither),
    });
    quantized = true;
  } else {
    result = imageDataToDynamicGrid(imgData, 16);
  }

  if (saveToHistory) {
    saveSpriteToLocalHistory(assetName, size, result.grid, result.paletteMap);
  }

  return {
    size,
    width,
    height,
    grid: result.grid,
    palette: result.paletteMap,
    quantized,
    theme: quantized ? themeKey : "original",
  };
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
