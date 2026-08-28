import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "리포트" };

/**
 * 리포트 /reports (TRD §46)
 * Filter: Class · Student · Subject · Standard · Period
 * 승인(APPROVED/EDITED_APPROVED)된 데이터만 확정 근거로 사용한다.
 * Owner: OUTPUT (feat/output)
 */
export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="리포트"
        description="승인된 분석을 바탕으로 학급·학생 리포트를 확인해요."
      />
      {/* TODO(OUTPUT): FilterBar + 학급/학생 리포트 목록 */}
      <EmptyState
        title="아직 리포트가 없어요"
        description="분석이 승인되면 학생별 성장 리포트가 만들어져요."
        ctaLabel="평가관리로 이동"
        ctaHref="/analysis"
      />
    </div>
  );
}
