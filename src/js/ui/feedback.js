// @ts-check
/**
 * feedback.js: Controlador del sistema de Feedback, Reporte de Bugs, exportación de paquetes
 * reproducibles (`.spritium`) y envío Serverless (Google Apps Script -> Google Sheets + Discord + GitHub).
 */

import { buildDiagnosticReport } from "../core/flightRecorder.js";
import { buildCurrentProjectSnapshot } from "../core/storage.js";
import { i18n } from "../i18n/I18nService.js";
import { setStatus, refreshIcons } from "./status.js";

/**
 * Configuración del canal Serverless de Feedback.
 * Cuando despliegues `scripts/feedback-webhook-gas.js` en Google Apps Script,
 * pega aquí la URL del Web App (`https://script.google.com/macros/s/.../exec`)
 * o guárdala dinámicamente en `localStorage.setItem("spritium_feedback_webhook_url", url)`.
 */
export const FEEDBACK_CHANNEL_CONFIG = {
  webhookUrl:
    "https://script.google.com/macros/s/AKfycbzsfa9YGCdAvw308W2NjcSTUnzv9FBCO_tcAPsEWBkJIRW5DoxI1SjpfVWel3T6vqe4/exec",
  githubRepo: "gastonmonsalvo/spritium",
  cooldownMs: 30_000,
};

export const FEEDBACK_WEBHOOK_STORAGE_KEY = "spritium_feedback_webhook_url";
const FEEDBACK_LAST_SENT_KEY = "spritium_feedback_last_sent_at";

let activeCategory = "bug";
let activeRating = 5;
let isTelemetryPreviewOpen = false;

function getResolvedWebhookUrl() {
  try {
    const customUrl = typeof localStorage !== "undefined" ? localStorage.getItem(FEEDBACK_WEBHOOK_STORAGE_KEY) : "";
    if (customUrl && /^https?:\/\//i.test(customUrl.trim())) {
      return customUrl.trim();
    }
  } catch {
    // Ignorar errores de acceso a localStorage
  }
  return (FEEDBACK_CHANNEL_CONFIG.webhookUrl || "").trim();
}

function showModalAlert(message, type = "info") {
  const el = document.getElementById("feedbackModalAlert");
  if (!el) return;
  if (!message) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.style.display = "block";
  el.className = `feedback-modal-alert feedback-alert--${type}`;
  el.textContent = message;
}

/**
 * Abre el modal de Feedback y Reporte de Bugs sincronizando la telemetría de la Caja Negra.
 * @param {"bug"|"feature"|"ux"|"performance"|Event} [initialCategory="bug"] - Categoría inicial a mostrar.
 */
export function openFeedbackModal(initialCategory = "bug") {
  const modal = document.getElementById("feedbackModal");
  if (!modal) return;

  const cat =
    typeof initialCategory === "string" && ["bug", "feature", "ux", "performance"].includes(initialCategory)
      ? initialCategory
      : "bug";

  setFeedbackCategory(cat);
  showModalAlert("");
  refreshFeedbackTelemetryPreview();
  modal.classList.add("open");
  refreshIcons(modal);

  const titleInput = /** @type {HTMLInputElement | null} */ (document.getElementById("feedbackTitle"));
  titleInput?.focus?.();
}

/**
 * Cierra el modal de Feedback y Reporte de Bugs.
 */
export function closeFeedbackModal() {
  document.getElementById("feedbackModal")?.classList.remove("open");
  showModalAlert("");
}

/**
 * Cambia la pestaña de categoría activa en el modal de Feedback (`bug`, `feature`, `ux`, `performance`).
 * @param {"bug"|"feature"|"ux"|"performance"|string} category - Identificador de categoría.
 */
export function setFeedbackCategory(category) {
  const next = ["bug", "feature", "ux", "performance"].includes(String(category))
    ? String(category)
    : "bug";
  activeCategory = next;

  document.querySelectorAll("#feedbackModal [data-feedback-cat]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-feedback-cat") === next);
  });

  const bugRow = document.getElementById("feedbackBugFields");
  const featRow = document.getElementById("feedbackFeatureFields");
  const uxRow = document.getElementById("feedbackUxFields");
  if (bugRow) bugRow.style.display = next === "bug" ? "grid" : "none";
  if (featRow) featRow.style.display = next === "feature" ? "grid" : "none";
  if (uxRow) uxRow.style.display = next === "ux" ? "grid" : "none";

  const summaryKeyMap = {
    bug: "feedback.summary_placeholder_bug",
    feature: "feedback.summary_placeholder_feature",
    ux: "feedback.summary_placeholder_ux",
    performance: "feedback.summary_placeholder_performance",
  };
  const detailsKeyMap = {
    bug: "feedback.details_placeholder_bug",
    feature: "feedback.details_placeholder_feature",
    ux: "feedback.details_placeholder_ux",
    performance: "feedback.details_placeholder_performance",
  };

  const titleInput = /** @type {HTMLInputElement | null} */ (document.getElementById("feedbackTitle"));
  const msgInput = /** @type {HTMLTextAreaElement | null} */ (document.getElementById("feedbackMessage"));
  const sumKey = summaryKeyMap[next] || "feedback.summary_placeholder_bug";
  const detKey = detailsKeyMap[next] || "feedback.details_placeholder_bug";

  if (titleInput) {
    titleInput.setAttribute("data-i18n-placeholder", sumKey);
    titleInput.placeholder = i18n.t(sumKey);
  }
  if (msgInput) {
    msgInput.setAttribute("data-i18n-placeholder", detKey);
    msgInput.placeholder = i18n.t(detKey);
  }

  refreshFeedbackTelemetryPreview();
}

/**
 * Selecciona la calificación de experiencia de usuario (1 a 5 estrellas).
 * @param {number|string} rating - Puntaje entre 1 y 5.
 */
export function setFeedbackRating(rating) {
  const num = Math.max(1, Math.min(5, Number(rating) || 5));
  activeRating = num;
  document.querySelectorAll("#feedbackRatingBtns [data-rate]").forEach((btn) => {
    const btnRate = Number(btn.getAttribute("data-rate"));
    btn.classList.toggle("active", btnRate === num);
    btn.classList.toggle("is-filled", btnRate <= num);
  });
  refreshFeedbackTelemetryPreview();
}

/**
 * Alterna la visibilidad del inspector en vivo del JSON de diagnóstico técnico.
 */
export function toggleFeedbackTelemetryPreview() {
  isTelemetryPreviewOpen = !isTelemetryPreviewOpen;
  const box = document.getElementById("feedbackTelemetryPreviewBox");
  if (box) {
    box.style.display = isTelemetryPreviewOpen ? "block" : "none";
  }
  if (isTelemetryPreviewOpen) {
    refreshFeedbackTelemetryPreview();
  }
}

/**
 * Recolecta los datos del formulario y la traza de la Caja Negra en un payload unificado.
 * @param {{ forceIncludeSnapshot?: boolean }} [options]
 * @returns {Record<string, any>} Payload completo del reporte.
 */
export function buildFeedbackSubmissionPayload({ forceIncludeSnapshot = false } = {}) {
  const doc = typeof document !== "undefined" ? document : null;
  const titleEl = /** @type {HTMLInputElement | null} */ (doc?.getElementById("feedbackTitle") || null);
  const msgEl = /** @type {HTMLTextAreaElement | null} */ (doc?.getElementById("feedbackMessage") || null);
  const contactEl = /** @type {HTMLInputElement | null} */ (doc?.getElementById("feedbackContact") || null);
  const sevEl = /** @type {HTMLSelectElement | null} */ (doc?.getElementById("feedbackSeverity") || null);
  const stepsEl = /** @type {HTMLInputElement | null} */ (doc?.getElementById("feedbackSteps") || null);
  const areaEl = /** @type {HTMLSelectElement | null} */ (doc?.getElementById("feedbackArea") || null);
  const telCheck = /** @type {HTMLInputElement | null} */ (doc?.getElementById("feedbackIncludeTelemetry") || null);
  const snapCheck = /** @type {HTMLInputElement | null} */ (doc?.getElementById("feedbackIncludeSnapshot") || null);
  const honeypotEl = /** @type {HTMLInputElement | null} */ (doc?.getElementById("feedbackWebsiteHoneypot") || null);

  const includeTelemetry = telCheck ? Boolean(telCheck.checked) : true;
  const includeSnapshot = forceIncludeSnapshot || (snapCheck ? Boolean(snapCheck.checked) : false);
  const diagnostics = includeTelemetry ? buildDiagnosticReport() : null;

  return {
    reportId: `SPR-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    category: activeCategory,
    title: (titleEl?.value || "").trim(),
    description: (msgEl?.value || "").trim(),
    contact: (contactEl?.value || "").trim() || null,
    severity: activeCategory === "bug" ? (sevEl?.value || "broken") : null,
    stepsBeforeBug: activeCategory === "bug" ? (stepsEl?.value || "").trim() : null,
    featureArea: activeCategory === "feature" ? (areaEl?.value || "tools") : null,
    uxRating: activeCategory === "ux" ? activeRating : null,
    honeypot: (honeypotEl?.value || "").trim(),
    includeTelemetry,
    includeSnapshot,
    diagnostics,
    projectSnapshot: includeSnapshot ? buildCurrentProjectSnapshot("diag_snapshot") : null,
  };
}

/**
 * Actualiza el badge de resumen técnico y el inspector JSON en el modal de Feedback.
 */
export function refreshFeedbackTelemetryPreview() {
  const diag = buildDiagnosticReport();
  const badge = document.getElementById("feedbackTelemetrySummaryBadge");
  if (badge) {
    const res = `${diag.workspace.resolution.width}×${diag.workspace.resolution.height}px`;
    const layers = diag.workspace.totalLayers;
    const steps = diag.breadcrumbs.length;
    const errs = diag.errors.length;
    badge.textContent = i18n.t("feedback.telemetry_badge", {
      res,
      layers,
      steps,
      errors: errs,
    });
  }

  const pre = document.getElementById("feedbackTelemetryJson");
  if (pre && isTelemetryPreviewOpen) {
    const payload = buildFeedbackSubmissionPayload({ forceIncludeSnapshot: false });
    const previewCopy = {
      ...payload,
      projectSnapshot: payload.includeSnapshot ? "[.spritium snapshot attached]" : null,
    };
    pre.textContent = JSON.stringify(previewCopy, null, 2);
  }
}

/**
 * Formatea un payload de Feedback en Markdown legible para GitHub Issues o Discord.
 * @param {Record<string, any>} payload - Payload construido por `buildFeedbackSubmissionPayload`.
 * @returns {string} Documento en formato Markdown.
 */
export function formatFeedbackAsMarkdown(payload) {
  const lines = [
    `## [${String(payload.category || "bug").toUpperCase()}] ${payload.title || "Spritium Feedback"}`,
    `- **ID:** \`${payload.reportId}\``,
    `- **Version:** \`v${payload.diagnostics?.appVersion || "unknown"}\``,
    `- **Device:** ${payload.diagnostics?.environment?.device?.label || "unknown"} (${payload.diagnostics?.environment?.viewport || "?"})`,
    `- **Date:** ${payload.createdAt}`,
  ];

  if (payload.category === "bug") {
    lines.push(`- **Severity:** \`${payload.severity || "broken"}\``);
    if (payload.stepsBeforeBug) {
      lines.push(`- **Action right before bug:** ${payload.stepsBeforeBug}`);
    }
  } else if (payload.category === "feature") {
    lines.push(`- **Area:** \`${payload.featureArea || "tools"}\``);
  } else if (payload.category === "ux") {
    lines.push(`- **UX Rating:** ${payload.uxRating || 5} / 5 ★`);
  }

  if (payload.contact) {
    lines.push(`- **Contact:** ${payload.contact}`);
  }

  lines.push("", "### Description", payload.description || "_No additional description_");

  if (payload.diagnostics) {
    const ws = payload.diagnostics.workspace;
    const env = payload.diagnostics.environment;
    lines.push(
      "",
      "### Workspace & Environment Telemetry",
      `- **Resolution:** \`${ws.resolution.width}x${ws.resolution.height}\` (Zoom: \`${ws.zoom}x\`)`,
      `- **Tool:** \`${ws.currentTool}\` (Brush: \`${ws.brushSize}px\`)`,
      `- **Layers:** \`${ws.totalLayers}\` (Active: \`#${ws.activeLayerIndex}\`) · **Frames:** \`${ws.totalFrames}\``,
      `- **History:** Undo \`${ws.history.undoDepth}\` / Redo \`${ws.history.redoDepth}\` (ActionId: \`${ws.history.currentActionId}\`)`,
      `- **Environment:** \`${env.viewport}\` · DPR \`${env.devicePixelRatio}\` · Theme \`${env.colorTheme}\` · Lang \`${env.language}\``,
    );

    const recentSteps = (payload.diagnostics.breadcrumbs || []).slice(-15);
    if (recentSteps.length > 0) {
      lines.push("", "### Flight Recorder (Last 15 Actions)", "```text");
      for (const b of recentSteps) {
        const timeShort = String(b.time || "").slice(11, 19);
        const rep = b.repeatCount > 1 ? ` (x${b.repeatCount})` : "";
        lines.push(
          `[${timeShort}] #${b.seq} ${b.action}${b.details ? ` (${b.details})` : ""}${rep} -> res:${b.ctx.res} layer:${b.ctx.layerIdx}[${b.ctx.layerType}]`,
        );
      }
      lines.push("```");
    }

    const errs = payload.diagnostics.errors || [];
    if (errs.length > 0) {
      lines.push("", "### Captured Runtime Errors", "```json", JSON.stringify(errs, null, 2), "```");
    }
  }

  return lines.join("\n");
}

/**
 * Copia el reporte completo en formato Markdown al portapapeles para pegarlo en Discord o GitHub.
 * @returns {Promise<boolean>} `true` si se copió con éxito.
 */
export async function copyFeedbackReportMarkdown() {
  const payload = buildFeedbackSubmissionPayload();
  const md = formatFeedbackAsMarkdown(payload);
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(md);
    }
    showModalAlert(i18n.t("feedback.copied_ok"), "success");
    setStatus({ key: "feedback.copied_ok" });
    return true;
  } catch {
    showModalAlert(i18n.t("feedback.copy_err"), "error");
    return false;
  }
}

/**
 * Descarga un paquete `.spritium` reproducible que contiene tanto el proyecto actual
 * como el bloque `_diagnostics` con el reporte, telemetría y traza del Flight Recorder.
 * Puede abrirse directamente en Spritium con `Archivo -> Abrir Proyecto (.spritium)`.
 * @returns {Record<string, any>} Objeto del paquete exportado.
 */
export function downloadFeedbackDiagnosticBundle() {
  const payload = buildFeedbackSubmissionPayload({ forceIncludeSnapshot: true });
  const baseProject = payload.projectSnapshot || buildCurrentProjectSnapshot("bug_repro");
  const bundle = {
    ...baseProject,
    name: `${baseProject.name || "spritium"}_${payload.reportId.toLowerCase()}`,
    _diagnostics: {
      reportId: payload.reportId,
      createdAt: payload.createdAt,
      category: payload.category,
      title: payload.title,
      description: payload.description,
      contact: payload.contact,
      severity: payload.severity,
      stepsBeforeBug: payload.stepsBeforeBug,
      featureArea: payload.featureArea,
      uxRating: payload.uxRating,
      telemetry: payload.diagnostics,
    },
  };

  if (typeof document !== "undefined" && typeof Blob !== "undefined" && typeof URL !== "undefined") {
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${bundle.name}.spritium`;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  showModalAlert(i18n.t("feedback.bundle_downloaded"), "success");
  setStatus({ key: "feedback.bundle_downloaded" });
  return bundle;
}

/**
 * Abre una pestaña de GitHub Issues con el título, etiqueta y cuerpo Markdown pre-poblados.
 * @returns {string} URL de GitHub Issues generada.
 */
export function openFeedbackGithubIssue() {
  const payload = buildFeedbackSubmissionPayload();
  const labelMap = {
    bug: "bug",
    feature: "enhancement",
    ux: "ux",
    performance: "performance",
  };
  const label = labelMap[payload.category] || "feedback";
  const issueTitle = payload.title
    ? `[${payload.category.toUpperCase()}] ${payload.title}`
    : `[${payload.category.toUpperCase()}] Spritium Feedback (${payload.reportId})`;
  const body = formatFeedbackAsMarkdown(payload);

  const url = `https://github.com/${FEEDBACK_CHANNEL_CONFIG.githubRepo}/issues/new?title=${encodeURIComponent(
    issueTitle,
  )}&labels=${encodeURIComponent(label)}&body=${encodeURIComponent(body)}`;

  if (typeof window !== "undefined" && typeof window.open === "function") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return url;
}

/**
 * Valida y envía el reporte al Webhook Serverless configurado (Google Apps Script -> Sheets + Discord + GitHub).
 * Si el webhook aún no está configurado, copia el reporte y descarga el paquete reproducible como respaldo.
 * @returns {Promise<{ ok: boolean, mode: string }>} Resultado del envío.
 */
export async function submitFeedbackReport() {
  const payload = buildFeedbackSubmissionPayload();

  if (payload.honeypot) {
    closeFeedbackModal();
    return { ok: false, mode: "honeypot" };
  }

  if (!payload.title && !payload.description) {
    showModalAlert(i18n.t("feedback.err_empty"), "error");
    return { ok: false, mode: "validation" };
  }

  try {
    const lastSent = Number(typeof localStorage !== "undefined" ? localStorage.getItem(FEEDBACK_LAST_SENT_KEY) : 0);
    if (lastSent && Date.now() - lastSent < FEEDBACK_CHANNEL_CONFIG.cooldownMs) {
      const waitSec = Math.ceil((FEEDBACK_CHANNEL_CONFIG.cooldownMs - (Date.now() - lastSent)) / 1000);
      showModalAlert(i18n.t("feedback.err_cooldown", { sec: waitSec }), "error");
      return { ok: false, mode: "cooldown" };
    }
  } catch {
    // Ignorar si localStorage no está disponible
  }

  const webhookUrl = getResolvedWebhookUrl();
  if (!webhookUrl) {
    await copyFeedbackReportMarkdown();
    showModalAlert(i18n.t("feedback.webhook_not_configured"), "info");
    return { ok: true, mode: "local_clipboard_fallback" };
  }

  const submitBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById("feedbackSubmitBtn"));
  if (submitBtn) submitBtn.disabled = true;
  showModalAlert(i18n.t("feedback.sending"), "info");

  try {
    await fetch(webhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        ...payload,
        markdown: formatFeedbackAsMarkdown(payload),
      }),
    });

    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(FEEDBACK_LAST_SENT_KEY, String(Date.now()));
      }
    } catch {
      // Ignorar errores de cuota
    }

    const titleEl = /** @type {HTMLInputElement | null} */ (document.getElementById("feedbackTitle"));
    const msgEl = /** @type {HTMLTextAreaElement | null} */ (document.getElementById("feedbackMessage"));
    const stepsEl = /** @type {HTMLInputElement | null} */ (document.getElementById("feedbackSteps"));
    if (titleEl) titleEl.value = "";
    if (msgEl) msgEl.value = "";
    if (stepsEl) stepsEl.value = "";

    showModalAlert(i18n.t("feedback.sent_ok", { id: payload.reportId }), "success");
    setStatus({ key: "feedback.sent_ok", params: { id: payload.reportId } });
    return { ok: true, mode: "webhook" };
  } catch (err) {
    showModalAlert(i18n.t("feedback.send_err"), "error");
    return { ok: false, mode: "network_error" };
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}
