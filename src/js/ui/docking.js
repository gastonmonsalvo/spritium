/**
 * docking.js: Paneles colapsables, divisores redimensionables y fachada de módulos acoplables/flotantes.
 */

import { applyZoom, togglePreviewPlayback, syncPreviewPlayButton } from "../canvas/canvas.js";
import { refreshIcons } from "./status.js";
import { i18n } from "../i18n/I18nService.js";
import { setBrushSize, initToolOptionsControls } from "./toolsUI.js";
import { swapPrimarySecondaryColors } from "../workspace/paletteManager.js";
import {
  LAYOUT_STORAGE_KEY,
  DOCK_MODULES,
  restoreLayoutState,
  resetDockedPanels,
} from "./dockingLayoutStorage.js";
import { setupDockableModule } from "./dockingDragController.js";

export { LAYOUT_STORAGE_KEY, restoreLayoutState, resetDockedPanels };

if (typeof window !== "undefined") {
  i18n.addEventListener("langchange", () => {
    document.querySelectorAll(".dock-module").forEach((mod) => {
      const flt = mod.querySelector(".module-float-btn");
      if (flt) flt.title = i18n.t("dock.float_title");
      const pin = mod.querySelector(".module-pin-btn");
      if (pin) pin.title = i18n.t(mod.classList.contains("is-pinned") ? "dock.unpin" : "dock.pin");
    });
  });
}

function syncMobileDockButtons() {
  const sidebar = document.getElementById("sidebar");
  const rightSidebar = document.getElementById("rightSidebar");
  const moduleFrames = document.getElementById("moduleFrames");
  const rightOpen = Boolean(rightSidebar && !rightSidebar.classList.contains("collapsed"));
  const rightTab = rightSidebar?.dataset?.mobileTab || "right";
  document.getElementById("btnMobileTools")?.classList.toggle("active", Boolean(sidebar && !sidebar.classList.contains("collapsed")));
  document.getElementById("btnMobileSwapColors")?.classList.toggle("active", rightOpen && rightTab === "colors");
  document.getElementById("btnMobileLayers")?.classList.toggle("active", rightOpen && rightTab !== "colors");
  document.getElementById("btnMobileFrames")?.classList.toggle("active", Boolean(moduleFrames && !moduleFrames.classList.contains("collapsed")));
}

/**
 * Alterna un panel como drawer desplegable en pantallas móviles (`<= 860px`),
 * cerrando los otros dos paneles para mantener el lienzo siempre visible.
 * @param {"left"|"right"|"colors"|"bottom"} side - Panel o pestaña móvil a abrir o cerrar.
 */
export function toggleMobileDrawer(side) {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 860;
  const rightSidebar = document.getElementById("rightSidebar");
  const targets = {
    left: { el: document.getElementById("sidebar"), toggle: toggleLeftPanel },
    right: { el: rightSidebar, toggle: toggleRightPanel },
    colors: { el: rightSidebar, toggle: toggleRightPanel },
    bottom: { el: document.getElementById("moduleFrames"), toggle: toggleBottomPanel },
  };
  const chosen = targets[side];
  if (!chosen?.el) return;

  if (side === "colors" || side === "right") {
    const prevTab = rightSidebar?.dataset?.mobileTab || "right";
    const isAlreadyOpen = !chosen.el.classList.contains("collapsed");
    if (isMobile && isAlreadyOpen && prevTab !== side) {
      rightSidebar.dataset.mobileTab = side;
      syncMobileDockButtons();
      return;
    }
    if (rightSidebar) rightSidebar.dataset.mobileTab = side;
  }

  const willOpen = chosen.el.classList.contains("collapsed");
  if (isMobile && willOpen) {
    for (const [k, item] of Object.entries(targets)) {
      if (k !== side && item.el && item.el !== chosen.el && !item.el.classList.contains("collapsed")) {
        item.toggle();
      }
    }
  }
  chosen.toggle();
  syncMobileDockButtons();
}

/** Cierra cualquier drawer móvil abierto en pantallas `<= 860px`. */
export function closeMobileDrawers() {
  if (typeof window === "undefined" || window.innerWidth > 860) return false;
  let closedAny = false;
  const pairs = [
    [document.getElementById("sidebar"), toggleLeftPanel],
    [document.getElementById("rightSidebar"), toggleRightPanel],
    [document.getElementById("moduleFrames"), toggleBottomPanel],
  ];
  for (const [el, toggle] of pairs) {
    if (el && !el.classList.contains("collapsed")) {
      toggle();
      closedAny = true;
    }
  }
  if (closedAny) syncMobileDockButtons();
  return closedAny;
}

/** Muestra u oculta el panel lateral izquierdo. */
export function toggleLeftPanel() {
  const sidebar = document.getElementById("sidebar");
  const btnExpandLeft = document.getElementById("btnExpandLeft");
  if (!sidebar || !btnExpandLeft) return;
  const collapsed = sidebar.classList.toggle("collapsed");
  btnExpandLeft.classList.toggle("visible", collapsed);
  document.getElementById("menuLeftPanel")?.classList.toggle("active", !collapsed);
  syncMobileDockButtons();
}

/** Muestra u oculta el panel lateral derecho. */
export function toggleRightPanel() {
  const rightSidebar = document.getElementById("rightSidebar");
  const btnExpandRight = document.getElementById("btnExpandRight");
  if (!rightSidebar || !btnExpandRight) return;
  const collapsed = rightSidebar.classList.toggle("collapsed");
  btnExpandRight.classList.toggle("visible", collapsed);
  document.getElementById("menuRightPanel")?.classList.toggle("active", !collapsed);
  syncMobileDockButtons();
}

/** Muestra u oculta el panel inferior (Frames y Timeline). */
export function toggleBottomPanel() {
  const moduleFrames = document.getElementById("moduleFrames");
  const btnExpandBottom = document.getElementById("btnExpandBottom");
  if (!moduleFrames || !btnExpandBottom) return;
  const collapsed = moduleFrames.classList.toggle("collapsed");
  btnExpandBottom.classList.toggle("visible", collapsed);
  document.getElementById("menuBottomPanel")?.classList.toggle("active", !collapsed);
  syncMobileDockButtons();
}

function bindSidebarResizer(resizer, target, computeWidth) {
  if (!resizer || !target) return;
  let isResizing = false;
  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    isResizing = true;
    resizer.classList.add("dragging");
    document.body.style.cursor = "col-resize";
  });
  window.addEventListener("mousemove", (e) => {
    if (isResizing) target.style.width = `${computeWidth(e)}px`;
  });
  window.addEventListener("mouseup", () => {
    if (!isResizing) return;
    isResizing = false;
    resizer.classList.remove("dragging");
    document.body.style.cursor = "";
  });
}

function bindBrushAndZoomSliders() {
  const brushRange = document.getElementById("brushSizeInput");
  if (brushRange) {
    brushRange.addEventListener("input", () => setBrushSize(brushRange.value, false));
    brushRange.addEventListener("change", () => setBrushSize(brushRange.value, true));
  }
  const brushNum = document.getElementById("brushSizeNumber");
  if (brushNum) {
    brushNum.addEventListener("input", () => { if (brushNum.value !== "") setBrushSize(brushNum.value, false); });
    brushNum.addEventListener("change", () => setBrushSize(brushNum.value, true));
  }
  initToolOptionsControls();

  const zoomSlider = document.getElementById("zoomSlider");
  if (zoomSlider) zoomSlider.addEventListener("input", () => applyZoom(Number(zoomSlider.value) / 100));

  const btnPreviewPlay = document.getElementById("btnPreviewPlay");
  if (btnPreviewPlay) {
    btnPreviewPlay.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePreviewPlayback();
      refreshIcons(btnPreviewPlay);
    });
    syncPreviewPlayButton();
    refreshIcons(btnPreviewPlay);
  }

  const btnCollapsePreview = document.getElementById("btnCollapsePreview");
  const modulePreview = document.getElementById("modulePreview");
  if (btnCollapsePreview && modulePreview) {
    btnCollapsePreview.addEventListener("click", (e) => {
      e.stopPropagation();
      const minimized = modulePreview.classList.toggle("preview-minimized");
      btnCollapsePreview.classList.toggle("active", minimized);
      btnCollapsePreview.title = minimized ? "Expandir Vista Previa" : "Minimizar Vista Previa";
    });
  }
}

/** Inicializa colapso, redimensionado, arrastre modular, chincheta y restauración de layout. */
export function setupPanelControls() {
  const sidebar = document.getElementById("sidebar");
  const rightSidebar = document.getElementById("rightSidebar");
  const rightResizer = document.getElementById("rightSidebarResizer");

  if (sidebar) {
    document.getElementById("btnCollapseLeft")?.addEventListener("click", toggleLeftPanel);
    document.getElementById("btnExpandLeft")?.addEventListener("click", toggleLeftPanel);
  }
  if (rightSidebar) {
    const syncRightResizer = () => rightResizer?.classList.toggle("hidden", rightSidebar.classList.contains("collapsed") || rightSidebar.classList.contains("all-modules-floating"));
    document.getElementById("btnCollapseRight")?.addEventListener("click", () => { toggleRightPanel(); syncRightResizer(); });
    document.getElementById("btnExpandRight")?.addEventListener("click", () => { toggleRightPanel(); syncRightResizer(); });
  }
  document.getElementById("btnCollapseBottom")?.addEventListener("click", toggleBottomPanel);
  document.getElementById("btnExpandBottom")?.addEventListener("click", toggleBottomPanel);

  bindBrushAndZoomSliders();

  const expandSide = (side) => (side === "left" ? toggleLeftPanel() : side === "right" ? toggleRightPanel() : toggleBottomPanel());
  for (const def of DOCK_MODULES) {
    setupDockableModule(document.getElementById(def.id), document.getElementById(def.headerId), document.getElementById(def.btnId), def.defaultSide, expandSide);
  }
  restoreLayoutState();

  // En móvil/tablet vertical, arrancar con los drawers colapsados para dejar el lienzo 100% visible
  if (typeof window !== "undefined" && window.innerWidth <= 860) {
    if (sidebar && !sidebar.classList.contains("collapsed")) toggleLeftPanel();
    if (rightSidebar && !rightSidebar.classList.contains("collapsed")) toggleRightPanel();
    const moduleFrames = document.getElementById("moduleFrames");
    if (moduleFrames && !moduleFrames.classList.contains("collapsed")) toggleBottomPanel();
  }
  const btnMobileColors = document.getElementById("btnMobileSwapColors");
  if (btnMobileColors) {
    let swapTimer = null;
    let didLongPress = false;
    const clearSwapTimer = () => {
      if (swapTimer) {
        clearTimeout(swapTimer);
        swapTimer = null;
      }
    };
    btnMobileColors.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      didLongPress = false;
      clearSwapTimer();
      swapTimer = setTimeout(() => {
        swapTimer = null;
        didLongPress = true;
        if (typeof navigator !== "undefined") navigator.vibrate?.(14);
        swapPrimarySecondaryColors();
      }, 420);
    });
    btnMobileColors.addEventListener("pointerup", clearSwapTimer);
    btnMobileColors.addEventListener("pointercancel", clearSwapTimer);
    btnMobileColors.addEventListener("click", (e) => {
      if (didLongPress) {
        didLongPress = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
  }
  syncMobileDockButtons();

  bindSidebarResizer(document.getElementById("sidebarResizer"), sidebar, (e) => Math.max(220, Math.min(680, e.clientX)));
  bindSidebarResizer(rightResizer, rightSidebar, (e) => Math.max(240, Math.min(560, window.innerWidth - e.clientX)));
}
