// @ts-check
/**
 * LanguageModal.js: Modal compacto de selección de idioma.
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml, renderList } from "../components/uiHtml.js";

const LANGUAGES = [
  { code: "es", labelKey: "lang.es_label", badge: "ES" },
  { code: "en", labelKey: "lang.en_label", badge: "EN" },
];

/** Genera el HTML del modal selector de idioma. */
export function renderLanguageModal() {
  const options = renderList(
    LANGUAGES,
    ({ code, labelKey, badge }) => `
      <button type="button" class="tool-btn lang-btn lang-modal-option" data-lang="${code}" style="justify-content: space-between; padding: 8px 12px; font-size: 12.5px;">
        <span data-i18n="${labelKey}">${escapeHtml(i18n.t(labelKey))}</span>
        <span style="font-family: var(--font-mono); font-size: 10.5px; opacity: 0.85;">${badge}</span>
      </button>`,
  );

  return `
    <div id="languageModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="languageModalTitle" data-backdrop-close="closeLanguageModal">
      <div class="modal-card" style="max-width: 300px;">
        <div class="modal-header">
          <h3 id="languageModalTitle" style="display: inline-flex; align-items: center; gap: 7px;">
            <i data-lucide="globe" class="ui-icon-sm"></i>
            <span data-i18n="lang.section_title">${escapeHtml(i18n.t("lang.section_title"))}</span>
          </h3>
          <button type="button" class="tool-btn" data-action="closeLanguageModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 8px;">
          ${options}
        </div>
      </div>
    </div>
  `;
}
