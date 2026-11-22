// @ts-check
/**
 * ConfirmModal.js: Diálogo de confirmación nativo de Spritium (reemplaza window.confirm).
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml } from "../components/uiHtml.js";
import { refreshIcons } from "../status.js";

/** @type {((confirmed: boolean) => void) | null} */
let pendingResolver = null;

/**
 * Muestra el modal de confirmación dentro de la UI de Spritium y devuelve una promesa booleana.
 * @param {{ title?: string, message: string, confirmText?: string, cancelText?: string }} opts
 * @returns {Promise<boolean>}
 */
export function showConfirmDialog(opts) {
  if (typeof document === "undefined") return Promise.resolve(false);
  const modal = document.getElementById("appConfirmModal");
  if (!modal) return Promise.resolve(false);

  if (pendingResolver) {
    pendingResolver(false);
    pendingResolver = null;
  }

  const titleEl = document.getElementById("appConfirmTitle");
  const msgEl = document.getElementById("appConfirmMessage");
  const okEl = document.getElementById("appConfirmOkBtn");
  const cancelEl = document.getElementById("appConfirmCancelBtn");

  if (titleEl) titleEl.textContent = opts.title || i18n.t("modal.confirm.title");
  if (msgEl) msgEl.textContent = opts.message || "";
  if (okEl) okEl.textContent = opts.confirmText || i18n.t("opt.confirm");
  if (cancelEl) cancelEl.textContent = opts.cancelText || i18n.t("opt.cancel");

  modal.classList.add("open");
  refreshIcons(modal);

  return new Promise((resolve) => {
    pendingResolver = resolve;
  });
}

/**
 * Resuelve el diálogo de confirmación activo con `true` o `false` y lo cierra.
 * @param {string|boolean} [accepted]
 */
export function resolveConfirmDialog(accepted = false) {
  const modal = document.getElementById("appConfirmModal");
  modal?.classList.remove("open");
  const isOk = accepted === true || accepted === "true";
  const resolver = pendingResolver;
  pendingResolver = null;
  if (resolver) resolver(isOk);
}

/**
 * Genera el HTML del modal de confirmación nativo (`#appConfirmModal`).
 * @returns {string}
 */
export function renderConfirmModal() {
  return `
    <div id="appConfirmModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="appConfirmTitle" data-backdrop-close="resolveConfirmDialog">
      <div class="modal-card" style="width: min(420px, 92vw)">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px">
            <i data-lucide="help-circle" class="ui-icon-sm" style="color: var(--accent-secondary)"></i>
            <h3 id="appConfirmTitle">${escapeHtml(i18n.t("modal.confirm.title"))}</h3>
          </div>
          <button type="button" class="tool-btn" data-action="resolveConfirmDialog" data-action-arg="false" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>

        <div class="modal-body">
          <p id="appConfirmMessage" style="margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--text-primary); white-space: pre-line"></p>
        </div>

        <div class="modal-actions">
          <button type="button" id="appConfirmCancelBtn" class="tool-btn" data-action="resolveConfirmDialog" data-action-arg="false">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="button" id="appConfirmOkBtn" class="btn-primary" data-action="resolveConfirmDialog" data-action-arg="true">${escapeHtml(i18n.t("opt.confirm"))}</button>
        </div>
      </div>
    </div>
  `;
}
