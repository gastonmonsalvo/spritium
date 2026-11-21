# Spritium

[English](./README.md) | [Español](./README.es.md)

> **Editor Web 100% Client-Side de Pixel Art con cuantización perceptual OKLab, sistema de capas, frames, Tilemaps, internacionalización ES/EN y exportación multi-formato.**

**Spritium** es una SPA modular en JavaScript puro (**112 ES Modules**, Zero-Build + HTML5 Canvas 2D + **19 módulos CSS**) diseñada para crear, importar, cuantizar, animar y exportar sprites 2D y tilemaps directamente en el navegador, lista para hostear en cualquier servidor estático (**GitHub Pages, Cloudflare Pages, Vercel, Netlify**) sin backend ni dependencias externas.

---

## Funcionalidades Principales

### 1. Importación y Cuantización Perceptual (OKLab + Bayer 4×4 / 8×8)
- **Resoluciones soportadas:** presets `16×16`, `32×32`, `64×64`, `96×96`, `128×128`, `256×256` y resolución personalizada `N × M` (`4–512 px`) desde **Edición → Resolución ▸**.
- **Apertura 1:1 o Pixel Art:** abrí sprites PNG en tamaño real `1:1` sin alterar píxeles, activá **Convertir a Pixel Art** (reduce al tamaño elegido preservando el fondo) o **Quitar fondo conectado** de forma opcional.
- **Paletas integradas + Custom Palettes:** incluye **Dawnbringer 32 (DB32)**, **Dawnbringer 16 (DB16)**, **PICO-8**, **Arne 16**, **DMG-01 (Game Boy)**, **Terminal 1-Bit**, **Grayscale (16)** e **Indexed (16)**, usando cuantización perceptual en espacio **OKLab** con **Dithering ordenado (Bayer 4×4 / 8×8)** opcional.
- **Reducción Adaptativa de Paleta (`16 / 24 / 32 / 48 / 64 colores propios`):** K-Means++ ponderado por $\sqrt{\text{frecuencia}}$ en OKLab con inicialización *Farthest-Point*.
- **Flujo no destructivo:** conserva `originalImport` y `resBaseSnapshot` para experimentar paletas y resoluciones sin degradar en cadena.

### 2. Sistema de Capas Avanzado, Timeline Matriz y Animación
- **Capas (Panel Derecho):** Múltiples capas y carpetas con blend modes (`Normal`, `Multiply`, `Screen`, `Overlay`, `Darken`, `Lighten`, `Color Dodge`, `Color Burn`), opacidad por capa, multiselección (`Ctrl+Clic`), bloqueo, Drag & Drop, renombrado inline (`Doble clic` o `F2`) y **menú contextual en español/inglés**.
- **Movimiento No Destructivo (`outOfBounds`):** al mover, rotar (`RotSprite`) o transformar libremente (`Shift+T`) sprites que exceden los bordes del lienzo, los píxeles fuera de cuadro se conservan por capa sin recortarse.
- **Timeline Matriz (`Matriz ^`):** vista expandible y redimensionable estilo **Capas × Frames**, con controles de reproducción, **Tag Frames** (`Shift+Clic` + `+ Tag` con loop por Tag), **Linked Cels**, Drag & Drop de frames/cels y **Onion Skin Pro** (Opacidad `10%–80%`, rango Prev/Next y **Modo Rojo / Azul**).
- **Exportación Configurable + GIF89a Puro:** vista previa en vivo, escala *Nearest-Neighbor* (`1×–16×`), fondo transparente o sólido, **GIF Animado (`.gif` LZW 100% client-side)**, **Tira PNG** (`Fila` / `Columna` / `Grilla N×M`) y **Atlas (PNG + JSON)**.

### 3. Herramientas, Pinceles Custom, Color RGBA y Preferencias de Cursor
- **Dibujo, Pinceles y Filtros:**
  - **Lápiz (`B`)** con **Pixel-Perfect** (cero L-shapes) y grosor **`1–256 px`** (`[` / `]`).
  - **Custom Brushes y Dithering:** patrones integrados (`Sólido`, `Dither 50%`, `Diagonal`, `Puntos`) y pinceles creados **desde selección** (`Tinta 1°` o `Color orig.`), persistidos e importables/exportables en `.sbrush.json`.
  - **Línea (`L`)** (Recta con `Shift` 45° o Curva Bézier de 1–3 puntos + estilos Sólida/Punteada/Discontinua/Punto-Guión), **Formas (`R`/`C`/`U`)**, **Tarro (`T`/`F`)**, **Shading OKLab (`K`)**, **Blur / Jumble**, **Spray**, **Gotero (`I`)** y **Goma (`E`)**.
- **Color 1°/2°, Alpha (RGBA) y Rueda Cromática:** soporte completo **`#RRGGBBAA`**, **Rueda HSV** con armonías (**Tríada**, **Análogo**, **Complementario**, **Comp. Dividido**, **Tétrada**) e importación/exportación **`.hex`**, **`.gpl`**, **`.pal`** y **`.json`**.
- **Selección Booleana y Transformación Libre:** Rectángulo (`S`), Elipse, Lazo (`Q`), Varita Mágica (`W`) con modificadores booleanos (`Ctrl` / `Alt` / `Ctrl+Shift`) y **Transformación Libre (`Shift+T`)**.
- **Vista Previa de Píxel (`V`) y Mira del Ratón (`Preferencias`):** contorno de huella de píxel/pincel/balde/varita en tiempo real y retícula personalizable (forma, tamaño, grosor, gap, punto central y contorno).

### 4. Internacionalización (ES / EN), Multi-Documento y Estudio
- **Cambio de idioma en vivo (`ES / EN`):** botón de idioma en Launcher, Barra Superior y Preferencias (`994` claves en paridad) con traducción reactiva del DOM, paletas, menús contextuales, nombres autogenerados e historial de logs (`LogHistory`).
- **Pestañas Multi-Documento (`#docTabsBar`):** varios sprites abiertos en paralelo con indicador de cambios sin guardar (`•`).
- **Explorador de Medios (`Medios`), Launcher y Crash Recovery:** **IndexedDB** (`Spritium_DB`) con proyectos recientes y hasta 8 checkpoints automáticos.
- **Módulos Acoplables / Flotantes y Escala de UI:** arrastrá módulos entre bordes o dejalos flotantes (`spritium_layout_v2`), tema **Oscuro / Claro** y **Escala de Interfaz** (`100%`, `115%`, `135%`).

---

## Alcance y Límites del Proyecto

- **Lienzo y flujo objetivo:** sprites y tilemaps de `4×4` a `512×512 px` (tamaños `N×M`), rasterización discreta sin antialiasing (*Nearest-Neighbor*, Bresenham, Midpoint, De Casteljau), cuantización OKLab, animación por frames y exportación multi-formato (`.spritium`, `.png`, `.gif`, Tira, Atlas JSON, Tilemap JSON).
- **Zero-Build y 100% Estático:** corre directo en navegadores modernos con ES Modules nativos (`112` módulos JS + `19` módulos CSS), sin empaquetador, sin backend y con persistencia local en **IndexedDB** (`Spritium_DB`).
- **Mapa rápido según tu perfil:**
  - **Usuario:** [Guía de Uso](./docs/viewer.html?doc=HELP.md) (atajos, mouse, tilemaps, exportación).
  - **Desarrollador / Revisor:** [Guía de Arquitectura](./docs/viewer.html?doc=ARCHITECTURE.md) (DAG, ciclo de arranque, subsistemas, invariantes) y [Guía Helper](./docs/viewer.html?doc=HELPER.md).
  - **Referencia API:** [docs/index.html](./docs/index.html) (`484/484` funciones con JSDoc, buscador ES/EN).

---

## Ejecución Local y Documentación

Para correrlo en local (los ES Modules requieren HTTP, no `file://`):
```powershell
python -m http.server 8000
```
Y abrir [http://localhost:8000](http://localhost:8000).

- **Arquitectura, flujo de trabajo y estructura de los 112 módulos:** [Guía de Arquitectura](./docs/viewer.html?doc=ARCHITECTURE.md)
- **Guía de desarrollo (cómo modificar/agregar UI, i18n, paletas y acciones):** [Guía Helper](./docs/viewer.html?doc=HELPER.md)
- **Guía de atajos, mouse y herramientas:** [Guía de Uso](./docs/viewer.html?doc=HELP.md)
- **Referencia API JSDoc Data-Driven (`docs/data/api.{es,en}.json`):** [docs/index.html](./docs/index.html)

### Validación y Generación de Documentación
```powershell
node scripts/smoke-test.mjs      # Grafo DAG, CSS, paridad i18n y tests funcionales
node scripts/generate-docs.mjs   # Regenera api.es.json, docs/index.html y mergea incrementalmente api.en.json
```
