// @ts-check
/**
 * ToolbarConfig.js: Esquemas declarativos para la grilla de herramientas y controles repetitivos del panel izquierdo.
 */

export const TOOL_GRID_ITEMS = [
  { id: "toolPencil", icon: "pencil", titleKey: "tool.pencil", aria: "Lápiz / Spray [B]", action: "selectActivePencilTool", active: true },
  { id: "toolEraser", icon: "eraser", titleKey: "tool.eraser", aria: "Goma [E]", action: "setTool", arg: "eraser" },
  { id: "toolBucket", icon: "paint-bucket", titleKey: "tool.bucket", aria: "Tarro [T]", action: "setTool", arg: "bucket" },
  { id: "toolEyedropper", icon: "pipette", titleKey: "tool.eyedropper", aria: "Gotero [I]", action: "setTool", arg: "eyedropper" },

  { id: "toolLine", icon: "slash", titleKey: "tool.line", aria: "Línea [L]", action: "setTool", arg: "line" },
  { id: "toolShapes", icon: "square", titleKey: "tool.shapes", aria: "Formas Geométricas", action: "selectActiveShapeTool" },
  { id: "toolPolyGroup", icon: "pentagon", titleKey: "tool.poly_group", aria: "Polígono / Contorno", action: "selectActivePolyTool" },
  { id: "toolShading", icon: "sun-moon", titleKey: "tool.shading", aria: "Shading [K]", action: "setTool", arg: "shading" },

  { id: "toolSelect", icon: "box-select", titleKey: "tool.select_group", aria: "Selección Geométrica [S]", action: "selectActiveSelectTool" },
  { id: "toolLasso", icon: "lasso", titleKey: "tool.lasso", aria: "Selección Lazo [Q]", action: "setTool", arg: "lasso" },
  { id: "toolMagicSelect", icon: "wand-2", titleKey: "tool.magic_select", aria: "Selección Inteligente [W]", action: "setTool", arg: "magicSelect" },
  { id: "toolBackgroundEraser", icon: "sparkles", titleKey: "tool.bg_eraser", aria: "Quitar Fondo [D]", action: "setTool", arg: "backgroundEraser" },

  { id: "toolMove", icon: "move", titleKey: "tool.move", aria: "Mover [M]", action: "setTool", arg: "move" },
  { id: "toolPan", icon: "hand", titleKey: "tool.pan", aria: "Mano [H]", action: "setTool", arg: "pan" },
  { id: "toolZoom", icon: "zoom-in", titleKey: "tool.zoom", aria: "Lupa [Z]", action: "setTool", arg: "zoom" },
  { id: "toolFilterBrush", icon: "droplet", titleKey: "tool.filters", aria: "Blur / Jumble", action: "selectActiveFilterTool" },
];

export const PENCIL_TOOL_ITEMS = [
  { id: "pencilBtnPencil", tool: "pencil", icon: "pencil", titleKey: "tool.pencil", labelKey: "tool.pencil_short", active: true },
  { id: "pencilBtnSpray", tool: "spray", icon: "spray-can", titleKey: "tool.spray", labelKey: "tool.spray_short" },
];

export const LINE_STYLE_ITEMS = [
  { id: "lineStyleSolid", arg: "solid", titleKey: "title.line_solid", glyph: "———", active: true },
  { id: "lineStyleDotted", arg: "dotted", titleKey: "title.line_dotted", glyph: "•••••" },
  { id: "lineStyleDashed", arg: "dashed", titleKey: "title.line_dashed", glyph: "- - -" },
  { id: "lineStyleDashdot", arg: "dashdot", titleKey: "title.line_dashdot", glyph: "—•—" },
];

export const CURVE_POINT_PRESETS = [
  { id: "curvePts1", count: 1, titleKey: "title.curve_1", active: true },
  { id: "curvePts2", count: 2, titleKey: "title.curve_2" },
  { id: "curvePts3", count: 3, titleKey: "title.curve_3" },
];

export const SHAPE_SELECTOR_ITEMS = [
  { id: "shapeBtnRect", tool: "rect", icon: "square", titleKey: "title.shape_rect", active: true },
  { id: "shapeBtnCircle", tool: "circle", icon: "circle", titleKey: "title.shape_circle" },
  { id: "shapeBtnTriangle", tool: "triangle", icon: "triangle", titleKey: "title.shape_tri" },
];

export const SELECT_SHAPE_ITEMS = [
  { id: "selBtnRect", tool: "select", icon: "box-select", titleKey: "tool.select", active: true },
  { id: "selBtnEllipse", tool: "ellipseSelect", icon: "circle-dashed", titleKey: "tool.ellipse_select" },
  { id: "selBtnTriangle", tool: "triangleSelect", icon: "triangle", titleKey: "tool.triangle_select" },
];

export const POLY_TOOL_ITEMS = [
  { id: "polyBtnPolygon", tool: "polygon", icon: "pentagon", titleKey: "title.poly_polygon", labelKey: "tool.poly_short", active: true },
  { id: "polyBtnContour", tool: "contour", icon: "pen-tool", titleKey: "title.poly_contour", labelKey: "tool.contour_short" },
];

export const ALIGN_BUTTON_ITEMS = [
  { arg: "center", icon: "crosshair", titleKey: "title.align_center", flex: 2, emptySpan: true },
  { arg: "left", icon: "arrow-left", titleKey: "title.align_left", flex: 1 },
  { arg: "right", icon: "arrow-right", titleKey: "title.align_right", flex: 1 },
  { arg: "top", icon: "arrow-up", titleKey: "title.align_top", flex: 1 },
  { arg: "bottom", icon: "arrow-down", titleKey: "title.align_bottom", flex: 1 },
];

export const TILE_THUMB_SIZES = [
  { id: "btnTileSize32", size: 32, label: "S" },
  { id: "btnTileSize40", size: 40, label: "M", active: true },
  { id: "btnTileSize52", size: 52, label: "L" },
];
