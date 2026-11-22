// @ts-check
/**
 * normalMapGenerator.js: Motor matemático puro de generación de Normal Maps 2D (Tangent Space)
 * e iluminación dinámica en tiempo real (Lambert + Blinn-Phong) para sprites y tilesets.
 */

function computeDistanceField(alphaMask, w, h, tileable = false) {
  const n = w * h;
  const dist = new Float32Array(n);
  const INF = 1e6;
  for (let i = 0; i < n; i++) {
    dist[i] = alphaMask[i] ? INF : 0;
  }

  const getD = (x, y) => {
    if (tileable) {
      const wx = ((x % w) + w) % w;
      const wy = ((y % h) + h) % h;
      return dist[wy * w + wx];
    }
    if (x < 0 || x >= w || y < 0 || y >= h) return 0;
    return dist[y * w + x];
  };

  const passes = tileable ? 2 : 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (dist[idx] === 0) continue;
        let best = dist[idx];
        best = Math.min(best, getD(x - 1, y) + 1);
        best = Math.min(best, getD(x, y - 1) + 1);
        best = Math.min(best, getD(x - 1, y - 1) + 1.4142);
        best = Math.min(best, getD(x + 1, y - 1) + 1.4142);
        dist[idx] = best;
      }
    }
    for (let y = h - 1; y >= 0; y--) {
      for (let x = w - 1; x >= 0; x--) {
        const idx = y * w + x;
        if (dist[idx] === 0) continue;
        let best = dist[idx];
        best = Math.min(best, getD(x + 1, y) + 1);
        best = Math.min(best, getD(x, y + 1) + 1);
        best = Math.min(best, getD(x + 1, y + 1) + 1.4142);
        best = Math.min(best, getD(x - 1, y + 1) + 1.4142);
        dist[idx] = best;
      }
    }
  }

  let maxDist = 0;
  for (let i = 0; i < n; i++) {
    if (dist[i] < INF && dist[i] > maxDist) maxDist = dist[i];
  }
  const norm = maxDist > 0 ? maxDist : 1;
  for (let i = 0; i < n; i++) {
    if (dist[i] >= INF) dist[i] = 1;
    else dist[i] = Math.sqrt(Math.min(1, dist[i] / norm));
  }
  return dist;
}

function smoothHeightmap(height, alphaMask, w, h, passes, tileable) {
  let cur = height;
  for (let p = 0; p < passes; p++) {
    const next = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!alphaMask[idx]) continue;
        let sum = 0;
        let weight = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            let sx = x + dx;
            let sy = y + dy;
            if (tileable) {
              sx = ((sx % w) + w) % w;
              sy = ((sy % h) + h) % h;
            } else if (sx < 0 || sx >= w || sy < 0 || sy >= h) {
              continue;
            }
            const k = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
            sum += cur[sy * w + sx] * k;
            weight += k;
          }
        }
        next[idx] = weight > 0 ? sum / weight : cur[idx];
      }
    }
    cur = next;
  }
  return cur;
}

/**
 * Construye un Heightmap `[0..1]` combinando volumen por silueta (Distance Field) y luminancia perceptual.
 * @param {Uint8ClampedArray} rgba
 * @param {number} w
 * @param {number} h
 * @param {{ bevelWeight?: number, lumaWeight?: number, smoothPasses?: number, tileable?: boolean }} [options]
 * @returns {{ height: Float32Array, alphaMask: Uint8Array }}
 */
export function buildSpriteHeightmap(rgba, w, h, { bevelWeight = 0.65, lumaWeight = 0.35, smoothPasses = 1, tileable = false } = {}) {
  const n = w * h;
  const alphaMask = new Uint8Array(n);
  const luma = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (rgba[o + 3] >= 16) {
      alphaMask[i] = 1;
      luma[i] = (0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2]) / 255;
    }
  }

  const bevel = computeDistanceField(alphaMask, w, h, tileable);
  const wSum = bevelWeight + lumaWeight || 1;
  const bw = bevelWeight / wSum;
  const lw = lumaWeight / wSum;
  let height = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!alphaMask[i]) continue;
    height[i] = bevel[i] * bw + luma[i] * lw;
  }

  if (smoothPasses > 0) {
    height = smoothHeightmap(height, alphaMask, w, h, Math.min(4, Math.round(smoothPasses)), tileable);
  }
  return { height, alphaMask };
}

/**
 * Genera el buffer RGBA del Normal Map (`#8080FF` plano en zonas neutras, alpha preservado).
 * @param {Uint8ClampedArray} rgba
 * @param {number} w
 * @param {number} h
 * @param {{ strength?: number, bevelWeight?: number, lumaWeight?: number, smoothPasses?: number, convention?: "opengl"|"directx", tileable?: boolean }} [options]
 * @returns {Uint8ClampedArray}
 */
export function generateNormalMapPixels(
  rgba,
  w,
  h,
  { strength = 2.5, bevelWeight = 0.65, lumaWeight = 0.35, smoothPasses = 1, convention = "opengl", tileable = false } = {},
) {
  const { height, alphaMask } = buildSpriteHeightmap(rgba, w, h, { bevelWeight, lumaWeight, smoothPasses, tileable });
  const out = new Uint8ClampedArray(w * h * 4);
  const ySign = convention === "directx" ? -1 : 1;

  const sampleH = (x, y) => {
    if (tileable) {
      const wx = ((x % w) + w) % w;
      const wy = ((y % h) + h) % h;
      return height[wy * w + wx];
    }
    const cx = Math.max(0, Math.min(w - 1, x));
    const cy = Math.max(0, Math.min(h - 1, y));
    return height[cy * w + cx];
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const o = idx * 4;
      if (!alphaMask[idx]) {
        out[o] = 128;
        out[o + 1] = 128;
        out[o + 2] = 255;
        out[o + 3] = 0;
        continue;
      }

      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);

      let nx = -dX * strength;
      let ny = dY * strength * ySign;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      out[o] = Math.round((nx * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[o + 3] = rgba[o + 3];
    }
  }
  return out;
}

/**
 * Simula iluminación 2D en tiempo real sobre el sprite usando su Normal Map.
 * @param {Uint8ClampedArray} albedo
 * @param {Uint8ClampedArray} normals
 * @param {number} w
 * @param {number} h
 * @param {{ x?: number, y?: number, z?: number, color?: [number, number, number], ambient?: number, intensity?: number, specular?: number, convention?: "opengl"|"directx" }} [light]
 * @returns {Uint8ClampedArray}
 */
export function renderLitSpritePixels(
  albedo,
  normals,
  w,
  h,
  { x: lx = 0.35, y: ly = 0.25, z: lz = 0.45, color = [255, 240, 210], ambient = 0.28, intensity = 1.15, specular = 0.22, convention = "opengl" } = {},
) {
  const out = new Uint8ClampedArray(w * h * 4);
  const ySign = convention === "directx" ? -1 : 1;
  const lr = color[0] / 255;
  const lg = color[1] / 255;
  const lb = color[2] / 255;

  for (let y = 0; y < h; y++) {
    const py = (y + 0.5) / Math.max(1, h);
    for (let x = 0; x < w; x++) {
      const px = (x + 0.5) / Math.max(1, w);
      const o = (y * w + x) * 4;
      const a = albedo[o + 3];
      if (a < 16) continue;

      const nx = (normals[o] / 255) * 2 - 1;
      const ny = ((normals[o + 1] / 255) * 2 - 1) * ySign;
      const nz = (normals[o + 2] / 255) * 2 - 1;

      const dx = lx - px;
      const dy = -(ly - py);
      const dz = lz;
      const lLen = Math.hypot(dx, dy, dz) || 1;
      const ldx = dx / lLen;
      const ldy = dy / lLen;
      const ldz = dz / lLen;

      const ndotl = Math.max(0, nx * ldx + ny * ldy + nz * ldz);
      const hx = ldx;
      const hy = ldy;
      const hz = ldz + 1;
      const hLen = Math.hypot(hx, hy, hz) || 1;
      const spec = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen), 24) * specular;

      const diffR = ambient + ndotl * intensity * lr;
      const diffG = ambient + ndotl * intensity * lg;
      const diffB = ambient + ndotl * intensity * lb;

      out[o] = Math.min(255, Math.round(albedo[o] * diffR + color[0] * spec));
      out[o + 1] = Math.min(255, Math.round(albedo[o + 1] * diffG + color[1] * spec));
      out[o + 2] = Math.min(255, Math.round(albedo[o + 2] * diffB + color[2] * spec));
      out[o + 3] = a;
    }
  }
  return out;
}
