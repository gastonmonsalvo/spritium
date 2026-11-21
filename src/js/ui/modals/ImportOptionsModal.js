// @ts-check
/**
 * ImportOptionsModal.js: Modal de opciones para importar imágenes externas.
 */

import { i18n } from "../../i18n/I18nService.js";
import { RESOLUTION_PRESETS } from "../components/TopMenuConfig.js";
import { escapeHtml, renderList } from "../components/uiHtml.js";

const IMPORT_CHECK_LABEL_STYLE =
  "display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-primary); cursor: pointer; text-transform: none;";

/** Genera el HTML del modal de importación de imágenes. */
export function renderImportOptionsModal() {
  const resOptions = renderList(
    RESOLUTION_PRESETS,
    (s) => `<option value="${s}">${s}×${s}</option>`,
  );

  return `
    <div id="importOptionsModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="importModalTitle">
      <form id="importOptionsForm" class="modal-card import-modal-card">
        <div class="modal-header">
          <h3 id="importModalTitle" data-i18n="modal.import.title">${escapeHtml(i18n.t("modal.import.title"))}</h3>
          <button type="button" class="tool-btn" data-action="closeImportModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>

        <div class="import-modal-body">
          <div class="import-modal-controls">
            <div>
              <label for="importAssetName" data-i18n="modal.import.name">${escapeHtml(i18n.t("modal.import.name"))}</label>
              <input type="text" id="importAssetName" value="imported_asset" required />
            </div>

            <div>
              <label for="importModeSelect" data-i18n="modal.import.mode">${escapeHtml(i18n.t("modal.import.mode"))}</label>
              <select id="importModeSelect">
                <option value="layer" data-i18n="pm.import_layer">${escapeHtml(i18n.t("pm.import_layer"))}</option>
                <option value="project" data-i18n="pm.import_project">${escapeHtml(i18n.t("pm.import_project"))}</option>
              </select>
            </div>

            <div class="modal-grid-2">
              <div>
                <label for="importResSelect" data-i18n="modal.import.res">${escapeHtml(i18n.t("modal.import.res"))}</label>
                <select id="importResSelect">
                  <option value="native" selected data-i18n="pm.import_native">${escapeHtml(i18n.t("pm.import_native"))}</option>
                  ${resOptions}
                </select>
              </div>
              <div>
                <label for="importThemeSelect" data-i18n="modal.import.palette">${escapeHtml(i18n.t("modal.import.palette"))}</label>
                <select id="importThemeSelect"></select>
              </div>
            </div>

            <label style="${IMPORT_CHECK_LABEL_STYLE}" data-i18n-title="pm.import_pa_title" title="${escapeHtml(i18n.t("pm.import_pa_title"))}">
              <input type="checkbox" id="importConvertPixelArtChk" />
              <span data-i18n="pm.import_pa_label">${escapeHtml(i18n.t("pm.import_pa_label"))}</span>
            </label>

            <label style="${IMPORT_CHECK_LABEL_STYLE}" data-i18n-title="pm.import_rmbg_title" title="${escapeHtml(i18n.t("pm.import_rmbg_title"))}">
              <input type="checkbox" id="importRemoveBgChk" />
              <span data-i18n="pm.import_rmbg_label">${escapeHtml(i18n.t("pm.import_rmbg_label"))}</span>
            </label>

            <label style="${IMPORT_CHECK_LABEL_STYLE}">
              <input type="checkbox" id="importDitherChk" />
              <span data-i18n="pm.import_dither_label">${escapeHtml(i18n.t("pm.import_dither_label"))}</span>
            </label>
          </div>

          <div class="import-preview-panel">
            <div class="import-preview-header">
              <span data-i18n="modal.import.preview">${escapeHtml(i18n.t("modal.import.preview"))}</span>
              <span id="importPreviewMeta">...</span>
            </div>
            <div class="import-preview-stage">
              <canvas id="importPreviewCanvas" width="64" height="64"></canvas>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="tool-btn" data-action="closeImportModal" data-i18n="opt.cancel">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="submit" class="btn-primary" data-i18n="modal.import.submit">${escapeHtml(i18n.t("modal.import.submit"))}</button>
        </div>
      </form>
    </div>
  `;
}
