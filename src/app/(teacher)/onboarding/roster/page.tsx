import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "학생 명단 등록" };

/**
 * Onboarding 2단계 /onboarding/roster (TRD §10)
 * CSV/XLSX 업로드 또는 직접 추가. 번호+이름 필수, 학급 내 번호 중복 금지.
 * Owner: Shared + INPUT
 */
export default function OnboardingRosterPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="학생 명단 등록" description="번호와 이름만 있으면 돼요. (2/2)" />
      <EmptyState
        title="명단 등록 화면 준비 중"
        description="TRACE 표준 템플릿 업로드 또는 직접 추가를 지원해요."
      />
    </div>
  );
}
