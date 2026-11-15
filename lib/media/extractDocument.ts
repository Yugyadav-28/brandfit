import { extractText } from "unpdf";
import mammoth from "mammoth";

export interface DocumentAccessibility {
  imageCount: number;
  imagesWithoutAlt: number;
  hasHeadings: boolean;
  wordCount: number;
  hasReadableText: boolean;
}

export interface ExtractedDocument {
  text: string;
  truncated: boolean;
  warnings: string[];
  accessibility: DocumentAccessibility;
}

/**
 * Extracts plain text, structural headings, images, and accessibility indicators from documents (PDF or DOCX).
 * - For PDF: uses unpdf to get text from all pages. A PDF with < 20 chars has no readable text.
 * - For DOCX: uses mammoth convertToHtml with convertImage handler to count images & alt text,
 *   detects headings (h1-h6), and extracts plain text.
 * - Trims text to 10,000 characters and sets truncated = true when cut.
 */
export async function extractDocument(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  mime: string,
): Promise<ExtractedDocument> {
  const nodeBuf = Buffer.isBuffer(buffer)
    ? buffer
    : buffer instanceof Uint8Array
      ? Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : Buffer.from(buffer);

  const warnings: string[] = [];
  const normalizedMime = (mime || "").toLowerCase();

  // ── 1. PDF Document Handling ──
  if (
    normalizedMime === "application/pdf" ||
    (nodeBuf.length >= 4 &&
      nodeBuf[0] === 0x25 &&
      nodeBuf[1] === 0x50 &&
      nodeBuf[2] === 0x44 &&
      nodeBuf[3] === 0x46)
  ) {
    try {
      const uint8 = new Uint8Array(nodeBuf.buffer, nodeBuf.byteOffset, nodeBuf.byteLength);
      const res = await extractText(uint8, { mergePages: false });

      const pages = Array.isArray(res?.text)
        ? res.text
        : typeof res?.text === "string"
          ? [res.text]
          : [];

      const fullText = pages
        .map((p) => (typeof p === "string" ? p.trim() : ""))
        .filter((p) => p.length > 0)
        .join("\n\n");

      const wordCount = fullText.trim()
        ? fullText.trim().split(/\s+/).filter(Boolean).length
        : 0;

      // Treat a PDF with fewer than 20 characters of text as having no readable text
      const hasReadableText = fullText.trim().length >= 20;

      let text = fullText.trim();
      let truncated = false;
      if (text.length > 10000) {
        text = text.slice(0, 10000);
        truncated = true;
      }

      return {
        text,
        truncated,
        warnings,
        accessibility: {
          imageCount: 0,
          imagesWithoutAlt: 0,
          hasHeadings: false,
          wordCount,
          hasReadableText,
        },
      };
    } catch (err: any) {
      warnings.push(`PDF text extraction error: ${err?.message || "Unknown error"}`);
      return {
        text: "",
        truncated: false,
        warnings,
        accessibility: {
          imageCount: 0,
          imagesWithoutAlt: 0,
          hasHeadings: false,
          wordCount: 0,
          hasReadableText: false,
        },
      };
    }
  }

  // ── 2. DOCX Document Handling ──
  let imageCount = 0;
  let imagesWithoutAlt = 0;

  try {
    const convertImage = mammoth.images.imgElement(async (element: any) => {
      imageCount++;
      const alt = element?.altText ? String(element.altText).trim() : "";
      if (!alt) {
        imagesWithoutAlt++;
      }
      return { src: "" };
    });

    const htmlResult = await mammoth.convertToHtml(
      { buffer: nodeBuf },
      { convertImage },
    );

    const html = htmlResult?.value || "";

    if (htmlResult?.messages && Array.isArray(htmlResult.messages)) {
      for (const msg of htmlResult.messages) {
        const mText = msg?.message || String(msg);
        if (mText) warnings.push(mText);
      }
    }

    // Detect headings (h1 to h6) in the converted HTML
    const hasHeadings = /<h[1-6][\s>]/i.test(html);

    // Get plain text
    let plainText = "";
    try {
      const rawResult = await mammoth.extractRawText({ buffer: nodeBuf });
      plainText = (rawResult?.value || "").trim();
    } catch {
      // Fallback: strip html tags
      plainText = html
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();
    }

    const wordCount = plainText.trim()
      ? plainText.trim().split(/\s+/).filter(Boolean).length
      : 0;

    const hasReadableText = plainText.trim().length >= 20;

    let text = plainText;
    let truncated = false;
    if (text.length > 10000) {
      text = text.slice(0, 10000);
      truncated = true;
    }

    return {
      text,
      truncated,
      warnings,
      accessibility: {
        imageCount,
        imagesWithoutAlt,
        hasHeadings,
        wordCount,
        hasReadableText,
      },
    };
  } catch (err: any) {
    warnings.push(`DOCX extraction error: ${err?.message || "Unknown error"}`);
    return {
      text: "",
      truncated: false,
      warnings,
      accessibility: {
        imageCount,
        imagesWithoutAlt,
        hasHeadings: false,
        wordCount: 0,
        hasReadableText: false,
      },
    };
  }
}
