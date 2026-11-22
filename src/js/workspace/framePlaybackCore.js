/**
 * framePlaybackCore.js: Lógica pura de Onion Skin, rango de reproducción por tag, FPS y navegación de frames.
 */

export const DEFAULT_ONION_SKIN_CONFIG = Object.freeze({
  prevCount: 1,
  nextCount: 0,
  opacity: 0.3,
  mode: "normal",
});

/**
 * Aplica una opción de Onion Skin sobre el estado y devuelve la configuración actualizada.
 * @param {{ onionSkin?: boolean, onionSkinConfig?: { prevCount: number, nextCount: number, opacity: number, mode: string } }} stateObj
 * @param {"mode"|"opacity"|"prevCount"|"nextCount"} key
 * @param {string|number} value
 * @returns {{ onionSkin: boolean, onionSkinConfig: { prevCount: number, nextCount: number, opacity: number, mode: string } }}
 */
export function applyOnionSkinOption(stateObj, key, value) {
  if (!stateObj.onionSkinConfig) {
    stateObj.onionSkinConfig = { ...DEFAULT_ONION_SKIN_CONFIG };
  }
  const cfg = stateObj.onionSkinConfig;
  if (key === "mode") {
    cfg.mode = value === "redblue" ? "redblue" : "normal";
  } else if (key === "opacity") {
    cfg.opacity = Math.max(0.1, Math.min(0.8, Number(value) || 0.3));
  } else if (key === "prevCount") {
    cfg.prevCount = Math.max(0, Math.min(3, Math.round(Number(value) || 0)));
  } else if (key === "nextCount") {
    cfg.nextCount = Math.max(0, Math.min(2, Math.round(Number(value) || 0)));
  }
  stateObj.onionSkin = true;
  return { onionSkin: true, onionSkinConfig: cfg };
}

/**
 * Calcula el próximo índice de fotograma respetando el rango del tag activo (si existe).
 * @param {{ activeFrameIndex: number, framesCount: number, frameTags?: Array<{ id: string, from: number, to: number }>, activeTagId?: string|null }} params
 * @returns {number}
 */
export function computeNextPlaybackFrame({ activeFrameIndex, framesCount, frameTags = [], activeTagId = null }) {
  if (framesCount <= 0) return 0;
  const tag = activeTagId ? frameTags.find((t) => t.id === activeTagId) : null;
  const minIdx = tag ? Math.max(0, tag.from) : 0;
  const maxIdx = tag ? Math.min(framesCount - 1, tag.to) : framesCount - 1;
  if (minIdx > maxIdx) return Math.max(0, Math.min(framesCount - 1, minIdx));
  let nextIdx = activeFrameIndex + 1;
  if (nextIdx > maxIdx || nextIdx < minIdx) nextIdx = minIdx;
  return nextIdx;
}

/**
 * Convierte FPS (clampeado 1..60, default 8) a intervalo en milisegundos.
 * @param {number|string|null|undefined} fpsValue
 * @returns {number}
 */
export function computePlaybackDelayMs(fpsValue) {
  const fps = Math.max(1, Math.min(60, Number(fpsValue || 8)));
  return Math.round(1000 / fps);
}

/**
 * Calcula un desplazamiento circular de fotograma (`-1`, `+1`, etc.). Retorna `null` si no hay frames.
 * @param {number} activeFrameIndex
 * @param {number} framesCount
 * @param {number} delta
 * @returns {number|null}
 */
export function computeStepFrameIndex(activeFrameIndex, framesCount, delta) {
  if (framesCount <= 0) return null;
  return ((activeFrameIndex + delta) % framesCount + framesCount) % framesCount;
}
