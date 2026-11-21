/**
 * app.js: Composition root de la aplicación.
 * Solo orquesta el montaje de vistas, inicialización de subsistemas y registro de acciones.
 */

import { fetchConfig } from "./core/api.js";
import { state, subscribe } from "./core/state.js";
import { initFlightRecorder } from "./core/flightRecorder.js";
import { initCanvas, renderAll, applyZoom } from "./canvas/canvas.js";
import { renderRulers } from "./canvas/rulers.js";
import { setupMouseEvents, setupKeyboardShortcuts } from "./input.js";
import { i18n } from "./i18n/I18nService.js";
import * as ui from "./ui/index.js";
import { registerAppActions } from "./ui/actionBindings.js";
import { setupUploadControls, setupThemeSelector, setupEditorDragAndDrop } from "./ui/editorInputWiring.js";
import { initTilemapModule } from "./workspace/tilemap.js";
import { initCustomBrushes } from "./tools/customBrushes.js";
import { initDocTabs, renameActiveDocTab, markActiveTabDirty } from "./workspace/docTabs.js";
import { setupTimelineResizer, syncLinkedCelsForActiveLayer } from "./workspace/timelineMatrix.js";
import { initLauncher, hideLauncher, populateLauncherThemes } from "./workspace/launcher.js";
import { scheduleAutosave } from "./core/storage.js";
import { renderLayersUI } from "./workspace/layers.js";
import { renderFramesUI } from "./workspace/frames.js";
import { refreshHistoryList } from "./workspace/spriteActions.js";
import { setupColorMixer } from "./workspace/paletteIO.js";
import {
  populateThemeSelect,
  syncThemeSelectValue,
  buildPaletteUI,
  renderCustomPaletteUI,
  applyTheme,
  prepareFreeColor,
  highlightCurrentSwatch,
} from "./workspace/paletteManager.js";

function mountViews() {
  ui.mountLauncherOverlay();
  ui.mountTopBar();
  ui.mountTopMenu();
  ui.mountLeftSidebar();
  ui.mountBottomBar();
  ui.mountRightSidebar();
  ui.mountPrimaryModals();
  ui.mountSecondaryModals();
}

function subscribeStateObservers() {
  subscribe("history", () => {
    syncLinkedCelsForActiveLayer();
    ui.updateResolutionButtons(state.gridWidth || state.gridSize, state.gridHeight || state.gridSize);
    syncThemeSelectValue();
    buildPaletteUI();
    renderCustomPaletteUI();
    renderLayersUI();
    renderFramesUI();
    applyZoom(state.zoom || 1);
  });

  subscribe("dirty", () => {
    scheduleAutosave();
    markActiveTabDirty();
  });
}

function initSubsystems() {
  initFlightRecorder();
  ui.loadUserPreferences();
  ui.initPreferencesModal();
  ui.initDomTranslator();
  i18n.init();
  i18n.addEventListener("langchange", () => ui.setStatus({ key: "status.lang_changed" }));
  ui.initDeclarativeActions();

  const canvas = document.getElementById("paintCanvas");
  initCanvas(canvas);
  setupMouseEvents(canvas);
  setupKeyboardShortcuts();
  setupUploadControls();
  setupThemeSelector();
  ui.setupPanelControls();
  ui.setupTopMenu();
  ui.setupCustomSelects();
  setupColorMixer();
  setupEditorDragAndDrop();
  initLauncher();
  if (new URLSearchParams(window.location.search).get("view") === "editor") hideLauncher();

  ui.initColorTheme();
  ui.initLogHistory();
  ui.initUiScale();
  ui.initCanvasBgIntensity();
  initTilemapModule();
  ui.updateToolOptionsUI(state.currentTool || "pencil");
  ui.refreshIcons();
}

window.addEventListener("DOMContentLoaded", async () => {
  mountViews();
  initSubsystems();
  subscribeStateObservers();

  try {
    const config = await fetchConfig();
    state.themesCatalog = config.themes || {};
    state.currentThemeKey = config.default_theme || Object.keys(state.themesCatalog)[0];
    populateThemeSelect();
    populateLauncherThemes();
    applyTheme(state.currentThemeKey, { recordHistory: false });
    renderLayersUI();
    renderFramesUI();
    renderRulers();
    initDocTabs();
    setupTimelineResizer();
    initCustomBrushes();
    ui.initColorWheel({
      onSelectColor: (hex, isSecondary) => {
        if (isSecondary) {
          const prev = state.currentColorIndex;
          prepareFreeColor(hex);
          state.secondaryColorIndex = state.currentColorIndex;
          state.currentColorIndex = prev;
          highlightCurrentSwatch();
        } else {
          prepareFreeColor(hex);
        }
      },
    });
    document.getElementById("assetName")?.addEventListener("input", (e) => renameActiveDocTab(e.target.value));
    await refreshHistoryList();
  } catch (err) {
    ui.setStatus({ key: "log.init_err", params: { msg: err.message } }, true);
  }
});

registerAppActions();
