// @ts-check
/**
 * AboutModal.js: Modal "Sobre Spritium".
 */

import { i18n } from "../../i18n/I18nService.js";
import { formatAppVersion } from "../../core/version.js";
import { escapeHtml } from "../components/uiHtml.js";

/** Genera el HTML del modal Sobre Spritium. */
export function renderAboutModal() {
  return `
    <div id="aboutModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="aboutModalTitle" data-backdrop-close="closeAboutModal">
      <div class="modal-card" style="width: min(440px, 92vw)">
        <div class="modal-header">
          <h3 id="aboutModalTitle" data-i18n="modal.about.title">${escapeHtml(i18n.t("modal.about.title"))}</h3>
          <button type="button" class="tool-btn" data-action="closeAboutModal" style="padding: 4px 8px">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>

        <div class="panel-section-card" style="gap: 8px; padding: 12px">
          <div style="display: flex; align-items: center; gap: 10px">
            <img src="./src/assets/logo-64x64.png" alt="Spritium Logo" class="logo-pixelart logo-pixelart--about" />
            <div style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap">
              <div style="font-family: var(--font-display); font-size: 15px; color: var(--text-primary)">Spritium</div>
              <span style="font-family: var(--font-mono); font-size: 11px; padding: 1px 6px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-secondary)">${escapeHtml(formatAppVersion())}</span>
            </div>
          </div>
          <p data-i18n="modal.about.desc" style="font-size: 12.5px; line-height: 1.5; color: var(--text-secondary)">
            ${escapeHtml(i18n.t("modal.about.desc"))}
          </p>
          <p style="font-size: 12.5px; line-height: 1.5; color: var(--text-primary)">
            <span data-i18n="modal.about.created_by">${escapeHtml(i18n.t("modal.about.created_by"))}</span> <strong>Gastón Monsalvo</strong>. <span data-i18n="modal.about.open_source">${escapeHtml(i18n.t("modal.about.open_source"))}</span>
          </p>
          <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 2px">
            <a
              href="https://github.com/gastonmonsalvo"
              target="_blank"
              rel="noopener noreferrer"
              class="launcher-footer-link"
              style="width: fit-content"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span>github.com/gastonmonsalvo</span>
            </a>
            <a
              href="https://discord.gg/cxPmhUNFPj"
              target="_blank"
              rel="noopener noreferrer"
              class="launcher-footer-link"
              style="width: fit-content"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span>Discord Community</span>
            </a>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-primary" data-action="closeAboutModal" data-i18n="common.close">${escapeHtml(i18n.t("common.close"))}</button>
        </div>
      </div>
    </div>
  `;
}
