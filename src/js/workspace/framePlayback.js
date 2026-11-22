/**
 * framePlayback.js: Reproducción de animación por FPS, navegación entre frames y configuración de Onion Skin.
 */

import { subscribe, state } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { setStatus, refreshIcons } from "../ui/index.js";
import { selectFrame } from "./frameOperations.js";
import {
  applyOnionSkinOption,
  computeNextPlaybackFrame,
  computePlaybackDelayMs,
  computeStepFrameIndex,
} from "./framePlaybackCore.js";

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
  const { onionSkinConfig } = applyOnionSkinOption(state, key, value);
  if (typeof document !== "undefined") {
    if (key === "mode") {
      document.getElementById("onionModeNormal")?.classList.toggle("active", onionSkinConfig.mode === "normal");
      document.getElementById("onionModeRedBlue")?.classList.toggle("active", onionSkinConfig.mode === "redblue");
    } else if (key === "opacity") {
      const label = document.getElementById("onionOpacityVal");
      if (label) label.textContent = `${Math.round(onionSkinConfig.opacity * 100)}%`;
    }
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
  const btn = typeof document !== "undefined" ? document.getElementById("btnPlayAnim") : null;
  if (btn) {
    btn.classList.add("active");
    btn.innerHTML = `<i data-lucide="square" class="ui-icon-sm"></i><span>Stop</span>`;
    refreshIcons(btn);
  }

  const step = () => {
    if (!state.isPlaying) return;
    const nextIdx = computeNextPlaybackFrame({
      activeFrameIndex: state.activeFrameIndex,
      framesCount: state.frames.length,
      frameTags: state.frameTags || [],
      activeTagId: state.activeTagId,
    });
    selectFrame(nextIdx);
    const fpsInput = typeof document !== "undefined"
      ? /** @type {HTMLInputElement|null} */ (document.getElementById("animFpsInput"))
      : null;
    playTimer = setTimeout(step, computePlaybackDelayMs(fpsInput?.value));
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
  const next = computeStepFrameIndex(state.activeFrameIndex, state.frames.length, -1);
  if (next !== null) selectFrame(next);
}

/**
 * Detiene la animación y avanza al siguiente fotograma.
 */
export function goToNextFrame() {
  stopAnimation();
  const next = computeStepFrameIndex(state.activeFrameIndex, state.frames.length, 1);
  if (next !== null) selectFrame(next);
}

/**
 * Detiene la animación y salta al último fotograma.
 */
export function goToLastFrame() {
  stopAnimation();
  selectFrame(Math.max(0, state.frames.length - 1));
}

subscribe("frames:stop", () => stopAnimation());
