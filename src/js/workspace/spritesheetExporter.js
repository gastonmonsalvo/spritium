/**
 * spritesheetExporter.js: Composición offscreen de fotogramas y exportación de Spritesheet PNG / Atlas JSON.
 */

import { state, getGridDims, notify } from "../core/state.js";
import { parseColorToRgba } from "../core/color.js";
import { setStatus } from "../ui/index.js";

/**
 * Compone todas las capas visibles de un fotograma en un canvas offscreen.
 * @param {Frame} frame
 * @param {number} [width=getGridDims().w]
 * @param {number} [height=getGridDims().h]
 * @returns {HTMLCanvasElement}
 */
export function renderFrameToOffscreenCanvas(frame, width = getGridDims().w, height = getGridDims().h) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx || !frame?.layers) return c;

  const lut = new Map();
  for (const [k, hex] of Object.entries(state.paletteMap || {})) {
    const idx = Number(k);
    if (idx > 0 && hex) {
      const rgba = parseColorToRgba(hex);
      if (rgba) lut.set(idx, rgba);
    }
  }

  const layerBuf = document.createElement("canvas");
  layerBuf.width = width;
  layerBuf.height = height;
  const lCtx = layerBuf.getContext("2d");
  const imgData = lCtx.createImageData(width, height);
  const data = imgData.data;

  for (const layer of frame.layers) {
    if (!layer.visible || !layer.grid || layer.opacity === 0) continue;
    data.fill(0);
    for (let y = 0; y < height; y++) {
      const row = layer.grid[y];
      if (!row) continue;
      const rowOff = y * width;
      for (let x = 0; x < width; x++) {
        const idx = row[x];
        if (!idx) continue;
        const rgba = lut.get(idx);
        if (!rgba) continue;
        const p = (rowOff + x) << 2;
        data[p] = rgba[0];
        data[p + 1] = rgba[1];
        data[p + 2] = rgba[2];
        data[p + 3] = rgba[3];
      }
    }
    lCtx.putImageData(imgData, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;
    ctx.globalCompositeOperation = layer.blendMode || "source-over";
    ctx.drawImage(layerBuf, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }
  return c;
}

function getTrimmedBounds(frame, width = getGridDims().w, height = getGridDims().h) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (const layer of frame.layers) {
    if (!layer.visible || !layer.grid || layer.opacity === 0) continue;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = layer.grid[y]?.[x];
        if (idx && idx !== 0 && state.paletteMap[idx]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, w: 1, h: 1, empty: true };
  }
  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    empty: false,
  };
}

/**
 * Método A: Exporta un Sprite Sheet Puro (tira horizontal PNG uniforme frameW × count).
 */
export function exportPureSpritesheetPng() {
  notify("frames:syncActive");
  const { w, h } = getGridDims();
  const count = state.frames.length;
  const sheet = document.createElement("canvas");
  sheet.width = w * count;
  sheet.height = h;
  const ctx = sheet.getContext("2d");

  for (let f = 0; f < count; f++) {
    const frameCanvas = renderFrameToOffscreenCanvas(state.frames[f], w, h);
    ctx.drawImage(frameCanvas, f * w, 0);
  }

  const baseName = document.getElementById("assetName")?.value.trim() || "sprite";
  const pngLink = document.createElement("a");
  pngLink.download = `${baseName}_strip_${w}x${h}.png`;
  pngLink.href = sheet.toDataURL("image/png");
  pngLink.click();

  setStatus({ key: "log.sheet_exported", params: { count, w: sheet.width, h } });
}

/**
 * Método B: Exporta Atlas Empaquetado/Recortado (PNG + JSON esquema estándar).
 */
export function exportPackedAtlas() {
  notify("frames:syncActive");
  const { w, h } = getGridDims();
  const count = state.frames.length;
  const fps = Math.max(1, Math.min(60, Number(document.getElementById("animFpsInput")?.value || 8)));
  const defaultDuration = Math.round(1000 / fps);
  const baseName = document.getElementById("assetName")?.value.trim() || "sprite";
  const padding = 1;

  // 1. Recortar cada frame a su bounding box no transparente
  const items = state.frames.map((frame, f) => {
    const trim = getTrimmedBounds(frame, w, h);
    const canvas = renderFrameToOffscreenCanvas(frame, w, h);
    return {
      index: f,
      key: `${baseName}_${f}.png`,
      canvas,
      trim,
      duration: frame.durationMs || defaultDuration,
    };
  });

  // 2. Shelf-packing compacto con padding de 1px para evitar texture bleeding
  const maxItemW = Math.max(...items.map((it) => it.trim.w), 1);
  const targetAtlasW = Math.max(maxItemW + padding * 2, Math.ceil(Math.sqrt(count)) * (maxItemW + padding));

  let curX = 0;
  let curY = 0;
  let rowH = 0;
  let atlasW = 1;
  let atlasH = 1;

  for (const it of items) {
    if (curX > 0 && curX + it.trim.w + padding > targetAtlasW) {
      curX = 0;
      curY += rowH + padding;
      rowH = 0;
    }
    it.atlasX = curX;
    it.atlasY = curY;
    curX += it.trim.w + padding;
    rowH = Math.max(rowH, it.trim.h);
    atlasW = Math.max(atlasW, curX - padding);
    atlasH = Math.max(atlasH, curY + rowH);
  }

  const atlasCanvas = document.createElement("canvas");
  atlasCanvas.width = atlasW;
  atlasCanvas.height = atlasH;
  const aCtx = atlasCanvas.getContext("2d");

  const framesHash = {};
  for (const it of items) {
    if (!it.trim.empty) {
      aCtx.drawImage(
        it.canvas,
        it.trim.x,
        it.trim.y,
        it.trim.w,
        it.trim.h,
        it.atlasX,
        it.atlasY,
        it.trim.w,
        it.trim.h,
      );
    }

    framesHash[it.key] = {
      frame: { x: it.atlasX, y: it.atlasY, w: it.trim.w, h: it.trim.h },
      rotated: false,
      trimmed: !it.trim.empty && (it.trim.w !== w || it.trim.h !== h),
      spriteSourceSize: { x: it.trim.x, y: it.trim.y, w: it.trim.w, h: it.trim.h },
      sourceSize: { w, h },
      duration: it.duration,
      pivot: { x: 0.5, y: 0.5 },
    };
  }

  const pngFilename = `${baseName}_atlas.png`;
  const pngLink = document.createElement("a");
  pngLink.download = pngFilename;
  pngLink.href = atlasCanvas.toDataURL("image/png");
  pngLink.click();

  const atlasJson = {
    frames: framesHash,
    meta: {
      app: "https://github.com/gastonmonsalvo",
      version: "1.0",
      image: pngFilename,
      format: "RGBA8888",
      size: { w: atlasW, h: atlasH },
      scale: "1",
      frameTags:
        state.frameTags?.length > 0
          ? state.frameTags.map((t) => ({
              name: t.name,
              from: t.from,
              to: t.to,
              direction: "forward",
              color: t.color,
            }))
          : [
              {
                name: baseName,
                from: 0,
                to: Math.max(0, count - 1),
                direction: "forward",
              },
            ],
    },
  };

  const blob = new Blob([JSON.stringify(atlasJson, null, 2)], { type: "application/json" });
  const jsonUrl = URL.createObjectURL(blob);
  const jsonLink = document.createElement("a");
  jsonLink.download = `${baseName}_atlas.json`;
  jsonLink.href = jsonUrl;
  jsonLink.click();
  setTimeout(() => URL.revokeObjectURL(jsonUrl), 1000);

  setStatus({ key: "log.atlas_exported", params: { count, w: atlasW, h: atlasH } });
}

/**
 * Alias por compatibilidad: exporta el Atlas Empaquetado estándar (PNG + JSON).
 */
export function exportSpritesheet() {
  exportPackedAtlas();
}
