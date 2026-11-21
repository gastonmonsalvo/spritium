// @ts-check
/**
 * DomRegistry.js: Registro declarativo de acciones de interfaz y delegación de eventos (`data-action`).
 *
 * Permite desacoplar progresivamente los handlers del espacio global `window.*` mediante
 * delegación sobre atributos `data-action` y `data-action-arg`, manteniendo compatibilidad
 * con `window` para los atributos inline existentes en `index.html`.
 */

import { recordActionBreadcrumb } from "../core/flightRecorder.js";

/** @type {Map<string, Function>} */
const actionMap = new Map();

let delegationInitialized = false;

/**
 * Registra un diccionario de acciones UI y opcionalmente las expone en `window` para compatibilidad legacy.
 * @param {Record<string, Function>} actions
 * @param {{ exposeOnWindow?: boolean }} [options]
 */
export function registerActions(actions, { exposeOnWindow = true } = {}) {
  if (!actions || typeof actions !== "object") return;
  for (const [name, fn] of Object.entries(actions)) {
    if (typeof fn === "function") {
      actionMap.set(name, fn);
    }
  }
  if (exposeOnWindow && typeof window !== "undefined") {
    Object.assign(window, actions);
  }
}

/**
 * Obtiene una acción registrada por su identificador.
 * @param {string} name
 * @returns {Function | undefined}
 */
export function getRegisteredAction(name) {
  return actionMap.get(name);
}

/**
 * Devuelve la cantidad total de acciones registradas en el DomRegistry.
 * @returns {number}
 */
export function getRegisteredActionsCount() {
  return actionMap.size;
}

function invokeAction(el, attrName, event) {
  const actionName = el.getAttribute(attrName);
  if (!actionName) return;
  const fn = actionMap.get(actionName);
  if (typeof fn !== "function") return;

  const isInput = attrName === "data-input";
  const rawArgs = el.getAttribute("data-action-args");
  if (rawArgs !== null) {
    recordActionBreadcrumb(actionName, rawArgs, isInput ? "input" : "action");
    try {
      const parsed = JSON.parse(rawArgs);
      if (Array.isArray(parsed)) {
        fn(...parsed, event);
        return;
      }
    } catch {
      // Fallback al manejo simple si el JSON no es válido
    }
  }

  const rawArg = el.getAttribute("data-action-arg");
  if (rawArg !== null) {
    recordActionBreadcrumb(actionName, rawArg, isInput ? "input" : "action");
    const num = Number(rawArg);
    fn(Number.isNaN(num) || rawArg.trim() === "" ? rawArg : num, event);
    return;
  }

  const valHint =
    (attrName === "data-change" || attrName === "data-input") && event?.target && "value" in event.target
      ? String(event.target.value ?? "")
      : "";
  recordActionBreadcrumb(actionName, valHint, isInput ? "input" : "action");
  fn(event);
}

/**
 * Inicializa la delegación global de eventos para `[data-action]`, `[data-change]`,
 * `[data-input]`, `[data-submit]` y `[data-backdrop-close]`.
 * @param {Document | HTMLElement} [root]
 */
export function initDeclarativeActions(root = typeof document !== "undefined" ? document : null) {
  if (!root || delegationInitialized) return;
  delegationInitialized = true;

  root.addEventListener("click", (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target);

    const backdrop = target?.matches?.("[data-backdrop-close]") ? target : null;
    if (backdrop) {
      const closeAction = backdrop.getAttribute("data-backdrop-close");
      if (closeAction === "self") {
        backdrop.classList.remove("open");
      } else if (closeAction) {
        const fn = actionMap.get(closeAction);
        if (typeof fn === "function") fn(e);
      }
      return;
    }

    const el = target?.closest?.("[data-action]");
    if (el) invokeAction(el, "data-action", e);
  });

  root.addEventListener("change", (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target);
    const el = target?.closest?.("[data-change]");
    if (el) invokeAction(el, "data-change", e);
  });

  root.addEventListener("input", (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target);
    const el = target?.closest?.("[data-input]");
    if (el) invokeAction(el, "data-input", e);
  });

  root.addEventListener("submit", (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target);
    const el = target?.closest?.("[data-submit]");
    if (!el) return;
    e.preventDefault();
    invokeAction(el, "data-submit", e);
  });
}
