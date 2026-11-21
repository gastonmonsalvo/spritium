// @ts-check
/**
 * version.js: Fuente única de verdad para la versión pública y canal de distribución de Spritium.
 */

export const APP_VERSION = "0.9.0-beta.1";
export const APP_CHANNEL = "beta";

/**
 * Devuelve la versión formateada con prefijo `v` para mostrar en la UI.
 * @returns {string} Versión legible (ej. `v0.9.0-beta.1`).
 */
export function formatAppVersion() {
  return `v${APP_VERSION}`;
}
