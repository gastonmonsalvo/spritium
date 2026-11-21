// @ts-check
/**
 * NewDocModal.js: Modal de creación de documento nuevo.
 */

import { i18n } from "../../i18n/I18nService.js";
import { RESOLUTION_PRESETS } from "../components/TopMenuConfig.js";
import { escapeHtml, renderList } from "../components/uiHtml.js";

/** Genera el HTML del modal de documento nuevo. */
export function renderNewDocModal() {
  const sizeOptions = renderList(
    RESOLUTION_PRESETS,
    (s) => `<option value="${s}"${s === 64 ? " selected" : ""}>${s}×${s} px</option>`,
  );

  return `
    <div id="newDocModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="newDocTitle">
      <form id="newDocForm" class="modal-card">
        <div class="modal-header">
          <h3 id="newDocTitle" data-i18n="modal.new_doc.title">${escapeHtml(i18n.t("modal.new_doc.title"))}</h3>
          <button type="button" class="tool-btn" data-action="closeNewDocModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>

        <div>
          <label for="newDocName" data-i18n="modal.new_doc.name">${escapeHtml(i18n.t("modal.new_doc.name"))}</label>
          <input type="text" id="newDocName" value="sprite_01" required />
        </div>

        <div>
          <label for="newDocSize" data-i18n="modal.new_doc.size">${escapeHtml(i18n.t("modal.new_doc.size"))}</label>
          <select id="newDocSize">
            ${sizeOptions}
            <option value="custom" data-i18n="pm.custom_size">${escapeHtml(i18n.t("pm.custom_size"))}</option>
          </select>
        </div>
        <div id="newDocCustomRow" class="modal-grid-2" style="display: none">
          <div>
            <label for="newDocCustomW" data-i18n="modal.new_doc.w">${escapeHtml(i18n.t("modal.new_doc.w"))}</label>
            <input type="number" id="newDocCustomW" min="4" max="512" value="64" />
          </div>
          <div>
            <label for="newDocCustomH" data-i18n="modal.new_doc.h">${escapeHtml(i18n.t("modal.new_doc.h"))}</label>
            <input type="number" id="newDocCustomH" min="4" max="512" value="32" />
          </div>
        </div>

        <div class="modal-grid-2">
          <div>
            <label for="newDocBg" data-i18n="modal.new_doc.bg">${escapeHtml(i18n.t("modal.new_doc.bg"))}</label>
            <select id="newDocBg">
              <option value="transparent" selected data-i18n="export.bg_transparent">${escapeHtml(i18n.t("export.bg_transparent"))}</option>
              <option value="white" data-i18n="pm.bg_white">${escapeHtml(i18n.t("pm.bg_white"))}</option>
              <option value="black" data-i18n="pm.bg_black">${escapeHtml(i18n.t("pm.bg_black"))}</option>
            </select>
          </div>
          <div>
            <label for="newDocTheme" data-i18n="modal.new_doc.palette">${escapeHtml(i18n.t("modal.new_doc.palette"))}</label>
            <select id="newDocTheme"></select>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="tool-btn" data-action="closeNewDocModal" data-i18n="opt.cancel">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="submit" class="btn-primary" data-i18n="modal.new_doc.create">${escapeHtml(i18n.t("modal.new_doc.create"))}</button>
        </div>
      </form>
    </div>
  `;
}
