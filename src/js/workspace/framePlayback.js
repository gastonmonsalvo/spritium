/**
 * framePlayback.js: Reproducción de animación por FPS, navegación entre frames y configuración de Onion Skin.
 */

import { subscribe, state } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { setStatus, refreshIcons } from "../ui/index.js";
import { selectFrame } from "./frameOperations.js";

let playTimer = null;

/**
 * Activa o desactiva la visualización translúcida del frame anterior (Onion Skin).
 */
export function toggleOnionSkin() {
  state.onionSkin = !state.onionSkin;
  const btn = typeof document !== "undefined" ? document.getElementById("btnOnionSkin") : null;
  if (btn) btn.classList.toggle("active", state.onionSkin);
  renderAll();
  setStatus({ key: state.onionSkin ? "log.onion_on" : "log.onion_off" });
}

/**
 * Configura parámetros de Onion Skin (opacidad, modo Normal / Red-Blue, frames previos y siguientes).
 * @param {"mode"|"opacity"|"prevCount"|"nextCount"} key
 * @param {string|number} value
 */
export function setOnionSkinOption(key, value) {
  if (!state.onionSkinConfig) {
    state.onionSkinConfig = { prevCount: 1, nextCount: 0, opacity: 0.3, mode: "normal" };
  }
  if (key === "mode") {
    state.onionSkinConfig.mode = value === "redblue" ? "redblue" : "normal";
    if (typeof document !== "undefined") {
      document.getElementById("onionModeNormal")?.classList.toggle("active", state.onionSkinConfig.mode === "normal");
      document.getElementById("onionModeRedBlue")?.classList.toggle("active", state.onionSkinConfig.mode === "redblue");
    }
  } else if (key === "opacity") {
    const op = Math.max(0.1, Math.min(0.8, Number(value) || 0.3));
    state.onionSkinConfig.opacity = op;
    const label = typeof document !== "undefined" ? document.getElementById("onionOpacityVal") : null;
    if (label) label.textContent = `${Math.round(op * 100)}%`;
  } else if (key === "prevCount") {
    state.onionSkinConfig.prevCount = Math.max(0, Math.min(3, Math.round(Number(value) || 0)));
  } else if (key === "nextCount") {
    state.onionSkinConfig.nextCount = Math.max(0, Math.min(2, Math.round(Number(value) || 0)));
  }
  if (!state.onionSkin) {
    state.onionSkin = true;
    document.getElementById("btnOnionSkin")?.classList.add("active");
  }
  renderAll();
}

/**
 * Detiene la reproducción de la animación por frames.
 */
export function stopAnimation() {
  if (playTimer !== null) {
    clearTimeout(playTimer);
    playTimer = null;
  }
  state.isPlaying = false;
  const btn = typeof document !== "undefined" ? document.getElementById("btnPlayAnim") : null;
  if (btn) {
    btn.classList.remove("active");
    btn.innerHTML = `<i data-lucide="play" class="ui-icon-sm"></i><span>Play</span>`;
    refreshIcons(btn);
  }
}

/**
 * Alterna entre reproducir y detener la animación de frames según el FPS.
 */
export function togglePlayAnimation() {
  if (state.isPlaying) {
    stopAnimation();
    renderAll();
    return;
  }
  if (state.frames.length <= 1) {
    setStatus({ key: "log.play_min_two" }, true);
    return;
  }
  state.isPlaying = true;
  const btn = document.getElementById("btnPlayAnim");
  if (btn) {
    btn.classList.add("active");
    btn.innerHTML = `<i data-lucide="square" class="ui-icon-sm"></i><span>Stop</span>`;
    refreshIcons(btn);
  }

  const step = () => {
    if (!state.isPlaying) return;
    const tag = state.activeTagId
      ? (state.frameTags || []).find((t) => t.id === state.activeTagId)
      : null;
    const minIdx = tag ? Math.max(0, tag.from) : 0;
    const maxIdx = tag ? Math.min(state.frames.length - 1, tag.to) : state.frames.length - 1;
    let nextIdx = state.activeFrameIndex + 1;
    if (nextIdx > maxIdx || nextIdx < minIdx) nextIdx = minIdx;
    selectFrame(nextIdx);
    const fpsInput = /** @type {HTMLInputElement|null} */ (document.getElementById("animFpsInput"));
    const fps = Math.max(1, Math.min(60, Number(fpsInput?.value || 8)));
    playTimer = setTimeout(step, Math.round(1000 / fps));
  };
  step();
}

/**
 * Detiene la animación y salta al primer fotograma.
 */
export function goToFirstFrame() {
  stopAnimation();
  selectFrame(0);
}

/**
 * Detiene la animación y retrocede al fotograma anterior.
 */
export function goToPrevFrame() {
  stopAnimation();
  if (state.frames.length === 0) return;
  selectFrame((state.activeFrameIndex - 1 + state.frames.length) % state.frames.length);
}

/**
 * Detiene la animación y avanza al siguiente fotograma.
 */
export function goToNextFrame() {
  stopAnimation();
  if (state.frames.length === 0) return;
  selectFrame((state.activeFrameIndex + 1) % state.frames.length);
}

/**
 * Detiene la animación y salta al último fotograma.
 */
export function goToLastFrame() {
  stopAnimation();
  selectFrame(Math.max(0, state.frames.length - 1));
}

subscribe("frames:stop", () => stopAnimation());
