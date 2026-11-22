/**
 * apiCore.js: Lógica pura de resolución de dimensiones de importación, armado de historial y selección de cuantización.
 */

/**
 * Resuelve y clampea las dimensiones destino `(w, h)` entre `4` y `maxDim`.
 * @param {{ targetSize?: number, targetWidth?: number|null, targetHeight?: number|null }} opts
 * @param {number} maxDim
 * @returns {{ w: number, h: number }}
 */
export function resolveImportTargetDims({ targetSize = 64, targetWidth = null, targetHeight = null } = {}, maxDim = 1024) {
  const w = Math.max(4, Math.min(maxDim, Math.round(Number(targetWidth) || Number(targetSize) || 64)));
  const h = Math.max(4, Math.min(maxDim, Math.round(Number(targetHeight) || Number(targetSize) || 64)));
  return { w, h };
}

/**
 * Construye una lista actualizada de sprites locales deduplicando por nombre y limitando a `maxItems`.
 * @param {Array<Record<string, any>>} existingList
 * @param {{ name?: string, size: number, grid: number[][], palette: Record<number, string|null> }} entry
 * @param {number} [maxItems=10]
 * @returns {Array<Record<string, any>>}
 */
export function buildSpriteHistoryList(existingList = [], { name = "sprite", size, grid, palette }, maxItems = 10) {
  const base = (name || "").trim() || "sprite";
  const cleanName = `${base.replace(/\s+/g, "_")}_${size}x${size}.png`;
  const list = existingList.filter((s) => s.name !== cleanName);
  list.unshift({
    name: cleanName,
    category: `${size}x${size}`,
    path: `local://${cleanName}`,
    size,
    grid,
    palette,
  });
  return list.slice(0, maxItems);
}

/**
 * Ejecuta cuantización (por `customPalette` o `themePalettes[themeKey]`) o extracción dinámica y arma el resultado.
 * @param {{
 *   imgData: any,
 *   width: number,
 *   height: number,
 *   paletteTheme?: string,
 *   quantize?: boolean,
 *   dither?: boolean,
 *   customPalette?: Record<number, string|null>|null,
 *   themePalettes: Record<string, { colors: Record<number, string|null> }>,
 *   quantizeFn: (imgData: any, pal: any, opts: { alphaThreshold: number, dither: boolean }) => { grid: number[][], paletteMap: Record<number, string|null> },
 *   extractFn: (imgData: any, alphaThreshold: number) => { grid: number[][], paletteMap: Record<number, string|null> },
 * }} params
 */
export function buildUploadedAssetResult({
  imgData,
  width,
  height,
  paletteTheme = "original",
  quantize = false,
  dither = false,
  customPalette = null,
  themePalettes,
  quantizeFn,
  extractFn,
}) {
  const size = Math.max(width, height);
  const themeKey = (paletteTheme || "original").toLowerCase().trim();
  let result;
  let quantized = false;

  if (customPalette && typeof customPalette === "object") {
    result = quantizeFn(imgData, customPalette, {
      alphaThreshold: 16,
      dither: Boolean(dither),
    });
    quantized = true;
  } else if (quantize && themeKey !== "original" && themePalettes[themeKey]) {
    result = quantizeFn(imgData, themePalettes[themeKey].colors, {
      alphaThreshold: 16,
      dither: Boolean(dither),
    });
    quantized = true;
  } else {
    result = extractFn(imgData, 16);
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
