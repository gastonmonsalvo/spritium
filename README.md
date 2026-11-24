# Spritium (`v0.9.0-beta.4`)

[English](./README.md) | [Español](./README.es.md)

> **100% Client-Side Web Pixel Art Studio with OKLab perceptual quantization, layers, matrix animation timeline, Tilemaps, ES/EN localization, and multi-format export.**

[![Status](https://img.shields.io/badge/status-beta-orange.svg)](#beta-status)
[![Discord](https://img.shields.io/badge/Discord-Community-5865F2.svg)](https://discord.gg/cxPmhUNFPj)

**Spritium** is a zero-build, 100% client-side pixel art and sprite animation studio built on HTML5 Canvas 2D. Create, import, quantize, animate, and export sprites and tilemaps directly in your browser with local **IndexedDB** persistence — no backend, no account, and no installation required.

* **Live App (GitHub Pages):** [gastonmonsalvo.github.io/spritium](https://gastonmonsalvo.github.io/spritium/)
* **User Guide (Shortcuts, Mouse & Tools):** [User Guide](./docs/viewer.html?doc=HELP.md)
* **Community & Support:** [Join our Discord](https://discord.gg/cxPmhUNFPj)

---

## Key Features

### 1. Import, Tilemaps & Perceptual Quantization (OKLab + Bayer)
* **Supported resolutions:** presets from `16×16` up to `512×512`, plus custom `N × M` (`4–512 px`) from **Edit → Resolution**.
* **1:1 Open or Pixel Art Conversion:** open PNG sprites at native `1:1` size without altering pixels, convert high-res images to pixel art with live preview, and optionally remove connected backgrounds.
* **Tilemap Importer:** import tileset sheets or full tilemaps (`PNG + JSON` / Tiled `.tmj`) with instant tile deduplication and Drag & Drop reordering.
* **Built-in + Custom Palettes:** **Dawnbringer 32 (DB32)**, **DB16**, **PICO-8**, **Arne 16**, **DMG-01 (Game Boy)**, **Terminal 1-Bit**, **Grayscale (16)**, and **Indexed (16)**, using **OKLab** perceptual quantization and optional **Bayer 4×4 / 8×8** ordered dithering.
* **Adaptive Palette Reduction:** weighted K-Means++ in OKLab (`16 / 24 / 32 / 48 / 64` colors) with non-destructive re-adjustment.

### 2. Layers, Matrix Timeline & Animation
* **Layers & Folders:** blend modes (`Normal`, `Multiply`, `Screen`, `Overlay`, `Darken`, `Lighten`, `Color Dodge`, `Color Burn`), per-layer opacity, multi-select (`Ctrl+Click`), locking, Drag & Drop, and inline renaming (`Double click` / `F2`).
* **Non-Destructive Movement:** moving, rotating (`RotSprite`), or free-transforming (`Shift+T`) preserves out-of-bounds pixels per layer without clipping.
* **Matrix Timeline (`Matrix ^`):** expandable **Layers × Frames** grid with playback transport, **Frame Tags** with per-tag looping, **Linked Cels**, Drag & Drop, and **Onion Skin Pro** (adjustable opacity, Prev/Next range, and **Red / Blue** tinting).
* **Multi-Format Export:** live preview, *Nearest-Neighbor* scaling (`1×–16×`), **Animated GIF** (100% client-side LZW), **PNG Strip** (`Row` / `Column` / `Grid N×M`), **Atlas (PNG + JSON)**, and `.spritium` project files.

### 3. Drawing Tools, Symmetry 2.0 & Precision Guides
* **Tools & Custom Brushes:** **Pencil (`B`)** with **Pixel-Perfect**, **Line (`L`)** (45° snap or Bézier curves), **Shapes (`R`/`C`/`U`)**, **Bucket (`T`/`F`)**, **OKLab Shading (`K`)**, **Blur / Jumble**, **Spray**, **Eyedropper (`I`)**, **Eraser (`E`)**, and custom `.sbrush.json` brushes created from selection.
* **Symmetry 2.0:** Horizontal (`H`), Vertical (`V`), Diagonals (`╲` / `╱`), and Radial (`90°` / `45°`), with **2px even / 1px odd (Heart)** center modes, free axis positioning (`Alt+Click/Drag` or coordinates), and selection-centered symmetry.
* **Rulers & Draggable Guides:** canvas center guides, pixel rulers, and draggable reference guides from the top/left rulers.
* **RGBA Color & Palette Tools:** full `#RRGGBBAA`, HSV Wheel with color harmonies, and `.hex` / `.gpl` / `.pal` / `.json` import/export.
* **Boolean Selection & Pixel Preview (`V`):** Rectangle (`S`), Ellipse, Lasso (`Q`), Magic Wand (`W`), Free Transform (`Shift+T`), live tool/bucket footprint preview, and customizable mouse reticle.

### 4. Studio Experience & Localization
* **Live ES / EN switching:** instant interface, palette, and guide translation.
* **Multi-Document Tabs & Crash Recovery:** work on multiple sprites in parallel with automatic local checkpoints in **IndexedDB**.
* **Dockable / Floating Panels, Themes & UI Scale:** drag panels between edges or float them, switch **Dark / Light** themes, and scale UI (`100%`, `115%`, `135%`).

---

## Beta Status

Spritium is currently in **public Beta (`v0.9.0-beta.4`)**. Core features are usable, but active improvements and testing are ongoing.

Found a bug or have a suggestion?
* Use **Help → Send Feedback / Report Bug** directly inside Spritium (automatically attaches reproducible steps without leaving the editor).
* Or join our [Discord Community](https://discord.gg/cxPmhUNFPj) / open a [GitHub Issue](https://github.com/gastonmonsalvo/spritium/issues).

---

## Running Locally

Because Spritium uses native ES Modules, serve the folder over HTTP rather than opening `index.html` via `file://`:

```bash
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).
