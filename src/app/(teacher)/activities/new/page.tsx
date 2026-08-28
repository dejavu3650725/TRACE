import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "활동 만들기" };

/**
 * 활동 만들기 /activities/new (TRD §38)
 * 생성 방식: 직접 설정 | 자연어로 만들기 (AI Draft → 교사 수정 → 확정)
 * AI Rubric 생성 기능은 만들지 않는다.
 * Owner: INPUT (feat/input)
 */
export default function ActivityNewPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="활동 만들기" description="직접 설정하거나 자연어로 초안을 만들어요." />
      <EmptyState
        title="활동 생성 화면 준비 중"
        description="INPUT 모듈(feat/input)에서 구현합니다."
      />
    </div>
  );
}
