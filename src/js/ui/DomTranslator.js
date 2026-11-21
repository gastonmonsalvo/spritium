/**
 * DomTranslator.js: Traductor del DOM estático suscripto al evento `langchange` de `i18n`.
 */

import { i18n } from "../i18n/I18nService.js";

/**
 * Actualiza textos, tooltips, placeholders y etiquetas ARIA del DOM estático según el idioma activo.
 */
export function translateStaticDOM() {
  if (typeof document === "undefined") return;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = i18n.t(key);
  });

  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.dataset.i18nTitle;
    if (key) el.title = i18n.t(key);
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const key = el.dataset.i18nAriaLabel;
    if (key) el.setAttribute("aria-label", i18n.t(key));
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (key) el.setAttribute("placeholder", i18n.t(key));
  });
}

/**
 * Abre el modal compacto de selección de idioma.
 */
export function openLanguageModal() {
  document.getElementById("languageModal")?.classList.add("open");
}

/**
 * Cierra el modal de selección de idioma.
 */
export function closeLanguageModal() {
  document.getElementById("languageModal")?.classList.remove("open");
}

let isInitialized = false;

/**
 * Inicializa la suscripción Observer a `langchange` y el handler puro de botones `[data-lang]`.
 */
export function initDomTranslator() {
  if (isInitialized) return;
  isInitialized = true;

  i18n.addEventListener("langchange", () => {
    translateStaticDOM();
    closeLanguageModal();
  });

  if (typeof document !== "undefined") {
    // Regla 1: El botón de idioma únicamente notifica al servicio I18nService.
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lang]");
      if (!btn) return;
      i18n.setLanguage(btn.dataset.lang);
    });
  }
}
