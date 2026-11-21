// @ts-check
/**
 * RecoveryModal.js: Modal de recuperación de trabajo y checkpoints de autoguardado.
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml } from "../components/uiHtml.js";

/** Genera el HTML del modal de recuperación de trabajo (Crash Recovery). */
export function renderRecoveryModal() {
  return `
    <div id="recoveryModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="recoveryModalTitle" data-backdrop-close="closeRecoveryModal">
      <div class="modal-card" style="width: min(500px, 94vw); max-width: 500px">
        <div class="modal-header">
          <h3 id="recoveryModalTitle" data-i18n="modal.recovery.title">${escapeHtml(i18n.t("modal.recovery.title"))}</h3>
          <button type="button" class="tool-btn" data-action="closeRecoveryModal" style="padding: 4px 8px" data-i18n-aria-label="common.close" aria-label="${escapeHtml(i18n.t("common.close"))}">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>
        <p style="font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.45" data-i18n="recovery.subtitle">
          ${escapeHtml(i18n.t("recovery.subtitle"))}
        </p>
        <div id="recoveryList" style="display: flex; flex-direction: column; gap: 6px; max-height: 280px; overflow-y: auto"></div>
        <div class="modal-actions" style="flex-wrap: wrap">
          <button type="button" id="btnClearAllAutosaves" class="tool-btn" style="margin-right: auto; white-space: nowrap">
            <i data-lucide="trash-2" class="ui-icon-sm"></i>
            <span data-i18n="recovery.clear_all">${escapeHtml(i18n.t("recovery.clear_all"))}</span>
          </button>
          <button type="button" class="tool-btn" data-action="closeRecoveryModal" style="white-space: nowrap" data-i18n="common.close">${escapeHtml(i18n.t("common.close"))}</button>
          <button type="button" id="btnRecoverLatest" class="btn-primary" style="white-space: nowrap" data-i18n="modal.recovery.restore_last">${escapeHtml(i18n.t("modal.recovery.restore_last"))}</button>
        </div>
      </div>
    </div>
  `;
}
