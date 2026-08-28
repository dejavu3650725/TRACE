import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { JobProgress } from "@/features/process/JobProgress";

export const metadata: Metadata = { title: "분석 진행" };
export const dynamic = "force-dynamic";

/**
 * Analysis Job /analysis/jobs/[jobId] (TRD §44)
 * processing_jobs를 폴링해 진행상태 표시. 페이지를 떠나도 job_id로 재조회 가능.
 * Owner: PROCESS (feat/process)
 */
export default async function AnalysisJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <div className="space-y-6">
      <PageHeader
        title="분석 진행"
        description="분석은 서버에서 진행돼요. 다른 화면으로 이동하거나 창을 닫아도 계속됩니다."
      />
      <JobProgress jobId={jobId} />
    </div>
  );
}
