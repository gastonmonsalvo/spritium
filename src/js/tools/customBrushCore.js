/**
 * customBrushCore.js: Lógica pura de captura, normalización, serialización y parseo de pinceles personalizados.
 */

/**
 * Calcula el tamaño nativo 1:1 en px del pincel personalizado.
 * @param {{ w?: number, h?: number }|null|undefined} brush
 * @returns {number}
 */
export function getBrushNativeSize(brush) {
  return Math.max(1, Math.round(Math.max(brush?.w || 1, brush?.h || 1)));
}

/**
 * Captura píxeles opacos de una selección en `grid`, recorta el aire transparente y centra sus deltas.
 * @param {{
 *   grid: number[][],
 *   paletteMap: Record<number, string|null>,
 *   selection: { x: number, y: number, w: number, h: number },
 *   dims: { w: number, h: number },
 *   isInsideSelectionFn: (gx: number, gy: number) => boolean,
 *   name: string,
 *   id?: string,
 * }} params
 * @returns {{ id: string, name: string, w: number, h: number, pixels: Array<{ dx: number, dy: number, hex: string }> }|null}
 */
export function extractBrushFromGridSelection({
  grid,
  paletteMap,
  selection,
  dims,
  isInsideSelectionFn,
  name,
  id,
}) {
  if (!selection) return null;
  const { x, y, w, h } = selection;
  const { w: gw, h: gh } = dims;
  const captured = [];
  let minC = Infinity;
  let maxC = -Infinity;
  let minR = Infinity;
  let maxR = -Infinity;

  for (let r = 0; r < h; r++) {
    const gy = y + r;
    if (gy < 0 || gy >= gh) continue;
    for (let c = 0; c < w; c++) {
      const gx = x + c;
      if (gx < 0 || gx >= gw) continue;
      if (!isInsideSelectionFn(gx, gy)) continue;
      const idx = grid[gy]?.[gx] ?? 0;
      if (!idx || idx === 0) continue;
      const hex = paletteMap?.[idx] || "#ffffff";
      captured.push({ c, r, hex });
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
    }
  }

  if (captured.length === 0) return null;

  const trimmedW = maxC - minC + 1;
  const trimmedH = maxR - minR + 1;
  const halfW = Math.floor(trimmedW / 2);
  const halfH = Math.floor(trimmedH / 2);
  const pixels = captured.map(({ c, r, hex }) => ({
    dx: c - minC - halfW,
    dy: r - minR - halfH,
    hex,
  }));

  return {
    id: id || `brush_${Date.now()}`,
    name,
    w: trimmedW,
    h: trimmedH,
    pixels,
  };
}

/**
 * Elimina un pincel por ID de la lista y limpia `activeCustomBrushId` si correspondía.
 * @param {Array<{ id: string }>} customBrushes
 * @param {string|null} activeCustomBrushId
 * @param {string} brushId
 * @returns {{ customBrushes: Array<{ id: string }>, activeCustomBrushId: string|null }}
 */
export function removeCustomBrushFromList(customBrushes = [], activeCustomBrushId = null, brushId) {
  return {
    customBrushes: customBrushes.filter((b) => b.id !== brushId),
    activeCustomBrushId: activeCustomBrushId === brushId ? null : activeCustomBrushId,
  };
}

/**
 * Construye el payload JSON exportable `.sbrush.json` o `null` si no hay pinceles.
 * @param {any[]} brushes
 * @returns {{ app: string, type: string, version: number, brushes: any[] }|null}
 */
export function buildCustomBrushesExportPayload(brushes = []) {
  if (!Array.isArray(brushes) || brushes.length === 0) return null;
  return {
    app: "Spritium",
    type: "custom_brushes",
    version: 1,
    brushes,
  };
}

/**
 * Parsea y normaliza el contenido JSON de un archivo `.sbrush.json`.
 * @param {string} jsonText
 * @param {string} [fallbackName="Pincel importado"]
 * @param {() => string} [idFactory]
 * @returns {Array<{ id: string, name: string, w: number, h: number, pixels: any[] }>}
 */
export function parseCustomBrushesPayload(
  jsonText,
  fallbackName = "Pincel importado",
  idFactory = () => `brush_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
) {
  const data = JSON.parse(jsonText);
  const list = Array.isArray(data?.brushes) ? data.brushes : Array.isArray(data) ? data : [];
  const valid = list.filter((b) => b && Array.isArray(b.pixels) && b.pixels.length > 0);
  if (!valid.length) throw new Error("Archivo sin pinceles válidos.");
  return valid.map((b) => ({
    id: idFactory(),
    name: String(b.name || fallbackName).slice(0, 24),
    w: Number(b.w) || 4,
    h: Number(b.h) || 4,
    pixels: b.pixels,
  }));
}
