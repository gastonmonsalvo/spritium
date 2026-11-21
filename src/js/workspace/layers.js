/**
 * layers.js: Fachada pública del subsistema de capas.
 * Re-exporta modelo/selección (`layersOps.js`), CRUD (`layersCrudOps.js`), fusiones/orden (`layersMergeAndOrderOps.js`) y UI (`layersUI.js`).
 */

export {
  LAYER_BLEND_MODES,
  getSelectedLayerIndices,
  createLayer,
  isLayerLocked,
  isActiveLayerLocked,
  toggleLayerLock,
  syncActiveLayerGrid,
  resetLayersWithGrid,
  setActiveLayerBlendMode,
  setActiveLayerOpacity,
  selectLayer,
  toggleLayerVisibility,
} from "./layersOps.js";

export {
  addNewLayer,
  addNewFolder,
  toggleFolderCollapsed,
  moveLayerToFolder,
  duplicateLayerAt,
  duplicateActiveLayer,
  deleteLayerAt,
  deleteActiveLayer,
  clearLayerAt,
  copyLayerToClipboard,
  cutLayerToClipboard,
  pasteClipboardAsLayer,
} from "./layersCrudOps.js";

export {
  mergeLayerIndices,
  mergeLayerDown,
  mergeSelectedLayers,
  mergeVisibleLayers,
  reorderLayer,
  moveLayerOrder,
} from "./layersMergeAndOrderOps.js";

export {
  startInlineRename,
  renameActiveLayerInline,
  renderLayersUI,
} from "./layersUI.js";
