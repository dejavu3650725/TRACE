import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "활동 배정" };

/**
 * 활동 배정 /activities/[activityId]/assign
 * ActivityAssignment 생성 + submission_token/QR 발급
 * Owner: INPUT (feat/input)
 */
export default async function ActivityAssignPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;
  return (
    <div className="space-y-6">
      <PageHeader title="활동 배정" description={`Activity ${activityId}를 학급에 배정해요.`} />
      <EmptyState title="배정 화면 준비 중" description="INPUT 모듈(feat/input)에서 구현합니다." />
    </div>
  );
}
