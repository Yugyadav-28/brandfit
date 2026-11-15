import type * as ValidateType from "../lib/media/validate";
import type * as DocChecksType from "../lib/media/docChecks";
import type * as ExtractType from "../lib/media/extractDocument";

const validatePath = "../lib/media/validate.ts";
const docChecksPath = "../lib/media/docChecks.ts";
const extractPath = "../lib/media/extractDocument.ts";

const validateMod = (await import(validatePath)) as typeof ValidateType;
const { validateUpload, MAX_FILE_SIZE } = validateMod;

const docChecksMod = (await import(docChecksPath)) as typeof DocChecksType;
const { docChecks } = docChecksMod;

const extractMod = (await import(extractPath)) as typeof ExtractType;
const { extractDocument } = extractMod;

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

async function runTests() {
  console.log("=== Media Validation & Document Checks Test Suite ===\n");

  // ── 1. validateUpload: Real PDF Header ──
  const realPdfHeader = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj");
  const pdfRes = await validateUpload(realPdfHeader, "document");
  assert(
    pdfRes.ok === true && pdfRes.mime === "application/pdf",
    "validateUpload: Real PDF header is accepted as document",
    JSON.stringify(pdfRes),
  );

  // ── 2. validateUpload: Text file renamed to .png ──
  const fakePngBuffer = Buffer.from("This is plain text pretending to be an image file.");
  const fakePngRes = await validateUpload(
    { name: "fake_photo.png", size: fakePngBuffer.length, buffer: fakePngBuffer },
    "image",
  );
  assert(
    fakePngRes.ok === false &&
      typeof fakePngRes.error === "string" &&
      fakePngRes.error.length > 0,
    "validateUpload: Text file renamed to .png is rejected",
    JSON.stringify(fakePngRes),
  );

  // ── 3. validateUpload: Oversized buffer (> 4 MB) ──
  const oversizedSize = MAX_FILE_SIZE + 1024 * 512; // 4.5 MB
  // We can pass an object with reported size or a sparse/allocated buffer
  const oversizedRes = await validateUpload(
    { name: "huge_document.pdf", size: oversizedSize, buffer: Buffer.from("%PDF-1.7") },
    "document",
  );
  assert(
    oversizedRes.ok === false &&
      typeof oversizedRes.error === "string" &&
      oversizedRes.error.includes("4 MB"),
    "validateUpload: Oversized buffer (> 4 MB) is rejected",
    JSON.stringify(oversizedRes),
  );

  // ── 4. validateUpload: DOCX (PK header) ──
  const docxHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
  const docxRes = await validateUpload(docxHeader, "document");
  assert(
    docxRes.ok === true &&
      docxRes.mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "validateUpload: Real DOCX (PK header) is accepted as document",
    JSON.stringify(docxRes),
  );

  // ── 5. validateUpload: Real PNG signature ──
  const pngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const pngRes = await validateUpload(pngHeader, "image");
  assert(
    pngRes.ok === true && pngRes.mime === "image/png",
    "validateUpload: Real PNG header is accepted as image",
    JSON.stringify(pngRes),
  );

  // ── 6. validateUpload: Real JPEG signature ──
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const jpegRes = await validateUpload(jpegHeader, "image");
  assert(
    jpegRes.ok === true && jpegRes.mime === "image/jpeg",
    "validateUpload: Real JPEG header is accepted as image",
    JSON.stringify(jpegRes),
  );

  // ── 7. validateUpload: Real WebP signature (RIFF....WEBP) ──
  const webpHeader = Buffer.alloc(16);
  webpHeader.write("RIFF", 0);
  webpHeader.writeUInt32LE(12, 4);
  webpHeader.write("WEBP", 8);
  const webpRes = await validateUpload(webpHeader, "image");
  assert(
    webpRes.ok === true && webpRes.mime === "image/webp",
    "validateUpload: Real WebP header is accepted as image",
    JSON.stringify(webpRes),
  );

  // ── 8. validateUpload: PDF uploaded to image endpoint ──
  const pdfAsImageRes = await validateUpload(realPdfHeader, "image");
  assert(
    pdfAsImageRes.ok === false,
    "validateUpload: PDF uploaded to image endpoint is rejected",
    JSON.stringify(pdfAsImageRes),
  );

  // ── 9. docChecks: Missing alt text finding ──
  const rules = [
    {
      code: "A-1",
      category: "accessibility",
      title: "Alt text",
      body: "Every image needs alt text",
    },
    {
      code: "A-4",
      category: "accessibility",
      title: "Documents must work with screen readers",
      body: "Documents longer than 300 words need headings",
    },
  ];

  const altFindings = docChecks(
    {
      imageCount: 2,
      imagesWithoutAlt: 2,
      hasHeadings: true,
      wordCount: 150,
      hasReadableText: true,
    },
    "press-release.docx",
    rules,
  );

  assert(
    altFindings.length === 2 &&
      altFindings[0].quoted_text === "Image 1" &&
      altFindings[0].severity === "medium" &&
      altFindings[0].rule_code === "A-1" &&
      altFindings[0].source === "doc_check" &&
      altFindings[1].quoted_text === "Image 2",
    "docChecks: Generates one finding per image without alt text citing A-1",
    JSON.stringify(altFindings),
  );

  // ── 10. docChecks: Document > 300 words without headings ──
  const headingFindings = docChecks(
    {
      imageCount: 0,
      imagesWithoutAlt: 0,
      hasHeadings: false,
      wordCount: 450,
      hasReadableText: true,
    },
    "guidelines.docx",
    rules,
  );

  assert(
    headingFindings.length === 1 &&
      headingFindings[0].severity === "low" &&
      headingFindings[0].rule_code === "A-4" &&
      headingFindings[0].quoted_text === "guidelines.docx" &&
      headingFindings[0].source === "doc_check",
    "docChecks: Generates low severity finding for >300 words without headings citing A-4",
    JSON.stringify(headingFindings),
  );

  // ── 11. docChecks: No readable text (< 20 chars / scanned) ──
  const unreadableFindings = docChecks(
    {
      imageCount: 0,
      imagesWithoutAlt: 0,
      hasHeadings: false,
      wordCount: 2,
      hasReadableText: false,
    },
    "scanned_page.pdf",
    rules,
  );

  assert(
    unreadableFindings.length === 1 &&
      unreadableFindings[0].severity === "high" &&
      unreadableFindings[0].quoted_text === "scanned_page.pdf" &&
      unreadableFindings[0].rule_code === "A-4" &&
      unreadableFindings[0].source === "doc_check",
    "docChecks: Generates high severity finding for unreadable text with fileName as quoted_text",
    JSON.stringify(unreadableFindings),
  );

  // ── 12. docChecks: Fallback rule code when no specific rule matches ──
  const fallbackFindings = docChecks(
    {
      imageCount: 1,
      imagesWithoutAlt: 1,
      hasHeadings: false,
      wordCount: 50,
      hasReadableText: true,
    },
    "test.docx",
    [], // No rules provided
  );

  assert(
    fallbackFindings.length === 1 &&
      fallbackFindings[0].rule_code === "ACCESSIBILITY",
    "docChecks: Falls back to ACCESSIBILITY when no accessibility rules are found",
    JSON.stringify(fallbackFindings),
  );

  // ── 13. extractDocument: Handles unparseable/empty buffer without throwing ──
  const emptyDocRes = await extractDocument(Buffer.from("%PDF-1.4\n1 0 obj\n"), "application/pdf");
  assert(
    emptyDocRes.accessibility.hasReadableText === false &&
      emptyDocRes.text.length < 20,
    "extractDocument: PDF with <20 chars is marked as hasReadableText=false",
    JSON.stringify(emptyDocRes),
  );

  console.log("\n----------------------------------------");
  console.log(`Summary: ${passCount} PASSED, ${failCount} FAILED`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
