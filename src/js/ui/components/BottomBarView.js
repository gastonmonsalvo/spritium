// @ts-check
/**
 * BottomBarView.js: Módulo de Frames, Timeline/Matriz, menú contextual de cels y barra de logs.
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml, renderList } from "./uiHtml.js";

const TRANSPORT_BUTTONS = [
  { action: "goToFirstFrame", titleKey: "title.frame_first", glyph: "⏮", pad: "2px 6px" },
  { action: "goToPrevFrame", titleKey: "title.frame_prev", glyph: "◀", pad: "2px 6px" },
  { action: "togglePlayAnimation", titleKey: "title.frame_play", glyph: "▶", pad: "2px 7px" },
  { action: "goToNextFrame", titleKey: "title.frame_next", glyph: "▶", pad: "2px 6px" },
  { action: "goToLastFrame", titleKey: "title.frame_last", glyph: "⏭", pad: "2px 6px" },
];

const CEL_MENU_ITEMS = [
  { action: "linkPrev", labelKey: "timeline.link_cel" },
  { action: "unlink", labelKey: "timeline.unlink_cel" },
  { divider: true },
  { action: "copy", labelKey: "timeline.copy_cel" },
  { action: "paste", labelKey: "timeline.paste_cel" },
  { divider: true },
  { action: "clear", labelKey: "timeline.clear_cel" },
  { divider: true },
  { action: "createTag", labelKey: "timeline.create_tag" },
];

const FRAME_EXPORT_ITEMS = [
  { icon: "clapperboard", labelKey: "timeline.exp_gif", action: "openExportModal", arg: "gif" },
  { icon: "sliders", labelKey: "timeline.exp_options", action: "openExportModal", arg: "strip" },
  { divider: true },
  { icon: "film", labelKey: "timeline.exp_strip_1x", action: "exportPureSpritesheetPng" },
  { icon: "package", labelKey: "save.atlas", action: "exportPackedAtlas" },
  { divider: true },
  { icon: "image", labelKey: "timeline.exp_frame_1x", action: "downloadCurrent" },
];

/** Genera el HTML del módulo inferior de Frames, Timeline y Matrix. */
export function renderBottomBarHtml() {
  const transportHtml = renderList(
    TRANSPORT_BUTTONS,
    (b) =>
      `<button type="button" class="tool-btn" data-action="${b.action}" style="padding: ${b.pad}; font-size: 11px" data-i18n-title="${b.titleKey}" title="${escapeHtml(i18n.t(b.titleKey))}">${b.glyph}</button>`,
  );

  const celMenuHtml = renderList(CEL_MENU_ITEMS, (item) =>
    item.divider
      ? `<div class="ctx-divider"></div>`
      : `<button type="button" class="ctx-item" data-cel-action="${item.action}"><span data-i18n="${item.labelKey}">${escapeHtml(i18n.t(item.labelKey))}</span></button>`,
  );

  const exportMenuHtml = renderList(FRAME_EXPORT_ITEMS, (item) => {
    if (item.divider) return `<div class="menu-divider"></div>`;
    const argAttr = item.arg !== undefined ? ` data-action-arg="${escapeHtml(item.arg)}"` : "";
    return `
      <button type="button" class="menu-action" data-action="${item.action}"${argAttr}>
        <span class="menu-action-label"><i data-lucide="${item.icon}" class="ui-icon-sm"></i><span data-i18n="${item.labelKey}">${escapeHtml(i18n.t(item.labelKey))}</span></span>
      </button>`;
  });

  return `
    <section id="moduleFrames" class="dock-module">
      <div id="timelineResizer" class="timeline-resizer" data-i18n-title="title.resize_timeline" title="${escapeHtml(i18n.t("title.resize_timeline"))}"></div>
      <div id="timelineMatrixWrap" class="timeline-matrix-wrap" style="display: none">
        <div class="tm-transport-bar">
          <div style="display: flex; align-items: center; gap: 3px">
            ${transportHtml}
          </div>
          <span style="font-size: 10px; color: var(--text-muted)" data-i18n="timeline.hint_text">${escapeHtml(i18n.t("timeline.hint_text"))}</span>
        </div>
        <div class="tm-scroll-area">
          <div id="timelineTagsRow" class="tm-tags-row"></div>
          <div id="timelineMatrixGrid" class="tm-matrix-grid"></div>
        </div>
      </div>

      <div id="celContextMenu" class="context-menu" style="min-width: 175px">
        ${celMenuHtml}
      </div>

      <div id="timelineBar">
        <div id="framesModuleHeader" class="panel-drag-handle" style="display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0" data-i18n-title="title.drag_frames" title="${escapeHtml(i18n.t("title.drag_frames"))}">
          <span style="font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; pointer-events: none" data-i18n="panel.frames">${escapeHtml(i18n.t("panel.frames"))}</span>
          <button type="button" id="btnToggleTimelineExpand" class="tool-btn" data-action="toggleTimelineExpanded" style="padding: 3px 7px; font-size: 10.5px; gap: 3px" data-i18n-title="title.toggle_matrix" title="${escapeHtml(i18n.t("title.toggle_matrix"))}">
            <i data-lucide="chevron-up" class="ui-icon-sm"></i><span data-i18n="timeline.matrix">${escapeHtml(i18n.t("timeline.matrix"))}</span>
          </button>
        </div>
        <button type="button" class="tool-btn" data-action="addNewFrame" style="padding: 4px 8px; font-size: 11px" data-i18n-title="title.add_frame" title="${escapeHtml(i18n.t("title.add_frame"))}">
          + Frame
        </button>
        <button type="button" class="tool-btn" data-action="duplicateFrame" style="padding: 4px 8px; font-size: 11px" data-i18n-title="title.dup_frame" title="${escapeHtml(i18n.t("title.dup_frame"))}" data-i18n="timeline.dup_btn">
          ${escapeHtml(i18n.t("timeline.dup_btn"))}
        </button>
        <button type="button" class="tool-btn" data-action="deleteActiveFrame" style="padding: 4px 8px; font-size: 11px" data-i18n-title="title.del_frame" title="${escapeHtml(i18n.t("title.del_frame"))}">
          <i data-lucide="trash-2" class="ui-icon-sm"></i>
        </button>
        <div id="frames-list"></div>

        <div style="display: inline-flex; align-items: center; gap: 2px">
          <button type="button" class="tool-btn" id="btnOnionSkin" data-action="toggleOnionSkin" style="padding: 4px 8px; font-size: 11px" data-i18n-title="title.onion_toggle" title="${escapeHtml(i18n.t("title.onion_toggle"))}">
            <i data-lucide="layers" class="ui-icon-sm"></i>
            <span data-i18n="timeline.onion">${escapeHtml(i18n.t("timeline.onion"))}</span>
          </button>
          <div class="menu-item" id="onionSkinMenuItem">
            <button type="button" class="tool-btn" id="btnOnionConfigDropdown" style="padding: 4px 5px; font-size: 11px" data-i18n-title="title.onion_cfg" title="${escapeHtml(i18n.t("title.onion_cfg"))}">
              <i data-lucide="chevron-up" class="ui-icon-sm"></i>
            </button>
            <div class="menu-dropdown" style="bottom: calc(100% + 6px); top: auto; right: 0; left: auto; min-width: 225px; padding: 10px; display: none" id="onionSkinDropdown">
              <div style="display: flex; flex-direction: column; gap: 9px">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px">
                  <span style="font-size: 10.5px; font-weight: 600; color: var(--text-secondary)" data-i18n="timeline.mode">${escapeHtml(i18n.t("timeline.mode"))}</span>
                  <div style="display: flex; gap: 4px">
                    <button type="button" id="onionModeNormal" class="tool-btn active" data-action="setOnionSkinOption" data-action-args='["mode","normal"]' data-i18n="timeline.mode_normal" style="font-size: 10px; padding: 3px 8px">${escapeHtml(i18n.t("timeline.mode_normal"))}</button>
                    <button type="button" id="onionModeRedBlue" class="tool-btn" data-action="setOnionSkinOption" data-action-args='["mode","redblue"]' data-i18n="timeline.mode_redblue" style="font-size: 10px; padding: 3px 8px" data-i18n-title="title.onion_redblue" title="${escapeHtml(i18n.t("title.onion_redblue"))}">${escapeHtml(i18n.t("timeline.mode_redblue"))}</button>
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 3px">
                  <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: var(--text-secondary)">
                    <span data-i18n="timeline.opacity">${escapeHtml(i18n.t("timeline.opacity"))}</span>
                    <span id="onionOpacityVal" style="font-family: var(--font-mono)">30%</span>
                  </div>
                  <input type="range" id="onionOpacityInput" min="10" max="80" step="5" value="30" data-input="setOnionSkinOpacity" style="width: 100%; margin: 0" />
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
                  <div>
                    <label for="onionPrevCount" style="font-size: 10px; margin-bottom: 2px" data-i18n="timeline.prev">${escapeHtml(i18n.t("timeline.prev"))}</label>
                    <input type="number" id="onionPrevCount" min="0" max="3" value="1" data-input="setOnionSkinPrevCount" style="width: 100%; padding: 3px 6px; font-size: 11px" />
                  </div>
                  <div>
                    <label for="onionNextCount" style="font-size: 10px; margin-bottom: 2px" data-i18n="timeline.next">${escapeHtml(i18n.t("timeline.next"))}</label>
                    <input type="number" id="onionNextCount" min="0" max="2" value="0" data-input="setOnionSkinNextCount" style="width: 100%; padding: 3px 6px; font-size: 11px" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <input
          type="number"
          id="animFpsInput"
          value="8"
          min="1"
          max="60"
          style="width: 48px; padding: 3px 5px; font-size: 11px; border-radius: 4px"
          data-i18n-title="title.fps_input"
          title="${escapeHtml(i18n.t("title.fps_input"))}"
        />
        <button type="button" class="tool-btn" id="btnPlayAnim" data-action="togglePlayAnimation" style="padding: 4px 8px; font-size: 11px">
          <i data-lucide="play" class="ui-icon-sm"></i>
          <span data-i18n="timeline.play">${escapeHtml(i18n.t("timeline.play"))}</span>
        </button>

        <div class="menu-item" id="exportFramesMenuItem">
          <button type="button" class="btn-subtle-success" id="btnExportFramesDropdown" style="padding: 4px 9px; font-size: 11px" data-i18n-title="title.export_anim" title="${escapeHtml(i18n.t("title.export_anim"))}">
            <i data-lucide="download" class="ui-icon-sm"></i>
            <span data-i18n="timeline.export">${escapeHtml(i18n.t("timeline.export"))}</span>
            <i data-lucide="chevron-up" class="ui-icon-sm"></i>
          </button>
          <div class="menu-dropdown" style="bottom: calc(100% + 4px); top: auto; right: 0; left: auto; min-width: 230px">
            ${exportMenuHtml}
          </div>
        </div>

        <div id="framesWindowControls" style="display: inline-flex; align-items: center; gap: 3px; margin-left: auto; flex-shrink: 0">
          <button type="button" id="btnFloatFrames" class="tool-btn" style="padding: 2px 5px; font-size: 10px" data-i18n-title="title.float_frames" title="${escapeHtml(i18n.t("title.float_frames"))}">
            <i data-lucide="move" class="ui-icon-sm"></i>
          </button>
          <button type="button" id="btnCollapseBottom" class="tool-btn" style="padding: 2px 5px; font-size: 10px" data-i18n-title="title.hide_frames" title="${escapeHtml(i18n.t("title.hide_frames"))}">
            <i data-lucide="panel-bottom-close" class="ui-icon-sm"></i>
          </button>
        </div>
      </div>
    </section>
  `;
}

/**
 * Monta el módulo de Frames/Timeline dentro de `#bottomFramesMount`.
 */
export function mountBottomBar() {
  const mount = document.getElementById("bottomFramesMount");
  if (!mount) return;
  mount.outerHTML = renderBottomBarHtml();
}
