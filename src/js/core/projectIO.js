/**
 * projectIO.js: Serialización y deserialización del formato nativo de proyecto `.spritium`
 * (conserva resolución, capas, frames, paleta completa y respaldo original).
 */

import { setStatus } from "../ui/index.js";
import { showPromptDialog } from "../ui/modals/ConfirmModal.js";
import { i18n } from "../i18n/I18nService.js";
import {
  openNewDocTab,
  syncActiveTabSnapshot,
  markActiveTabSaved,
  getActiveTabFileHandle,
  setActiveTabFileHandle,
  renameActiveDocTab,
} from "../workspace/docTabs.js";
import {
  buildCurrentProjectSnapshot,
  restoreProjectSnapshot,
  saveRecentProject,
} from "./storage.js";

const SPRITIUM_FILE_PICKER_TYPES = [
  {
    description: "Spritium Project (.spritium)",
    accept: { "application/json": [".spritium"] },
  },
];

async function writeProjectToHandle(handle, jsonText) {
  if (typeof handle.queryPermission === "function") {
    const status = await handle.queryPermission({ mode: "readwrite" });
    if (status !== "granted" && typeof handle.requestPermission === "function") {
      const next = await handle.requestPermission({ mode: "readwrite" });
      if (next !== "granted") {
        throw new Error("Permiso de escritura denegado sobre el archivo.");
      }
    }
  }
  const writable = await handle.createWritable();
  await writable.write(jsonText);
  await writable.close();
}

/**
 * Guarda el proyecto actual en formato `.spritium`.
 * En navegadores con File System Access API escribe directo sobre el archivo vinculado (o abre `showSaveFilePicker`
 * la primera vez o cuando `saveAs = true`) sin marcar como guardado si el usuario cancela.
 * En otros navegadores descarga una copia `.spritium`.
 * @param {{ saveAs?: boolean }} [options={}]
 */
export async function saveProjectFile({ saveAs = false } = {}) {
  const payload = buildCurrentProjectSnapshot();
  await saveRecentProject(payload);
  let jsonText = JSON.stringify(payload);

  if (typeof window !== "undefined" && typeof window.showSaveFilePicker === "function") {
    let handle = saveAs ? null : getActiveTabFileHandle();
    if (handle) {
      try {
        await writeProjectToHandle(handle, jsonText);
        markActiveTabSaved();
        setStatus({ key: "log.project_saved", params: { name: payload.name } });
        return true;
      } catch (err) {
        if (err?.name === "AbortError") {
          setStatus({ key: "log.project_save_cancelled" });
          return false;
        }
        if (err?.name === "NotFoundError") {
          setActiveTabFileHandle(null);
          handle = null;
        } else {
          setStatus({ key: "log.project_save_err", params: { msg: err.message } }, true);
          return false;
        }
      }
    }

    try {
      const picked = await window.showSaveFilePicker({
        suggestedName: `${payload.name}.spritium`,
        types: SPRITIUM_FILE_PICKER_TYPES,
      });
      const savedName = (picked.name || "").replace(/\.spritium$/i, "").trim() || payload.name;
      if (savedName !== payload.name) {
        payload.name = savedName;
        jsonText = JSON.stringify(payload);
        renameActiveDocTab(savedName);
        if (typeof document !== "undefined") {
          const assetEl = document.getElementById("assetName");
          if (assetEl) assetEl.value = savedName;
        }
      }
      await writeProjectToHandle(picked, jsonText);
      setActiveTabFileHandle(picked);
      markActiveTabSaved();
      setStatus({ key: "log.project_saved", params: { name: savedName } });
      return true;
    } catch (err) {
      if (err?.name === "AbortError") {
        setStatus({ key: "log.project_save_cancelled" });
        return false;
      }
      setStatus({ key: "log.project_save_err", params: { msg: err.message } }, true);
      return false;
    }
  }

  let downloadName = payload.name;
  if (saveAs) {
    const chosen = await showPromptDialog({
      title: i18n.t("menu.file.save_as"),
      message: i18n.t("tabs.prompt_save_as"),
      defaultValue: payload.name,
      confirmText: i18n.t("menu.file.save"),
    });
    if (chosen === null) {
      setStatus({ key: "log.project_save_cancelled" });
      return false;
    }
    const clean = chosen.replace(/\.spritium$/i, "").trim() || payload.name;
    downloadName = clean;
    if (clean !== payload.name) {
      payload.name = clean;
      jsonText = JSON.stringify(payload);
      renameActiveDocTab(clean);
      if (typeof document !== "undefined") {
        const assetEl = document.getElementById("assetName");
        if (assetEl) assetEl.value = clean;
      }
    }
  }

  const blob = new Blob([jsonText], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `${downloadName}.spritium`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  markActiveTabSaved();
  setStatus({ key: "log.project_downloaded", params: { name: downloadName } });
  return true;
}

/**
 * Abre siempre el diálogo "Guardar como..." para guardar en otra ubicación/nombre y vincular el nuevo archivo.
 */
export function saveProjectFileAs() {
  return saveProjectFile({ saveAs: true });
}

/**
 * Abre un archivo `.spritium` usando File System Access API (si está disponible) para vincularlo a la pestaña,
 * o recurre al `<input type="file">` clásico en navegadores sin soporte.
 */
export async function openProjectWithPicker() {
  if (typeof window !== "undefined" && typeof window.showOpenFilePicker === "function") {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: SPRITIUM_FILE_PICKER_TYPES,
        multiple: false,
      });
      if (!handle) return;
      const file = await handle.getFile();
      await loadProjectFile(file, { fileHandle: handle });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }
  if (typeof document !== "undefined") {
    document.getElementById("projectFileInput")?.click();
  }
}

/**
 * Carga un archivo `.spritium` restaurando frames, capas, paleta y resolución.
 * @param {File} file
 * @param {{ fileHandle?: any }} [options={}]
 */
export async function loadProjectFile(file, { fileHandle = null } = {}) {
  if (!file) return;
  if (!/\.spritium$/i.test(file.name)) {
    setStatus({ key: "log.project_bad_fmt" }, true);
    return;
  }
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data || data.app !== "Spritium" || !Array.isArray(data.frames) || !data.gridSize) {
      throw new Error("El archivo no tiene un formato .spritium válido.");
    }

    const resolvedName =
      (data.name || file.name.replace(/\.spritium$/i, "") || "").trim() || "nuevo_proyecto";
    data.name = resolvedName;

    openNewDocTab(resolvedName);
    restoreProjectSnapshot(data, {
      key: "log.project_loaded",
      params: {
        name: file.name,
        w: data.gridWidth || data.gridSize,
        h: data.gridHeight || data.gridSize,
        frames: data.frames.length,
      },
    });
    setActiveTabFileHandle(fileHandle);
    syncActiveTabSnapshot(resolvedName);
    await saveRecentProject(buildCurrentProjectSnapshot(resolvedName));
  } catch (err) {
    setStatus({ key: "log.project_open_err", params: { msg: err.message } }, true);
  }
}
