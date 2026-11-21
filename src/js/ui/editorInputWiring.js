/**
 * editorInputWiring.js: Listeners de carga de archivos, selector de paleta y Drag & Drop del workspace.
 */

import { fetchConfig } from "../core/api.js";
import { state } from "../core/state.js";
import { loadProjectFile } from "../core/projectIO.js";
import { setStatus, importUserConfig } from "./index.js";
import {
  populateThemeSelect,
  applyTheme,
} from "../workspace/paletteManager.js";
import { importPaletteFile, createNewCustomPalette } from "../workspace/paletteIO.js";
import { openImportModal, populateLauncherThemes } from "../workspace/launcher.js";

function bindFileInput(id, onFile) {
  const input = document.getElementById(id);
  if (!input) return;
  input.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (file) await onFile(file);
    event.target.value = "";
  });
}

/** Conecta inputs de archivos ocultos y checkboxes de cuantización/dither. */
export function setupUploadControls() {
  const fileInput = document.getElementById("fileInput");
  const btnUpload = document.getElementById("btnUploadImage");
  if (btnUpload && fileInput) btnUpload.addEventListener("click", () => fileInput.click());

  bindFileInput("fileInput", (file) => openImportModal(file, { asNewLayer: true }));
  bindFileInput("projectFileInput", (file) => loadProjectFile(file));
  bindFileInput("paletteFileInput", (file) => importPaletteFile(file));
  bindFileInput("configFileInput", (file) =>
    importUserConfig(file, {
      onPalettesChanged: async () => {
        const cfg = await fetchConfig();
        state.themesCatalog = cfg.themes || {};
        populateThemeSelect();
        populateLauncherThemes();
      },
    }),
  );

  const chkQuantize = document.getElementById("chkQuantizeOnUpload");
  if (chkQuantize) {
    state.quantizeOnUpload = chkQuantize.checked;
    chkQuantize.addEventListener("change", (e) => { state.quantizeOnUpload = e.target.checked; });
  }

  const chkDither = document.getElementById("chkDitherBayer");
  if (chkDither) {
    state.ditherEnabled = chkDither.checked;
    chkDither.addEventListener("change", (e) => {
      state.ditherEnabled = e.target.checked;
      if (state.currentThemeKey && state.currentThemeKey !== "original") {
        applyTheme(state.currentThemeKey, { recordHistory: true });
      }
    });
  }
}

/** Conecta el selector de paleta/tema del panel derecho. */
export function setupThemeSelector() {
  const sel = document.getElementById("themeSelect");
  if (!sel) return;
  sel.addEventListener("change", (e) => {
    if (e.target.value === "__new_palette__") {
      createNewCustomPalette({ empty: true });
      return;
    }
    applyTheme(e.target.value, { recordHistory: true });
  });
}

/** Registra Drag & Drop de proyectos, paletas e imágenes sobre `#editorMain`. */
export function setupEditorDragAndDrop() {
  const workspace = document.getElementById("workspace");
  const editorMain = document.getElementById("editorMain");
  if (!editorMain) return;

  let dragDepth = 0;
  editorMain.addEventListener("dragenter", (e) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragDepth++;
    workspace?.classList.add("drag-over");
  });
  editorMain.addEventListener("dragover", (e) => {
    if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
  });
  editorMain.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) workspace?.classList.remove("drag-over");
  });
  editorMain.addEventListener("drop", async (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    dragDepth = 0;
    workspace?.classList.remove("drag-over");

    const file = e.dataTransfer.files[0];
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".spritium") || lower.endsWith(".json")) await loadProjectFile(file);
    else if (lower.endsWith(".hex") || lower.endsWith(".gpl") || lower.endsWith(".pal")) await importPaletteFile(file);
    else if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(lower)) openImportModal(file, { asNewLayer: true });
    else setStatus({ key: "log.drag_unsupported" }, true);
  });
}
