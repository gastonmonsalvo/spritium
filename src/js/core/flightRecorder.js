// @ts-check
/**
 * flightRecorder.js: Caja Negra (Flight Recorder) en memoria con Ring Buffer circular.
 * Registra las últimas acciones de UI, ediciones de píxeles, cambios de historial y
 * excepciones en tiempo de ejecución para garantizar la reproducibilidad de bugs sin backend.
 */

import { state, subscribe } from "./state.js";
import { APP_VERSION, APP_CHANNEL } from "./version.js";

export const MAX_FLIGHT_BREADCRUMBS = 40;
export const MAX_CAPTURED_ERRORS = 15;

/** @type {Array<Record<string, any>>} */
const breadcrumbs = [];

/** @type {Array<Record<string, any>>} */
const capturedErrors = [];

let recorderInitialized = false;
let nextStepSeq = 1;

function getCompactWorkspaceContext() {
  const w = state.gridWidth || state.gridSize || 64;
  const h = state.gridHeight || state.gridSize || 64;
  const activeLayer = Array.isArray(state.layers) ? state.layers[state.activeLayerIndex] : null;
  return {
    res: `${w}x${h}`,
    tool: state.currentTool || "pencil",
    frame: state.activeFrameIndex ?? 0,
    frames: Array.isArray(state.frames) ? state.frames.length : 1,
    layerIdx: state.activeLayerIndex ?? 0,
    layerType: activeLayer?.type || "raster",
    layers: Array.isArray(state.layers) ? state.layers.length : 1,
    historyId: state.currentHistoryActionId ?? 0,
  };
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

function detectDeviceProfile(nav, win) {
  const ua = String(nav?.userAgent || "");
  const maxTouchPoints = Number(nav?.maxTouchPoints || 0);
  const isCoarse = Boolean(win?.matchMedia?.("(pointer: coarse)")?.matches);
  const touchCapable = maxTouchPoints > 0 || isCoarse;

  let os = "Unknown";
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) os = "iPadOS";
  else if (/iPhone|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Macintosh|Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = "Opera";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";

  const minScreen = win ? Math.min(win.innerWidth || 9999, win.innerHeight || 9999) : 1024;
  let formFactor = "desktop";
  if (os === "iPadOS" || (os === "Android" && !/Mobile/i.test(ua))) {
    formFactor = "tablet";
  } else if (os === "iOS" || (/Android/i.test(ua) && /Mobile/i.test(ua)) || (touchCapable && minScreen <= 560)) {
    formFactor = "mobile";
  } else if (touchCapable && minScreen <= 900) {
    formFactor = "tablet";
  }

  const inputMode = state.lastPointerType || (isCoarse ? "touch" : "mouse");
  const label = `${formFactor} (${os} · ${browser} · ${inputMode}${touchCapable ? " · touch" : ""})`;
  return { formFactor, os, browser, touchCapable, maxTouchPoints, inputMode, label };
}

/**
 * Construye una radiografía técnica anonimizada del entorno, lienzo, capas, tilesets y traza de acciones.
 * @param {{ includeBreadcrumbs?: boolean, includeErrors?: boolean }} [options]
 * @returns {Record<string, any>} Objeto estructurado de diagnóstico técnico.
 */
export function buildDiagnosticReport({ includeBreadcrumbs = true, includeErrors = true } = {}) {
  const w = state.gridWidth || state.gridSize || 64;
  const h = state.gridHeight || state.gridSize || 64;
  const paletteSize = state.paletteMap instanceof Map ? state.paletteMap.size : 0;

  const nav = typeof navigator !== "undefined" ? navigator : null;
  const win = typeof window !== "undefined" ? window : null;
  const docEl = typeof document !== "undefined" ? document.documentElement : null;
  const perfMem = /** @type {any} */ (typeof performance !== "undefined" ? performance : null)?.memory;

  const layersSummary = Array.isArray(state.layers)
    ? state.layers.map((layer, index) => ({
        index,
        id: layer?.id ?? index,
        type: layer?.type || "raster",
        visible: Boolean(layer?.visible ?? true),
        locked: Boolean(layer?.locked),
        opacity: layer?.opacity ?? 1,
        blendMode: layer?.blendMode || "normal",
        parentId: layer?.parentId ?? null,
        ...(layer?.type === "tilemap"
          ? {
              tilesetId: layer?.tilesetId || null,
              tilemapMode: state.tilemapMode || "tiles",
              gridCols: Array.isArray(layer?.tileGrid?.[0]) ? layer.tileGrid[0].length : 0,
              gridRows: Array.isArray(layer?.tileGrid) ? layer.tileGrid.length : 0,
            }
          : {}),
      }))
    : [];

  const tilesetsSummary = Array.isArray(state.tilesets)
    ? state.tilesets.map((ts) => ({
        id: ts?.id,
        tileWidth: ts?.tileWidth || 16,
        tileHeight: ts?.tileHeight || 16,
        tileCount: Array.isArray(ts?.tiles) ? ts.tiles.length : 0,
      }))
    : [];

  return {
    app: "Spritium",
    appVersion: APP_VERSION,
    appChannel: APP_CHANNEL,
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    environment: {
      device: detectDeviceProfile(nav, win),
      userAgent: nav?.userAgent || "unknown",
      language: docEl?.lang || nav?.language || "es",
      viewport: win ? `${win.innerWidth || 0}x${win.innerHeight || 0}` : "headless",
      devicePixelRatio: win?.devicePixelRatio || 1,
      colorTheme: typeof document !== "undefined" && document.body?.classList?.contains("theme-light") ? "light" : "dark",
      jsHeapUsedMB: perfMem?.usedJSHeapSize ? Math.round((perfMem.usedJSHeapSize / (1024 * 1024)) * 10) / 10 : null,
    },
    workspace: {
      resolution: { width: w, height: h },
      zoom: state.zoom || 1,
      currentTool: state.currentTool || "pencil",
      brushSize: state.brushSize || 1,
      mirrorH: Boolean(state.mirrorH),
      mirrorV: Boolean(state.mirrorV),
      tiledMode: state.tiledMode || "none",
      paletteColors: paletteSize,
      themeKey: state.currentThemeKey || "default",
      activeFrameIndex: state.activeFrameIndex ?? 0,
      totalFrames: Array.isArray(state.frames) ? state.frames.length : 1,
      fps: state.fps || 8,
      isPlaying: Boolean(state.isPlaying),
      activeLayerIndex: state.activeLayerIndex ?? 0,
      totalLayers: layersSummary.length,
      layers: layersSummary,
      tilesets: tilesetsSummary,
      history: {
        undoDepth: Array.isArray(state.undoStack) ? state.undoStack.length : 0,
        redoDepth: Array.isArray(state.redoStack) ? state.redoStack.length : 0,
        currentActionId: state.currentHistoryActionId ?? 0,
      },
    },
    breadcrumbs: includeBreadcrumbs ? getFlightBreadcrumbs() : [],
    errors: includeErrors ? getCapturedErrors() : [],
  };
}
