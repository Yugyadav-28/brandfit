import sharp from "sharp";
import { rgbToHex } from "./color";

export interface DominantColour {
  hex: string;
  share: number;
}

/**
 * Extracts dominant colours from an image:
 * 1. Resizes image to 64x64 using sharp.
 * 2. Ignores fully transparent pixels (alpha = 0).
 * 3. Groups pixels into 16 levels per channel (4096 possible color buckets).
 * 4. Filters colours with at least 0.08 (8%) share of non-transparent pixels.
 * 5. Returns up to 5 dominant colours sorted by share descending.
 */
export async function dominantColours(
  input: Buffer | Uint8Array | ArrayBuffer,
): Promise<DominantColour[]> {
  try {
    const nodeBuf = Buffer.isBuffer(input)
      ? input
      : input instanceof Uint8Array
        ? Buffer.from(input.buffer, input.byteOffset, input.byteLength)
        : Buffer.from(input);

    const { data } = await sharp(nodeBuf)
      .resize(64, 64, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Buckets: key -> { count, sumR, sumG, sumB }
    const buckets = new Map<
      string,
      { count: number; sumR: number; sumG: number; sumB: number }
    >();
    let validPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Ignore fully transparent pixels
      if (a === 0) continue;

      validPixels++;

      // 16 levels per channel: 0..15
      const bR = Math.floor(r / 16);
      const bG = Math.floor(g / 16);
      const bB = Math.floor(b / 16);
      const key = `${bR}_${bG}_${bB}`;

      const existing = buckets.get(key);
      if (existing) {
        existing.count++;
        existing.sumR += r;
        existing.sumG += g;
        existing.sumB += b;
      } else {
        buckets.set(key, { count: 1, sumR: r, sumG: g, sumB: b });
      }
    }

    if (validPixels === 0) {
      return [];
    }

    const results: DominantColour[] = [];

    for (const b of buckets.values()) {
      const share = Number((b.count / validPixels).toFixed(2));
      // Keep only colours with a share of at least 0.08 (8%)
      if (share >= 0.08) {
        const avgR = Math.round(b.sumR / b.count);
        const avgG = Math.round(b.sumG / b.count);
        const avgB = Math.round(b.sumB / b.count);
        results.push({
          hex: rgbToHex(avgR, avgG, avgB),
          share,
        });
      }
    }

    // Sort by share descending and return up to 5
    results.sort((a, b) => b.share - a.share);
    return results.slice(0, 5);
  } catch (err) {
    console.error("dominantColours error:", err);
    return [];
  }
}

// Alias for flexibility
export const extractDominantColours = dominantColours;
