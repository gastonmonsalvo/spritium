/**
 * docTabsCore.js: Lógica pura de modelo de pestañas multi-documento, extras de runtime y view-models.
 */

/**
 * Normaliza el nombre de un documento/pestaña.
 * @param {string} [name]
 * @returns {string}
 */
export function normalizeDocTabName(name) {
  return (name || "").trim() || "nuevo_proyecto";
}

/**
 * Captura campos de runtime del estado que pertenecen a cada pestaña.
 * @param {Record<string, any>} stateObj
 * @param {(tilesets: any[]) => any[]} cloneTilesetsFn
 * @returns {Record<string, any>}
 */
export function captureRuntimeExtrasFromState(stateObj, cloneTilesetsFn) {
  return {
    zoom: stateObj.zoom || 1,
    tiledMode: stateObj.tiledMode || "none",
    currentColorIndex: stateObj.currentColorIndex ?? 1,
    secondaryColorIndex: stateObj.secondaryColorIndex ?? 0,
    sourceImageFile: stateObj.sourceImageFile || null,
    sourceImportOptions: stateObj.sourceImportOptions ? { ...stateObj.sourceImportOptions } : null,
    resBaseSnapshot: stateObj.resBaseSnapshot || null,
    originalImport: stateObj.originalImport || null,
    hasCustomReducedPalette: Boolean(stateObj.hasCustomReducedPalette),
    tilesets: cloneTilesetsFn(stateObj.tilesets),
    activeTilesetId: stateObj.activeTilesetId || null,
    activeTileIndex: stateObj.activeTileIndex ?? 1,
    tilemapMode: stateObj.tilemapMode || "tiles",
    tileFlipH: Boolean(stateObj.tileFlipH),
    tileFlipV: Boolean(stateObj.tileFlipV),
    tileRot: Number(stateObj.tileRot || 0),
    undoStack: Array.isArray(stateObj.undoStack) ? [...stateObj.undoStack] : [],
    redoStack: Array.isArray(stateObj.redoStack) ? [...stateObj.redoStack] : [],
  };
}

/**
 * Restaura en `stateObj` los campos de runtime guardados en una pestaña.
 * @param {Record<string, any>} target
 * @param {Record<string, any>} stateObj
 * @param {(tilesets: any[]) => any[]} cloneTilesetsFn
 */
export function applyTabExtrasToState(target, stateObj, cloneTilesetsFn) {
  stateObj.undoStack = Array.isArray(target.undoStack) ? [...target.undoStack] : [];
  stateObj.redoStack = Array.isArray(target.redoStack) ? [...target.redoStack] : [];
  stateObj.sourceImageFile = target.sourceImageFile || null;
  stateObj.sourceImportOptions = target.sourceImportOptions ? { ...target.sourceImportOptions } : null;
  stateObj.resBaseSnapshot = target.resBaseSnapshot || null;
  stateObj.originalImport = target.originalImport || null;
  stateObj.hasCustomReducedPalette = Boolean(target.hasCustomReducedPalette);
  if (Array.isArray(target.tilesets)) {
    stateObj.tilesets = cloneTilesetsFn(target.tilesets);
  }
  stateObj.activeTilesetId = target.activeTilesetId || stateObj.tilesets?.[0]?.id || null;
  stateObj.activeTileIndex = target.activeTileIndex ?? 1;
  stateObj.tilemapMode = target.tilemapMode || "tiles";
  stateObj.tileFlipH = Boolean(target.tileFlipH);
  stateObj.tileFlipV = Boolean(target.tileFlipV);
  stateObj.tileRot = Number(target.tileRot || 0);
  stateObj.currentColorIndex = target.currentColorIndex ?? 1;
  stateObj.secondaryColorIndex = target.secondaryColorIndex ?? 0;
}

/**
 * Determina si solo existe la pestaña inicial vacía y sin cambios para reutilizarla.
 * @param {Array<Record<string, any>>} tabs
 * @param {Record<string, any>} stateObj
 * @returns {boolean}
 */
export function isInitialPristineTab(tabs, stateObj) {
  return (
    tabs.length === 1 &&
    !tabs[0].dirty &&
    tabs[0].name === "nuevo_proyecto" &&
    (!stateObj.undoStack || stateObj.undoStack.length === 0) &&
    !stateObj.isDirtySinceImport
  );
}

/**
 * Calcula el plan de cierre de una pestaña sin mutar el array original.
 * @param {Array<{ id: string }>} tabs
 * @param {string|null} activeTabId
 * @param {string} targetTabId
 * @returns {{ action: "noop"|"launch"|"closed", index: number, wasActive: boolean, nextTabId: string|null }}
 */
export function computeTabClosePlan(tabs, activeTabId, targetTabId) {
  const index = tabs.findIndex((t) => t.id === targetTabId);
  if (index === -1) {
    return { action: "noop", index: -1, wasActive: false, nextTabId: null };
  }
  if (tabs.length <= 1) {
    return { action: "launch", index, wasActive: targetTabId === activeTabId, nextTabId: null };
  }
  const wasActive = targetTabId === activeTabId;
  let nextTabId = null;
  if (wasActive) {
    const remainingCount = tabs.length - 1;
    const nextIdxAfterRemoval = Math.min(index, remainingCount - 1);
    const candidate = index <= nextIdxAfterRemoval ? tabs[nextIdxAfterRemoval + 1] : tabs[nextIdxAfterRemoval];
    nextTabId = candidate?.id ?? null;
  }
  return { action: "closed", index, wasActive, nextTabId };
}

/**
 * Construye el view-model de texto y dimensiones para renderizar una pestaña.
 * @param {Record<string, any>} tab
 * @param {boolean} isActive
 * @param {{ gridSize?: number, gridWidth?: number, gridHeight?: number }} [fallbackDims={}]
 * @returns {{ id: string, isActive: boolean, title: string, labelText: string, sizeText: string }}
 */
export function formatDocTabViewModel(tab, isActive, fallbackDims = {}) {
  const tw = tab.gridWidth || tab.gridSize || fallbackDims.gridWidth || fallbackDims.gridSize;
  const th = tab.gridHeight || tab.gridSize || fallbackDims.gridHeight || fallbackDims.gridSize;
  return {
    id: tab.id,
    isActive: Boolean(isActive),
    title: `${tab.name} (${tw}×${th})`,
    labelText: tab.dirty ? `• ${tab.name}` : `${tab.name}`,
    sizeText: tw === th ? `${tw}` : `${tw}×${th}`,
  };
}
