/**
 * floodAndColorTools.js: Relleno Scanline/Tiled iterativo, gotero y reemplazo/borrado por color.
 */

import { state, pushState, getGridDims } from "../core/state.js";
import { isInsideSelection, wrapCoordX, wrapCoordY } from "./selectionOps.js";

// --- SCANLINE FLOOD FILL ITERATIVO (STACK-SAFE) ---
/**
 * Relleno por inundación iterativo (Scanline Flood Fill en modo normal,
 * y BFS plano con TypedArray en Tiled Mode para envolver bordes sin recursión).
 * @param {number} startX
 * @param {number} startY
 * @param {number} newColor
 */
export function floodFill(startX, startY, newColor) {
  const { w, h } = getGridDims();
  const hasSelection = Boolean(state.selection);
  if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;
  if (hasSelection && !isInsideSelection(startX, startY)) return;

  const baseColor = state.grid[startY]?.[startX];
  if (baseColor === undefined || baseColor === newColor) return;

  // Ruta Tiled Mode: BFS iterativo plano (sin objetos [x,y] ni recursión)
  if (state.tiledMode && state.tiledMode !== "none") {
    const visited = new Uint8Array(w * h);
    const qx = new Int32Array(w * h);
    const qy = new Int32Array(w * h);
    let head = 0;
    let tail = 0;
    qx[tail] = startX;
    qy[tail] = startY;
    tail++;
    visited[startY * w + startX] = 1;

    while (head < tail) {
      const x = qx[head];
      const y = qy[head];
      head++;
      state.grid[y][x] = newColor;

      const nx1 = wrapCoordX(x + 1, w);
      const nx2 = wrapCoordX(x - 1, w);
      const ny1 = wrapCoordY(y + 1, h);
      const ny2 = wrapCoordY(y - 1, h);

      const candidates = [
        nx1, y,
        nx2, y,
        x, ny1,
        x, ny2,
      ];
      for (let i = 0; i < 8; i += 2) {
        const cx = candidates[i];
        const cy = candidates[i + 1];
        if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
        if (hasSelection && !isInsideSelection(cx, cy)) continue;
        const flat = cy * w + cx;
        if (!visited[flat] && state.grid[cy][cx] === baseColor) {
          visited[flat] = 1;
          qx[tail] = cx;
          qy[tail] = cy;
          tail++;
        }
      }
    }
    return;
  }

  // Ruta estándar SOTA: Scanline Flood Fill iterativo con pila
  const canFill = (x, y) =>
    x >= 0 &&
    x < w &&
    y >= 0 &&
    y < h &&
    state.grid[y][x] === baseColor &&
    (!hasSelection || isInsideSelection(x, y));

  const stack = [startX, startY];
  while (stack.length > 0) {
    const y = stack.pop();
    const x = stack.pop();
    if (!canFill(x, y)) continue;

    let lx = x;
    while (lx > 0 && canFill(lx - 1, y)) lx--;

    let rx = x;
    while (rx < w - 1 && canFill(rx + 1, y)) rx++;

    const row = state.grid[y];
    let spanAbove = false;
    let spanBelow = false;

    for (let cx = lx; cx <= rx; cx++) {
      row[cx] = newColor;

      if (y > 0) {
        const matchUp = canFill(cx, y - 1);
        if (!spanAbove && matchUp) {
          stack.push(cx, y - 1);
          spanAbove = true;
        } else if (spanAbove && !matchUp) {
          spanAbove = false;
        }
      }

      if (y < h - 1) {
        const matchDown = canFill(cx, y + 1);
        if (!spanBelow && matchDown) {
          stack.push(cx, y + 1);
          spanBelow = true;
        } else if (spanBelow && !matchDown) {
          spanBelow = false;
        }
      }
    }
  }
}

// --- GOTERO, BORRADO DE FONDO Y VARITA MÁGICA ---
/**
 * Toma el índice de color en (x, y) y actualiza la UI de la paleta.
 * @param {number} x
 * @param {number} y
 * @param {Function} [updateUIFn]
 * @param {boolean} [isSecondary=false]
 */
export function pickColorAt(x, y, updateUIFn, isSecondary = false) {
  const tx = wrapCoordX(x);
  const ty = wrapCoordY(y);
  const colorIdx = state.grid[ty]?.[tx];
  if (colorIdx === undefined) return;
  if (isSecondary) {
    state.secondaryColorIndex = colorIdx;
    if (updateUIFn) updateUIFn(colorIdx);
    return;
  }
  if (colorIdx !== 0 && state.paletteMap[colorIdx]) {
    state.currentColorIndex = colorIdx;
    if (updateUIFn) updateUIFn(colorIdx);
  }
}

/**
 * Elimina por inundación el color conectado desde (startX, startY), volviéndolo transparente (0).
 * @param {number} startX
 * @param {number} startY
 * @returns {boolean} True si se eliminó al menos un píxel.
 */
export function removeConnectedColor(startX, startY) {
  const targetColor = state.grid[startY]?.[startX];
  if (targetColor === undefined || targetColor === 0) return false;

  const size = state.gridSize;
  const { w: gw, h: gh } = getGridDims();
  const visited = new Uint8Array(gw * gh);
  const queue = [[startX, startY]];
  visited[startY * gw + startX] = 1;
  let head = 0;

  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    state.grid[cy][cx] = 0;

    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < gw && ny >= 0 && ny < gh) {
        const idx = ny * gw + nx;
        if (!visited[idx] && state.grid[ny][nx] === targetColor) {
          visited[idx] = 1;
          queue.push([nx, ny]);
        }
      }
    }
  }

  state.isDirtySinceImport = true;
  return true;
}

/**
 * Reemplaza todas las ocurrencias de `targetColorIndex` por transparente (0) en la capa activa.
 * @param {number} targetColorIndex
 * @returns {boolean} True si hubo cambios.
 */
export function replaceColorWithTransparent(targetColorIndex) {
  if (targetColorIndex === undefined || targetColorIndex === 0) return false;
  const { w, h } = getGridDims();
  let changed = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (state.grid[y][x] === targetColorIndex) {
        state.grid[y][x] = 0;
        changed = true;
      }
    }
  }

  if (changed) {
    state.isDirtySinceImport = true;
  }
  return changed;
}

