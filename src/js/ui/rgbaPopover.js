/**
 * rgbaPopover.js: Selector RGBA/HSLA/HEXA flotante (SV + Hue + Alpha + Switch Mode)
 * que reemplaza el input nativo RGB-only.
 */

import { rgbToHsl, hslToRgb } from "../core/color.js";

let popoverEl = null;
let svCanvas = null;
let hueCanvas = null;
let alphaCanvas = null;
let previewEl = null;
let rgbaReadoutEl = null;
let fieldsEl = null;
let isOpen = false;
let currentH = 350;
let currentS = 1;
let currentV = 1;
let currentA = 255;
let colorMode = "rgba"; // "rgba" | "hsla" | "hexa"
let activeDrag = null; // "sv" | "hue" | "alpha" | null
let onColorChangeCb = null;
let customOnChangeCb = null;
let activeAnchorEl = null;

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

function parseHexToRgba(hex) {
  const clean = String(hex || "").replace("#", "");
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    const n = parseInt(clean, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  if (/^[0-9a-fA-F]{8}$/.test(clean)) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      parseInt(clean.slice(6, 8), 16),
    ];
  }
  return null;
}

function drawChecker(ctx, w, h, step = 6) {
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const even = ((Math.floor(x / step) + Math.floor(y / step)) & 1) === 0;
      ctx.fillStyle = even ? "#d4d4d8" : "#71717a";
      ctx.fillRect(x, y, step, step);
    }
  }
}

function applyRgbaValues(r, g, b, a) {
  const [h, s, v] = rgbToHsv(
    Math.max(0, Math.min(255, Math.round(r))),
    Math.max(0, Math.min(255, Math.round(g))),
    Math.max(0, Math.min(255, Math.round(b))),
  );
  currentH = h;
  currentS = s;
  currentV = v;
  currentA = Math.max(0, Math.min(255, Math.round(a)));
  emitCurrentRgba();
}

function renderModeFields(r, g, b) {
  if (!fieldsEl) return;
  const aPct = Math.round((currentA / 255) * 100);

  if (colorMode === "hexa") {
    const val = rgbToHex(r, g, b, currentA);
    fieldsEl.innerHTML = `
      <label class="rgba-field-single">
        <span>HEX / RGBA</span>
        <input type="text" class="rgba-hex-field" maxlength="9" value="${val}" />
      </label>
    `;
    const inp = fieldsEl.querySelector(".rgba-hex-field");
    inp?.addEventListener("change", () => {
      const norm = inp.value.trim().startsWith("#") ? inp.value.trim() : `#${inp.value.trim()}`;
      const parsed = parseHexToRgba(norm);
      if (parsed) applyRgbaValues(parsed[0], parsed[1], parsed[2], parsed[3]);
      else inp.value = rgbToHex(r, g, b, currentA);
    });
    return;
  }

  if (colorMode === "hsla") {
    const [h, s, l] = rgbToHsl(r, g, b);
    const defs = [
      { key: "h", label: "H", val: Math.round(h), min: 0, max: 360 },
      { key: "s", label: "S%", val: Math.round(s), min: 0, max: 100 },
      { key: "l", label: "L%", val: Math.round(l), min: 0, max: 100 },
      { key: "a", label: "A%", val: aPct, min: 0, max: 100 },
    ];
    fieldsEl.innerHTML = defs
      .map(
        (d) =>
          `<label class="rgba-num-field"><span>${d.label}</span><input type="number" data-ch="${d.key}" min="${d.min}" max="${d.max}" value="${d.val}" /></label>`,
      )
      .join("");
    const commitHsla = () => {
      const getVal = (k) => Number(fieldsEl.querySelector(`input[data-ch="${k}"]`)?.value || 0);
      const [nr, ng, nb] = hslToRgb(getVal("h"), getVal("s"), getVal("l"));
      const na = Math.round((Math.max(0, Math.min(100, getVal("a"))) / 100) * 255);
      applyRgbaValues(nr, ng, nb, na);
    };
    fieldsEl.querySelectorAll("input").forEach((inp) => inp.addEventListener("change", commitHsla));
    return;
  }

  // Modo RGBA
  const defs = [
    { key: "r", label: "R", val: r, min: 0, max: 255 },
    { key: "g", label: "G", val: g, min: 0, max: 255 },
    { key: "b", label: "B", val: b, min: 0, max: 255 },
    { key: "a", label: "A%", val: aPct, min: 0, max: 100 },
  ];
  fieldsEl.innerHTML = defs
    .map(
      (d) =>
        `<label class="rgba-num-field"><span>${d.label}</span><input type="number" data-ch="${d.key}" min="${d.min}" max="${d.max}" value="${d.val}" /></label>`,
    )
    .join("");
  const commitRgba = () => {
    const getVal = (k) => Number(fieldsEl.querySelector(`input[data-ch="${k}"]`)?.value || 0);
    const na = Math.round((Math.max(0, Math.min(100, getVal("a"))) / 100) * 255);
    applyRgbaValues(getVal("r"), getVal("g"), getVal("b"), na);
  };
  fieldsEl.querySelectorAll("input").forEach((inp) => inp.addEventListener("change", commitRgba));
}

function renderPopoverCanvases() {
  if (!svCanvas || !hueCanvas || !alphaCanvas) return;

  // 1. Plano SV
  const sCtx = svCanvas.getContext("2d");
  const sw = svCanvas.width;
  const sh = svCanvas.height;
  const [hr, hg, hb] = hsvToRgb(currentH, 1, 1);
  sCtx.fillStyle = `rgb(${hr}, ${hg}, ${hb})`;
  sCtx.fillRect(0, 0, sw, sh);

  const wGrad = sCtx.createLinearGradient(0, 0, sw, 0);
  wGrad.addColorStop(0, "rgba(255,255,255,1)");
  wGrad.addColorStop(1, "rgba(255,255,255,0)");
  sCtx.fillStyle = wGrad;
  sCtx.fillRect(0, 0, sw, sh);

  const bGrad = sCtx.createLinearGradient(0, 0, 0, sh);
  bGrad.addColorStop(0, "rgba(0,0,0,0)");
  bGrad.addColorStop(1, "rgba(0,0,0,1)");
  sCtx.fillStyle = bGrad;
  sCtx.fillRect(0, 0, sw, sh);

  const cx = currentS * sw;
  const cy = (1 - currentV) * sh;
  sCtx.beginPath();
  sCtx.arc(cx, cy, 5, 0, Math.PI * 2);
  sCtx.lineWidth = 2;
  sCtx.strokeStyle = currentV > 0.55 && currentS < 0.35 ? "#18181b" : "#ffffff";
  sCtx.stroke();

  // 2. Barra Hue
  const hCtx = hueCanvas.getContext("2d");
  const hw = hueCanvas.width;
  const hh = hueCanvas.height;
  const hGrad = hCtx.createLinearGradient(0, 0, hw, 0);
  for (let i = 0; i <= 6; i++) {
    hGrad.addColorStop(i / 6, `hsl(${i * 60}, 100%, 50%)`);
  }
  hCtx.fillStyle = hGrad;
  hCtx.fillRect(0, 0, hw, hh);
  const hx = (currentH / 360) * hw;
  hCtx.strokeStyle = "#ffffff";
  hCtx.lineWidth = 2;
  hCtx.strokeRect(Math.max(1, Math.min(hw - 3, hx - 2)), 0, 4, hh);

  // 3. Barra Alpha
  const aCtx = alphaCanvas.getContext("2d");
  const aw = alphaCanvas.width;
  const ah = alphaCanvas.height;
  drawChecker(aCtx, aw, ah, 5);
  const [r, g, b] = hsvToRgb(currentH, currentS, currentV);
  const aGrad = aCtx.createLinearGradient(0, 0, aw, 0);
  aGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
  aGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 1)`);
  aCtx.fillStyle = aGrad;
  aCtx.fillRect(0, 0, aw, ah);
  const ax = (currentA / 255) * aw;
  aCtx.strokeStyle = "#ffffff";
  aCtx.lineWidth = 2;
  aCtx.strokeRect(Math.max(1, Math.min(aw - 3, ax - 2)), 0, 4, ah);

  // 4. Preview, readout y campos numéricos según modo activo
  const alphaNorm = Number((currentA / 255).toFixed(2));
  if (previewEl) {
    previewEl.style.setProperty("--picker-rgba", `rgba(${r}, ${g}, ${b}, ${alphaNorm})`);
  }
  if (rgbaReadoutEl) {
    if (colorMode === "hsla") {
      const [h, s, l] = rgbToHsl(r, g, b);
      rgbaReadoutEl.textContent = `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${alphaNorm})`;
    } else if (colorMode === "hexa") {
      rgbaReadoutEl.textContent = rgbToHex(r, g, b, currentA);
    } else {
      rgbaReadoutEl.textContent = `rgba(${r}, ${g}, ${b}, ${alphaNorm})`;
    }
  }
  renderModeFields(r, g, b);
}

/**
 * Actualiza el color visual (con Alpha sobre checkerboard) del botón `#customColorPickerBtn` y el popover.
 * @param {string} rgbaHex
 */
export function syncRgbaPickerPreview(rgbaHex) {
  const parsed = parseHexToRgba(rgbaHex);
  if (!parsed) return;
  const [r, g, b, a] = parsed;
  const [h, s, v] = rgbToHsv(r, g, b);
  currentH = h;
  currentS = s;
  currentV = v;
  currentA = a;

  const btn = document.getElementById("customColorPickerBtn");
  if (btn) {
    btn.style.setProperty("--picker-rgba", `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`);
    btn.title = `Elegir color RGBA: rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)}) · ${rgbToHex(r, g, b, a)}`;
  }
  if (isOpen) {
    renderPopoverCanvases();
  }
}

function emitCurrentRgba() {
  const [r, g, b] = hsvToRgb(currentH, currentS, currentV);
  const rgbHex = rgbToHex(r, g, b, 255).toLowerCase();
  const rgbaHex = rgbToHex(r, g, b, currentA);
  if (customOnChangeCb) {
    renderPopoverCanvases();
    customOnChangeCb(rgbaHex);
    return;
  }
  const picker = document.getElementById("customColorPicker");
  const alphaInput = document.getElementById("colorAlphaInput");
  if (picker) picker.value = rgbHex;
  if (alphaInput) alphaInput.value = String(Math.round(currentA));
  syncRgbaPickerPreview(rgbaHex);
  renderPopoverCanvases();
  if (onColorChangeCb) onColorChangeCb(rgbaHex);
}

function handleDragAt(e) {
  if (!activeDrag) return;
  if (activeDrag === "sv" && svCanvas) {
    const r = svCanvas.getBoundingClientRect();
    currentS = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    currentV = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
  } else if (activeDrag === "hue" && hueCanvas) {
    const r = hueCanvas.getBoundingClientRect();
    currentH = Math.max(0, Math.min(359.9, ((e.clientX - r.left) / r.width) * 360));
  } else if (activeDrag === "alpha" && alphaCanvas) {
    const r = alphaCanvas.getBoundingClientRect();
    currentA = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 255);
  }
  emitCurrentRgba();
}

function setColorPickerMode(mode) {
  colorMode = mode;
  if (!popoverEl) return;
  popoverEl.querySelectorAll(".rgba-mode-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
  renderPopoverCanvases();
}

function ensurePopoverDom() {
  if (popoverEl) return;
  popoverEl = document.createElement("div");
  popoverEl.id = "rgbaPickerPopover";
  popoverEl.className = "rgba-popover";
  popoverEl.setAttribute("role", "dialog");
  popoverEl.setAttribute("aria-label", "Selector de color RGBA / HSLA / HEX");
  popoverEl.innerHTML = `
    <div class="rgba-mode-switch" role="tablist" aria-label="Formato de color">
      <button type="button" class="tool-btn rgba-mode-btn active" data-mode="rgba">RGBA</button>
      <button type="button" class="tool-btn rgba-mode-btn" data-mode="hsla">HSLA</button>
      <button type="button" class="tool-btn rgba-mode-btn" data-mode="hexa">HEX</button>
    </div>
    <canvas class="rgba-sv-canvas" width="204" height="126"></canvas>
    <canvas class="rgba-bar-canvas rgba-hue-canvas" width="204" height="12" title="Matiz (Hue)"></canvas>
    <canvas class="rgba-bar-canvas rgba-alpha-canvas" width="204" height="12" title="Transparencia (Alpha)"></canvas>
    <div class="rgba-fields-row"></div>
    <div class="rgba-popover-footer">
      <div class="rgba-popover-preview"></div>
      <span class="rgba-readout">rgba(255, 0, 85, 1)</span>
    </div>
  `;
  document.body.appendChild(popoverEl);

  svCanvas = popoverEl.querySelector(".rgba-sv-canvas");
  hueCanvas = popoverEl.querySelector(".rgba-hue-canvas");
  alphaCanvas = popoverEl.querySelector(".rgba-alpha-canvas");
  previewEl = popoverEl.querySelector(".rgba-popover-preview");
  rgbaReadoutEl = popoverEl.querySelector(".rgba-readout");
  fieldsEl = popoverEl.querySelector(".rgba-fields-row");

  popoverEl.querySelectorAll(".rgba-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setColorPickerMode(btn.dataset.mode));
  });

  svCanvas.style.touchAction = "none";
  hueCanvas.style.touchAction = "none";
  alphaCanvas.style.touchAction = "none";

  svCanvas.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" || e.pointerType === "pen") e.preventDefault(); activeDrag = "sv"; handleDragAt(e); });
  hueCanvas.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" || e.pointerType === "pen") e.preventDefault(); activeDrag = "hue"; handleDragAt(e); });
  alphaCanvas.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" || e.pointerType === "pen") e.preventDefault(); activeDrag = "alpha"; handleDragAt(e); });

  window.addEventListener("pointermove", handleDragAt);
  window.addEventListener("pointerup", () => { activeDrag = null; });
  window.addEventListener("pointercancel", () => { activeDrag = null; });
  document.addEventListener("pointerdown", (e) => {
    if (!isOpen) return;
    const btn = activeAnchorEl || document.getElementById("customColorPickerBtn");
    if (popoverEl.contains(e.target) || btn?.contains(e.target)) return;
    closeRgbaPopover();
  });
  window.addEventListener("keydown", (e) => {
    if (isOpen && e.key === "Escape") closeRgbaPopover();
  });
}

function positionRgbaPopover(anchorEl) {
  if (!popoverEl || !anchorEl) return;
  const rect = anchorEl.getBoundingClientRect();
  const popW = popoverEl.offsetWidth || 224;
  const popH = popoverEl.offsetHeight || 296;
  const gap = 10;

  let left = rect.left - popW - gap;
  let originX = "right";
  if (left < 8) {
    const rightSpace = window.innerWidth - rect.right - gap;
    if (rightSpace >= popW) {
      left = rect.right + gap;
      originX = "left";
    } else {
      left = Math.max(8, Math.min(window.innerWidth - popW - 8, rect.left));
      originX = "center";
    }
  }
  const top = Math.max(8, Math.min(window.innerHeight - popH - 8, rect.top - 8));
  popoverEl.style.left = `${Math.round(left)}px`;
  popoverEl.style.top = `${Math.round(top)}px`;
  popoverEl.style.transformOrigin = `top ${originX}`;
  popoverEl.dataset.side = originX;
}

/** Cierra el popover RGBA activo si está abierto. */
export function closeRgbaPopover() {
  isOpen = false;
  customOnChangeCb = null;
  activeAnchorEl = null;
  if (popoverEl) popoverEl.classList.remove("open");
}

function openRgbaPopover(anchorEl) {
  ensurePopoverDom();
  customOnChangeCb = null;
  activeAnchorEl = anchorEl;
  const picker = document.getElementById("customColorPicker");
  const alphaInput = document.getElementById("colorAlphaInput");
  const rgbHex = (picker?.value || "#ff0055").toLowerCase();
  const alpha = alphaInput ? Math.max(0, Math.min(255, Math.round(Number(alphaInput.value)))) : 255;
  const parsed = parseHexToRgba(rgbHex);
  if (parsed) {
    const [h, s, v] = rgbToHsv(parsed[0], parsed[1], parsed[2]);
    currentH = h;
    currentS = s;
    currentV = v;
    currentA = alpha;
  }
  isOpen = true;
  renderPopoverCanvases();
  popoverEl.classList.add("open");
  positionRgbaPopover(anchorEl);
}

/**
 * Abre el popover RGBA/HSLA/HEX anclado a un control arbitrario (ej. Preferencias).
 * @param {HTMLElement} anchorEl
 * @param {string} initialRgbaHex
 * @param {(rgbaHex: string) => void} onChange
 */
export function openCustomRgbaPopover(anchorEl, initialRgbaHex, onChange) {
  if (isOpen && activeAnchorEl === anchorEl) {
    closeRgbaPopover();
    return;
  }
  ensurePopoverDom();
  activeAnchorEl = anchorEl;
  customOnChangeCb = typeof onChange === "function" ? onChange : null;
  const parsed = parseHexToRgba(initialRgbaHex) || [56, 189, 248, 255];
  const [h, s, v] = rgbToHsv(parsed[0], parsed[1], parsed[2]);
  currentH = h;
  currentS = s;
  currentV = v;
  currentA = parsed[3];
  isOpen = true;
  renderPopoverCanvases();
  popoverEl.classList.add("open");
  positionRgbaPopover(anchorEl);
}

/**
 * Inicializa el botón RGBA `#customColorPickerBtn` y su popover sincronizado.
 * @param {{onChange: (rgbaHex: string) => void, initialRgbaHex?: string}} options
 */
export function initRgbaColorPicker({ onChange, initialRgbaHex = "#ff0055" }) {
  onColorChangeCb = onChange;
  const btn = document.getElementById("customColorPickerBtn");
  if (!btn) return;
  syncRgbaPickerPreview(initialRgbaHex);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isOpen) closeRgbaPopover();
    else openRgbaPopover(btn);
  });
}
