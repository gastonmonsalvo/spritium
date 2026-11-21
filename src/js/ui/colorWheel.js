/**
 * colorWheel.js: Rueda de Color HSV interactiva con generador de armonías cromáticas
 * (Complementario, Análogo, Tríada, Complementario Dividido y Tétrada).
 */

import { setStatus } from "./status.js";
import { syncRgbaPickerPreview } from "./rgbaPopover.js";

let wheelCanvas = null;
let currentH = 350; // 0..360
let currentS = 0.85; // 0..1
let currentV = 1.0; // 0..1
let currentAlpha = 255; // 0..255
let dragZone = null; // "ring" | "box" | null
let onColorPicked = null;

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) { r1 = c; g1 = x; }
  else if (h < 120) { r1 = x; g1 = c; }
  else if (h < 180) { g1 = c; b1 = x; }
  else if (h < 240) { g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

function rgbToHsv(r, g, b) {
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r1) h = 60 * (((g1 - b1) / d) % 6);
    else if (max === g1) h = 60 * ((b1 - r1) / d + 2);
    else h = 60 * ((r1 - g1) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function rgbToHex(r, g, b, a = 255) {
  const base = "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase();
  const alpha = Math.max(0, Math.min(255, Math.round(a)));
  return alpha >= 255 ? base : base + alpha.toString(16).padStart(2, "0").toUpperCase();
}

function hexToRgba(hex) {
  const clean = String(hex || "").replace("#", "");
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    const n = parseInt(clean, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  if (/^[0-9a-fA-F]{8}$/.test(clean)) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const a = parseInt(clean.slice(6, 8), 16);
    return [r, g, b, a];
  }
  return null;
}

function getHarmonyAngles(baseH, mode) {
  const norm = (a) => ((a % 360) + 360) % 360;
  switch (mode) {
    case "complementary":
      return [norm(baseH), norm(baseH + 180)];
    case "analogous":
      return [norm(baseH - 30), norm(baseH), norm(baseH + 30)];
    case "triad":
      return [norm(baseH), norm(baseH + 120), norm(baseH + 240)];
    case "split":
      return [norm(baseH), norm(baseH + 150), norm(baseH + 210)];
    case "tetrad":
      return [norm(baseH), norm(baseH + 90), norm(baseH + 180), norm(baseH + 270)];
    default:
      return [norm(baseH)];
  }
}

function getGeometry(size) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.46;
  const innerR = size * 0.38;
  const boxHalf = Math.floor((innerR - 9) / Math.SQRT2);
  return { cx, cy, outerR, innerR, boxHalf };
}

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function renderColorWheel() {
  if (!wheelCanvas) return;
  const ctx = wheelCanvas.getContext("2d");
  const size = wheelCanvas.width;
  const { cx, cy, outerR, innerR, boxHalf } = getGeometry(size);

  ctx.clearRect(0, 0, size, size);

  // 1. Anillo fino de matiz (Hue) con borde sutil
  const midR = (outerR + innerR) / 2;
  const ringW = outerR - innerR;
  for (let deg = 0; deg < 360; deg += 1) {
    const a0 = ((deg - 0.6) * Math.PI) / 180;
    const a1 = ((deg + 1.2) * Math.PI) / 180;
    ctx.beginPath();
    ctx.arc(cx, cy, midR, a0, a1);
    ctx.strokeStyle = `hsl(${deg}, 88%, 54%)`;
    ctx.lineWidth = ringW;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.stroke();

  // 2. Cuadrado interior Saturación (X) / Valor (Y) con esquinas redondeadas
  const bx = cx - boxHalf;
  const by = cy - boxHalf;
  const bw = boxHalf * 2;

  ctx.save();
  drawRoundedRectPath(ctx, bx, by, bw, bw, 5);
  ctx.clip();

  const alphaNorm = Math.max(0, Math.min(1, currentAlpha / 255));
  if (alphaNorm < 1) {
    const chk = 6;
    for (let cy0 = by; cy0 < by + bw; cy0 += chk) {
      for (let cx0 = bx; cx0 < bx + bw; cx0 += chk) {
        const even = ((Math.floor((cx0 - bx) / chk) + Math.floor((cy0 - by) / chk)) & 1) === 0;
        ctx.fillStyle = even ? "#d4d4d8" : "#71717a";
        ctx.fillRect(cx0, cy0, chk, chk);
      }
    }
    ctx.globalAlpha = alphaNorm;
  }

  const [hr, hg, hb] = hsvToRgb(currentH, 1, 1);
  ctx.fillStyle = rgbToHex(hr, hg, hb);
  ctx.fillRect(bx, by, bw, bw);

  const whiteGrad = ctx.createLinearGradient(bx, by, bx + bw, by);
  whiteGrad.addColorStop(0, "rgba(255,255,255,1)");
  whiteGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = whiteGrad;
  ctx.fillRect(bx, by, bw, bw);

  const blackGrad = ctx.createLinearGradient(bx, by, bx, by + bw);
  blackGrad.addColorStop(0, "rgba(0,0,0,0)");
  blackGrad.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = blackGrad;
  ctx.fillRect(bx, by, bw, bw);
  ctx.restore();

  drawRoundedRectPath(ctx, bx, by, bw, bw, 5);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // 3. Marcadores minimalistas de armonía en el anillo
  const mode = document.getElementById("colorHarmonySelect")?.value || "triad";
  const angles = getHarmonyAngles(currentH, mode);

  angles.forEach((ang, idx) => {
    const rad = (ang * Math.PI) / 180;
    const mx = cx + Math.cos(rad) * midR;
    const my = cy + Math.sin(rad) * midR;
    ctx.beginPath();
    ctx.arc(mx, my, idx === 0 ? 4.5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${ang}, 90%, 54%)`;
    ctx.fill();
    ctx.lineWidth = idx === 0 ? 2 : 1.25;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  });

  // 4. Cursor dentro del cuadrado SV
  const sx = bx + currentS * bw;
  const sy = by + (1 - currentV) * bw;
  ctx.beginPath();
  ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
  ctx.lineWidth = 1.75;
  ctx.strokeStyle = currentV > 0.55 && currentS < 0.35 ? "#18181b" : "#ffffff";
  ctx.stroke();
}

/** Renderiza las muestras de armonía cromática derivadas del matiz actual. */
export function renderHarmonySwatches() {
  const container = document.getElementById("harmonySwatches");
  if (!container) return;
  const mode = document.getElementById("colorHarmonySelect")?.value || "triad";
  const angles = getHarmonyAngles(currentH, mode);
  container.innerHTML = "";

  const alphaNorm = Math.max(0, Math.min(1, currentAlpha / 255));
  for (const ang of angles) {
    const [r, g, b] = hsvToRgb(ang, currentS, currentV);
    const rgbaHex = rgbToHex(r, g, b, currentAlpha);
    const cssRgba = `rgba(${r}, ${g}, ${b}, ${alphaNorm.toFixed(2)})`;
    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = "harmony-swatch";
    sw.style.backgroundColor = cssRgba;
    sw.title = `${cssRgba} · ${rgbaHex} (Clic Izq: Color 1° · Clic Der: Color 2°)`;
    sw.addEventListener("click", () => {
      if (onColorPicked) onColorPicked(rgbaHex, false);
      setStatus({ key: "log.harmony_1", params: { color: cssRgba } });
    });
    sw.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (onColorPicked) onColorPicked(rgbaHex, true);
      setStatus({ key: "log.harmony_2", params: { color: cssRgba } });
    });
    container.appendChild(sw);
  }
}

/** Sincroniza la rueda HSV y sus armonías a partir de un color hexadecimal.
 * @param {string} hex */
export function syncWheelFromHex(hex) {
  const rgba = hexToRgba(hex);
  if (!rgba) return;
  const [h, s, v] = rgbToHsv(rgba[0], rgba[1], rgba[2]);
  currentH = h;
  currentS = s;
  currentV = v;
  currentAlpha = rgba[3];
  renderColorWheel();
  renderHarmonySwatches();
}

function handlePointer(e) {
  if (!wheelCanvas) return;
  const rect = wheelCanvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * wheelCanvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * wheelCanvas.height;
  const { cx, cy, outerR, innerR, boxHalf } = getGeometry(wheelCanvas.width);
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);

  if (!dragZone) {
    if (dist >= innerR - 2 && dist <= outerR + 4) {
      dragZone = "ring";
    } else if (Math.abs(dx) <= boxHalf + 2 && Math.abs(dy) <= boxHalf + 2) {
      dragZone = "box";
    } else {
      return;
    }
  }

  if (dragZone === "ring") {
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    currentH = deg;
  } else if (dragZone === "box") {
    const bw = boxHalf * 2;
    currentS = Math.max(0, Math.min(1, (dx + boxHalf) / bw));
    currentV = Math.max(0, Math.min(1, 1 - (dy + boxHalf) / bw));
  }

  const alphaEl = document.getElementById("colorAlphaInput");
  if (alphaEl) {
    currentAlpha = Math.max(0, Math.min(255, Math.round(Number(alphaEl.value))));
  }
  const [r, g, b] = hsvToRgb(currentH, currentS, currentV);
  const rgbaHex = rgbToHex(r, g, b, currentAlpha);
  const pickerEl = document.getElementById("customColorPicker");
  if (pickerEl) pickerEl.value = rgbToHex(r, g, b).toLowerCase();
  const hexInputEl = document.getElementById("hexColorInput");
  if (hexInputEl && document.activeElement !== hexInputEl) hexInputEl.value = rgbaHex;
  syncRgbaPickerPreview(rgbaHex);
  renderColorWheel();
  renderHarmonySwatches();
  if (onColorPicked) onColorPicked(rgbaHex, false);
}

/** Inicializa los listeners de la rueda cromática HSV.
 * @param {{onSelectColor: Function}} options */
export function initColorWheel({ onSelectColor }) {
  onColorPicked = onSelectColor;
  wheelCanvas = document.getElementById("colorWheelCanvas");
  if (!wheelCanvas) return;

  wheelCanvas.style.touchAction = "none";
  wheelCanvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.pointerType === "touch" || e.pointerType === "pen") e.preventDefault();
    dragZone = null;
    handlePointer(e);
  });
  window.addEventListener("pointermove", (e) => {
    if (!dragZone) return;
    handlePointer(e);
  });
  window.addEventListener("pointerup", () => {
    dragZone = null;
  });
  window.addEventListener("pointercancel", () => {
    dragZone = null;
  });

  const harmonySelect = document.getElementById("colorHarmonySelect");
  harmonySelect?.addEventListener("change", () => {
    renderColorWheel();
    renderHarmonySwatches();
  });

  renderColorWheel();
  renderHarmonySwatches();
}

/** Muestra u oculta el panel colapsable de la rueda cromática HSV. */
export function toggleColorWheelPanel() {
  const panel = document.getElementById("colorWheelCollapse");
  const btn = document.getElementById("btnToggleColorWheel");
  if (!panel) return;
  const open = panel.style.display === "none";
  panel.style.display = open ? "flex" : "none";
  btn?.classList.toggle("active", open);
  if (open) {
    renderColorWheel();
    renderHarmonySwatches();
  }
}
