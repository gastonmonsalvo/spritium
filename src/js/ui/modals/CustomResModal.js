// @ts-check
/**
 * CustomResModal.js: Modal de resolución personalizada (N × M px).
 */

import { MAX_GRID_DIM } from "../../core/state.js";
import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml } from "../components/uiHtml.js";

/** Genera el HTML del modal de resolución personalizada. */
export function renderCustomResModal() {
  return `
    <div id="customResModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="customResTitle" data-backdrop-close="self">
      <form class="modal-card" style="width: min(320px, 92vw)" data-submit="submitCustomResModal">
        <div class="modal-header">
          <h3 id="customResTitle" data-i18n="modal.custom_res.title">${escapeHtml(i18n.t("modal.custom_res.title"))}</h3>
          <button type="button" class="tool-btn" data-action="closeCustomResModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>
        <div class="modal-grid-2">
          <div>
            <label for="customResW" data-i18n="modal.custom_res.w">${escapeHtml(i18n.t("modal.custom_res.w"))}</label>
            <input type="number" id="customResW" min="4" max="${MAX_GRID_DIM}" value="64" required />
          </div>
          <div>
            <label for="customResH" data-i18n="modal.custom_res.h">${escapeHtml(i18n.t("modal.custom_res.h"))}</label>
            <input type="number" id="customResH" min="4" max="${MAX_GRID_DIM}" value="64" required />
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="tool-btn" data-action="closeCustomResModal" data-i18n="opt.cancel">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="submit" class="btn-primary" data-i18n="opt.apply">${escapeHtml(i18n.t("opt.apply"))}</button>
        </div>
      </form>
    </div>
  `;
}
