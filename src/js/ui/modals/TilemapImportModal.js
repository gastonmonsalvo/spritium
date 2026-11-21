/**
 * TilemapImportModal.js: Modal para importar hojas Tileset PNG y/o mapas Tilemap JSON (Spritium / Tiled).
 */
// @ts-check

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml, renderList } from "../components/uiHtml.js";

const TILE_IMPORT_PRESETS = [8, 16, 32, 64];

/** Genera el HTML del modal de importación de Tilemap / Tileset. */
export function renderTilemapImportModal() {
  const presetBtns = renderList(
    TILE_IMPORT_PRESETS,
    (size) =>
      `<button type="button" class="tool-btn" data-tm-import-preset data-action="setTilemapImportPreset" data-action-args='[${size},${size}]' style="flex: 1; font-size: 11px">${size}×${size}</button>`,
  );

  return `
    <div id="tilemapImportModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tmImportModalTitle" data-backdrop-close="closeTilemapImportModal">
      <div class="modal-card" style="width: min(440px, 94vw); max-width: 440px">
        <div class="modal-header">
          <h3 id="tmImportModalTitle" data-i18n="modal.tm_import.title">${escapeHtml(i18n.t("modal.tm_import.title"))}</h3>
          <button type="button" class="tool-btn" data-action="closeTilemapImportModal" style="padding: 4px 8px" data-i18n-aria-label="common.close" aria-label="${escapeHtml(i18n.t("common.close"))}">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px">
          <div>
            <label for="tmImportMultiInput" class="btn-subtle-accent tm-import-pick-btn tm-import-pick-multi">
              <i data-lucide="folder-open" class="ui-icon-sm"></i>
              <span data-i18n="modal.tm_import.pick_files">${escapeHtml(i18n.t("modal.tm_import.pick_files"))}</span>
            </label>
            <input type="file" id="tmImportMultiInput" accept="image/png,image/webp,image/gif,image/bmp,.json,.tmj" multiple style="display: none" />
          </div>

          <div class="tm-import-slot">
            <div class="tm-import-file-row">
              <span class="tm-import-slot-label" data-i18n="modal.tm_import.png_label">${escapeHtml(i18n.t("modal.tm_import.png_label"))}</span>
              <div style="display: flex; gap: 4px; align-items: center">
                <label for="tmImportPngInput" class="btn-subtle-accent tm-import-pick-btn" data-i18n="modal.tm_import.pick_png">${escapeHtml(i18n.t("modal.tm_import.pick_png"))}</label>
                <button type="button" id="btnClearTmPng" class="tool-btn" data-action="clearTilemapImportSlot" data-action-arg="png" style="display: none; font-size: 10.5px; padding: 3px 6px">×</button>
              </div>
              <input type="file" id="tmImportPngInput" accept="image/png,image/webp,image/gif,image/bmp" style="display: none" />
            </div>
            <div id="tmImportPngInfo" class="tm-import-file-name" data-i18n="modal.tm_import.none">${escapeHtml(i18n.t("modal.tm_import.none"))}</div>
          </div>

          <div class="tm-import-slot">
            <div class="tm-import-file-row">
              <span class="tm-import-slot-label" data-i18n="modal.tm_import.json_label">${escapeHtml(i18n.t("modal.tm_import.json_label"))}</span>
              <div style="display: flex; gap: 4px; align-items: center">
                <label for="tmImportJsonInput" class="btn-subtle-accent tm-import-pick-btn" data-i18n="modal.tm_import.pick_json">${escapeHtml(i18n.t("modal.tm_import.pick_json"))}</label>
                <button type="button" id="btnClearTmJson" class="tool-btn" data-action="clearTilemapImportSlot" data-action-arg="json" style="display: none; font-size: 10.5px; padding: 3px 6px">×</button>
              </div>
              <input type="file" id="tmImportJsonInput" accept=".json,.tmj,application/json" style="display: none" />
            </div>
            <div id="tmImportJsonInfo" class="tm-import-file-name" data-i18n="modal.tm_import.optional">${escapeHtml(i18n.t("modal.tm_import.optional"))}</div>
          </div>

          <div>
            <label for="tmImportTargetMode" data-i18n="modal.tm_import.target_mode">${escapeHtml(i18n.t("modal.tm_import.target_mode"))}</label>
            <select id="tmImportTargetMode" style="width: 100%">
              <option value="current" data-i18n="modal.tm_import.mode_current">${escapeHtml(i18n.t("modal.tm_import.mode_current"))}</option>
              <option value="project" data-i18n="modal.tm_import.mode_project">${escapeHtml(i18n.t("modal.tm_import.mode_project"))}</option>
            </select>
          </div>

          <div>
            <label data-i18n="modal.tilemap.tile_size">${escapeHtml(i18n.t("modal.tilemap.tile_size"))}</label>
            <div style="display: flex; gap: 6px; margin-bottom: 6px">${presetBtns}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
              <div>
                <label for="tmImportWidthInput" style="font-size: 10px" data-i18n="modal.tilemap.w">${escapeHtml(i18n.t("modal.tilemap.w"))}</label>
                <input type="number" id="tmImportWidthInput" min="2" max="512" value="16" style="width: 100%" />
              </div>
              <div>
                <label for="tmImportHeightInput" style="font-size: 10px" data-i18n="modal.tilemap.h">${escapeHtml(i18n.t("modal.tilemap.h"))}</label>
                <input type="number" id="tmImportHeightInput" min="2" max="512" value="16" style="width: 100%" />
              </div>
            </div>
          </div>

          <div id="tmImportPngOnlyOpts" style="display: flex; flex-direction: column; gap: 6px">
            <label class="checkbox-label" style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; text-transform: none">
              <input type="checkbox" id="chkTmImportSkipEmpty" checked />
              <span data-i18n="modal.tm_import.skip_empty">${escapeHtml(i18n.t("modal.tm_import.skip_empty"))}</span>
            </label>
            <label class="checkbox-label" style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; text-transform: none">
              <input type="checkbox" id="chkTmImportDedupe" checked />
              <span data-i18n="modal.tm_import.dedupe">${escapeHtml(i18n.t("modal.tm_import.dedupe"))}</span>
            </label>
            <label class="checkbox-label" style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; text-transform: none">
              <input type="checkbox" id="chkTmImportCreateLayer" checked />
              <span data-i18n="modal.tm_import.create_layer">${escapeHtml(i18n.t("modal.tm_import.create_layer"))}</span>
            </label>
          </div>

          <div id="tmImportJsonOpts" style="display: none; flex-direction: column; gap: 6px">
            <label class="checkbox-label" style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; text-transform: none">
              <input type="checkbox" id="chkTmImportResizeCanvas" checked />
              <span data-i18n="modal.tm_import.resize_canvas">${escapeHtml(i18n.t("modal.tm_import.resize_canvas"))}</span>
            </label>
          </div>

          <div id="tmImportSummary" class="tm-import-summary"></div>
        </div>

        <div class="modal-actions">
          <button type="button" class="tool-btn" data-action="closeTilemapImportModal" data-i18n="opt.cancel">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="button" id="btnConfirmTilemapImport" class="btn-primary" data-action="confirmTilemapImportModal" data-i18n="modal.tm_import.submit" disabled>${escapeHtml(i18n.t("modal.tm_import.submit"))}</button>
        </div>
      </div>
    </div>
  `;
}
