/**
 * tilemapTools.js: Estrategias de herramientas por celda de tile y overlay del lienzo Tilemap.
 */

import {
  state,
  pushLayerState,
  cloneGrid,
  getGridDims,
  notify,
} from "../core/state.js";
import { parseColorToRgba } from "../core/color.js";
import { renderAll } from "../canvas/canvas.js";
import { syncActiveLayerGrid } from "./layers.js";
import { traceBresenhamPoints } from "../tools/tools.js";
import { setStatus, setTool } from "../ui/index.js";
import {
  packTileEntry,
  unpackTileEntry,
  getTransformedTilePixels,
  getTilesetById,
  getActiveTileset,
  getActiveTilemapLayer,
  getTileGridDims,
  ensureLayerTileGridDimensions,
  syncTilemapLayerToGrid,
} from "../state/TilemapModel.js";

const TILEMAP_DRAW_TOOLS = new Set([
  "pencil",
  "eraser",
  "bucket",
  "eyedropper",
  "line",
  "rect",
  "circle",
  "triangle",
]);

// --- HERRAMIENTAS EN COORDENADAS DE TILE (MODO "TILES") ---

/**
 * Indica si la capa y modo actuales interceptan herramientas de dibujo para operar por Tile.
 */
export function isTilemapTileModeActive() {
  const layer = getActiveTilemapLayer();
  if (!layer) return false;
  if (state.tilemapMode !== "tiles") return false;
  return TILEMAP_DRAW_TOOLS.has(state.currentTool);
}

function plotTileWithMirror(layer, tx, ty, entry) {
  const { cols, rows } = getTileGridDims(layer);
  const put = (cx, cy) => {
    if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
      layer.tileGrid[cy][cx] = entry;
    }
  };
  put(tx, ty);
  if (state.mirrorH) put(cols - 1 - tx, ty);
  if (state.mirrorV) put(tx, rows - 1 - ty);
  if (state.mirrorH && state.mirrorV) put(cols - 1 - tx, rows - 1 - ty);
}

function pixelToTileCoord(layer, px, py) {
  const { cols, rows, tileW, tileH } = getTileGridDims(layer);
  return {
    tx: Math.max(0, Math.min(cols - 1, Math.floor(px / tileW))),
    ty: Math.max(0, Math.min(rows - 1, Math.floor(py / tileH))),
    cols,
    rows,
  };
}

function getActivePlacementEntry(button) {
  if (state.currentTool === "eraser" || button === 2 || state.activeTileIndex <= 0) {
    return 0;
  }
  return packTileEntry(
    state.activeTileIndex,
    state.tileFlipH,
    state.tileFlipV,
    state.tileRot,
  );
}

function floodFillTileGrid(layer, startTx, startTy, replacementEntry, contiguous = true) {
  const { cols, rows } = getTileGridDims(layer);
  if (startTx < 0 || startTx >= cols || startTy < 0 || startTy >= rows) return false;
  const targetEntry = layer.tileGrid[startTy][startTx];
  if (targetEntry === replacementEntry) return false;

  if (!contiguous) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (layer.tileGrid[y][x] === targetEntry) layer.tileGrid[y][x] = replacementEntry;
      }
    }
    return true;
  }

  const stack = [[startTx, startTy]];
  const visited = new Uint8Array(cols * rows);
  while (stack.length > 0) {
    const [cx, cy] = stack.pop();
    const pos = cy * cols + cx;
    if (visited[pos]) continue;
    visited[pos] = 1;
    if (layer.tileGrid[cy][cx] !== targetEntry) continue;
    layer.tileGrid[cy][cx] = replacementEntry;
    if (cx > 0) stack.push([cx - 1, cy]);
    if (cx + 1 < cols) stack.push([cx + 1, cy]);
    if (cy > 0) stack.push([cx, cy - 1]);
    if (cy + 1 < rows) stack.push([cx, cy + 1]);
  }
  return true;
}

function drawTileRect(layer, x0, y0, x1, y1, entry, fill) {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (fill || x === minX || x === maxX || y === minY || y === maxY) {
        plotTileWithMirror(layer, x, y, entry);
      }
    }
  }
}

function drawTileEllipse(layer, x0, y0, x1, y1, entry, fill) {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = Math.max(0.5, (maxX - minX) / 2);
  const ry = Math.max(0.5, (maxY - minY) / 2);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (fill) {
        if (d <= 1.08) plotTileWithMirror(layer, x, y, entry);
      } else if (d <= 1.15 && d >= 0.55) {
        plotTileWithMirror(layer, x, y, entry);
      }
    }
  }
}

function drawTileTriangle(layer, x0, y0, x1, y1, entry, fill) {
  const topX = Math.round((x0 + x1) / 2);
  const topY = y0;
  const blX = x0;
  const blY = y1;
  const brX = x1;
  const brY = y1;

  if (!fill) {
    traceBresenhamPoints(topX, topY, blX, blY, (x, y) => plotTileWithMirror(layer, x, y, entry));
    traceBresenhamPoints(topX, topY, brX, brY, (x, y) => plotTileWithMirror(layer, x, y, entry));
    traceBresenhamPoints(blX, blY, brX, brY, (x, y) => plotTileWithMirror(layer, x, y, entry));
    return;
  }

  const minX = Math.min(topX, blX, brX);
  const maxX = Math.max(topX, blX, brX);
  const minY = Math.min(topY, blY, brY);
  const maxY = Math.max(topY, blY, brY);
  const sign = (px, py, ax, ay, bx, by) => (px - bx) * (ay - by) - (ax - bx) * (py - by);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d1 = sign(x, y, topX, topY, blX, blY);
      const d2 = sign(x, y, blX, blY, brX, brY);
      const d3 = sign(x, y, brX, brY, topX, topY);
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(hasNeg && hasPos)) plotTileWithMirror(layer, x, y, entry);
    }
  }
}

const tilemapStrokeStrategy = (() => {
  let lastTile = null;
  let lastTool = null;

  return {
    onDown({ x, y, button }) {
      if (button !== 0 && button !== 2) return;
      const layer = getActiveTilemapLayer();
      if (!layer) return;
      ensureLayerTileGridDimensions(layer);
      const { tx, ty } = pixelToTileCoord(layer, x, y);
      const entry = getActivePlacementEntry(button);

      if (state.currentTool === "bucket") {
        pushLayerState();
        const contiguous = true;
        if (floodFillTileGrid(layer, tx, ty, entry, contiguous)) {
          syncTilemapLayerToGrid(layer);
          state.isDirtySinceImport = true;
          renderAll();
          notify("tilemap:render");
        }
        return;
      }

      pushLayerState();
      lastTool = state.currentTool;
      lastTile = { tx, ty };
      plotTileWithMirror(layer, tx, ty, entry);
      syncTilemapLayerToGrid(layer);
      state.isDirtySinceImport = true;
      renderAll();
    },
    onMove({ x, y, button }) {
      if (state.currentTool === "bucket") return;
      const layer = getActiveTilemapLayer();
      if (!layer) return;
      const { tx, ty } = pixelToTileCoord(layer, x, y);
      const entry = getActivePlacementEntry(button);

      if (lastTile && lastTool === state.currentTool && (lastTile.tx !== tx || lastTile.ty !== ty)) {
        traceBresenhamPoints(lastTile.tx, lastTile.ty, tx, ty, (cx, cy) => {
          plotTileWithMirror(layer, cx, cy, entry);
        });
        lastTile = { tx, ty };
        syncTilemapLayerToGrid(layer);
        state.isDirtySinceImport = true;
        renderAll();
      }
    },
    onUp() {
      lastTile = null;
      lastTool = null;
      notify("tilemap:render");
    },
  };
})();

const tilemapEyedropperStrategy = {
  onDown({ x, y }) {
    const layer = getActiveTilemapLayer();
    if (!layer) return;
    ensureLayerTileGridDimensions(layer);
    const { tx, ty } = pixelToTileCoord(layer, x, y);
    const entry = layer.tileGrid[ty]?.[tx] || 0;
    const { tileIndex, flipH, flipV, rot } = unpackTileEntry(entry);
    state.activeTileIndex = tileIndex;
    state.tileFlipH = flipH;
    state.tileFlipV = flipV;
    state.tileRot = rot;
    notify("tilemap:render");
    setTool("pencil");
    setStatus(
      tileIndex > 0 ? { key: "log.tm_picked", params: { idx: tileIndex } } : { key: "log.tm_picked_empty" },
    );
  },
  onMove() {},
  onUp() {},
};

function createTilemapShapeStrategy(kind) {
  let start = null;
  let baseTileGrid = null;

  const paintShape = (layer, sx, sy, ex, ey, entry, fill) => {
    if (kind === "line") {
      traceBresenhamPoints(sx, sy, ex, ey, (cx, cy) => plotTileWithMirror(layer, cx, cy, entry));
    } else if (kind === "rect") {
      drawTileRect(layer, sx, sy, ex, ey, entry, fill);
    } else if (kind === "circle") {
      drawTileEllipse(layer, sx, sy, ex, ey, entry, fill);
    } else if (kind === "triangle") {
      drawTileTriangle(layer, sx, sy, ex, ey, entry, fill);
    }
  };

  return {
    onDown({ x, y, button, event }) {
      if (button !== 0 && button !== 2) return;
      const layer = getActiveTilemapLayer();
      if (!layer) return;
      ensureLayerTileGridDimensions(layer);
      pushLayerState();
      const { tx, ty } = pixelToTileCoord(layer, x, y);
      start = { tx, ty };
      baseTileGrid = cloneGrid(layer.tileGrid);
      const entry = getActivePlacementEntry(button);
      const fill = Boolean(event?.shiftKey || document.getElementById("chkFillShapes")?.checked);
      paintShape(layer, start.tx, start.ty, tx, ty, entry, fill);
      syncTilemapLayerToGrid(layer);
      state.isDirtySinceImport = true;
      renderAll();
    },
    onMove({ x, y, button, event }) {
      if (!start || !baseTileGrid) return;
      const layer = getActiveTilemapLayer();
      if (!layer) return;
      layer.tileGrid = cloneGrid(baseTileGrid);
      const { tx, ty } = pixelToTileCoord(layer, x, y);
      const entry = getActivePlacementEntry(button);
      const fill = Boolean(event?.shiftKey || document.getElementById("chkFillShapes")?.checked);
      paintShape(layer, start.tx, start.ty, tx, ty, entry, fill);
      syncTilemapLayerToGrid(layer);
      renderAll();
    },
    onUp() {
      start = null;
      baseTileGrid = null;
      notify("tilemap:render");
    },
  };
}

const TILEMAP_TOOL_STRATEGIES = {
  pencil: tilemapStrokeStrategy,
  eraser: tilemapStrokeStrategy,
  bucket: tilemapStrokeStrategy,
  eyedropper: tilemapEyedropperStrategy,
  line: createTilemapShapeStrategy("line"),
  rect: createTilemapShapeStrategy("rect"),
  circle: createTilemapShapeStrategy("circle"),
  triangle: createTilemapShapeStrategy("triangle"),
};

/**
 * Devuelve la estrategia de dibujo/edición de Tilemap correspondiente a la herramienta activa.
 * @param {string} toolName
 * @returns {ToolStrategy}
 */
export function getTilemapToolStrategy(toolName) {
  return TILEMAP_TOOL_STRATEGIES[toolName] || tilemapStrokeStrategy;
}

// --- OVERLAY DEL LIENZO (GRILLA DE TILES + GHOST PREVIEW) ---

/**
 * Dibuja sobre el canvas principal la grilla del Tilemap activo y la vista previa fantasma del tile bajo el cursor.
 */
export function drawTilemapCanvasOverlay(ctx, cellSize, tileOriginX, tileOriginY, baseW, baseH, zoom) {
  const layer = getActiveTilemapLayer();
  if (!layer) return;

  const { w, h, tileW, tileH } = getTileGridDims(layer);

  ctx.save();
  ctx.translate(tileOriginX, tileOriginY);

  // 1. Grilla de límites de tiles (cian)
  if (state.showTilemapGrid !== false) {
    ctx.strokeStyle = "rgba(34, 211, 238, 0.45)";
    ctx.lineWidth = Math.max(0.5, 1 / (zoom || 1));
    ctx.beginPath();
    for (let x = 0; x <= w; x += tileW) {
      const px = Math.min(baseW - 0.5, Math.round(x * cellSize) + 0.5);
      ctx.moveTo(px, 0);
      ctx.lineTo(px, baseH);
    }
    for (let y = 0; y <= h; y += tileH) {
      const py = Math.min(baseH - 0.5, Math.round(y * cellSize) + 0.5);
      ctx.moveTo(0, py);
      ctx.lineTo(baseW, py);
    }
    ctx.stroke();
  }

  // 2. Ghost preview de celda en modo "tiles"
  if (
    state.tilemapMode === "tiles" &&
    state.cursorPos &&
    TILEMAP_DRAW_TOOLS.has(state.currentTool)
  ) {
    const cx = state.cursorPos.x;
    const cy = state.cursorPos.y;
    if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
      const tx = Math.floor(cx / tileW);
      const ty = Math.floor(cy / tileH);
      const ox = tx * tileW * cellSize;
      const oy = ty * tileH * cellSize;
      const pw = Math.min(tileW, w - tx * tileW) * cellSize;
      const ph = Math.min(tileH, h - ty * tileH) * cellSize;

      const isEraser = state.currentTool === "eraser" || state.activeTileIndex <= 0;
      const ts = getTilesetById(layer.tilesetId);
      const tileObj = !isEraser ? ts?.tiles?.[state.activeTileIndex] : null;

      if (tileObj?.grid) {
        const pixels = getTransformedTilePixels(
          tileObj.grid,
          tileW,
          tileH,
          state.tileFlipH,
          state.tileFlipV,
          state.tileRot,
        );
        ctx.save();
        ctx.globalAlpha = 0.65;
        const maxRows = Math.min(tileH, h - ty * tileH);
        const maxCols = Math.min(tileW, w - tx * tileW);
        for (let py = 0; py < maxRows; py++) {
          for (let px = 0; px < maxCols; px++) {
            const cIdx = pixels[py]?.[px];
            if (!cIdx) continue;
            const hex = state.paletteMap?.[cIdx];
            if (!hex) continue;
            ctx.fillStyle = hex;
            ctx.fillRect(ox + px * cellSize, oy + py * cellSize, Math.ceil(cellSize), Math.ceil(cellSize));
          }
        }
        ctx.restore();
      }

      ctx.strokeStyle = isEraser ? "rgba(248, 113, 113, 0.92)" : "rgba(56, 189, 248, 0.95)";
      ctx.lineWidth = Math.max(1.5, 2 / (zoom || 1));
      ctx.strokeRect(ox + 0.5, oy + 0.5, pw - 1, ph - 1);
    }
  }

  ctx.restore();
}
