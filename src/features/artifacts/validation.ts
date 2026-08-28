import { PDFDocument } from "pdf-lib";
import { FILE_LIMITS } from "../../lib/config.ts";

export type ValidatedTeacherArtifact = {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  extension: "jpg" | "png" | "webp" | "pdf";
  fileName: string;
  fileSizeBytes: number;
  pageCount: number | null;
};

export class ArtifactFileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactFileValidationError";
  }
}

type UploadFileLike = {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function detectFileType(bytes: Uint8Array) {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mimeType: "image/jpeg" as const, extension: "jpg" as const };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: "image/png" as const, extension: "png" as const };
  }
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { mimeType: "image/webp" as const, extension: "webp" as const };
  }
  if (String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") {
    return { mimeType: "application/pdf" as const, extension: "pdf" as const };
  }
  throw new ArtifactFileValidationError("JPG, PNG, WebP 또는 PDF 파일만 올릴 수 있어요.");
}

function safeDisplayFileName(name: string, extension: string): string {
  const sanitized = name.replace(/[\\/\u0000-\u001f\u007f]/g, "_").trim();
  return (sanitized || `upload.${extension}`).slice(0, 255);
}

export async function validateTeacherArtifactFile(
  file: UploadFileLike,
): Promise<ValidatedTeacherArtifact> {
  if (!Number.isInteger(file.size) || file.size < 1) {
    throw new ArtifactFileValidationError("빈 파일은 올릴 수 없어요.");
  }
  if (file.size > FILE_LIMITS.PDF_MAX_BYTES) {
    throw new ArtifactFileValidationError("PDF는 파일당 30MB 이하, 이미지는 10MB 이하만 올릴 수 있어요.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size) {
    throw new ArtifactFileValidationError("파일 크기를 확인하지 못했어요. 파일을 다시 선택해 주세요.");
  }
  const detected = detectFileType(bytes);

  if (detected.mimeType.startsWith("image/") && file.size > FILE_LIMITS.IMAGE_MAX_BYTES) {
    throw new ArtifactFileValidationError("이미지는 파일당 10MB 이하만 올릴 수 있어요.");
  }

  let pageCount: number | null = null;
  if (detected.mimeType === "application/pdf") {
    try {
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
      pageCount = pdf.getPageCount();
    } catch {
      throw new ArtifactFileValidationError("손상되었거나 암호화된 PDF는 올릴 수 없어요.");
    }
    if (pageCount < 1 || pageCount > FILE_LIMITS.PDF_MAX_PAGES) {
      throw new ArtifactFileValidationError("PDF는 100쪽 이하만 올릴 수 있어요.");
    }
  }

  return {
    bytes,
    mimeType: detected.mimeType,
    extension: detected.extension,
    fileName: safeDisplayFileName(file.name, detected.extension),
    fileSizeBytes: file.size,
    pageCount,
  };
}
