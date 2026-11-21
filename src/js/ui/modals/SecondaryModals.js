// @ts-check
/**
 * SecondaryModals.js: Punto de montaje modular para modales secundarios y ventana flotante de logs.
 */

import { renderHelpModal } from "./HelpModal.js";
import { renderAboutModal } from "./AboutModal.js";
import { renderLogHistoryWindow } from "./LogHistoryWindow.js";
import { renderRecoveryModal } from "./RecoveryModal.js";
import { renderTilemapModal } from "./TilemapModal.js";
import { renderTilemapImportModal } from "./TilemapImportModal.js";
import { renderPreferencesModal } from "./PreferencesModal.js";
import { renderLanguageModal } from "./LanguageModal.js";
import { renderFeedbackModal } from "./FeedbackModal.js";
import { renderNoiseModal } from "./NoiseModal.js";

/**
 * Monta en `#secondaryModalsMount` los modales secundarios si todavía no fueron insertados.
 */
export function mountSecondaryModals() {
  const mount = document.getElementById("secondaryModalsMount");
  if (!mount || mount.dataset.mounted === "true") return;
  mount.innerHTML = [
    renderHelpModal(),
    renderAboutModal(),
    renderLogHistoryWindow(),
    renderRecoveryModal(),
    renderTilemapModal(),
    renderTilemapImportModal(),
    renderPreferencesModal(),
    renderLanguageModal(),
    renderFeedbackModal(),
    renderNoiseModal(),
  ].join("");
  mount.dataset.mounted = "true";
}
