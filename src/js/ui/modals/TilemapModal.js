// @ts-check
/**
 * TilemapModal.js: Modal para crear o convertir una capa a Tilemap.
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml, renderList } from "../components/uiHtml.js";

const TILE_PRESET_SIZES = [8, 16, 32, 64];

/** Genera el HTML del modal de creación/conversión de capas Tilemap. */
export function renderTilemapModal() {
  const presetBtns = renderList(
    TILE_PRESET_SIZES,
    (size) =>
      `<button type="button" class="tool-btn" data-action="setTilemapModalPreset" data-action-args='[${size},${size}]' style="flex: 1; font-size: 11px">${size}×${size}</button>`,
  );

  return `
    <div id="tilemapModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tilemapModalTitle" data-backdrop-close="closeTilemapModal">
      <div class="modal-card" style="width: min(400px, 94vw); max-width: 400px">
        <div class="modal-header">
          <h3 id="tilemapModalTitle" data-i18n="modal.tilemap.title">${escapeHtml(i18n.t("modal.tilemap.title"))}</h3>
          <button type="button" class="tool-btn" data-action="closeTilemapModal" style="padding: 4px 8px" data-i18n-aria-label="common.close" aria-label="${escapeHtml(i18n.t("common.close"))}">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px">
          <div>
            <label for="tilemapNameInput" data-i18n="modal.tilemap.layer_name">${escapeHtml(i18n.t("modal.tilemap.layer_name"))}</label>
            <input type="text" id="tilemapNameInput" value="Tilemap" style="width: 100%" />
          </div>
          <div>
            <label data-i18n="modal.tilemap.tile_size">${escapeHtml(i18n.t("modal.tilemap.tile_size"))}</label>
            <div style="display: flex; gap: 6px; margin-bottom: 6px">
              ${presetBtns}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
              <div>
                <label for="tilemapWidthInput" style="font-size: 10px" data-i18n="modal.tilemap.w">${escapeHtml(i18n.t("modal.tilemap.w"))}</label>
                <input type="number" id="tilemapWidthInput" min="2" max="512" value="16" style="width: 100%" />
              </div>
              <div>
                <label for="tilemapHeightInput" style="font-size: 10px" data-i18n="modal.tilemap.h">${escapeHtml(i18n.t("modal.tilemap.h"))}</label>
                <input type="number" id="tilemapHeightInput" min="2" max="512" value="16" style="width: 100%" />
              </div>
            </div>
          </div>
          <div>
            <label for="tilemapModalTilesetSelect" data-i18n="modal.tilemap.target_tileset">${escapeHtml(i18n.t("modal.tilemap.target_tileset"))}</label>
            <select id="tilemapModalTilesetSelect" style="width: 100%"></select>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="tool-btn" data-action="closeTilemapModal" data-i18n="opt.cancel">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="button" id="btnConfirmTilemapModal" class="btn-primary" data-action="confirmTilemapModal" data-i18n="modal.tilemap.create">${escapeHtml(i18n.t("modal.tilemap.create"))}</button>
        </div>
      </div>
    </div>
  `;
}
