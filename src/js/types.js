// @ts-check
/**
 * types.js: Contratos centrales JSDoc (@typedef / @callback) para validación estática
 * Zero-Build con `jsconfig.json` y `@ts-check` en todo el motor de Spritium.
 */

/**
 * @typedef {"source-over"|"multiply"|"screen"|"overlay"|"darken"|"lighten"|"color-dodge"|"color-burn"} BlendMode
 */

/**
 * @typedef {"none"|"x"|"y"|"both"} TiledMode
 */

/**
 * @typedef {"tiles"|"edit-tile"|"auto"} TilemapEditMode
 */

/**
 * @typedef {"replace"|"add"|"subtract"|"intersect"} SelectionCombineMode
 */

/**
 * @typedef {Object} GridPoint
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} SelectionRegion
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {Uint8Array} [mask]
 */

/**
 * @typedef {Object} Layer
 * @property {string} id
 * @property {string} name
 * @property {boolean} visible
 * @property {boolean} [locked]
 * @property {number} [opacity]
 * @property {BlendMode} [blendMode]
 * @property {"pixel"|"tilemap"} [type]
 * @property {string|null} [tilesetId]
 * @property {number} [tileWidth]
 * @property {number} [tileHeight]
 * @property {number[][]|null} [tileGrid]
 * @property {string} [celGroupId]
 * @property {number[][]} grid
 * @property {Array<[number, number, number]>} [outOfBounds]
 */

/**
 * @typedef {Object} Frame
 * @property {string} id
 * @property {string} [name]
 * @property {string} [color]
 * @property {number} [colWidth]
 * @property {number} durationMs
 * @property {Layer[]} layers
 * @property {number} activeLayerIndex
 */

/**
 * @typedef {Object} FrameTag
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {number} from
 * @property {number} to
 */

/**
 * @typedef {Object} TileItem
 * @property {string} id
 * @property {string} [name]
 * @property {number[][]} grid
 */

/**
 * @typedef {Object} Tileset
 * @property {string} id
 * @property {string} name
 * @property {number} tileWidth
 * @property {number} tileHeight
 * @property {Array<TileItem|null>} tiles
 */

/**
 * @typedef {Object} CustomBrushPixel
 * @property {number} dx
 * @property {number} dy
 * @property {string} hex
 */

/**
 * @typedef {Object} CustomBrush
 * @property {string} id
 * @property {string} name
 * @property {number} w
 * @property {number} h
 * @property {CustomBrushPixel[]} pixels
 */

/**
 * @typedef {Object} ToolContext
 * @property {number} width
 * @property {number} height
 * @property {number} primaryColor
 * @property {number} secondaryColor
 * @property {number} brushSize
 * @property {boolean} pixelPerfect
 * @property {boolean} fillShapes
 * @property {number} circleRadius
 * @property {number} magicTolerance
 * @property {boolean} magicContiguous
 * @property {number} sprayDensity
 * @property {boolean} mirrorH
 * @property {boolean} mirrorV
 * @property {TiledMode} tiledMode
 */

/**
 * @typedef {Object} HistoryCommand
 * @property {number} actionId
 * @property {"layer"|"full"|"delta"} kind
 * @property {string} [label]
 * @property {() => void} [undo]
 * @property {() => void} [redo]
 */

/**
 * @typedef {Object} EventMap
 * @property {void} grid
 * @property {void} layers
 * @property {void} frames
 * @property {void} tilemap
 * @property {void} palette
 * @property {void} history
 * @property {void} dirty
 * @property {string} tool
 */

/**
 * @typedef {Object} ToolStrategy
 * @property {string} [name]
 * @property {(x: number, y: number, ctx?: any) => void} [onDown]
 * @property {(x: number, y: number, ctx?: any) => void} [onMove]
 * @property {(x: number, y: number, ctx?: any) => void} [onUp]
 * @property {() => void} [onCancel]
 */

export const TYPES_VERSION = 1;
