// @ts-check
/**
 * NewPaletteModal.js: Modal para crear una nueva paleta personalizada.
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml } from "../components/uiHtml.js";

/** Genera el HTML del modal para crear una paleta personalizada. */
export function renderNewPaletteModal() {
  return `
    <div id="newPaletteModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="newPaletteModalTitle" data-backdrop-close="closeNewPaletteModal">
      <form class="modal-card" style="max-width: 360px" data-submit="confirmCreateNewPalette">
        <div class="modal-header">
          <h3 id="newPaletteModalTitle" data-i18n="modal.new_palette.title">${escapeHtml(i18n.t("modal.new_palette.title"))}</h3>
          <button type="button" class="tool-btn" data-action="closeNewPaletteModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>
        <div>
          <label for="newPaletteNameInput" data-i18n="modal.new_palette.name">${escapeHtml(i18n.t("modal.new_palette.name"))}</label>
          <input type="text" id="newPaletteNameInput" data-i18n-placeholder="pm.pal_placeholder" placeholder="${escapeHtml(i18n.t("pm.pal_placeholder"))}" maxlength="32" required />
        </div>
        <div>
          <label for="newPaletteModeSelect" data-i18n="modal.new_palette.content">${escapeHtml(i18n.t("modal.new_palette.content"))}</label>
          <select id="newPaletteModeSelect">
            <option value="copy" data-i18n="pm.pal_copy">${escapeHtml(i18n.t("pm.pal_copy"))}</option>
            <option value="canvas" data-i18n="pm.pal_canvas">${escapeHtml(i18n.t("pm.pal_canvas"))}</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="tool-btn" data-action="closeNewPaletteModal" data-i18n="opt.cancel">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="submit" class="btn-primary" data-i18n="modal.new_palette.create">${escapeHtml(i18n.t("modal.new_palette.create"))}</button>
        </div>
      </form>
    </div>
  `;
}
