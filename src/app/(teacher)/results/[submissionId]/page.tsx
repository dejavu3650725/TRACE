import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ReviewPendingResolutionPanel } from "@/features/results/ReviewPendingResolutionPanel";
import { requireTeacherOwnership } from "@/lib/auth/ownership";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { STORAGE } from "@/lib/config";
import { StructuredInputRuntimeSchema } from "@/features/submissions/structured-input-schema";

export const metadata: Metadata = { title: "제출 상세" };
export const dynamic = "force-dynamic";

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  await requireTeacherOwnership("submission", submissionId);
  const { supabase } = await requireSessionTeacher();
  const { data, error } = await supabase
    .from("submissions")
    .select(`
      id, structured_input, input_status, process_status, submitted_at, updated_at,
      students!inner(id, student_number, name),
      activity_assignments!inner(
        id, class_id,
        classes!inner(name),
        activities!inner(id, title, activity_code, subject, domain)
      ),
      artifacts(id, source_artifact_id, storage_path, file_name, mime_type, artifact_role, page_start, page_end)
    `)
    .eq("id", submissionId)
    .maybeSingle();
  if (error || !data) throw new Error("Submission detail lookup failed", { cause: error });

  const student = one(data.students);
  const assignment = one(data.activity_assignments);
  const classItem = one(assignment?.classes ?? null);
  const activity = one(assignment?.activities ?? null);
  const structuredInput = StructuredInputRuntimeSchema.safeParse(data.structured_input);
  const [{ data: classStudents }, { data: classAssignments }, artifactLinks] = await Promise.all([
    supabase.from("students")
      .select("id, student_number, name")
      .eq("class_id", assignment?.class_id ?? "")
      .eq("is_active", true)
      .order("student_number", { ascending: true }),
    supabase.from("activity_assignments")
      .select("id, activities!inner(id, title, activity_code, status)")
      .eq("class_id", assignment?.class_id ?? "")
      .neq("status", "ARCHIVED")
      .eq("activities.status", "ACTIVE"),
    Promise.all((data.artifacts ?? []).map(async (artifact) => {
    const { data: signed } = await supabase.storage
      .from(STORAGE.BUCKET)
      .createSignedUrl(artifact.storage_path, 300);
    return { ...artifact, signedUrl: signed?.signedUrl ?? null };
    })),
  ]);
  const assignmentOptions = (classAssignments ?? []).flatMap((item) => {
    const optionActivity = one(item.activities);
    return optionActivity ? [{
      id: item.id,
      label: `${optionActivity.title}${optionActivity.activity_code ? ` · ${optionActivity.activity_code}` : ""}`,
    }] : [];
  });

  return (
    <div className="space-y-6">
      <Link href={data.input_status === "REVIEW_PENDING" ? "/results?tab=review&inputStatus=REVIEW_PENDING" : "/results"} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> 학습관리로 돌아가기</Link>
      <PageHeader
        title={activity?.title ?? "제출 상세"}
        description={`${classItem?.name ?? "학급 미상"} · ${student ? `${student.student_number}번 ${student.name}` : "학생 미상"}`}
      />

      <section className="grid gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <div><p className="text-xs font-bold text-muted">활동 코드</p><p className="mt-1 font-mono text-sm font-bold text-foreground">{activity?.activity_code ?? "미발급"}</p></div>
        <div><p className="text-xs font-bold text-muted">교과·영역</p><p className="mt-1 text-sm font-bold text-foreground">{[activity?.subject, activity?.domain].filter(Boolean).join(" · ") || "미지정"}</p></div>
        <div><p className="text-xs font-bold text-muted">입력 상태</p><div className="mt-1"><StatusBadge label={data.input_status === "REVIEW_PENDING" ? "검토 대기" : data.input_status === "READY_FOR_PROCESS" ? "분석 준비" : data.input_status} tone={data.input_status === "REVIEW_PENDING" ? "warning" : "brand"} /></div></div>
        <div><p className="text-xs font-bold text-muted">분석 상태</p><div className="mt-1"><StatusBadge label={data.process_status === "APPROVED" ? "승인 완료" : data.process_status === "ANALYZING" ? "분석 중" : data.process_status === "READY_TO_ANALYZE" ? "분석 대기" : "분석 전"} tone={data.process_status === "APPROVED" ? "success" : data.process_status === "ANALYZING" ? "info" : "neutral"} /></div></div>
      </section>

      {data.input_status === "REVIEW_PENDING" && student && assignment ? (
        <ReviewPendingResolutionPanel
          submissionId={data.id}
          currentStudentId={student.id}
          currentAssignmentId={assignment.id}
          students={(classStudents ?? []).map((item) => ({ id: item.id, label: `${item.student_number}번 ${item.name}` }))}
          assignments={assignmentOptions}
          initialStructuredInput={structuredInput.success ? structuredInput.data : null}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-bold text-foreground">원본 자료</h2>
          {artifactLinks.length > 0 ? (
            <div className="mt-4 space-y-4">
              {artifactLinks.map((artifact) => (
                <article key={artifact.id} className="overflow-hidden rounded-xl border border-border bg-background">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span className="inline-flex min-w-0 items-center gap-2 font-bold text-foreground"><FileText className="h-4 w-4 shrink-0 text-brand-700" /><span className="truncate">{artifact.file_name}</span></span>
                    {artifact.signedUrl ? <a href={artifact.signedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline">5분 링크로 열기 <ExternalLink className="h-3.5 w-3.5" /></a> : <span className="text-xs text-danger">미리보기 실패</span>}
                  </div>
                  {artifact.signedUrl ? <iframe src={artifact.signedUrl} title={`${artifact.file_name} 원본 미리보기`} className="h-[480px] w-full border-t border-border bg-white" /> : null}
                </article>
              ))}
            </div>
          ) : <EmptyState title="연결된 원본이 없어요" description="이 Submission에 기록된 Artifact가 없습니다." />}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-bold text-foreground">인식된 학생 응답</h2>
          {structuredInput.success ? (
            <div className="mt-4 space-y-3">
              {structuredInput.data.questions.map((question) => (
                <article key={question.question_id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-foreground">{question.question_id}</h3><span className="rounded-full bg-neutral-bg px-2.5 py-1 text-xs font-bold text-muted">{question.response_type}</span></div>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-3 text-xs leading-6 text-foreground">{JSON.stringify(question.response, null, 2)}</pre>
                </article>
              ))}
            </div>
          ) : <EmptyState title="구조화된 응답이 없어요" description="학생 응답 인식이 완료되면 문항별 관찰 결과가 표시됩니다." />}
        </section>
      </div>
    </div>
  );
}
