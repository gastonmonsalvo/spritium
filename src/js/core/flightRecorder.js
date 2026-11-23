// @ts-check
/**
 * flightRecorder.js: Caja Negra (Flight Recorder) en memoria con Ring Buffer circular.
 * Registra las últimas acciones de UI, ediciones de píxeles, cambios de historial y
 * excepciones en tiempo de ejecución para garantizar la reproducibilidad de bugs sin backend.
 */

import { state, subscribe } from "./state.js";
import { APP_VERSION, APP_CHANNEL } from "./version.js";
import {
  getCompactWorkspaceContextCore,
  detectDeviceProfileCore,
  buildDiagnosticReportCore,
} from "./flightRecorderCore.js";

export const MAX_FLIGHT_BREADCRUMBS = 40;
export const MAX_CAPTURED_ERRORS = 15;

/** @type {Array<Record<string, any>>} */
const breadcrumbs = [];

/** @type {Array<Record<string, any>>} */
const capturedErrors = [];

let recorderInitialized = false;
let nextStepSeq = 1;

function getCompactWorkspaceContext() {
  return getCompactWorkspaceContextCore(state);
}

/**
 * Registra un paso cronológico (breadcrumb) en el Ring Buffer de la Caja Negra.
 * Si la acción es de alta frecuencia (`input`) y coincide con el último paso, la fusiona.
 * @param {string} actionName - Identificador de la acción o evento ejecutado.
 * @param {string} [details=""] - Argumentos o metadatos resumidos de la acción.
 * @param {"action"|"input"|"pixel"|"history"|"system"} [kind="action"] - Categoría del evento.
 * @returns {Record<string, any>} Entrada registrada o actualizada.
 */
export function recordActionBreadcrumb(actionName, details = "", kind = "action") {
  const cleanAction = String(actionName || "unknown").trim();
  const cleanDetails = String(details ?? "").trim().slice(0, 140);
  const nowIso = new Date().toISOString();
  const ctx = getCompactWorkspaceContext();

  const last = breadcrumbs[breadcrumbs.length - 1];
  if (
    last &&
    kind === "input" &&
    last.kind === "input" &&
    last.action === cleanAction
  ) {
    last.time = nowIso;
    last.details = cleanDetails;
    last.repeatCount = (last.repeatCount || 1) + 1;
    last.ctx = ctx;
    return last;
  }

  const entry = {
    seq: nextStepSeq++,
    time: nowIso,
    kind,
    action: cleanAction,
    details: cleanDetails,
    repeatCount: 1,
    ctx,
  };

  breadcrumbs.push(entry);
  if (breadcrumbs.length > MAX_FLIGHT_BREADCRUMBS) {
    breadcrumbs.shift();
  }
  return entry;
}

/**
 * Registra un error de ejecución o de validación de UI en el buffer de errores recientes.
 * @param {string} message - Mensaje descriptivo del error.
 * @param {Record<string, any>} [meta={}] - Información de stack, archivo o contexto.
 * @returns {Record<string, any> | null} Entrada de error registrada.
 */
export function recordCapturedError(message, meta = {}) {
  const cleanMsg = String(message || "").trim();
  if (!cleanMsg) return null;

  const entry = {
    time: new Date().toISOString(),
    message: cleanMsg.slice(0, 400),
    source: meta.source || "app",
    stack: meta.stack ? String(meta.stack).slice(0, 800) : undefined,
    location: meta.location || undefined,
    ctx: getCompactWorkspaceContext(),
  };

  capturedErrors.push(entry);
  if (capturedErrors.length > MAX_CAPTURED_ERRORS) {
    capturedErrors.shift();
  }
  return entry;
}

/**
 * Devuelve una copia superficial de la traza cronológica de pasos recientes.
 * @returns {Array<Record<string, any>>} Lista ordenada desde el paso más antiguo al más reciente.
 */
export function getFlightBreadcrumbs() {
  return breadcrumbs.map((b) => ({ ...b, ctx: { ...b.ctx } }));
}

/**
 * Devuelve una copia superficial de los errores capturados durante la sesión.
 * @returns {Array<Record<string, any>>} Lista de errores capturados.
 */
export function getCapturedErrors() {
  return capturedErrors.map((e) => ({ ...e, ctx: { ...e.ctx } }));
}

/**
 * Limpia los buffers de pasos y errores de la Caja Negra (útil en tests y reinicios).
 */
export function clearFlightRecorder() {
  breadcrumbs.length = 0;
  capturedErrors.length = 0;
  nextStepSeq = 1;
}

/**
 * Inicializa los listeners globales de la Caja Negra para cambios de lienzo, historial y excepciones.
 */
export function initFlightRecorder() {
  if (recorderInitialized) return;
  recorderInitialized = true;

  recordActionBreadcrumb("app:boot", "FlightRecorder active", "system");

  subscribe("dirty", () => {
    recordActionBreadcrumb(
      `canvas:dirty`,
      `tool=${state.currentTool || "pencil"} brush=${state.brushSize || 1}`,
      "pixel",
    );
  });

  subscribe("history", () => {
    recordActionBreadcrumb(
      "history:transition",
      `undo=${state.undoStack?.length || 0} redo=${state.redoStack?.length || 0} actionId=${state.currentHistoryActionId ?? 0}`,
      "history",
    );
  });

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("error", (ev) => {
      recordCapturedError(ev?.message || "Uncaught window error", {
        source: "window.onerror",
        location: ev?.filename ? `${ev.filename}:${ev.lineno || 0}:${ev.colno || 0}` : undefined,
        stack: ev?.error?.stack,
      });
    });

    window.addEventListener("unhandledrejection", (ev) => {
      const reason = ev?.reason;
      const msg = reason instanceof Error ? reason.message : String(reason || "Unhandled Promise rejection");
      recordCapturedError(msg, {
        source: "unhandledrejection",
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    });
  }
}

export function buildDiagnosticReport({ includeBreadcrumbs = true, includeErrors = true } = {}) {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const win = typeof window !== "undefined" ? window : null;
  const docEl = typeof document !== "undefined" ? document.documentElement : null;
  const perfMem = /** @type {any} */ (typeof performance !== "undefined" ? performance : null)?.memory;

  const environment = {
    device: detectDeviceProfileCore(nav, win, state.lastPointerType),
    userAgent: nav?.userAgent || "unknown",
    language: docEl?.lang || nav?.language || "es",
    viewport: win ? `${win.innerWidth || 0}x${win.innerHeight || 0}` : "headless",
    devicePixelRatio: win?.devicePixelRatio || 1,
    colorTheme: typeof document !== "undefined" && document.body?.classList?.contains("theme-light") ? "light" : "dark",
    jsHeapUsedMB: perfMem?.usedJSHeapSize ? Math.round((perfMem.usedJSHeapSize / (1024 * 1024)) * 10) / 10 : null,
  };

  return buildDiagnosticReportCore({
    stateObj: state,
    appVersion: APP_VERSION,
    appChannel: APP_CHANNEL,
    environment,
    breadcrumbs: includeBreadcrumbs ? getFlightBreadcrumbs() : [],
    errors: includeErrors ? getCapturedErrors() : [],
  });
}
