/**
 * configIO.js: Exportación, importación y restablecimiento de configuración de usuario.
 */

import { setStatus } from "./status.js";
import { i18n } from "../i18n/I18nService.js";
import { THEME_STORAGE_KEY, CANVAS_BG_STORAGE_KEY, applyColorTheme, setCanvasBgIntensity } from "./theme.js";
import { LAYOUT_STORAGE_KEY, restoreLayoutState, resetDockedPanels } from "./docking.js";
import {
  getUserPreferencesPayload,
  applyUserPreferencesObject,
  resetUserPreferences,
} from "./preferences.js";

/** Exporta la configuración del usuario a un archivo JSON descargable. */
export function exportUserConfig() {
  const payload = {
    app: "Spritium",
    type: "user_config",
    version: 1,
    exportedAt: new Date().toISOString(),
    theme: localStorage.getItem(THEME_STORAGE_KEY) || "dark",
    layout: (() => {
      try {
        return JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) || "null");
      } catch {
        return null;
      }
    })(),
    customPalettes: (() => {
      try {
        return JSON.parse(localStorage.getItem("spritium_custom_palettes_v1") || "{}");
      } catch {
        return {};
      }
    })(),
    preferences: getUserPreferencesPayload()
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "spritium_config.json";
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus({ key: "log.cfg_exported" });
}

/**
 * Importa una configuración de usuario desde JSON y la aplica de inmediato.
 * @param {File} file
 * @param {Object} [options]
 */
export async function importUserConfig(file, { onPalettesChanged } = {}) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data?.type !== "user_config") {
      throw new Error("El archivo no es una configuración válida de Spritium.");
    }
    if (data.theme === "light" || data.theme === "dark") {
      localStorage.setItem(THEME_STORAGE_KEY, data.theme);
      applyColorTheme(data.theme);
    }
    if (data.layout) {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(data.layout));
      restoreLayoutState();
    } else {
      resetDockedPanels();
    }
    if (data.customPalettes && typeof data.customPalettes === "object") {
      localStorage.setItem("spritium_custom_palettes_v1", JSON.stringify(data.customPalettes));
      if (onPalettesChanged) onPalettesChanged();
    }
    if (data.preferences && typeof data.preferences === "object") {
      applyUserPreferencesObject(data.preferences);
    }
    setStatus({ key: "log.cfg_loaded" });
  } catch (err) {
    setStatus({ key: "log.cfg_load_err", params: { msg: err.message } }, true);
  }
}

/**
 * Restablece todas las preferencias persistidas en localStorage a valores de fábrica.
 * @param {Object} [options]
 */
export function resetAllUserConfig({ onPalettesChanged } = {}) {
  if (!window.confirm(i18n.t("config.confirm_reset"))) {
    return;
  }
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
    localStorage.removeItem("spritium_custom_palettes_v1");
    localStorage.removeItem("spritium_custom_brushes_v1");
  } catch {
    // ignore
  }
  applyColorTheme("dark");
  try {
    localStorage.removeItem(CANVAS_BG_STORAGE_KEY);
  } catch {
    // ignore
  }
  setCanvasBgIntensity(12, { persist: false });
  resetDockedPanels();
  resetUserPreferences();
  if (onPalettesChanged) onPalettesChanged();
  setStatus({ key: "log.cfg_reset" });
}

