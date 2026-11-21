/**
 * docking.js: Paneles colapsables, divisores redimensionables y fachada de módulos acoplables/flotantes.
 */

import { applyZoom } from "../canvas/canvas.js";
import { i18n } from "../i18n/I18nService.js";
import { setBrushSize, initToolOptionsControls } from "./toolsUI.js";
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

/** Muestra u oculta el panel lateral izquierdo. */
export function toggleLeftPanel() {
  const sidebar = document.getElementById("sidebar");
  const btnExpandLeft = document.getElementById("btnExpandLeft");
  if (!sidebar || !btnExpandLeft) return;
  const collapsed = sidebar.classList.toggle("collapsed");
  btnExpandLeft.classList.toggle("visible", collapsed);
  document.getElementById("menuLeftPanel")?.classList.toggle("active", !collapsed);
}

/** Muestra u oculta el panel lateral derecho. */
export function toggleRightPanel() {
  const rightSidebar = document.getElementById("rightSidebar");
  const btnExpandRight = document.getElementById("btnExpandRight");
  if (!rightSidebar || !btnExpandRight) return;
  const collapsed = rightSidebar.classList.toggle("collapsed");
  btnExpandRight.classList.toggle("visible", collapsed);
  document.getElementById("menuRightPanel")?.classList.toggle("active", !collapsed);
}

/** Muestra u oculta el panel inferior (Frames y Timeline). */
export function toggleBottomPanel() {
  const moduleFrames = document.getElementById("moduleFrames");
  const btnExpandBottom = document.getElementById("btnExpandBottom");
  if (!moduleFrames || !btnExpandBottom) return;
  const collapsed = moduleFrames.classList.toggle("collapsed");
  btnExpandBottom.classList.toggle("visible", collapsed);
  document.getElementById("menuBottomPanel")?.classList.toggle("active", !collapsed);
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

  bindSidebarResizer(document.getElementById("sidebarResizer"), sidebar, (e) => Math.max(220, Math.min(680, e.clientX)));
  bindSidebarResizer(rightResizer, rightSidebar, (e) => Math.max(240, Math.min(560, window.innerWidth - e.clientX)));
}
