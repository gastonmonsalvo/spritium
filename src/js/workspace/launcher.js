/**
 * launcher.js: Pantalla de inicio (Launcher) para Spritium,
 * con modal real de Documento Nuevo, Drag & Drop sin parpadeo y lista de recientes reales.
 */

import { fetchHistory, requestLoadSprite, requestUploadImage } from "../core/api.js";
import { parseColorToRgba, hasPaintedPixels } from "../core/color.js";
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
import { renderAll, applyZoom } from "../canvas/canvas.js";
import { renderRulers } from "../canvas/rulers.js";
import { setStatus, updateResolutionButtons } from "../ui/index.js";
import { i18n } from "../i18n/I18nService.js";

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
import { handleUploadExternalFile } from "./spriteActions.js";
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

let pendingImportFile = null;
let pendingImportReuseTab = false;

async function buildCurrentCanvasPngFile() {
  if (typeof document === "undefined") return null;
  const w = Math.max(1, state.gridWidth || state.gridSize || 64);
  const h = Math.max(1, state.gridHeight || state.gridSize || w);
  const layers = state.originalImport?.grid
    ? [{ visible: true, grid: state.originalImport.grid }]
    : (state.layers || []).filter((l) => l?.visible !== false && l?.grid && l.type !== "folder");
  const pal = state.originalImport?.paletteMap || state.paletteMap || {};
  const srcW = state.originalImport?.width || state.originalImport?.size || w;
  const srcH = state.originalImport?.height || state.originalImport?.size || h;

  const canvas = document.createElement("canvas");
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(srcW, srcH);
  for (const layer of layers) {
    for (let y = 0; y < srcH; y++) {
      const row = layer.grid[y];
      if (!row) continue;
      for (let x = 0; x < srcW; x++) {
        const idx = row[x] || 0;
        if (!idx) continue;
        const rgba = parseColorToRgba(pal[idx]);
        if (!rgba) continue;
        const o = (y * srcW + x) * 4;
        img.data[o] = rgba[0];
        img.data[o + 1] = rgba[1];
        img.data[o + 2] = rgba[2];
        img.data[o + 3] = rgba[3];
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return null;
  const nameEl = /** @type {HTMLInputElement|null} */ (document.getElementById("assetName"));
  const baseName = (nameEl?.value || "sprite").trim() || "sprite";
  return new File([blob], `${baseName}.png`, { type: "image/png" });
}

/**
 * Reabre el modal de configuración de importación sobre la imagen original del documento actual.
 */
export async function reopenImportOptionsModal() {
  let file = state.sourceImageFile;
  if (!file) {
    const hasPixels =
      Boolean(state.originalImport?.grid) ||
      (state.layers || []).some((l) => l?.grid && hasPaintedPixels(l.grid));
    if (!hasPixels) {
      setStatus({ key: "log.reimport_none" }, true);
      return;
    }
    file = await buildCurrentCanvasPngFile();
    if (!file) {
      setStatus({ key: "log.reimport_none" }, true);
      return;
    }
    state.sourceImageFile = file;
  }
  openImportModal(file, { asNewLayer: false, isReimport: true });
}

/**
 * Abre el modal de opciones de importación para un archivo de imagen.
 * @param {File} file
 * @param {{asNewLayer?: boolean, isReimport?: boolean}} [options]
 */
export function openImportModal(file, { asNewLayer = false, isReimport = false } = {}) {
  if (!file) return;
  pendingImportFile = file;
  pendingImportReuseTab = Boolean(isReimport);

  const canvasIsEmpty =
    state.frames.length <= 1 &&
    state.layers.length === 1 &&
    state.layers[0]?.type !== "tilemap" &&
    !(state.layers[0]?.grid && hasPaintedPixels(state.layers[0].grid));
  const defaultAsNewLayer = !isReimport && Boolean(asNewLayer) && !canvasIsEmpty;
  const savedOpts = isReimport ? state.sourceImportOptions : null;

  const modal = document.getElementById("importOptionsModal");
  const titleEl = document.getElementById("importModalTitle");
  const nameInput = document.getElementById("importAssetName");
  const modeSelect = document.getElementById("importModeSelect");
  const resSelect = document.getElementById("importResSelect");
  const themeSelect = document.getElementById("importThemeSelect");
  const ditherChk = document.getElementById("importDitherChk");

  if (titleEl) {
    titleEl.textContent = i18n.t(defaultAsNewLayer ? "import.title_layer" : "import.title_project");
  }
  if (nameInput) {
    nameInput.value = file.name.replace(/\.[^/.]+$/, "") || "imported_asset";
  }
  if (modeSelect) {
    modeSelect.value = defaultAsNewLayer ? "layer" : "project";
  }
  if (resSelect) {
    resSelect.value = savedOpts
      ? savedOpts.keepNativeSize
        ? "native"
        : String(savedOpts.targetSize || 64)
      : "native";
    if (!resSelect.value) resSelect.value = "native";
    resSelect.disabled = false;
  }
  const convertChk = document.getElementById("importConvertPixelArtChk");
  if (convertChk) {
    convertChk.checked = Boolean(savedOpts?.pixelArtConvert);
  }
  const removeBgChk = document.getElementById("importRemoveBgChk");
  if (removeBgChk) {
    removeBgChk.checked = Boolean(savedOpts?.removeBackground);
  }
  if (themeSelect) {
    populatePaletteSelectOptions(themeSelect, {
      includeOriginal: true,
      selectedValue: savedOpts?.paletteTheme
        ? savedOpts.paletteTheme
        : state.quantizeOnUpload && state.currentThemeKey !== "original"
          ? state.currentThemeKey
          : "original",
    });
  }
  if (ditherChk) {
    ditherChk.checked = savedOpts ? Boolean(savedOpts.dither) : Boolean(state.ditherEnabled);
  }

  if (modeSelect) {
    modeSelect.onchange = () => {
      const isLayer = modeSelect.value === "layer";
      if (titleEl) titleEl.textContent = i18n.t(isLayer ? "import.title_layer" : "import.title_project");
      scheduleImportPreview();
    };
  }
  if (modal) modal.classList.add("open");
  scheduleImportPreview();
}

let importPreviewTimer = null;
let importPreviewSeq = 0;

function readImportFormOptions() {
  const assetName = document.getElementById("importAssetName")?.value.trim();
  const mode = document.getElementById("importModeSelect")?.value || "project";
  const asNewLayer = mode === "layer";
  const rawRes = document.getElementById("importResSelect")?.value || "native";
  const keepNativeSize = rawRes === "native";
  const targetSize = keepNativeSize ? state.gridSize || 64 : Number(rawRes || state.gridSize || 64);
  const pixelArtConvert = Boolean(document.getElementById("importConvertPixelArtChk")?.checked);
  const removeBackground = Boolean(document.getElementById("importRemoveBgChk")?.checked);
  const paletteTheme = document.getElementById("importThemeSelect")?.value || "original";
  const dither = Boolean(document.getElementById("importDitherChk")?.checked);
  return {
    assetName,
    asNewLayer,
    targetSize,
    keepNativeSize,
    pixelArtConvert,
    removeBackground,
    paletteTheme,
    quantize: paletteTheme !== "original",
    dither,
    reuseActiveTab: pendingImportReuseTab,
  };
}

function drawImportPreviewData(data) {
  const canvas = document.getElementById("importPreviewCanvas");
  const metaEl = document.getElementById("importPreviewMeta");
  if (!canvas || !data?.grid?.length) return;

  const h = data.height || data.grid.length;
  const w = data.width || data.grid[0]?.length || 1;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const img = ctx.createImageData(w, h);
  const buf = img.data;
  const rgbaCache = new Map();
  for (let y = 0; y < h; y++) {
    const row = data.grid[y];
    for (let x = 0; x < w; x++) {
      const idx = row?.[x] || 0;
      if (!idx) continue;
      let rgba = rgbaCache.get(idx);
      if (!rgba) {
        const hex = data.palette?.[idx];
        rgba = hex ? parseColorToRgba(hex) : [0, 0, 0, 0];
        rgbaCache.set(idx, rgba);
      }
      const o = (y * w + x) * 4;
      buf[o] = rgba[0];
      buf[o + 1] = rgba[1];
      buf[o + 2] = rgba[2];
      buf[o + 3] = rgba[3];
    }
  }
  ctx.putImageData(img, 0, 0);

  if (metaEl) {
    const colorCount = Object.keys(data.palette || {}).filter((k) => Number(k) !== 0).length;
    metaEl.textContent = `${w}×${h} · ${i18n.t("modal.import.colors", { count: colorCount })}`;
  }
}

function scheduleImportPreview() {
  if (!pendingImportFile) return;
  if (importPreviewTimer) clearTimeout(importPreviewTimer);
  const metaEl = document.getElementById("importPreviewMeta");
  if (metaEl) metaEl.textContent = "...";

  const seq = ++importPreviewSeq;
  importPreviewTimer = setTimeout(async () => {
    importPreviewTimer = null;
    const file = pendingImportFile;
    if (!file) return;
    try {
      const opts = readImportFormOptions();
      const data = await requestUploadImage(file, { ...opts, saveToHistory: false });
      if (seq !== importPreviewSeq || !pendingImportFile) return;
      drawImportPreviewData(data);
    } catch {
      if (seq === importPreviewSeq && metaEl) metaEl.textContent = "—";
    }
  }, 60);
}

/**
 * Cierra el modal de opciones de importación.
 */
export function closeImportModal() {
  pendingImportFile = null;
  const modal = document.getElementById("importOptionsModal");
  if (modal) modal.classList.remove("open");
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

  const importForm = document.getElementById("importOptionsForm");
  if (importForm) {
    const previewInputIds = [
      "importResSelect",
      "importThemeSelect",
      "importConvertPixelArtChk",
      "importRemoveBgChk",
      "importDitherChk",
    ];
    for (const id of previewInputIds) {
      document.getElementById(id)?.addEventListener("change", scheduleImportPreview);
    }

    importForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const file = pendingImportFile;
      if (!file) {
        closeImportModal();
        return;
      }
      const opts = readImportFormOptions();
      closeImportModal();
      await handleUploadExternalFile(file, opts);
      hideLauncher();
    });
  }

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
