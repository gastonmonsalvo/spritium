/**
 * gifEncoder.js: Codificador GIF89a 100% Client-Side en JavaScript puro.
 * Implementa compresión LZW (Clear/EOI, 2..12 bits), bloque NETSCAPE2.0 para loop
 * y Graphic Control Extension con canal transparente (disposal method = 2).
 */

/**
 * Comprime una matriz de índices de paleta usando el algoritmo LZW de GIF89a.
 * @param {Uint8Array} indices
 * @param {number} minCodeSize
 * @returns {number[]}
 */
function lzwEncode(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const maxTableSize = 4096;

  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  let dict = new Map();

  const resetDict = () => {
    dict = new Map();
    for (let i = 0; i < clearCode; i++) {
      dict.set(String(i), i);
    }
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  };

  const outBytes = [];
  let bitBuf = 0;
  let bitCount = 0;

  const writeBits = (code, bits) => {
    bitBuf |= code << bitCount;
    bitCount += bits;
    while (bitCount >= 8) {
      outBytes.push(bitBuf & 0xff);
      bitBuf >>= 8;
      bitCount -= 8;
    }
  };

  resetDict();
  writeBits(clearCode, codeSize);

  if (indices.length > 0) {
    let prefix = String(indices[0]);
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const combined = `${prefix},${k}`;
      if (dict.has(combined)) {
        prefix = combined;
      } else {
        writeBits(dict.get(prefix), codeSize);
        if (nextCode < maxTableSize) {
          dict.set(combined, nextCode++);
          if (nextCode > 1 << codeSize && codeSize < 12) {
            codeSize++;
          }
        } else {
          writeBits(clearCode, codeSize);
          resetDict();
        }
        prefix = String(k);
      }
    }
    writeBits(dict.get(prefix), codeSize);
  }

  writeBits(eoiCode, codeSize);
  if (bitCount > 0) {
    outBytes.push(bitBuf & 0xff);
  }

  return outBytes;
}

/**
 * Construye una paleta GIF global (potencia de 2, hasta 256 entradas) a partir de los frames RGBA.
 * El índice 0 se reserva para transparencia si algún píxel tiene alpha < 128.
 * @param {Array<{rgba: Uint8ClampedArray}>} frames
 * @returns {{ palette: Uint8Array, colorBits: number, hasTransparency: boolean, mapFrame: (rgba: Uint8ClampedArray) => Uint8Array }}
 */
function buildGlobalPalette(frames) {
  let hasTransparency = false;
  const colorSet = new Map(); // rgb24 -> index

  // Índice 0 reservado para transparente
  const colors = [[0, 0, 0]];

  for (const frame of frames) {
    const d = frame.rgba;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) {
        hasTransparency = true;
        continue;
      }
      const rgb24 = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      if (!colorSet.has(rgb24) && colors.length < 256) {
        colorSet.set(rgb24, colors.length);
        colors.push([d[i], d[i + 1], d[i + 2]]);
      }
    }
  }

  let colorBits = 1;
  while (1 << colorBits < Math.max(2, colors.length) && colorBits < 8) {
    colorBits++;
  }
  const tableSize = 1 << colorBits;
  const palette = new Uint8Array(tableSize * 3);
  for (let i = 0; i < colors.length; i++) {
    palette[i * 3] = colors[i][0];
    palette[i * 3 + 1] = colors[i][1];
    palette[i * 3 + 2] = colors[i][2];
  }

  const nearestCache = new Map();
  const findNearestColor = (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    const exact = colorSet.get(key);
    if (exact !== undefined) return exact;
    const cached = nearestCache.get(key);
    if (cached !== undefined) return cached;

    let bestIdx = 1;
    let bestDist = Infinity;
    for (let i = 1; i < colors.length; i++) {
      const dr = r - colors[i][0];
      const dg = g - colors[i][1];
      const db = b - colors[i][2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    nearestCache.set(key, bestIdx);
    return bestIdx;
  };

  const mapFrame = (rgba) => {
    const out = new Uint8Array(rgba.length / 4);
    for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
      if (rgba[i + 3] < 128) {
        out[p] = 0;
      } else {
        out[p] = findNearestColor(rgba[i], rgba[i + 1], rgba[i + 2]);
      }
    }
    return out;
  };

  return { palette, colorBits, hasTransparency, mapFrame };
}

function writeSubBlocks(bytes, payload) {
  for (let i = 0; i < payload.length; i += 255) {
    const len = Math.min(255, payload.length - i);
    bytes.push(len);
    for (let j = 0; j < len; j++) {
      bytes.push(payload[i + j]);
    }
  }
  bytes.push(0); // Block terminator
}

/**
 * Codifica una lista de frames RGBA en un archivo binario GIF89a.
 * @param {Object} params
 * @param {number} params.width
 * @param {number} params.height
 * @param {Array<{rgba: Uint8ClampedArray}>} params.frames
 * @param {number} [params.fps=10]
 * @param {number} [params.loopCount=0] 0 = infinito, >0 = cantidad de repeticiones, -1 = sin loop
 * @returns {Uint8Array}
 */
export function encodeGif89a({ width, height, frames, fps = 10, loopCount = 0 }) {
  if (!frames?.length) {
    throw new Error("Se requiere al menos un frame para exportar GIF.");
  }

  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const delayCs = Math.max(2, Math.round(100 / Math.max(1, fps)));
  const { palette, colorBits, hasTransparency, mapFrame } = buildGlobalPalette(frames);

  const bytes = [];
  const pushStr = (s) => {
    for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
  };
  const pushU16 = (v) => {
    bytes.push(v & 0xff, (v >> 8) & 0xff);
  };

  // Header GIF89a
  pushStr("GIF89a");

  // Logical Screen Descriptor
  pushU16(w);
  pushU16(h);
  // Global Color Table Flag (1) | Color Resolution (colorBits-1) | Sort (0) | Size of GCT (colorBits-1)
  const packedGct = 0x80 | ((colorBits - 1) << 4) | (colorBits - 1);
  bytes.push(packedGct, 0, 0);

  // Global Color Table
  for (let i = 0; i < palette.length; i++) {
    bytes.push(palette[i]);
  }

  // Netscape 2.0 Application Extension (looping)
  if (loopCount >= 0) {
    bytes.push(0x21, 0xff, 0x0b);
    pushStr("NETSCAPE2.0");
    bytes.push(0x03, 0x01);
    pushU16(loopCount);
    bytes.push(0x00);
  }

  const minCodeSize = Math.max(2, colorBits);

  for (const frame of frames) {
    // Graphic Control Extension
    bytes.push(0x21, 0xf9, 0x04);
    // Disposal method = 2 (restore to background) | Transparent Color Flag
    const gcePacked = (2 << 2) | (hasTransparency ? 1 : 0);
    bytes.push(gcePacked);
    pushU16(delayCs);
    bytes.push(0x00); // Transparent color index = 0
    bytes.push(0x00);

    // Image Descriptor
    bytes.push(0x2c);
    pushU16(0);
    pushU16(0);
    pushU16(w);
    pushU16(h);
    bytes.push(0x00); // No local color table

    // Image Data (LZW)
    const indexed = mapFrame(frame.rgba);
    const lzwBytes = lzwEncode(indexed, minCodeSize);
    bytes.push(minCodeSize);
    writeSubBlocks(bytes, lzwBytes);
  }

  bytes.push(0x3b); // GIF Trailer
  return new Uint8Array(bytes);
}
