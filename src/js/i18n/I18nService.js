/**
 * I18nService.js: Servicio central observable (EventTarget) para internacionalización (i18n).
 */

import { dictionaries } from "./dictionaries.js";

export const LANG_STORAGE_KEY = "pixel_editor_lang";

/** Servicio observable de internacionalización (EventTarget) con interpolación de parámetros. */
export class I18nService extends EventTarget {
  /**
   * @param {Record<string, Record<string, string>>} dicts
   * @param {string} [defaultLang='es']
   */
  constructor(dicts, defaultLang = "es") {
    super();
    this.dictionaries = dicts;
    let stored = null;
    try {
      stored = typeof localStorage !== "undefined" ? localStorage.getItem(LANG_STORAGE_KEY) : null;
    } catch {
      stored = null;
    }
    this.currentLang = stored && this.dictionaries[stored] ? stored : defaultLang;
  }

  /**
   * Inicializa el atributo `lang` raíz y notifica a todos los observadores suscriptos.
   */
  init() {
    if (typeof document !== "undefined") {
      document.documentElement.lang = this.currentLang;
    }
    this.notify();
  }

  /**
   * Cambia el idioma activo, persiste la preferencia, actualiza `<html lang>` y emite `langchange`.
   * @param {string} lang
   */
  setLanguage(lang) {
    if (!this.dictionaries[lang] || this.currentLang === lang) return;
    this.currentLang = lang;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LANG_STORAGE_KEY, lang);
      }
    } catch {
      // ignore storage quota/privacy errors
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
    this.notify();
  }

  /**
   * Emite el evento `langchange` a todos los suscriptores.
   */
  notify() {
    this.dispatchEvent(
      new CustomEvent("langchange", {
        detail: { lang: this.currentLang },
      }),
    );
  }

  /**
   * Obtiene la traducción correspondiente e interpola placeholders `{{variable}}`.
   * @param {string} key
   * @param {Record<string, string | number>} [params]
   * @returns {string}
   */
  t(key, params = {}) {
    let text = this.dictionaries[this.currentLang]?.[key] ?? this.dictionaries.es?.[key] ?? key;
    for (const [paramKey, value] of Object.entries(params)) {
      text = text.replaceAll(`{{${paramKey}}}`, String(value));
    }
    return text;
  }
}

export const i18n = new I18nService(dictionaries, "es");
