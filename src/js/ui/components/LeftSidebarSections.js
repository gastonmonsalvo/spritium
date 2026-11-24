// @ts-check
/**
 * LeftSidebarSections.js: Sub-vistas declarativas para los módulos del panel lateral izquierdo.
 */

import { i18n } from "../../i18n/I18nService.js";
import {
  TOOL_GRID_ITEMS,
  LINE_STYLE_ITEMS,
  CURVE_POINT_PRESETS,
  SHAPE_SELECTOR_ITEMS,
  SELECT_SHAPE_ITEMS,
  POLY_TOOL_ITEMS,
  ALIGN_BUTTON_ITEMS,
  TILE_THUMB_SIZES,
} from "./ToolbarConfig.js";
import { escapeHtml, renderList } from "./uiHtml.js";

function tAttr(key) {
  return escapeHtml(i18n.t(key));
}

function renderModuleHeader(headerId, titleKey, labelKey, floatBtnId, floatTitleKey) {
  return `
    <div id="${headerId}" class="panel-header-row panel-drag-handle" data-i18n-title="${titleKey}" title="${tAttr(titleKey)}">
      <label data-i18n="${labelKey}" style="margin: 0; pointer-events: none">${tAttr(labelKey)}</label>
      <button type="button" id="${floatBtnId}" class="tool-btn" style="padding: 3px 6px; font-size: 11px" data-i18n-title="${floatTitleKey}" title="${tAttr(floatTitleKey)}">
        <i data-lucide="move" class="ui-icon-sm"></i>
      </button>
    </div>`;
}

function renderToolButton(item) {
  const active = item.active ? " active" : "";
  const argAttr = item.arg ? ` data-action-arg="${escapeHtml(item.arg)}"` : "";
  return `<button class="tool-btn tool-icon-btn${active}" id="${item.id}" data-action="${item.action}"${argAttr} data-i18n-title="${item.titleKey}" title="${tAttr(item.titleKey)}" aria-label="${escapeHtml(item.aria)}"><i data-lucide="${item.icon}" class="ui-icon"></i></button>`;
}

function renderFreeTransformOptions() {
  return `
    <div id="optFreeTransform" style="display: none; flex-direction: column; gap: 5px">
      <label style="margin: 0; font-size: 10px; color: var(--accent-secondary)" data-i18n="opt.free_transform">${tAttr("opt.free_transform")}</label>
      <div style="display: flex; gap: 3px">
        <button type="button" id="ftModeScale" class="tool-btn active" data-action="setFreeTransformMode" data-action-arg="scale" style="flex: 1; font-size: 10px; padding: 4px" data-i18n-title="title.ft_scale" title="${tAttr("title.ft_scale")}" data-i18n="opt.scale">${tAttr("opt.scale")}</button>
        <button type="button" id="ftModePerspective" class="tool-btn" data-action="setFreeTransformMode" data-action-arg="perspective" style="flex: 1; font-size: 10px; padding: 4px" data-i18n-title="title.ft_persp" title="${tAttr("title.ft_persp")}" data-i18n="opt.perspective">${tAttr("opt.perspective")}</button>
        <button type="button" id="ftModeSymmetric" class="tool-btn" data-action="setFreeTransformMode" data-action-arg="symmetric" style="flex: 1; font-size: 10px; padding: 4px" data-i18n-title="title.ft_symm" title="${tAttr("title.ft_symm")}" data-i18n="opt.symmetric">${tAttr("opt.symmetric")}</button>
      </div>
      <div style="display: flex; gap: 4px">
        <button type="button" class="tool-btn" data-action="rotateFreeTransformBy" data-action-arg="-15" style="flex: 1; font-size: 10px; padding: 3px" data-i18n-title="title.rot_m15" title="${tAttr("title.rot_m15")}">-15°</button>
        <button type="button" class="tool-btn" data-action="rotateFreeTransformBy" data-action-arg="15" style="flex: 1; font-size: 10px; padding: 3px" data-i18n-title="title.rot_p15" title="${tAttr("title.rot_p15")}">+15°</button>
      </div>
      <div style="display: flex; gap: 4px">
        <button type="button" class="btn-primary" data-action="commitFreeTransform" style="flex: 1; font-size: 10.5px; padding: 4px" data-i18n-title="title.ft_apply" title="${tAttr("title.ft_apply")}" data-i18n="opt.apply">${tAttr("opt.apply")}</button>
        <button type="button" class="tool-btn" data-action="cancelFreeTransform" style="flex: 1; font-size: 10.5px; padding: 4px" data-i18n-title="title.ft_cancel" title="${tAttr("title.ft_cancel")}" data-i18n="opt.cancel">${tAttr("opt.cancel")}</button>
      </div>
    </div>`;
}

function renderLineAndShapeOptions() {
  const lineStylesHtml = renderList(LINE_STYLE_ITEMS, (s) => `<button type="button" id="${s.id}" class="tool-btn${s.active ? " active" : ""}" data-action="setLineStyle" data-action-arg="${s.arg}" style="font-size: 10px; padding: 3px 2px" data-i18n-title="${s.titleKey}" title="${tAttr(s.titleKey)}">${s.glyph}</button>`);
  const curvePtsHtml = renderList(CURVE_POINT_PRESETS, (p) => `<button type="button" id="${p.id}" class="tool-btn${p.active ? " active" : ""}" data-action="setCurveControlPoints" data-action-arg="${p.count}" style="font-size: 10px; padding: 2px 7px" data-i18n-title="${p.titleKey}" title="${tAttr(p.titleKey)}">${p.count}</button>`);
  const shapeBtnsHtml = renderList(SHAPE_SELECTOR_ITEMS, (s) => `<button type="button" id="${s.id}" class="tool-btn${s.active ? " active" : ""}" data-action="setTool" data-action-arg="${s.tool}" style="flex: 1" data-i18n-title="${s.titleKey}" title="${tAttr(s.titleKey)}"><i data-lucide="${s.icon}" class="ui-icon-sm"></i></button>`);
  const selectShapeBtnsHtml = renderList(SELECT_SHAPE_ITEMS, (s) => `<button type="button" id="${s.id}" class="tool-btn${s.active ? " active" : ""}" data-action="setTool" data-action-arg="${s.tool}" style="flex: 1" data-i18n-title="${s.titleKey}" title="${tAttr(s.titleKey)}"><i data-lucide="${s.icon}" class="ui-icon-sm"></i></button>`);
  const polyBtnsHtml = renderList(POLY_TOOL_ITEMS, (p) => `<button type="button" id="${p.id}" class="tool-btn${p.active ? " active" : ""}" data-action="setTool" data-action-arg="${p.tool}" style="flex: 1; font-size: 10.5px; padding: 4px" data-i18n-title="${p.titleKey}" title="${tAttr(p.titleKey)}"><i data-lucide="${p.icon}" class="ui-icon-sm"></i><span data-i18n="${p.labelKey}">${tAttr(p.labelKey)}</span></button>`);
  return `
    <div id="optLineOptions" style="display: none; flex-direction: column; gap: 6px">
      <div id="optLineModeRow" style="display: flex; gap: 4px">
        <button type="button" id="lineModeStraight" class="tool-btn active" data-action="setLineMode" data-action-arg="straight" style="flex: 1; font-size: 10.5px; padding: 4px" data-i18n-title="title.line_straight" title="${tAttr("title.line_straight")}"><i data-lucide="slash" class="ui-icon-sm"></i><span data-i18n="opt.straight">${tAttr("opt.straight")}</span></button>
        <button type="button" id="lineModeCurve" class="tool-btn" data-action="setLineMode" data-action-arg="curve" style="flex: 1; font-size: 10.5px; padding: 4px" data-i18n-title="title.line_curve" title="${tAttr("title.line_curve")}"><i data-lucide="spline" class="ui-icon-sm"></i><span data-i18n="opt.curve">${tAttr("opt.curve")}</span></button>
      </div>
      <div id="optLineStyleRow" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px">${lineStylesHtml}</div>
      <div id="optCurvePoints" style="display: none; align-items: center; justify-content: space-between; gap: 4px">
        <span style="font-size: 10px; color: var(--text-secondary)" data-i18n="opt.curve_points">${tAttr("opt.curve_points")}</span>
        <div style="display: flex; gap: 3px">${curvePtsHtml}</div>
      </div>
    </div>
    <div id="optShapeSelector" style="display: none; gap: 4px">${shapeBtnsHtml}</div>
    <div id="optSelectShapeSelector" style="display: none; gap: 4px">${selectShapeBtnsHtml}</div>
    <div id="optPolySelector" style="display: none; gap: 4px">${polyBtnsHtml}</div>
    <div id="optPolygonActions" style="display: none; gap: 4px">
      <button type="button" class="tool-btn" data-action="undoPolygonVertexAction" style="flex: 1; font-size: 10px; padding: 4px" data-i18n-title="title.poly_undo_v" title="${tAttr("title.poly_undo_v")}" data-i18n="opt.poly_undo_v">${tAttr("opt.poly_undo_v")}</button>
      <button type="button" class="btn-primary" data-action="commitPolygonAction" style="flex: 1.2; font-size: 10px; padding: 4px" data-i18n-title="title.poly_close" title="${tAttr("title.poly_close")}" data-i18n="opt.poly_close">${tAttr("opt.poly_close")}</button>
      <button type="button" class="tool-btn" data-action="cancelPolygonAction" style="flex: 1; font-size: 10px; padding: 4px" data-i18n-title="title.poly_cancel" title="${tAttr("title.poly_cancel")}" data-i18n="opt.cancel">${tAttr("opt.cancel")}</button>
    </div>
    <div id="optFilterSelector" style="display: none; gap: 4px">
      <button type="button" id="filterBtnBlur" class="tool-btn active" data-action="setTool" data-action-arg="blur" style="flex: 1; font-size: 10.5px; padding: 4px" data-i18n-title="title.blur" title="${tAttr("title.blur")}"><i data-lucide="droplet" class="ui-icon-sm"></i><span data-i18n="tool.blur_short">${tAttr("tool.blur_short")}</span></button>
      <button type="button" id="filterBtnJumble" class="tool-btn" data-action="setTool" data-action-arg="jumble" style="flex: 1; font-size: 10.5px; padding: 4px" data-i18n-title="title.jumble" title="${tAttr("title.jumble")}"><i data-lucide="shuffle" class="ui-icon-sm"></i><span data-i18n="tool.jumble_short">${tAttr("tool.jumble_short")}</span></button>
      <button type="button" id="filterBtnNoise" class="tool-btn" data-action="setTool" data-action-arg="noise" style="flex: 1; font-size: 10.5px; padding: 4px" data-i18n-title="title.noise" title="${tAttr("title.noise")}"><i data-lucide="sparkles" class="ui-icon-sm"></i><span data-i18n="tool.noise_short">${tAttr("tool.noise_short")}</span></button>
    </div>
    <div id="optNoiseBrushOptions" style="display: none; flex-direction: column; gap: 4px">
      <span style="font-size: 10px; color: var(--text-secondary)" data-i18n="opt.noise_mode">${tAttr("opt.noise_mode")}</span>
      <div style="display: flex; gap: 3px">
        <button type="button" id="noiseModeMono" class="tool-btn active" data-action="setNoiseBrushMode" data-action-arg="monochrome" style="flex: 1; font-size: 10px; padding: 3px 4px" data-i18n-title="title.noise_mono" title="${tAttr("title.noise_mono")}" data-i18n="opt.noise_mono">${tAttr("opt.noise_mono")}</button>
        <button type="button" id="noiseModeRgb" class="tool-btn" data-action="setNoiseBrushMode" data-action-arg="rgb" style="flex: 1; font-size: 10px; padding: 3px 4px" data-i18n-title="title.noise_rgb" title="${tAttr("title.noise_rgb")}" data-i18n="opt.noise_rgb">${tAttr("opt.noise_rgb")}</button>
        <button type="button" id="noiseModeLuma" class="tool-btn" data-action="setNoiseBrushMode" data-action-arg="grayscale" style="flex: 1; font-size: 10px; padding: 3px 4px" data-i18n-title="title.noise_luma" title="${tAttr("title.noise_luma")}" data-i18n="opt.noise_luma">${tAttr("opt.noise_luma")}</button>
      </div>
    </div>`;
}

function renderBrushAndWandOptions() {
  return `
    <div id="optCircleRadius" style="display: none; align-items: center; gap: 8px">
      <label for="circleRadiusInput" style="margin: 0; font-size: 10px; white-space: nowrap" data-i18n="opt.radius_px">${tAttr("opt.radius_px")}</label>
      <input type="number" id="circleRadiusInput" min="0" max="64" value="0" data-i18n-title="title.circle_radius" title="${tAttr("title.circle_radius")}" style="width: 56px; padding: 3px 6px; font-size: 11px; border-radius: 4px" />
    </div>
    <label id="optFillShapes" style="display: none; align-items: center; gap: 5px; margin: 0; font-size: 11px; cursor: pointer; text-transform: none"><input type="checkbox" id="chkFillShapes" /><span data-i18n="opt.fill_shapes">${tAttr("opt.fill_shapes")}</span></label>
    <label id="optFillPolygons" style="display: none; align-items: center; gap: 5px; margin: 0; font-size: 11px; cursor: pointer; text-transform: none"><input type="checkbox" id="chkFillPolygons" checked /><span data-i18n="opt.fill_polygons">${tAttr("opt.fill_polygons")}</span></label>
    <label id="optPixelPerfect" style="display: flex; align-items: center; gap: 5px; margin: 0; font-size: 11px; cursor: pointer; text-transform: none" data-i18n-title="title.pixel_perfect" title="${tAttr("title.pixel_perfect")}"><input type="checkbox" id="chkPixelPerfect" checked /><span data-i18n="opt.pixel_perfect">${tAttr("opt.pixel_perfect")}</span></label>
    <div id="optBrushSize" style="display: flex; flex-direction: column; gap: 4px">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px">
        <label for="brushSizeNumber" style="margin: 0; font-size: 10px; white-space: nowrap" data-i18n="opt.brush_thickness">${tAttr("opt.brush_thickness")}</label>
        <input type="number" id="brushSizeNumber" min="1" max="256" step="1" value="1" data-i18n-title="title.brush_num" title="${tAttr("title.brush_num")}" style="width: 54px; padding: 2px 5px; font-size: 11px; border-radius: 4px; text-align: center; font-family: var(--font-mono)" />
      </div>
      <input type="range" id="brushSizeInput" min="1" max="64" step="1" value="1" data-i18n-title="title.brush_range" title="${tAttr("title.brush_range")}" style="width: 100%; margin: 0" />
    </div>
    <div id="optCustomBrushes" style="display: flex; flex-direction: column; gap: 5px; border-top: 1px solid var(--border-subtle); padding-top: 6px">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px">
        <span data-i18n="opt.brushes_dithering" style="font-size: 10px; color: var(--text-secondary)">${tAttr("opt.brushes_dithering")}</span>
        <button type="button" id="btnCustomBrushMode" class="tool-btn" data-action="toggleCustomBrushColorMode" data-i18n="opt.ink_primary" style="display: none; font-size: 9.5px; padding: 2px 5px" data-i18n-title="title.ink_toggle" title="${tAttr("title.ink_toggle")}">${tAttr("opt.ink_primary")}</button>
      </div>
      <div id="brushPatternPresets" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px"></div>
      <div id="customBrushPicker" class="brush-picker">
        <button type="button" id="btnCustomBrushDropdown" class="brush-picker-trigger" aria-expanded="false" aria-controls="customBrushDropdownMenu" data-i18n-title="title.custom_brush" title="${tAttr("title.custom_brush")}">
          <canvas id="activeCustomBrushThumb" class="brush-thumb-sm" width="18" height="18" style="display: none"></canvas>
          <span id="activeCustomBrushLabel" class="brush-picker-label" data-i18n="opt.custom_none">${tAttr("opt.custom_none")}</span>
          <span class="brush-picker-arrow" aria-hidden="true">▾</span>
        </button>
        <div id="customBrushDropdownMenu" class="brush-picker-menu" role="listbox" aria-label="Pinceles personalizados">
          <div class="brush-picker-menu-header"><span data-i18n="opt.saved_brushes">${tAttr("opt.saved_brushes")}</span></div>
          <div id="userBrushesList" class="brush-picker-list"></div>
        </div>
      </div>
      <input type="file" id="brushFileInput" accept=".json,.sbrush.json" style="display: none" />
      <div style="display: flex; gap: 3px">
        <button type="button" class="tool-btn" data-action="createBrushFromSelection" style="flex: 1.3; font-size: 10px; padding: 3px 4px" data-i18n-title="title.brush_from_sel" title="${tAttr("title.brush_from_sel")}" data-i18n="opt.from_sel">${tAttr("opt.from_sel")}</button>
        <button type="button" class="tool-btn" data-action="openCustomBrushDialog" style="flex: 1; font-size: 10px; padding: 3px 4px" data-i18n-title="title.brush_load" title="${tAttr("title.brush_load")}" data-i18n="opt.load">${tAttr("opt.load")}</button>
        <button type="button" class="tool-btn" data-action="exportCustomBrushes" style="flex: 1; font-size: 10px; padding: 3px 4px" data-i18n-title="title.brush_export" title="${tAttr("title.brush_export")}">Exp</button>
      </div>
    </div>
    <div id="optSprayOptions" style="display: none; flex-direction: column; gap: 4px">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px">
        <label for="sprayDensityInput" style="margin: 0; font-size: 10px; white-space: nowrap" data-i18n="opt.density_pct">${tAttr("opt.density_pct")}</label>
        <input type="number" id="sprayDensityInput" min="10" max="100" step="5" value="30" style="width: 52px; padding: 2px 5px; font-size: 11px; text-align: center; font-family: var(--font-mono)" />
      </div>
    </div>
    <div id="optMagicWand" style="display: none; flex-direction: column; gap: 6px; padding-top: 2px">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">
        <label for="magicToleranceInput" data-i18n="opt.tolerance" style="margin: 0; font-size: 10.5px; white-space: nowrap">${tAttr("opt.tolerance")}</label>
        <input type="number" id="magicToleranceInput" min="0" max="64" value="0" data-i18n-title="title.magic_tol" title="${tAttr("title.magic_tol")}" style="width: 56px; padding: 3px 6px; font-size: 11px; border-radius: 4px; text-align: center" />
      </div>
      <label style="display: inline-flex; align-items: center; gap: 6px; margin: 0; font-size: 11px; cursor: pointer; text-transform: none; user-select: none" data-i18n-title="title.magic_contig" title="${tAttr("title.magic_contig")}"><input type="checkbox" id="chkMagicContiguous" checked style="width: 14px; height: 14px; margin: 0; padding: 0; flex-shrink: 0" /><span data-i18n="opt.contiguous">${tAttr("opt.contiguous")}</span></label>
    </div>`;
}

/** Renderiza el módulo de Herramientas y sus opciones contextuales. */
export function renderToolsModule() {
  const toolsGridHtml = renderList(TOOL_GRID_ITEMS, renderToolButton);
  return `
    <section id="moduleTools" class="dock-module">
      ${renderModuleHeader("toolsModuleHeader", "title.drag_tools", "panel.tools", "btnFloatTools", "title.float_tools")}
      <div id="tools" style="display: flex; flex-direction: column; gap: 6px">
        <div class="tools-icon-grid">${toolsGridHtml}</div>
      </div>
      <div id="toolOptionsBox" class="panel-section-card" style="gap: 6px">
        ${renderFreeTransformOptions()}
        ${renderLineAndShapeOptions()}
        ${renderBrushAndWandOptions()}
      </div>
    </section>`;
}

/** Renderiza el módulo acoplable de Tileset / Tilemap. */
export function renderTilesetModule() {
  const thumbSizesHtml = renderList(TILE_THUMB_SIZES, (sz) => `<button type="button" id="${sz.id}" class="tool-btn${sz.active ? " active" : ""}" data-action="setTilesetThumbSize" data-action-arg="${sz.size}">${sz.label}</button>`);
  return `
    <section id="moduleTileset" class="dock-module" style="display: none">
      <div id="tilesetModuleHeader" class="panel-header-row panel-drag-handle" data-i18n-title="title.drag_tileset" title="${tAttr("title.drag_tileset")}">
        <label style="margin: 0; pointer-events: none" data-i18n="panel.tileset">${tAttr("panel.tileset")}</label>
        <div style="display: flex; align-items: center; gap: 3px">
          <button type="button" id="btnFloatTileset" class="tool-btn" style="padding: 3px 6px; font-size: 11px" data-i18n-title="title.float_tileset" title="${tAttr("title.float_tileset")}"><i data-lucide="move" class="ui-icon-sm"></i></button>
          <button type="button" class="tool-btn" data-action="toggleTilesetPanel" data-action-args='[false]' style="padding: 2px 6px; font-size: 11px" data-i18n-title="title.hide_tileset" title="${tAttr("title.hide_tileset")}">×</button>
        </div>
      </div>
      <div class="tileset-actions-row">
        <button type="button" class="tool-btn" data-action="openNewTilemapModal" style="flex: 1; font-size: 10px; padding: 4px 5px" data-i18n-title="title.tm_new_layer" title="${tAttr("title.tm_new_layer")}"><i data-lucide="layout-grid" class="ui-icon-sm"></i><span data-i18n="tilemap.add">${tAttr("tilemap.add")}</span></button>
        <button type="button" class="tool-btn" data-action="openConvertLayerToTilemapModal" style="flex: 1; font-size: 10px; padding: 4px 5px" data-i18n-title="title.tm_convert" title="${tAttr("title.tm_convert")}"><i data-lucide="wand-2" class="ui-icon-sm"></i><span data-i18n="tilemap.convert">${tAttr("tilemap.convert")}</span></button>
        <button type="button" class="tool-btn" data-action="openTilemapImportModal" style="flex: 1; font-size: 10px; padding: 4px 5px" data-i18n-title="title.tm_import" title="${tAttr("title.tm_import")}"><i data-lucide="upload" class="ui-icon-sm"></i><span data-i18n="tilemap.import">${tAttr("tilemap.import")}</span></button>
      </div>
      <select id="tilesetSelect" data-change="selectActiveTilesetByEvent" style="width: 100%; font-size: 10.5px; padding: 4px 6px" data-i18n-title="title.tm_active_ts" title="${tAttr("title.tm_active_ts")}"></select>
      <div class="tilemap-mode-bar" role="group" aria-label="Modo de edición Tilemap">
        <button type="button" id="btnTileModeTiles" class="tool-btn active" data-action="setTilemapMode" data-action-arg="tiles" data-i18n-title="title.tm_mode_tiles" title="${tAttr("title.tm_mode_tiles")}" data-i18n="tilemap.mode_tiles">${tAttr("tilemap.mode_tiles")}</button>
        <button type="button" id="btnTileModeEdit" class="tool-btn" data-action="setTilemapMode" data-action-arg="edit-tile" data-i18n-title="title.tm_mode_edit" title="${tAttr("title.tm_mode_edit")}" data-i18n="tilemap.mode_edit">${tAttr("tilemap.mode_edit")}</button>
        <button type="button" id="btnTileModeAuto" class="tool-btn" data-action="setTilemapMode" data-action-arg="auto" data-i18n-title="title.tm_mode_auto" title="${tAttr("title.tm_mode_auto")}" data-i18n="tilemap.mode_auto">${tAttr("tilemap.mode_auto")}</button>
      </div>
      <div class="tilemap-transform-bar">
        <button type="button" id="btnTileFlipH" class="tool-btn" data-action="toggleTileFlipH" data-i18n-title="title.tm_flip_h" title="${tAttr("title.tm_flip_h")}">H</button>
        <button type="button" id="btnTileFlipV" class="tool-btn" data-action="toggleTileFlipV" data-i18n-title="title.tm_flip_v" title="${tAttr("title.tm_flip_v")}">V</button>
        <button type="button" id="btnTileRot" class="tool-btn" data-action="rotateActiveTilePlacement" data-i18n-title="title.tm_rot" title="${tAttr("title.tm_rot")}"><i data-lucide="rotate-cw" class="ui-icon-sm"></i><span>0°</span></button>
        <button type="button" id="btnTileGridToggle" class="tool-btn active" data-action="toggleTilemapGrid" data-i18n-title="title.tm_grid" title="${tAttr("title.tm_grid")}"><i data-lucide="grid-2x2" class="ui-icon-sm"></i></button>
        <div class="tilemap-size-group" data-i18n-title="title.tm_thumb_size" title="${tAttr("title.tm_thumb_size")}">${thumbSizesHtml}</div>
      </div>
      <div id="tilemapLayerNotice" class="tilemap-layer-notice" style="display: none"></div>
      <div id="tilesetGridContainer" class="tileset-grid-box"></div>
      <div class="tileset-actions-row">
        <button type="button" class="tool-btn" data-action="addEmptyTileToActiveTileset" style="flex: 1; font-size: 10px; padding: 3px 4px" data-i18n-title="title.tm_add_tile" title="${tAttr("title.tm_add_tile")}" data-i18n="tilemap.add_tile">${tAttr("tilemap.add_tile")}</button>
        <button type="button" class="tool-btn" data-action="duplicateActiveTile" style="flex: 1; font-size: 10px; padding: 3px 4px" data-i18n-title="title.tm_dup_tile" title="${tAttr("title.tm_dup_tile")}">Dup</button>
        <button type="button" class="tool-btn" data-action="pruneUnusedTiles" style="flex: 1; font-size: 10px; padding: 3px 4px" data-i18n-title="title.tm_clean_tiles" title="${tAttr("title.tm_clean_tiles")}" data-i18n="tilemap.clear">${tAttr("tilemap.clear")}</button>
        <button type="button" class="tool-btn" data-action="deleteActiveTile" style="flex: 0.7; font-size: 10px; padding: 3px 4px" data-i18n-title="title.tm_del_tile" title="${tAttr("title.tm_del_tile")}"><i data-lucide="trash-2" class="ui-icon-sm"></i></button>
      </div>
      <div class="tileset-inspector">
        <canvas id="activeTilePreviewCanvas" class="tileset-inspector-canvas" width="16" height="16"></canvas>
        <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1">
          <span id="activeTileInfoTitle" style="font-size: 11px; font-weight: 600; color: var(--text-primary)" data-i18n="tilemap.no_tile">${tAttr("tilemap.no_tile")}</span>
          <span id="activeTileInfoMeta" style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono)" data-i18n="tilemap.no_tileset">${tAttr("tilemap.no_tileset")}</span>
        </div>
      </div>
      <div class="tileset-actions-row">
        <button type="button" class="btn-subtle-success" data-action="exportActiveTilesetPng" style="flex: 1; font-size: 10px; padding: 4px 5px" data-i18n-title="title.tm_exp_png" title="${tAttr("title.tm_exp_png")}" data-i18n="tilemap.exp_png">${tAttr("tilemap.exp_png")}</button>
        <button type="button" class="btn-subtle-success" data-action="exportActiveTilemapJson" style="flex: 1; font-size: 10px; padding: 4px 5px" data-i18n-title="title.tm_exp_json" title="${tAttr("title.tm_exp_json")}" data-i18n="tilemap.exp_json">${tAttr("tilemap.exp_json")}</button>
      </div>
    </section>`;
}

/** Renderiza los módulos de Simetría, Transformaciones, Zoom y barra de Logs. */
export function renderUtilityModules() {
  const alignBtnsHtml = renderList(ALIGN_BUTTON_ITEMS, (a) => `<button type="button" class="tool-btn" data-action="alignAction" data-action-arg="${a.arg}" style="flex: ${a.flex}" data-i18n-title="${a.titleKey}" title="${tAttr(a.titleKey)}"><i data-lucide="${a.icon}" class="ui-icon-sm"></i>${a.emptySpan ? "<span></span>" : ""}</button>`);
  return `
    <section id="moduleSymmetry" class="dock-module">
      ${renderModuleHeader("symmetryModuleHeader", "title.drag_sym", "section.symmetry_view", "btnFloatSymmetry", "title.float_sym")}
      <div class="module-grid-actions">
        <button type="button" class="tool-btn" id="toolMirrorH" data-action="toggleMirrorH" data-i18n-title="title.mirror_x" title="${tAttr("title.mirror_x")}"><i data-lucide="flip-horizontal-2" class="ui-icon-sm"></i><span data-i18n="btn.mirror_x">${tAttr("btn.mirror_x")}</span></button>
        <button type="button" class="tool-btn" id="toolMirrorV" data-action="toggleMirrorV" data-i18n-title="title.mirror_y" title="${tAttr("title.mirror_y")}"><i data-lucide="flip-vertical-2" class="ui-icon-sm"></i><span data-i18n="btn.mirror_y">${tAttr("btn.mirror_y")}</span></button>
        <button type="button" class="tool-btn" id="toolMirrorDiagMain" data-action="toggleMirrorDiagMain" data-i18n-title="title.mirror_diag_main" title="${tAttr("title.mirror_diag_main")}"><span>╲</span></button>
        <button type="button" class="tool-btn" id="toolMirrorDiagAnti" data-action="toggleMirrorDiagAnti" data-i18n-title="title.mirror_diag_anti" title="${tAttr("title.mirror_diag_anti")}"><span>╱</span></button>
        <button type="button" class="tool-btn" id="toolMirrorRadial90" data-action="toggleMirrorRadial" data-action-arg="rot90" data-i18n-title="title.mirror_r90" title="${tAttr("title.mirror_r90")}"><i data-lucide="refresh-cw" class="ui-icon-sm"></i><span>90°</span></button>
        <button type="button" class="tool-btn" id="toolMirrorRadial45" data-action="toggleMirrorRadial" data-action-arg="oct45" data-i18n-title="title.mirror_r45" title="${tAttr("title.mirror_r45")}"><i data-lucide="sparkles" class="ui-icon-sm"></i><span>45°</span></button>
        <button type="button" class="tool-btn active" id="btnToggleGrid" data-action="toggleGrid" data-i18n-title="title.grid_btn" title="${tAttr("title.grid_btn")}"><i data-lucide="grid-3x3" class="ui-icon-sm"></i><span data-i18n="btn.grid">${tAttr("btn.grid")}</span></button>
      </div>
      <div id="symmetryConfigBox" class="panel-section-card" style="display: none; flex-direction: column; gap: 5px; padding: 6px; margin-top: 2px">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px">
          <span style="font-size: 10px; color: var(--text-secondary)" data-i18n="sym.axis_mode">${tAttr("sym.axis_mode")}</span>
          <div style="display: flex; gap: 3px; flex: 1; justify-content: flex-end">
            <button type="button" id="btnSymModeBetween" class="tool-btn active" data-action="setSymmetryCenterMode" data-action-arg="between" style="font-size: 9.5px; padding: 2px 6px" data-i18n-title="sym.mode_between_title" title="${tAttr("sym.mode_between_title")}" data-i18n="sym.mode_between">${tAttr("sym.mode_between")}</button>
            <button type="button" id="btnSymModePixel" class="tool-btn" data-action="setSymmetryCenterMode" data-action-arg="pixel" style="font-size: 9.5px; padding: 2px 6px" data-i18n-title="sym.mode_pixel_title" title="${tAttr("sym.mode_pixel_title")}" data-i18n="sym.mode_pixel">${tAttr("sym.mode_pixel")}</button>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 4px">
          <label for="symAxisXInput" style="margin: 0; font-size: 10px; color: var(--text-secondary)">X</label>
          <input type="number" id="symAxisXInput" step="0.5" min="0.5" max="511.5" value="32" data-input="setSymmetryAxisXFromEvent" style="flex: 1; min-width: 0; padding: 2px 4px; font-size: 10.5px; font-family: var(--font-mono); text-align: center" data-i18n-title="sym.axis_x_title" title="${tAttr("sym.axis_x_title")}" />
          <label for="symAxisYInput" style="margin: 0; font-size: 10px; color: var(--text-secondary)">Y</label>
          <input type="number" id="symAxisYInput" step="0.5" min="0.5" max="511.5" value="32" data-input="setSymmetryAxisYFromEvent" style="flex: 1; min-width: 0; padding: 2px 4px; font-size: 10.5px; font-family: var(--font-mono); text-align: center" data-i18n-title="sym.axis_y_title" title="${tAttr("sym.axis_y_title")}" />
          <button type="button" id="btnMoveSymAxis" class="tool-btn" data-action="toggleSymmetryAxisDragMode" style="padding: 2px 6px; font-size: 10px" data-i18n-title="sym.move_axis_title" title="${tAttr("sym.move_axis_title")}"><i data-lucide="move" class="ui-icon-sm"></i></button>
          <button type="button" id="btnCenterSymSelection" class="tool-btn" data-action="centerSymmetryOnSelection" style="padding: 2px 6px; font-size: 10px" data-i18n-title="sym.center_sel_title" title="${tAttr("sym.center_sel_title")}"><i data-lucide="scan" class="ui-icon-sm"></i></button>
          <button type="button" id="btnResetSymAxis" class="tool-btn" data-action="resetSymmetryAxes" style="padding: 2px 6px; font-size: 10px" data-i18n-title="sym.reset_center_title" title="${tAttr("sym.reset_center_title")}"><i data-lucide="locate-fixed" class="ui-icon-sm"></i></button>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 4px; padding-top: 2px" data-i18n-title="title.bg_btn" title="${tAttr("title.bg_btn")}">
        <label for="canvasBgSlider" data-i18n="btn.bg" style="margin: 0; font-size: 10px; white-space: nowrap">${tAttr("btn.bg")}</label>
        <button type="button" id="btnCanvasBgColor" class="tool-btn" data-action="openCanvasBgColorPicker" data-i18n-title="title.bg_color" title="${tAttr("title.bg_color")}" style="width: 22px; height: 20px; padding: 2px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center"><span id="canvasBgColorSwatch" style="width: 100%; height: 100%; border-radius: 2px; background: var(--checker-dark); border: 1px solid var(--border-subtle)"></span></button>
        <button type="button" id="btnCanvasBgChecker" class="tool-btn active" data-action="toggleCanvasBgChecker" style="padding: 2px 5px; font-size: 10px; flex-shrink: 0" data-i18n-title="title.bg_checker" title="${tAttr("title.bg_checker")}"><i data-lucide="grid-2x2" class="ui-icon-sm"></i></button>
        <input type="range" id="canvasBgSlider" min="0" max="100" value="12" data-input="setCanvasBgFromEvent" style="flex: 1; min-width: 0" />
        <span id="canvasBgValue" style="font-size: 10px; font-family: var(--font-mono); color: var(--text-muted); min-width: 28px; text-align: right">12%</span>
        <button type="button" id="btnResetCanvasBg" class="tool-btn" data-action="resetCanvasBg" style="padding: 2px 5px; font-size: 10px; flex-shrink: 0" data-i18n-title="title.bg_reset" title="${tAttr("title.bg_reset")}"><i data-lucide="rotate-ccw" class="ui-icon-sm"></i></button>
      </div>
    </section>
    <section id="moduleTransforms" class="dock-module">
      ${renderModuleHeader("transformsModuleHeader", "title.drag_trans", "section.transforms", "btnFloatTransforms", "title.float_trans")}
      <div class="transform-groups">
        <div class="transform-group">
          <div class="transform-sublabel" data-i18n="section.transforms">${tAttr("section.transforms")}</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px">
            <button type="button" class="tool-btn" data-action="flipSelectionH" data-i18n-title="title.flip_h" title="${tAttr("title.flip_h")}"><i data-lucide="flip-horizontal-2" class="ui-icon-sm"></i><span data-i18n="btn.flip_h">${tAttr("btn.flip_h")}</span></button>
            <button type="button" class="tool-btn" data-action="flipSelectionV" data-i18n-title="title.flip_v" title="${tAttr("title.flip_v")}"><i data-lucide="flip-vertical-2" class="ui-icon-sm"></i><span data-i18n="btn.flip_v">${tAttr("btn.flip_v")}</span></button>
            <button type="button" class="tool-btn" data-action="rotateSelection90" data-i18n-title="title.rot_90" title="${tAttr("title.rot_90")}"><i data-lucide="rotate-cw" class="ui-icon-sm"></i><span>90°</span></button>
            <button type="button" class="tool-btn" data-action="rotateSelection180" data-i18n-title="title.rot_180" title="${tAttr("title.rot_180")}"><i data-lucide="refresh-cw" class="ui-icon-sm"></i><span>180°</span></button>
          </div>
          <button type="button" class="tool-btn" data-action="startFreeTransform" style="width: 100%; margin-top: 4px" data-i18n-title="title.free_trans" title="${tAttr("title.free_trans")}"><i data-lucide="scaling" class="ui-icon-sm"></i><span data-i18n="btn.free_transform">${tAttr("btn.free_transform")}</span></button>
          <div style="display: flex; gap: 4px; align-items: center; margin-top: 4px">
            <input type="number" id="rotAngleInput" value="15" min="-360" max="360" style="width: 52px; padding: 4px 5px; font-size: 11px; border-radius: 4px" data-i18n-title="title.rot_angle" title="${tAttr("title.rot_angle")}" />
            <button type="button" class="tool-btn" data-action="rotSpriteAction" style="flex: 1" data-i18n-title="title.rotsprite" title="${tAttr("title.rotsprite")}"><i data-lucide="compass" class="ui-icon-sm"></i><span data-i18n="opt.rotsprite_deg">${tAttr("opt.rotsprite_deg")}</span></button>
          </div>
        </div>
        <div class="transform-group">
          <div class="transform-sublabel" data-i18n="section.edges_align">${tAttr("section.edges_align")}</div>
          <div style="display: flex; gap: 4px">
            <button type="button" class="tool-btn" data-action="outlineAction" style="flex: 1" data-i18n-title="title.outline_p1" title="${tAttr("title.outline_p1")}"><i data-lucide="square-plus" class="ui-icon-sm"></i><span>+1px</span></button>
            <button type="button" class="tool-btn" data-action="erodeOutlineAction" style="flex: 1" data-i18n-title="title.erode_m1" title="${tAttr("title.erode_m1")}"><i data-lucide="square-minus" class="ui-icon-sm"></i><span>-1px</span></button>
          </div>
          <div style="display: flex; gap: 4px; margin-top: 4px">${alignBtnsHtml}</div>
        </div>
      </div>
    </section>
    <section id="moduleZoom" class="dock-module">
      ${renderModuleHeader("zoomModuleHeader", "title.drag_zoom", "section.zoom_scale", "btnFloatZoom", "title.float_zoom")}
      <div class="zoom-controls" style="display: flex; align-items: center; gap: 6px">
        <button type="button" class="tool-btn" data-action="zoomOut" data-i18n-title="title.zoom_out" title="${tAttr("title.zoom_out")}">−</button>
        <span id="zoomLevelText" style="color: var(--text-muted); font-family: var(--font-mono); font-size: 11px; flex: 1; text-align: center">100%</span>
        <button type="button" class="tool-btn" data-action="zoomIn" data-i18n-title="title.zoom_in" title="${tAttr("title.zoom_in")}">+</button>
        <button type="button" class="tool-btn" data-action="resetZoom" data-i18n-title="title.zoom_reset" title="${tAttr("title.zoom_reset")}">1:1</button>
      </div>
      <input type="range" id="zoomSlider" min="25" max="1600" step="25" value="100" data-i18n-title="title.zoom_slider" title="${tAttr("title.zoom_slider")}" style="width: 100%; margin-top: 6px" />
    </section>
    <div id="logsBox" style="order: 99; margin-top: auto; padding-top: 6px; border-top: 1px solid var(--border-subtle)">
      <button type="button" id="btnLogHistory" class="logs-label logs-trigger" aria-expanded="false" aria-controls="logHistoryWindow" data-action="toggleLogHistory" data-i18n-title="title.logs_btn" title="${tAttr("title.logs_btn")}">
        <span data-i18n="btn.logs">${tAttr("btn.logs")}</span>
        <span id="logHistoryCount" class="logs-count-badge"></span>
        <span id="logHistoryArrow" aria-hidden="true">▴</span>
      </button>
      <div id="statusText" data-i18n="status.ready" style="font-size: 11px; font-family: var(--font-mono); color: var(--text-muted); min-height: 16px">${tAttr("status.ready")}</div>
    </div>`;
}
