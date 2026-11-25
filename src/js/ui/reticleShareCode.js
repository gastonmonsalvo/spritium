// @ts-check
/**
 * reticleShareCode.js: Codificador y decodificador compacto tipo CS2 (`SPR-XXXX-XXXX-XXXX`)
 * para compartir configuraciones de mira (`reticleConfig`) con verificación por checksum.
 */

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 caracteres sin ambigüedad (sin 0/O ni 1/I)
const SHAPES = ["crosshair", "circle", "square", "dot"];

function crc8(bytes) {
  let crc = 0x5a;
  for (const b of bytes) {
    crc ^= b & 0xff;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x80) !== 0 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

function parseHexRgbaBytes(hex) {
  const clean = String(hex || "").trim().replace("#", "");
  if (/^[0-9a-f]{6}$/i.test(clean)) {
    const n = parseInt(clean, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  if (/^[0-9a-f]{8}$/i.test(clean)) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      parseInt(clean.slice(6, 8), 16),
    ];
  }
  return [255, 255, 255, 255];
}

function bytesToHexRgba(r, g, b, a) {
  const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a)}`;
}

/**
 * Codifica un objeto `reticleConfig` en un código compartible `SPR-XXXX-XXXX-XXXX`.
 * @param {{ shape?: string, size?: number, thickness?: number, gap?: number, dot?: boolean, outline?: boolean, color?: string }} [cfg]
 * @returns {string}
 */
export function encodeReticleCode(cfg = {}) {
  const shapeIdx = Math.max(0, SHAPES.indexOf(cfg?.shape || "crosshair"));
  const sizeVal = Math.max(3, Math.min(10, Number(cfg?.size ?? 6) || 6));
  const sizeStep = Math.max(0, Math.min(14, Math.round((sizeVal - 3) * 2)));
  const thickVal = Math.max(1, Math.min(3, Number(cfg?.thickness ?? 1.5) || 1.5));
  const thickStep = Math.max(0, Math.min(8, Math.round((thickVal - 1) * 4)));
  const gapVal = Math.max(0, Math.min(5, Number(cfg?.gap ?? 2)));
  const gapStep = Math.max(0, Math.min(10, Math.round(gapVal * 2)));
  const dotBit = cfg?.dot !== false ? 1 : 0;
  const outlineBit = cfg?.outline !== false ? 1 : 0;
  const [r, g, b, a] = parseHexRgbaBytes(cfg?.color);

  // 48 bits de payload -> 6 bytes + 1 byte CRC-8 = 56 bits (12 chars Base32)
  const b0 = ((shapeIdx & 0x03) << 6) | ((sizeStep & 0x0f) << 2) | ((thickStep >> 2) & 0x03);
  const b1 = ((thickStep & 0x03) << 6) | ((gapStep & 0x0f) << 2) | (dotBit << 1) | outlineBit;
  const payload = [b0, b1, r, g, b, a];
  const bytes = [...payload, crc8(payload)];

  let bitBuf = 0n;
  for (const byte of bytes) {
    bitBuf = (bitBuf << 8n) | BigInt(byte);
  }

  let chars = "";
  for (let i = 11; i >= 0; i--) {
    const shift = BigInt(i * 5);
    const idx = Number((bitBuf >> shift) & 0x1fn);
    chars += ALPHABET[idx];
  }
  return `SPR-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/**
 * Decodifica y valida (vía CRC-8) un código de mira `SPR-XXXX-XXXX-XXXX`.
 * Devuelve `null` si el formato o checksum es inválido.
 * @param {string} code
 * @returns {{ shape: string, size: number, thickness: number, gap: number, dot: boolean, outline: boolean, color: string } | null}
 */
export function decodeReticleCode(code) {
  let clean = String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.startsWith("SPR")) clean = clean.slice(3);
  if (clean.length !== 12) return null;

  let bitBuf = 0n;
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) return null;
    bitBuf = (bitBuf << 5n) | BigInt(idx);
  }
  if (bitBuf >> 56n !== 0n) return null;

  const bytes = [];
  for (let i = 6; i >= 0; i--) {
    bytes.push(Number((bitBuf >> BigInt(i * 8)) & 0xffn));
  }
  const payload = bytes.slice(0, 6);
  if (crc8(payload) !== bytes[6]) return null;

  const [b0, b1, r, g, b, a] = payload;
  const shapeIdx = (b0 >> 6) & 0x03;
  const sizeStep = (b0 >> 2) & 0x0f;
  const thickStep = ((b0 & 0x03) << 2) | ((b1 >> 6) & 0x03);
  const gapStep = (b1 >> 2) & 0x0f;
  const dot = Boolean((b1 >> 1) & 0x01);
  const outline = Boolean(b1 & 0x01);

  if (sizeStep > 14 || thickStep > 8 || gapStep > 10) return null;

  return {
    shape: SHAPES[shapeIdx] || "crosshair",
    size: 3 + sizeStep * 0.5,
    thickness: 1 + thickStep * 0.25,
    gap: gapStep * 0.5,
    dot,
    outline,
    color: bytesToHexRgba(r, g, b, a),
  };
}
