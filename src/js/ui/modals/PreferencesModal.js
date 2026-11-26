// @ts-check
/**
 * PreferencesModal.js: Modal de preferencias de usuario (idioma, retícula, vista previa de píxel y guías).
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml, renderList } from "../components/uiHtml.js";

const PREF_CURSOR_COLORS = [
  { labelKey: "pref.color_paint", btnId: "prefCursorColorBtn" },
  { labelKey: "pref.color_erase", btnId: "prefEraserColorBtn" },
  { labelKey: "pref.color_bucket", btnId: "prefFillColorBtn" },
  { labelKey: "pref.color_magic", btnId: "prefMagicColorBtn" },
  { labelKey: "pref.color_bgeraser", btnId: "prefBgEraserColorBtn" },
];

const RETICLE_SHAPES = [
  ["crosshair", "pref.reticle_shape_crosshair"],
  ["circle", "pref.reticle_shape_circle"],
  ["square", "pref.reticle_shape_square"],
  ["dot", "pref.reticle_shape_dot"],
];

function renderRangeRow({ id, valId, labelKey, min, max, step, value, valText, valWidth = "34px", rangeWidth = "126px" }) {
  return `
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
      <label for="${id}" data-i18n="${labelKey}">${escapeHtml(i18n.t(labelKey))}</label>
      <div style="display: flex; align-items: center; gap: 8px;">
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" style="width: ${rangeWidth};" />
        <span id="${valId}" style="min-width: ${valWidth}; text-align: right; color: var(--text-secondary);">${escapeHtml(valText ?? value)}</span>
      </div>
    </div>`;
}

/** Genera el HTML del modal de Preferencias de usuario. */
export function renderPreferencesModal() {
  const shapeOptions = renderList(
    RETICLE_SHAPES,
    ([val, key]) => `<option value="${val}" data-i18n="${key}">${escapeHtml(i18n.t(key))}</option>`,
  );

  const colorPickers = renderList(
    PREF_CURSOR_COLORS,
    ({ labelKey, btnId }) => `
      <div style="display: inline-flex; align-items: center; gap: 6px;">
        <span data-i18n="${labelKey}">${escapeHtml(i18n.t(labelKey))}</span>
        <button type="button" id="${btnId}" class="rgba-picker-btn" style="width: 26px; height: 20px;"></button>
      </div>`,
  );

  const navTabs = [
    { id: "general", icon: "globe", key: "pref.tab_general", active: true },
    { id: "reticle", icon: "crosshair", key: "pref.tab_reticle" },
    { id: "pixel", icon: "mouse-pointer", key: "pref.tab_pixel" },
    { id: "canvas", icon: "grid-3x3", key: "pref.tab_canvas" },
  ];
  const navHtml = renderList(
    navTabs,
    (t) => `
      <button type="button" class="pref-nav-btn${t.active ? " active" : ""}" data-pref-tab="${t.id}" role="tab" aria-selected="${t.active ? "true" : "false"}">
        <i data-lucide="${t.icon}" class="ui-icon-sm"></i>
        <span data-i18n="${t.key}">${escapeHtml(i18n.t(t.key))}</span>
      </button>`,
  );

  return `
    <div id="preferencesModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="preferencesModalTitle" data-backdrop-close="closePreferencesModal">
      <div class="modal-card pref-modal-card">
        <div class="modal-header">
          <h3 id="preferencesModalTitle" data-i18n="pref.title">${escapeHtml(i18n.t("pref.title"))}</h3>
          <button type="button" class="tool-btn" data-action="closePreferencesModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>

        <div class="modal-body pref-layout">
          <nav class="pref-sidebar" role="tablist" aria-orientation="vertical">
            ${navHtml}
          </nav>

          <div class="pref-content">
            <section class="pref-panel active" data-pref-panel="general">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border-subtle);">
                <span style="font-weight: 600; color: var(--text-primary); display: inline-flex; align-items: center; gap: 6px;">
                  <i data-lucide="globe" class="ui-icon-sm"></i>
                  <span data-i18n="lang.section_title">${escapeHtml(i18n.t("lang.section_title"))}</span>
                </span>
                <div class="lang-switch-panel" role="group" data-i18n-aria-label="lang.panel_aria" aria-label="${escapeHtml(i18n.t("lang.panel_aria"))}">
                  <button type="button" class="tool-btn lang-btn" data-lang="es" data-i18n="lang.es_label">${escapeHtml(i18n.t("lang.es_label"))}</button>
                  <button type="button" class="tool-btn lang-btn" data-lang="en" data-i18n="lang.en_label">${escapeHtml(i18n.t("lang.en_label"))}</button>
                </div>
              </div>
            </section>

            <section class="pref-panel" data-pref-panel="reticle">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-weight: 600; color: var(--text-primary);" data-i18n="pref.reticle_title">${escapeHtml(i18n.t("pref.reticle_title"))}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div id="prefReticlePreview" data-i18n-title="pref.reticle_preview_title" title="${escapeHtml(i18n.t("pref.reticle_preview_title"))}" style="width: 44px; height: 44px; border-radius: 6px; border: 1px solid var(--border-subtle); background: repeating-conic-gradient(#27272a 0% 25%, #18181b 0% 50%) 50% / 10px 10px; display: flex; align-items: center; justify-content: center;"></div>
                </div>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <label for="prefReticleShape" data-i18n="pref.reticle_shape_color">${escapeHtml(i18n.t("pref.reticle_shape_color"))}</label>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <select id="prefReticleShape" style="width: 122px; padding: 4px 6px;">
                    ${shapeOptions}
                  </select>
                  <button type="button" id="prefReticleColorBtn" class="rgba-picker-btn" style="width: 28px; height: 22px;"></button>
                </div>
              </div>
              ${renderRangeRow({ id: "prefReticleSize", valId: "prefReticleSizeVal", labelKey: "pref.reticle_size", min: 3, max: 10, step: 0.5, value: 6 })}
              ${renderRangeRow({ id: "prefReticleThickness", valId: "prefReticleThicknessVal", labelKey: "pref.reticle_thickness", min: 1, max: 3, step: 0.25, value: 1.5 })}
              ${renderRangeRow({ id: "prefReticleGap", valId: "prefReticleGapVal", labelKey: "pref.reticle_gap", min: 0, max: 5, step: 0.5, value: 2 })}
              <div style="display: flex; align-items: center; gap: 16px;">
                <label class="checkbox-label" style="display: flex; align-items: center; gap: 6px;">
                  <input type="checkbox" id="chkPrefReticleDot" />
                  <span data-i18n="pref.reticle_dot">${escapeHtml(i18n.t("pref.reticle_dot"))}</span>
                </label>
                <label class="checkbox-label" style="display: flex; align-items: center; gap: 6px;">
                  <input type="checkbox" id="chkPrefReticleOutline" />
                  <span data-i18n="pref.reticle_outline">${escapeHtml(i18n.t("pref.reticle_outline"))}</span>
                </label>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; padding-top: 2px;">
                <label for="prefReticleCodeInput" style="font-size: 11px; color: var(--text-secondary); white-space: nowrap;" data-i18n="pref.reticle_code">${escapeHtml(i18n.t("pref.reticle_code"))}</label>
                <input type="text" id="prefReticleCodeInput" spellcheck="false" autocomplete="off" style="flex: 1; min-width: 0; padding: 4px 7px; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.4px;" placeholder="SPR-XXXX-XXXX-XXXX" />
                <button type="button" id="btnCopyReticleCode" class="tool-btn" style="padding: 4px 7px;" data-i18n-title="title.reticle_copy_code" title="${escapeHtml(i18n.t("title.reticle_copy_code"))}">
                  <i data-lucide="copy" class="ui-icon-sm"></i>
                </button>
                <button type="button" id="btnApplyReticleCode" class="btn-primary" style="padding: 4px 9px; font-size: 11px;" data-i18n="opt.apply" data-i18n-title="title.reticle_apply_code" title="${escapeHtml(i18n.t("title.reticle_apply_code"))}">${escapeHtml(i18n.t("opt.apply"))}</button>
              </div>
              <div style="text-align: right; font-size: 10.5px; font-style: italic; color: var(--text-dim); opacity: 0.72; letter-spacing: 0.3px; user-select: none;">Easy Peasy Lemon Squeezy</div>
            </section>

            <section class="pref-panel" data-pref-panel="pixel">
              <div style="font-weight: 600; color: var(--text-primary);" data-i18n="pref.pixel_section_title">${escapeHtml(i18n.t("pref.pixel_section_title"))}</div>
              <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chkPrefPixelCursor" />
                <span data-i18n="pref.pixel_enable_html">${escapeHtml(i18n.t("pref.pixel_enable_html"))}</span>
              </label>
              <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chkPrefCursorUseActiveColor" />
                <span data-i18n="pref.cursor_use_active_color">${escapeHtml(i18n.t("pref.cursor_use_active_color"))}</span>
              </label>
              <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chkPrefFillUseActiveColor" />
                <span data-i18n="pref.fill_use_active_color">${escapeHtml(i18n.t("pref.fill_use_active_color"))}</span>
              </label>
              ${renderRangeRow({ id: "prefCursorActiveAlpha", valId: "prefCursorActiveAlphaVal", labelKey: "pref.cursor_active_alpha", min: 10, max: 100, step: 5, value: 75, valText: "75%", valWidth: "46px", rangeWidth: "120px" })}
              <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chkPrefFillPreview" />
                <span data-i18n="pref.fill_preview">${escapeHtml(i18n.t("pref.fill_preview"))}</span>
              </label>
              <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chkPrefCenterDot" />
                <span data-i18n="pref.center_dot">${escapeHtml(i18n.t("pref.center_dot"))}</span>
              </label>
              ${renderRangeRow({ id: "prefCursorLineWidth", valId: "prefCursorLineWidthVal", labelKey: "pref.line_width", min: 0.75, max: 2.5, step: 0.25, value: 1, valText: "1 px", valWidth: "46px", rangeWidth: "120px" })}
              ${renderRangeRow({ id: "prefCursorOpacity", valId: "prefCursorOpacityVal", labelKey: "pref.opacity", min: 20, max: 100, step: 5, value: 75, valText: "75%", valWidth: "46px", rangeWidth: "120px" })}
              <div style="display: flex; flex-direction: column; gap: 8px; padding-top: 4px;">
                <span style="color: var(--text-secondary);" data-i18n="pref.colors_label">${escapeHtml(i18n.t("pref.colors_label"))}</span>
                <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 14px;">
                  ${colorPickers}
                </div>
              </div>
            </section>

            <section class="pref-panel" data-pref-panel="canvas">
              <div style="font-weight: 600; color: var(--text-primary);" data-i18n="pref.canvas_title">${escapeHtml(i18n.t("pref.canvas_title"))}</div>
              <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chkPrefShowGrid" />
                <span data-i18n="pref.show_grid_html">${escapeHtml(i18n.t("pref.show_grid_html"))}</span>
              </label>
              <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chkPrefShowCenterGuides" />
                <span data-i18n="pref.show_center_guides">${escapeHtml(i18n.t("pref.show_center_guides"))}</span>
              </label>
              <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chkPrefShowCenterRulerMarks" />
                <span data-i18n="pref.show_center_ruler_marks">${escapeHtml(i18n.t("pref.show_center_ruler_marks"))}</span>
              </label>
              <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chkPrefShowRulers" />
                <span data-i18n="pref.show_rulers">${escapeHtml(i18n.t("pref.show_rulers"))}</span>
              </label>
              <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chkPrefShowGridCoords" />
                <span data-i18n="pref.show_grid_coords">${escapeHtml(i18n.t("pref.show_grid_coords"))}</span>
              </label>
              <div style="display: flex; flex-direction: column; gap: 6px; padding-left: 22px;">
                <div style="display: flex; align-items: center; gap: 16px;">
                  <label class="checkbox-label" style="display: flex; align-items: center; gap: 6px;">
                    <input type="checkbox" id="chkPrefGridCoordsGuides" />
                    <span data-i18n="pref.grid_coords_guides">${escapeHtml(i18n.t("pref.grid_coords_guides"))}</span>
                  </label>
                  <label class="checkbox-label" style="display: flex; align-items: center; gap: 6px;">
                    <input type="checkbox" id="chkPrefGridCoordsBadge" />
                    <span data-i18n="pref.grid_coords_badge">${escapeHtml(i18n.t("pref.grid_coords_badge"))}</span>
                  </label>
                </div>
                ${renderRangeRow({ id: "prefGridCoordsOpacity", valId: "prefGridCoordsOpacityVal", labelKey: "pref.opacity", min: 5, max: 60, step: 5, value: 14, valText: "14%", valWidth: "46px", rangeWidth: "120px" })}
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                  <span data-i18n="pref.grid_coords_color">${escapeHtml(i18n.t("pref.grid_coords_color"))}</span>
                  <button type="button" id="prefGridCoordsColorBtn" class="rgba-picker-btn" style="width: 28px; height: 22px;"></button>
                </div>
              </div>

              <div style="border-top: 1px solid var(--border-subtle); padding-top: 10px; margin-top: 4px; display: flex; flex-direction: column; gap: 7px;">
                <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--text-primary);">
                  <input type="checkbox" id="chkPrefCustomGrid" />
                  <span data-i18n="pref.custom_grid_enable">${escapeHtml(i18n.t("pref.custom_grid_enable"))}</span>
                </label>
                <div style="display: flex; align-items: center; gap: 8px; padding-left: 22px; flex-wrap: wrap;">
                  <label for="prefCustomGridW" style="color: var(--text-secondary);" data-i18n="pref.custom_grid_size">${escapeHtml(i18n.t("pref.custom_grid_size"))}</label>
                  <input type="number" id="prefCustomGridW" min="2" max="256" value="16" style="width: 58px; padding: 3px 6px;" />
                  <span>×</span>
                  <input type="number" id="prefCustomGridH" min="2" max="256" value="16" style="width: 58px; padding: 3px 6px;" />
                  <div style="display: flex; gap: 4px;">
                    <button type="button" class="tool-btn pref-cg-preset" data-cg-size="8" style="padding: 2px 6px; font-size: 10.5px;">8</button>
                    <button type="button" class="tool-btn pref-cg-preset" data-cg-size="16" style="padding: 2px 6px; font-size: 10.5px;">16</button>
                    <button type="button" class="tool-btn pref-cg-preset" data-cg-size="32" style="padding: 2px 6px; font-size: 10.5px;">32</button>
                    <button type="button" class="tool-btn pref-cg-preset" data-cg-size="64" style="padding: 2px 6px; font-size: 10.5px;">64</button>
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px; padding-left: 22px;">
                  <label class="checkbox-label" style="display: flex; align-items: center; gap: 6px;">
                    <input type="checkbox" id="chkPrefCustomGridSnap" />
                    <span data-i18n="pref.custom_grid_snap">${escapeHtml(i18n.t("pref.custom_grid_snap"))}</span>
                  </label>
                  <label class="checkbox-label" style="display: flex; align-items: center; gap: 6px;">
                    <input type="checkbox" id="chkPrefCustomGridLock" />
                    <span data-i18n="pref.custom_grid_lock">${escapeHtml(i18n.t("pref.custom_grid_lock"))}</span>
                  </label>
                  ${renderRangeRow({ id: "prefCustomGridOpacity", valId: "prefCustomGridOpacityVal", labelKey: "pref.opacity", min: 10, max: 100, step: 5, value: 45, valText: "45%", valWidth: "46px", rangeWidth: "120px" })}
                  ${renderRangeRow({ id: "prefCustomGridThickness", valId: "prefCustomGridThicknessVal", labelKey: "pref.thickness", min: 1, max: 3, step: 0.5, value: 1, valText: "1 px", valWidth: "46px", rangeWidth: "120px" })}
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <span data-i18n="pref.custom_grid_color">${escapeHtml(i18n.t("pref.custom_grid_color"))}</span>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <label class="checkbox-label" style="display: flex; align-items: center; gap: 5px; font-size: 11px;">
                        <input type="checkbox" id="chkPrefCustomGridAutoColor" />
                        <span data-i18n="pref.custom_grid_auto_color">${escapeHtml(i18n.t("pref.custom_grid_auto_color"))}</span>
                      </label>
                      <button type="button" id="prefCustomGridColorBtn" class="rgba-picker-btn" style="width: 28px; height: 22px;"></button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div class="modal-actions" style="justify-content: space-between;">
          <button type="button" id="btnResetPreferences" class="btn-subtle-danger" data-i18n="pref.reset">${escapeHtml(i18n.t("pref.reset"))}</button>
          <button type="button" class="btn-primary" data-action="closePreferencesModal" data-i18n="common.close">${escapeHtml(i18n.t("common.close"))}</button>
        </div>
      </div>
    </div>
  `;
}
