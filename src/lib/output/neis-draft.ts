export const NEIS_GUIDELINE_METADATA = {
  schoolLevel: "초등학교",
  applicableYear: 2026,
  recordArea: "교과학습발달상황 · 성취수준 및 특기사항",
  sourceLabel: "2026학년도 학교생활기록부 기재요령 참고",
} as const;

export const SYNTHETIC_NEIS_DRAFT =
  "분수 모형에서 4등분한 전체 중 2부분을 색칠해 2/4로 나타냄. 이후 8등분한 모형의 4부분과 4등분한 모형의 2부분이 같은 양임을 확인하고 4/8 = 2/4로 표현함. 두 활동을 통해 부분과 전체의 관계를 분수와 모형으로 연결하는 과정이 구체적으로 드러남.";

const REVIEW_TERMS = [
  "교외",
  "대회",
  "수상",
  "자격증",
  "인증서",
  "논문",
  "특허",
  "장학금",
  "부모",
  "해외",
] as const;

export function calculateNeisBytes(value: string) {
  return new TextEncoder().encode(value).length;
}

export function isMeaningfullyEdited(initialValue: string, currentValue: string) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ");
  return normalize(initialValue) !== normalize(currentValue);
}

export function findNeisReviewWarnings(value: string) {
  return REVIEW_TERMS.filter((term) => value.includes(term)).map(
    (term) => `“${term}” 표현은 공식 기재요령과 학교 기준을 다시 확인하세요.`,
  );
}
