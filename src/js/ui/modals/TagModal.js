// @ts-check
/**
 * TagModal.js: Modal para crear etiquetas de frames en el Timeline.
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml } from "../components/uiHtml.js";

/** Genera el HTML del modal para crear Frame Tags. */
export function renderTagModal() {
  return `
    <div id="tagModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tagModalTitle" data-backdrop-close="closeTagModal">
      <form class="modal-card" style="max-width: 360px" data-submit="confirmCreateFrameTag">
        <div class="modal-header">
          <h3 id="tagModalTitle" data-i18n="modal.tag.title">${escapeHtml(i18n.t("modal.tag.title"))}</h3>
          <button type="button" class="tool-btn" data-action="closeTagModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>
        <div>
          <label for="tagNameInput" data-i18n="modal.tag.name">${escapeHtml(i18n.t("modal.tag.name"))}</label>
          <input type="text" id="tagNameInput" data-i18n-placeholder="pm.tag_placeholder" placeholder="${escapeHtml(i18n.t("pm.tag_placeholder"))}" maxlength="20" required />
        </div>
        <div class="modal-row-2">
          <div>
            <label for="tagFromInput" data-i18n="modal.tag.from">${escapeHtml(i18n.t("modal.tag.from"))}</label>
            <input type="number" id="tagFromInput" min="1" value="1" required />
          </div>
          <div>
            <label for="tagToInput" data-i18n="modal.tag.to">${escapeHtml(i18n.t("modal.tag.to"))}</label>
            <input type="number" id="tagToInput" min="1" value="1" required />
          </div>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px">
          <label for="tagColorInput" style="margin: 0" data-i18n="modal.tag.color">${escapeHtml(i18n.t("modal.tag.color"))}</label>
          <input type="color" id="tagColorInput" value="#2563eb" style="width: 44px; height: 28px; padding: 0; border: none; background: transparent; cursor: pointer" />
        </div>
        <div class="modal-actions">
          <button type="button" class="tool-btn" data-action="closeTagModal" data-i18n="opt.cancel">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="submit" class="btn-primary" data-i18n="modal.tag.create">${escapeHtml(i18n.t("modal.tag.create"))}</button>
        </div>
      </form>
    </div>
  `;
}
