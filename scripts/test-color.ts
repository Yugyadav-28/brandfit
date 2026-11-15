import type * as ColorType from "../lib/media/color";

const colorPath = "../lib/media/color.ts";

const colorMod = (await import(colorPath)) as typeof ColorType;
const {
  hexToRgb,
  rgbToHex,
  relativeLuminance,
  wcagContrast,
  rgbToLab,
  deltaE,
  nearestBrandColour,
} = colorMod;

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    failCount++;
  }
}

async function runColorTests() {
  console.log("=== Color, Contrast & Palette Checks Test Suite ===\n");

  // ── 1. Black on white contrast is 21 to 1 ──
  const blackOnWhite = wcagContrast("#000000", "#FFFFFF");
  assert(
    blackOnWhite === 21,
    "wcagContrast: Black (#000000) on white (#FFFFFF) is exactly 21 to 1",
    `Got ${blackOnWhite}`,
  );

  // ── 2. Grey 767676 on white is about 4.54 to 1 ──
  const greyOnWhite = wcagContrast("#767676", "#FFFFFF");
  assert(
    Math.abs(greyOnWhite - 4.54) <= 0.05,
    "wcagContrast: Grey (#767676) on white (#FFFFFF) is about 4.54 to 1",
    `Got ${greyOnWhite}`,
  );

  // ── 3. White on light yellow is below 1.5 to 1 ──
  const whiteOnYellow = wcagContrast("#FFFFFF", "#FFFFE0");
  assert(
    whiteOnYellow < 1.5,
    "wcagContrast: White (#FFFFFF) on light yellow (#FFFFE0) is below 1.5 to 1",
    `Got ${whiteOnYellow}`,
  );

  // ── 4. deltaE of identical colours is 0 ──
  const deltaEIdenticalRed = deltaE("#FF0000", "#FF0000");
  const deltaEIdenticalBlack = deltaE("#000000", "#000000");
  assert(
    deltaEIdenticalRed === 0 && deltaEIdenticalBlack === 0,
    "deltaE: Identical colours have deltaE of 0",
    `Got red: ${deltaEIdenticalRed}, black: ${deltaEIdenticalBlack}`,
  );

  // ── 5. hexToRgb & rgbToHex round trip ──
  const rgb = hexToRgb("#3B82F6");
  const hex = rgb ? rgbToHex(rgb.r, rgb.g, rgb.b) : "";
  assert(
    hex === "#3B82F6",
    "hexToRgb & rgbToHex: Correctly roundtrips #3B82F6",
    `Got ${hex}`,
  );

  // ── 6. relativeLuminance bounds ──
  const lumBlack = relativeLuminance(0, 0, 0);
  const lumWhite = relativeLuminance(255, 255, 255);
  assert(
    lumBlack === 0 && Math.abs(lumWhite - 1.0) < 0.001,
    "relativeLuminance: Black is 0 and White is 1",
    `Black: ${lumBlack}, White: ${lumWhite}`,
  );

  // ── 7. rgbToLab conversion sanity check ──
  const labWhite = rgbToLab(255, 255, 255);
  const labBlack = rgbToLab(0, 0, 0);
  assert(
    Math.abs(labWhite.l - 100) < 0.1 && Math.abs(labBlack.l) < 0.1,
    "rgbToLab: White L* is ~100 and Black L* is ~0",
    `White: ${JSON.stringify(labWhite)}, Black: ${JSON.stringify(labBlack)}`,
  );

  // ── 8. nearestBrandColour: matches exact and finds nearest ──
  const palette = [
    { name: "Brand Navy", hex: "#0F172A" },
    { name: "Brand Emerald", hex: "#10B981" },
    { name: "Brand Amber", hex: "#F59E0B" },
  ];
  const exactMatch = nearestBrandColour("#10B981", palette);
  assert(
    exactMatch !== null &&
      exactMatch.entry.name === "Brand Emerald" &&
      exactMatch.distance === 0,
    "nearestBrandColour: Matches exact brand colour with distance 0",
    JSON.stringify(exactMatch),
  );

  const nearMatch = nearestBrandColour("#12BA83", palette);
  assert(
    nearMatch !== null &&
      nearMatch.entry.name === "Brand Emerald" &&
      nearMatch.distance < 5,
    "nearestBrandColour: Finds nearest brand colour with small distance",
    JSON.stringify(nearMatch),
  );

  console.log("\n----------------------------------------");
  console.log(`Summary: ${passCount} PASSED, ${failCount} FAILED`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runColorTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
