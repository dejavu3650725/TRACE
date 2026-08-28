import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { FILE_LIMITS, STORAGE } from "../src/lib/config.ts";
import {
  ArtifactFileValidationError,
  validateTeacherArtifactFile,
} from "../src/features/artifacts/validation.ts";

function uploadFile(name, bytes, declaredSize = bytes.byteLength) {
  return {
    name,
    size: declaredSize,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}

async function pdfWithPages(pageCount) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) pdf.addPage([100, 100]);
  return pdf.save();
}

test("detects file content instead of trusting a file extension", async () => {
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);
  const result = await validateTeacherArtifactFile(uploadFile("synthetic.pdf", bytes));
  assert.equal(result.mimeType, "image/jpeg");
  assert.equal(result.extension, "jpg");
  assert.equal(result.pageCount, null);
});

test("sanitizes the display name while preserving it outside the Storage key", async () => {
  const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const result = await validateTeacherArtifactFile(uploadFile("folder/synthetic\u0000.png", bytes));
  assert.equal(result.fileName, "folder_synthetic_.png");
  const path = STORAGE.submissionOriginalPath(
    "00000000-0000-4000-8000-000000001501",
    "00000000-0000-4000-8000-000000001502",
    "00000000-0000-4000-8000-000000001503",
    result.extension,
  );
  assert.equal(path, "teachers/00000000-0000-4000-8000-000000001501/submissions/00000000-0000-4000-8000-000000001502/original/00000000-0000-4000-8000-000000001503.png");
  assert.equal(path.includes(result.fileName), false);
});

test("rejects unsupported content even when the name looks like an image", async () => {
  await assert.rejects(
    validateTeacherArtifactFile(uploadFile("synthetic.jpg", new TextEncoder().encode("not an image"))),
    (error) => error instanceof ArtifactFileValidationError && /JPG/.test(error.message),
  );
});

test("rejects an image above 10MB", async () => {
  const bytes = new Uint8Array(FILE_LIMITS.IMAGE_MAX_BYTES + 1);
  bytes.set([0xff, 0xd8, 0xff]);
  await assert.rejects(
    validateTeacherArtifactFile(uploadFile("oversize.jpg", bytes)),
    (error) => error instanceof ArtifactFileValidationError && /10MB/.test(error.message),
  );
});

test("rejects a declared file above the absolute 30MB limit before reading it", async () => {
  let read = false;
  const file = {
    name: "oversize.pdf",
    size: FILE_LIMITS.PDF_MAX_BYTES + 1,
    async arrayBuffer() {
      read = true;
      return new ArrayBuffer(0);
    },
  };
  await assert.rejects(validateTeacherArtifactFile(file), ArtifactFileValidationError);
  assert.equal(read, false);
});

test("accepts a valid PDF and counts its pages", async () => {
  const bytes = await pdfWithPages(2);
  const result = await validateTeacherArtifactFile(uploadFile("synthetic.pdf", bytes));
  assert.equal(result.mimeType, "application/pdf");
  assert.equal(result.pageCount, 2);
});

test("rejects a PDF over 100 pages", async () => {
  const bytes = await pdfWithPages(FILE_LIMITS.PDF_MAX_PAGES + 1);
  await assert.rejects(
    validateTeacherArtifactFile(uploadFile("too-many-pages.pdf", bytes)),
    (error) => error instanceof ArtifactFileValidationError && /100쪽/.test(error.message),
  );
});

test("rejects a damaged PDF", async () => {
  const bytes = new TextEncoder().encode("%PDF-1.7\nsynthetic but damaged");
  await assert.rejects(
    validateTeacherArtifactFile(uploadFile("damaged.pdf", bytes)),
    (error) => error instanceof ArtifactFileValidationError && /손상/.test(error.message),
  );
});
