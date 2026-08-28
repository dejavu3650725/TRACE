import { CurriculumLoader, loadCurriculum } from "../src/lib/curriculum/loader-full.ts";
import { resolveAiCurriculumContext } from "../src/features/activities/ai-curriculum.ts";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Curriculum check failed: ${message}`);
  }
}

const snapshot = await loadCurriculum();
const loader = await CurriculumLoader.create();

const elementaryStandard = loader.getStandard("2국01-01");
const middleStandard = loader.getStandard("9국01-01");
const highInformationStandard = loader.getStandard("12정01-01");
const removedHighNonInformationStandard = loader.getStandard("12경제01-01");
const candidates = loader.findStandards({
  grade: "1~2학년",
  subject: "국어",
  domain: "듣기·말하기",
  keyword: "순서",
});
const elementaryCandidates = loader.findStandards({ grade: "3~4학년", limit: 100 });
const highInformationCandidates = loader.findStandards({ grade: "고1~3(선택)", subject: "정보", limit: 100 });
const elementarySubjects = loader.listStandardSubjects("3~4학년");
const koreanDomains = loader.listStandardDomains({ grade: "3~4학년", subject: "국어" });
const naturalKoreanContext = resolveAiCurriculumContext({
  loader,
  gradeBand: "3~4학년",
  teacherPrompt: "3학년 국어 읽기 활동지를 만들어 주세요.",
  subject: null,
  domain: null,
  standardKeyword: null,
});
const ambiguousContext = resolveAiCurriculumContext({
  loader,
  gradeBand: "3~4학년",
  teacherPrompt: "3학년 활동지를 만들어 주세요.",
  subject: null,
  domain: null,
  standardKeyword: null,
});
const matchedStandardCount = snapshot.standards.filter((standard) =>
  snapshot.achievementLevels.some((achievementLevel) => achievementLevel.standardId === standard.id),
).length;

assert(snapshot.standards.length > 0, "no standards were loaded");
assert(snapshot.achievementLevels.length > 0, "no achievement levels were loaded");
assert(elementaryStandard?.id === "2국01-01", "elementary standard lookup failed");
assert(middleStandard === null, "middle-school standards must be absent from the scoped dataset");
assert(highInformationStandard?.subject === "정보", "high-school Information standard lookup failed");
assert(removedHighNonInformationStandard === null, "non-Information high-school standards must be absent");
assert(
  snapshot.standards.filter((standard) => standard.grade === "고1~3(선택)").every((standard) => standard.subject === "정보"),
  "high-school scope must contain only Information standards",
);
assert(candidates.some((standard) => standard.id === "2국01-01"), "filtered keyword search failed");
assert(elementarySubjects.includes("국어") && elementarySubjects.includes("과학"), "elementary subject facets failed");
assert(koreanDomains.includes("읽기"), "Korean domain facets failed");
assert(naturalKoreanContext.resolvedSubject === "국어", "natural Korean subject inference failed");
assert(
  naturalKoreanContext.standards.length > 0 && naturalKoreanContext.standards.every((standard) => standard.subject === "국어"),
  "natural Korean request must not receive Science standards",
);
assert(ambiguousContext.standards.length === 0, "ambiguous natural request must not receive arbitrary standards");
assert(
  elementaryCandidates.length > 0 && elementaryCandidates.every((standard) => standard.grade === "3~4학년"),
  "elementary filter must not return high-school standards",
);
assert(
  highInformationCandidates.length === 23 && highInformationCandidates.every((standard) => standard.subject === "정보"),
  "high-school filter must return only the 23 retained Information standards",
);
assert(loader.findStandards({ unit: "존재하지않는단원" }).length === 0, "unit filter must be deterministic");
assert(loader.getStandard("does-not-exist") === null, "unknown standard must return null");
assert(loader.getAchievementLevel("does-not-exist") === null, "unknown achievement level must return null");

console.log(
  `Curriculum check passed: ${snapshot.standards.length} standards, ${snapshot.achievementLevels.length} achievement levels, ${matchedStandardCount} shared IDs.`,
);
