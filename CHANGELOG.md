# Changelog

All notable changes to **Spritium** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) (pre-release beta tags).

> **Note on early history:** Public git history in this repository begins at `v0.9.0-beta.1` (`2026-11-21`), when Spritium was restructured into a zero-build, 100% client-side application. Earlier pre-beta milestones (the original Python backend architecture) are summarized in the [Pre-Beta Legacy](#pre-beta-legacy) section without fabricated dates.

---

## [Unreleased] — post `v0.9.0-beta.5` (`2026-11-24` → `2026-11-25`)

### Added
- **CS-Style Reticle Share Code (`SPR-XXXX-XXXX-XXXX`)** in Preferences (`reticleShareCode.js`): encode, decode, validate, copy, and apply mouse crosshair presets via shareable codes.
- **OS Clipboard Image Paste (`Ctrl+V`):** pasting an image from the system clipboard onto the canvas opens the non-destructive Import Modal (`openImportModal`), while internal sprite `Ctrl+C` → `Ctrl+V` preserves its own selection marker.
- **Symmetry Support for Paint Bucket (`floodFill`):** Bucket now fills across active symmetry axes (`getSymmetryPoints`) with `O(1)` short-circuiting for connected regions crossing an axis, plus live multi-region hover preview in `CursorPreviewOverlay`.
- **Top & Bottom Docking for Frames (`#moduleFrames`):** Frames/Timeline can now dock at the top (below document tabs) or bottom of the workspace with `--accent-primary` violet drop highlights, automatically inverting the matrix resizer direction, collapse/reopen button placement, and chevron orientation.
- **Documentation & Showcase:** added app screenshot (`src/assets/screenshot.jpg`), browser/Android support table, collapsible `<details>` FAQ, MIT/Discord/Browser badges, and VS Code Live Server local setup instructions in `README.md` & `README.es.md`.

### Fixed
- **Floating 1:1 Preview (`#modulePreview`) Layout & Container Query:** locked floating bounds (`144px × 136px` minimum, `152px` default), prevented header icon overflow via `overflow: hidden`, and added a CSS Container Query that cleanly switches `"1:1 Preview"` / `"Vista 1:1"` to `"1:1"` at compact widths.
- **Docking Drag Offset, Reset & Frames Dragging:** scaled `offsetX` proportionally on first drag frame when floating modules resize, cleared inline dimensions/anchors on **View → Reset Panels**, wired `#btnFloatFrames` outside `#framesModuleHeader`, added side-edge highlight feedback, and made dragging `#timelineResizer` from collapsed expand smoothly from `0px`.

---

## [0.9.0-beta.5] - 2026-11-25

### Added
- **Polygon (`N`) & Contour (`O`) Tools:** vertex-by-vertex Polygon (45° snap, close on vertex 1 / double-click / `Enter`) and freehand closed Contour with Scanline Even-Odd fill.
- **Grouped Selection Tools:** Rectangle, Ellipse, and new Triangle selection unified under `#toolSelect`, preserving the 4×4 tool grid.
- **Direct Disk Save (`Alt+S`) & Save As (`Alt+Shift+S`):** File System Access API integration to overwrite linked `.spritium` files directly on supported desktop browsers (retains unsaved indicator if cancelled, with download fallback elsewhere).
- **RGBA Workspace Background Picker:** live RGBA/Alpha picker with Checkerboard ↔ Solid toggle and zero-lag preview updates.
- **Noise Brush Modes:** Monochrome, RGB Color, and B&W Luminance modes, plus live preview and grayscale option in the Noise Filter modal.
- **Document Tab Context Menu:** right-click tab actions (Duplicate, Rename, Save, Batch Close) backed by in-app modals.

### Fixed
- **Scanline Polygon Fill & Light/Win98 Themes:** fixed horizontal-edge parity in `scanlineFillPolygon`, Light Theme CSS cascade, Win98 retro green Save/Export accent, and mobile `LogHistory` window sizing.
- **Mobile Quick Pan & Vitest Config:** added dynamic pan/tool swap toggle in mobile dock and excluded `private_backup` from Vitest discovery.

---

## [0.9.0-beta.4] - 2026-11-23

### Added
- **Win98 / MS Paint Easter Egg Theme:** session-only retro Win98 theme with custom SVG icons (triggerable from *About Spritium* or by typing `win98`).
- **Official MIT Licensing & Notices:** added `LICENSE` (MIT) and `THIRD_PARTY_NOTICES.md`.
- **Feedback Character Counters:** live character counters in the Feedback form and safer `.spritium` snapshot handling.
- **Custom Canvas Dimensions:** custom `N × M` resolution support up to `1024` (later clamped to `512` max grid dim) and `docs/index.html` included in GitHub Pages deploy.

### Changed & Refactored
- **Modular Core Extraction & Vitest Suite:** split core/UI/workspace facades (`apiCore`, `imageProcessorCore`, `projectSnapshotCore`, `flightRecorderCore`, `customBrushCore`, `docTabsCore`, `paletteCore`, `framePlaybackCore`, `timelineTagsAndCelsCore`) and set up comprehensive Vitest unit + smoke tests.

### Fixed
- **Hardened Mobile & Touch Experience:** two-finger pinch-to-zoom now rolls back accidental initial dot strokes and locks painting until both fingers lift; hidden destructive `×` palette swatch delete button on touch devices; viewport-aware dropdown menus (`View`, etc.) with dynamic `▾` scroll hint.

---

## [0.9.0-beta.3] - 2026-11-22

### Added
- **Normal Map Studio & Live 2D Lighting:** tangent-space Normal Map generator (OpenGL/DirectX) with auto-orbiting light, visual light gizmo, and independent-tab editing.
- **Pixel Snapper (4-step):** quantization, edge profiles, walk cuts, and resampling for reconstructing blurry or mixel-heavy pixel art imports.
- **HSL Adjustment & Cast Shadow:** new Canvas filters with live in-modal preview.

### Fixed
- **Modal & Touch UX:** native in-app canvas-expand confirmation on large imports, drag-select protection against accidental backdrop closes, larger ruler guide triangles/touch hit radius, touch selection context menu, symmetry support on Blur/Jumble/Noise, and Noise brush strength/i18n fixes.
- **Mobile Docking:** kept Preview and modules docked cleanly on mobile screens and fixed closing the last document tab.

---

## [0.9.0-beta.2] - 2026-11-21

### Added
- **Mobile & Touch SOTA:** Pointer Events pipeline, 2-finger Pinch-to-Zoom & Pan, mobile bottom dock (`Tools`, `Colors` tap + hold `1°⇄2°`, `Layers`, `Frames`), auto-return Eyedropper, and adaptive Help.
- **Custom Rotation Pivot (`Shift+T`):** draggable gold pivot crosshair (`Alt+Click` or drag) to rotate around any joint.
- **Global Color Replace:** `Shift+Click` with Bucket or right-click / long-press palette swatch to replace a color across the project.
- **Out-of-Bounds Layer Import:** import images larger than the canvas (`96×96` into `64×64`) without clipping border pixels.
- **Pixel-Art Noise Filter & Brush (`Canvas → Noise Filter...`):** OKLab palette-quantized texture with live preview.
- **Device Telemetry:** feedback reports include device form factor, OS, browser, and input mode (`mouse`/`touch`/`pen`).

### Fixed
- **Ruler Guides & UI Polish:** theme-aware center guides, `Alt+Drag` ruler guides, HTML title default, and light-theme import modal fixes.

---

## [0.9.0-beta.1] - 2026-11-21

### Added
- **Initial Public Beta Architecture:** 100% client-side zero-build ESNext + HTML5 Canvas 2D pixel art studio with local IndexedDB persistence.
- **Tilemap Importer (`PNG + JSON` / Tiled `.tmj`):** import tileset sheets or full tilemaps with instant deduplication and Drag & Drop tile reordering.
- **Live Image Import Preview & Non-Destructive Re-adjust:** preview OKLab quantization, Bayer dithering, background removal, and downscaling in real time, and tweak anytime via `File → Re-adjust imported image`.
- **Active-Color Pixel Preview (`V`) & Alpha Slider:** preview active paint color opacity before drawing and delete palette swatches along with matching pixels.
- **Grid Coordinates Overlay (`View → Grid Coordinates`)** and native `512×512` canvas preset.
- **In-App Feedback & Flight Recorder (`Help → Send Feedback`):** reproducible action traces attached directly to bug reports.

### Fixed
- **Resolution Change + `Ctrl+Z`:** changing canvas resolution preserves Tilemap grids and syncs zoom on Undo/Redo.

---

## Pre-Beta Legacy

*(Pre-repository history prior to `v0.9.0-beta.1`)*

- **Python Backend Era:** Spritium originally began as a local tool backed by a Python server and experimental AI model/quantization experiments.
- **Migration to 100% Client-Side:** Replaced the Python server and AI runtime dependencies with pure browser-native **OKLab** perceptual quantization, K-Means++ palette reduction, client-side **LZW GIF encoding**, **IndexedDB** checkpoints, and **Zero-Build ES Modules**, enabling instant deployment on GitHub Pages.

[Unreleased]: https://github.com/gastonmonsalvo/spritium/compare/v0.9.0-beta.5...dev
[0.9.0-beta.5]: https://github.com/gastonmonsalvo/spritium/compare/v0.9.0-beta.4...v0.9.0-beta.5
[0.9.0-beta.4]: https://github.com/gastonmonsalvo/spritium/compare/v0.9.0-beta.3...v0.9.0-beta.4
[0.9.0-beta.3]: https://github.com/gastonmonsalvo/spritium/compare/v0.9.0-beta.2...v0.9.0-beta.3
[0.9.0-beta.2]: https://github.com/gastonmonsalvo/spritium/compare/v0.9.0-beta.1...v0.9.0-beta.2
[0.9.0-beta.1]: https://github.com/gastonmonsalvo/spritium/releases/tag/v0.9.0-beta.1
