// @ts-check
/**
 * HelpModal.js: Modal de atajos de teclado y controles generado desde esquema de datos.
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml, renderList } from "../components/uiHtml.js";

const HELP_SECTIONS = [
  {
    titleKey: "help.h4.draw",
    rows: [
      ["help.r0", "B"],
      ["help.r1", "[ / ]"],
      ["help.r2", "L"],
      ["help.r3", "Shift · Enter / Esc"],
      ["help.r4", "R / C / U"],
      ["help.r_poly", "help.k.poly"],
      ["help.r5", "help.k.bucket"],
      ["help.r6", "K"],
      ["help.r7", "I / E"],
      ["help.r8", "help.k.rclick"],
    ],
  },
  {
    titleKey: "help.h4.view",
    rows: [
      ["help.r9", "help.k.select"],
      ["help.r10", "Ctrl / Alt / Ctrl+Shift"],
      ["help.r11", "M / D"],
      ["help.r12", "help.k.pan"],
      ["help.r13", "help.k.ft"],
      ["help.r14", "Ctrl / Ctrl+Shift"],
      ["help.r15", "help.k.view_toggles"],
      ["help.r46", "help.k.rulers"],
      ["help.r16", "V"],
      ["help.r17", "help.k.canvas_menu"],
      ["help.r18", "Alt+N / Ctrl+O / Alt+S / Alt+Shift+S"],
      ["help.r47", "help.k.zoom"],
      ["help.r48", "help.k.scroll_wheel"],
      ["help.r49", "help.k.measure"],
      ["help.r50", "help.k.resize_edge"],
      ["help.r51", "help.k.preview_zoom"],
    ],
  },
  {
    titleKey: "help.h4.edit",
    rows: [
      ["help.r19", "Ctrl+Z / Ctrl+Y"],
      ["help.r20", "help.k.logs"],
      ["help.r21", "help.k.rename_btn"],
      ["help.r22", "Ctrl+C / X / V"],
      ["help.r23", "Ctrl+A"],
      ["help.r24", "Esc / Ctrl+D"],
      ["help.r25", "help.k.del"],
      ["help.r26", "help.k.arrows"],
      ["help.r27", "Shift / Ctrl"],
    ],
  },
  {
    titleKey: "help.h4.layers",
    rows: [
      ["help.r28", "help.k.lr_click"],
      ["help.r29", "help.k.wheel_drag"],
      ["help.r30", "help.k.ctrl_wheel"],
      ["help.r31", "Alt+N / Ctrl+J"],
      ["help.r32", "help.k.tilemap"],
      ["help.r33", "Ctrl+C / X / V"],
      ["help.r34", "help.k.f2_del"],
      ["help.r35", "help.k.blend_select"],
      ["help.r36", "help.k.ctrl_rclick"],
    ],
  },
  {
    titleKey: "help.h4.frames",
    rows: [
      ["help.r37", "help.k.space"],
      ["help.r38", "← / →"],
      ["help.r39", "Shift + ← / →"],
      ["help.r40", "Alt+N / Ctrl+J"],
      ["help.r41", "Ctrl+C / Ctrl+V"],
      ["help.r42", "help.k.tag_edit"],
      ["help.r43", "help.k.multi_click"],
      ["help.r44", "help.k.drag_ctrl"],
      ["help.r45", "help.k.del_rclick"],
    ],
  },
  {
    titleKey: "help.h4.touch",
    className: "help-section--touch",
    rows: [
      ["help.t0", "help.tk0"],
      ["help.t1", "help.tk1"],
      ["help.t2", "help.tk2"],
      ["help.t3", "help.tk3"],
      ["help.t4", "help.tk4"],
      ["help.t5", "help.tk5"],
      ["help.t6", "help.tk6"],
    ],
  },
];

function renderHelpSection(section) {
  const rowsHtml = renderList(
    section.rows,
    ([key, kbd]) => {
      const isKbdKey = kbd.startsWith("help.k.") || kbd.startsWith("help.tk");
      const kbdText = isKbdKey ? i18n.t(kbd) : kbd;
      const kbdAttr = isKbdKey ? ` data-i18n="${escapeHtml(kbd)}"` : "";
      return `
      <div class="help-row">
        <span data-i18n="${escapeHtml(key)}">${escapeHtml(i18n.t(key))}</span>
        <span class="help-kbd"${kbdAttr}>${escapeHtml(kbdText)}</span>
      </div>`;
    },
  );

  return `
    <div class="help-section${section.className ? ` ${section.className}` : ""}">
      <h4 data-i18n="${escapeHtml(section.titleKey)}">${escapeHtml(i18n.t(section.titleKey))}</h4>
      ${rowsHtml}
    </div>`;
}

const HELP_DOC_LINKS = [
  { href: "./docs/index.html?doc=HELP.md&from=editor", icon: "file-text", key: "help.docs_guide" },
];

/** Genera el HTML del modal de Atajos, Controles y Documentación. */
export function renderHelpModal() {
  const docLinksHtml = renderList(
    HELP_DOC_LINKS,
    ({ href, icon, key }) => `
      <a href="${href}" target="_blank" rel="noopener noreferrer" class="tool-btn" style="text-decoration: none; font-size: 11px; padding: 4px 8px">
        <i data-lucide="${icon}" class="ui-icon-sm"></i>
        <span data-i18n="${key}">${escapeHtml(i18n.t(key))}</span>
      </a>`,
  );

  return `
    <div id="helpModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="helpModalTitle" data-backdrop-close="closeHelpModal">
      <div class="modal-card help-modal-card">
        <div class="modal-header">
          <h3 id="helpModalTitle" data-i18n="modal.help.title">${escapeHtml(i18n.t("modal.help.title"))}</h3>
          <button type="button" class="tool-btn" data-action="closeHelpModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>
        <div class="help-grid">
          ${renderList(HELP_SECTIONS, renderHelpSection)}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding-top: 10px; border-top: 1px solid var(--border-subtle)">
          <span style="font-size: 11px; color: var(--text-muted); font-weight: 600" data-i18n="help.docs_label">${escapeHtml(i18n.t("help.docs_label"))}</span>
          <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px">
            ${docLinksHtml}
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-primary" data-action="closeHelpModal" data-i18n="common.close">${escapeHtml(i18n.t("common.close"))}</button>
        </div>
      </div>
    </div>
  `;
}
