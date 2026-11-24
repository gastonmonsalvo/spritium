/**
 * actionBindings.js: Registro centralizado de comandos declarativos (`data-action` / `data-change` / `data-input`).
 */

import { fetchConfig } from "../core/api.js";
import { state } from "../core/state.js";
import { performUndo, performRedo } from "../input.js";
import { saveProjectFile, loadProjectFile } from "../core/projectIO.js";
import * as ui from "./index.js";
import * as ft from "../tools/freeTransform.js";
import * as tr from "../tools/transforms.js";
import * as cb from "../tools/customBrushes.js";
import * as tm from "../workspace/tilemap.js";
import * as ly from "../workspace/layers.js";
import * as fr from "../workspace/frames.js";
import * as pm from "../workspace/paletteManager.js";
import * as pio from "../workspace/paletteIO.js";
import * as sa from "../workspace/spriteActions.js";
import * as em from "../workspace/exportModal.js";
import * as fb from "../workspace/folderBrowser.js";
import * as tx from "../workspace/timelineMatrix.js";
import * as rm from "../workspace/recoveryModal.js";
import * as ln from "../workspace/launcher.js";
import * as nm from "./modals/NoiseModal.js";
import * as nrm from "./modals/NormalMapModal.js";
import * as hsl from "./modals/HslModal.js";
import * as dsm from "./modals/DropShadowModal.js";
import * as cm from "./modals/ConfirmModal.js";

function buildTransformActions() {
  return {
    startFreeTransform: ft.startFreeTransform,
    commitFreeTransform: ft.commitFreeTransform,
    cancelFreeTransform: ft.cancelFreeTransform,
    setFreeTransformMode: ft.setFreeTransformMode,
    rotateFreeTransformBy: ft.rotateFreeTransformBy,
    copyAction: () => { const { w, h } = tr.copySelection(); ui.setStatus({ key: "log.copied", params: { w, h } }, false, "pixel"); },
    cutAction: () => { const { w, h } = tr.cutSelection(); ui.setStatus({ key: "log.cut", params: { w, h } }, false, "pixel"); },
    pasteAction: () => {
      if (tr.pasteClipboard()) ui.setStatus({ key: "log.pasted" }, false, "pixel");
      else ui.setStatus({ key: "log.clipboard_empty" }, true);
    },
    flipSelectionH: () => { tr.flipSelectionOrCanvas("h"); ui.setStatus({ key: "log.flipped_h" }, false, "pixel"); },
    flipSelectionV: () => { tr.flipSelectionOrCanvas("v"); ui.setStatus({ key: "log.flipped_v" }, false, "pixel"); },
    rotateSelection90: () => { tr.rotate90SelectionOrCanvas(); ui.setStatus({ key: "log.rotated_90" }, false, "pixel"); },
    rotateSelection180: () => { tr.rotate180SelectionOrCanvas(); ui.setStatus({ key: "log.rotated_180" }, false, "pixel"); },
    rotSpriteAction: () => {
      const deg = Number(document.getElementById("rotAngleInput")?.value || 0);
      if (!deg) { ui.setStatus({ key: "log.rot_angle_zero" }, true); return; }
      tr.rotSpriteRotate(deg);
      ui.setStatus({ key: "log.rotsprite_applied", params: { deg } }, false, "pixel");
    },
    outlineAction: () => {
      const count = tr.applyOutline();
      ui.setStatus(count > 0 ? { key: "log.outline_applied", params: { count } } : { key: "log.outline_none" }, false, count > 0 ? "pixel" : "ui");
    },
    erodeOutlineAction: () => {
      const count = tr.erodeOutline();
      ui.setStatus(count > 0 ? { key: "log.erode_applied", params: { count } } : { key: "log.erode_none" }, false, count > 0 ? "pixel" : "ui");
    },
    nudgeAction: (dx, dy) => {
      tr.nudgeSprite(dx, dy);
      ui.setStatus({ key: "log.nudged", params: { dx: dx >= 0 ? `+${dx}` : dx, dy: dy >= 0 ? `+${dy}` : dy } }, false, "pixel");
    },
    shiftWrapAction: (dx, dy) => {
      if (tr.shiftCanvasWrap(dx, dy)) ui.setStatus({ key: "log.wrapped", params: { dx: dx >= 0 ? `+${dx}` : dx, dy: dy >= 0 ? `+${dy}` : dy } }, false, "pixel");
    },
    shiftWrapHalf: () => {
      const hw = Math.floor((state.gridWidth || state.gridSize || 64) / 2);
      const hh = Math.floor((state.gridHeight || state.gridSize || 64) / 2);
      if (tr.shiftCanvasWrap(hw, hh)) ui.setStatus({ key: "log.wrapped_half", params: { hw, hh } }, false, "pixel");
    },
    alignAction: (mode) => { if (tr.alignContent(mode)) ui.setStatus({ key: "log.aligned", params: { mode } }, false, "pixel"); },
  };
}

function buildWorkspaceActions() {
  return {
    useCustomColor: pm.useCustomColor,
    addCustomToPalette: pio.addCustomToPalette,
    swapPrimarySecondaryColors: pm.swapPrimarySecondaryColors,
    resetSecondaryColorToTransparent: pm.resetSecondaryColorToTransparent,
    openSlotColorPicker: pm.openSlotColorPicker,
    prepareFreeColor: pm.prepareFreeColor,
    reduceCurrentPaletteColors: (n) => pio.reduceCurrentPaletteColors(typeof n === "number" ? n : null),
    openPaletteDialog: () => document.getElementById("paletteFileInput")?.click(),
    exportCurrentPalette: (fmt) => pio.exportCurrentPalette(typeof fmt === "string" ? fmt : "hex"),
    createNewCustomPalette: pio.createNewCustomPalette,
    closeNewPaletteModal: pio.closeNewPaletteModal,
    confirmCreateNewPalette: pio.confirmCreateNewPalette,
    addNewLayer: () => ly.addNewLayer(),
    addNewFolder: () => ly.addNewFolder(),
    duplicateActiveLayer: ly.duplicateActiveLayer,
    deleteActiveLayer: ly.deleteActiveLayer,
    mergeLayerDown: ly.mergeLayerDown,
    mergeSelectedLayers: ly.mergeSelectedLayers,
    mergeVisibleLayers: ly.mergeVisibleLayers,
    setActiveLayerOpacity: ly.setActiveLayerOpacity,
    setActiveLayerBlendMode: ly.setActiveLayerBlendMode,
    setActiveLayerOpacityFromEvent: (e) => ly.setActiveLayerOpacity(e.target.value),
    setActiveLayerBlendModeFromEvent: (e) => ly.setActiveLayerBlendMode(e.target.value),
    setOnionSkinOpacity: (e) => fr.setOnionSkinOption("opacity", Number(e.target.value) / 100),
    setOnionSkinPrevCount: (e) => fr.setOnionSkinOption("prevCount", Number(e.target.value)),
    setOnionSkinNextCount: (e) => fr.setOnionSkinOption("nextCount", Number(e.target.value)),
    selectActiveTilesetByEvent: (e) => tm.selectActiveTilesetById(e.target.value),
    addNewFrame: () => fr.addFrame({ duplicate: false }),
    duplicateFrame: () => fr.addFrame({ duplicate: true }),
    deleteActiveFrame: fr.deleteActiveFrame,
    toggleOnionSkin: fr.toggleOnionSkin,
    setOnionSkinOption: fr.setOnionSkinOption,
    togglePlayAnimation: fr.togglePlayAnimation,
    goToFirstFrame: fr.goToFirstFrame,
    goToPrevFrame: fr.goToPrevFrame,
    goToNextFrame: fr.goToNextFrame,
    goToLastFrame: fr.goToLastFrame,
    exportSpritesheet: fr.exportSpritesheet,
    exportPureSpritesheetPng: fr.exportPureSpritesheetPng,
    exportPackedAtlas: fr.exportPackedAtlas,
    openExportModal: (fmt) => em.openExportModal(typeof fmt === "string" ? fmt : "png"),
    closeExportModal: em.closeExportModal,
    updateExportModalPreview: em.updateExportModalPreview,
    executeConfiguredExport: em.executeConfiguredExport,
    toggleTimelineExpanded: tx.toggleTimelineExpanded,
    createFrameTagDialog: tx.createFrameTagDialog,
    closeTagModal: tx.closeTagModal,
    confirmCreateFrameTag: tx.confirmCreateFrameTag,
    toggleTilesetPanel: tm.toggleTilesetPanel,
    openNewTilemapModal: tm.openNewTilemapModal,
    openConvertLayerToTilemapModal: (layerIndex) =>
      tm.openConvertLayerToTilemapModal(typeof layerIndex === "number" ? layerIndex : undefined),
    setTilemapModalPreset: tm.setTilemapModalPreset,
    closeTilemapModal: tm.closeTilemapModal,
    confirmTilemapModal: tm.confirmTilemapModal,
    selectActiveTilesetById: tm.selectActiveTilesetById,
    setTilemapMode: tm.setTilemapMode,
    toggleTileFlipH: tm.toggleTileFlipH,
    toggleTileFlipV: tm.toggleTileFlipV,
    rotateActiveTilePlacement: tm.rotateActiveTilePlacement,
    toggleTilemapGrid: tm.toggleTilemapGrid,
    setTilesetThumbSize: tm.setTilesetThumbSize,
    addEmptyTileToActiveTileset: tm.addEmptyTileToActiveTileset,
    duplicateActiveTile: tm.duplicateActiveTile,
    deleteActiveTile: tm.deleteActiveTile,
    pruneUnusedTiles: tm.pruneUnusedTiles,
    exportActiveTilesetPng: tm.exportActiveTilesetPng,
    exportActiveTilemapJson: tm.exportActiveTilemapJson,
    openTilemapImportModal: () => tm.openTilemapImportModal(),
    closeTilemapImportModal: tm.closeTilemapImportModal,
    setTilemapImportPreset: tm.setTilemapImportPreset,
    clearTilemapImportSlot: (slot) => tm.clearTilemapImportSlot(typeof slot === "string" ? slot : ""),
    confirmTilemapImportModal: () => tm.confirmTilemapImportModal(),
  };
}

/** Registra todas las acciones UI en el `DomRegistry` sin contaminar `window`. */
export function registerAppActions() {
  ui.registerActions({
    undo: performUndo,
    redo: performRedo,
    toggleLogHistory: ui.toggleLogHistory,
    closeLogHistory: ui.closeLogHistory,
    clearLogHistory: ui.clearLogHistory,
    toggleUiLogs: ui.toggleUiLogs,
    setTool: ui.setTool,
    setBrushSize: ui.setBrushSize,
    selectActiveShapeTool: ui.selectActiveShapeTool,
    selectActiveFilterTool: ui.selectActiveFilterTool,
    setLineMode: ui.setLineMode,
    setLineStyle: ui.setLineStyle,
    setCurveControlPoints: ui.setCurveControlPoints,
    toggleMirrorH: ui.toggleMirrorH,
    toggleMirrorV: ui.toggleMirrorV,
    toggleMirrorDiagMain: ui.toggleMirrorDiagMain,
    toggleMirrorDiagAnti: ui.toggleMirrorDiagAnti,
    toggleMirrorRadial: ui.toggleMirrorRadial,
    setSymmetryCenterMode: ui.setSymmetryCenterMode,
    setSymmetryAxisXFromEvent: (e) => ui.setSymmetryAxisX(e?.target?.value),
    setSymmetryAxisYFromEvent: (e) => ui.setSymmetryAxisY(e?.target?.value),
    toggleSymmetryAxisDragMode: ui.toggleSymmetryAxisDragMode,
    centerSymmetryOnSelection: ui.centerSymmetryOnSelection,
    resetSymmetryAxes: ui.resetSymmetryAxes,
    clearRulerGuides: ui.clearRulerGuides,
    toggleGrid: ui.toggleGrid,
    toggleCenterGuides: ui.toggleCenterGuides,
    toggleCenterRulerMarks: ui.toggleCenterRulerMarks,
    toggleRulers: ui.toggleRulers,
    toggleGridCoords: ui.toggleGridCoords,
    togglePixelCursor: ui.togglePixelCursor,
    setTiledMode: ui.setTiledMode,
    setUiScale: ui.setUiScale,
    initUiScale: ui.initUiScale,
    zoomIn: ui.zoomIn,
    zoomOut: ui.zoomOut,
    resetZoom: ui.resetZoom,
    toggleColorWheelPanel: ui.toggleColorWheelPanel,
    setCanvasBgFromEvent: (e) => ui.setCanvasBgIntensity(e.target.value),
    setCanvasBgIntensity: ui.setCanvasBgIntensity,
    toggleLeftPanel: ui.toggleLeftPanel,
    toggleRightPanel: ui.toggleRightPanel,
    toggleBottomPanel: ui.toggleBottomPanel,
    toggleMobileDrawer: ui.toggleMobileDrawer,
    toggleMobilePanTool: () => {
      ui.closeMobileDrawers();
      ui.toggleMobilePanTool();
    },
    resetDockedPanels: ui.resetDockedPanels,
    toggleColorTheme: ui.toggleColorTheme,
    triggerWin98EasterEgg: ui.triggerWin98EasterEgg,
    exportUserConfig: ui.exportUserConfig,
    openHelpModal: ui.openHelpModal,
    closeHelpModal: ui.closeHelpModal,
    openPreferencesModal: ui.openPreferencesModal,
    closePreferencesModal: ui.closePreferencesModal,
    openLanguageModal: ui.openLanguageModal,
    closeLanguageModal: ui.closeLanguageModal,
    openAboutModal: ui.openAboutModal,
    closeAboutModal: ui.closeAboutModal,
    openFeedbackModal: ui.openFeedbackModal,
    closeFeedbackModal: ui.closeFeedbackModal,
    setFeedbackCategory: ui.setFeedbackCategory,
    setFeedbackRating: ui.setFeedbackRating,
    toggleFeedbackTelemetryPreview: ui.toggleFeedbackTelemetryPreview,
    refreshFeedbackTelemetryPreview: ui.refreshFeedbackTelemetryPreview,
    downloadFeedbackDiagnosticBundle: ui.downloadFeedbackDiagnosticBundle,
    copyFeedbackReportMarkdown: ui.copyFeedbackReportMarkdown,
    openFeedbackGithubIssue: ui.openFeedbackGithubIssue,
    submitFeedbackReport: ui.submitFeedbackReport,
    downloadCurrent: sa.downloadCurrent,
    loadSelectedSprite: sa.loadSelectedSprite,
    changeResolution: sa.changeResolution,
    applyCustomResolution: () => sa.changeResolution(document.getElementById("customResW")?.value, document.getElementById("customResH")?.value),
    createBrushFromSelection: cb.createBrushFromSelection,
    toggleCustomBrushColorMode: cb.toggleCustomBrushColorMode,
    exportCustomBrushes: cb.exportCustomBrushes,
    openCustomBrushDialog: () => document.getElementById("brushFileInput")?.click(),
    saveProjectFile,
    openProjectDialog: () => document.getElementById("projectFileInput")?.click(),
    openImageDialog: () => document.getElementById("fileInput")?.click(),
    reopenImportOptions: ln.reopenImportOptionsModal,
    openCustomResModal: () => document.getElementById("customResModal")?.classList.add("open"),
    closeCustomResModal: () => document.getElementById("customResModal")?.classList.remove("open"),
    submitCustomResModal: () => {
      sa.changeResolution(document.getElementById("customResW")?.value, document.getElementById("customResH")?.value);
      document.getElementById("customResModal")?.classList.remove("open");
    },
    openLauncherFileInput: () => document.getElementById("launcherFileInput")?.click(),
    openLauncherDocs: () => window.open("./docs/index.html?doc=HELP.md&from=launcher", "_blank", "noopener,noreferrer"),
    openFolderDialog: () => fb.openFolderDialog({ onOpenProject: loadProjectFile, onOpenImage: (f) => ln.openImportModal(f) }),
    openLoadedMediaModal: () => fb.openLoadedMediaModal({ onOpenProject: loadProjectFile, onOpenImage: (f) => ln.openImportModal(f) }),
    closeFolderBrowserModal: fb.closeFolderBrowserModal,
    showLauncher: ln.showLauncher,
    openNewDocModal: ln.openNewDocModal,
    closeNewDocModal: ln.closeNewDocModal,
    closeImportModal: ln.closeImportModal,
    openRecoveryModal: rm.openRecoveryModal,
    closeRecoveryModal: rm.closeRecoveryModal,
    openNoiseModal: nm.openNoiseModal,
    closeNoiseModal: nm.closeNoiseModal,
    applyNoiseModal: nm.applyNoiseModal,
    randomizeNoiseSeed: nm.randomizeNoiseSeed,
    openHslModal: hsl.openHslModal,
    closeHslModal: hsl.closeHslModal,
    applyHslModal: hsl.applyHslModal,
    resetHslModal: hsl.resetHslModal,
    openDropShadowModal: dsm.openDropShadowModal,
    closeDropShadowModal: dsm.closeDropShadowModal,
    applyDropShadowModal: dsm.applyDropShadowModal,
    resolveConfirmDialog: cm.resolveConfirmDialog,
    openNormalMapModal: nrm.openNormalMapModal,
    closeNormalMapModal: nrm.closeNormalMapModal,
    setNormalViewMode: nrm.setNormalViewMode,
    toggleNormalAnimPreview: nrm.toggleNormalAnimPreview,
    openNormalMapInNewTab: nrm.openNormalMapInNewTab,
    exportNormalMapPng: nrm.exportNormalMapPng,
    exportNormalMapStrip: nrm.exportNormalMapStrip,
    openConfigDialog: () => document.getElementById("configFileInput")?.click(),
    resetAllUserConfig: () => ui.resetAllUserConfig({
      onPalettesChanged: async () => {
        cb.resetUserBrushes();
        const cfg = await fetchConfig();
        state.themesCatalog = cfg.themes || {};
        pm.populateThemeSelect();
        ln.populateLauncherThemes();
      },
    }),
    ...buildTransformActions(),
    ...buildWorkspaceActions(),
  }, { exposeOnWindow: false });
}
