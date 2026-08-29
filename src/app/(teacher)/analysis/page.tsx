import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ANALYSIS_STATUS_LABEL } from "@/shared/types/status";
import { createClient } from "@/lib/supabase/server";
import { AnalysisRunPanel, type AnalysisTargetRow } from "@/features/process/AnalysisRunPanel";

export const metadata: Metadata = { title: "평가관리" };
export const dynamic = "force-dynamic";

/**
 * 평가관리 /analysis (TRD §43)
 * 01 자료 선택 → 02 분석 설정(성취기준 확인) → 03 분석 진행
 * 분석 가능 조건: input_status = READY_FOR_PROCESS
 * Owner: PROCESS (feat/process)
 */
export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  const { done } = await searchParams;
  const hasSupabaseEnv = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY),
  );

  if (!hasSupabaseEnv) {
    return (
      <div className="space-y-6">
        <PageHeader title="평가관리" description="분석 준비가 끝난 자료를 선택해 AI 분석을 실행하고 검토해요." />
        <EmptyState title="환경 변수 설정이 필요해요" description=".env에 Supabase 설정을 넣은 뒤 다시 실행해 주세요." />
      </div>
    );
  }

  const supabase = await createClient();

  // 분석 대상: READY_FOR_PROCESS (RLS로 본인 범위)
  const { data: targets } = await supabase
    .from("submissions")
    .select(
      `id, process_status, submitted_at,
       students ( name, student_number ),
       activity_assignments ( activities ( title, activity_standards ( standard_id ) ) )`,
    )
    .eq("input_status", "READY_FOR_PROCESS")
    .in("process_status", ["NOT_STARTED", "READY_TO_ANALYZE", "FAILED", "ANALYZING"])
    .order("submitted_at", { ascending: true })
    .limit(100);

  // 검토 대기: AI_DRAFT 분석
  const { data: drafts } = await supabase
    .from("analyses")
    .select(
      `id, status, created_at, version_no,
       submissions ( id, students ( name, student_number ),
         activity_assignments ( activities ( title ) ) )`,
    )
    .in("status", ["AI_DRAFT", "TEACHER_REVIEW"])
    .order("created_at", { ascending: true })
    .limit(100);

  // 승인 완료: 확정된 학습 근거 (다시 열람 가능)
  const { data: approvedList } = await supabase
    .from("analyses")
    .select(
      `id, status, updated_at, version_no,
       submissions ( id, students ( id, name, student_number ),
         activity_assignments ( activities ( title ) ) )`,
    )
    .in("status", ["APPROVED", "EDITED_APPROVED"])
    .order("updated_at", { ascending: false })
    .limit(100);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  const rows: AnalysisTargetRow[] = (targets ?? []).map((t: any) => {
    const student = one(t.students);
    const activity = one(one(t.activity_assignments)?.activities);
    return {
      id: t.id,
      studentLabel: student ? `${student.student_number}번 ${student.name}` : "학생 미상",
      activityTitle: activity?.title ?? "활동 미상",
      standardIds: (activity?.activity_standards ?? []).map((s: any) => s.standard_id),
      processStatus: t.process_status,
    };
  });

  const toRow = (d: any) => {
    const submission = one(d.submissions);
    const student = one(submission?.students);
    const activity = one(one(submission?.activity_assignments)?.activities);
    return {
      id: d.id as string,
      status: d.status as keyof typeof ANALYSIS_STATUS_LABEL,
      versionNo: d.version_no as number,
      studentId: (student?.id as string) ?? null,
      studentLabel: student ? `${student.student_number}번 ${student.name}` : "학생 미상",
      activityTitle: activity?.title ?? "활동 미상",
    };
  };
  const draftRows = (drafts ?? []).map(toRow);
  const approvedRows = (approvedList ?? []).map(toRow);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <div className="space-y-8">
      <PageHeader
        title="평가관리"
        description="분석 준비가 끝난 자료를 선택해 AI 분석을 실행하고 검토해요."
      />

      {done === "1" && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-success/20 bg-success-bg px-4 py-3 text-sm font-semibold text-success"
        >
          🎉 검토 대기를 모두 처리했어요! 승인된 분석은 아래 승인 완료에 확정 근거로 쌓였어요.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          01 · 자료 선택 <span className="ml-1 text-sm font-medium text-muted">분석할 제출물을 골라 실행하세요</span>
        </h2>
        <AnalysisRunPanel rows={rows} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          검토 대기 <span className="ml-1 text-sm font-medium text-muted">AI 초안을 확인하고 승인하세요</span>
        </h2>
        {draftRows.length === 0 ? (
          <EmptyState
            title="검토할 분석이 없어요"
            description="위에서 자료를 선택해 분석을 실행하면 AI 초안이 여기에 모여요."
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
            {draftRows.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/analysis/${d.id}/review`}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition-colors duration-150 hover:bg-brand-50/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {d.studentLabel} · {d.activityTitle}
                    </span>
                    <span className="text-xs text-muted">분석 v{d.versionNo}</span>
                  </span>
                  <StatusBadge
                    label={ANALYSIS_STATUS_LABEL[d.status].label}
                    tone={ANALYSIS_STATUS_LABEL[d.status].tone}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="approved" className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          승인 완료{" "}
          <span className="ml-1 text-sm font-medium text-muted">
            확정된 학습 근거예요. 클릭하면 다시 열람할 수 있어요
          </span>
        </h2>
        {approvedRows.length === 0 ? (
          <EmptyState
            title="아직 승인된 분석이 없어요"
            description="검토 대기의 AI 초안을 승인하면 여기에 확정 근거로 쌓여요."
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
            {approvedRows.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <Link
                  href={`/analysis/${d.id}/review`}
                  className="min-w-0 flex-1 transition-colors duration-150 hover:text-brand-700"
                >
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {d.studentLabel} · {d.activityTitle}
                  </span>
                  <span className="text-xs text-muted">분석 v{d.versionNo}</span>
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusBadge
                    label={ANALYSIS_STATUS_LABEL[d.status].label}
                    tone={ANALYSIS_STATUS_LABEL[d.status].tone}
                  />
                  {d.studentId && (
                    <Link
                      href={`/reports/students/${d.studentId}`}
                      className="rounded-xl border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 transition-colors duration-150 hover:bg-brand-50"
                    >
                      학생 리포트
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
