/**
 * dockingLayoutStorage.js: Posicionamiento, acoplamiento/flotación y persistencia de layout en localStorage.
 */

import { setStatus } from "./status.js";
import { i18n } from "../i18n/I18nService.js";

export const LAYOUT_STORAGE_KEY = "spritium_layout_v2";
const LEGACY_LAYOUT_STORAGE_KEY = "spritium_layout_v1";

export const DOCK_MODULES = [
  { id: "moduleTools", headerId: "toolsModuleHeader", btnId: "btnFloatTools", defaultSide: "left" },
  { id: "moduleTileset", headerId: "tilesetModuleHeader", btnId: "btnFloatTileset", defaultSide: "left" },
  { id: "moduleSymmetry", headerId: "symmetryModuleHeader", btnId: "btnFloatSymmetry", defaultSide: "left" },
  { id: "moduleTransforms", headerId: "transformsModuleHeader", btnId: "btnFloatTransforms", defaultSide: "left" },
  { id: "moduleZoom", headerId: "zoomModuleHeader", btnId: "btnFloatZoom", defaultSide: "left" },
  { id: "moduleColors", headerId: "colorsModuleHeader", btnId: "btnFloatColors", defaultSide: "right" },
  { id: "moduleLayers", headerId: "layersModuleHeader", btnId: "btnFloatLayers", defaultSide: "right" },
  { id: "modulePreview", headerId: "previewModuleHeader", btnId: "btnFloatPreview", defaultSide: "right", defaultFloat: true },
  { id: "moduleFrames", headerId: "framesModuleHeader", btnId: "btnFloatFrames", defaultSide: "bottom" },
];

/** Calcula la posición flotante inicial por defecto para un módulo. */
export function getDefaultFloatPosition(moduleEl) {
  const ws = document.getElementById("workspace");
  const rect = ws?.getBoundingClientRect();
  const w = moduleEl?.offsetWidth || 152;
  if (rect && rect.width > 0) {
    return { left: Math.max(12, Math.round(rect.right - w - 14)), top: Math.max(48, Math.round(rect.top + 12)) };
  }
  return { left: Math.max(12, window.innerWidth - w - 340), top: 52 };
}

/** Oculta los contenedores laterales cuando todos sus módulos están flotando. */
export function syncDockContainersVisibility() {
  ["sidebar", "rightSidebar"].forEach((dockId) => {
    const dock = document.getElementById(dockId);
    if (!dock) return;
    const dockedModules = Array.from(dock.children).filter(
      (el) => el.classList.contains("dock-module") && !el.classList.contains("module-floating") && el.style.display !== "none",
    );
    dock.classList.toggle("all-modules-floating", dockedModules.length === 0);
  });
}

/** Persiste la disposición actual de módulos acoplados y flotantes en localStorage. */
export function saveLayoutState() {
  try {
    const payload = {};
    for (const def of DOCK_MODULES) {
      const el = document.getElementById(def.id);
      if (!el) continue;
      if (el.classList.contains("module-floating")) {
        payload[def.id] = {
          mode: "float",
          left: parseInt(el.style.left, 10) || 40,
          top: parseInt(el.style.top, 10) || 60,
          width: el.style.width ? parseInt(el.style.width, 10) : null,
          height: el.style.height ? parseInt(el.style.height, 10) : null,
          pinned: el.classList.contains("is-pinned"),
        };
      } else {
        const dock = el.parentElement;
        let mode = dock?.id === "sidebar" ? "dock-left" : "dock-right";
        if (dock?.id === "workspace") {
          const docTabsBar = document.getElementById("docTabsBar");
          mode = docTabsBar && el.previousElementSibling === docTabsBar ? "dock-top" : "dock-bottom";
        }
        const siblings = dock ? Array.from(dock.children).filter((c) => c.classList.contains("dock-module")) : [];
        payload[def.id] = { mode, order: siblings.indexOf(el), pinned: el.classList.contains("is-pinned") };
      }
    }
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(payload));
  } catch { /* ignore storage errors */ }
}

/** Acopla un módulo en el panel lateral o inferior indicado. */
export function dockModuleTo(moduleEl, side, floatBtn, { persist = true, targetEl = null, insertAfter = false } = {}) {
  if (!moduleEl) return;
  const isWorkspaceDock = side === "bottom" || side === "top";
  const targetDock = document.getElementById(side === "left" ? "sidebar" : isWorkspaceDock ? "workspace" : "rightSidebar");
  if (targetDock) {
    if (targetEl && targetEl.parentElement === targetDock && targetEl !== moduleEl) {
      if (insertAfter) targetEl.after(moduleEl);
      else targetDock.insertBefore(moduleEl, targetEl);
    } else if (side === "top") {
      const docTabsBar = document.getElementById("docTabsBar");
      if (docTabsBar && docTabsBar.parentElement === targetDock) docTabsBar.after(moduleEl);
      else targetDock.prepend(moduleEl);
    } else if (moduleEl.parentElement !== targetDock || isWorkspaceDock) {
      const anchor = side === "left" ? (document.getElementById("logsBox") || document.getElementById("statusText")) : side === "bottom" ? document.getElementById("canvasFooterHelp") : null;
      if (anchor && anchor.parentElement === targetDock) targetDock.insertBefore(moduleEl, anchor);
      else targetDock.appendChild(moduleEl);
    }
  }
  moduleEl.classList.remove("module-floating");
  moduleEl.classList.toggle("module-docked-top", side === "top");
  if (moduleEl.id === "moduleFrames") {
    const btnExpandBottom = document.getElementById("btnExpandBottom");
    if (btnExpandBottom) {
      btnExpandBottom.classList.toggle("is-top", side === "top");
      if (side === "top") {
        const docTabsBar = document.getElementById("docTabsBar");
        if (docTabsBar) docTabsBar.after(btnExpandBottom);
      } else {
        const footer = document.getElementById("canvasFooterHelp");
        if (footer) footer.before(btnExpandBottom);
      }
    }
  }
  moduleEl.style.left = ""; moduleEl.style.top = ""; moduleEl.style.width = ""; moduleEl.style.height = "";
  if (floatBtn) { floatBtn.classList.remove("active"); floatBtn.title = i18n.t("dock.float_title"); }
  syncDockContainersVisibility();
  if (persist) saveLayoutState();
}

function saveFloatAnchor(moduleEl, left, top) {
  const w = moduleEl.offsetWidth || 276;
  const h = moduleEl.offsetHeight || 160;
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 800;
  if (left + w / 2 > vw / 2) {
    moduleEl.dataset.anchorXEdge = "right";
    moduleEl.dataset.anchorXVal = String(Math.round(vw - left));
  } else {
    moduleEl.dataset.anchorXEdge = "left";
    moduleEl.dataset.anchorXVal = String(Math.round(left));
  }
  if (top + h / 2 > vh / 2) {
    moduleEl.dataset.anchorYEdge = "bottom";
    moduleEl.dataset.anchorYVal = String(Math.round(vh - top));
  } else {
    moduleEl.dataset.anchorYEdge = "top";
    moduleEl.dataset.anchorYVal = String(Math.round(top));
  }
}

/** Recalcula la posición flotante dentro del viewport actual manteniendo el ancla original. */
export function reclampFloatingModule(moduleEl, floatBtn) {
  if (!moduleEl || !moduleEl.classList.contains("module-floating")) return;
  const vw = window.innerWidth || 1280;
  const vh = window.innerHeight || 800;
  const rect = moduleEl.getBoundingClientRect();
  const hasX = moduleEl.dataset.anchorXVal !== undefined;
  const hasY = moduleEl.dataset.anchorYVal !== undefined;
  const xVal = Number(moduleEl.dataset.anchorXVal);
  const yVal = Number(moduleEl.dataset.anchorYVal);
  const targetLeft = hasX
    ? (moduleEl.dataset.anchorXEdge === "right" ? vw - xVal : xVal)
    : rect.left;
  const targetTop = hasY
    ? (moduleEl.dataset.anchorYEdge === "bottom" ? vh - yVal : yVal)
    : rect.top;
  floatModuleAt(moduleEl, floatBtn, targetLeft, targetTop, { persist: false, updateAnchor: false });
}

/** Desacopla un módulo y lo posiciona flotando en `(left, top)`. */
export function floatModuleAt(moduleEl, floatBtn, left, top, { persist = true, width = null, height = null, updateAnchor = true } = {}) {
  if (!moduleEl) return;
  const floatHost = document.getElementById("app") || document.body;
  if (floatHost && moduleEl.parentElement !== floatHost) floatHost.appendChild(moduleEl);
  moduleEl.classList.add("module-floating");
  if (width) moduleEl.style.width = `${width}px`;
  if (height) moduleEl.style.height = `${height}px`;
  const maxX = Math.max(8, window.innerWidth - (moduleEl.offsetWidth || 276) - 8);
  const maxY = Math.max(44, window.innerHeight - 90);
  const clampedLeft = Math.max(8, Math.min(maxX, left));
  const clampedTop = Math.max(44, Math.min(maxY, top));
  moduleEl.style.left = `${clampedLeft}px`;
  moduleEl.style.top = `${clampedTop}px`;
  if (updateAnchor) saveFloatAnchor(moduleEl, clampedLeft, clampedTop);
  if (floatBtn) { floatBtn.classList.add("active"); floatBtn.title = "Re-acoplar o arrastrar a un borde"; }
  syncDockContainersVisibility();
  if (persist) saveLayoutState();
}

function applyDefaultFloatingModules() {
  if (typeof window !== "undefined" && window.innerWidth <= 860) return;
  for (const def of DOCK_MODULES) {
    if (!def.defaultFloat) continue;
    const el = document.getElementById(def.id);
    if (!el) continue;
    const pos = getDefaultFloatPosition(el);
    floatModuleAt(el, document.getElementById(def.btnId), pos.left, pos.top, { persist: false });
  }
}

function readLayoutRaw() {
  let raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
  if (raw) return raw;
  const legacyRaw = localStorage.getItem(LEGACY_LAYOUT_STORAGE_KEY);
  if (!legacyRaw) return null;
  const parsed = JSON.parse(legacyRaw);
  if (parsed && typeof parsed === "object") { delete parsed.modulePreview; return JSON.stringify(parsed); }
  return null;
}

/** Restaura la disposición acoplada o flotante de los módulos desde localStorage. */
export function restoreLayoutState() {
  try {
    const raw = readLayoutRaw();
    if (!raw) { applyDefaultFloatingModules(); syncDockContainersVisibility(); return; }
    const parsed = JSON.parse(raw);
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 860;
    const orderedDefs = [...DOCK_MODULES].sort((a, b) => (parsed?.[a.id]?.order ?? 99) - (parsed?.[b.id]?.order ?? 99));
    for (const def of orderedDefs) {
      const el = document.getElementById(def.id), floatBtn = document.getElementById(def.btnId), cfg = parsed?.[def.id];
      if (!el) continue;
      if (!cfg) {
        if (def.defaultFloat && !isMobile) { const pos = getDefaultFloatPosition(el); floatModuleAt(el, floatBtn, pos.left, pos.top, { persist: false }); }
        continue;
      }
      if (cfg.mode === "float" && !isMobile) floatModuleAt(el, floatBtn, cfg.left ?? 40, cfg.top ?? 60, { persist: false, width: cfg.width, height: cfg.height });
      else if (cfg.mode === "float" && isMobile) dockModuleTo(el, def.defaultSide, floatBtn, { persist: false });
      else if (cfg.mode === "dock-left") dockModuleTo(el, "left", floatBtn, { persist: false });
      else if (cfg.mode === "dock-top") dockModuleTo(el, "top", floatBtn, { persist: false });
      else if (cfg.mode === "dock-bottom") dockModuleTo(el, "bottom", floatBtn, { persist: false });
      else if (cfg.mode === "dock-right") dockModuleTo(el, "right", floatBtn, { persist: false });
      if (cfg.pinned) {
        el.classList.add("is-pinned");
        const pinBtn = el.querySelector(".module-pin-btn");
        if (pinBtn) { pinBtn.classList.add("active"); pinBtn.title = i18n.t("dock.unpin"); }
      }
    }
  } catch { applyDefaultFloatingModules(); }
  syncDockContainersVisibility();
}

/** Restaura los módulos a su ubicación, orden y estado base por defecto. */
export function resetDockedPanels() {
  for (const def of DOCK_MODULES) {
    const el = document.getElementById(def.id), floatBtn = document.getElementById(def.btnId);
    if (el) {
      el.classList.remove("is-pinned", "preview-minimized", "collapsed");
      el.style.left = "";
      el.style.top = "";
      el.style.width = "";
      el.style.height = "";
      delete el.dataset.anchorXEdge;
      delete el.dataset.anchorXVal;
      delete el.dataset.anchorYEdge;
      delete el.dataset.anchorYVal;
      const pinBtn = el.querySelector(".module-pin-btn");
      if (pinBtn) { pinBtn.classList.remove("active"); pinBtn.title = i18n.t("dock.pin"); }
    }
    if (def.defaultFloat) { const pos = getDefaultFloatPosition(el); floatModuleAt(el, floatBtn, pos.left, pos.top, { persist: false }); }
    else dockModuleTo(el, def.defaultSide, floatBtn, { persist: false });
  }
  document.getElementById("btnExpandBottom")?.classList.remove("visible");
  try { localStorage.removeItem(LAYOUT_STORAGE_KEY); localStorage.removeItem(LEGACY_LAYOUT_STORAGE_KEY); } catch {}
  syncDockContainersVisibility();
  setStatus({ key: "log.layout_reset" });
}
