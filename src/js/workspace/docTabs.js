/**
 * docTabs.js: Pestañas multi-documento debajo de la barra superior.
 * Permite trabajar con múltiples sprites/proyectos en paralelo sin perder el trabajo abierto.
 */

import { state, cloneTilesets, notify } from "../core/state.js";
import {
  buildCurrentProjectSnapshot,
  restoreProjectSnapshot,
} from "../core/storage.js";
import { applyZoom } from "../canvas/canvas.js";
import { setTiledMode, setStatus, updateToolOptionsUI } from "../ui/index.js";
import { highlightCurrentSwatch } from "./paletteManager.js";
import { i18n } from "../i18n/I18nService.js";
import {
  normalizeDocTabName,
  captureRuntimeExtrasFromState,
  applyTabExtrasToState,
  isInitialPristineTab,
  computeTabClosePlan,
  formatDocTabViewModel,
} from "./docTabsCore.js";

if (typeof window !== "undefined") {
  i18n.addEventListener("langchange", () => {
    document.querySelectorAll("#docTabsList .tab-close").forEach((b) => { b.title = i18n.t("tabs.close"); });
  });
}

let tabs = [];
let activeTabId = null;
let tabSeq = 1;

function nextTabId() {
  return `tab_${Date.now()}_${tabSeq++}`;
}

function captureRuntimeExtras() {
  return captureRuntimeExtrasFromState(state, cloneTilesets);
}

/**
 * Guarda el estado actual del lienzo dentro de la pestaña activa.
 */
export function saveActiveTabState() {
  if (!activeTabId) return;
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab) return;
  const snap = buildCurrentProjectSnapshot();
  tab.name = snap.name || tab.name;
  tab.gridSize = snap.gridSize || state.gridSize;
  tab.gridWidth = snap.gridWidth || state.gridWidth || tab.gridSize;
  tab.gridHeight = snap.gridHeight || state.gridHeight || tab.gridSize;
  tab.snapshot = snap;
  Object.assign(tab, captureRuntimeExtras());
}

/**
 * Inicializa la barra de pestañas con el documento actual como primera pestaña.
 */
export function initDocTabs() {
  if (tabs.length === 0) {
    const snap = buildCurrentProjectSnapshot();
    const id = nextTabId();
    tabs.push({
      id,
      name: snap.name || "nuevo_proyecto",
      gridSize: snap.gridSize || state.gridSize,
      gridWidth: snap.gridWidth || state.gridWidth || state.gridSize,
      gridHeight: snap.gridHeight || state.gridHeight || state.gridSize,
      dirty: false,
      snapshot: snap,
      ...captureRuntimeExtras(),
    });
    activeTabId = id;
  }
  renderDocTabsUI();
}

/**
 * Registra una nueva pestaña y la vuelve activa (guardando antes la pestaña previa).
 * @param {string} [name]
 * @returns {string} ID de la nueva pestaña
 */
export function openNewDocTab(name = "nuevo_proyecto") {
  if (isInitialPristineTab(tabs, state)) {
    tabs[0].name = name;
    tabs[0].gridSize = state.gridSize;
    tabs[0].gridWidth = state.gridWidth || state.gridSize;
    tabs[0].gridHeight = state.gridHeight || state.gridSize;
    tabs[0].dirty = false;
    activeTabId = tabs[0].id;
    if (typeof document !== "undefined") {
      const assetEl = document.getElementById("assetName");
      if (assetEl) assetEl.value = name;
    }
    renderDocTabsUI();
    return tabs[0].id;
  }

  saveActiveTabState();
  state.freeTransform = null;
  state.selection = null;
  state.lassoPreview = null;
  updateToolOptionsUI();

  const id = nextTabId();
  tabs.push({
    id,
    name,
    gridSize: state.gridSize,
    gridWidth: state.gridWidth || state.gridSize,
    gridHeight: state.gridHeight || state.gridSize,
    dirty: false,
    snapshot: null,
    zoom: 1,
    tiledMode: "none",
    currentColorIndex: 1,
    secondaryColorIndex: 0,
    undoStack: [],
    redoStack: [],
  });
  activeTabId = id;
  if (typeof document !== "undefined") {
    const assetEl = document.getElementById("assetName");
    if (assetEl) assetEl.value = name;
  }
  renderDocTabsUI();
  return id;
}

/**
 * Actualiza el snapshot y nombre de la pestaña activa después de crear/cargar un proyecto.
 * @param {string} [customName]
 */
export function syncActiveTabSnapshot(customName = null) {
  if (!activeTabId) {
    initDocTabs();
    return;
  }
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab) return;
  const snap = buildCurrentProjectSnapshot(customName);
  tab.name = customName || snap.name || tab.name;
  tab.gridSize = snap.gridSize || state.gridSize;
  tab.gridWidth = snap.gridWidth || state.gridWidth || tab.gridSize;
  tab.gridHeight = snap.gridHeight || state.gridHeight || tab.gridSize;
  tab.snapshot = snap;
  Object.assign(tab, captureRuntimeExtras());
  renderDocTabsUI();
}

/**
 * Cambia a la pestaña indicada restaurando todo su proyecto, capas, frames, paleta y zoom.
 * @param {string} tabId
 */
export function switchToTab(tabId) {
  if (!tabId || tabId === activeTabId) return;
  const target = tabs.find((t) => t.id === tabId);
  if (!target) return;

  saveActiveTabState();
  state.freeTransform = null;
  state.selection = null;
  state.lassoPreview = null;
  updateToolOptionsUI();

  activeTabId = tabId;
  if (target.snapshot) {
    restoreProjectSnapshot(target.snapshot, `Pestaña: ${target.name}`, { recordHistory: false });
  }
  if (typeof document !== "undefined") {
    const assetEl = document.getElementById("assetName");
    if (assetEl) assetEl.value = target.name;
  }
  applyTabExtrasToState(target, state, cloneTilesets);
  setTiledMode(target.tiledMode || "none");
  applyZoom(target.zoom || 1);
  highlightCurrentSwatch();
  notify("tilemap:render");
  renderDocTabsUI();
}

/**
 * Marca la pestaña activa con cambios sin guardar (`•`).
 */
export function markActiveTabDirty() {
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab || tab.dirty) return;
  tab.dirty = true;
  renderDocTabsUI();
}

/**
 * Limpia el indicador de cambios sin guardar en la pestaña activa.
 */
export function markActiveTabSaved() {
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab || !tab.dirty) return;
  tab.dirty = false;
  renderDocTabsUI();
}

/**
 * Cierra una pestaña por ID (pide confirmación si tiene cambios sin guardar).
 * @param {string} tabId
 */
export function closeDocTab(tabId) {
  const plan = computeTabClosePlan(tabs, activeTabId, tabId);
  if (plan.action === "noop") return;

  const targetTab = tabs[plan.index];
  if (
    targetTab.dirty &&
    typeof window !== "undefined" &&
    typeof window.confirm === "function" &&
    !window.confirm(i18n.t("tabs.confirm_close", { name: targetTab.name }))
  ) {
    return;
  }

  if (plan.action === "launch") {
    if (typeof document !== "undefined") {
      document.body?.classList.add("is-launching");
      document.getElementById("launcherOverlay")?.classList.remove("hidden");
    }
    return;
  }

  tabs.splice(plan.index, 1);

  if (plan.wasActive && plan.nextTabId) {
    activeTabId = null;
    switchToTab(plan.nextTabId);
  } else {
    renderDocTabsUI();
  }
}

/**
 * Sincroniza el título de la pestaña activa cuando cambia el nombre del asset.
 * @param {string} name
 */
export function renameActiveDocTab(name) {
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab) return;
  tab.name = normalizeDocTabName(name);
  renderDocTabsUI();
}

/**
 * Renderiza la barra de pestañas en `#docTabsList`.
 */
export function renderDocTabsUI() {
  if (typeof document === "undefined") return;
  const list = document.getElementById("docTabsList");
  if (!list) return;
  list.innerHTML = "";

  for (const tab of tabs) {
    const vm = formatDocTabViewModel(tab, tab.id === activeTabId, state);
    const pill = document.createElement("div");
    pill.className = `doc-tab${vm.isActive ? " active" : ""}`;
    pill.title = vm.title;

    const label = document.createElement("span");
    label.className = "doc-tab-label";
    label.textContent = vm.labelText;

    const sizeBadge = document.createElement("span");
    sizeBadge.className = "doc-tab-size";
    sizeBadge.textContent = vm.sizeText;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "doc-tab-close";
    closeBtn.title = i18n.t("tabs.close");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeDocTab(tab.id);
    });

    pill.addEventListener("click", () => switchToTab(tab.id));
    pill.addEventListener("auxclick", (e) => {
      if (e.button === 1) {
        e.preventDefault();
        closeDocTab(tab.id);
      }
    });

    pill.appendChild(label);
    pill.appendChild(sizeBadge);
    pill.appendChild(closeBtn);
    list.appendChild(pill);
  }
}
