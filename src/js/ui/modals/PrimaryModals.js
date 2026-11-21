// @ts-check
/**
 * PrimaryModals.js: Punto de montaje modular para los modales principales de documento, importación y exportación.
 */

import { renderFolderBrowserModal } from "./FolderBrowserModal.js";
import { renderCustomResModal } from "./CustomResModal.js";
import { renderNewDocModal } from "./NewDocModal.js";
import { renderImportOptionsModal } from "./ImportOptionsModal.js";
import { renderNewPaletteModal } from "./NewPaletteModal.js";
import { renderTagModal } from "./TagModal.js";
import { renderExportModal } from "./ExportModal.js";

/**
 * Monta en `#primaryModalsMount` los modales principales si todavía no fueron insertados.
 */
export function mountPrimaryModals() {
  const mount = document.getElementById("primaryModalsMount");
  if (!mount || mount.dataset.mounted === "true") return;
  mount.innerHTML = [
    renderFolderBrowserModal(),
    renderCustomResModal(),
    renderNewDocModal(),
    renderImportOptionsModal(),
    renderNewPaletteModal(),
    renderTagModal(),
    renderExportModal(),
  ].join("");
  mount.dataset.mounted = "true";
}
