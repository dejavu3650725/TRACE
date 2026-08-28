import assert from "node:assert/strict";
import test from "node:test";
import { parseStudentInput } from "../src/features/roster/student.ts";

function form(values) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

test("Student roster input requires an integer number and a nonblank name", () => {
  assert.deepEqual(parseStudentInput(form({ studentNumber: "12", name: "  합성 학생  " })), {
    studentNumber: 12,
    name: "합성 학생",
  });
  assert.equal(parseStudentInput(form({ studentNumber: "", name: "합성 학생" })), null);
  assert.equal(parseStudentInput(form({ studentNumber: "1.5", name: "합성 학생" })), null);
  assert.equal(parseStudentInput(form({ studentNumber: "12", name: "   " })), null);
});

test("Student roster input stays within the PostgreSQL smallint range", () => {
  assert.equal(parseStudentInput(form({ studentNumber: "32768", name: "합성 학생" })), null);
  assert.equal(parseStudentInput(form({ studentNumber: "-32769", name: "합성 학생" })), null);
});
