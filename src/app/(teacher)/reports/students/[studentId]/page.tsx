import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "학생 리포트" };

/**
 * Student Report /reports/students/[studentId] (TRD §46, PRD §0.1)
 * 섹션 순서 고정: ① 최근 성장 → ② 반복되는 어려움 → ③ 후속학습 제안
 * 근거 문장 클릭 → EvidenceChip Drawer로 원본 확인
 * Owner: OUTPUT (feat/output)
 */
export default async function StudentReportPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  return (
    <div className="space-y-6">
      <PageHeader title="학생 리포트" description={`Student ${studentId}`} />
      <EmptyState
        title="학생 리포트 준비 중"
        description="OUTPUT 모듈(feat/output)에서 구현합니다. 최근 성장 → 반복되는 어려움 → 후속학습 제안 순서로 보여줘요."
      />
    </div>
  );
}
