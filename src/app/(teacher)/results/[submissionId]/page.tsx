import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "제출 상세" };

/**
 * Submission 상세 /results/[submissionId]
 * 원본 Artifact + StructuredInput 확인/수정 (REVIEW_PENDING 처리)
 * Owner: INPUT (feat/input)
 */
export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  return (
    <div className="space-y-6">
      <PageHeader title="제출 상세" description={`Submission ${submissionId}`} />
      <EmptyState
        title="제출 상세 화면 준비 중"
        description="INPUT 모듈(feat/input)에서 구현합니다. 원본과 인식 결과를 나란히 보여줘요."
      />
    </div>
  );
}
