// @ts-check
/**
 * ExportModal.js: Modal de exportación configurable (PNG / GIF / Tira / Atlas).
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml, renderList } from "../components/uiHtml.js";

const EXPORT_SCALES = [2, 4, 8, 16];

/** Genera el HTML del modal de exportación configurable. */
export function renderExportModal() {
  const scaleOptions = renderList(
    EXPORT_SCALES,
    (scale) => `<option value="${scale}"${scale === 4 ? " selected" : ""}>${scale}×</option>`,
  );

  return `
    <div id="exportModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="exportModalTitle" data-backdrop-close="closeExportModal">
      <form class="modal-card export-modal-card" data-submit="executeConfiguredExport">
        <div class="modal-header">
          <h3 id="exportModalTitle" data-i18n="modal.export.title">${escapeHtml(i18n.t("modal.export.title"))}</h3>
          <button type="button" class="tool-btn" data-action="closeExportModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>

        <div class="export-modal-layout">
          <div class="export-controls-col">
            <div>
              <label for="exportFormatSelect" data-i18n="modal.export.format">${escapeHtml(i18n.t("modal.export.format"))}</label>
              <select id="exportFormatSelect" data-change="updateExportModalPreview">
                <option value="png" data-i18n="export.fmt_png">${escapeHtml(i18n.t("export.fmt_png"))}</option>
                <option value="gif" data-i18n="export.fmt_gif">${escapeHtml(i18n.t("export.fmt_gif"))}</option>
                <option value="strip" data-i18n="export.fmt_strip">${escapeHtml(i18n.t("export.fmt_strip"))}</option>
                <option value="atlas" data-i18n="export.fmt_atlas">${escapeHtml(i18n.t("export.fmt_atlas"))}</option>
              </select>
            </div>

            <div class="modal-row-2">
              <div>
                <label for="exportScaleSelect" data-i18n="modal.export.scale">${escapeHtml(i18n.t("modal.export.scale"))}</label>
                <select id="exportScaleSelect" data-change="updateExportModalPreview">
                  <option value="1" data-i18n="export.scale_1x">${escapeHtml(i18n.t("export.scale_1x"))}</option>
                  ${scaleOptions}
                </select>
              </div>
              <div>
                <label for="exportBgSelect" data-i18n="modal.new_doc.bg">${escapeHtml(i18n.t("modal.new_doc.bg"))}</label>
                <div style="display: flex; align-items: center; gap: 6px">
                  <select id="exportBgSelect" data-change="updateExportModalPreview" style="flex: 1; min-width: 0">
                    <option value="transparent" selected data-i18n="export.bg_transparent">${escapeHtml(i18n.t("export.bg_transparent"))}</option>
                    <option value="solid" data-i18n="export.bg_solid">${escapeHtml(i18n.t("export.bg_solid"))}</option>
                  </select>
                  <input type="color" id="exportBgColor" value="#141417" data-input="updateExportModalPreview" style="display: none; width: 34px; height: 30px; padding: 0; border: none; background: transparent; cursor: pointer; flex-shrink: 0" data-i18n-title="pm.export_bg_title" title="${escapeHtml(i18n.t("pm.export_bg_title"))}" />
                </div>
              </div>
            </div>

            <div id="exportGifOptions" class="panel-section-card" style="display: none; gap: 10px; padding: 12px">
              <div class="modal-row-2">
                <div>
                  <label for="exportGifFps" data-i18n="modal.export.fps">${escapeHtml(i18n.t("modal.export.fps"))}</label>
                  <input type="number" id="exportGifFps" min="1" max="60" value="8" data-input="updateExportModalPreview" />
                </div>
                <div>
                  <label for="exportGifLoop" data-i18n="modal.export.loop">${escapeHtml(i18n.t("modal.export.loop"))}</label>
                  <select id="exportGifLoop">
                    <option value="0" selected data-i18n="export.loop_inf">${escapeHtml(i18n.t("export.loop_inf"))}</option>
                    <option value="-1" data-i18n="export.loop_once">${escapeHtml(i18n.t("export.loop_once"))}</option>
                    <option value="3" data-i18n="export.loop_3x">${escapeHtml(i18n.t("export.loop_3x"))}</option>
                  </select>
                </div>
              </div>
            </div>

            <div id="exportStripOptions" class="panel-section-card" style="display: none; gap: 10px; padding: 12px">
              <div class="modal-row-2">
                <div>
                  <label for="exportStripLayout" data-i18n="modal.export.layout">${escapeHtml(i18n.t("modal.export.layout"))}</label>
                  <select id="exportStripLayout" data-change="updateExportModalPreview">
                    <option value="horizontal" selected data-i18n="export.layout_row">${escapeHtml(i18n.t("export.layout_row"))}</option>
                    <option value="vertical" data-i18n="export.layout_col">${escapeHtml(i18n.t("export.layout_col"))}</option>
                    <option value="grid" data-i18n="export.layout_grid">${escapeHtml(i18n.t("export.layout_grid"))}</option>
                  </select>
                </div>
                <div>
                  <label for="exportStripPadding" data-i18n="modal.export.padding">${escapeHtml(i18n.t("modal.export.padding"))}</label>
                  <input type="number" id="exportStripPadding" min="0" max="32" value="0" data-input="updateExportModalPreview" />
                </div>
              </div>
              <div id="exportStripColsRow" style="display: none; align-items: center; justify-content: space-between; gap: 8px">
                <label for="exportStripCols" style="margin: 0" data-i18n="modal.export.cols">${escapeHtml(i18n.t("modal.export.cols"))}</label>
                <input type="number" id="exportStripCols" min="1" max="64" value="4" style="width: 72px" data-input="updateExportModalPreview" />
              </div>
            </div>
          </div>

          <div class="export-preview-col">
            <span class="export-preview-label" data-i18n="export.preview_label">${escapeHtml(i18n.t("export.preview_label"))}</span>
            <div class="export-preview-box">
              <canvas id="exportPreviewCanvas" class="export-preview-canvas" width="184" height="184"></canvas>
            </div>
            <span id="exportResolutionPreview" class="export-preview-meta" data-i18n="export.out_default">${escapeHtml(i18n.t("export.out_default"))}</span>
          </div>
        </div>

        <div class="modal-actions" style="margin-top: 4px">
          <button type="button" class="tool-btn" data-action="closeExportModal" data-i18n="opt.cancel">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="submit" class="btn-primary" data-i18n="modal.export.submit">${escapeHtml(i18n.t("modal.export.submit"))}</button>
        </div>
      </form>
    </div>
  `;
}
