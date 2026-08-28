import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Inbox, CheckCircle2, ClipboardList, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "대시보드" };
export const dynamic = "force-dynamic";

/**
 * 통합 대시보드 (TRD §36)
 * 카드 값은 실제 DB 집계 — 하드코딩 데모 숫자 금지.
 * Owner: Shared View (모듈 상태 집계)
 */
export default async function DashboardPage() {
  const hasSupabaseEnv = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY),
  );

  let openAssignments = 0;
  let submissionCount = 0;
  let reviewPending = 0;
  let approvedCount = 0;
  let todos: Array<{ analysisId: string; label: string }> = [];

  if (hasSupabaseEnv) {
    const supabase = await createClient();

    const [assignments, submissions, pending, approved, drafts] = await Promise.all([
      supabase
        .from("activity_assignments")
        .select("id", { count: "exact", head: true })
        .eq("status", "OPEN"),
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .not("submitted_at", "is", null),
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("process_status", "REVIEW_REQUIRED"),
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("process_status", "APPROVED"),
      supabase
        .from("analyses")
        .select(
          `id, submissions ( students ( name, student_number ),
             activity_assignments ( activities ( title ) ) )`,
        )
        .in("status", ["AI_DRAFT", "TEACHER_REVIEW"])
        .order("created_at", { ascending: true })
        .limit(5),
    ]);

    openAssignments = assignments.count ?? 0;
    submissionCount = submissions.count ?? 0;
    reviewPending = pending.count ?? 0;
    approvedCount = approved.count ?? 0;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const one = (v: any) => (Array.isArray(v) ? v[0] : v);
    todos = (drafts.data ?? []).map((d: any) => {
      const submission = one(d.submissions);
      const student = one(submission?.students);
      const activity = one(one(submission?.activity_assignments)?.activities);
      return {
        analysisId: d.id as string,
        label: `${student ? `${student.student_number}번 ${student.name}` : "학생"} · ${activity?.title ?? "활동"}`,
      };
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="오늘의 TRACE"
        description="학급의 제출·검토·분석 현황을 한눈에 확인하세요."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="진행 중 활동"
          value={openAssignments}
          icon={<ClipboardList className="h-4.5 w-4.5" />}
          href="/results"
          hint={openAssignments === 0 ? "아직 배정된 활동이 없어요" : "배정된 활동"}
        />
        <StatCard
          label="제출 현황"
          value={submissionCount}
          icon={<FolderOpen className="h-4.5 w-4.5" />}
          href="/results"
          hint={submissionCount === 0 ? "제출된 자료가 없어요" : "수집된 제출물"}
        />
        <StatCard
          label="검토 대기"
          value={reviewPending}
          tone="warning"
          icon={<Inbox className="h-4.5 w-4.5" />}
          href="/analysis"
          hint={reviewPending === 0 ? "검토할 분석이 없어요" : "AI 초안 검토 필요"}
        />
        <StatCard
          label="승인 완료"
          value={approvedCount}
          tone="brand"
          icon={<CheckCircle2 className="h-4.5 w-4.5" />}
          href="/analysis"
          hint={approvedCount === 0 ? "승인된 분석이 없어요" : "확정된 학습 근거"}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">지금 할 일</h2>
        {todos.length === 0 ? (
          <EmptyState
            title="지금 처리할 일이 없어요"
            description="학습자료를 추가하면 검토·분석할 일이 여기에 모여요."
            ctaLabel="학습자료 추가하러 가기"
            ctaHref="/results/add"
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
            {todos.map((todo) => (
              <li key={todo.analysisId}>
                <Link
                  href={`/analysis/${todo.analysisId}/review`}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition-colors duration-150 hover:bg-brand-50/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {todo.label}
                    </span>
                    <span className="text-xs text-muted">AI 분석 초안 검토가 필요해요</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge label="검토 대기" tone="warning" />
                    <ChevronRight className="h-4 w-4 text-muted" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">성장 흐름</h2>
        {/* 차트는 외부 라이브러리 없이 div+flex+% 로 구현한다 (UIUX Master Prompt) — OUTPUT 모듈 구현 예정 */}
        <EmptyState
          title="아직 성장 데이터가 없어요"
          description="승인된 분석이 누적되면 학급의 성장 흐름이 차트로 표시돼요."
        />
      </section>
    </div>
  );
}
