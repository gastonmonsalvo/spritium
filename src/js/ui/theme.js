/**
 * theme.js: Tema oscuro/claro, intensidad del fondo del lienzo y escala de interfaz.
 */

import { state } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { renderRulers } from "../canvas/rulers.js";
import { setStatus, refreshIcons } from "./status.js";
import { openCustomRgbaPopover } from "./rgbaPopover.js";
import { i18n } from "../i18n/I18nService.js";

if (typeof window !== "undefined") {
  i18n.addEventListener("langchange", () => {
    const isLight = document.body.classList.contains("theme-light");
    for (const id of ["btnThemeToggle", "btnLauncherThemeToggle"]) {
      const b = document.getElementById(id);
      if (b) b.title = i18n.t(isLight ? "theme.to_dark" : "theme.to_light");
    }
  });
}

export const THEME_STORAGE_KEY = "spritium_ui_theme";
export const CANVAS_BG_STORAGE_KEY = "spritium_canvas_bg_lightness";
export const CANVAS_BG_CONFIG_STORAGE_KEY = "spritium_canvas_bg_config_v1";
const UI_SCALE_STORAGE_KEY = "spritium_ui_scale_v1";

let canvasBgState = {
  percent: 12,
  color: null, // null = neutro, o "#rrggbb"
  checker: true,
};
let bgRenderTimer = null;
let bgPersistTimer = null;

function parseHexRgba(hex) {
  const clean = String(hex || "").trim().replace("#", "");
  if (/^[0-9a-f]{6}$/i.test(clean)) {
    const n = parseInt(clean, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  if (/^[0-9a-f]{8}$/i.test(clean)) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      parseInt(clean.slice(6, 8), 16),
    ];
  }
  return null;
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex6(r, g, b) {
  return `#${((1 << 24) | (clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b)).toString(16).slice(1)}`;
}

function scheduleBgRenderAndPersist(persist, immediate) {
  if (immediate) {
    if (bgRenderTimer) { clearTimeout(bgRenderTimer); bgRenderTimer = null; }
    renderAll();
    if (persist) {
      if (bgPersistTimer) { clearTimeout(bgPersistTimer); bgPersistTimer = null; }
      try {
        localStorage.setItem(CANVAS_BG_STORAGE_KEY, String(canvasBgState.percent));
        localStorage.setItem(CANVAS_BG_CONFIG_STORAGE_KEY, JSON.stringify(canvasBgState));
      } catch {
        // ignore
      }
    }
    return;
  }

  if (!bgRenderTimer) {
    bgRenderTimer = setTimeout(() => {
      bgRenderTimer = null;
      renderAll();
    }, 65);
  }
  if (persist && !bgPersistTimer) {
    bgPersistTimer = setTimeout(() => {
      bgPersistTimer = null;
      try {
        localStorage.setItem(CANVAS_BG_STORAGE_KEY, String(canvasBgState.percent));
        localStorage.setItem(CANVAS_BG_CONFIG_STORAGE_KEY, JSON.stringify(canvasBgState));
      } catch {
        // ignore
      }
    }, 150);
  }
}

function applyCanvasBgVisuals({ persist = true, immediate = false } = {}) {
  const val = Math.max(0, Math.min(100, Math.round(Number(canvasBgState.percent) || 0)));
  canvasBgState.percent = val;
  const rgba = parseHexRgba(canvasBgState.color);
  const useChecker = canvasBgState.checker !== false;
  const isLight = typeof document !== "undefined" && document.body?.classList.contains("theme-light");

  let c1;
  let c2;
  let clearBodyInline = false;
  if (!rgba) {
    if (isLight && val === 92 && useChecker) {
      // Mantiene exactamente el damero crema cálido definido en body.theme-light (#DDD3C1 / #EAE2D3)
      c1 = [221, 211, 193];
      c2 = [234, 226, 211];
      clearBodyInline = true;
    } else if (isLight) {
      const t = val / 100;
      const base = Math.round(24 + t * 214);
      c1 = [base, clampByte(base - 8), clampByte(base - 22)];
      c2 = useChecker
        ? [clampByte(c1[0] + (val > 50 ? 12 : 14)), clampByte(c1[1] + (val > 50 ? 14 : 14)), clampByte(c1[2] + (val > 50 ? 16 : 14))]
        : [...c1];
    } else {
      const base = Math.round(20 + (val / 100) * 224);
      const alt = useChecker ? clampByte(base + (val > 50 ? -12 : 12)) : base;
      c1 = [base, base, clampByte(base + 3)];
      c2 = [alt, alt, clampByte(alt + 4)];
    }
  } else {
    const baseRgb = isLight ? [221, 211, 193] : [38, 38, 41];
    const altRgb = useChecker ? (isLight ? [234, 226, 211] : [48, 48, 52]) : baseRgb;
    const alpha = val / 100;
    const blend = (g, ch) => clampByte(g * (1 - alpha) + ch * alpha);
    const r1 = blend(baseRgb[0], rgba[0]);
    const g1 = blend(baseRgb[1], rgba[1]);
    const b1 = blend(baseRgb[2], rgba[2]);
    c1 = [r1, g1, b1];
    if (useChecker) {
      const lum = (0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1) / 255;
      const shift = lum > 0.5 ? -14 : 14;
      c2 = [
        blend(altRgb[0], clampByte(rgba[0] + shift)),
        blend(altRgb[1], clampByte(rgba[1] + shift)),
        blend(altRgb[2], clampByte(rgba[2] + shift)),
      ];
    } else {
      c2 = [...c1];
    }
  }

  const targetStyle = typeof document !== "undefined" ? (document.body?.style || document.documentElement?.style) : null;
  if (targetStyle) {
    if (clearBodyInline) {
      targetStyle.removeProperty("--checker-dark");
      targetStyle.removeProperty("--checker-light");
    } else {
      targetStyle.setProperty("--checker-dark", `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`);
      targetStyle.setProperty("--checker-light", `rgb(${c2[0]}, ${c2[1]}, ${c2[2]})`);
    }
  }

  const prevLightness = typeof state.canvasBgLightness === "number" ? state.canvasBgLightness : 0.15;
  const avgR = (c1[0] + c2[0]) / 2;
  const avgG = (c1[1] + c2[1]) / 2;
  const avgB = (c1[2] + c2[2]) / 2;
  const nextLightness = (0.2126 * avgR + 0.7152 * avgG + 0.0722 * avgB) / 255;
  state.canvasBgLightness = nextLightness;

  if (typeof document !== "undefined") {
    const slider = document.getElementById("canvasBgSlider");
    const label = document.getElementById("canvasBgValue");
    const swatch = document.getElementById("canvasBgColorSwatch");
    const checkerBtn = document.getElementById("btnCanvasBgChecker");
    if (slider && Number(slider.value) !== val) slider.value = String(val);
    if (label) label.textContent = `${val}%`;
    if (swatch) {
      swatch.style.background = rgba
        ? `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${(val / 100).toFixed(2)})`
        : `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`;
    }
    if (checkerBtn) checkerBtn.classList.toggle("active", useChecker);
  }

  const polarityFlipped = (prevLightness >= 0.5) !== (nextLightness >= 0.5);
  scheduleBgRenderAndPersist(persist, immediate || polarityFlipped);
}

/**
 * Devuelve una copia de la configuración actual del fondo de trabajo (`percent`, `color`, `checker`).
 * @returns {{ percent: number, color: string|null, checker: boolean }}
 */
export function getCanvasBgConfig() {
  return { ...canvasBgState };
}

/**
 * Aplica una configuración completa del fondo de trabajo (`percent`, `color`, `checker`).
 * @param {{ percent?: number, color?: string|null, checker?: boolean }} [next={}]
 * @param {{ persist?: boolean }} [options={}]
 */
export function setCanvasBgConfig(next = {}, options = {}) {
  if (typeof next.percent !== "undefined") canvasBgState.percent = Number(next.percent);
  if (typeof next.color !== "undefined") {
    const parsed = parseHexRgba(next.color);
    canvasBgState.color = parsed ? rgbToHex6(parsed[0], parsed[1], parsed[2]) : null;
  }
  if (typeof next.checker === "boolean") canvasBgState.checker = next.checker;
  applyCanvasBgVisuals({ ...options, immediate: true });
}

/**
 * Aplica la escala visual de la interfaz ("compact" | "medium" | "large") sin alterar el lienzo.
 * @param {"compact"|"medium"|"large"} scale
 * @param {boolean} [announce=true]
 */
export function setUiScale(scale, announce = true) {
  const valid = new Set(["compact", "medium", "large"]);
  const next = valid.has(scale) ? scale : "compact";

  if (typeof document !== "undefined" && document.body) {
    document.body.classList.remove("ui-scale-medium", "ui-scale-large");
    if (next === "medium") document.body.classList.add("ui-scale-medium");
    if (next === "large") document.body.classList.add("ui-scale-large");

    document.querySelectorAll("[data-ui-scale]").forEach((btn) => {
      const active = btn.getAttribute("data-ui-scale") === next;
      btn.classList.toggle("active", active);
    });
  }

  try {
    localStorage.setItem(UI_SCALE_STORAGE_KEY, next);
  } catch {
    // ignore storage errors
  }

  if (announce) {
    const labels = { compact: "100% (Compacta)", medium: "115% (Mediana)", large: "135% (Grande)" };
    setStatus({ key: "theme.ui_scale", params: { scale: labels[next] } });
  }
}

/**
 * Inicializa la escala visual de la interfaz desde `localStorage`.
 */
export function initUiScale() {
  let saved = "compact";
  try {
    saved = localStorage.getItem(UI_SCALE_STORAGE_KEY) || "compact";
  } catch {
    saved = "compact";
  }
  setUiScale(saved, false);
}

/**
 * Ajusta la luminosidad/opacidad del fondo del lienzo (0 = base/oscuro, 100 = claro/color pleno).
 * @param {number|string} percent
 * @param {Object} [options]
 */
export function setCanvasBgIntensity(percent, { persist = true } = {}) {
  canvasBgState.percent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  applyCanvasBgVisuals({ persist });
}

/**
 * Define el color de tinte del fondo de trabajo del lienzo (`null` para gris neutro).
 * @param {string|null} hex
 */
export function setCanvasBgColor(hex) {
  const rgba = parseHexRgba(hex);
  if (!rgba) {
    canvasBgState.color = null;
    applyCanvasBgVisuals({ persist: true, immediate: false });
    return;
  }
  const hadColor = Boolean(canvasBgState.color);
  canvasBgState.color = rgbToHex6(rgba[0], rgba[1], rgba[2]);
  if (rgba.length === 4 && (String(hex).replace("#", "").length === 8 || hadColor)) {
    canvasBgState.percent = Math.round((rgba[3] / 255) * 100);
  } else if (!hadColor && canvasBgState.percent < 50) {
    canvasBgState.percent = 100;
  }
  applyCanvasBgVisuals({ persist: true, immediate: false });
}

/**
 * Abre el selector RGBA/HSLA/HEX propio de Spritium anclado al botón de color de fondo.
 */
export function openCanvasBgColorPicker() {
  const btn = typeof document !== "undefined" ? document.getElementById("btnCanvasBgColor") : null;
  if (!btn) return;
  let initialHex;
  if (canvasBgState.color) {
    const alphaByte = Math.round((Math.max(0, Math.min(100, canvasBgState.percent)) / 100) * 255);
    const alphaHex = alphaByte < 255 ? alphaByte.toString(16).padStart(2, "0") : "";
    initialHex = `${canvasBgState.color}${alphaHex}`;
  } else {
    const base = Math.round(20 + (canvasBgState.percent / 100) * 224);
    initialHex = `${rgbToHex6(base, base, clampByte(base + 3))}ff`;
  }
  openCustomRgbaPopover(btn, initialHex, (rgbaHex) => {
    setCanvasBgColor(rgbaHex);
  });
}

/** Alterna entre fondo damero y fondo liso sólido. */
export function toggleCanvasBgChecker() {
  canvasBgState.checker = !canvasBgState.checker;
  applyCanvasBgVisuals({ persist: true, immediate: true });
}

/** Restablece el fondo de trabajo al damero gris neutro del tema activo. */
export function resetCanvasBg() {
  const isLight = typeof document !== "undefined" && document.body?.classList.contains("theme-light");
  canvasBgState = {
    percent: isLight ? 92 : 12,
    color: null,
    checker: true,
  };
  applyCanvasBgVisuals({ persist: true, immediate: true });
  setStatus({ key: "log.bg_reset" });
}

/** Inicializa el color, modo damero e intensidad del fondo del área de trabajo desde localStorage. */
export function initCanvasBgIntensity() {
  let savedCfg = null;
  let savedLegacy = null;
  try {
    const raw = localStorage.getItem(CANVAS_BG_CONFIG_STORAGE_KEY);
    if (raw) savedCfg = JSON.parse(raw);
    savedLegacy = localStorage.getItem(CANVAS_BG_STORAGE_KEY);
  } catch {
    savedCfg = null;
    savedLegacy = null;
  }
  if (savedCfg && typeof savedCfg === "object") {
    setCanvasBgConfig(savedCfg, { persist: false });
  } else if (savedLegacy !== null) {
    setCanvasBgConfig({ percent: savedLegacy, color: null, checker: true }, { persist: false });
  } else {
    const isLight = typeof document !== "undefined" && document.body?.classList.contains("theme-light");
    setCanvasBgConfig({ percent: isLight ? 92 : 12, color: null, checker: true }, { persist: false });
  }
}

/**
 * Aplica el tema visual oscuro, claro o win98 (solo sesión) y redibuja lienzo y reglas.
 * @param {string} mode
 */
export function applyColorTheme(mode) {
  const isLight = mode === "light";
  const isWin98 = mode === "win98";
  document.body?.classList.toggle("theme-light", isLight);
  document.body?.classList.toggle("theme-win98", isWin98);

  const brandTitle = document.querySelector("#topBar .app-brand-title");
  if (brandTitle) {
    brandTitle.textContent = isWin98 ? "Spritium 98" : "Spritium";
  }

  ["btnThemeToggle", "btnLauncherThemeToggle"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.innerHTML = `<i data-lucide="${isLight || isWin98 ? "moon" : "sun"}" class="ui-icon-sm"></i>`;
      btn.title = i18n.t(isLight || isWin98 ? "theme.to_dark" : "theme.to_light");
      refreshIcons(btn);
    }
  });
  if (!canvasBgState.color) {
    canvasBgState.percent = isLight ? 92 : 12;
  }
  applyCanvasBgVisuals({ persist: false, immediate: true });
  renderRulers();
}

/**
 * Inicializa el tema visual desde localStorage (oscuro por defecto).
 */
export function initColorTheme() {
  let saved = "dark";
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY) || "dark";
  } catch {
    saved = "dark";
  }
  if (saved !== "light") saved = "dark";
  applyColorTheme(saved);
}

/**
 * Alterna entre tema oscuro y claro persistiendo la preferencia.
 * Si está activo el easter egg Win98, vuelve al último tema guardado.
 */
export function toggleColorTheme() {
  const isWin98 = document.body?.classList.contains("theme-win98");
  let next;
  if (isWin98) {
    try {
      next = localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
    } catch {
      next = "dark";
    }
  } else {
    const isCurrentlyLight = document.body?.classList.contains("theme-light");
    next = isCurrentlyLight ? "dark" : "light";
  }
  applyColorTheme(next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // ignore storage quota errors
  }
  setStatus({ key: next === "light" ? "theme.light_on" : "theme.dark_on" });
}

let win98EggClicks = 0;
let win98EggLastClickAt = 0;

/** Reinicia el contador de clicks del easter egg Win98. */
export function resetWin98EasterEggClicks() {
  win98EggClicks = 0;
  win98EggLastClickAt = 0;
}

/** Alterna el tema easter egg Windows 98 solo para la sesión actual. */
export function toggleWin98Theme() {
  const isWin98 = document.body?.classList.contains("theme-win98");
  if (isWin98) {
    let saved = "dark";
    try {
      saved = localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
    } catch {
      saved = "dark";
    }
    applyColorTheme(saved);
    setStatus({ key: saved === "light" ? "theme.light_on" : "theme.dark_on" });
  } else {
    applyColorTheme("win98");
    document.getElementById("aboutModal")?.classList.remove("open");
    setStatus("Spritium 98 activado (solo esta sesión)");
  }
}

/**
 * Activa o desactiva el tema easter egg Windows 98 al clickear 7 veces el logo en About (solo por sesión).
 */
export function triggerWin98EasterEgg() {
  const now = Date.now();
  if (now - win98EggLastClickAt > 2500) {
    win98EggClicks = 0;
  }
  win98EggLastClickAt = now;
  win98EggClicks += 1;

  if (win98EggClicks < 7) return;
  resetWin98EasterEggClicks();
  toggleWin98Theme();
}

/**
 * Activa o desactiva el modo Tiled: none, both, x, y.
 * @param {"none"|"both"|"x"|"y"} mode
 */
