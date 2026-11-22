/**
 * imageProcessor.js: Procesamiento de imágenes 100% Client-Side (Canvas + OKLab + K-Means++).
 * Reemplaza a pixel_processor.py para permitir hosting estático sin backend Python.
 */

import { MAX_GRID_DIM } from "./stateStore.js";
import {
  computeContainedRect,
  computeCroppedFitRect,
  removeConnectedBackground,
  imageDataToDynamicGrid,
  quantizeImageDataToPalette,
  extractAdaptivePalette,
  reduceGridColorsClient,
} from "./imageProcessorCore.js";

export {
  removeConnectedBackground,
  imageDataToDynamicGrid,
  quantizeImageDataToPalette,
  extractAdaptivePalette,
  reduceGridColorsClient,
};

/**
 * Decodifica un File de imagen tal cual viene (1:1 Nearest-Neighbor, sin borrar fondo ni suavizar).
 * Si `targetW`/`targetH` son null, conserva las dimensiones nativas (limitadas a 4..MAX_GRID_DIM px).
 * @param {File} file
 * @param {number|null} [targetW=null]
 * @param {number|null} [targetH=null]
 * @returns {Promise<{imgData: ImageData, width: number, height: number}>}
 */
export async function loadRawSpriteImageData(file, targetW = null, targetH = null) {
  const bitmap = await createImageBitmap(file);
  let w = targetW ? Math.round(targetW) : bitmap.width;
  let h = targetH ? Math.round(targetH) : bitmap.height;

  // Si excede el máximo del editor (MAX_GRID_DIM) en tamaño nativo, escalar proporcionalmente sin suavizado
  if (!targetW && !targetH && (w > MAX_GRID_DIM || h > MAX_GRID_DIM)) {
    const scale = MAX_GRID_DIM / Math.max(w, h);
    w = Math.max(4, Math.round(w * scale));
    h = Math.max(4, Math.round(h * scale));
  } else {
    w = Math.max(4, Math.min(MAX_GRID_DIM, w));
    h = Math.max(4, Math.min(MAX_GRID_DIM, h));
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (targetW || targetH) {
    const { drawW, drawH, offsetX, offsetY } = computeContainedRect(bitmap.width, bitmap.height, w, h);
    const isIntegerDownscale =
      drawW <= bitmap.width &&
      drawH <= bitmap.height &&
      bitmap.width % drawW === 0 &&
      bitmap.height % drawH === 0;
    const isDownscale = (drawW < bitmap.width || drawH < bitmap.height) && !isIntegerDownscale;
    ctx.imageSmoothingEnabled = isDownscale;
    if (isDownscale) ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, offsetX, offsetY, drawW, drawH);
  } else {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0, w, h);
  }
  if (typeof bitmap.close === "function") bitmap.close();

  return {
    imgData: ctx.getImageData(0, 0, w, h),
    width: w,
    height: h,
  };
}

/**
 * Decodifica un File de imagen, opcionalmente quita el fondo perimetral y recorta bounding box,
 * y reescala en un lienzo de `targetWidth x targetHeight` (o `targetSize x targetSize`).
 * @param {File} file
 * @param {number} [targetSize=64]
 * @param {{removeBackground?: boolean, targetWidth?: number|null, targetHeight?: number|null}} [options={}]
 * @returns {Promise<ImageData>}
 */
export async function prepareExternalSprite(
  file,
  targetSize = 64,
  { removeBackground = false, targetWidth = null, targetHeight = null } = {},
) {
  const dstW = Math.max(4, Math.min(MAX_GRID_DIM, Math.round(Number(targetWidth) || Number(targetSize) || 64)));
  const dstH = Math.max(4, Math.min(MAX_GRID_DIM, Math.round(Number(targetHeight) || Number(targetSize) || 64)));
  const bitmap = await createImageBitmap(file);
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = bitmap.width;
  srcCanvas.height = bitmap.height;
  const srcCtx = srcCanvas.getContext("2d");
  srcCtx.drawImage(bitmap, 0, 0);
  if (typeof bitmap.close === "function") bitmap.close();

  if (removeBackground) {
    const rawData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
    const cleaned = removeConnectedBackground(rawData, 40);
    srcCtx.putImageData(cleaned, 0, 0);

    const { cropX, cropY, cropW, cropH, offsetX, offsetY, newW, newH } = computeCroppedFitRect(cleaned, dstW, dstH);

    const dstCanvas = document.createElement("canvas");
    dstCanvas.width = dstW;
    dstCanvas.height = dstH;
    const dstCtx = dstCanvas.getContext("2d");
    const isIntegerDownscale = cropW % newW === 0 && cropH % newH === 0;
    dstCtx.imageSmoothingEnabled = !isIntegerDownscale && (newW < cropW || newH < cropH);
    if (dstCtx.imageSmoothingEnabled) dstCtx.imageSmoothingQuality = "high";
    dstCtx.drawImage(srcCanvas, cropX, cropY, cropW, cropH, offsetX, offsetY, newW, newH);
    return dstCtx.getImageData(0, 0, dstW, dstH);
  }

  const dstCanvas = document.createElement("canvas");
  dstCanvas.width = dstW;
  dstCanvas.height = dstH;
  const dstCtx = dstCanvas.getContext("2d");
  const { drawW, drawH, offsetX, offsetY } = computeContainedRect(
    srcCanvas.width,
    srcCanvas.height,
    dstW,
    dstH,
  );
  const isIntegerDownscale = srcCanvas.width % drawW === 0 && srcCanvas.height % drawH === 0;
  dstCtx.imageSmoothingEnabled = !isIntegerDownscale && (drawW < srcCanvas.width || drawH < srcCanvas.height);
  if (dstCtx.imageSmoothingEnabled) dstCtx.imageSmoothingQuality = "high";
  dstCtx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, offsetX, offsetY, drawW, drawH);

  return dstCtx.getImageData(0, 0, dstW, dstH);
}
