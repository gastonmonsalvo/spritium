/**
 * folderBrowser.js: Explorador de carpetas 100% local y privado.
 * Solo filtra extensiones válidas de pixel art (.png, .jpg, .webp, .gif, .bmp, .spritium)
 * sin recorrer subcarpetas profundas ni leer archivos ajenos.
 */

import { setStatus, refreshIcons } from "../ui/index.js";
import { i18n } from "../i18n/I18nService.js";

const ALLOWED_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|spritium)$/i;
const MAX_FOLDER_FILES = 60;

let activeObjectUrls = [];
let loadedFolderName = "";
let loadedMediaFiles = [];
let lastCallbacks = null;

function revokeFolderUrls() {
  for (const url of activeObjectUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
  activeObjectUrls = [];
}

/**
 * Filtra una lista de File dejando únicamente imágenes/proyectos válidos en nivel raíz.
 * @param {File[]} files
 * @returns {File[]}
 */
export function filterSafeSpriteFiles(files) {
  const result = [];
  for (const f of files) {
    if (!f || !ALLOWED_EXT_RE.test(f.name)) continue;
    if (f.webkitRelativePath) {
      const parts = f.webkitRelativePath.split("/");
      if (parts.length > 2) continue; // Solo nivel superior de la carpeta elegida
    }
    result.push(f);
    if (result.length >= MAX_FOLDER_FILES) break;
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/** Cierra el menú desplegable de medios en la barra superior. */
export function closeMediaDropdown() {
  document.getElementById("topMediaMenuItem")?.classList.remove("open");
}

/** Libera las URLs temporales y cierra el modal del explorador de carpetas. */
export function closeFolderBrowserModal() {
  revokeFolderUrls();
  document.getElementById("folderBrowserModal")?.classList.remove("open");
}

function renderMediaGridCards(gridEl, files, { onOpenProject, onOpenImage }, onClose) {
  revokeFolderUrls();
  gridEl.innerHTML = "";

  if (files.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "grid-column: 1 / -1; text-align: center; padding: 18px 10px; color: var(--text-dim); font-size: 11.5px;";
    empty.textContent = i18n.t("folder.empty");
    gridEl.appendChild(empty);
    return;
  }

  for (const file of files) {
    const isProject = /\.spritium$/i.test(file.name);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "folder-item-card";
    card.title = file.name;

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "folder-item-thumb";
    if (isProject) {
      thumbWrap.innerHTML = `<span class="folder-sgen-badge">.SPRITIUM</span>`;
    } else {
      const url = URL.createObjectURL(file);
      activeObjectUrls.push(url);
      const img = document.createElement("img");
      img.src = url;
      img.alt = file.name;
      img.loading = "lazy";
      thumbWrap.appendChild(img);
    }

    const nameEl = document.createElement("div");
    nameEl.className = "folder-item-name";
    nameEl.textContent = file.name;

    card.appendChild(thumbWrap);
    card.appendChild(nameEl);
    card.addEventListener("click", async () => {
      onClose();
      if (isProject) {
        await onOpenProject(file);
      } else {
        await onOpenImage(file);
      }
    });
    gridEl.appendChild(card);
  }
}

function renderMediaDropdown(folderName, files, callbacks) {
  const menuItem = document.getElementById("topMediaMenuItem");
  const titleEl = document.getElementById("mediaDropdownTitle");
  const gridEl = document.getElementById("mediaDropdownGrid");
  if (!menuItem || !gridEl) {
    renderFolderModal(folderName, files, callbacks);
    return;
  }

  if (titleEl) {
    titleEl.textContent = `${folderName} (${files.length})`;
  }
  renderMediaGridCards(gridEl, files, callbacks, closeMediaDropdown);
  menuItem.classList.add("open");
  refreshIcons(menuItem);
}

function renderFolderModal(folderName, files, callbacks) {
  const modal = document.getElementById("folderBrowserModal");
  const titleEl = document.getElementById("folderBrowserTitle");
  const gridEl = document.getElementById("folderBrowserGrid");
  if (!modal || !gridEl) return;

  if (titleEl) {
    titleEl.textContent = `Carpeta: ${folderName} (${files.length} archivo${files.length === 1 ? "" : "s"})`;
  }
  renderMediaGridCards(gridEl, files, callbacks, closeFolderBrowserModal);
  modal.classList.add("open");
  refreshIcons(modal);
}

function presentLoadedMedia(folderName, files, callbacks) {
  const launcherOpen = document.getElementById("launcherModal")?.classList.contains("open");
  if (launcherOpen) {
    renderFolderModal(folderName, files, callbacks);
  } else {
    renderMediaDropdown(folderName, files, callbacks);
  }
}

/**
 * Abre una carpeta local de forma segura (File System Access API o fallback webkitdirectory).
 */
export async function openFolderDialog(callbacks = lastCallbacks) {
  if (callbacks) lastCallbacks = callbacks;
  const { onOpenProject, onOpenImage } = lastCallbacks || {};
  if (typeof window !== "undefined" && typeof window.showDirectoryPicker === "function") {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: "read" });
      const matched = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind !== "file") continue;
        if (!ALLOWED_EXT_RE.test(entry.name)) continue;
        const file = await entry.getFile();
        matched.push(file);
        if (matched.length >= MAX_FOLDER_FILES) break;
      }
      matched.sort((a, b) => a.name.localeCompare(b.name));
      loadedFolderName = dirHandle.name || "Carpeta";
      loadedMediaFiles = matched;
      setStatus({ key: "log.folder_loaded", params: { folder: loadedFolderName, count: matched.length } });
      presentLoadedMedia(loadedFolderName, loadedMediaFiles, { onOpenProject, onOpenImage });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
      // Fallback al input webkitdirectory si el navegador bloquea showDirectoryPicker
    }
  }

  const input = document.getElementById("folderFileInput");
  if (!input) {
    setStatus({ key: "log.folder_unsupported" }, true);
    return;
  }
  input.onchange = () => {
    const rawFiles = Array.from(input.files || []);
    const safeFiles = filterSafeSpriteFiles(rawFiles);
    const firstRel = rawFiles[0]?.webkitRelativePath || "";
    const folderName = firstRel.includes("/") ? firstRel.split("/")[0] : "Carpeta";
    input.value = "";
    loadedFolderName = folderName;
    loadedMediaFiles = safeFiles;
    setStatus({ key: "log.folder_loaded", params: { folder: loadedFolderName, count: safeFiles.length } });
    presentLoadedMedia(loadedFolderName, loadedMediaFiles, { onOpenProject, onOpenImage });
  };
  input.click();
}

/**
 * Despliega el menú de medios ya cargados (o solicita elegir una carpeta si aún no hay ninguna).
 */
export async function openLoadedMediaModal(callbacks = lastCallbacks) {
  if (callbacks) lastCallbacks = callbacks;
  if (!loadedMediaFiles.length) {
    await openFolderDialog(lastCallbacks);
    return;
  }
  const menuItem = document.getElementById("topMediaMenuItem");
  if (menuItem?.classList.contains("open")) {
    closeMediaDropdown();
    return;
  }
  presentLoadedMedia(loadedFolderName || "Medios", loadedMediaFiles, lastCallbacks || {});
}
