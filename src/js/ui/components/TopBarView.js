// @ts-check
/**
 * TopBarView.js: Barra superior (marca, punto de montaje de menú, nombre, deshacer/rehacer, guardar, medios, tema, idioma).
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml, renderList } from "./uiHtml.js";

const SAVE_MENU_ITEMS = [
  { icon: "save", labelKey: "save.project_spritium", action: "saveProjectFile" },
  { icon: "save-all", labelKey: "menu.file.save_as", action: "saveProjectFileAs" },
  { icon: "image", labelKey: "save.png_fast", action: "downloadCurrent" },
  { icon: "sliders", labelKey: "save.png_options", action: "openExportModal", arg: "png" },
  { divider: true },
  { icon: "film", labelKey: "save.strip_raw", action: "exportPureSpritesheetPng" },
  { icon: "package", labelKey: "save.atlas", action: "exportPackedAtlas" },
];

function renderSaveMenuItem(item) {
  if (item.divider) return `<div class="menu-divider"></div>`;
  const argAttr = item.arg !== undefined ? ` data-action-arg="${escapeHtml(item.arg)}"` : "";
  return `
    <button type="button" class="menu-action" data-action="${escapeHtml(item.action)}"${argAttr}>
      <span class="menu-action-label"><i data-lucide="${escapeHtml(item.icon)}" class="ui-icon-sm"></i><span data-i18n="${escapeHtml(item.labelKey)}">${escapeHtml(i18n.t(item.labelKey))}</span></span>
    </button>`;
}

/** Genera el HTML de la barra superior principal. */
export function renderTopBarHtml() {
  return `
    <header id="topBar">
      <div class="topbar-left">
        <button type="button" class="topbar-brand-btn" data-action="showLauncher" data-i18n-title="topbar.home_title" title="${escapeHtml(i18n.t("topbar.home_title"))}">
          <img src="./src/assets/logo.svg" alt="Spritium" width="20" height="20" style="border-radius: 4px; flex-shrink: 0" />
          <h1 class="app-brand-title">Spritium</h1>
        </button>
        <nav id="topMenu" aria-label="Menú principal"></nav>
      </div>

      <div class="topbar-right">
        <input
          type="text"
          id="assetName"
          value="nuevo_proyecto"
          placeholder="nuevo_proyecto"
          data-i18n-title="title.project_name"
          title="${escapeHtml(i18n.t("title.project_name"))}"
          style="width: 135px; padding: 4px 7px; font-size: 11.5px"
        />
        <button id="btnUndo" type="button" class="tool-btn" data-action="undo" data-i18n-title="topbar.undo_title" title="${escapeHtml(i18n.t("topbar.undo_title"))}" style="padding: 4px 7px">
          <i data-lucide="undo-2" class="ui-icon-sm"></i>
        </button>
        <button id="btnRedo" type="button" class="tool-btn" data-action="redo" data-i18n-title="topbar.redo_title" title="${escapeHtml(i18n.t("topbar.redo_title"))}" style="padding: 4px 7px">
          <i data-lucide="redo-2" class="ui-icon-sm"></i>
        </button>
        <input type="file" id="projectFileInput" accept=".spritium" style="display: none" />
        <input type="file" id="fileInput" accept=".png,.jpg,.jpeg,.webp,.gif,.bmp" style="display: none" />
        <input type="file" id="configFileInput" accept=".json" style="display: none" />

        <div class="menu-item" id="topSaveMenuItem">
          <button type="button" class="btn-subtle-success" id="btnTopSaveDropdown" style="font-size: 11px; padding: 4px 9px" data-i18n-title="topbar.save_title" title="${escapeHtml(i18n.t("topbar.save_title"))}">
            <i data-lucide="save" class="ui-icon-sm"></i>
            <span data-i18n="topbar.save">${escapeHtml(i18n.t("topbar.save"))}</span>
            <i data-lucide="chevron-down" class="ui-icon-sm"></i>
          </button>
          <div class="menu-dropdown" style="right: 0; left: auto; min-width: 225px">
            ${renderList(SAVE_MENU_ITEMS, renderSaveMenuItem)}
          </div>
        </div>

        <div class="menu-item" id="topMediaMenuItem">
          <button type="button" class="tool-btn" id="btnTopMediaDropdown" data-action="openLoadedMediaModal" data-i18n-title="topbar.media_title" title="${escapeHtml(i18n.t("topbar.media_title"))}" style="font-size: 11px; padding: 4px 8px">
            <i data-lucide="images" class="ui-icon-sm"></i>
            <span data-i18n="topbar.media">${escapeHtml(i18n.t("topbar.media"))}</span>
          </button>
          <div class="menu-dropdown media-menu-dropdown" id="topMediaDropdown" style="right: 0; left: auto">
            <div class="media-dropdown-header">
              <span id="mediaDropdownTitle" class="media-dropdown-title" data-i18n="topbar.media">${escapeHtml(i18n.t("topbar.media"))}</span>
              <button type="button" class="tool-btn" data-action="openFolderDialog" data-i18n-title="topbar.folder_title" title="${escapeHtml(i18n.t("topbar.folder_title"))}" style="font-size: 10px; padding: 3px 7px">
                <i data-lucide="folder-open" class="ui-icon-sm"></i>
                <span data-i18n="topbar.folder">${escapeHtml(i18n.t("topbar.folder"))}</span>
              </button>
            </div>
            <div id="mediaDropdownGrid" class="media-dropdown-grid"></div>
          </div>
        </div>

        <button type="button" id="btnLangModal" class="tool-btn" data-action="openLanguageModal" data-i18n-title="lang.panel_aria" title="${escapeHtml(i18n.t("lang.panel_aria"))}" style="padding: 4px 7px">
          <i data-lucide="globe" class="ui-icon-sm"></i>
        </button>
        <button type="button" id="btnThemeToggle" class="tool-btn" data-action="toggleColorTheme" data-i18n-title="topbar.theme_title" title="${escapeHtml(i18n.t("topbar.theme_title"))}" style="padding: 4px 7px">
          <i data-lucide="sun" class="ui-icon-sm"></i>
        </button>
        <button type="button" class="tool-btn" data-action="openHelpModal" data-i18n-title="topbar.help_title" title="${escapeHtml(i18n.t("topbar.help_title"))}" style="padding: 4px 7px">
          <i data-lucide="circle-help" class="ui-icon-sm"></i>
        </button>
        <button type="button" class="tool-btn" data-action="showLauncher" data-i18n-title="topbar.home_title" title="${escapeHtml(i18n.t("topbar.home_title"))}" style="padding: 4px 7px">
          <i data-lucide="home" class="ui-icon-sm"></i>
        </button>
      </div>
    </header>
  `;
}

/**
 * Monta `#topBar` dentro de `#topBarMount` si todavía no fue insertado.
 */
export function mountTopBar() {
  const mount = document.getElementById("topBarMount");
  if (!mount) return;
  mount.outerHTML = renderTopBarHtml();
}
