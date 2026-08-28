import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "학급 상세" };

/**
 * Class Detail /classes/[classId] (TRD §37)
 * 탭: 학생 명단 | 활동
 * Owner: Shared + INPUT
 */
export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return (
    <div className="space-y-6">
      <PageHeader title="학급 상세" description={`Class ${classId}`} />
      <EmptyState
        title="학급 상세 화면 준비 중"
        description="학생 명단과 배정된 활동을 여기서 관리해요."
      />
    </div>
  );
}
