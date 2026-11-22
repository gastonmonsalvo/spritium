/**
 * menus.js: Modales de ayuda/acerca, selects personalizados y menús desplegables.
 */

import { refreshIcons } from "./status.js";
import { i18n } from "../i18n/I18nService.js";
import { resetWin98EasterEggClicks } from "./theme.js";

/** Abre el modal de atajos de teclado y refresca sus íconos. */
export function openHelpModal() {
  const modal = document.getElementById("helpModal");
  if (modal) {
    modal.classList.add("open");
    refreshIcons(modal);
  }
}

/**
 * Cierra el modal de atajos de teclado.
 */
export function closeHelpModal() {
  document.getElementById("helpModal")?.classList.remove("open");
}

/**
 * Abre el modal de información sobre Spritium.
 */
export function openAboutModal() {
  const modal = document.getElementById("aboutModal");
  if (modal) {
    modal.classList.add("open");
    refreshIcons(modal);
  }
}

/**
 * Cierra el modal de información sobre Spritium.
 */
export function closeAboutModal() {
  document.getElementById("aboutModal")?.classList.remove("open");
  resetWin98EasterEggClicks();
}

/**
 * Reemplaza los elementos select nativos por dropdowns custom estilizados con el tema.
 */
export function setupCustomSelects() {
  const selects = Array.from(document.querySelectorAll("select"));
  if (!selects.length) return;

  const closeAllCustomSelects = (except = null) => {
    document.querySelectorAll(".custom-select.open").forEach((el) => {
      if (el !== except) el.classList.remove("open");
    });
  };

  const nativeValueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");

  selects.forEach((sel) => {
    if (sel.dataset.enhanced === "1") return;
    sel.dataset.enhanced = "1";

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";
    if (sel.style.flex) wrapper.style.flex = sel.style.flex;
    if (sel.style.width) wrapper.style.width = sel.style.width;

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-trigger";

    const labelSpan = document.createElement("span");
    labelSpan.className = "custom-select-label";

    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", "chevron-down");
    icon.className = "ui-icon-sm custom-select-chevron";

    trigger.append(labelSpan, icon);

    const menu = document.createElement("div");
    menu.className = "custom-select-menu";

    const syncView = () => {
      const selectedOpt = sel.options[sel.selectedIndex];
      labelSpan.textContent = selectedOpt ? selectedOpt.textContent : "";
      const currentVal = sel.value;
      menu.querySelectorAll(".custom-select-option").forEach((optBtn) => {
        optBtn.classList.toggle("selected", optBtn.dataset.value === currentVal);
      });
    };

    const rebuildOptions = () => {
      menu.innerHTML = "";
      Array.from(sel.options).forEach((opt) => {
        const optBtn = document.createElement("button");
        optBtn.type = "button";
        optBtn.className = "custom-select-option";
        optBtn.dataset.value = opt.value;
        optBtn.textContent = opt.textContent;
        optBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (sel.value !== opt.value) {
            nativeValueDesc.set.call(sel, opt.value);
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
          syncView();
          wrapper.classList.remove("open");
        });
        menu.appendChild(optBtn);
      });
      syncView();
    };

    if (nativeValueDesc?.get && nativeValueDesc?.set) {
      Object.defineProperty(sel, "value", {
        configurable: true,
        get() {
          return nativeValueDesc.get.call(this);
        },
        set(val) {
          nativeValueDesc.set.call(this, val);
          syncView();
        },
      });
    }

    const observer = new MutationObserver(() => rebuildOptions());
    observer.observe(sel, { childList: true, subtree: true });

    sel.addEventListener("change", syncView);
    i18n.addEventListener("langchange", () => queueMicrotask(rebuildOptions));

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = !wrapper.classList.contains("open");
      closeAllCustomSelects(wrapper);
      if (willOpen) {
        syncView();
        wrapper.classList.add("open");
      } else {
        wrapper.classList.remove("open");
      }
    });

    sel.classList.add("native-select-hidden");
    sel.parentNode.insertBefore(wrapper, sel);
    wrapper.append(sel, trigger, menu);
    rebuildOptions();
    refreshIcons(trigger);
  });

  document.addEventListener("click", () => closeAllCustomSelects());
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllCustomSelects();
  });
}

/**
 * Inicializa la barra de menú superior desplegable y su cierre automático.
 */
export function setupTopMenu() {
  const topMenu = document.getElementById("topMenu");
  if (!topMenu) return;

  const items = Array.from(topMenu.querySelectorAll(".menu-item"));
  const closeAll = () => items.forEach((item) => item.classList.remove("open"));

  items.forEach((item) => {
    const trigger = item.querySelector(".menu-trigger");
    if (!trigger) return;

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasOpen = item.classList.contains("open");
      closeAll();
      if (!wasOpen) item.classList.add("open");
    });

    item.addEventListener("mouseenter", () => {
      if (items.some((other) => other !== item && other.classList.contains("open"))) {
        closeAll();
        item.classList.add("open");
      }
    });
  });

  topMenu.querySelectorAll(".menu-action").forEach((btn) => {
    btn.addEventListener("click", () => closeAll());
  });

  document.addEventListener("click", (e) => {
    if (!topMenu.contains(e.target)) closeAll();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });

  const bindDropdown = (menuId, btnId) => {
    const menuEl = document.getElementById(menuId);
    const btnEl = document.getElementById(btnId);
    if (!menuEl || !btnEl) return;
    btnEl.addEventListener("click", (e) => {
      e.stopPropagation();
      menuEl.classList.toggle("open");
    });
    menuEl.querySelectorAll(".menu-action").forEach((b) => {
      b.addEventListener("click", () => menuEl.classList.remove("open"));
    });
    document.addEventListener("click", (e) => {
      if (!menuEl.contains(e.target)) menuEl.classList.remove("open");
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") menuEl.classList.remove("open");
    });
  };

  bindDropdown("reduceMenuItem", "btnReduceDropdown");
  bindDropdown("paletteExportMenuItem", "btnPaletteExportDropdown");
  bindDropdown("exportFramesMenuItem", "btnExportFramesDropdown");
  bindDropdown("topSaveMenuItem", "btnTopSaveDropdown");

  const mediaMenuEl = document.getElementById("topMediaMenuItem");
  if (mediaMenuEl) {
    document.addEventListener("click", (e) => {
      if (!mediaMenuEl.contains(e.target)) mediaMenuEl.classList.remove("open");
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") mediaMenuEl.classList.remove("open");
    });
  }

  const onionMenuEl = document.getElementById("onionSkinMenuItem");
  const onionBtnEl = document.getElementById("btnOnionConfigDropdown");
  const onionDropEl = document.getElementById("onionSkinDropdown");
  if (onionMenuEl && onionBtnEl && onionDropEl) {
    const setOnionOpen = (open) => {
      onionMenuEl.classList.toggle("open", open);
      onionDropEl.style.display = open ? "block" : "none";
    };
    onionBtnEl.addEventListener("click", (e) => {
      e.stopPropagation();
      setOnionOpen(!onionMenuEl.classList.contains("open"));
    });
    document.addEventListener("click", (e) => {
      if (!onionMenuEl.contains(e.target)) setOnionOpen(false);
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOnionOpen(false);
    });
  }
}

