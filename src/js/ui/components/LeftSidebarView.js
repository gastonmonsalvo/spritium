// @ts-check
/**
 * LeftSidebarView.js: Panel lateral izquierdo (Herramientas, Opciones, Tileset, Simetría, Transformaciones, Zoom y Logs).
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml } from "./uiHtml.js";
import { renderToolsModule, renderTilesetModule, renderUtilityModules } from "./LeftSidebarSections.js";

function tAttr(key) {
  return escapeHtml(i18n.t(key));
}

/** Genera el HTML completo del panel lateral izquierdo. */
export function renderLeftSidebarHtml() {
  return `
    <div id="sidebar">
      <div class="panel-header-row" style="padding: 0 2px">
        <label data-i18n="panel.left" style="margin: 0; font-size: 10px; color: var(--text-dim)">${tAttr("panel.left")}</label>
        <button type="button" id="btnCollapseLeft" class="tool-btn" style="padding: 3px 6px; font-size: 11px" data-i18n-title="panel.left_hide" title="${tAttr("panel.left_hide")}">
          <i data-lucide="panel-left-close" class="ui-icon-sm"></i>
        </button>
      </div>
      ${renderToolsModule()}
      ${renderTilesetModule()}
      ${renderUtilityModules()}
    </div>
  `;
}

/**
 * Monta `#sidebar` en `#leftSidebarMount` si todavía no fue insertado.
 */
export function mountLeftSidebar() {
  const mount = document.getElementById("leftSidebarMount");
  if (!mount) return;
  mount.outerHTML = renderLeftSidebarHtml();
}
