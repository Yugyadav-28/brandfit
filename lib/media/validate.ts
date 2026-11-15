export type UploadKind = "document" | "image";

export interface ValidationResult {
  ok: boolean;
  mime?: string;
  error?: string;
}

export interface ThenableValidationResult
  extends ValidationResult,
    PromiseLike<ValidationResult> {}

export const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

function makeResult(ok: boolean, mime?: string, error?: string): ThenableValidationResult {
  const res: ValidationResult = {
    ok,
    ...(mime ? { mime } : {}),
    ...(error ? { error } : {}),
  };

  return {
    ...res,
    then<TResult1 = ValidationResult, TResult2 = never>(
      onfulfilled?: ((value: ValidationResult) => TResult1 | PromiseLike<TResult1>) | null,
      _onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      return Promise.resolve(res).then(onfulfilled);
    },
  };
}

/**
 * Inspects initial byte signatures (magic numbers) of a buffer to determine real MIME type.
 * - PDF: starts with %PDF (0x25, 0x50, 0x44, 0x46)
 * - DOCX: OpenXML zip starting with PK (0x50, 0x4B)
 * - PNG: \x89PNG\r\n\x1a\n (0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
 * - JPEG: 0xFF, 0xD8, 0xFF
 * - WebP: RIFF....WEBP (0x52, 0x49, 0x46, 0x46 ... 0x57, 0x45, 0x42, 0x50)
 */
export function detectMimeType(buf: Uint8Array | Buffer): string | null {
  if (!buf || buf.length < 2) return null;

  // PDF: %PDF (0x25, 0x50, 0x44, 0x46)
  if (
    buf.length >= 4 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  ) {
    return "application/pdf";
  }

  // DOCX: ZIP archive starting with PK (0x50, 0x4B)
  if (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  // PNG: \x89PNG (0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG: 0xFF, 0xD8, 0xFF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }

  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

function validateSync(
  buffer: Buffer | Uint8Array,
  size: number,
  kind: UploadKind,
): ThenableValidationResult {
  // 1. Size check: 4 MB at most
  if (size > MAX_FILE_SIZE) {
    const sizeInMb = (size / (1024 * 1024)).toFixed(2);
    return makeResult(
      false,
      undefined,
      `File size (${sizeInMb} MB) exceeds the maximum allowed limit of 4 MB.`,
    );
  }

  if (size === 0 || buffer.length === 0) {
    return makeResult(false, undefined, "The uploaded file is empty.");
  }

  // 2. Real content type detection from magic bytes
  const mime = detectMimeType(buffer);

  if (kind === "document") {
    if (
      mime === "application/pdf" ||
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return makeResult(true, mime);
    }

    if (mime?.startsWith("image/")) {
      return makeResult(
        false,
        undefined,
        "Please upload a document (PDF or DOCX). Image files are not accepted here.",
      );
    }

    return makeResult(
      false,
      undefined,
      "Invalid document format. The file content does not match a valid PDF (%PDF) or DOCX (PK) document.",
    );
  }

  if (kind === "image") {
    if (mime === "image/png" || mime === "image/jpeg" || mime === "image/webp") {
      return makeResult(true, mime);
    }

    if (
      mime === "application/pdf" ||
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return makeResult(
        false,
        undefined,
        "Please upload an image (PNG, JPEG, or WebP). Document files are not accepted here.",
      );
    }

    return makeResult(
      false,
      undefined,
      "Invalid image format. The file content does not match a valid PNG, JPEG, or WebP image.",
    );
  }

  return makeResult(false, undefined, "Unsupported upload type.");
}

/**
 * Validates an upload by checking size (up to 4 MB) and inspecting leading magic bytes,
 * ignoring extensions and client-supplied content-types.
 * Works synchronously when buffer is already provided, and asynchronously for Web File/Blob.
 */
export function validateUpload(
  input: any,
  kind: UploadKind,
): ThenableValidationResult | Promise<ValidationResult> {
  if (!input) {
    return makeResult(false, undefined, "No file provided.");
  }

  // Case 1: Node Buffer or Uint8Array directly
  if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
    return validateSync(input, input.length, kind);
  }

  // Case 2: Object with buffer / data
  if (input.buffer && (Buffer.isBuffer(input.buffer) || input.buffer instanceof Uint8Array)) {
    const size = typeof input.size === "number" ? input.size : input.buffer.length;
    return validateSync(input.buffer, size, kind);
  }

  if (input.data && (Buffer.isBuffer(input.data) || input.data instanceof Uint8Array)) {
    const size = typeof input.size === "number" ? input.size : input.data.length;
    return validateSync(input.data, size, kind);
  }

  // Case 3: Web File or Blob with .arrayBuffer()
  if (typeof input.arrayBuffer === "function") {
    const reportedSize = typeof input.size === "number" ? input.size : 0;
    if (reportedSize > MAX_FILE_SIZE) {
      const sizeInMb = (reportedSize / (1024 * 1024)).toFixed(2);
      return Promise.resolve(
        makeResult(
          false,
          undefined,
          `File size (${sizeInMb} MB) exceeds the maximum allowed limit of 4 MB.`,
        ),
      );
    }

    return input.arrayBuffer().then((ab: ArrayBuffer) => {
      const buf = Buffer.from(ab);
      const size = reportedSize > 0 ? reportedSize : buf.length;
      return validateSync(buf, size, kind);
    });
  }

  return makeResult(false, undefined, "Unable to read file content.");
}
