/**
 * timelineTagsAndCelsCore.js: Lógica pura de selección de cels, Frame Tags, linked cels y portapapeles de cels.
 */

/**
 * Genera la clave única `"layerIdx:frameIdx"` para identificar una celda en el Set de selección.
 * @param {number} layerIdx
 * @param {number} frameIdx
 * @returns {string}
 */
export function celKey(layerIdx, frameIdx) {
  return `${layerIdx}:${frameIdx}`;
}

/**
 * Devuelve la lista de coordenadas válidas `(layerIdx, frameIdx)` contenidas en `selectedCels`.
 * @param {Set<string>} selectedCels
 * @param {Array<{ layers?: any[] }>} frames
 * @param {any[]} [layers=[]]
 * @returns {Array<{ layerIdx: number, frameIdx: number }>}
 */
export function getSelectedCelsListCore(selectedCels, frames = [], layers = []) {
  const frameCount = frames.length || 0;
  const maxLayers = Math.max(
    layers.length || 0,
    ...frames.map((fr) => fr.layers?.length || 0),
  );
  const out = [];
  for (const key of selectedCels) {
    const [lStr, fStr] = key.split(":");
    const layerIdx = Number(lStr);
    const frameIdx = Number(fStr);
    if (
      Number.isInteger(layerIdx) &&
      Number.isInteger(frameIdx) &&
      layerIdx >= 0 &&
      layerIdx < maxLayers &&
      frameIdx >= 0 &&
      frameIdx < frameCount
    ) {
      out.push({ layerIdx, frameIdx });
    }
  }
  return out;
}

/**
 * Selecciona un rectángulo continuo de celdas entre `(l0, f0)` y `(l1, f1)`.
 * @param {Set<string>} selectedCels
 * @param {number} l0
 * @param {number} f0
 * @param {number} l1
 * @param {number} f1
 */
export function selectCelRectCore(selectedCels, l0, f0, l1, f1) {
  selectedCels.clear();
  const minL = Math.min(l0, l1);
  const maxL = Math.max(l0, l1);
  const minF = Math.min(f0, f1);
  const maxF = Math.max(f0, f1);
  for (let l = minL; l <= maxL; l++) {
    for (let f = minF; f <= maxF; f++) {
      selectedCels.add(celKey(l, f));
    }
  }
}

/**
 * Normaliza y clampea un rango de frames `[from, to]` dentro de `0..framesCount - 1`.
 * @param {number} rawFrom
 * @param {number} rawTo
 * @param {number} framesCount
 * @returns {{ from: number, to: number }}
 */
export function computeTagRange(rawFrom, rawTo, framesCount) {
  const maxIdx = Math.max(0, framesCount - 1);
  const a = Math.max(0, Math.min(maxIdx, Number(rawFrom) || 0));
  const b = Math.max(0, Math.min(maxIdx, Number(rawTo) || 0));
  return {
    from: Math.min(a, b),
    to: Math.max(a, b),
  };
}

/**
 * Construye un registro de Frame Tag normalizado (nombre max 20 chars, rango clampeado).
 * @param {{ name: string, color?: string, rawFrom: number, rawTo: number, framesCount: number, id?: string }} params
 * @returns {{ id: string, name: string, color: string, from: number, to: number }|null}
 */
export function createFrameTagRecord({ name, color = "#2563eb", rawFrom, rawTo, framesCount, id }) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  const maxIdx = Math.max(0, framesCount - 1);
  const from = Math.max(0, Math.min(maxIdx, Number(rawFrom) || 0));
  const to = Math.max(from, Math.min(maxIdx, Number(rawTo) || 0));
  return {
    id: id || `tag_${Date.now()}`,
    name: trimmed.slice(0, 20),
    color: color || "#2563eb",
    from,
    to,
  };
}

/**
 * Elimina un Frame Tag por ID y limpia `activeTagId` si correspondía al eliminado.
 * @param {Array<{ id: string }>} frameTags
 * @param {string|null} activeTagId
 * @param {string} tagId
 * @returns {{ frameTags: Array<{ id: string }>, activeTagId: string|null }}
 */
export function removeFrameTagCore(frameTags = [], activeTagId = null, tagId) {
  return {
    frameTags: frameTags.filter((t) => t.id !== tagId),
    activeTagId: activeTagId === tagId ? null : activeTagId,
  };
}

/**
 * Resuelve qué Frame Tag debe editarse inline según `activeTagId` o el `activeFrameIndex` actual.
 * @param {Array<{ id: string, from: number, to: number }>} frameTags
 * @param {string|null} activeTagId
 * @param {number} [activeFrameIndex=0]
 * @returns {string|null}
 */
export function resolveInlineRenameTagId(frameTags = [], activeTagId = null, activeFrameIndex = 0) {
  if (activeTagId && frameTags.some((t) => t.id === activeTagId)) {
    return activeTagId;
  }
  if (frameTags.length === 0) return null;
  const match = frameTags.find((t) => activeFrameIndex >= t.from && activeFrameIndex <= t.to) || frameTags[0];
  return match?.id ?? null;
}

/**
 * Enlaza dos capas compartiendo `celGroupId` y clonando grilla y `outOfBounds` de origen a destino.
 * @param {Record<string, any>} srcLayer
 * @param {Record<string, any>} dstLayer
 * @param {string} groupId
 * @param {(g: any[][]) => any[][]} cloneGridFn
 */
export function linkCelLayers(srcLayer, dstLayer, groupId, cloneGridFn) {
  const gid = srcLayer.celGroupId || groupId;
  srcLayer.celGroupId = gid;
  dstLayer.celGroupId = gid;
  dstLayer.grid = cloneGridFn(srcLayer.grid);
  dstLayer.outOfBounds = Array.isArray(srcLayer.outOfBounds)
    ? srcLayer.outOfBounds.map((p) => [...p])
    : [];
}

/**
 * Enlaza en lote las celdas seleccionadas agrupadas por `layerIdx` usando el frame menor como base.
 * @param {Array<{ layers?: any[] }>} frames
 * @param {Array<{ layerIdx: number, frameIdx: number }>} batch
 * @param {(g: any[][]) => any[][]} cloneGridFn
 * @param {number} [stamp=Date.now()]
 */
export function linkCelsBatchCore(frames, batch, cloneGridFn, stamp = Date.now()) {
  const byLayer = new Map();
  for (const item of batch) {
    if (!byLayer.has(item.layerIdx)) byLayer.set(item.layerIdx, []);
    byLayer.get(item.layerIdx).push(item.frameIdx);
  }
  for (const [lIdx, fList] of byLayer.entries()) {
    fList.sort((a, b) => a - b);
    const baseLayer = frames[fList[0]]?.layers?.[lIdx];
    if (!baseLayer) continue;
    const gid = baseLayer.celGroupId || `cel_${stamp}_${lIdx}`;
    for (const fIdx of fList) {
      const dst = frames[fIdx]?.layers?.[lIdx];
      if (!dst) continue;
      linkCelLayers(baseLayer, dst, gid, cloneGridFn);
    }
  }
}

/**
 * Desenlaza un lote de celdas eliminando su `celGroupId`.
 * @param {Array<{ layers?: any[] }>} frames
 * @param {Array<{ layerIdx: number, frameIdx: number }>} batch
 */
export function unlinkCelsBatchCore(frames, batch) {
  for (const { layerIdx, frameIdx } of batch) {
    const cur = frames[frameIdx]?.layers?.[layerIdx];
    if (cur?.celGroupId) delete cur.celGroupId;
  }
}

/**
 * Construye el payload de portapapeles de cels para una o múltiples celdas.
 * @param {Array<{ layers?: any[] }>} frames
 * @param {Array<{ layerIdx: number, frameIdx: number }>} itemsCoords
 * @param {(g: any[][]) => any[][]} cloneGridFn
 * @param {boolean} isBatch
 * @returns {Record<string, any>|null}
 */
export function buildCelClipboardPayload(frames, itemsCoords, cloneGridFn, isBatch) {
  if (!isBatch) {
    const { layerIdx, frameIdx } = itemsCoords[0] || {};
    const targetLayer = frames[frameIdx]?.layers?.[layerIdx];
    if (!targetLayer) return null;
    return {
      isBatch: false,
      grid: cloneGridFn(targetLayer.grid),
      outOfBounds: Array.isArray(targetLayer.outOfBounds)
        ? targetLayer.outOfBounds.map((p) => [...p])
        : [],
    };
  }
  const minL = Math.min(...itemsCoords.map((c) => c.layerIdx));
  const minF = Math.min(...itemsCoords.map((c) => c.frameIdx));
  const items = [];
  for (const { layerIdx, frameIdx } of itemsCoords) {
    const lObj = frames[frameIdx]?.layers?.[layerIdx];
    if (!lObj) continue;
    items.push({
      dl: layerIdx - minL,
      df: frameIdx - minF,
      grid: cloneGridFn(lObj.grid),
      outOfBounds: Array.isArray(lObj.outOfBounds) ? lObj.outOfBounds.map((p) => [...p]) : [],
    });
  }
  return { isBatch: true, items };
}

/**
 * Pega un payload de portapapeles de cel(s) a partir de `(frameIdx, layerIdx)`.
 * @param {Array<{ layers?: any[] }>} frames
 * @param {number} frameIdx
 * @param {number} layerIdx
 * @param {Record<string, any>} clipboard
 * @param {(g: any[][]) => any[][]} cloneGridFn
 * @param {(layer: any) => void} [onTilemapReconcile]
 * @returns {number} Cantidad de celdas pegadas
 */
export function pasteCelClipboardCore(frames, frameIdx, layerIdx, clipboard, cloneGridFn, onTilemapReconcile = null) {
  if (!clipboard) return 0;
  if (clipboard.isBatch && Array.isArray(clipboard.items)) {
    let pasted = 0;
    for (const item of clipboard.items) {
      const dst = frames[frameIdx + item.df]?.layers?.[layerIdx + item.dl];
      if (!dst) continue;
      delete dst.celGroupId;
      dst.grid = cloneGridFn(item.grid);
      dst.outOfBounds = item.outOfBounds.map((p) => [...p]);
      if (dst.type === "tilemap" && onTilemapReconcile) onTilemapReconcile(dst);
      pasted++;
    }
    return pasted;
  }
  const targetLayer = frames[frameIdx]?.layers?.[layerIdx];
  if (!targetLayer) return 0;
  delete targetLayer.celGroupId;
  targetLayer.grid = cloneGridFn(clipboard.grid);
  targetLayer.outOfBounds = clipboard.outOfBounds.map((p) => [...p]);
  if (targetLayer.type === "tilemap" && onTilemapReconcile) onTilemapReconcile(targetLayer);
  return 1;
}

/**
 * Limpia el contenido de las celdas indicadas dejándolas vacías y desenlazadas.
 * @param {Array<{ layers?: any[] }>} frames
 * @param {Array<{ layerIdx: number, frameIdx: number }>} coords
 * @param {number} w
 * @param {number} h
 * @param {(w: number, h: number) => any[][]} createEmptyGridFn
 * @param {(layer: any) => void} [onTilemapReconcile]
 * @returns {number} Cantidad de celdas limpiadas
 */
export function clearCelsCore(frames, coords, w, h, createEmptyGridFn, onTilemapReconcile = null) {
  let cleared = 0;
  for (const { layerIdx, frameIdx } of coords) {
    const dst = frames[frameIdx]?.layers?.[layerIdx];
    if (!dst) continue;
    delete dst.celGroupId;
    dst.grid = createEmptyGridFn(w, h);
    dst.outOfBounds = [];
    if (dst.type === "tilemap" && onTilemapReconcile) onTilemapReconcile(dst);
    cleared++;
  }
  return cleared;
}
