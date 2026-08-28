/**
 * Shared Curriculum Loader (TRD §15)
 * Standard/AchievementLevel 원문은 공통 JSON에서 읽는다. DB에 복제하지 않는다.
 * 모듈이 파일 경로를 하드코딩하지 않도록 이 로더만 사용한다.
 */
import sample from "./data/sample_standards_v1.json";

export interface AchievementLevel {
  level: string;
  description: string;
}

export interface Standard {
  standard_id: string;
  subject: string;
  grade_band: string;
  text: string;
  achievement_levels: AchievementLevel[];
}

const ALL_STANDARDS: Standard[] = (sample as { standards: Standard[] }).standards;

export function getStandard(standardId: string): Standard | null {
  return ALL_STANDARDS.find((s) => s.standard_id === standardId) ?? null;
}

export function getStandards(standardIds: string[]): Standard[] {
  return standardIds
    .map((id) => getStandard(id))
    .filter((s): s is Standard => s !== null);
}

export function listStandards(): Standard[] {
  return ALL_STANDARDS;
}
