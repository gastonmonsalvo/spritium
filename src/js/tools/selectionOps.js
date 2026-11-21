/**
 * selectionOps.js: Operaciones de región activa, selección booleana, wrap tiled y varita mágica.
 */

import { state, getGridDims } from "../core/state.js";
import { renderAll } from "../canvas/canvas.js";
import { parseColorToRgb } from "../core/color.js";

// --- REGIÓN ACTIVA Y SELECCIÓN BOOLEANA ---
/**
 * Devuelve el rectángulo activo: la selección actual o el lienzo completo.
 * @returns {{x: number, y: number, w: number, h: number}}
 */
export function getActiveRegion() {
  if (state.selection) {
    return {
      x: state.selection.x,
      y: state.selection.y,
      w: state.selection.w,
      h: state.selection.h,
    };
  }
  const { w, h } = getGridDims();
  return { x: 0, y: 0, w, h };
}

/**
 * Indica si la coordenada (x, y) cae dentro de la selección activa (o si no hay selección).
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isInsideSelection(x, y) {
  if (!state.selection) return true;
  const { x: sx, y: sy, w: sw, h: sh, mask } = state.selection;
  if (x < sx || x >= sx + sw || y < sy || y >= sy + sh) return false;
  if (mask) {
    return mask[(y - sy) * sw + (x - sx)] === 1;
  }
  return true;
}

/**
 * Clona un objeto de selección (incluyendo su máscara si existe).
 * @param {any} sel
 */
export function cloneSelection(sel) {
  if (!sel) return null;
  return {
    x: sel.x,
    y: sel.y,
    w: sel.w,
    h: sel.h,
    mask: sel.mask ? new Uint8Array(sel.mask) : undefined,
  };
}

/**
 * Determina el modo booleano de selección según modificadores:
 * Ctrl = agregar, Alt = restar, Ctrl+Shift/Ctrl+Alt = intersectar, sin modificador = reemplazar.
 * @param {MouseEvent|KeyboardEvent|null|undefined} event
 * @returns {"replace"|"add"|"subtract"|"intersect"}
 */
export function getSelectionMode(event) {
  const ctrl = Boolean(event?.ctrlKey || event?.metaKey);
  const alt = Boolean(event?.altKey);
  const shift = Boolean(event?.shiftKey);
  if (ctrl && (alt || shift)) return "intersect";
  if (ctrl) return "add";
  if (alt) return "subtract";
  return "replace";
}

function isPointInSelectionObj(sel, gx, gy) {
  if (!sel) return false;
  if (gx < sel.x || gx >= sel.x + sel.w || gy < sel.y || gy >= sel.y + sel.h) return false;
  if (!sel.mask) return true;
  return sel.mask[(gy - sel.y) * sel.w + (gx - sel.x)] === 1;
}

/**
 * Combina dos selecciones según `mode` ("replace", "add", "subtract", "intersect") y recorta su bounding box.
 * @param {any} baseSel
 * @param {any} newSel
 * @param {"replace"|"add"|"subtract"|"intersect"} [mode="replace"]
 */
export function combineSelections(baseSel, newSel, mode = "replace") {
  if (mode === "replace") return newSel || null;
  if (!baseSel) return mode === "add" ? newSel || null : null;
  if (!newSel) return mode === "intersect" ? null : cloneSelection(baseSel);

  const minX = Math.min(baseSel.x, newSel.x);
  const minY = Math.min(baseSel.y, newSel.y);
  const maxX = Math.max(baseSel.x + baseSel.w - 1, newSel.x + newSel.w - 1);
  const maxY = Math.max(baseSel.y + baseSel.h - 1, newSel.y + newSel.h - 1);

  let tMinX = maxX + 1;
  let tMinY = maxY + 1;
  let tMaxX = minX - 1;
  let tMaxY = minY - 1;

  const fullW = maxX - minX + 1;
  const fullH = maxY - minY + 1;
  const temp = new Uint8Array(fullW * fullH);

  for (let gy = minY; gy <= maxY; gy++) {
    for (let gx = minX; gx <= maxX; gx++) {
      const inA = isPointInSelectionObj(baseSel, gx, gy);
      const inB = isPointInSelectionObj(newSel, gx, gy);
      const keep =
        mode === "add"
          ? inA || inB
          : mode === "subtract"
            ? inA && !inB
            : inA && inB;
      if (keep) {
        temp[(gy - minY) * fullW + (gx - minX)] = 1;
        if (gx < tMinX) tMinX = gx;
        if (gx > tMaxX) tMaxX = gx;
        if (gy < tMinY) tMinY = gy;
        if (gy > tMaxY) tMaxY = gy;
      }
    }
  }

  if (tMaxX < tMinX || tMaxY < tMinY) return null;

  const w = tMaxX - tMinX + 1;
  const h = tMaxY - tMinY + 1;
  const mask = new Uint8Array(w * h);
  let allOnes = true;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const v = temp[(tMinY - minY + r) * fullW + (tMinX - minX + c)];
      mask[r * w + c] = v;
      if (v === 0) allOnes = false;
    }
  }

  return allOnes ? { x: tMinX, y: tMinY, w, h } : { x: tMinX, y: tMinY, w, h, mask };
}


// --- TRAZADO BRESENHAM, SIMETRÍA Y TILED WRAP ---
/**
 * Envuelve una coordenada X si Tiled Mode está activo en el eje X.
 * @param {number} x
 * @param {number} [width=getGridDims().w]
 * @returns {number}
 */
export function wrapCoordX(x, width = getGridDims().w) {
  if (state.tiledMode === "x" || state.tiledMode === "both") {
    return ((x % width) + width) % width;
  }
  return x;
}

/**
 * Envuelve una coordenada Y si Tiled Mode está activo en el eje Y.
 * @param {number} y
 * @param {number} [height=getGridDims().h]
 * @returns {number}
 */
export function wrapCoordY(y, height = getGridDims().h) {
  if (state.tiledMode === "y" || state.tiledMode === "both") {
    return ((y % height) + height) % height;
  }
  return y;
}

/**
 * Pinta un píxel en la capa activa respetando Tiled Mode, selección y ejes espejo H/V.
 * @param {number} x
 * @param {number} y
 * @param {number} colorIndex Índice de paleta (0 = transparente).

/**
 * Limpia (vuelve transparente) todos los píxeles dentro de la selección activa.
 * @returns {boolean} True si había selección activa.
 */
export function clearSelection() {
  if (!state.selection) return false;
  const { x, y, w, h } = state.selection;
  for (let r = y; r < y + h; r++) {
    for (let c = x; c < x + w; c++) {
      if (isInsideSelection(c, r) && state.grid[r] && state.grid[r][c] !== undefined) {
        state.grid[r][c] = 0;
      }
    }
  }
  state.isDirtySinceImport = true;
  return true;
}

/**
 * Selección inteligente (Varita Mágica) por inundación o global con tolerancia.
 * @param {any} startX
 * @param {any} startY
 * @param {Object} [options]
 */
export function magicSelectAt(startX, startY, { tolerance = 0, contiguous = true, mode = "replace" } = {}) {
  const { w: gw, h: gh } = getGridDims();
  const sx = wrapCoordX(startX, gw);
  const sy = wrapCoordY(startY, gh);
  const targetIdx = state.grid[sy]?.[sx];
  if (targetIdx === undefined) return false;

  const targetRgb = targetIdx === 0 ? null : parseColorToRgb(state.paletteMap[targetIdx]);
  const tolSq = (tolerance * 2.2) ** 2;

  const matches = (idx) => {
    if (idx === targetIdx) return true;
    if (tolerance <= 0 || idx === 0 || targetIdx === 0) return false;
    const rgb = parseColorToRgb(state.paletteMap[idx]);
    if (!rgb || !targetRgb) return false;
    const dr = rgb[0] - targetRgb[0];
    const dg = rgb[1] - targetRgb[1];
    const db = rgb[2] - targetRgb[2];
    return dr * dr + dg * dg + db * db <= tolSq;
  };

  const selected = new Uint8Array(gw * gh);
  let minX = gw, maxX = -1, minY = gh, maxY = -1;

  const mark = (x, y) => {
    selected[y * gw + x] = 1;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  if (contiguous) {
    const visited = new Uint8Array(gw * gh);
    const queue = [[sx, sy]];
    let head = 0;
    while (head < queue.length) {
      const [cx, cy] = queue[head++];
      if (cx < 0 || cx >= gw || cy < 0 || cy >= gh) continue;
      const flat = cy * gw + cx;
      if (visited[flat]) continue;
      visited[flat] = 1;
      if (!matches(state.grid[cy][cx])) continue;
      mark(cx, cy);
      queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  } else {
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        if (matches(state.grid[y][x])) mark(x, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) return false;

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const mask = new Uint8Array(w * h);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (selected[y * gw + x]) {
        mask[(y - minY) * w + (x - minX)] = 1;
      }
    }
  }

  const nextSel = { x: minX, y: minY, w, h, mask };
  state.selection = combineSelections(state.selection, nextSel, mode);
  return true;
}

/**
 * Selecciona la totalidad del lienzo activo.
 */
export function selectAll() {
  const { w, h } = getGridDims();
  state.selection = { x: 0, y: 0, w, h };
  return true;
}

/**
 * Invierte la máscara de selección actual sobre todo el lienzo.
 */
export function invertSelection() {
  const { w, h } = getGridDims();
  if (!state.selection) {
    return selectAll();
  }
  const mask = new Uint8Array(w * h);
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isInsideSelection(x, y)) {
        mask[y * w + x] = 1;
        count++;
      }
    }
  }
  if (count === 0) {
    state.selection = null;
    return false;
  }
  state.selection = { x: 0, y: 0, w, h, mask };
  return true;
}
