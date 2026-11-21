/**
 * tilemap.js: Fachada pública del subsistema Tilemap + Tileset.
 * Re-exporta modelo, sincronización, herramientas, operaciones de tileset, exportadores y UI.
 */

export {
  packTileEntry,
  unpackTileEntry,
  getTransformedTilePixels,
  getInverseTransformedTilePixels,
  getTilesetById,
  getActiveTileset,
  getActiveTilemapLayer,
  getTileGridDims,
  createTileset,
  syncTilemapLayerToGrid,
} from "../state/TilemapModel.js";

export {
  exportActiveTilesetPng,
  exportActiveTilemapJson,
} from "./tilemapExporter.js";

export {
  addNewTilemapLayer,
  syncAllTilemapLayers,
  reconcileLayerTilemap,
  reconcileActiveTilemapLayer,
  convertLayerToTilemap,
  rasterizeTilemapLayer,
} from "./tilemapSync.js";

export {
  isTilemapTileModeActive,
  getTilemapToolStrategy,
  drawTilemapCanvasOverlay,
} from "./tilemapTools.js";

export {
  selectTileInTileset,
  selectActiveTilesetById,
  addEmptyTileToActiveTileset,
  duplicateActiveTile,
  deleteActiveTile,
  pruneUnusedTiles,
  reorderTileInActiveTileset,
  setTilemapMode,
  toggleTileFlipH,
  toggleTileFlipV,
  rotateActiveTilePlacement,
  toggleTilemapGrid,
  setTilesetThumbSize,
} from "./tilemapTilesetOps.js";

export {
  openNewTilemapModal,
  openConvertLayerToTilemapModal,
  setTilemapModalPreset,
  closeTilemapModal,
  confirmTilemapModal,
  setTilesetPanelVisible,
  toggleTilesetPanel,
  renderTilesetPanelUI,
  initTilemapModule,
} from "./tilemapPanelUI.js";

export {
  parseTilemapJsonPayload,
  sliceImageDataToTiles,
  openTilemapImportModal,
  closeTilemapImportModal,
  setTilemapImportPreset,
  clearTilemapImportSlot,
  confirmTilemapImportModal,
} from "./tilemapImporter.js";
