// @ts-check
/**
 * ConfirmModal.js: Diálogo de confirmación nativo de Spritium (reemplaza window.confirm).
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml } from "../components/uiHtml.js";
import { refreshIcons } from "../status.js";

/** @type {((confirmed: boolean) => void) | null} */
let pendingResolver = null;
let isPromptMode = false;

function openModalInternal(opts, promptOpts = null) {
  if (typeof document === "undefined") return Promise.resolve(promptOpts ? null : false);
  const modal = document.getElementById("appConfirmModal");
  if (!modal) return Promise.resolve(promptOpts ? null : false);

  if (pendingResolver) {
    pendingResolver(false);
    pendingResolver = null;
  }

  isPromptMode = Boolean(promptOpts);
  const titleEl = document.getElementById("appConfirmTitle");
  const msgEl = document.getElementById("appConfirmMessage");
  const inputEl = /** @type {HTMLInputElement|null} */ (document.getElementById("appConfirmInput"));
  const okEl = document.getElementById("appConfirmOkBtn");
  const cancelEl = document.getElementById("appConfirmCancelBtn");

  if (titleEl) titleEl.textContent = opts.title || i18n.t("modal.confirm.title");
  if (msgEl) {
    msgEl.textContent = opts.message || "";
    msgEl.style.display = opts.message ? "" : "none";
  }
  if (inputEl) {
    if (promptOpts) {
      inputEl.style.display = "block";
      inputEl.value = promptOpts.defaultValue ?? "";
      inputEl.placeholder = promptOpts.placeholder ?? "";
      if (!inputEl.dataset.boundKeys) {
        inputEl.dataset.boundKeys = "1";
        inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            resolveConfirmDialog(true);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            resolveConfirmDialog(false);
          }
        });
      }
    } else {
      inputEl.style.display = "none";
      inputEl.value = "";
    }
  }
  if (okEl) okEl.textContent = opts.confirmText || i18n.t("opt.confirm");
  if (cancelEl) cancelEl.textContent = opts.cancelText || i18n.t("opt.cancel");

  modal.classList.add("open");
  refreshIcons(modal);

  if (promptOpts && inputEl) {
    setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 10);
  }

  return new Promise((resolve) => {
    pendingResolver = (accepted) => {
      if (!promptOpts) {
        resolve(Boolean(accepted));
        return;
      }
      resolve(accepted ? (inputEl?.value ?? "") : null);
    };
  });
}

/**
 * Muestra el modal de confirmación dentro de la UI de Spritium y devuelve una promesa booleana.
 * @param {{ title?: string, message: string, confirmText?: string, cancelText?: string }} opts
 * @returns {Promise<boolean>}
 */
export function showConfirmDialog(opts) {
  return /** @type {Promise<boolean>} */ (openModalInternal(opts, null));
}

/**
 * Muestra un diálogo modal con campo de texto (`input`) dentro de la UI de Spritium.
 * @param {{ title?: string, message?: string, defaultValue?: string, placeholder?: string, confirmText?: string, cancelText?: string }} opts
 * @returns {Promise<string|null>}
 */
export function showPromptDialog(opts) {
  return /** @type {Promise<string|null>} */ (
    openModalInternal(opts, {
      defaultValue: opts.defaultValue || "",
      placeholder: opts.placeholder || "",
    })
  );
}

/**
 * Resuelve el diálogo de confirmación/prompt activo y lo cierra.
 * @param {string|boolean} [accepted]
 */
export function resolveConfirmDialog(accepted = false) {
  const modal = document.getElementById("appConfirmModal");
  modal?.classList.remove("open");
  const isOk = accepted === true || accepted === "true";
  const resolver = pendingResolver;
  pendingResolver = null;
  isPromptMode = false;
  if (resolver) resolver(isOk);
}

/**
 * Genera el HTML del modal de confirmación/prompt nativo (`#appConfirmModal`).
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

        <div class="modal-body" style="display: flex; flex-direction: column; gap: 10px">
          <p id="appConfirmMessage" style="margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--text-primary); white-space: pre-line"></p>
          <input type="text" id="appConfirmInput" style="display: none; width: 100%; padding: 7px 10px; font-size: 12.5px; border-radius: 5px; border: 1px solid var(--border-subtle); background: var(--bg-input); color: var(--text-primary)" />
        </div>

        <div class="modal-actions">
          <button type="button" id="appConfirmCancelBtn" class="tool-btn" data-action="resolveConfirmDialog" data-action-arg="false">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="button" id="appConfirmOkBtn" class="btn-primary" data-action="resolveConfirmDialog" data-action-arg="true">${escapeHtml(i18n.t("opt.confirm"))}</button>
        </div>
      </div>
    </div>
  `;
}
