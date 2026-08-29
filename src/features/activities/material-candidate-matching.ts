export type MaterialActivityMetadata = Readonly<{
  title: string;
  grade: number | null;
  subject: string | null;
  domain: string | null;
  unit: string | null;
  activityType: string | null;
  standardIds: readonly string[];
}>;

export type ExistingActivityForMatching = MaterialActivityMetadata & Readonly<{ id: string }>;

function normalized(value: string | null): string {
  return (value ?? "").normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[^0-9a-z가-힣]/g, "");
}

function same(left: string | null, right: string | null): boolean {
  const normalizedLeft = normalized(left);
  return normalizedLeft.length > 0 && normalizedLeft === normalized(right);
}

export function rankExistingActivityCandidates(
  metadata: MaterialActivityMetadata,
  activities: readonly ExistingActivityForMatching[],
): Array<ExistingActivityForMatching & { score: number; reasons: string[] }> {
  return activities.map((activity) => {
    let score = 0;
    const reasons: string[] = [];
    if (same(metadata.title, activity.title)) { score += 6; reasons.push("제목 일치"); }
    if (metadata.grade !== null && metadata.grade === activity.grade) { score += 2; reasons.push("학년 일치"); }
    if (same(metadata.subject, activity.subject)) { score += 3; reasons.push("교과 일치"); }
    if (same(metadata.domain, activity.domain)) { score += 2; reasons.push("영역 일치"); }
    if (same(metadata.unit, activity.unit)) { score += 2; reasons.push("단원 일치"); }
    if (same(metadata.activityType, activity.activityType)) { score += 1; reasons.push("유형 일치"); }
    const overlap = metadata.standardIds.filter((id) => activity.standardIds.includes(id)).length;
    if (overlap > 0) { score += Math.min(6, overlap * 3); reasons.push(`성취기준 ${overlap}개 일치`); }
    return { ...activity, score, reasons };
  }).filter((candidate) => candidate.score >= 3)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, "ko-KR"))
    .slice(0, 5);
}
