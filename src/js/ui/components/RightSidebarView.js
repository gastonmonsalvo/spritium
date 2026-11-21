// @ts-check
/**
 * RightSidebarView.js: Panel lateral derecho (Color y Paleta, Capas y Vista Previa 1:1).
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml, renderList } from "./uiHtml.js";

const REDUCE_COUNTS = [16, 24, 32, 48, 64];

const HARMONY_MODES = [
  { value: "triad", key: "color.harmony_triad", selected: true },
  { value: "analogous", key: "color.harmony_analog" },
  { value: "complementary", key: "color.harmony_comp" },
  { value: "split", key: "color.harmony_split" },
  { value: "tetrad", key: "color.harmony_tetrad" },
  { value: "none", key: "color.harmony_mono" },
];

const LAYER_TOOLBAR_ACTIONS = [
  { action: "addNewLayer", icon: "plus", titleKey: "title.new_layer" },
  { action: "addNewFolder", icon: "folder-plus", titleKey: "title.new_folder" },
  { action: "openNewTilemapModal", icon: "layout-grid", titleKey: "title.new_tilemap" },
  { action: "duplicateActiveLayer", icon: "copy-plus", titleKey: "title.dup_layer" },
  { action: "mergeLayerDown", icon: "arrow-down-to-line", titleKey: "title.merge_down" },
  { id: "btnMergeSelectedLayers", action: "mergeSelectedLayers", icon: "layers", titleKey: "title.merge_sel", disabled: true },
  { action: "mergeVisibleLayers", icon: "eye", titleKey: "title.merge_vis" },
  { action: "deleteActiveLayer", icon: "trash-2", titleKey: "title.del_layer" },
];

const BLEND_MODE_OPTIONS = [
  ["source-over", "layers.blend_normal"],
  ["multiply", "layers.blend_multiply"],
  ["screen", "layers.blend_screen"],
  ["overlay", "layers.blend_overlay"],
  ["darken", "layers.blend_darken"],
  ["lighten", "layers.blend_lighten"],
  ["color-dodge", "layers.blend_dodge"],
  ["color-burn", "layers.blend_burn"],
];

function tAttr(key) {
  return escapeHtml(i18n.t(key));
}

/** Genera el HTML del panel lateral derecho (Paletas, Capas y Vista Previa). */
export function renderRightSidebarHtml() {
  const reduceHtml = renderList(
    REDUCE_COUNTS,
    (n) =>
      `<button type="button" class="menu-action" data-action="reduceCurrentPaletteColors" data-action-arg="${n}"><span class="menu-action-label" data-i18n="color.reduce_${n}">${tAttr(`color.reduce_${n}`)}</span></button>`,
  );

  const harmonyHtml = renderList(
    HARMONY_MODES,
    (h) =>
      `<option value="${h.value}"${h.selected ? " selected" : ""} data-i18n="${h.key}">${tAttr(h.key)}</option>`,
  );

  const layerActionsHtml = renderList(
    LAYER_TOOLBAR_ACTIONS,
    (btn) => {
      const idAttr = btn.id ? ` id="${btn.id}"` : "";
      const disabledAttr = btn.disabled ? " disabled" : "";
      return `<button type="button"${idAttr} class="tool-btn" data-action="${btn.action}" style="flex: 1; padding: 5px 0" data-i18n-title="${btn.titleKey}" title="${tAttr(btn.titleKey)}"${disabledAttr}><i data-lucide="${btn.icon}" class="ui-icon-sm"></i></button>`;
    },
  );

  const blendHtml = renderList(
    BLEND_MODE_OPTIONS,
    ([val, key]) => `<option value="${val}" data-i18n="${key}">${tAttr(key)}</option>`,
  );

  return `
    <div id="rightSidebarResizer" data-i18n-title="title.resize_right" title="${tAttr("title.resize_right")}"></div>
    <aside id="rightSidebar">
      <div class="panel-header-row" style="padding: 0 2px">
        <label style="margin: 0; font-size: 10px; color: var(--text-dim)" data-i18n="panel.right">${tAttr("panel.right")}</label>
        <button type="button" id="btnCollapseRight" class="tool-btn" style="padding: 3px 6px; font-size: 11px" data-i18n-title="panel.right_hide" title="${tAttr("panel.right_hide")}">
          <i data-lucide="panel-right-close" class="ui-icon-sm"></i>
        </button>
      </div>

      <section id="moduleColors" class="dock-module">
        <div id="colorsModuleHeader" class="panel-header-row panel-drag-handle" data-i18n-title="title.drag_colors" title="${tAttr("title.drag_colors")}">
          <label style="margin: 0; pointer-events: none" data-i18n="panel.color_palette">${tAttr("panel.color_palette")}</label>
          <button type="button" id="btnFloatColors" class="tool-btn" style="padding: 3px 6px; font-size: 11px" data-i18n-title="title.float_colors" title="${tAttr("title.float_colors")}">
            <i data-lucide="move" class="ui-icon-sm"></i>
          </button>
        </div>
        <div class="panel-section-card">
          <div style="display: flex; gap: 6px; align-items: center">
            <input type="color" id="customColorPicker" value="#ff0055" style="display: none" />
            <button type="button" id="customColorPickerBtn" class="rgba-picker-btn" style="--picker-rgba: rgba(255, 0, 85, 1)" data-i18n-title="title.rgba_picker" title="${tAttr("title.rgba_picker")}"></button>
            <input type="text" id="hexColorInput" value="#FF0055" maxlength="9" style="flex: 1; font-family: var(--font-mono); font-size: 11px; padding: 4px 6px" data-i18n-title="title.hex_input" title="${tAttr("title.hex_input")}" />
            <button type="button" class="btn-primary" data-action="addCustomToPalette" style="font-size: 11px; padding: 4px 8px" data-i18n="color.add_swatch" data-i18n-title="title.add_custom_swatch" title="${tAttr("title.add_custom_swatch")}">
              ${tAttr("color.add_swatch")}
            </button>
          </div>
          <div style="display: flex; align-items: center; gap: 6px">
            <label for="colorAlphaInput" style="margin: 0; font-size: 10px; white-space: nowrap" data-i18n="color.alpha_label">${tAttr("color.alpha_label")}</label>
            <input type="range" id="colorAlphaInput" min="0" max="255" value="255" style="flex: 1; margin: 0" data-i18n-title="title.color_alpha" title="${tAttr("title.color_alpha")}" />
            <span id="colorAlphaVal" style="font-family: var(--font-mono); font-size: 10px; min-width: 32px; text-align: right">100%</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 5px">
            <select id="themeSelect" style="width: 100%; font-size: 11px"></select>
            <div style="display: flex; gap: 5px; align-items: center">
              <button type="button" class="tool-btn" data-action="switchTheme" data-i18n="opt.apply" style="flex: 1; font-size: 11px; padding: 5px 8px" data-i18n-title="title.apply_palette" title="${tAttr("title.apply_palette")}">
                ${tAttr("opt.apply")}
              </button>
              <div class="menu-item" id="reduceMenuItem" style="flex: 1">
                <button type="button" class="tool-btn" id="btnReduceDropdown" style="width: 100%; font-size: 11px; padding: 5px 7px" data-i18n-title="title.reduce_palette" title="${tAttr("title.reduce_palette")}">
                  <span data-i18n="color.reduce">${tAttr("color.reduce")}</span>
                  <i data-lucide="chevron-down" class="ui-icon-sm"></i>
                </button>
                <div class="menu-dropdown" style="right: 0; left: auto; min-width: 155px">
                  ${reduceHtml}
                </div>
              </div>
            </div>
          </div>

          <div id="activeColorDual" class="dual-color-bar">
            <div class="dual-color-slot" data-i18n-title="title.primary_color" title="${tAttr("title.primary_color")}">
              <span class="dual-color-label">1°</span>
              <div id="primaryColorPreview" class="dual-color-chip"></div>
            </div>
            <button type="button" class="tool-btn dual-swap-btn" data-action="swapPrimarySecondaryColors" data-i18n-title="title.swap_colors" title="${tAttr("title.swap_colors")}">⇄</button>
            <div class="dual-color-slot" data-action="resetSecondaryColorToTransparent" style="cursor: pointer" data-i18n-title="title.secondary_color" title="${tAttr("title.secondary_color")}">
              <span class="dual-color-label">2°</span>
              <div id="secondaryColorPreview" class="dual-color-chip is-transparent"></div>
            </div>
            <button type="button" class="tool-btn dual-swap-btn" data-action="resetSecondaryColorToTransparent" data-i18n-title="title.reset_secondary" title="${tAttr("title.reset_secondary")}">∅</button>
          </div>

          <button type="button" id="btnToggleColorWheel" class="tool-btn" data-action="toggleColorWheelPanel" style="width: 100%; justify-content: space-between; font-size: 11px; padding: 4px 8px" data-i18n-title="title.color_wheel" title="${tAttr("title.color_wheel")}">
            <span style="display: inline-flex; align-items: center; gap: 6px"><i data-lucide="palette" class="ui-icon-sm"></i><span data-i18n="color.wheel_harmonies">${tAttr("color.wheel_harmonies")}</span></span>
            <i data-lucide="chevron-down" class="ui-icon-sm"></i>
          </button>
          <div id="colorWheelCollapse" class="color-wheel-collapse" style="display: none">
            <canvas id="colorWheelCanvas" width="144" height="144"></canvas>
            <select id="colorHarmonySelect" style="width: 100%; font-size: 11px">
              ${harmonyHtml}
            </select>
            <div id="harmonySwatches" class="harmony-swatches"></div>
          </div>

          <div id="palette-bar"></div>
          <label style="margin: 2px 0 0; font-size: 10px" data-i18n="color.custom_palettes">${tAttr("color.custom_palettes")}</label>
          <div id="custom-palette-bar" style="min-height: 22px"></div>

          <input type="file" id="paletteFileInput" accept=".hex,.gpl,.pal,.json" style="display: none" />
          <div style="display: flex; gap: 4px; margin-top: 2px; align-items: center">
            <button type="button" class="tool-btn" data-action="openPaletteDialog" style="flex: 1; font-size: 10.5px; padding: 4px 5px" data-i18n-title="title.import_palette" title="${tAttr("title.import_palette")}">
              <i data-lucide="folder-open" class="ui-icon-sm"></i><span data-i18n="opt.load">${tAttr("opt.load")}</span>
            </button>
            <button type="button" class="tool-btn" data-action="createNewCustomPalette" style="flex: 1; font-size: 10.5px; padding: 4px 5px" data-i18n-title="title.save_palette" title="${tAttr("title.save_palette")}">
              <i data-lucide="bookmark-plus" class="ui-icon-sm"></i><span data-i18n="color.save">${tAttr("color.save")}</span>
            </button>
            <div class="menu-item" id="paletteExportMenuItem" style="flex: 1">
              <button type="button" class="tool-btn" id="btnPaletteExportDropdown" style="width: 100%; font-size: 10.5px; padding: 4px 5px" data-i18n-title="title.export_palette" title="${tAttr("title.export_palette")}">
                <i data-lucide="download" class="ui-icon-sm"></i><span data-i18n="opt.export_short">${tAttr("opt.export_short")}</span>
                <i data-lucide="chevron-down" class="ui-icon-sm"></i>
              </button>
              <div class="menu-dropdown" style="right: 0; left: auto; min-width: 155px">
                <button type="button" class="menu-action" data-action="exportCurrentPalette" data-action-arg="hex"><span class="menu-action-label" data-i18n="color.palette_hex">${tAttr("color.palette_hex")}</span></button>
                <button type="button" class="menu-action" data-action="exportCurrentPalette" data-action-arg="gpl"><span class="menu-action-label" data-i18n="color.palette_gpl">${tAttr("color.palette_gpl")}</span></button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="moduleLayers" class="dock-module">
        <div id="layersModuleHeader" class="panel-header-row panel-drag-handle" data-i18n-title="title.drag_layers" title="${tAttr("title.drag_layers")}">
          <label style="margin: 0; pointer-events: none" data-i18n="panel.layers">${tAttr("panel.layers")}</label>
          <button type="button" id="btnFloatLayers" class="tool-btn" style="padding: 3px 6px; font-size: 11px" data-i18n-title="title.float_layers" title="${tAttr("title.float_layers")}">
            <i data-lucide="move" class="ui-icon-sm"></i>
          </button>
        </div>
        <div id="layersSection" style="display: flex; flex-direction: column; gap: 6px">
          <div style="display: flex; gap: 4px; align-items: center">${layerActionsHtml}</div>
          <div style="display: flex; align-items: center; gap: 6px; padding: 2px 0">
            <label for="layerBlendModeSelect" data-i18n="layers.blend" style="margin: 0; font-size: 10px; white-space: nowrap">${tAttr("layers.blend")}</label>
            <select id="layerBlendModeSelect" data-change="setActiveLayerBlendModeFromEvent" data-i18n-title="title.blend_mode" title="${tAttr("title.blend_mode")}" style="flex: 1; min-width: 0; font-size: 11px; padding: 3px 6px">
              ${blendHtml}
            </select>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; padding: 2px 0">
            <label for="layerOpacitySlider" data-i18n="timeline.opacity" style="margin: 0; font-size: 10px; white-space: nowrap">${tAttr("timeline.opacity")}</label>
            <input type="range" id="layerOpacitySlider" min="0" max="100" value="100" data-input="setActiveLayerOpacityFromEvent" style="flex: 1" />
            <span id="layerOpacityValue" style="font-size: 10px; color: var(--text-muted); min-width: 32px; text-align: right">100%</span>
          </div>
          <div id="layers-list"></div>
          <div data-i18n="layers.hint_text" style="font-size: 10px; color: var(--text-dim); line-height: 1.3">
            ${tAttr("layers.hint_text")}
          </div>
        </div>
      </section>

      <section id="modulePreview" class="dock-module">
        <div id="previewModuleHeader" class="panel-header-row panel-drag-handle" data-i18n-title="title.drag_preview" title="${tAttr("title.drag_preview")}">
          <label style="margin: 0; pointer-events: none" data-i18n="panel.preview">${tAttr("panel.preview")}</label>
          <div style="display: flex; align-items: center; gap: 3px">
            <button type="button" id="btnCollapsePreview" class="tool-btn" style="padding: 3px 5px; font-size: 11px" data-i18n-title="title.collapse_preview" title="${tAttr("title.collapse_preview")}">
              <i data-lucide="minus" class="ui-icon-sm"></i>
            </button>
            <button type="button" id="btnFloatPreview" class="tool-btn" style="padding: 3px 6px; font-size: 11px" data-i18n-title="title.float_preview" title="${tAttr("title.float_preview")}">
              <i data-lucide="move" class="ui-icon-sm"></i>
            </button>
          </div>
        </div>
        <div class="preview-box" style="margin-top: 0">
          <canvas id="previewCanvas" width="64" height="64" class="preview-canvas"></canvas>
        </div>
      </section>
    </aside>
  `;
}

/**
 * Monta `#rightSidebarResizer` y `#rightSidebar` en `#rightSidebarMount`.
 */
export function mountRightSidebar() {
  const mount = document.getElementById("rightSidebarMount");
  if (!mount) return;
  mount.outerHTML = renderRightSidebarHtml();
}
