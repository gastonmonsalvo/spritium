/**
 * dockingDragController.js: Arrastre, drop zones, botón de pin y observadores de resize de módulos acoplables.
 */

import { setStatus, refreshIcons } from "./status.js";
import { i18n } from "../i18n/I18nService.js";
import { saveLayoutState, dockModuleTo, floatModuleAt, reclampFloatingModule } from "./dockingLayoutStorage.js";

function clearDropIndicators() {
  document.querySelectorAll(".dock-drop-before, .dock-drop-after").forEach((el) => el.classList.remove("dock-drop-before", "dock-drop-after"));
}

function isDockPanelCollapsed(side) {
  if (side === "left") return Boolean(document.getElementById("sidebar")?.classList.contains("collapsed"));
  if (side === "right") return Boolean(document.getElementById("rightSidebar")?.classList.contains("collapsed"));
  if (side === "bottom") return Boolean(document.getElementById("moduleFrames")?.classList.contains("collapsed"));
  return false;
}

function findDockedModuleUnder(moduleEl, clientX, clientY) {
  const candidates = Array.from(document.querySelectorAll("#sidebar > .dock-module:not(.module-floating), #rightSidebar > .dock-module:not(.module-floating)"));
  for (const cand of candidates) {
    if (cand === moduleEl || cand.parentElement?.classList.contains("collapsed")) continue;
    const r = cand.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
      return { el: cand, insertAfter: clientY > r.top + r.height / 2 };
    }
  }
  return null;
}

function attachPinButton(moduleEl, handle, floatBtn) {
  const pinBtn = document.createElement("button");
  pinBtn.type = "button";
  pinBtn.className = "tool-btn module-pin-btn";
  pinBtn.title = i18n.t("dock.pin");
  pinBtn.innerHTML = `<i data-lucide="pin" class="ui-icon-sm"></i>`;

  if (floatBtn) {
    floatBtn.classList.add("module-float-btn");
    const actionsWrap = document.createElement("div");
    actionsWrap.className = "module-header-actions";
    floatBtn.parentNode.insertBefore(actionsWrap, floatBtn);
    actionsWrap.append(pinBtn, floatBtn);
  } else {
    handle.appendChild(pinBtn);
  }
  refreshIcons(handle);

  pinBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const pinned = moduleEl.classList.toggle("is-pinned");
    pinBtn.classList.toggle("active", pinned);
    pinBtn.title = pinned ? i18n.t("dock.unpin") : i18n.t("dock.pin");
    saveLayoutState();
    setStatus({ key: pinned ? "dock.pinned_status" : "dock.unpinned_status" });
  });
}

function handleFloatButtonClick(moduleEl, floatBtn, defaultSide, expandSide) {
  if (moduleEl.classList.contains("module-floating")) {
    if (isDockPanelCollapsed(defaultSide)) expandSide(defaultSide);
    dockModuleTo(moduleEl, defaultSide, floatBtn);
  } else {
    const rect = moduleEl.getBoundingClientRect();
    const currentSide = moduleEl.parentElement?.id === "sidebar" ? "left" : "right";
    floatModuleAt(moduleEl, floatBtn, rect.left + (currentSide === "left" ? 18 : -18), Math.max(48, rect.top));
  }
}

function finalizeModuleDrop(moduleEl, floatBtn, defaultSide, activeDropTarget, activeInsertAfter) {
  if (activeDropTarget) {
    const targetSide = activeDropTarget.parentElement?.id === "sidebar" ? "left" : "right";
    dockModuleTo(moduleEl, targetSide, floatBtn, { targetEl: activeDropTarget, insertAfter: activeInsertAfter });
    return;
  }
  const rect = moduleEl.getBoundingClientRect();
  if (rect.left <= 32 && !isDockPanelCollapsed("left")) dockModuleTo(moduleEl, "left", floatBtn);
  else if (window.innerWidth - rect.right <= 32 && !isDockPanelCollapsed("right")) dockModuleTo(moduleEl, "right", floatBtn);
  else if (defaultSide === "bottom" && window.innerHeight - rect.bottom <= 48 && !isDockPanelCollapsed("bottom")) dockModuleTo(moduleEl, "bottom", floatBtn);
  else saveLayoutState();
}

/** Configura arrastre, chincheta y redimensionado de un módulo acoplable/flotante. */
export function setupDockableModule(moduleEl, handle, floatBtn, defaultSide, expandSide) {
  if (!moduleEl || !handle) return;
  attachPinButton(moduleEl, handle, floatBtn);

  let dragState = null, activeDropTarget = null, activeInsertAfter = false;
  handle.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || e.target.closest(".module-pin-btn")) return;
    const fromButton = Boolean(floatBtn && e.target.closest(`#${floatBtn.id}`));
    if (moduleEl.classList.contains("is-pinned")) { if (fromButton) setStatus({ key: "dock.pinned_hint" }); return; }
    const rect = moduleEl.getBoundingClientRect();
    dragState = { startX: e.clientX, startY: e.clientY, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, started: false, fromButton };
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragState) return;
    if (!dragState.started && Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY) < 6) return;
    dragState.started = true;
    document.body.style.cursor = "grabbing";
    floatModuleAt(moduleEl, floatBtn, e.clientX - dragState.offsetX, e.clientY - dragState.offsetY, { persist: false });
    clearDropIndicators();
    const hit = findDockedModuleUnder(moduleEl, e.clientX, e.clientY);
    activeDropTarget = hit ? hit.el : null;
    activeInsertAfter = hit ? hit.insertAfter : false;
    if (activeDropTarget) activeDropTarget.classList.add(activeInsertAfter ? "dock-drop-after" : "dock-drop-before");
  });

  window.addEventListener("mouseup", () => {
    if (!dragState) return;
    const { started, fromButton } = dragState;
    dragState = null;
    document.body.style.cursor = "";
    clearDropIndicators();
    if (!started) { if (fromButton) handleFloatButtonClick(moduleEl, floatBtn, defaultSide, expandSide); return; }
    finalizeModuleDrop(moduleEl, floatBtn, defaultSide, activeDropTarget, activeInsertAfter);
    activeDropTarget = null;
  });

  if (typeof ResizeObserver !== "undefined") {
    let resizeTimer = null;
    new ResizeObserver(() => {
      if (!moduleEl.classList.contains("module-floating")) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => saveLayoutState(), 150);
    }).observe(moduleEl);
  }
  window.addEventListener("resize", () => {
    if (!moduleEl.classList.contains("module-floating")) return;
    reclampFloatingModule(moduleEl, floatBtn);
  });
}
