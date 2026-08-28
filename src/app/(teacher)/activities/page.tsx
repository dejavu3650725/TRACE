import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "학습 활동" };

/**
 * 학습 활동 /activities (TRD §38)
 * Top-level 메뉴에는 없고 학습관리 내부 Tab으로 흡수. 라우트는 유지.
 * Owner: INPUT (feat/input)
 */
export default function ActivitiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="학습 활동"
        description="수업·과제·평가 활동을 만들고 학급에 배정해요."
      />
      <EmptyState
        title="등록된 활동이 없어요"
        description="활동을 만들면 성취기준과 연결하고 학급에 배정할 수 있어요."
        ctaLabel="활동 만들기"
        ctaHref="/activities/new"
      />
    </div>
  );
}
