/**
 * 2022 개정 교육과정 — 초등 교과별 내용 영역 (NCIC 기준)
 * 성취기준 코드의 영역 번호(예: 4수01-11의 "01")를 영역명으로 해석한다.
 * 영역 수가 교과 구조 그 자체이므로, 레이더 차트의 N각형이 교과마다 달라진다.
 */

export const SUBJECT_DOMAINS: Record<string, string[]> = {
  국어: ["듣기·말하기", "읽기", "쓰기", "문법", "문학", "매체"],
  수학: ["수와 연산", "변화와 관계", "도형과 측정", "자료와 가능성"],
  사회: ["공간과 지리", "시간과 역사", "사회와 문화", "지속 가능한 삶"],
  과학: ["운동과 에너지", "물질과 변화", "생명과 시스템", "우주와 지구"],
  영어: ["이해", "표현"],
  실과: [
    "인간 발달과 주도적 삶",
    "생활환경과 지속가능한 선택",
    "기술적 문제해결과 혁신",
    "지속가능한 기술과 융합",
    "디지털 사회와 인공지능",
  ],
  체육: ["움직임 기술과 표현", "스포츠 가치와 도전", "신체 활동과 건강·안전"],
  음악: ["연주와 표현", "감상과 비평", "참여와 소통"],
  미술: ["미적 인식", "미술 표현", "미술 감상"],
  도덕: ["자신과의 관계", "타인과의 관계", "사회·공동체와의 관계", "자연·초월과의 관계"],
  통합교과: [
    "우리는 누구로 살아갈까",
    "우리는 어디서 살아갈까",
    "우리는 지금 어떻게 살아갈까",
    "우리는 무엇을 하며 살아갈까",
  ],
};

/** 성취기준 코드의 교과 문자 → 교과명 (바·슬·즐은 통합교과로 묶는다) */
const SUBJECT_CHAR: Record<string, string> = {
  국: "국어",
  수: "수학",
  사: "사회",
  과: "과학",
  영: "영어",
  실: "실과",
  체: "체육",
  음: "음악",
  미: "미술",
  도: "도덕",
  바: "통합교과",
  슬: "통합교과",
  즐: "통합교과",
};

/**
 * "4수01-11" → { subject: "수학", domainIndex: 0 ("수와 연산") }
 * 형식이 다르거나 미지원 교과면 null.
 */
export function parseStandardDomain(
  standardId: string,
): { subject: string; domainIndex: number } | null {
  const m = standardId.match(/^\d+([가-힣])(\d{2})-/);
  if (!m) return null;
  const subject = SUBJECT_CHAR[m[1]];
  if (!subject) return null;
  const idx = parseInt(m[2], 10) - 1;
  const domains = SUBJECT_DOMAINS[subject];
  if (!domains || idx < 0 || idx >= domains.length) return null;
  return { subject, domainIndex: idx };
}
