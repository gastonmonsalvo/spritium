// @ts-check
/**
 * PixelDelta.js: Compresión de diferencias por Bounding-Box (Dirty Rect) en buffers `Uint16Array`.
 * Permite almacenar cambios de trazos en O(dirtyRect) en lugar de clonar todo el lienzo `w × h`.
 */

/**
 * @typedef {Object} GridDeltaPatch
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {Uint16Array} before
 * @property {Uint16Array} after
 */

/**
 * Calcula el parche delta mínimo `[minX..maxX, minY..maxY]` entre dos grillas `w × h`.
 * Devuelve `null` si ambas grillas son idénticas.
 * @param {number[][]} prevGrid
 * @param {number[][]} nextGrid
 * @param {number} width
 * @param {number} height
 * @returns {GridDeltaPatch|null}
 */
export function computeGridDelta(prevGrid, nextGrid, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rA = prevGrid[y];
    const rB = nextGrid[y];
    for (let x = 0; x < width; x++) {
      const a = rA?.[x] || 0;
      const b = rB?.[x] || 0;
      if (a !== b) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const before = new Uint16Array(w * h);
  const after = new Uint16Array(w * h);

  for (let r = 0; r < h; r++) {
    const sy = minY + r;
    const rowOff = r * w;
    for (let c = 0; c < w; c++) {
      const sx = minX + c;
      before[rowOff + c] = prevGrid[sy]?.[sx] || 0;
      after[rowOff + c] = nextGrid[sy]?.[sx] || 0;
    }
  }

  return { x: minX, y: minY, w, h, before, after };
}

/**
 * Aplica un parche delta (`before` para undo, `after` para redo) in-place sobre `grid`.
 * @param {number[][]} grid
 * @param {GridDeltaPatch} patch
 * @param {"before"|"after"} [direction="after"]
 */
export function applyGridDelta(grid, patch, direction = "after") {
  if (!grid || !patch) return;
  const buf = direction === "before" ? patch.before : patch.after;
  const { x, y, w, h } = patch;
  for (let r = 0; r < h; r++) {
    const row = grid[y + r];
    if (!row) continue;
    const rowOff = r * w;
    for (let c = 0; c < w; c++) {
      row[x + c] = buf[rowOff + c];
    }
  }
}
