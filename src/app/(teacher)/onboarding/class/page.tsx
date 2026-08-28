import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "학급 만들기" };

/**
 * Onboarding 1단계 /onboarding/class (TRD §9, §10)
 * 학년 · 학급명/반 · (선택) 교과 입력 → Class 생성 → class_code 발급
 * Owner: Shared + INPUT
 */
export default function OnboardingClassPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="학급 만들기" description="TRACE를 시작하려면 먼저 학급을 만들어요. (1/2)" />
      <EmptyState
        title="학급 생성 폼 준비 중"
        description="학년, 학급명, 교과(선택)를 입력해 학급을 만들어요."
      />
    </div>
  );
}
