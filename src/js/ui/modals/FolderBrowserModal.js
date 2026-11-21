// @ts-check
/**
 * FolderBrowserModal.js: Modal explorador de carpeta local.
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml } from "../components/uiHtml.js";

/** Genera el HTML del modal explorador de carpeta local. */
export function renderFolderBrowserModal() {
  return `
    <div id="folderBrowserModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="folderBrowserTitle" data-backdrop-close="closeFolderBrowserModal">
      <div class="modal-card" style="width: min(560px, 94vw)">
        <div class="modal-header">
          <h3 id="folderBrowserTitle" data-i18n="modal.folder.title">${escapeHtml(i18n.t("modal.folder.title"))}</h3>
          <button type="button" class="tool-btn" data-action="closeFolderBrowserModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>
        <div style="font-size: 11px; color: var(--text-dim)" data-i18n="pm.folder_hint">
          ${escapeHtml(i18n.t("pm.folder_hint"))}
        </div>
        <div id="folderBrowserGrid" class="folder-grid"></div>
        <div class="modal-actions">
          <button type="button" class="tool-btn" data-action="openFolderDialog" data-i18n="modal.folder.change">${escapeHtml(i18n.t("modal.folder.change"))}</button>
          <button type="button" class="tool-btn" data-action="closeFolderBrowserModal" data-i18n="common.close">${escapeHtml(i18n.t("common.close"))}</button>
        </div>
      </div>
    </div>
  `;
}
