import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "활동 상세" };

/** 활동 상세 /activities/[activityId] — Owner: INPUT (feat/input) */
export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;
  return (
    <div className="space-y-6">
      <PageHeader title="활동 상세" description={`Activity ${activityId}`} />
      <EmptyState title="활동 상세 화면 준비 중" description="INPUT 모듈(feat/input)에서 구현합니다." />
    </div>
  );
}
