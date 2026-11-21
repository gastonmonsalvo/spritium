// @ts-check
/**
 * LauncherView.js: Plantilla declarativa de la pantalla de inicio (Launcher) sin strings escapados ni onclick inline.
 */

import { i18n } from "../../i18n/I18nService.js";
import { formatAppVersion } from "../../core/version.js";
import { escapeHtml } from "./uiHtml.js";

function renderLauncherHtml() {
  return `
    <div id="launcherOverlay">
      <div class="launcher-top-actions">
        <button
          type="button"
          id="btnLauncherLangModal"
          class="tool-btn launcher-theme-btn"
          data-action="openLanguageModal"
          data-i18n-title="lang.panel_aria"
          title="${escapeHtml(i18n.t("lang.panel_aria"))}"
          aria-label="${escapeHtml(i18n.t("lang.panel_aria"))}"
        >
          <i data-lucide="globe" class="ui-icon-sm"></i>
        </button>
        <button
          type="button"
          id="btnLauncherThemeToggle"
          class="tool-btn launcher-theme-btn"
          data-action="toggleColorTheme"
          data-i18n-title="launcher.theme_title"
          title="${escapeHtml(i18n.t("launcher.theme_title"))}"
          aria-label="${escapeHtml(i18n.t("launcher.theme_title"))}"
        >
          <i data-lucide="sun" class="ui-icon-sm"></i>
        </button>
        <button
          type="button"
          id="btnLauncherHelp"
          class="tool-btn launcher-theme-btn"
          data-action="openLauncherDocs"
          data-i18n-title="menu.help"
          data-i18n-aria-label="menu.help"
          title="${escapeHtml(i18n.t("menu.help"))}"
          aria-label="${escapeHtml(i18n.t("menu.help"))}"
        >
          <i data-lucide="circle-help" class="ui-icon-sm"></i>
        </button>
      </div>

      <div class="launcher-container">
        <div class="brand-header">
          <img src="./src/assets/logo-64x64.png" alt="Spritium Logo" class="logo-pixelart" />
          <div style="display: flex; flex-direction: column; gap: 2px">
            <h1 class="brand-title">Spritium</h1>
            <span class="brand-tag">pixel art studio · ${escapeHtml(formatAppVersion())}</span>
          </div>
        </div>

        <p class="launcher-subtitle" data-i18n="launcher.subtitle_prompt">${escapeHtml(i18n.t("launcher.subtitle_prompt"))}</p>

        <div class="launcher-actions-row">
          <button type="button" class="launcher-btn launcher-btn-primary" data-action="openNewDocModal">
            <span data-i18n="menu.file.new">${escapeHtml(i18n.t("menu.file.new"))}</span>
            <span class="launcher-shortcut">Alt+N</span>
          </button>

          <button type="button" class="launcher-btn launcher-btn-outline" data-action="openLauncherFileInput">
            <span data-i18n="menu.file.open">${escapeHtml(i18n.t("menu.file.open"))}</span>
            <span class="launcher-shortcut">Ctrl+O</span>
          </button>
        </div>

        <div class="drop-hint" tabindex="0" data-action="openLauncherFileInput">
          <svg class="drop-icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span data-i18n="launcher.drop_hint">${escapeHtml(i18n.t("launcher.drop_hint"))}</span>
        </div>

        <div id="autosaveCard" class="autosave-card hidden">
          <img class="autosave-thumb" alt="" />
          <div class="autosave-info">
            <span class="autosave-title" data-i18n="launcher.resume_title">${escapeHtml(i18n.t("launcher.resume_title"))}</span>
            <span class="autosave-meta" data-i18n="launcher.autosave">${escapeHtml(i18n.t("launcher.autosave"))}</span>
          </div>
          <button type="button" id="btnResumeAutosave" class="btn-primary" style="font-size: 11.5px; padding: 6px 10px" data-i18n="launcher.resume_btn">
            ${escapeHtml(i18n.t("launcher.resume_btn"))}
          </button>
          <button type="button" id="btnDiscardAutosave" class="tool-btn" style="font-size: 11px; padding: 6px 8px" data-i18n-title="launcher.discard_title" title="${escapeHtml(i18n.t("launcher.discard_title"))}">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>

        <div class="recent-section" id="recentSection">
          <div class="recent-header">
            <div class="recent-title" data-i18n="launcher.recent_title">${escapeHtml(i18n.t("launcher.recent_title"))}</div>
            <button type="button" id="btnToggleRecents" class="tool-btn recent-toggle-btn" data-i18n-title="launcher.toggle_recents_title" title="${escapeHtml(i18n.t("launcher.toggle_recents_title"))}" data-i18n="launcher.hide">
              ${escapeHtml(i18n.t("launcher.hide"))}
            </button>
          </div>
          <ul class="recent-list" id="recentList"></ul>
          <div class="recent-footer">
            <button
              type="button"
              id="btnClearRecents"
              class="recent-clear-btn"
              data-i18n-title="launcher.clear_recents_title"
              title="${escapeHtml(i18n.t("launcher.clear_recents_title"))}"
              hidden
              data-i18n="launcher.clear_recents"
            >
              ${escapeHtml(i18n.t("launcher.clear_recents"))}
            </button>
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap">
          <a href="https://github.com/gastonmonsalvo" target="_blank" rel="noopener noreferrer" class="launcher-footer-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span>GitHub</span>
          </a>
          <a href="https://discord.gg/cxPmhUNFPj" target="_blank" rel="noopener noreferrer" class="launcher-footer-link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <span>Discord</span>
          </a>
        </div>

        <footer class="launcher-copyright">
          <span>© 2026 Spritium · Gastón Monsalvo</span>
          <span class="launcher-copyright-sub" data-i18n="launcher.copyright_sub">${escapeHtml(i18n.t("launcher.copyright_sub"))}</span>
        </footer>
      </div>

      <input type="file" id="launcherFileInput" accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.spritium" style="display: none" />
      <input type="file" id="folderFileInput" webkitdirectory multiple style="display: none" />
    </div>
  `;
}

/**
 * Monta la pantalla de inicio (`#launcherOverlay`) en `#launcherMount` si todavía no fue insertada.
 */
export function mountLauncherOverlay() {
  const mount = document.getElementById("launcherMount");
  if (!mount || mount.dataset.mounted === "true") return;
  mount.innerHTML = renderLauncherHtml();
  mount.dataset.mounted = "true";
}
