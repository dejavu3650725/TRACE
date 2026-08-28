import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "분석 검토" };

/**
 * Analysis Review /analysis/[analysisId]/review (TRD §45)
 * Desktop: 원본 Artifact | AI Analysis(4카드: 강점·어려운 점·근거·피드백 초안)
 * Actions 순서 고정: [수정] [반려] [승인] — TeacherReviewBar
 * 하단 고정 주석: "학생 이름과 번호는 AI로 전송되지 않습니다."
 * Owner: PROCESS (feat/process)
 */
export default async function AnalysisReviewPage({
  params,
}: {
  params: Promise<{ analysisId: string }>;
}) {
  const { analysisId } = await params;
  return (
    <div className="space-y-6">
      <PageHeader title="분석 검토" description={`Analysis ${analysisId}`} />
      <EmptyState
        title="검토 화면 준비 중"
        description="PROCESS 모듈(feat/process)에서 구현합니다. 원본과 AI 결과를 나란히 보여줘요."
      />
      <p className="text-center text-xs text-muted">
        학생 이름과 번호는 AI로 전송되지 않습니다.
      </p>
    </div>
  );
}
