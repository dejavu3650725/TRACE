const SUBJECT_CODES: Record<string, string> = {
  국어: "KOR",
  수학: "MATH",
  과학: "SCI",
  정보: "INFO",
  사회: "SOC",
  도덕: "ETH",
  영어: "ENG",
  "기술·가정": "TECH",
  기술가정: "TECH",
  체육: "PE",
  음악: "MUSIC",
  미술: "ART",
};

function subjectCode(subject: string | null): string {
  if (!subject) return "ETC";
  const normalized = subject.trim();
  if (SUBJECT_CODES[normalized]) return SUBJECT_CODES[normalized];

  const ascii = normalized.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return ascii || "ETC";
}

function standardSegments(standardId: string | null): { domain: string; standard: string } {
  const match = standardId?.replace(/^\[/, "").replace(/\]$/, "").match(/(\d{2})-(\d{2})$/);
  return match ? { domain: match[1], standard: match[2] } : { domain: "00", standard: "00" };
}

/** PRD §5의 `SUBJ-GG-DD-SS` 부분. NNN은 DB에서 원자적으로 발급한다. */
export function buildActivityCodePrefix(input: {
  subject: string | null;
  grade: number | null;
  standardId: string | null;
}): string {
  const segments = standardSegments(input.standardId);
  const grade = input.grade === null ? "00" : String(input.grade).padStart(2, "0");
  return `${subjectCode(input.subject)}-${grade}-${segments.domain}-${segments.standard}`;
}

