export const CURRICULUM_GRADE_BANDS = [
  "1~2학년",
  "3~4학년",
  "5~6학년",
  "고1~3(선택)",
] as const;

export type CurriculumGradeBand = (typeof CURRICULUM_GRADE_BANDS)[number];

export const CURRICULUM_SCHOOL_LEVELS = ["초등학교", "고등학교"] as const;
export type CurriculumSchoolLevel = (typeof CURRICULUM_SCHOOL_LEVELS)[number];

const SCHOOL_GRADE_BANDS: Record<CurriculumSchoolLevel, readonly CurriculumGradeBand[]> = {
  초등학교: ["1~2학년", "3~4학년", "5~6학년"],
  고등학교: ["고1~3(선택)"],
};

export function gradeBandsForSchoolLevel(schoolLevel: CurriculumSchoolLevel): readonly CurriculumGradeBand[] {
  return SCHOOL_GRADE_BANDS[schoolLevel];
}

export function schoolLevelForNumericGrade(grade: number | null): CurriculumSchoolLevel | null {
  if (grade === null) return null;
  if (grade >= 1 && grade <= 6) return "초등학교";
  if (grade >= 10 && grade <= 12) return "고등학교";
  return null;
}

export function gradeBandForNumericGrade(grade: number | null): CurriculumGradeBand | null {
  if (grade === null) return null;
  if (grade >= 1 && grade <= 2) return "1~2학년";
  if (grade <= 4) return "3~4학년";
  if (grade <= 6) return "5~6학년";
  if (grade >= 10 && grade <= 12) return "고1~3(선택)";
  return null;
}

export function schoolLevelMatchesGrade(
  schoolLevel: CurriculumSchoolLevel,
  grade: number,
): boolean {
  return schoolLevelForNumericGrade(grade) === schoolLevel;
}

/** Returns a facet only when the teacher text identifies exactly one supplied Curriculum label. */
export function inferCurriculumLabel(text: string, labels: readonly string[]): string | null {
  const normalizedText = text.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
  const matches = [...new Set(labels)]
    .filter((label) => normalizedText.includes(label.toLocaleLowerCase("ko-KR").replace(/\s+/g, "")));
  return matches.length === 1 ? matches[0] : null;
}
