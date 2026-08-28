import { CurriculumLoader, loadCurriculum } from "../src/lib/curriculum/loader.ts";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Curriculum check failed: ${message}`);
  }
}

const snapshot = await loadCurriculum();
const loader = await CurriculumLoader.create();

const elementaryStandard = loader.getStandard("2국01-01");
const middleStandard = loader.getStandard("9국01-01");
const highAchievementLevel = loader.getAchievementLevel("[10공국1-01-01]");
const candidates = loader.findStandards({
  grade: "1~2학년",
  subject: "국어",
  domain: "듣기·말하기",
  keyword: "순서",
});
const matchedStandardCount = snapshot.standards.filter((standard) =>
  snapshot.achievementLevels.some((achievementLevel) => achievementLevel.standardId === standard.id),
).length;

assert(snapshot.standards.length > 0, "no standards were loaded");
assert(snapshot.achievementLevels.length > 0, "no achievement levels were loaded");
assert(elementaryStandard?.id === "2국01-01", "elementary standard lookup failed");
assert(middleStandard?.id === "9국01-01", "middle-school standard lookup failed");
assert(highAchievementLevel?.standardId === "10공국1-01-01", "high-school achievement-level lookup failed");
assert(candidates.some((standard) => standard.id === "2국01-01"), "filtered keyword search failed");
assert(loader.findStandards({ unit: "존재하지않는단원" }).length === 0, "unit filter must be deterministic");
assert(loader.getStandard("does-not-exist") === null, "unknown standard must return null");
assert(loader.getAchievementLevel("does-not-exist") === null, "unknown achievement level must return null");

console.log(
  `Curriculum check passed: ${snapshot.standards.length} standards, ${snapshot.achievementLevels.length} achievement levels, ${matchedStandardCount} shared IDs.`,
);
