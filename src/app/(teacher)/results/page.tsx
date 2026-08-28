import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabNav } from "@/components/ui/TabNav";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "학습관리" };

/**
 * 학습관리 /results — INPUT Manage & Handoff 중심 (TRD §39)
 * Tab: 전체 | 검토 대기 | 분석 준비 | 분석 중 | 승인 완료
 * View: Activity별 | 학생별
 * Owner: INPUT (feat/input)
 */
export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ inputStatus?: string }>;
}) {
  const { inputStatus } = await searchParams;
  const activeTab = inputStatus === "REVIEW_PENDING" ? "review" : "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="학습관리"
        description="수집된 학습자료를 확인하고 분석으로 넘겨요."
      />

      <TabNav
        activeKey={activeTab}
        items={[
          { key: "all", label: "전체", href: "/results" },
          { key: "review", label: "검토 대기", href: "/results?inputStatus=REVIEW_PENDING" },
          { key: "ready", label: "분석 준비", href: "/results?inputStatus=READY_FOR_PROCESS" },
          { key: "analyzing", label: "분석 중", href: "/results?processStatus=ANALYZING" },
          { key: "approved", label: "승인 완료", href: "/results?processStatus=APPROVED" },
        ]}
      />

      {/* TODO(INPUT): FilterBar(Class/Subject/Standard/Student) + DataTable(Submission 목록) */}
      <EmptyState
        title="아직 수집된 학습자료가 없어요"
        description="학습자료를 추가하면 활동별·학생별로 모아볼 수 있어요."
        ctaLabel="학습자료 추가"
        ctaHref="/results/add"
      />
    </div>
  );
}
