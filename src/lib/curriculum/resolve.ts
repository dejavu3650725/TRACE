import "server-only";
import { getStandards as getSampleStandards, type Standard } from "./loader";
import { getCurriculumLoader } from "./loader-full";

/**
 * 성취기준 해석 브리지 — 샘플 로더(loader.ts)에 없는 코드는
 * 전체 교육과정 로더(loader-full, Curriculum JSON 원문)에서 찾아 같은 모양으로 맞춘다.
 * 분석/검토가 어떤 성취기준 코드든 동일하게 다루게 한다.
 */

const FALLBACK_LEVELS: Standard["achievement_levels"] = [
  { level: "상", description: "성취기준이 요구하는 개념과 기능을 안정적으로 수행한다." },
  { level: "중", description: "성취기준의 핵심은 수행하지만 일부 상황에서 도움이 필요하다." },
  { level: "하", description: "성취기준 도달을 위해 기초 개념 보충이 필요하다." },
];

export async function resolveStandards(standardIds: string[]): Promise<Standard[]> {
  const sample = new Map(getSampleStandards(standardIds).map((s) => [s.standard_id, s]));
  const loader = await getCurriculumLoader().catch(() => null);

  const out: Standard[] = [];
  for (const id of standardIds) {
    const fromSample = sample.get(id);
    if (fromSample) {
      out.push(fromSample);
      continue;
    }
    const std = loader?.getStandard(id);
    if (!std) continue;
    const levelRow = loader?.getAchievementLevel(id);
    // 원문 성취수준이 A/B/C 표기면 TRACE 공통 표기(상/중/하)로 정규화한다
    const LEVEL_NAME: Record<string, string> = { A: "상", B: "중", C: "하" };
    const levels =
      levelRow && Object.keys(levelRow.levels).length > 0
        ? Object.entries(levelRow.levels).map(([level, description]) => ({
            level: LEVEL_NAME[level] ?? level,
            description,
          }))
        : FALLBACK_LEVELS;
    out.push({
      standard_id: std.id,
      subject: std.subject,
      grade_band: std.grade,
      text: std.description,
      achievement_levels: levels,
    });
  }
  return out;
}
