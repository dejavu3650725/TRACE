import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TabNav } from "@/components/ui/TabNav";
import { ANALYSIS_STATUS_LABEL } from "@/shared/types/status";
import { createClient } from "@/lib/supabase/server";
import { BatchApproveButton } from "@/features/process/BatchApproveButton";

export const metadata: Metadata = { title: "평가관리" };
export const dynamic = "force-dynamic";

type EvaluationTab = "review" | "approved";

type AnalysisSearchParams = {
  tab?: string;
  q?: string;
  done?: string;
  batchApproved?: string;
  batchError?: string;
};

function tabHref(tab: EvaluationTab, query: AnalysisSearchParams): string {
  const params = new URLSearchParams({ tab });
  if (query.q?.trim()) params.set("q", query.q.trim());
  return `/analysis?${params.toString()}`;
}

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<AnalysisSearchParams>;
}) {
  const query = await searchParams;
  const { done, batchApproved, batchError } = query;
  const hasSupabaseEnv = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)
      && (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY),
  );

  if (!hasSupabaseEnv) {
    return (
      <div className="space-y-6">
        <PageHeader title="평가관리" description="AI 분석 결과를 검토하고 승인해요." />
        <EmptyState title="환경 변수 설정이 필요해요" description=".env에 Supabase 설정을 넣은 뒤 다시 실행해 주세요." />
      </div>
    );
  }

  const supabase = await createClient();
  const analysisRelation = `
    id, status, version_no,
    submissions (
      id, activity_assignment_id,
      students ( id, name, student_number ),
      activity_assignments (
        activities ( title, activity_code, subject, domain )
      )
    )
  `;

  const [{ data: drafts }, { data: approvedList }] = await Promise.all([
    supabase
      .from("analyses")
      .select(`${analysisRelation}, created_at`)
      .in("status", ["AI_DRAFT", "TEACHER_REVIEW"])
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("analyses")
      .select(`${analysisRelation}, updated_at`)
      .in("status", ["APPROVED", "EDITED_APPROVED"])
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  /* Supabase relation inference can return a row or a one-row array. */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const one = (value: any) => (Array.isArray(value) ? value[0] : value);
  const toRow = (analysis: any) => {
    const submission = one(analysis.submissions);
    const student = one(submission?.students);
    const activity = one(one(submission?.activity_assignments)?.activities);
    const studentLabel = student ? `${student.student_number}번 ${student.name}` : "학생 미상";
    const activityTitle = activity?.title ?? "활동 미상";
    return {
      id: analysis.id as string,
      studentId: (student?.id as string) ?? null,
      submissionId: submission?.id as string,
      assignmentId: submission?.activity_assignment_id as string,
      status: analysis.status as keyof typeof ANALYSIS_STATUS_LABEL,
      versionNo: analysis.version_no as number,
      studentLabel,
      activityTitle,
      searchText: [studentLabel, activityTitle, activity?.activity_code, activity?.subject, activity?.domain]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ko-KR"),
    };
  };
  const allDraftRows = (drafts ?? []).map(toRow);
  const allApprovedRows = (approvedList ?? []).map(toRow);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const keyword = query.q?.trim().toLocaleLowerCase("ko-KR") ?? "";
  const draftRows = keyword ? allDraftRows.filter((row) => row.searchText.includes(keyword)) : allDraftRows;
  const approvedRows = keyword ? allApprovedRows.filter((row) => row.searchText.includes(keyword)) : allApprovedRows;
  const activeTab: EvaluationTab = query.tab === "approved"
    || (!query.tab && allDraftRows.length === 0)
    ? "approved"
    : "review";

  // Teacher-owned Batch PDF가 연결된 활동에만 일괄 승인 버튼을 허용한다.
  const draftAssignmentIds = [...new Set(allDraftRows.map((row) => row.assignmentId).filter(Boolean))];
  const batchAssignmentIds = new Set<string>();
  if (draftAssignmentIds.length > 0) {
    const { data: assignmentSubmissions } = await supabase
      .from("submissions")
      .select("id, activity_assignment_id")
      .in("activity_assignment_id", draftAssignmentIds)
      .limit(100);
    const submissionAssignment = new Map(
      (assignmentSubmissions ?? []).map((submission) => [submission.id, submission.activity_assignment_id]),
    );
    const submissionIds = [...submissionAssignment.keys()];
    if (submissionIds.length > 0) {
      const { data: ranges } = await supabase
        .from("artifacts")
        .select("submission_id, source_artifact_id")
        .in("submission_id", submissionIds)
        .eq("artifact_role", "DERIVED")
        .not("source_artifact_id", "is", null);
      const sourceIds = [...new Set((ranges ?? []).flatMap((range) => (
        range.source_artifact_id ? [range.source_artifact_id] : []
      )))];
      if (sourceIds.length > 0) {
        const { data: sources } = await supabase
          .from("artifacts")
          .select("id")
          .in("id", sourceIds)
          .eq("artifact_role", "ORIGINAL")
          .eq("mime_type", "application/pdf")
          .not("owner_teacher_id", "is", null)
          .is("submission_id", null)
          .is("source_artifact_id", null);
        const validSourceIds = new Set((sources ?? []).map((source) => source.id));
        for (const range of ranges ?? []) {
          if (!range.submission_id || !range.source_artifact_id || !validSourceIds.has(range.source_artifact_id)) continue;
          const assignmentId = submissionAssignment.get(range.submission_id);
          if (assignmentId) batchAssignmentIds.add(assignmentId);
        }
      }
    }
  }

  const groupRows = (rows: typeof draftRows) => [...rows.reduce((groups, row) => {
    const key = row.assignmentId || row.id;
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
    return groups;
  }, new Map<string, typeof rows>())];
  const activeRows = activeTab === "review" ? draftRows : approvedRows;
  const activeGroups = groupRows(activeRows);

  return (
    <div className="space-y-6">
      <PageHeader title="평가관리" description="활동별 AI 분석 결과를 검토하고 승인해요." />

      {done === "1" ? (
        <p role="status" className="rounded-2xl border border-success/20 bg-success-bg px-4 py-3 text-sm font-semibold text-success">
          검토 대기를 모두 처리했어요. 승인된 분석은 확정 근거로 저장됐어요.
        </p>
      ) : null}
      {batchApproved !== undefined && !batchError ? (
        <p role="status" className="rounded-2xl border border-success/20 bg-success-bg px-4 py-3 text-sm font-semibold text-success">
          AI 분석 {Number(batchApproved) || 0}건을 일괄 승인했어요.
        </p>
      ) : null}
      {batchError ? (
        <p role="alert" className="rounded-2xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">
          {Number(batchApproved) > 0
            ? `${Number(batchApproved)}건은 승인했고, 일부 항목은 처리하지 못했어요.`
            : "일괄 승인을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."}
        </p>
      ) : null}

      <TabNav
        activeKey={activeTab}
        items={[
          { key: "review", label: "검토 대기", count: draftRows.length, href: tabHref("review", query) },
          { key: "approved", label: "승인 완료", count: approvedRows.length, href: tabHref("approved", query) },
        ]}
      />

      <form method="get" role="search" className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 shadow-sm focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
        <input type="hidden" name="tab" value={activeTab} />
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input name="q" defaultValue={query.q ?? ""} aria-label="평가 결과 검색" placeholder="활동명, 교과, 학생 검색" className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted" />
        {query.q ? <Link href={tabHref(activeTab, { ...query, q: undefined })} className="shrink-0 px-2 text-xs font-bold text-muted hover:text-foreground">지우기</Link> : null}
        <button type="submit" className="h-8 shrink-0 rounded-lg bg-foreground px-4 text-sm font-bold text-background">검색</button>
      </form>

      {activeGroups.length === 0 ? (
        <EmptyState
          title={keyword ? "검색 결과가 없어요" : activeTab === "review" ? "검토할 분석이 없어요" : "아직 승인된 분석이 없어요"}
          description={keyword ? "다른 활동명, 교과 또는 학생 이름으로 검색해 보세요." : activeTab === "review" ? "분석이 끝나면 활동별 검토 결과가 여기에 표시돼요." : "검토 대기의 AI 초안을 승인하면 여기에 표시돼요."}
        />
      ) : (
        <section className="space-y-3" aria-label={activeTab === "review" ? "검토 대기 활동" : "승인 완료 활동"}>
          {activeGroups.map(([assignmentId, group]) => (
            <details key={assignmentId} className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
              <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-foreground">{group[0]?.activityTitle ?? "활동"}</span>
                  <span className="mt-0.5 block text-xs font-medium text-muted">{activeTab === "review" ? "검토 대기" : "승인 완료"} {group.length}건</span>
                </span>
                <StatusBadge label={activeTab === "review" ? "검토 대기" : "승인 완료"} tone={activeTab === "review" ? "warning" : "success"} />
                <ChevronDown className="h-5 w-5 text-muted transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-line">
                {activeTab === "review" && !keyword && group.length > 1 && batchAssignmentIds.has(assignmentId) ? (
                  <div className="flex justify-end border-b border-line bg-neutral-bg/40 px-5 py-3">
                    <BatchApproveButton activityAssignmentId={assignmentId} count={group.length} />
                  </div>
                ) : null}
                <ul className="divide-y divide-line">
                  {group.map((row) => (
                    <li key={row.id}>
                      <div className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-brand-50/40">
                        <Link href={`/analysis/${row.id}/review`} className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{row.studentLabel}</span>
                          <span className="text-xs text-muted">분석 v{row.versionNo}</span>
                        </Link>
                        <span className="flex shrink-0 items-center gap-2">
                          <StatusBadge label={ANALYSIS_STATUS_LABEL[row.status].label} tone={ANALYSIS_STATUS_LABEL[row.status].tone} />
                          {activeTab === "approved" && row.studentId ? (
                            <Link href={`/reports/students/${row.studentId}`} className="rounded-xl border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-50">
                              학생 리포트
                            </Link>
                          ) : null}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
