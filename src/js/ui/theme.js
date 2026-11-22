/**
 * theme.js: Tema oscuro/claro, intensidad del fondo del lienzo y escala de interfaz.
 */

import { state } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { renderRulers } from "../canvas/rulers.js";
import { setStatus, refreshIcons } from "./status.js";
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
const UI_SCALE_STORAGE_KEY = "spritium_ui_scale_v1";

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
 * Ajusta la luminosidad del checkerboard de fondo del lienzo (0 = oscuro, 100 = claro).
 * @param {number|string} percent
 * @param {Object} [options]
 */
export function setCanvasBgIntensity(percent, { persist = true } = {}) {
  const val = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const c1 = Math.round(20 + (val / 100) * 224);
  const c2 = Math.max(0, Math.min(255, c1 + (val > 50 ? -12 : 12)));
  const rootStyle = document.documentElement?.style;
  if (rootStyle) {
    rootStyle.setProperty("--checker-dark", `rgb(${c1}, ${c1}, ${c1 + 3})`);
    rootStyle.setProperty("--checker-light", `rgb(${c2}, ${c2}, ${c2 + 4})`);
  }
  state.canvasBgLightness = val / 100;

  const slider = document.getElementById("canvasBgSlider");
  const label = document.getElementById("canvasBgValue");
  if (slider && Number(slider.value) !== val) slider.value = String(val);
  if (label) label.textContent = `${val}%`;

  if (persist) {
    try {
      localStorage.setItem(CANVAS_BG_STORAGE_KEY, String(val));
    } catch {
      // ignore
    }
  }
  renderAll();
}

/** Inicializa la intensidad del fondo del área de trabajo desde localStorage. */
export function initCanvasBgIntensity() {
  let saved = null;
  try {
    saved = localStorage.getItem(CANVAS_BG_STORAGE_KEY);
  } catch {
    saved = null;
  }
  if (saved !== null) {
    setCanvasBgIntensity(saved, { persist: false });
  } else {
    const isLight = document.body?.classList.contains("theme-light");
    setCanvasBgIntensity(isLight ? 92 : 12, { persist: false });
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
  renderAll();
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
 * Activa o desactiva el modo Tiled: none, both, x, y.
 * @param {"none"|"both"|"x"|"y"} mode
 */
