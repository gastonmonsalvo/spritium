/**
 * flightRecorderCore.js: Lógica pura de contexto compacto, detección de dispositivo y armado de diagnóstico técnico.
 */

/**
 * Extrae un resumen compacto del estado del editor para breadcrumbs y errores.
 * @param {Record<string, any>} stateObj
 * @returns {Record<string, any>}
 */
export function getCompactWorkspaceContextCore(stateObj) {
  const w = stateObj.gridWidth || stateObj.gridSize || 64;
  const h = stateObj.gridHeight || stateObj.gridSize || 64;
  const activeLayer = Array.isArray(stateObj.layers) ? stateObj.layers[stateObj.activeLayerIndex] : null;
  return {
    res: `${w}x${h}`,
    tool: stateObj.currentTool || "pencil",
    frame: stateObj.activeFrameIndex ?? 0,
    frames: Array.isArray(stateObj.frames) ? stateObj.frames.length : 1,
    layerIdx: stateObj.activeLayerIndex ?? 0,
    layerType: activeLayer?.type || "raster",
    layers: Array.isArray(stateObj.layers) ? stateObj.layers.length : 1,
    historyId: stateObj.currentHistoryActionId ?? 0,
  };
}

/**
 * Detecta OS, navegador, form factor e inputMode a partir de objetos `nav`/`win` desacoplados.
 * @param {Record<string, any>|null} nav
 * @param {Record<string, any>|null} win
 * @param {string|null|undefined} lastPointerType
 */
export function detectDeviceProfileCore(nav, win, lastPointerType) {
  const ua = String(nav?.userAgent || "");
  const maxTouchPoints = Number(nav?.maxTouchPoints || 0);
  const isCoarse = Boolean(win?.matchMedia?.("(pointer: coarse)")?.matches);
  const touchCapable = maxTouchPoints > 0 || isCoarse;

  let os = "Unknown";
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) os = "iPadOS";
  else if (/iPhone|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Macintosh|Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = "Opera";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";

  const minScreen = win ? Math.min(win.innerWidth || 9999, win.innerHeight || 9999) : 1024;
  let formFactor = "desktop";
  if (os === "iPadOS" || (os === "Android" && !/Mobile/i.test(ua))) {
    formFactor = "tablet";
  } else if (os === "iOS" || (/Android/i.test(ua) && /Mobile/i.test(ua)) || (touchCapable && minScreen <= 560)) {
    formFactor = "mobile";
  } else if (touchCapable && minScreen <= 900) {
    formFactor = "tablet";
  }

  const inputMode = lastPointerType || (isCoarse ? "touch" : "mouse");
  const label = `${formFactor} (${os} · ${browser} · ${inputMode}${touchCapable ? " · touch" : ""})`;
  return { formFactor, os, browser, touchCapable, maxTouchPoints, inputMode, label };
}

/**
 * Resume las capas para el reporte de diagnóstico sin exponer buffers de píxeles.
 * @param {any[]} layers
 * @param {string} [tilemapMode="tiles"]
 */
export function summarizeLayersForDiagnostics(layers, tilemapMode = "tiles") {
  if (!Array.isArray(layers)) return [];
  return layers.map((layer, index) => ({
    index,
    id: layer?.id ?? index,
    type: layer?.type || "raster",
    visible: Boolean(layer?.visible ?? true),
    locked: Boolean(layer?.locked),
    opacity: layer?.opacity ?? 1,
    blendMode: layer?.blendMode || "normal",
    parentId: layer?.parentId ?? null,
    ...(layer?.type === "tilemap"
      ? {
          tilesetId: layer?.tilesetId || null,
          tilemapMode: tilemapMode || "tiles",
          gridCols: Array.isArray(layer?.tileGrid?.[0]) ? layer.tileGrid[0].length : 0,
          gridRows: Array.isArray(layer?.tileGrid) ? layer.tileGrid.length : 0,
        }
      : {}),
  }));
}

/**
 * Resume los tilesets para el reporte de diagnóstico.
 * @param {any[]} tilesets
 */
export function summarizeTilesetsForDiagnostics(tilesets) {
  if (!Array.isArray(tilesets)) return [];
  return tilesets.map((ts) => ({
    id: ts?.id,
    tileWidth: ts?.tileWidth || 16,
    tileHeight: ts?.tileHeight || 16,
    tileCount: Array.isArray(ts?.tiles) ? ts.tiles.length : 0,
  }));
}

/**
 * Ensambla el reporte de diagnóstico técnico a partir de estado y metadatos de entorno ya resueltos.
 */
export function buildDiagnosticReportCore({
  stateObj,
  appVersion,
  appChannel,
  environment,
  breadcrumbs = [],
  errors = [],
  nowIso = new Date().toISOString(),
}) {
  const w = stateObj.gridWidth || stateObj.gridSize || 64;
  const h = stateObj.gridHeight || stateObj.gridSize || 64;
  const paletteSize = stateObj.paletteMap instanceof Map ? stateObj.paletteMap.size : 0;
  const layersSummary = summarizeLayersForDiagnostics(stateObj.layers, stateObj.tilemapMode);
  const tilesetsSummary = summarizeTilesetsForDiagnostics(stateObj.tilesets);

  return {
    app: "Spritium",
    appVersion,
    appChannel,
    schemaVersion: 1,
    generatedAt: nowIso,
    environment,
    workspace: {
      resolution: { width: w, height: h },
      zoom: stateObj.zoom || 1,
      currentTool: stateObj.currentTool || "pencil",
      brushSize: stateObj.brushSize || 1,
      mirrorH: Boolean(stateObj.mirrorH),
      mirrorV: Boolean(stateObj.mirrorV),
      tiledMode: stateObj.tiledMode || "none",
      paletteColors: paletteSize,
      themeKey: stateObj.currentThemeKey || "default",
      activeFrameIndex: stateObj.activeFrameIndex ?? 0,
      totalFrames: Array.isArray(stateObj.frames) ? stateObj.frames.length : 1,
      fps: stateObj.fps || 8,
      isPlaying: Boolean(stateObj.isPlaying),
      activeLayerIndex: stateObj.activeLayerIndex ?? 0,
      totalLayers: layersSummary.length,
      layers: layersSummary,
      tilesets: tilesetsSummary,
      history: {
        undoDepth: Array.isArray(stateObj.undoStack) ? stateObj.undoStack.length : 0,
        redoDepth: Array.isArray(stateObj.redoStack) ? stateObj.redoStack.length : 0,
        currentActionId: stateObj.currentHistoryActionId ?? 0,
      },
    },
    breadcrumbs,
    errors,
  };
}
