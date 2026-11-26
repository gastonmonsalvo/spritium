/**
 * cursors.js: Cursores SVG de precisión por herramienta y mira configurable estilo Counter-Strike.
 */

import { state } from "../core/state.js";

function svgCursor(svgBody, hotX, hotY, fallback = "crosshair", size = 24) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${svgBody}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotX} ${hotY}, ${fallback}`;
}

function parseReticleColor(hex) {
  const clean = String(hex || "").replace("#", "").trim();
  if (clean.length !== 6 && clean.length !== 8) {
    return { rgb: "#ffffff", alpha: 1 };
  }
  const rgb = `#${clean.slice(0, 6)}`;
  const alpha = clean.length === 8 ? (parseInt(clean.slice(6, 8), 16) ?? 255) / 255 : 1;
  return { rgb, alpha: Math.max(0.15, Math.min(1, alpha)) };
}

/**
 * Genera el contenido interno SVG (en viewBox 24x24) de la mira del ratón.
 * @param {Object} [cfg]
 * @returns {string}
 */
export function getReticleSvgBody(cfg = state.reticleConfig) {
  const c = cfg || {};
  const shape = c.shape || "crosshair";
  const { rgb, alpha } = parseReticleColor(c.color || "#ffffffff");
  const op = alpha.toFixed(2);
  const bgOp = Math.max(0.35, alpha * 0.88).toFixed(2);
  const size = Math.max(3, Math.min(10, Number(c.size ?? 6) || 6));
  const thick = Math.max(1, Math.min(3, Number(c.thickness ?? 1.5) || 1.5));
  const gap = Math.max(0, Math.min(5, Number(c.gap ?? 2)));
  const dot = c.dot !== false;
  const outline = c.outline !== false;

  const layers = [];
  const cx = 12;
  const cy = 12;

  const pushStroke = (geom) => {
    if (outline) {
      layers.push(`<g fill="none" stroke="#09090b" stroke-opacity="${bgOp}" stroke-width="${(thick + 1.6).toFixed(2)}" stroke-linecap="square">${geom}</g>`);
    }
    layers.push(`<g fill="none" stroke="${rgb}" stroke-opacity="${op}" stroke-width="${thick.toFixed(2)}" stroke-linecap="square">${geom}</g>`);
  };

  if (shape === "circle") {
    const r = Math.max(2.5, Math.min(10, size));
    pushStroke(`<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}"/>`);
  } else if (shape === "square") {
    const half = Math.max(2.5, Math.min(10, size));
    pushStroke(`<rect x="${(cx - half).toFixed(1)}" y="${(cy - half).toFixed(1)}" width="${(half * 2).toFixed(1)}" height="${(half * 2).toFixed(1)}"/>`);
  } else if (shape === "crosshair") {
    const inner = gap;
    const outer = Math.min(11.5, gap + size);
    const geom = [
      `<line x1="${cx}" y1="${(cy - outer).toFixed(1)}" x2="${cx}" y2="${(cy - inner).toFixed(1)}"/>`,
      `<line x1="${cx}" y1="${(cy + inner).toFixed(1)}" x2="${cx}" y2="${(cy + outer).toFixed(1)}"/>`,
      `<line x1="${(cx - outer).toFixed(1)}" y1="${cy}" x2="${(cx - inner).toFixed(1)}" y2="${cy}"/>`,
      `<line x1="${(cx + inner).toFixed(1)}" y1="${cy}" x2="${(cx + outer).toFixed(1)}" y2="${cy}"/>`,
    ].join("");
    pushStroke(geom);
  }

  if (dot || shape === "dot") {
    const dotR = Math.max(0.8, Math.min(2.2, thick * 0.65));
    if (outline) {
      layers.push(`<circle cx="${cx}" cy="${cy}" r="${(dotR + 0.9).toFixed(2)}" fill="#09090b" fill-opacity="${bgOp}"/>`);
    }
    layers.push(`<circle cx="${cx}" cy="${cy}" r="${dotR.toFixed(2)}" fill="${rgb}" fill-opacity="${op}"/>`);
  }

  return layers.join("");
}

/**
 * Construye el cursor CSS completo para la mira del ratón.
 * @param {Object} [cfg]
 * @returns {string}
 */
export function buildReticleCursor(cfg = state.reticleConfig) {
  return svgCursor(getReticleSvgBody(cfg), 12, 12, "crosshair", 24);
}

const CURSOR_EYEDROPPER = svgCursor(
  `<path d="m2 22 1-1h3l9-9" fill="none" stroke="#09090b" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 21v-3l9-9" fill="none" stroke="#09090b" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" fill="none" stroke="#09090b" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="m2 22 1-1h3l9-9" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 21v-3l9-9" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  1,
  14,
  "crosshair",
  16,
);

function buildLucideButtonCursor(btnId, hotX, hotY, fallback, size = 16) {
  if (typeof document === "undefined") return fallback;
  const svgEl = document.getElementById(btnId)?.querySelector("svg");
  if (!svgEl) return fallback;
  const inner = svgEl.innerHTML;
  const halo = `<g fill="none" stroke="#09090b" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
  const fg = `<g fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
  return svgCursor(`${halo}${fg}`, hotX, hotY, "crosshair", size);
}

/**
 * Devuelve el cursor CSS adecuado para la herramienta activa sobre el lienzo.
 * @param {string} [toolName=state.currentTool]
 * @returns {string}
 */
export function getToolCursorCss(toolName = state.currentTool) {
  const reticle = buildReticleCursor(state.reticleConfig);
  if (toolName === "move") return "move";
  if (toolName === "pan") return "grab";
  if (toolName === "zoom") return "zoom-in";
  if (toolName === "eyedropper") return buildLucideButtonCursor("toolEyedropper", 1, 14, CURSOR_EYEDROPPER, 16);
  if (toolName === "bucket" || toolName === "fill") return buildLucideButtonCursor("toolBucket", 2, 13, reticle, 16);
  if (toolName === "magicSelect") return buildLucideButtonCursor("toolMagicSelect", 13, 3, reticle, 16);
  if (toolName === "backgroundEraser") return buildLucideButtonCursor("toolBackgroundEraser", 7, 5, reticle, 16);
  if (toolName === "blur" || toolName === "jumble" || toolName === "noise") return buildLucideButtonCursor("toolFilterBrush", 8, 8, reticle, 16);
  return reticle;
}

/**
 * Aplica inmediatamente el cursor CSS de la herramienta activa al canvas principal.
 */
export function refreshCanvasToolCursor() {
  if (typeof document === "undefined") return;
  const canvas = document.getElementById("paintCanvas");
  if (canvas) canvas.style.cursor = getToolCursorCss(state.currentTool);
}
