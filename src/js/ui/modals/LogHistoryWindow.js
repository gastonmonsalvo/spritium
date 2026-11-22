// @ts-check
/**
 * LogHistoryWindow.js: Ventana flotante de historial de logs (Time-Travel).
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml } from "../components/uiHtml.js";

/** Genera el HTML de la ventana flotante LogHistory. */
export function renderLogHistoryWindow() {
  return `
    <div id="logHistoryWindow" class="log-history-window" role="dialog" data-i18n-aria-label="logs.window_aria" aria-label="${escapeHtml(i18n.t("logs.window_aria"))}">
      <div class="log-window-header" data-i18n-title="logs.drag_title" title="${escapeHtml(i18n.t("logs.drag_title"))}">
        <span data-i18n="logs.window_title">${escapeHtml(i18n.t("logs.window_title"))}</span>
        <div class="log-window-actions">
          <button type="button" id="btnToggleUiLogs" class="log-history-clear active" aria-pressed="true" data-i18n="logs.toggle_ui" data-i18n-title="logs.toggle_ui_title" data-action="toggleUiLogs" title="${escapeHtml(i18n.t("logs.toggle_ui_title"))}">${escapeHtml(i18n.t("logs.toggle_ui"))}</button>
          <button type="button" class="log-history-clear" data-i18n="feedback.report_short" data-action="openFeedbackModal" data-action-arg="bug">${escapeHtml(i18n.t("feedback.report_short"))}</button>
          <button type="button" class="log-history-clear" data-i18n="logs.clear" data-action="clearLogHistory">${escapeHtml(i18n.t("logs.clear"))}</button>
          <button type="button" class="log-window-close" data-i18n-title="common.close" data-action="closeLogHistory" title="${escapeHtml(i18n.t("common.close"))}">×</button>
        </div>
      </div>
      <div class="log-window-legend" data-i18n="logs.legend">
        ${escapeHtml(i18n.t("logs.legend"))}
      </div>
      <div id="logHistoryList" class="log-history-list">
        <div class="log-history-empty" data-i18n="logs.empty">${escapeHtml(i18n.t("logs.empty"))}</div>
      </div>
    </div>
  `;
}
