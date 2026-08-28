import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "학급 리포트" };

/**
 * Class Report /reports/classes/[classId] (TRD §46)
 * 섹션: 개요 → 공통 어려움 → 성취 분포 → 성장 인사이트
 * Owner: OUTPUT (feat/output)
 */
export default async function ClassReportPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return (
    <div className="space-y-6">
      <PageHeader title="학급 리포트" description={`Class ${classId}`} />
      <EmptyState
        title="학급 리포트 준비 중"
        description="OUTPUT 모듈(feat/output)에서 구현합니다."
      />
    </div>
  );
}
