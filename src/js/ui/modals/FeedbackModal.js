// @ts-check
/**
 * FeedbackModal.js: Modal nativo de Feedback, Reporte de Bugs y Telemetría Reproducible (Flight Recorder).
 */

import { i18n } from "../../i18n/I18nService.js";
import { escapeHtml } from "../components/uiHtml.js";

/**
 * Genera el HTML del modal de Feedback y Reporte de Bugs (`#feedbackModal`).
 * @returns {string} HTML del modal.
 */
export function renderFeedbackModal() {
  return `
    <div id="feedbackModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="feedbackModalTitle" data-backdrop-close="closeFeedbackModal">
      <div class="modal-card feedback-modal-card">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px; min-width: 0">
            <i data-lucide="message-square-plus" class="ui-icon-sm" style="color: var(--accent-secondary); flex-shrink: 0"></i>
            <h3 id="feedbackModalTitle" data-i18n="feedback.title">${escapeHtml(i18n.t("feedback.title"))}</h3>
          </div>
          <button type="button" class="tool-btn" data-action="closeFeedbackModal" style="padding: 4px 8px; flex-shrink: 0">
            <i data-lucide="x" class="ui-icon-sm"></i>
          </button>
        </div>

        <p class="feedback-subtitle" data-i18n="feedback.subtitle">${escapeHtml(i18n.t("feedback.subtitle"))}</p>

        <!-- Selector de Categoría -->
        <div class="feedback-category-tabs" role="tablist">
          <button type="button" class="feedback-cat-btn active" data-feedback-cat="bug" data-action="setFeedbackCategory" data-action-arg="bug">
            <i data-lucide="bug" class="ui-icon-xs"></i>
            <span data-i18n="feedback.cat_bug">${escapeHtml(i18n.t("feedback.cat_bug"))}</span>
          </button>
          <button type="button" class="feedback-cat-btn" data-feedback-cat="feature" data-action="setFeedbackCategory" data-action-arg="feature">
            <i data-lucide="lightbulb" class="ui-icon-xs"></i>
            <span data-i18n="feedback.cat_feature">${escapeHtml(i18n.t("feedback.cat_feature"))}</span>
          </button>
          <button type="button" class="feedback-cat-btn" data-feedback-cat="ux" data-action="setFeedbackCategory" data-action-arg="ux">
            <i data-lucide="sparkles" class="ui-icon-xs"></i>
            <span data-i18n="feedback.cat_ux">${escapeHtml(i18n.t("feedback.cat_ux"))}</span>
          </button>
          <button type="button" class="feedback-cat-btn" data-feedback-cat="performance" data-action="setFeedbackCategory" data-action-arg="performance">
            <i data-lucide="zap" class="ui-icon-xs"></i>
            <span data-i18n="feedback.cat_perf">${escapeHtml(i18n.t("feedback.cat_perf"))}</span>
          </button>
        </div>

        <div class="feedback-form-body">
          <!-- Campos condicionales: BUG -->
          <div id="feedbackBugFields" class="feedback-conditional-row">
            <div class="feedback-field-col">
              <label for="feedbackSeverity" class="feedback-label" data-i18n="feedback.severity_label">${escapeHtml(i18n.t("feedback.severity_label"))}</label>
              <select id="feedbackSeverity" class="feedback-input">
                <option value="broken" data-i18n="feedback.sev_broken">${escapeHtml(i18n.t("feedback.sev_broken"))}</option>
                <option value="minor" data-i18n="feedback.sev_minor">${escapeHtml(i18n.t("feedback.sev_minor"))}</option>
                <option value="crash" data-i18n="feedback.sev_crash">${escapeHtml(i18n.t("feedback.sev_crash"))}</option>
              </select>
            </div>
            <div class="feedback-field-col">
              <label for="feedbackSteps" class="feedback-label" data-i18n="feedback.steps_label">${escapeHtml(i18n.t("feedback.steps_label"))}</label>
              <input
                type="text"
                id="feedbackSteps"
                class="feedback-input"
                maxlength="220"
                data-i18n-placeholder="feedback.steps_placeholder"
                placeholder="${escapeHtml(i18n.t("feedback.steps_placeholder"))}"
              />
            </div>
          </div>

          <!-- Campos condicionales: MEJORA -->
          <div id="feedbackFeatureFields" class="feedback-conditional-row" style="display: none">
            <div class="feedback-field-col">
              <label for="feedbackArea" class="feedback-label" data-i18n="feedback.area_label">${escapeHtml(i18n.t("feedback.area_label"))}</label>
              <select id="feedbackArea" class="feedback-input">
                <option value="tools" data-i18n="feedback.area_tools">${escapeHtml(i18n.t("feedback.area_tools"))}</option>
                <option value="tilemap" data-i18n="feedback.area_tilemap">${escapeHtml(i18n.t("feedback.area_tilemap"))}</option>
                <option value="timeline" data-i18n="feedback.area_timeline">${escapeHtml(i18n.t("feedback.area_timeline"))}</option>
                <option value="io" data-i18n="feedback.area_io">${escapeHtml(i18n.t("feedback.area_io"))}</option>
                <option value="ui" data-i18n="feedback.area_ui">${escapeHtml(i18n.t("feedback.area_ui"))}</option>
              </select>
            </div>
          </div>

          <!-- Campos condicionales: UX -->
          <div id="feedbackUxFields" class="feedback-conditional-row" style="display: none">
            <div class="feedback-field-col">
              <label class="feedback-label" data-i18n="feedback.rating_label">${escapeHtml(i18n.t("feedback.rating_label"))}</label>
              <div id="feedbackRatingBtns" class="feedback-rating-bar" role="radiogroup">
                ${[1, 2, 3, 4, 5]
                  .map(
                    (n) => `
                  <button
                    type="button"
                    class="feedback-rate-btn is-filled${n === 5 ? " active" : ""}"
                    data-rate="${n}"
                    data-action="setFeedbackRating"
                    data-action-arg="${n}"
                    aria-label="${n} / 5"
                  >
                    <svg viewBox="0 0 24 24" class="feedback-star-svg" aria-hidden="true">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>`,
                  )
                  .join("")}
              </div>
            </div>
          </div>

          <!-- Resumen / Título -->
          <div class="feedback-field-col">
            <label for="feedbackTitle" class="feedback-label" data-i18n="feedback.summary_label">${escapeHtml(i18n.t("feedback.summary_label"))}</label>
            <input
              type="text"
              id="feedbackTitle"
              class="feedback-input"
              maxlength="140"
              data-i18n-placeholder="feedback.summary_placeholder_bug"
              placeholder="${escapeHtml(i18n.t("feedback.summary_placeholder_bug"))}"
            />
          </div>

          <!-- Descripción detallada -->
          <div class="feedback-field-col">
            <label for="feedbackMessage" class="feedback-label" data-i18n="feedback.details_label">${escapeHtml(i18n.t("feedback.details_label"))}</label>
            <textarea
              id="feedbackMessage"
              class="feedback-textarea"
              rows="3"
              maxlength="2500"
              data-i18n-placeholder="feedback.details_placeholder_bug"
              placeholder="${escapeHtml(i18n.t("feedback.details_placeholder_bug"))}"
            ></textarea>
          </div>

          <!-- Contacto opcional (Discord / GitHub / Email) -->
          <div class="feedback-field-col">
            <label for="feedbackContact" class="feedback-label" data-i18n="feedback.contact_label">${escapeHtml(i18n.t("feedback.contact_label"))}</label>
            <input
              type="text"
              id="feedbackContact"
              class="feedback-input"
              maxlength="120"
              data-i18n-placeholder="feedback.contact_placeholder"
              placeholder="${escapeHtml(i18n.t("feedback.contact_placeholder"))}"
            />
          </div>

          <!-- Honeypot anti-bots oculto -->
          <input type="text" id="feedbackWebsiteHoneypot" tabindex="-1" autocomplete="off" style="display: none !important" />

          <!-- Caja Negra (Flight Recorder) y Telemetría Transparente -->
          <div class="feedback-telemetry-card">
            <div class="feedback-telemetry-header">
              <label class="feedback-check-row">
                <input type="checkbox" id="feedbackIncludeTelemetry" checked data-change="refreshFeedbackTelemetryPreview" />
                <span data-i18n="feedback.attach_telemetry">${escapeHtml(i18n.t("feedback.attach_telemetry"))}</span>
              </label>
              <button type="button" class="feedback-inspect-btn" data-action="toggleFeedbackTelemetryPreview">
                <i data-lucide="terminal" class="ui-icon-xs"></i>
                <span data-i18n="feedback.inspect_btn">${escapeHtml(i18n.t("feedback.inspect_btn"))}</span>
              </button>
            </div>

            <div class="feedback-telemetry-meta">
              <span id="feedbackTelemetrySummaryBadge" class="feedback-telemetry-badge">64×64 px · 1 layer · 0 steps</span>
              <label class="feedback-check-row feedback-snapshot-check">
                <input type="checkbox" id="feedbackIncludeSnapshot" data-change="refreshFeedbackTelemetryPreview" />
                <span data-i18n="feedback.attach_snapshot">${escapeHtml(i18n.t("feedback.attach_snapshot"))}</span>
              </label>
            </div>

            <div id="feedbackTelemetryPreviewBox" class="feedback-telemetry-preview" style="display: none">
              <pre id="feedbackTelemetryJson"></pre>
            </div>

            <!-- Herramientas de exportación manual de diagnóstico -->
            <div class="feedback-telemetry-tools">
              <button
                type="button"
                class="tool-btn feedback-action-chip"
                data-action="downloadFeedbackDiagnosticBundle"
                data-i18n-title="feedback.download_bundle_title"
                title="${escapeHtml(i18n.t("feedback.download_bundle_title"))}"
              >
                <i data-lucide="package-check" class="ui-icon-xs"></i>
                <span data-i18n="feedback.download_bundle">${escapeHtml(i18n.t("feedback.download_bundle"))}</span>
              </button>
              <button
                type="button"
                class="tool-btn feedback-action-chip"
                data-action="copyFeedbackReportMarkdown"
                data-i18n-title="feedback.copy_md_title"
                title="${escapeHtml(i18n.t("feedback.copy_md_title"))}"
              >
                <i data-lucide="copy" class="ui-icon-xs"></i>
                <span data-i18n="feedback.copy_md">${escapeHtml(i18n.t("feedback.copy_md"))}</span>
              </button>
              <button
                type="button"
                class="tool-btn feedback-action-chip"
                data-action="openFeedbackGithubIssue"
                data-i18n-title="feedback.github_title"
                title="${escapeHtml(i18n.t("feedback.github_title"))}"
              >
                <i data-lucide="external-link" class="ui-icon-xs"></i>
                <span>GitHub Issue</span>
              </button>
            </div>
          </div>

          <!-- Banner de estado interno del modal -->
          <div id="feedbackModalAlert" class="feedback-modal-alert" style="display: none"></div>
        </div>

        <div class="modal-actions feedback-modal-actions">
          <button type="button" class="tool-btn" data-action="closeFeedbackModal" data-i18n="opt.cancel">${escapeHtml(i18n.t("opt.cancel"))}</button>
          <button type="button" id="feedbackSubmitBtn" class="btn-primary feedback-submit-btn" data-action="submitFeedbackReport">
            <i data-lucide="send" class="ui-icon-xs"></i>
            <span data-i18n="feedback.send_btn">${escapeHtml(i18n.t("feedback.send_btn"))}</span>
          </button>
        </div>
      </div>
    </div>
  `;
}
