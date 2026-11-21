/**
 * demoSeed.js: Generación de proyectos de demostración precargados en la primera visita.
 */

import { createEmptyGrid, clonePaletteMap } from "./state.js";
import { THEME_PALETTES } from "./palettes.js";
import { renderThumbnailDataUrl } from "./projectSnapshot.js";

function buildSwordDemo() {
  const grid = createEmptyGrid(32);
  const put = (x, y, c) => { if (grid[y]?.[x] !== undefined) grid[y][x] = c; };
  for (let i = 4; i <= 19; i++) {
    put(15, i, 4); put(16, i, 5); put(14, i, 1); put(17, i, 1);
  }
  put(15, 3, 6); put(16, 3, 6); put(15, 2, 1); put(16, 2, 1);
  for (let x = 10; x <= 21; x++) { put(x, 20, 10); put(x, 21, 9); }
  put(15, 20, 20); put(16, 20, 21);
  for (let y = 22; y <= 27; y++) { put(15, y, 14); put(16, y, 15); }
  put(15, 28, 10); put(16, 28, 11);

  const pal = THEME_PALETTES.db32.colors;
  const frames = [{ id: "frame_1", durationMs: 150, activeLayerIndex: 0, layers: [{ id: "layer_base", name: "Base", visible: true, grid }] }];
  return {
    app: "Spritium", version: 1, name: "espada_demo", gridSize: 32, currentThemeKey: "db32",
    paletteMap: clonePaletteMap(pal), customColorIndices: [], activeFrameIndex: 0, frames,
    originalImport: null, updatedAt: Date.now() - 60000, thumbnailDataUrl: renderThumbnailDataUrl(frames, pal, 32),
  };
}

function buildShieldDemo() {
  const grid = createEmptyGrid(32);
  for (let y = 6; y <= 24; y++) {
    const halfW = y < 16 ? 8 : Math.max(1, Math.round(8 - (y - 16) * 0.8));
    for (let x = 16 - halfW; x <= 15 + halfW; x++) {
      const isEdge = x === 16 - halfW || x === 15 + halfW || y === 6 || (y >= 24 && halfW <= 2);
      grid[y][x] = isEdge ? 1 : x < 16 ? 17 : 16;
    }
  }
  for (let y = 11; y <= 16; y++) {
    for (let x = 14; x <= 17; x++) grid[y][x] = y < 14 ? 7 : 6;
  }
  const pal = THEME_PALETTES.endesga39.colors;
  const frames = [{ id: "frame_1", durationMs: 150, activeLayerIndex: 0, layers: [{ id: "layer_base", name: "Base", visible: true, grid }] }];
  return {
    app: "Spritium", version: 1, name: "escudo_endesga39_demo", gridSize: 32, currentThemeKey: "endesga39",
    paletteMap: clonePaletteMap(pal), customColorIndices: [], activeFrameIndex: 0, frames,
    originalImport: null, updatedAt: Date.now() - 120000, thumbnailDataUrl: renderThumbnailDataUrl(frames, pal, 32),
  };
}

/** Construye los snapshots de demostración iniciales si todavía no se sembraron. */
export function createInitialDemoSnapshots() {
  return [buildSwordDemo(), buildShieldDemo()];
}
