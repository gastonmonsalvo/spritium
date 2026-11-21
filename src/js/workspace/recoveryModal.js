/**
 * recoveryModal.js: Modal de recuperación de trabajo (Crash Recovery) con lista de
 * autoguardados y checkpoints persistidos en IndexedDB.
 */

import {
  getAutosaveCheckpoints,
  deleteAutosaveRecord,
  clearAutosave,
  restoreProjectSnapshot,
} from "../core/storage.js";
import { syncActiveTabSnapshot } from "./docTabs.js";
import { hideLauncher } from "./launcher.js";
import { setStatus } from "../ui/status.js";
import { i18n } from "../i18n/I18nService.js";

function formatCheckpointDate(ts) {
  if (!ts) return "Fecha desconocida";
  const d = new Date(ts);
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  const clock = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const day = d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
  if (diffMin < 1) return i18n.t("recovery.just_now", { clock });
  if (diffMin < 60) return i18n.t("recovery.mins_ago", { n: diffMin, clock });
  return `${day} ${clock}`;
}

function applyRecoveredRecord(record) {
  if (!record?.projectData) return;
  const resolvedName =
    (record.projectData.name || record.name || "").trim() || "nuevo_proyecto";
  const projectData = { ...record.projectData, name: resolvedName };
  restoreProjectSnapshot(projectData, `Trabajo recuperado: ${resolvedName}`);
  syncActiveTabSnapshot(resolvedName);
  hideLauncher();
  closeRecoveryModal();
}

async function renderRecoveryList() {
  const listEl = document.getElementById("recoveryList");
  const btnLatest = document.getElementById("btnRecoverLatest");
  const btnClearAll = document.getElementById("btnClearAllAutosaves");
  if (!listEl) return;

  listEl.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px">Cargando respaldos de IndexedDB...</div>`;
  const records = await getAutosaveCheckpoints();

  if (btnLatest) {
    const latest = records.find((r) => r.isLatest) || records[0] || null;
    btnLatest.disabled = !latest;
    btnLatest.onclick = () => {
      if (latest) applyRecoveredRecord(latest);
    };
  }

  if (btnClearAll) {
    btnClearAll.disabled = records.length === 0;
    btnClearAll.onclick = async () => {
      await clearAutosave();
      await renderRecoveryList();
      setStatus({ key: "recovery.cleared" });
    };
  }

  if (records.length === 0) {
    listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px">${i18n.t("recovery.empty")}</div>`;
    return;
  }

  listEl.innerHTML = "";
  for (const rec of records) {
    const row = document.createElement("div");
    row.style.cssText =
      "display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--bg-input);";

    const thumb = document.createElement("img");
    thumb.alt = rec.name || "Preview";
    thumb.style.cssText =
      "width: 40px; height: 40px; object-fit: contain; image-rendering: pixelated; border-radius: 4px; background: var(--bg-canvas-area); border: 1px solid var(--border-subtle); flex-shrink: 0;";
    if (rec.thumbnailDataUrl) thumb.src = rec.thumbnailDataUrl;

    const info = document.createElement("div");
    info.style.cssText = "flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;";

    const titleRow = document.createElement("div");
    titleRow.style.cssText = "display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--text-primary);";
    const nameSpan = document.createElement("span");
    nameSpan.style.cssText = "overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
    nameSpan.textContent = rec.name || "nuevo_proyecto";
    titleRow.appendChild(nameSpan);

    if (rec.isLatest) {
      const badge = document.createElement("span");
      badge.textContent = i18n.t("recovery.latest_badge");
      badge.style.cssText =
        "font-size: 9.5px; padding: 1px 6px; border-radius: 999px; background: var(--accent-secondary-bg); color: var(--accent-secondary); border: 1px solid var(--accent-secondary); flex-shrink: 0;";
      titleRow.appendChild(badge);
    }

    const w = rec.width || rec.size || 64;
    const h = rec.height || rec.size || 64;
    const meta = document.createElement("div");
    meta.style.cssText = "font-size: 11px; color: var(--text-secondary); font-family: var(--font-mono);";
    meta.textContent = `${w}×${h} · ${formatCheckpointDate(rec.updatedAt)}`;

    info.append(titleRow, meta);

    const actions = document.createElement("div");
    actions.style.cssText = "display: flex; align-items: center; gap: 6px; flex-shrink: 0;";

    const btnRestore = document.createElement("button");
    btnRestore.type = "button";
    btnRestore.className = "btn-primary";
    btnRestore.style.cssText = "padding: 5px 10px; font-size: 11px;";
    btnRestore.textContent = "Restaurar";
    btnRestore.onclick = () => applyRecoveredRecord(rec);

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "tool-btn";
    btnDel.style.cssText = "padding: 5px 8px; font-size: 11px;";
    btnDel.title = i18n.t("recovery.del_backup");
    btnDel.textContent = "×";
    btnDel.onclick = async () => {
      await deleteAutosaveRecord(rec.id);
      await renderRecoveryList();
      setStatus({ key: "log.backup_deleted" });
    };

    actions.append(btnRestore, btnDel);
    row.append(thumb, info, actions);
    listEl.appendChild(row);
  }
}

/**
 * Abre el modal de recuperación de trabajo y carga los checkpoints desde IndexedDB.
 */
export async function openRecoveryModal() {
  const modal = document.getElementById("recoveryModal");
  if (!modal) return;
  modal.classList.add("open");
  await renderRecoveryList();
}

/**
 * Cierra el modal de recuperación de trabajo.
 */
export function closeRecoveryModal() {
  const modal = document.getElementById("recoveryModal");
  if (modal) modal.classList.remove("open");
}
