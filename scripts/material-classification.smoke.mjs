import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { classifyMaterialPdfWithVlm } from "../src/lib/ai/material-classification.ts";
import { getVlmAdapter } from "../src/lib/ai/vlm-adapter.ts";

const pdfPath = process.argv[2]
  ? resolve(process.argv[2])
  : new URL("../output/pdf/issue-29-synthetic-shuffled-batch.pdf", import.meta.url);
const pdf = await readFile(pdfPath);
const adapter = getVlmAdapter();
const result = await classifyMaterialPdfWithVlm({ classGrade: 3, pdfBase64: pdf.toString("base64") }, adapter);

assert.equal(result.grade, 3, "sample grade should be recognized");
assert.equal(result.subject, "수학", "sample subject should be recognized as Math");
assert.ok(result.questions.length >= 1, "at least one printed question should be recognized");
console.log(JSON.stringify({ provider: adapter.provider, model: adapter.model, title: result.title_candidate, grade: result.grade, subject: result.subject, questions: result.questions.length }, null, 2));
