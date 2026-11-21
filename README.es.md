# Spritium (`v0.9.0-beta.2`)

[English](./README.md) | [Español](./README.es.md)

> **Estudio Web de Pixel Art 100% Client-Side con cuantización perceptual OKLab, sistema de capas, timeline matriz, Tilemaps, idioma ES/EN y exportación multi-formato.**

[![Estado](https://img.shields.io/badge/estado-beta-orange.svg)](#estado-beta)
[![Discord](https://img.shields.io/badge/Discord-Comunidad-5865F2.svg)](https://discord.gg/cxPmhUNFPj)

**Spritium** es un estudio de pixel art y animación de sprites 100% client-side construido sobre HTML5 Canvas 2D, sin build ni dependencias externas. Creá, importá, cuantizá, animá y exportá sprites y tilemaps directo desde tu navegador con persistencia local en **IndexedDB** — sin servidor, sin cuentas y sin instalación.

* **App en Vivo (GitHub Pages):** [gastonmonsalvo.github.io/spritium](https://gastonmonsalvo.github.io/spritium/)
* **Guía de Uso (Atajos, Mouse y Herramientas):** [Guía de Uso](./docs/viewer.html?doc=HELP.md)
* **Comunidad y Soporte:** [Sumate al Discord](https://discord.gg/cxPmhUNFPj)

---

## Funcionalidades Principales

### 1. Importación, Tilemaps y Cuantización Perceptual (OKLab + Bayer)
* **Resoluciones soportadas:** presets desde `16×16` hasta `512×512` y tamaño personalizado `N × M` (`4–512 px`) desde **Edición → Resolución**.
* **Apertura 1:1 o Conversión a Pixel Art:** abrí PNGs en tamaño real `1:1` sin alterar píxeles, convertí imágenes a pixel art con vista previa en vivo y quitá el fondo conectado de forma opcional.
* **Importador de Tilemaps:** importá hojas de tileset o mapas completos (`PNG + JSON` / Tiled `.tmj`) con deduplicado instantáneo y reordenamiento Drag & Drop.
* **Paletas integradas + Custom Palettes:** **Dawnbringer 32 (DB32)**, **DB16**, **PICO-8**, **Arne 16**, **DMG-01 (Game Boy)**, **Terminal 1-Bit**, **Grayscale (16)** e **Indexed (16)**, usando cuantización perceptual en **OKLab** y **Dithering ordenado (Bayer 4×4 / 8×8)** opcional.
* **Reducción Adaptativa de Paleta:** K-Means++ ponderado en OKLab (`16 / 24 / 32 / 48 / 64` colores propios) con re-ajuste no destructivo.

### 2. Capas, Timeline Matriz y Animación
* **Capas y Carpetas:** blend modes (`Normal`, `Multiply`, `Screen`, `Overlay`, `Darken`, `Lighten`, `Color Dodge`, `Color Burn`), opacidad por capa, multiselección (`Ctrl+Clic`), bloqueo, Drag & Drop y renombrado inline (`Doble clic` / `F2`).
* **Movimiento No Destructivo:** mover, rotar (`RotSprite`) o transformar libremente (`Shift+T`) conserva los píxeles fuera de cuadro por capa sin recortarlos.
* **Timeline Matriz (`Matriz ^`):** grilla expandible de **Capas × Frames** con controles de reproducción, **Tag Frames** con loop por tag, **Linked Cels**, Drag & Drop y **Onion Skin Pro** (opacidad regulable, rango Prev/Next y **Modo Rojo / Azul**).
* **Exportación Multi-Formato:** vista previa en vivo, escala *Nearest-Neighbor* (`1×–16×`), **GIF Animado** (LZW 100% client-side), **Tira PNG** (`Fila` / `Columna` / `Grilla N×M`), **Atlas (PNG + JSON)** y archivos de proyecto `.spritium`.

### 3. Herramientas, Simetría 2.0 y Guías de Precisión
* **Herramientas y Pinceles Custom:** **Lápiz (`B`)** con **Pixel-Perfect**, **Línea (`L`)** (recta a 45° o curvas Bézier), **Formas (`R`/`C`/`U`)**, **Tarro (`T`/`F`)**, **Shading OKLab (`K`)**, **Blur / Jumble**, **Spray**, **Gotero (`I`)**, **Goma (`E`)** y pinceles propios `.sbrush.json` creados desde selección.
* **Simetría 2.0:** Horizontal (`H`), Vertical (`V`), Diagonales (`╲` / `╱`) y Radial (`90°` / `45°`), con modo de centro **par (2px) / impar (1px corazón)**, posicionamiento libre del eje (`Alt+Clic/Arrastrar` o coordenadas) y centrado sobre selección.
* **Reglas y Guías Arrastrables:** guías visuales del centro del lienzo, reglas en píxeles y guías de referencia arrastrables desde las reglas superior e izquierda.
* **Color RGBA y Paletas:** soporte completo `#RRGGBBAA`, Rueda HSV con armonías cromáticas e importación/exportación `.hex`, `.gpl`, `.pal` y `.json`.
* **Selección Booleana y Vista Previa (`V`):** Rectángulo (`S`), Elipse, Lazo (`Q`), Varita Mágica (`W`), Transformación Libre (`Shift+T`), previsualización en vivo de huella/tarro y mira del ratón personalizable.

### 4. Experiencia de Estudio e Idioma
* **Cambio de idioma en vivo (`ES / EN`):** interfaz, paletas y guía de usuario traducidas en tiempo real.
* **Pestañas Multi-Documento y Recuperación:** trabajá con múltiples sprites en paralelo con checkpoints automáticos locales en **IndexedDB**.
* **Paneles Acoplables / Flotantes, Temas y Escala de UI:** arrastrá módulos entre bordes o dejalos flotantes, alterná tema **Oscuro / Claro** y ajustá la escala (`100%`, `115%`, `135%`).

---

## Estado Beta

Spritium se encuentra actualmente en **Beta pública (`v0.9.0-beta.2`)**. Las herramientas principales son funcionales, pero seguimos puliendo detalles y testeando fuerte.

¿Encontraste un bug o tenés una idea?
* Usá **Ayuda → Enviar Feedback / Reportar Bug** directo dentro de Spritium (adjunta pasos reproducibles automáticamente sin salir del editor).
* O sumate a nuestra [Comunidad en Discord](https://discord.gg/cxPmhUNFPj) / abrí un [Issue en GitHub](https://github.com/gastonmonsalvo/spritium/issues).

---

## Ejecución Local

Como Spritium usa ES Modules nativos, serví la carpeta por HTTP en lugar de abrir `index.html` con `file://`:

```bash
python -m http.server 8000
```

Y abrí [http://localhost:8000](http://localhost:8000).
