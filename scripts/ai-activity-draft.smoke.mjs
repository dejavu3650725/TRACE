import assert from "node:assert/strict";
import { resolveAiCurriculumContext } from "../src/features/activities/ai-curriculum.ts";
import { getActivityDraftAIProvider } from "../src/lib/ai/activity-provider.ts";
import { CurriculumLoader } from "../src/lib/curriculum/loader-full.ts";

const teacherPrompt = "3학년 국어 읽기에서 짧은 글의 의미를 파악하는 3문항 활동지를 만들어 주세요.";
const loader = await CurriculumLoader.create();
const context = resolveAiCurriculumContext({
  loader,
  gradeBand: "3~4학년",
  teacherPrompt,
  subject: null,
  domain: null,
  standardKeyword: null,
});
const candidateStandards = context.standards.map((standard) => ({
  id: standard.id,
  grade: standard.grade,
  subject: standard.subject,
  domain: standard.domain,
  description: standard.description,
}));

assert.equal(context.resolvedSubject, "국어");
assert.equal(context.resolvedDomain, "읽기");
assert.ok(candidateStandards.length > 0);
assert.ok(candidateStandards.every((standard) => standard.subject === "국어"));

const provider = getActivityDraftAIProvider();
const draft = await provider.generate({
  teacherPrompt,
  metadata: {
    schoolLevel: "초등학교",
    grade: 3,
    subject: context.resolvedSubject,
    domain: context.resolvedDomain,
    unit: null,
    activityType: "활동지",
  },
  candidateStandards,
});

assert.ok(draft.title.length > 0);
assert.ok(draft.questions.length >= 1);
assert.ok(draft.standard_candidates.every((id) => candidateStandards.some((standard) => standard.id === id)));

console.log(JSON.stringify({
  provider: provider.provider,
  model: provider.model,
  title: draft.title,
  questionCount: draft.questions.length,
  standardCandidates: draft.standard_candidates,
}, null, 2));
