import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { ProgressPanel } from "@/components/ui/ProgressPanel";

export const metadata: Metadata = { title: "분석 진행" };

/**
 * Analysis Job /analysis/jobs/[jobId] (TRD §44)
 * processing_jobs Table을 Polling/Realtime으로 조회. 페이지를 떠나도 진행된다.
 * Owner: PROCESS (feat/process)
 */
export default async function AnalysisJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  // TODO(PROCESS): processing_jobs에서 jobId 상태 조회
  return (
    <div className="space-y-6">
      <PageHeader
        title="분석 진행"
        description="분석이 진행되는 동안 다른 화면으로 이동해도 괜찮아요."
      />
      <ProgressPanel
        title={`분석 작업 ${jobId}`}
        currentStep="작업 상태 조회 준비 중 (feat/process 구현)"
        total={0}
        completed={0}
      />
    </div>
  );
}
