/**
 * storage.js: Persistencia asíncrona en IndexedDB para Spritium:
 * - Historial de proyectos recientes con miniaturas.
 * - Autoguardado (Crash Recovery) con debounce y ring-buffer de checkpoints.
 */

import { buildCurrentProjectSnapshot, restoreProjectSnapshot } from "./projectSnapshot.js";
import { createInitialDemoSnapshots } from "./demoSeed.js";

export { buildCurrentProjectSnapshot, restoreProjectSnapshot };

const DB_NAME = "Spritium_DB";
const DB_VERSION = 1;
const STORE_RECENTS = "recents";
const STORE_AUTOSAVE = "autosave";
const SEEDED_FLAG = "spritium_seeded_demos_v1";
const MAX_AUTOSAVE_CHECKPOINTS = 8;
const CHECKPOINT_MIN_INTERVAL_MS = 25000;

let dbPromise = null;
let autosaveTimer = null;
let lastCheckpointAt = 0;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB no disponible")); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_RECENTS)) db.createObjectStore(STORE_RECENTS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_AUTOSAVE)) db.createObjectStore(STORE_AUTOSAVE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function idbRead(db, storeName, fn) {
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(storeName, "readonly").objectStore(storeName));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbWrite(db, storeName, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    fn(tx.objectStore(storeName));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Guarda o actualiza un proyecto en la lista de recientes de IndexedDB. */
export async function saveRecentProject(snapshot = null) {
  try {
    const db = await openDB();
    const snap = snapshot || buildCurrentProjectSnapshot();
    const record = {
      id: `recent_${snap.name.toLowerCase().replace(/[^a-z0-9_-]+/g, "_")}`,
      name: snap.name,
      size: snap.gridSize,
      updatedAt: snap.updatedAt || Date.now(),
      thumbnailDataUrl: snap.thumbnailDataUrl || "",
      projectData: snap,
    };
    await idbWrite(db, STORE_RECENTS, (s) => s.put(record));
  } catch { /* Fallback silencioso */ }
}

async function seedDemoSpritesIfNeeded() {
  try {
    if (localStorage.getItem(SEEDED_FLAG)) return;
    localStorage.setItem(SEEDED_FLAG, "1");
  } catch { return; }
  for (const demo of createInitialDemoSnapshots()) await saveRecentProject(demo);
}

/** Lista los proyectos recientes almacenados en IndexedDB ordenados por fecha. */
export async function listRecentProjects(limit = 6) {
  try {
    const db = await openDB();
    let items = (await idbRead(db, STORE_RECENTS, (s) => s.getAll())) || [];
    if (items.length === 0) {
      await seedDemoSpritesIfNeeded();
      items = (await idbRead(db, STORE_RECENTS, (s) => s.getAll())) || [];
    }
    return items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, limit);
  } catch { return []; }
}

/** Obtiene un proyecto reciente por su identificador. */
export async function getRecentProject(id) {
  try {
    const db = await openDB();
    return (await idbRead(db, STORE_RECENTS, (s) => s.get(id))) || null;
  } catch { return null; }
}

/** Elimina todos los proyectos recientes almacenados en IndexedDB. */
export async function clearRecentProjects() {
  try { localStorage.setItem(SEEDED_FLAG, "1"); } catch {}
  try {
    const db = await openDB();
    await idbWrite(db, STORE_RECENTS, (s) => s.clear());
  } catch {}
}

async function pruneAutosaveCheckpoints(db) {
  const all = (await idbRead(db, STORE_AUTOSAVE, (s) => s.getAll())) || [];
  const checkpoints = all.filter((r) => String(r.id).startsWith("cp_")).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (checkpoints.length <= MAX_AUTOSAVE_CHECKPOINTS) return;
  const toDelete = checkpoints.slice(MAX_AUTOSAVE_CHECKPOINTS);
  await idbWrite(db, STORE_AUTOSAVE, (s) => { for (const old of toDelete) s.delete(old.id); });
}

/** Guarda el estado actual del proyecto como respaldo de recuperación en IndexedDB. */
export async function saveAutosave() {
  try {
    const db = await openDB();
    const snap = buildCurrentProjectSnapshot();
    const now = Date.now();
    const record = {
      id: "current", name: snap.name, size: snap.gridSize,
      width: snap.gridWidth || snap.gridSize, height: snap.gridHeight || snap.gridSize,
      updatedAt: snap.updatedAt, thumbnailDataUrl: snap.thumbnailDataUrl, projectData: snap,
    };
    const saveCp = now - lastCheckpointAt >= CHECKPOINT_MIN_INTERVAL_MS;
    if (saveCp) lastCheckpointAt = now;

    await idbWrite(db, STORE_AUTOSAVE, (s) => {
      s.put(record);
      if (saveCp) s.put({ ...record, id: `cp_${now}` });
    });
    if (saveCp) await pruneAutosaveCheckpoints(db);
  } catch {}
}

/** Lista todos los puntos de recuperación autoguardados en IndexedDB ("current" + checkpoints). */
export async function getAutosaveCheckpoints() {
  try {
    const db = await openDB();
    const all = (await idbRead(db, STORE_AUTOSAVE, (s) => s.getAll())) || [];
    const current = all.find((r) => r.id === "current" && r.projectData);
    const cps = all.filter((r) => String(r.id).startsWith("cp_") && r.projectData).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const list = [];
    if (current) list.push({ ...current, isLatest: true });
    for (const cp of cps) list.push({ ...cp, isLatest: false });
    return list;
  } catch { return []; }
}

/** Elimina un registro puntual de autoguardado por su ID en IndexedDB. */
export async function deleteAutosaveRecord(id) {
  try {
    const db = await openDB();
    await idbWrite(db, STORE_AUTOSAVE, (s) => s.delete(id));
  } catch {}
}

/** Programa un autoguardado (Crash Recovery) con debounce de 800 ms. */
export function scheduleAutosave() {
  if (autosaveTimer !== null) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => { autosaveTimer = null; saveAutosave(); }, 800);
}

/** Recupera la última sesión autoguardada en IndexedDB. */
export async function getAutosave() {
  try {
    const db = await openDB();
    return (await idbRead(db, STORE_AUTOSAVE, (s) => s.get("current"))) || null;
  } catch { return null; }
}

/** Elimina todos los registros de autoguardado y checkpoints en IndexedDB. */
export async function clearAutosave() {
  try {
    const db = await openDB();
    await idbWrite(db, STORE_AUTOSAVE, (s) => s.clear());
  } catch {}
}
