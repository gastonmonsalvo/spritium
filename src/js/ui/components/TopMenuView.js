// @ts-check
/**
 * TopMenuView.js: Renderizador declarativo de la barra de menú superior a partir de `TopMenuConfig.js`.
 */

import { i18n } from "../../i18n/I18nService.js";
import { TOP_MENU_ITEMS } from "./TopMenuConfig.js";
import { escapeHtml, renderList } from "./uiHtml.js";

function renderExtraAttrs(attrs) {
  if (!attrs) return "";
  return Object.entries(attrs)
    .map(([key, val]) => ` ${key}="${escapeHtml(val)}"`)
    .join("");
}

function renderActionAttr(item) {
  let out = ` data-action="${escapeHtml(item.action)}"`;
  if (item.args !== undefined) {
    out += ` data-action-args='${JSON.stringify(item.args)}'`;
  } else if (item.arg !== undefined) {
    out += ` data-action-arg="${escapeHtml(item.arg)}"`;
  }
  return out;
}

const DISCORD_SVG_ICON = `<svg class="ui-icon-sm" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`;

function renderMenuLabel(item) {
  const iconHtml =
    item.icon === "discord"
      ? DISCORD_SVG_ICON
      : item.icon
        ? `<i data-lucide="${escapeHtml(item.icon)}" class="ui-icon-sm"></i>`
        : "";
  if (item.labelKey) {
    const labelText = escapeHtml(i18n.t(item.labelKey));
    return item.icon
      ? `<span class="menu-action-label">${iconHtml}<span data-i18n="${escapeHtml(item.labelKey)}">${labelText}</span></span>`
      : `<span class="menu-action-label" data-i18n="${escapeHtml(item.labelKey)}">${labelText}</span>`;
  }
  return `<span class="menu-action-label">${iconHtml}${escapeHtml(item.labelText || "")}</span>`;
}

function renderMenuEntry(item) {
  if (item.divider) return `<div class="menu-divider"></div>`;

  if (item.submenu) {
    const badgeId = item.badgeId ? ` id="${escapeHtml(item.badgeId)}"` : "";
    const badgeText = escapeHtml(item.badgeText || "▸");
    return `
      <div class="menu-submenu-item">
        <button type="button" class="menu-action" aria-haspopup="true">
          ${renderMenuLabel(item)}
          <span${badgeId} class="menu-shortcut">${badgeText}</span>
        </button>
        <div class="menu-submenu">
          ${renderList(item.submenu, renderMenuEntry)}
        </div>
      </div>`;
  }

  if (item.href) {
    return `
      <a href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer" class="menu-action" style="text-decoration: none">
        ${renderMenuLabel(item)}
      </a>`;
  }

  const idAttr = item.id ? ` id="${escapeHtml(item.id)}"` : "";
  const activeClass = item.active ? " active" : "";
  const shortcutHtml = item.shortcut
    ? `<span class="menu-shortcut">${escapeHtml(item.shortcut)}</span>`
    : "";

  return `
    <button type="button"${idAttr} class="menu-action${activeClass}"${renderActionAttr(item)}${renderExtraAttrs(item.attrs)}>
      ${renderMenuLabel(item)}
      ${shortcutHtml}
    </button>`;
}

function renderTopMenuItem(menu) {
  return `
    <div class="menu-item">
      <button type="button" class="menu-trigger" data-i18n="${escapeHtml(menu.triggerKey)}">${escapeHtml(i18n.t(menu.triggerKey))}</button>
      <div class="menu-dropdown">
        ${renderList(menu.items, renderMenuEntry)}
      </div>
    </div>`;
}

/**
 * Monta en `#topMenu` la barra de menú superior declarativa.
 */
export function mountTopMenu() {
  const mount = document.getElementById("topMenu");
  if (!mount || mount.dataset.mounted === "true") return;
  mount.innerHTML = renderList(TOP_MENU_ITEMS, renderTopMenuItem);
  mount.dataset.mounted = "true";
}
