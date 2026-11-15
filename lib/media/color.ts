export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface LabColor {
  l: number;
  a: number;
  b: number;
}

export interface BrandColorEntry {
  name: string;
  hex: string;
}

export interface NearestBrandColorResult {
  entry: BrandColorEntry;
  distance: number;
}

/**
 * Converts a hex colour string (#RRGGBB or #RGB) to { r, g, b } with channels in 0..255.
 */
export function hexToRgb(hex: string): RgbColor | null {
  if (!hex || typeof hex !== "string") return null;
  let clean = hex.trim().replace(/^#/, "");
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (clean.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(clean)) {
    return null;
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
}

/**
 * Converts RGB channel values (0..255) to an uppercase hex string (#RRGGBB).
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Calculates the relative luminance of an sRGB color using the WCAG 2.x definition.
 * Values returned are between 0.0 (darkest black) and 1.0 (lightest white).
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const srgbToLin = (val: number) => {
    const v = Math.max(0, Math.min(255, val)) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  const rLin = srgbToLin(r);
  const gLin = srgbToLin(g);
  const bLin = srgbToLin(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calculates the WCAG 2.x contrast ratio between two hex colours.
 * Returns a ratio between 1.0 and 21.0 (rounded to 2 decimal places, e.g. 4.54).
 */
export function wcagContrast(hexA: string, hexB: string): number {
  const rgbA = hexToRgb(hexA) || { r: 0, g: 0, b: 0 };
  const rgbB = hexToRgb(hexB) || { r: 255, g: 255, b: 255 };

  const lumA = relativeLuminance(rgbA.r, rgbA.g, rgbA.b);
  const lumB = relativeLuminance(rgbB.r, rgbB.g, rgbB.b);

  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);

  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Number(ratio.toFixed(2));
}

/**
 * Converts sRGB (0..255) to CIE L*a*b* using standard D65 reference white point.
 */
export function rgbToLab(r: number, g: number, b: number): LabColor {
  const srgbToLin = (val: number) => {
    const v = Math.max(0, Math.min(255, val)) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  const rLin = srgbToLin(r);
  const gLin = srgbToLin(g);
  const bLin = srgbToLin(b);

  // Observer = 2°, Illuminant = D65
  const x = (0.4124564 * rLin + 0.3575761 * gLin + 0.1804375 * bLin) / 0.95047;
  const y = (0.2126729 * rLin + 0.7151522 * gLin + 0.072175 * bLin) / 1.0;
  const z = (0.0193339 * rLin + 0.119192 * gLin + 0.9503041 * bLin) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  const l = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bVal = 200 * (fy - fz);

  return { l, a, b: bVal };
}

/**
 * Calculates the CIE76 color difference (deltaE) between two hex colours in Lab color space.
 * For identical colors, deltaE is 0.
 */
export function deltaE(hexA: string, hexB: string): number {
  const rgbA = hexToRgb(hexA) || { r: 0, g: 0, b: 0 };
  const rgbB = hexToRgb(hexB) || { r: 0, g: 0, b: 0 };

  const labA = rgbToLab(rgbA.r, rgbA.g, rgbA.b);
  const labB = rgbToLab(rgbB.r, rgbB.g, rgbB.b);

  const dl = labA.l - labB.l;
  const da = labA.a - labB.a;
  const db = labA.b - labB.b;

  return Math.sqrt(dl * dl + da * da + db * db);
}

/**
 * Finds the nearest brand colour from a palette using CIE76 color difference (deltaE).
 * Returns the nearest entry and its distance. Returns null if the palette is empty.
 */
export function nearestBrandColour(
  hex: string,
  palette: BrandColorEntry[],
): NearestBrandColorResult | null {
  if (!palette || palette.length === 0) {
    return null;
  }

  let nearest: BrandColorEntry = palette[0];
  let minDistance = deltaE(hex, palette[0].hex);

  for (let i = 1; i < palette.length; i++) {
    const entry = palette[i];
    const dist = deltaE(hex, entry.hex);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = entry;
    }
  }

  return {
    entry: nearest,
    distance: Number(minDistance.toFixed(2)),
  };
}
