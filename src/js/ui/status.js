/**
 * status.js: Barra de estado, ventana flotante de historial de logs (LogHistory) con Time-Travel
 * e hidratación de íconos Lucide.
 */

import { state, subscribe, jumpToHistoryAction } from "../core/state.js";
import { recordCapturedError } from "../core/flightRecorder.js";
import { i18n } from "../i18n/I18nService.js";

const MAX_LOG_HISTORY = 200;

const PIXEL_MSG_REGEX =
  /^(deshacer|rehacer|undo|redo)|p[ií]xel|trazo|stroke|contorno|outline|erosi[oó]n|erod|rotad|rotat|invertid|flip|pegad|past|cortad|cut|borrad|eras|limpi|clear|transformaci[oó]n|transform|relleno|fill|centrado|center/i;

const logHistory = [];
let nextLogId = 1;
let pendingDirtyEntry = null;
let pendingDirtyAt = 0;
let latestStatusMeta = null;
let isLogHistoryOpen = false;
let showUiLogs = true;
let initialized = false;

function formatTime(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function inferCategory(msg, isError) {
  if (isError) return "error";
  if (PIXEL_MSG_REGEX.test(String(msg || "").trim())) return "pixel";
  return "ui";
}

function resolveLogParams(params = {}) {
  if (!params) return params;
  let out = params;
  if (params.paletteKey) {
    const pKey = `palette.${params.paletteKey}.name`;
    const tr = i18n.t(pKey);
    out = { ...out, name: tr !== pKey ? tr : (params.name || params.paletteKey) };
  }
  if (params.toolKey) {
    const tKey = `logs.tool.${params.toolKey}`;
    const tr = i18n.t(tKey);
    out = { ...out, tool: tr !== tKey ? tr : (params.tool || params.toolKey) };
  }
  return out;
}

function resolveLogMessage(item) {
  if (item?.meta?.type === "pixels_modified") {
    const tKey = `logs.tool.${item.meta.tool}`;
    const tTr = i18n.t(tKey);
    const tLabel = tTr !== tKey ? tTr : (item.meta.tool || i18n.t("logs.canvas_fallback"));
    return i18n.t("logs.pixels_modified", { tool: tLabel });
  }
  if (item?.meta?.type === "i18n" && item.meta.key) {
    return i18n.t(item.meta.key, resolveLogParams(item.meta.params));
  }
  return item?.message || "";
}

function pushLogEntry(message, category = "ui", actionId = null, meta = null) {
  const cleanMsg = String(message || "").trim();
  if (!cleanMsg && !meta) return null;

  const entry = {
    id: nextLogId++,
    message: cleanMsg,
    category,
    time: formatTime(),
    actionId,
    meta,
  };

  logHistory.unshift(entry);
  if (logHistory.length > MAX_LOG_HISTORY) {
    logHistory.length = MAX_LOG_HISTORY;
  }
  renderLogHistory();
  return entry;
}

function getTimelineStatus(actionId) {
  if (typeof actionId !== "number") return "none";
  if (state.currentHistoryActionId === actionId) return "current";
  if (state.undoStack.some((s) => s.actionId === actionId)) return "past";
  if (state.redoStack.some((s) => s.actionId === actionId)) return "future";
  return "expired";
}

function getVisibleLogEntries() {
  return showUiLogs ? logHistory : logHistory.filter((item) => item.category !== "ui");
}

function renderLogHistory() {
  if (typeof document === "undefined") return;
  const visibleItems = getVisibleLogEntries();
  const countEl = document.getElementById("logHistoryCount");
  if (countEl) {
    countEl.textContent = visibleItems.length > 0 ? String(visibleItems.length) : "";
    countEl.style.display = visibleItems.length > 0 ? "inline-flex" : "none";
  }

  const list = document.getElementById("logHistoryList");
  if (!list || !isLogHistoryOpen) return;

  if (visibleItems.length === 0) {
    list.innerHTML = `<div class="log-history-empty">${i18n.t("logs.empty")}</div>`;
    return;
  }

  list.innerHTML = "";
  for (const item of visibleItems) {
    const timelineState = getTimelineStatus(item.actionId);
    const isJumpable =
      item.category === "pixel" &&
      (timelineState === "current" || timelineState === "past" || timelineState === "future");

    const row = document.createElement(isJumpable ? "button" : "div");
    if (isJumpable) row.type = "button";
    row.className = `log-history-item log-${item.category}`;
    if (isJumpable) row.classList.add("log-jumpable");
    if (timelineState === "current") row.classList.add("log-current");
    if (timelineState === "future") row.classList.add("log-future");
    if (timelineState === "expired") row.classList.add("log-expired");

    if (isJumpable) {
      row.title =
        timelineState === "current"
          ? i18n.t("logs.current_state")
          : i18n.t("logs.jump_to");
      row.addEventListener("click", () => {
        if (jumpToHistoryAction(item.actionId)) {
          const statusText = typeof document !== "undefined" ? document.getElementById("statusText") : null;
          if (statusText) {
            statusText.textContent = i18n.t("logs.history_prefix", { msg: resolveLogMessage(item) });
            statusText.style.color = "var(--text-secondary)";
          }
          renderLogHistory();
        }
      });
    }

    const dot = document.createElement("span");
    dot.className = "log-history-dot";

    const msgSpan = document.createElement("span");
    msgSpan.className = "log-history-msg";
    msgSpan.textContent = resolveLogMessage(item);

    row.append(dot, msgSpan);

    if (timelineState === "current") {
      const badge = document.createElement("span");
      badge.className = "log-current-badge";
      badge.textContent = i18n.t("logs.current_badge");
      row.appendChild(badge);
    }

    const timeSpan = document.createElement("span");
    timeSpan.className = "log-history-time";
    timeSpan.textContent = item.time;
    row.appendChild(timeSpan);

    list.appendChild(row);
  }
}

function setupLogWindowDrag() {
  const win = document.getElementById("logHistoryWindow");
  const header = win?.querySelector(".log-window-header");
  if (!win || !header) return;

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  header.addEventListener("mousedown", (e) => {
    if (e.target.closest("button")) return;
    dragging = true;
    const rect = win.getBoundingClientRect();
    win.style.left = `${rect.left}px`;
    win.style.top = `${rect.top}px`;
    win.style.bottom = "auto";
    win.style.right = "auto";
    startX = e.clientX;
    startY = e.clientY;
    origLeft = rect.left;
    origTop = rect.top;
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const maxX = Math.max(0, window.innerWidth - win.offsetWidth - 8);
    const maxY = Math.max(0, window.innerHeight - win.offsetHeight - 8);
    const nx = Math.max(8, Math.min(maxX, origLeft + (e.clientX - startX)));
    const ny = Math.max(8, Math.min(maxY, origTop + (e.clientY - startY)));
    win.style.left = `${nx}px`;
    win.style.top = `${ny}px`;
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
  });
}

/**
 * Inicializa la suscripción a modificaciones de píxeles, historial y ventana de logs.
 */
export function initLogHistory() {
  if (initialized) return;
  initialized = true;

  subscribe("dirty", () => {
    // Limpiar pasos futuros que quedaron invalidados tras ramificar desde un undo
    for (let i = logHistory.length - 1; i >= 0; i--) {
      const it = logHistory[i];
      if (it.category === "pixel" && typeof it.actionId === "number" && getTimelineStatus(it.actionId) === "expired") {
        logHistory.splice(i, 1);
      }
    }
    // Asegurar entrada base para poder volver al estado inicial (actionId = 0) si sigue en undoStack
    if (!logHistory.some((it) => it.actionId === 0) && state.undoStack.some((s) => s.actionId === 0)) {
      const baseMeta = { type: "i18n", key: "logs.initial_state" };
      logHistory.push({
        id: nextLogId++,
        message: resolveLogMessage({ meta: baseMeta }),
        category: "pixel",
        time: formatTime(),
        actionId: 0,
        meta: baseMeta,
      });
    }
    const meta = { type: "pixels_modified", tool: state.currentTool };
    const entry = pushLogEntry(
      resolveLogMessage({ meta }),
      "pixel",
      state.currentHistoryActionId,
      meta,
    );
    pendingDirtyEntry = entry;
    pendingDirtyAt = Date.now();
  });

  subscribe("history", () => {
    renderLogHistory();
  });

  i18n.addEventListener("langchange", () => {
    if (latestStatusMeta) {
      const statusText = typeof document !== "undefined" ? document.getElementById("statusText") : null;
      if (statusText) statusText.textContent = resolveLogMessage({ meta: latestStatusMeta });
    }
    renderLogHistory();
  });

  setupLogWindowDrag();

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isLogHistoryOpen) {
      closeLogHistory();
    }
  });
}

/**
 * Abre o cierra la ventana flotante de historial de logs.
 */
export function toggleLogHistory(event) {
  event?.stopPropagation?.();
  isLogHistoryOpen = !isLogHistoryOpen;
  const win = document.getElementById("logHistoryWindow");
  const btn = document.getElementById("btnLogHistory");
  const arrow = document.getElementById("logHistoryArrow");
  if (win) win.classList.toggle("open", isLogHistoryOpen);
  if (btn) btn.setAttribute("aria-expanded", String(isLogHistoryOpen));
  if (arrow) arrow.textContent = isLogHistoryOpen ? "▾" : "▴";
  if (isLogHistoryOpen) {
    renderLogHistory();
  }
}

/**
 * Cierra la ventana flotante de historial de logs.
 */
export function closeLogHistory() {
  isLogHistoryOpen = false;
  const win = document.getElementById("logHistoryWindow");
  const btn = document.getElementById("btnLogHistory");
  const arrow = document.getElementById("logHistoryArrow");
  if (win) win.classList.remove("open");
  if (btn) btn.setAttribute("aria-expanded", "false");
  if (arrow) arrow.textContent = "▴";
}

/**
 * Muestra u oculta los eventos informativos de interfaz/herramientas en el historial de logs.
 * @param {Event} [event]
 */
export function toggleUiLogs(event) {
  event?.stopPropagation?.();
  showUiLogs = !showUiLogs;
  const btn = document.getElementById("btnToggleUiLogs");
  if (btn) {
    btn.classList.toggle("active", showUiLogs);
    btn.setAttribute("aria-pressed", String(showUiLogs));
  }
  renderLogHistory();
}

/**
 * Limpia la pila visual de historial de logs.
 */
export function clearLogHistory(event) {
  event?.stopPropagation?.();
  logHistory.length = 0;
  pendingDirtyEntry = null;
  renderLogHistory();
}

/**
 * Muestra un mensaje informativo o de error en la barra de Logs y lo registra en la pila.
 * @param {string} msg
 * @param {boolean} [isError=false]
 * @param {"pixel"|"ui"|"error"|null} [category=null]
 */
export function setStatus(msgOrSpec, isError = false, category = null) {
  const isSpec = msgOrSpec && typeof msgOrSpec === "object" && typeof msgOrSpec.key === "string";
  const meta = isSpec ? { type: "i18n", key: msgOrSpec.key, params: msgOrSpec.params || {} } : null;
  const msg = isSpec ? resolveLogMessage({ meta }) : String(msgOrSpec ?? "");
  latestStatusMeta = meta;

  const statusText = typeof document !== "undefined" ? document.getElementById("statusText") : null;
  if (statusText) {
    statusText.textContent = msg;
    statusText.style.color = isError ? "var(--status-danger)" : "var(--text-secondary)";
  }

  const resolvedCategory = category || inferCategory(msg, isError);
  const now = Date.now();

  if (
    !isError &&
    pendingDirtyEntry &&
    now - pendingDirtyAt <= 400 &&
    resolvedCategory === "pixel"
  ) {
    pendingDirtyEntry.message = msg.trim() || pendingDirtyEntry.message;
    pendingDirtyEntry.meta = meta || pendingDirtyEntry.meta;
    pendingDirtyEntry.time = formatTime();
    pendingDirtyEntry = null;
    renderLogHistory();
    return;
  }

  pendingDirtyEntry = null;
  if (isError || resolvedCategory === "error") {
    recordCapturedError(msg, { source: "status.setStatus", key: meta?.key });
  }
  pushLogEntry(msg, resolvedCategory, null, meta);
}

/**
 * Inicializa o refresca los íconos SVG de Lucide dentro de `root`.
 * @param {any} [root=document]
 */
export function refreshIcons(root = document) {
  if (typeof window !== "undefined" && window.lucide?.createIcons) {
    window.lucide.createIcons({ root });
  }
}
