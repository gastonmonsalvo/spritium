// @ts-check
/**
 * uiHtml.js: Utilidades mínimas para renderizado declarativo con template literals nativos.
 */

/**
 * Escapa caracteres HTML especiales al interpolar datos dinámicos.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Mapea un array de items a un string HTML continuo.
 * @template T
 * @param {readonly T[]} items
 * @param {(item: T, index: number) => string} renderItem
 * @returns {string}
 */
export function renderList(items, renderItem) {
  return items.map(renderItem).join("");
}
