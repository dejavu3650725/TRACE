import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "클래스 관리" };

/**
 * 클래스 관리 /classes (TRD §37)
 * Class 생성/조회, 학생명단 Import, Student 직접 추가/수정
 * Owner: Shared + INPUT
 */
export default function ClassesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="클래스 관리"
        description="학급을 만들고 학생 명단을 등록해요. 모든 자료 수집의 기준이 돼요."
      />
      {/* TODO(INPUT): Class 생성 폼 + Class 목록 + Roster Import */}
      <EmptyState
        icon={<UserPlus className="h-6 w-6" />}
        title="등록된 학급이 없어요"
        description="학급을 만들고 학생 명단을 등록하면 자료 수집을 시작할 수 있어요."
        ctaLabel="학급 만들기"
        ctaHref="/onboarding/class"
      />
    </div>
  );
}
