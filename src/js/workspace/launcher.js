/**
 * launcher.js: Pantalla de inicio (Launcher) para Spritium,
 * con modal real de Documento Nuevo, Drag & Drop sin parpadeo y lista de recientes reales.
 */

import { fetchHistory, requestLoadSprite } from "../core/api.js";
import {
  state,
  pushState,
  setGridSize,
  createEmptyGrid,
  clonePaletteMap,
} from "../core/state.js";
import { resetLayersWithGrid } from "./layers.js";
import { resetFramesWithCurrentLayers } from "./frames.js";
import {
  populateThemeSelect,
  populatePaletteSelectOptions,
  buildPaletteUI,
  renderCustomPaletteUI,
} from "./paletteManager.js";
import { renderAll, applyZoom, fitZoomToViewport } from "../canvas/canvas.js";
import { renderRulers } from "../canvas/rulers.js";
import { setStatus, updateResolutionButtons } from "../ui/index.js";
import { i18n } from "../i18n/I18nService.js";
import {
  openImportModal,
  closeImportModal,
  reopenImportOptionsModal,
  initImportOptionsModal,
} from "./importOptionsController.js";

export { openImportModal, closeImportModal, reopenImportOptionsModal };

if (typeof window !== "undefined") {
  i18n.addEventListener("langchange", () => {
    renderAutosaveBanner();
    renderRecentList();
    populateLauncherThemes();
    const importSel = document.getElementById("importThemeSelect");
    if (importSel && importSel.options.length > 0) {
      populatePaletteSelectOptions(importSel, {
        includeOriginal: true,
        selectedValue: importSel.value || "original",
      });
    }
  });
}
import { loadProjectFile } from "../core/projectIO.js";
import { openNewDocTab, syncActiveTabSnapshot } from "./docTabs.js";

import {
  listRecentProjects,
  getRecentProject,
  saveRecentProject,
  clearRecentProjects,
  getAutosave,
  clearAutosave,
  restoreProjectSnapshot,
} from "../core/storage.js";

/**
 * Muestra la pantalla de inicio (Launcher) y refresca autosave y recientes.
 */
export function showLauncher() {
  document.body?.classList.add("is-launching");
  const overlay = document.getElementById("launcherOverlay");
  if (overlay) {
    overlay.classList.remove("hidden");
    renderAutosaveBanner();
    renderRecentList();
    populateLauncherThemes();
    renderRecentList();
  }
}

/**
 * Oculta la pantalla de inicio (Launcher) para mostrar el editor.
 */
export function hideLauncher() {
  document.body?.classList.remove("is-launching");
  const overlay = document.getElementById("launcherOverlay");
  if (overlay) overlay.classList.add("hidden");
  if (typeof window !== "undefined" && window.innerWidth <= 860) {
    requestAnimationFrame(() => fitZoomToViewport());
  }
}

/**
 * Abre el modal de creación de documento nuevo.
 */
export function openNewDocModal() {
  const modal = document.getElementById("newDocModal");
  if (!modal) return;
  const sel = document.getElementById("newDocSize");
  const customRow = document.getElementById("newDocCustomRow");
  if (sel && customRow) {
    customRow.style.display = sel.value === "custom" ? "grid" : "none";
    sel.onchange = () => {
      customRow.style.display = sel.value === "custom" ? "grid" : "none";
    };
  }
  modal.classList.add("open");
  document.getElementById("newDocName")?.focus();
}

/**
 * Cierra el modal de documento nuevo.
 */
export function closeNewDocModal() {
  const modal = document.getElementById("newDocModal");
  if (modal) modal.classList.remove("open");
}

function createNewDocumentFromModal(e) {
  e.preventDefault();
  const nameInput = document.getElementById("newDocName");
  const sizeSelect = document.getElementById("newDocSize");
  const bgSelect = document.getElementById("newDocBg");
  const themeSelect = document.getElementById("newDocTheme");

  const docName = nameInput?.value.trim() || "sprite_01";
  const rawSize = sizeSelect?.value || "64";
  const isCustom = rawSize === "custom";
  const w = isCustom
    ? Math.max(4, Math.min(512, Math.round(Number(document.getElementById("newDocCustomW")?.value || 64))))
    : Number(rawSize || 64);
  const h = isCustom
    ? Math.max(4, Math.min(512, Math.round(Number(document.getElementById("newDocCustomH")?.value || 64))))
    : w;
  const bgMode = bgSelect?.value || "transparent";
  const themeKey = themeSelect?.value || state.currentThemeKey || "db32";

  openNewDocTab(docName);
  state.sourceImageFile = null;
  state.sourceImportOptions = null;
  state.resBaseSnapshot = null;
  state.originalImport = null;
  state.isDirtySinceImport = false;
  state.customColorIndices = [];
  state.selection = null;
  setGridSize(w, h);

  const themeColors = state.themesCatalog[themeKey]?.colors || {};
  state.currentThemeKey = themeKey;
  state.paletteMap = { 0: null, ...clonePaletteMap(themeColors) };

  const grid = createEmptyGrid(w, h);
  if (bgMode === "white" || bgMode === "black") {
    const targetHex = bgMode === "black" ? "#000000" : "#ffffff";
    let bgIdx = Object.entries(state.paletteMap).find(
      ([k, v]) => Number(k) > 0 && v && v.toLowerCase() === targetHex,
    )?.[0];
    bgIdx = bgIdx ? Number(bgIdx) : null;
    if (!bgIdx) {
      const existingKeys = Object.keys(state.paletteMap).map(Number);
      bgIdx = Math.max(40, (existingKeys.length ? Math.max(...existingKeys) : 39) + 1);
      state.paletteMap[bgIdx] = targetHex;
      state.customColorIndices.push(bgIdx);
    }
    for (let y = 0; y < h; y++) grid[y].fill(bgIdx);
  }

  resetLayersWithGrid(grid, "Base");
  resetFramesWithCurrentLayers();

  const assetNameEl = document.getElementById("assetName");
  if (assetNameEl) assetNameEl.value = docName;

  state.currentColorIndex = state.paletteMap[2] ? 2 : 1;
  populateThemeSelect();
  buildPaletteUI();
  renderCustomPaletteUI();
  updateResolutionButtons(w, h);
  applyZoom(1);
  renderAll();
  renderRulers();

  closeNewDocModal();
  hideLauncher();
  syncActiveTabSnapshot(docName);
  saveRecentProject();
  setStatus({
    key: "status.doc_created",
    params: { name: docName, w, h, bg: bgMode },
  });
}

async function openFileFromLauncher(file) {
  if (!file) return;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".spritium") || lower.endsWith(".json")) {
    await loadProjectFile(file);
    hideLauncher();
  } else {
    openImportModal(file);
  }
}

async function openRecentEntry(item) {
  const record = await getRecentProject(item.id);
  if (record?.projectData) {
    const resolvedName =
      (record.projectData.name || record.name || "").trim() || "nuevo_proyecto";
    const projectData = { ...record.projectData, name: resolvedName };
    restoreProjectSnapshot(projectData);
    syncActiveTabSnapshot(resolvedName);
    hideLauncher();
    return;
  }
  document.getElementById("launcherFileInput")?.click();
}

function formatRelativeTime(ts) {
  if (!ts) return i18n.t("launcher.recent_time");
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return i18n.t("launcher.now");
  if (mins < 60) return i18n.t("launcher.mins_ago", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return i18n.t("launcher.hrs_ago", { n: hrs });
  return new Date(ts).toLocaleDateString(i18n.currentLang === "en" ? "en-US" : "es-AR");
}

/**
 * Muestra u oculta el banner de recuperación de sesión autoguardada en IndexedDB.
 */
export async function renderAutosaveBanner() {
  const card = document.getElementById("autosaveCard");
  if (!card) return;
  const saved = await getAutosave();
  if (!saved?.projectData) {
    card.classList.add("hidden");
    return;
  }

  const thumb = card.querySelector(".autosave-thumb");
  const title = card.querySelector(".autosave-title");
  const meta = card.querySelector(".autosave-meta");
  if (thumb && saved.thumbnailDataUrl) thumb.src = saved.thumbnailDataUrl;
  if (title) title.textContent = i18n.t("launcher.resume_named", { name: saved.name });
  if (meta) meta.textContent = i18n.t("launcher.autosave_meta", { size: saved.size, time: formatRelativeTime(saved.updatedAt) });

  const btnResume = document.getElementById("btnResumeAutosave");
  const btnDiscard = document.getElementById("btnDiscardAutosave");
  if (btnResume) {
    btnResume.onclick = () => {
      const resolvedName =
        (saved.projectData.name || saved.name || "").trim() || "nuevo_proyecto";
      const projectData = { ...saved.projectData, name: resolvedName };
      restoreProjectSnapshot(projectData, `Sesión recuperada: ${resolvedName}`);
      syncActiveTabSnapshot(resolvedName);
      hideLauncher();
    };
  }
  if (btnDiscard) {
    btnDiscard.onclick = async () => {
      await clearAutosave();
      card.classList.add("hidden");
    };
  }
  card.classList.remove("hidden");
}

/**
 * Renderiza la lista de proyectos recientes con miniaturas pixeladas.
 */
export async function renderRecentList() {
  const ul = document.getElementById("recentList");
  if (!ul) return;

  const items = await listRecentProjects(6);
  const btnClearRecents = document.getElementById("btnClearRecents");
  if (btnClearRecents) {
    btnClearRecents.hidden = items.length === 0;
  }

  if (items.length === 0) {
    ul.innerHTML = `<li class="recent-empty">${i18n.t("launcher.recent_empty")}</li>`;
    return;
  }

  ul.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.className = "recent-item";
    li.tabIndex = 0;

    const thumbHtml = item.thumbnailDataUrl
      ? `<img class="recent-thumb" src="${item.thumbnailDataUrl}" alt="" />`
      : `<svg class="file-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;

    li.innerHTML = `
      ${thumbHtml}
      <span class="file-name"></span>
      <span class="file-path"></span>
    `;
    li.querySelector(".file-name").textContent = item.name;
    li.querySelector(".file-name").title = item.name;
    li.querySelector(".file-path").textContent = `${item.size}×${item.size} • ${formatRelativeTime(item.updatedAt)}`;

    li.addEventListener("click", () => openRecentEntry(item));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openRecentEntry(item);
      }
    });
    ul.appendChild(li);
  }
}

/**
 * Puebla el selector de paletas iniciales en el modal de documento nuevo.
 */
export function populateLauncherThemes() {
  const sel = document.getElementById("newDocTheme");
  if (!sel || !state.themesCatalog) return;
  const selected =
    sel.value && state.themesCatalog[sel.value]
      ? sel.value
      : state.currentThemeKey || Object.keys(state.themesCatalog)[0] || "db32";
  populatePaletteSelectOptions(sel, { selectedValue: selected });
}

/**
 * Inicializa eventos del Launcher, modales, drag & drop y atajos globales.
 */
export function initLauncher() {
  const overlay = document.getElementById("launcherOverlay");
  const fileInput = document.getElementById("launcherFileInput");
  const form = document.getElementById("newDocForm");

  if (form) {
    form.addEventListener("submit", createNewDocumentFromModal);
  }

  initImportOptionsModal(hideLauncher);

  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (file) await openFileFromLauncher(file);
      e.target.value = "";
    });
  }

  const recentSection = document.getElementById("recentSection");
  const btnToggleRecents = document.getElementById("btnToggleRecents");
  const HIDE_RECENTS_KEY = "spritium_hide_recents";
  const applyRecentsVisibility = (hidden) => {
    recentSection?.classList.toggle("recents-hidden", hidden);
    if (btnToggleRecents) {
      btnToggleRecents.dataset.i18n = hidden ? "launcher.show" : "launcher.hide";
      btnToggleRecents.textContent = i18n.t(btnToggleRecents.dataset.i18n);
    }
  };
  try {
    applyRecentsVisibility(localStorage.getItem(HIDE_RECENTS_KEY) === "1");
  } catch {
    applyRecentsVisibility(false);
  }
  btnToggleRecents?.addEventListener("click", () => {
    const nextHidden = !recentSection?.classList.contains("recents-hidden");
    applyRecentsVisibility(nextHidden);
    try {
      localStorage.setItem(HIDE_RECENTS_KEY, nextHidden ? "1" : "0");
    } catch {
      // ignore
    }
  });

  const btnClearRecents = document.getElementById("btnClearRecents");
  btnClearRecents?.addEventListener("click", async () => {
    if (!confirm(i18n.t("launcher.confirm_clear"))) return;
    await clearRecentProjects();
    await renderRecentList();
    setStatus({ key: "launcher.cleared_status" });
  });

  // Drag & Drop sin parpadeo usando contador de profundidad
  let dragDepth = 0;
  if (overlay) {
    overlay.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dragDepth++;
      overlay.classList.add("drag-over");
    });
    overlay.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
    overlay.addEventListener("dragleave", () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) overlay.classList.remove("drag-over");
    });
    overlay.addEventListener("drop", async (e) => {
      e.preventDefault();
      dragDepth = 0;
      overlay.classList.remove("drag-over");
      const file = e.dataTransfer?.files?.[0];
      if (file) await openFileFromLauncher(file);
    });
  }

  // Atajos globales del Launcher (Alt+N, Ctrl+O, Escape para cerrar modal)
  window.addEventListener("keydown", (e) => {
    const isLauncherOpen = overlay && !overlay.classList.contains("hidden");
    const isModalOpen = document.getElementById("newDocModal")?.classList.contains("open");
    const isImportOpen = document.getElementById("importOptionsModal")?.classList.contains("open");

    if (e.key === "Escape" && (isModalOpen || isImportOpen)) {
      e.preventDefault();
      if (isModalOpen) closeNewDocModal();
      if (isImportOpen) closeImportModal();
      return;
    }

    if (!isLauncherOpen) return;
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      openNewDocModal();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
      e.preventDefault();
      fileInput?.click();
    }
  });

  renderAutosaveBanner();
  renderRecentList();
}
