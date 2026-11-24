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
import { setTiledMode, setStatus, updateToolOptionsUI, getRegisteredAction } from "../ui/index.js";
import { openFloatingContextMenu } from "../ui/canvasContextMenu.js";
import { showConfirmDialog, showPromptDialog } from "../ui/modals/ConfirmModal.js";
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
  notify("tool:cancelPending");
  state.freeTransform = null;
  state.selection = null;
  state.lassoPreview = null;
  state.polygonPreview = null;
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
  notify("tool:cancelPending");
  state.freeTransform = null;
  state.selection = null;
  state.lassoPreview = null;
  state.polygonPreview = null;
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

function executeCloseDocTab(tabId) {
  const plan = computeTabClosePlan(tabs, activeTabId, tabId);
  if (plan.action === "noop") return;

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
 * Cierra una pestaña por ID (pide confirmación con modal propio si tiene cambios sin guardar).
 * @param {string} tabId
 */
export function closeDocTab(tabId) {
  const plan = computeTabClosePlan(tabs, activeTabId, tabId);
  if (plan.action === "noop") return;

  const targetTab = tabs[plan.index];
  if (targetTab.dirty && typeof document !== "undefined" && document.getElementById("appConfirmModal")) {
    showConfirmDialog({
      title: targetTab.name,
      message: i18n.t("tabs.confirm_close", { name: targetTab.name }),
      confirmText: i18n.t("tabs.ctx_close"),
    }).then((ok) => {
      if (ok) executeCloseDocTab(tabId);
    });
    return;
  }

  executeCloseDocTab(tabId);
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
 * Duplica una pestaña existente en una nueva pestaña independiente ubicada a su derecha.
 * @param {string} tabId
 * @returns {string|null}
 */
export function duplicateDocTab(tabId) {
  if (tabId === activeTabId) {
    saveActiveTabState();
  }
  const sourceIndex = tabs.findIndex((t) => t.id === tabId);
  if (sourceIndex === -1) return null;
  const source = tabs[sourceIndex];
  const baseName = `${source.name}_copia`;
  let copyName = baseName;
  let suffix = 2;
  while (tabs.some((t) => t.name === copyName)) {
    copyName = `${baseName}_${suffix++}`;
  }

  const clonedSnap = source.snapshot ? JSON.parse(JSON.stringify(source.snapshot)) : null;
  if (clonedSnap) clonedSnap.name = copyName;

  const newId = nextTabId();
  const clonedTab = {
    ...source,
    id: newId,
    name: copyName,
    dirty: true,
    snapshot: clonedSnap,
    tilesets: cloneTilesets(source.tilesets),
    undoStack: [],
    redoStack: [],
    sourceImportOptions: source.sourceImportOptions ? { ...source.sourceImportOptions } : null,
  };
  tabs.splice(sourceIndex + 1, 0, clonedTab);
  switchToTab(newId);
  setStatus({ key: "log.tab_duplicated", params: { name: copyName } });
  return newId;
}

/**
 * Renombra una pestaña específica (y `#assetName` si es la activa).
 * @param {string} tabId
 * @param {string} nextName
 */
export function renameDocTabById(tabId, nextName) {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return;
  const clean = normalizeDocTabName(nextName);
  tab.name = clean;
  if (tab.snapshot) tab.snapshot.name = clean;
  if (tabId === activeTabId && typeof document !== "undefined") {
    const assetEl = document.getElementById("assetName");
    if (assetEl) assetEl.value = clean;
  }
  renderDocTabsUI();
  setStatus({ key: "log.tab_renamed", params: { name: clean } });
}

function executeCloseTabBatch(closingSet, keepTabId) {
  const activeClosed = closingSet.has(activeTabId);
  tabs = tabs.filter((t) => !closingSet.has(t.id));
  if (activeClosed && keepTabId && tabs.some((t) => t.id === keepTabId)) {
    activeTabId = null;
    switchToTab(keepTabId);
  } else {
    renderDocTabsUI();
  }
}

function closeTabBatch(toCloseIds, keepTabId) {
  if (toCloseIds.length === 0) return;
  const closingSet = new Set(toCloseIds);
  const dirtyTabs = tabs.filter((t) => closingSet.has(t.id) && t.dirty);
  if (dirtyTabs.length > 0 && typeof document !== "undefined" && document.getElementById("appConfirmModal")) {
    showConfirmDialog({
      title: i18n.t("modal.confirm.title"),
      message: i18n.t("tabs.confirm_close_batch", { count: dirtyTabs.length }),
      confirmText: i18n.t("opt.confirm"),
    }).then((ok) => {
      if (ok) executeCloseTabBatch(closingSet, keepTabId);
    });
    return;
  }
  executeCloseTabBatch(closingSet, keepTabId);
}

/** Cierra todas las pestañas excepto la indicada.
 * @param {string} keepTabId */
export function closeOtherDocTabs(keepTabId) {
  const ids = tabs.filter((t) => t.id !== keepTabId).map((t) => t.id);
  closeTabBatch(ids, keepTabId);
}

/** Cierra todas las pestañas ubicadas a la derecha de la indicada.
 * @param {string} fromTabId */
export function closeRightDocTabs(fromTabId) {
  const idx = tabs.findIndex((t) => t.id === fromTabId);
  if (idx === -1 || idx >= tabs.length - 1) return;
  const ids = tabs.slice(idx + 1).map((t) => t.id);
  closeTabBatch(ids, fromTabId);
}

function openDocTabContextMenu(tab, tabIndex, clientX, clientY) {
  const items = [
    {
      icon: "copy-plus",
      label: i18n.t("tabs.ctx_duplicate"),
      action: () => duplicateDocTab(tab.id),
    },
    {
      icon: "pencil",
      label: i18n.t("tabs.ctx_rename"),
      action: () => {
        showPromptDialog({
          title: i18n.t("tabs.ctx_rename"),
          message: i18n.t("tabs.prompt_rename"),
          defaultValue: tab.name,
          confirmText: i18n.t("opt.apply"),
        }).then((next) => {
          if (next !== null) renameDocTabById(tab.id, next);
        });
      },
    },
    {
      icon: "save",
      label: i18n.t("tabs.ctx_save"),
      action: () => {
        if (tab.id !== activeTabId) switchToTab(tab.id);
        getRegisteredAction("saveProjectFile")?.();
      },
    },
    { divider: true },
    {
      icon: "x",
      label: i18n.t("tabs.ctx_close"),
      action: () => closeDocTab(tab.id),
    },
    {
      icon: "x-circle",
      label: i18n.t("tabs.ctx_close_others"),
      disabled: tabs.length <= 1,
      action: () => closeOtherDocTabs(tab.id),
    },
    {
      icon: "arrow-right",
      label: i18n.t("tabs.ctx_close_right"),
      disabled: tabIndex >= tabs.length - 1,
      action: () => closeRightDocTabs(tab.id),
    },
  ];
  openFloatingContextMenu(clientX, clientY, tab.name, items);
}

/**
 * Renderiza la barra de pestañas en `#docTabsList`.
 */
export function renderDocTabsUI() {
  if (typeof document === "undefined") return;
  const list = document.getElementById("docTabsList");
  if (!list) return;
  list.innerHTML = "";

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
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
    pill.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDocTabContextMenu(tab, i, e.clientX, e.clientY);
    });

    pill.appendChild(label);
    pill.appendChild(sizeBadge);
    pill.appendChild(closeBtn);
    list.appendChild(pill);
  }
}
