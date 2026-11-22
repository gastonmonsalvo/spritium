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
      ["help.r5", "T / F · Panel"],
      ["help.r6", "K"],
      ["help.r7", "I / E"],
      ["help.r8", "Clic Der"],
    ],
  },
  {
    titleKey: "help.h4.view",
    rows: [
      ["help.r9", "S / Panel / Q / W"],
      ["help.r10", "Ctrl / Alt / Ctrl+Shift"],
      ["help.r11", "M / D"],
      ["help.r12", "H / Espacio + Arrastrar"],
      ["help.r13", "Shift+T · Alt+Clic Pivote"],
      ["help.r14", "Ctrl / Ctrl+Shift"],
      ["help.r15", "X / Y / G / P / Alt+T · Vista"],
      ["help.r46", "Regla · Alt+Mover / Clic Der"],
      ["help.r16", "V"],
      ["help.r17", "Menú Lienzo"],
      ["help.r18", "Alt+N / Ctrl+O / Archivo"],
    ],
  },
  {
    titleKey: "help.h4.edit",
    rows: [
      ["help.r19", "Ctrl+Z / Ctrl+Y"],
      ["help.r20", "Clic en Logs ▴"],
      ["help.r21", "Botón ✎"],
      ["help.r22", "Ctrl+C / X / V"],
      ["help.r23", "Ctrl+A"],
      ["help.r24", "Esc / Ctrl+D"],
      ["help.r25", "Supr"],
      ["help.r26", "Flechas"],
      ["help.r27", "Shift / Ctrl"],
    ],
  },
  {
    titleKey: "help.h4.layers",
    rows: [
      ["help.r28", "Clic Izq / Clic Der"],
      ["help.r29", "Rueda Arrastrar / Clic"],
      ["help.r30", "Ctrl + Rueda"],
      ["help.r31", "Alt+N / Ctrl+J"],
      ["help.r32", "P / Botón TM / Clic Der"],
      ["help.r33", "Ctrl+C / X / V"],
      ["help.r34", "F2 / Supr"],
      ["help.r35", "Desplegable Fusión"],
      ["help.r36", "Ctrl+Clic / Clic Der"],
    ],
  },
  {
    titleKey: "help.h4.frames",
    rows: [
      ["help.r37", "Espacio"],
      ["help.r38", "← / →"],
      ["help.r39", "Shift + ← / →"],
      ["help.r40", "Alt+N / Ctrl+J"],
      ["help.r41", "Ctrl+C / Ctrl+V"],
      ["help.r42", "Shift+Clic / Doble clic / F2"],
      ["help.r43", "Shift / Ctrl + Clic"],
      ["help.r44", "Arrastrar / Ctrl+Arrastrar"],
      ["help.r45", "Supr / Clic Der"],
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
      const isKbdKey = kbd.startsWith("help.tk");
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
