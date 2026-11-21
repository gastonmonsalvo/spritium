/**
 * exportModal.js: Modal unificado de exportación configurable para Spritium
 * (PNG, GIF Animado 89a, Tira PNG y Atlas PNG+JSON) con escala Nearest-Neighbor,
 * fondo opcional, disposición de spritesheet y FPS/loop para GIF.
 */

import { state, getGridDims } from "../core/state.js";
import { encodeGif89a } from "../core/gifEncoder.js";
import { setStatus, refreshIcons } from "../ui/index.js";
import {
  syncActiveFrame,
  renderFrameToOffscreenCanvas,
  exportPackedAtlas,
} from "./frames.js";
import { i18n } from "../i18n/I18nService.js";

if (typeof window !== "undefined") {
  i18n.addEventListener("langchange", () => {
    if (document.getElementById("exportModal")?.classList.contains("open")) updateExportModalPreview();
  });
}

function renderScaledFrameCanvas(frame, w, h, scale, bgColor = null) {
  const src = renderFrameToOffscreenCanvas(frame, w, h);
  const outW = w * scale;
  const outH = h * scale;
  const dst = document.createElement("canvas");
  dst.width = outW;
  dst.height = outH;
  const ctx = dst.getContext("2d");
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, outW, outH);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, outW, outH);
  return dst;
}

function getExportOptionsFromDom() {
  const format = document.getElementById("exportFormatSelect")?.value || "png";
  const scale = Math.max(1, Math.min(16, Number(document.getElementById("exportScaleSelect")?.value || 1)));
  const bgMode = document.getElementById("exportBgSelect")?.value || "transparent";
  const bgColor = bgMode === "solid" ? (document.getElementById("exportBgColor")?.value || "#141417") : null;
  const fps = Math.max(1, Math.min(60, Number(document.getElementById("exportGifFps")?.value || 8)));
  const loopCount = Number(document.getElementById("exportGifLoop")?.value ?? 0);
  const stripLayout = document.getElementById("exportStripLayout")?.value || "horizontal";
  const stripCols = Math.max(1, Math.min(64, Number(document.getElementById("exportStripCols")?.value || 4)));
  const stripPadding = Math.max(0, Math.min(32, Number(document.getElementById("exportStripPadding")?.value || 0)));
  return { format, scale, bgMode, bgColor, fps, loopCount, stripLayout, stripCols, stripPadding };
}

let previewTimer = null;
let previewFrameIdx = 0;

function stopExportPreviewLoop() {
  if (previewTimer !== null) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }
}

function composeStripCanvas(w, h, opts) {
  const count = state.frames.length;
  const sw = w * opts.scale;
  const sh = h * opts.scale;
  let cols = count;
  let rows = 1;
  if (opts.stripLayout === "vertical") {
    cols = 1;
    rows = count;
  } else if (opts.stripLayout === "grid") {
    cols = Math.min(count, opts.stripCols);
    rows = Math.ceil(count / cols);
  }

  const totalW = cols * sw + Math.max(0, cols - 1) * opts.stripPadding;
  const totalH = rows * sh + Math.max(0, rows - 1) * opts.stripPadding;
  const sheet = document.createElement("canvas");
  sheet.width = totalW;
  sheet.height = totalH;
  const ctx = sheet.getContext("2d");
  if (opts.bgColor) {
    ctx.fillStyle = opts.bgColor;
    ctx.fillRect(0, 0, totalW, totalH);
  }

  for (let f = 0; f < count; f++) {
    const col = f % cols;
    const row = Math.floor(f / cols);
    const x = col * (sw + opts.stripPadding);
    const y = row * (sh + opts.stripPadding);
    const frameCanvas = renderScaledFrameCanvas(state.frames[f], w, h, opts.scale, null);
    ctx.drawImage(frameCanvas, x, y);
  }

  return { sheet, totalW, totalH, cols, rows };
}

function drawCanvasFittedInPreview(srcCanvas, bgColor = null) {
  const previewCanvas = document.getElementById("exportPreviewCanvas");
  if (!previewCanvas) return;
  const boxSize = 184;
  const scale = Math.min(boxSize / srcCanvas.width, boxSize / srcCanvas.height);
  const drawW = Math.max(1, Math.round(srcCanvas.width * scale));
  const drawH = Math.max(1, Math.round(srcCanvas.height * scale));
  previewCanvas.width = drawW;
  previewCanvas.height = drawH;
  const ctx = previewCanvas.getContext("2d");
  ctx.clearRect(0, 0, drawW, drawH);
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, drawW, drawH);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(srcCanvas, 0, 0, drawW, drawH);
}

function renderExportPreviewVisual(opts, w, h) {
  stopExportPreviewLoop();
  syncActiveFrame();

  if (opts.format === "strip") {
    const previewOpts = { ...opts, scale: 1 };
    const { sheet } = composeStripCanvas(w, h, previewOpts);
    drawCanvasFittedInPreview(sheet, opts.bgColor);
    return;
  }

  if (opts.format === "gif" && state.frames.length > 1) {
    previewFrameIdx = 0;
    const tick = () => {
      const modal = document.getElementById("exportModal");
      if (!modal?.classList.contains("open")) return;
      const curOpts = getExportOptionsFromDom();
      if (curOpts.format !== "gif") return;
      const frame = state.frames[previewFrameIdx % state.frames.length];
      const frameCanvas = renderFrameToOffscreenCanvas(frame, w, h);
      drawCanvasFittedInPreview(frameCanvas, curOpts.bgColor);
      previewFrameIdx = (previewFrameIdx + 1) % state.frames.length;
      previewTimer = setTimeout(tick, Math.round(1000 / Math.max(1, curOpts.fps)));
    };
    tick();
    return;
  }

  const activeFrame = state.frames[state.activeFrameIndex] || { layers: state.layers };
  const frameCanvas = renderFrameToOffscreenCanvas(activeFrame, w, h);
  drawCanvasFittedInPreview(frameCanvas, opts.bgColor);
}

/**
 * Actualiza los bloques visibles del modal y muestra las dimensiones finales calculadas.
 */
export function updateExportModalPreview() {
  const opts = getExportOptionsFromDom();
  const { w, h } = getGridDims();
  const frameCount = Math.max(1, state.frames.length);

  const bgColorEl = document.getElementById("exportBgColor");
  if (bgColorEl) bgColorEl.style.display = opts.bgMode === "solid" ? "inline-block" : "none";

  const gifBox = document.getElementById("exportGifOptions");
  if (gifBox) gifBox.style.display = opts.format === "gif" ? "flex" : "none";

  const stripBox = document.getElementById("exportStripOptions");
  if (stripBox) stripBox.style.display = opts.format === "strip" ? "flex" : "none";

  const colsRow = document.getElementById("exportStripColsRow");
  if (colsRow) colsRow.style.display = opts.stripLayout === "grid" ? "flex" : "none";

  const scaleSelect = document.getElementById("exportScaleSelect");
  if (scaleSelect) scaleSelect.disabled = opts.format === "atlas";

  const previewEl = document.getElementById("exportResolutionPreview");
  if (previewEl) {
    const sw = w * opts.scale;
    const sh = h * opts.scale;
    if (opts.format === "png") {
      previewEl.textContent = i18n.t("export.out_png", { w: sw, h: sh });
    } else if (opts.format === "gif") {
      previewEl.textContent = i18n.t("export.out_gif", { w: sw, h: sh, frames: frameCount, fps: opts.fps });
    } else if (opts.format === "strip") {
      let cols = frameCount;
      let rows = 1;
      if (opts.stripLayout === "vertical") {
        cols = 1;
        rows = frameCount;
      } else if (opts.stripLayout === "grid") {
        cols = Math.min(frameCount, opts.stripCols);
        rows = Math.ceil(frameCount / cols);
      }
      const totalW = cols * sw + Math.max(0, cols - 1) * opts.stripPadding;
      const totalH = rows * sh + Math.max(0, rows - 1) * opts.stripPadding;
      previewEl.textContent = i18n.t("export.out_strip", { w: totalW, h: totalH, cols, rows });
    } else {
      previewEl.textContent = i18n.t("export.out_atlas", { frames: frameCount });
    }
  }

  renderExportPreviewVisual(opts, w, h);
}

/**
 * Abre el modal de exportación configurable con un formato inicial sugerido.
 * @param {"png"|"gif"|"strip"|"atlas"} [defaultFormat="png"]
 */
export function openExportModal(defaultFormat = "png") {
  const modal = document.getElementById("exportModal");
  if (!modal) return;

  const resolvedFormat = typeof defaultFormat === "string" ? defaultFormat : "png";
  const formatSelect = document.getElementById("exportFormatSelect");
  if (formatSelect) formatSelect.value = resolvedFormat;

  const animFps = document.getElementById("animFpsInput")?.value;
  const gifFpsInput = document.getElementById("exportGifFps");
  if (gifFpsInput && animFps) gifFpsInput.value = animFps;

  modal.classList.add("open");
  updateExportModalPreview();
  refreshIcons(modal);
}

/**
 * Cierra el modal de exportación configurable.
 */
export function closeExportModal() {
  stopExportPreviewLoop();
  document.getElementById("exportModal")?.classList.remove("open");
}

function triggerDownloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Ejecuta la exportación según la configuración elegida en `#exportModal`.
 */
export function executeConfiguredExport() {
  syncActiveFrame();
  const opts = getExportOptionsFromDom();
  const { w, h } = getGridDims();
  const baseName = document.getElementById("assetName")?.value.trim() || "nuevo_proyecto";

  if (opts.format === "atlas") {
    closeExportModal();
    exportPackedAtlas();
    return;
  }

  if (opts.format === "png") {
    const activeFrame = state.frames[state.activeFrameIndex] || { layers: state.layers };
    const outCanvas = renderScaledFrameCanvas(activeFrame, w, h, opts.scale, opts.bgColor);
    outCanvas.toBlob((blob) => {
      if (blob) triggerDownloadBlob(blob, `${baseName}_${outCanvas.width}x${outCanvas.height}.png`);
    }, "image/png");
    closeExportModal();
    setStatus({ key: "log.export_png_ok", params: { w: outCanvas.width, h: outCanvas.height } });
    return;
  }

  if (opts.format === "gif") {
    const outW = w * opts.scale;
    const outH = h * opts.scale;
    const renderedFrames = state.frames.map((frame) => {
      const c = renderScaledFrameCanvas(frame, w, h, opts.scale, opts.bgColor);
      const rgba = c.getContext("2d").getImageData(0, 0, outW, outH).data;
      return { rgba };
    });

    const gifBytes = encodeGif89a({
      width: outW,
      height: outH,
      frames: renderedFrames,
      fps: opts.fps,
      loopCount: opts.loopCount,
    });
    const blob = new Blob([gifBytes], { type: "image/gif" });
    triggerDownloadBlob(blob, `${baseName}_${outW}x${outH}.gif`);
    closeExportModal();
    setStatus({ key: "log.export_gif_ok", params: { frames: renderedFrames.length, w: outW, h: outH, fps: opts.fps } });
    return;
  }

  if (opts.format === "strip") {
    const count = state.frames.length;
    const { sheet, totalW, totalH } = composeStripCanvas(w, h, opts);

    sheet.toBlob((blob) => {
      if (blob) triggerDownloadBlob(blob, `${baseName}_strip_${totalW}x${totalH}.png`);
    }, "image/png");
    closeExportModal();
    setStatus({ key: "log.export_strip_ok", params: { frames: count, w: totalW, h: totalH } });
  }
}
