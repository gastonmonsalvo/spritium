/**
 * palettes.js: Catálogo de paletas genéricas calibradas (DB32, DB16, PICO-8, Arne 16, DMG-01, 1-Bit)
 * y utilidades puras para importar/exportar paletas (.hex, .gpl, .pal, .json).
 */

export const GENERIC_PALETTES = {
  db32: {
    colors: {
      0: null,
      1: "#000000", 2: "#222034", 3: "#45283c", 4: "#663931", 5: "#8f563b",
      6: "#df7126", 7: "#d9a066", 8: "#eec39a", 9: "#fbf236", 10: "#99e550",
      11: "#6abe30", 12: "#37946e", 13: "#4b692f", 14: "#524b24", 15: "#323c39",
      16: "#3f3f74", 17: "#306082", 18: "#5b6ee1", 19: "#639bff", 20: "#5fcde4",
      21: "#cbdbfc", 22: "#ffffff", 23: "#9badb7", 24: "#847e87", 25: "#696a6a",
      26: "#595652", 27: "#76428a", 28: "#ac3232", 29: "#d95763", 30: "#d77bba",
      31: "#8f974a", 32: "#8a6f30",
    },
  },
  db16: {
    colors: {
      0: null,
      1: "#140c1c", 2: "#442434", 3: "#30346d", 4: "#4e4a4e",
      5: "#854c30", 6: "#346524", 7: "#d04648", 8: "#757161",
      9: "#597dce", 10: "#d27d2c", 11: "#8595a1", 12: "#6daa2c",
      13: "#d2aa99", 14: "#6dc2ca", 15: "#dad45e", 16: "#deeed6",
    },
  },
  pico8: {
    colors: {
      0: null,
      1: "#000000", 2: "#1d2b53", 3: "#7e2553", 4: "#008751",
      5: "#ab5236", 6: "#5f574f", 7: "#c2c3c7", 8: "#fff1e8",
      9: "#ff004d", 10: "#ffa300", 11: "#ffec27", 12: "#00e436",
      13: "#29adff", 14: "#83769c", 15: "#ff77a8", 16: "#ffccaa",
    },
  },
  arne16: {
    colors: {
      0: null,
      1: "#000000", 2: "#9d9d9d", 3: "#ffffff", 4: "#be2633",
      5: "#e06f8b", 6: "#493c2b", 7: "#a46422", 8: "#eb8931",
      9: "#f7e26b", 10: "#2f484e", 11: "#44891a", 12: "#a3ce27",
      13: "#1b2632", 14: "#005784", 15: "#31a2f2", 16: "#b2dcef",
    },
  },
  gameboy: {
    colors: {
      0: null,
      1: "#0f380f",
      2: "#306230",
      3: "#8bac0f",
      4: "#9bbc0f",
    },
  },
  terminal_glow: {
    colors: {
      0: null,
      1: "#0a0a0a",
      2: "#4ade80",
    },
  },
  grayscale: {
    colors: {
      0: null,
      1: "#000000", 2: "#111111", 3: "#222222", 4: "#333333",
      5: "#444444", 6: "#555555", 7: "#666666", 8: "#777777",
      9: "#888888", 10: "#999999", 11: "#aaaaaa", 12: "#bbbbbb",
      13: "#cccccc", 14: "#dddddd", 15: "#eeeeee", 16: "#ffffff",
    },
  },
  indexed: {
    colors: {
      0: null,
      1: "#000000", 2: "#3f3f46", 3: "#a1a1aa", 4: "#ffffff",
      5: "#dc2626", 6: "#ea580c", 7: "#eab308", 8: "#16a34a",
      9: "#0d9488", 10: "#2563eb", 11: "#7c3aed", 12: "#db2777",
      13: "#78350f", 14: "#fca5a5", 15: "#fde047", 16: "#93c5fd",
    },
  },
};

export const THEME_PALETTES = GENERIC_PALETTES;

const CUSTOM_PALETTES_STORAGE_KEY = "spritium_custom_palettes_v1";

function rgbToHex(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, Number(n) | 0));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Lee las paletas personalizadas guardadas en localStorage.
 */
export function loadUserPalettes() {
  try {
    const raw = localStorage.getItem(CUSTOM_PALETTES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Guarda o actualiza una paleta personalizada en localStorage.
 * @param {string} key
 * @param {any} entry
 */
export function saveUserPalette(key, entry) {
  try {
    const all = loadUserPalettes();
    all[key] = entry;
    localStorage.setItem(CUSTOM_PALETTES_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Devuelve el catálogo completo de paletas genéricas más las del usuario.
 */
export function getThemesConfig() {
  return {
    themes: { ...GENERIC_PALETTES, ...loadUserPalettes() },
    default_theme: "db32",
  };
}

/**
 * Parsea archivos de paleta (.hex, .gpl, .pal JASC-PAL, .json) a un paletteMap { 0: null, 1: "#rrggbb", ... }.
 * @param {string} filename
 * @param {string} text
 */
export function parsePaletteFileContent(filename, text) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const baseName = filename.replace(/\.[^.]+$/, "") || "Paleta importada";
  const hexList = [];
  let parsedName = baseName;

  if (ext === "json") {
    const data = JSON.parse(text);
    if (data?.name) parsedName = String(data.name);
    const rawColors = Array.isArray(data) ? data : Object.values(data?.colors || {});
    rawColors.forEach((c) => {
      if (typeof c === "string" && /^#?[0-9a-fA-F]{6}$/.test(c.trim())) {
        const clean = c.trim().startsWith("#") ? c.trim().toLowerCase() : `#${c.trim().toLowerCase()}`;
        if (!hexList.includes(clean)) hexList.push(clean);
      }
    });
  } else if (ext === "gpl") {
    const lines = text.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || line === "GIMP Palette") continue;
      if (line.toLowerCase().startsWith("name:")) {
        parsedName = line.slice(5).trim() || parsedName;
        continue;
      }
      if (line.toLowerCase().startsWith("columns:")) continue;
      const m = line.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/);
      if (m) {
        const hex = rgbToHex(m[1], m[2], m[3]);
        if (!hexList.includes(hex)) hexList.push(hex);
      }
    }
  } else if (ext === "pal") {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const startIdx = lines[0] === "JASC-PAL" ? 3 : 0;
    for (let i = startIdx; i < lines.length; i++) {
      const m = lines[i].match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/);
      if (m) {
        const hex = rgbToHex(m[1], m[2], m[3]);
        if (!hexList.includes(hex)) hexList.push(hex);
      }
    }
  } else {
    // .hex o lista libre de códigos hexadecimales
    const matches = text.match(/#?[0-9a-fA-F]{6}/g) || [];
    for (const m of matches) {
      const hex = m.startsWith("#") ? m.toLowerCase() : `#${m.toLowerCase()}`;
      if (!hexList.includes(hex)) hexList.push(hex);
    }
  }

  if (hexList.length === 0) {
    throw new Error("No se encontraron colores válidos en el archivo de paleta.");
  }

  const colors = { 0: null };
  hexList.slice(0, 128).forEach((hex, idx) => {
    colors[idx + 1] = hex;
  });

  return { name: parsedName, colors };
}

/**
 * Serializa un paletteMap a texto plano .hex (un código por línea).
 * @param {Record<number, string|null>} paletteMap
 */
export function serializePaletteToHex(paletteMap) {
  return Object.keys(paletteMap)
    .map(Number)
    .filter((k) => k > 0 && paletteMap[k])
    .sort((a, b) => a - b)
    .map((k) => paletteMap[k].replace("#", "").toLowerCase())
    .join("\n");
}

/**
 * Serializa un paletteMap al formato estándar .gpl.
 * @param {string} name
 * @param {Record<number, string|null>} paletteMap
 */
export function serializePaletteToGpl(name, paletteMap) {
  const lines = [
    "GIMP Palette",
    `Name: ${name || "Spritium Palette"}`,
    "Columns: 8",
    "#",
  ];
  Object.keys(paletteMap)
    .map(Number)
    .filter((k) => k > 0 && paletteMap[k])
    .sort((a, b) => a - b)
    .forEach((k) => {
      const hex = paletteMap[k].replace("#", "");
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      lines.push(`${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t#${hex}`);
    });
  return lines.join("\n");
}
