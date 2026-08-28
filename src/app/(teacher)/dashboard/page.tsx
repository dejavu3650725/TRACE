import type { Metadata } from "next";
import { FolderOpen, Inbox, CheckCircle2, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "대시보드" };

/**
 * 통합 대시보드 (TRD §36)
 * 카드 값은 실제 DB 집계로 채운다. 하드코딩 데모 숫자 금지.
 * TODO(OUTPUT): Supabase 집계 쿼리 연결
 */
export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="오늘의 TRACE"
        description="학급의 제출·검토·분석 현황을 한눈에 확인하세요."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="진행 중 활동" value={0} icon={<ClipboardList className="h-4.5 w-4.5" />} href="/results" hint="아직 등록된 활동이 없어요" />
        <StatCard label="제출 현황" value={0} icon={<FolderOpen className="h-4.5 w-4.5" />} href="/results" hint="제출된 자료가 없어요" />
        <StatCard label="검토 대기" value={0} tone="warning" icon={<Inbox className="h-4.5 w-4.5" />} href="/results?inputStatus=REVIEW_PENDING" hint="검토할 자료가 없어요" />
        <StatCard label="승인 완료" value={0} tone="brand" icon={<CheckCircle2 className="h-4.5 w-4.5" />} href="/analysis" hint="승인된 분석이 없어요" />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">지금 할 일</h2>
        <EmptyState
          title="지금 처리할 일이 없어요"
          description="학습자료를 추가하면 검토·분석할 일이 여기에 모여요."
          ctaLabel="학습자료 추가하러 가기"
          ctaHref="/results/add"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">성장 흐름</h2>
        {/* 차트는 외부 라이브러리 없이 div+flex+% 로 구현한다 (UIUX Master Prompt) */}
        <EmptyState
          title="아직 성장 데이터가 없어요"
          description="승인된 분석이 누적되면 학급의 성장 흐름이 차트로 표시돼요."
        />
      </section>
    </div>
  );
}
