// @ts-check
/**
 * GridAndGuidesRenderer.js: Renderizado de grillas adaptativas LOD por luminancia,
 * ejes de simetría H/V, marco central de Tiled Mode y guías magnéticas de Snap.
 */

import { state, getGridDims, isSymmetryActive, getSymmetryPivot } from "../core/state.js";
import { parseColorToRgb } from "../core/color.js";

/**
 * Estima la luminancia media del lienzo muestreando hasta 1024 puntos para ajustar el contraste de la grilla.
 * @param {Array<any>} layersStack
 * @param {number} w
 * @param {number} h
 * @returns {number}
 */
export function estimateCanvasLuminance(layersStack, w, h) {
  let lumSum = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(Math.max(w, h) / 32));
  const lumCache = new Map();
  const isLightTheme =
    Boolean(state.isLightTheme) ||
    (typeof document !== "undefined" && document.body?.classList.contains("theme-light"));
  const transparentLum =
    typeof state.canvasBgLightness === "number"
      ? state.canvasBgLightness
      : isLightTheme
        ? 0.85
        : 0.15;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      let topIdx = 0;
      for (let li = layersStack.length - 1; li >= 0; li--) {
        const l = layersStack[li];
        if (!l.visible || !l.grid) continue;
        const v = l.grid[y]?.[x];
        if (v && v !== 0) {
          topIdx = v;
          break;
        }
      }
      if (topIdx === 0) {
        lumSum += transparentLum;
        count++;
        continue;
      }
      let lum = lumCache.get(topIdx);
      if (lum === undefined) {
        const rgb = parseColorToRgb(state.paletteMap[topIdx]);
        lum = rgb ? (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 : transparentLum;
        lumCache.set(topIdx, lum);
      }
      lumSum += lum;
      count++;
    }
  }
  return count > 0 ? lumSum / count : transparentLum;
}

/**
 * Dibuja la grilla de píxeles con nivel de detalle progresivo (LOD) según el zoom y luminancia del fondo.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<any>} layersToDraw
 * @param {number} w
 * @param {number} h
 * @param {number} cellSize
 * @param {number} tilesX
 * @param {number} tilesY
 * @param {number} totalW
 * @param {number} totalH
 * @param {number} zoom
 */
export function drawAdaptivePixelGrid(ctx, layersToDraw, w, h, cellSize, tilesX, tilesY, totalW, totalH, zoom) {
  const overlay = typeof document !== "undefined" ? document.getElementById("gridOverlay") : null;
  if (state.showGrid === false) {
    if (overlay) overlay.style.display = "none";
    return;
  }

  const screenPixelSize = cellSize * zoom;
  const avgLum = estimateCanvasLuminance(layersToDraw, w, h);
  const gridRgb = avgLum > 0.52 ? "15, 23, 42" : "255, 255, 255";
  const blockAlpha = avgLum > 0.52 ? 0.38 : 0.28;
  const maxDim = Math.max(w, h);

  const layers = [];
  const addStep = (step, alpha) => {
    if (step >= maxDim || step < 1) return;
    layers.push({ step, alpha });
  };

  if (screenPixelSize < 3) {
    addStep(32, blockAlpha);
  } else if (screenPixelSize < 5) {
    addStep(8, blockAlpha * 0.55);
    addStep(16, blockAlpha);
  } else if (screenPixelSize < 8) {
    addStep(screenPixelSize >= 6.5 ? 2 : 4, blockAlpha * 0.55);
    addStep(8, blockAlpha);
  } else {
    const fineAlpha = Math.min(0.26, (avgLum > 0.52 ? 0.16 : 0.13) + (screenPixelSize - 8) * 0.01);
    addStep(1, Number(fineAlpha.toFixed(3)));
    addStep(8, blockAlpha);
  }

  if (overlay) {
    if (layers.length === 0) {
      overlay.style.display = "none";
      return;
    }
    overlay.style.display = "block";
    const scaledW = Math.round(totalW * zoom);
    const scaledH = Math.round(totalH * zoom);
    const cellCssX = scaledW / (w * tilesX);
    const cellCssY = scaledH / (h * tilesY);

    // En orden inverso para que las líneas de bloque (8/16/32) queden arriba de la grilla fina
    const ordered = [...layers].reverse();
    const bgImages = [];
    const bgSizes = [];
    for (const { step, alpha } of ordered) {
      const color = `rgba(${gridRgb}, ${alpha})`;
      const stepW = (cellCssX * step).toFixed(4);
      const stepH = (cellCssY * step).toFixed(4);
      bgImages.push(
        `linear-gradient(to right, ${color} 0, ${color} 1px, transparent 1px)`,
        `linear-gradient(to bottom, ${color} 0, ${color} 1px, transparent 1px)`,
      );
      bgSizes.push(`${stepW}px ${stepH}px`, `${stepW}px ${stepH}px`);
    }
    overlay.style.backgroundImage = bgImages.join(", ");
    overlay.style.backgroundSize = bgSizes.join(", ");
    overlay.style.backgroundPosition = "0 0";
    return;
  }

  // Fallback para entornos sin DOM (ej. pruebas headless puras)
  ctx.save();
  ctx.lineWidth = Math.max(0.5, 1 / zoom);
  const totalCols = w * tilesX;
  const totalRows = h * tilesY;
  for (const { step, alpha } of layers) {
    ctx.strokeStyle = `rgba(${gridRgb}, ${alpha})`;
    ctx.beginPath();
    for (let i = 0; i <= totalCols; i += step) {
      const pos = Math.floor(i * cellSize) + 0.5;
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, totalH);
    }
    for (let i = 0; i <= totalRows; i += step) {
      const pos = Math.floor(i * cellSize) + 0.5;
      ctx.moveTo(0, pos);
      ctx.lineTo(totalW, pos);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Dibuja las líneas guía centrales del lienzo (rojizo sutil) sobre la cuadrícula para ubicar
 * el medio exacto en resoluciones estándar y personalizadas (línea central en pares, banda 1px en impares).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} tileOriginX
 * @param {number} tileOriginY
 * @param {number} baseW
 * @param {number} baseH
 * @param {number} w
 * @param {number} h
 * @param {number} zoom
 */
export function drawCanvasCenterGuides(ctx, tileOriginX, tileOriginY, baseW, baseH, w, h, zoom = 1) {
  if (state.showCenterGuides === false) return;
  if (w < 4 && h < 4) return;

  const cellW = baseW / w;
  const cellH = baseH / h;
  const lineW = Math.max(0.75, 1.15 / (zoom || 1));
  const isLightTheme =
    Boolean(state.isLightTheme) ||
    (typeof document !== "undefined" && document.body?.classList.contains("theme-light"));
  const isLightSurface =
    typeof state.canvasBgLightness === "number" ? state.canvasBgLightness >= 0.5 : isLightTheme;
  const lineStroke = isLightSurface ? "rgba(185, 28, 28, 0.54)" : "rgba(239, 68, 68, 0.34)";
  const bandFill = isLightSurface ? "rgba(220, 38, 38, 0.12)" : "rgba(239, 68, 68, 0.09)";
  const bandStroke = isLightSurface ? "rgba(185, 28, 28, 0.38)" : "rgba(239, 68, 68, 0.24)";

  ctx.save();
  ctx.beginPath();
  ctx.rect(tileOriginX, tileOriginY, baseW, baseH);
  ctx.clip();

  if (w >= 4) {
    if (w % 2 === 0) {
      const midX = Math.round(tileOriginX + (w / 2) * cellW) + 0.5;
      ctx.strokeStyle = lineStroke;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(midX, tileOriginY);
      ctx.lineTo(midX, tileOriginY + baseH);
      ctx.stroke();
    } else {
      const col = Math.floor(w / 2);
      const x0 = tileOriginX + col * cellW;
      ctx.fillStyle = bandFill;
      ctx.fillRect(x0, tileOriginY, cellW, baseH);
      ctx.strokeStyle = bandStroke;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(Math.round(x0) + 0.5, tileOriginY);
      ctx.lineTo(Math.round(x0) + 0.5, tileOriginY + baseH);
      ctx.moveTo(Math.round(x0 + cellW) + 0.5, tileOriginY);
      ctx.lineTo(Math.round(x0 + cellW) + 0.5, tileOriginY + baseH);
      ctx.stroke();
    }
  }

  if (h >= 4) {
    if (h % 2 === 0) {
      const midY = Math.round(tileOriginY + (h / 2) * cellH) + 0.5;
      ctx.strokeStyle = lineStroke;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(tileOriginX, midY);
      ctx.lineTo(tileOriginX + baseW, midY);
      ctx.stroke();
    } else {
      const row = Math.floor(h / 2);
      const y0 = tileOriginY + row * cellH;
      ctx.fillStyle = bandFill;
      ctx.fillRect(tileOriginX, y0, baseW, cellH);
      ctx.strokeStyle = bandStroke;
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(tileOriginX, Math.round(y0) + 0.5);
      ctx.lineTo(tileOriginX + baseW, Math.round(y0) + 0.5);
      ctx.moveTo(tileOriginX, Math.round(y0 + cellH) + 0.5);
      ctx.lineTo(tileOriginX + baseW, Math.round(y0 + cellH) + 0.5);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Dibuja los ejes de simetría Horizontal, Vertical y Radial (90°/45°) junto con la banda de 1px en modo Impar.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} tileOriginX
 * @param {number} tileOriginY
 * @param {number} baseW
 * @param {number} baseH
 */
export function drawSymmetryAxes(ctx, tileOriginX, tileOriginY, baseW, baseH) {
  if (!isSymmetryActive()) return;
  const { w, h } = getGridDims();
  const cellW = baseW / w;
  const cellH = baseH / h;
  const { axisX, axisY, isPixelCenterX, isPixelCenterY } = getSymmetryPivot(w, h);
  const midX = tileOriginX + axisX * cellW;
  const midY = tileOriginY + axisY * cellH;

  const isRadial90 = state.mirrorRadial === "rot90";
  const isRadial45 = state.mirrorRadial === "oct45";
  const showX = Boolean(state.mirrorH || isRadial90 || isRadial45);
  const showY = Boolean(state.mirrorV || isRadial90 || isRadial45);
  const showDiagMain = Boolean(state.mirrorDiagMain || isRadial45);
  const showDiagAnti = Boolean(state.mirrorDiagAnti || isRadial45);

  ctx.save();
  ctx.beginPath();
  ctx.rect(tileOriginX, tileOriginY, baseW, baseH);
  ctx.clip();

  // Sombreado sutil de la columna/fila central cuando el eje está en modo "En Píxel (1px - Corazón)"
  ctx.fillStyle = "rgba(56, 189, 248, 0.13)";
  if (showX && isPixelCenterX) {
    const col = Math.floor(axisX);
    ctx.fillRect(tileOriginX + col * cellW, tileOriginY, cellW, baseH);
  }
  if (showY && isPixelCenterY) {
    const row = Math.floor(axisY);
    ctx.fillRect(tileOriginX, tileOriginY + row * cellH, baseW, cellH);
  }

  ctx.lineWidth = 2;
  const drawAxis = (x1, y1, x2, y2, color = "rgba(56, 189, 248, 0.95)") => {
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.65)";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  if (showX) drawAxis(midX, tileOriginY, midX, tileOriginY + baseH);
  if (showY) drawAxis(tileOriginX, midY, tileOriginX + baseW, midY);

  if (showDiagMain || showDiagAnti) {
    const span = Math.max(baseW, baseH) * 1.5;
    if (showDiagMain) drawAxis(midX - span, midY - span, midX + span, midY + span, "rgba(168, 85, 247, 0.9)");
    if (showDiagAnti) drawAxis(midX - span, midY + span, midX + span, midY - span, "rgba(168, 85, 247, 0.9)");
  }

  if (isRadial90 || isRadial45 || (showX && showY) || showDiagMain || showDiagAnti) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(midX, midY, 4, 0, Math.PI * 2);
    ctx.fillStyle = showDiagMain || showDiagAnti ? "#a855f7" : "#38bdf8";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#09090b";
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Dibuja las guías de referencia personalizadas arrastradas desde las reglas (estilo Photoshop / Aseprite).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} tileOriginX
 * @param {number} tileOriginY
 * @param {number} baseW
 * @param {number} baseH
 * @param {number} w
 * @param {number} h
 * @param {number} zoom
 */
export function drawRulerGuides(ctx, tileOriginX, tileOriginY, baseW, baseH, w, h, zoom = 1) {
  const guides = Array.isArray(state.rulerGuides) ? state.rulerGuides : [];
  const drag = state.activeGuideDrag?.valid ? state.activeGuideDrag : null;
  if (!guides.length && !drag) return;

  const cellW = baseW / w;
  const cellH = baseH / h;
  const all = drag ? [...guides, drag] : guides;

  ctx.save();
  ctx.beginPath();
  ctx.rect(tileOriginX, tileOriginY, baseW, baseH);
  ctx.clip();
  ctx.lineWidth = Math.max(1, 1.25 / (zoom || 1));

  for (const g of all) {
    const isPreview = g === drag;
    ctx.setLineDash(isPreview ? [3, 3] : [5, 4]);
    ctx.strokeStyle = isPreview ? "rgba(52, 211, 153, 0.98)" : "rgba(16, 185, 129, 0.85)";
    ctx.beginPath();
    if (g.axis === "v") {
      const gx = Math.round(tileOriginX + g.pos * cellW) + 0.5;
      ctx.moveTo(gx, tileOriginY);
      ctx.lineTo(gx, tileOriginY + baseH);
    } else {
      const gy = Math.round(tileOriginY + g.pos * cellH) + 0.5;
      ctx.moveTo(tileOriginX, gy);
      ctx.lineTo(tileOriginX + baseW, gy);
    }
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Dibuja el borde delimitador del tile central cuando Tiled Mode está activo.
 * @param {CanvasRenderingContext2D} ctx
 * @param {boolean} isTiled
 * @param {number} tileOriginX
 * @param {number} tileOriginY
 * @param {number} baseW
 * @param {number} baseH
 * @param {number} zoom
 */
export function drawTiledCenterBorder(ctx, isTiled, tileOriginX, tileOriginY, baseW, baseH, zoom) {
  if (!isTiled) return;
  ctx.save();
  ctx.lineWidth = Math.max(1.5, 2 / zoom);
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(16, 185, 129, 0.9)";
  ctx.strokeRect(tileOriginX + 0.5, tileOriginY + 0.5, baseW - 1, baseH - 1);
  ctx.restore();
}

/**
 * Dibuja las guías magnéticas magenta al mover con Ctrl presionado.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cellSize
 * @param {number} baseW
 * @param {number} baseH
 */
export function drawSnapGuides(ctx, cellSize, baseW, baseH) {
  if (!state.snapGuides) return;
  ctx.save();
  ctx.strokeStyle = "#ec4899";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  if (state.snapGuides.x !== undefined) {
    const gx = Math.round(state.snapGuides.x * cellSize) + 0.5;
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, baseH);
    ctx.stroke();
  }
  if (state.snapGuides.y !== undefined) {
    const gy = Math.round(state.snapGuides.y * cellSize) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(baseW, gy);
    ctx.stroke();
  }
  ctx.restore();
}
