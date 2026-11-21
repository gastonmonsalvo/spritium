/**
 * projectIO.js: Serialización y deserialización del formato nativo de proyecto `.spritium`
 * (conserva resolución, capas, frames, paleta completa y respaldo original).
 */

import { setStatus } from "../ui/index.js";
import { openNewDocTab, syncActiveTabSnapshot, markActiveTabSaved } from "../workspace/docTabs.js";
import {
  buildCurrentProjectSnapshot,
  restoreProjectSnapshot,
  saveRecentProject,
} from "./storage.js";

/**
 * Exporta el proyecto completo actual a un archivo `.spritium` descargable.
 */
export function saveProjectFile() {
  const payload = buildCurrentProjectSnapshot();
  saveRecentProject(payload);

  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `${payload.name}.spritium`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  markActiveTabSaved();
  setStatus({ key: "log.project_saved", params: { name: payload.name } });
}

/**
 * Carga un archivo `.spritium` restaurando frames, capas, paleta y resolución.
 * @param {File} file
 */
export async function loadProjectFile(file) {
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
    syncActiveTabSnapshot(resolvedName);
    await saveRecentProject(buildCurrentProjectSnapshot(resolvedName));
  } catch (err) {
    setStatus({ key: "log.project_open_err", params: { msg: err.message } }, true);
  }
}
