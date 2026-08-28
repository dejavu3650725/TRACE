import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActivityForm } from "@/features/activities/ActivityForm";
import { activateActivity, type StandardOption } from "@/features/activities/actions";
import {
  ActivityDraftContentSchema,
  AI_QUESTION_TYPE_LABEL,
} from "@/features/activities/ai-schema";
import { gradeBandForNumericGrade } from "@/features/activities/curriculum";
import { requireTeacherOwnership } from "@/lib/auth/ownership";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { getCurriculumLoader } from "@/lib/curriculum/loader-full";

export const metadata: Metadata = { title: "활동 상세" };

const activityStatus = {
  DRAFT: { label: "초안", tone: "warning" as const },
  ACTIVE: { label: "활성", tone: "success" as const },
  ARCHIVED: { label: "보관됨", tone: "neutral" as const },
};

export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{
    created?: string;
    saved?: string;
    activated?: string;
    "ai-created"?: string;
    "activity-error"?: string;
  }>;
}) {
  const { activityId } = await params;
  const query = await searchParams;
  try {
    await requireTeacherOwnership("activity", activityId);
  } catch {
    notFound();
  }

  const [{ teacher, supabase }, loader] = await Promise.all([requireSessionTeacher(), getCurriculumLoader()]);
  const [{ data: activity, error }, { data: parents, error: parentsError }] = await Promise.all([
    supabase
      .from("activities")
      .select("id, title, grade, subject, domain, unit, activity_type, description, content_json, activity_code, status, parent_activity_id, activity_standards(standard_id), activity_assignments(id)")
      .eq("id", activityId)
      .eq("teacher_id", teacher.id)
      .maybeSingle(),
    supabase
      .from("activities")
      .select("id, title, status")
      .eq("teacher_id", teacher.id)
      .neq("id", activityId)
      .neq("status", "ARCHIVED")
      .order("updated_at", { ascending: false }),
  ]);
  if (error) throw new Error("Activity detail lookup failed", { cause: error });
  if (parentsError) throw new Error("Parent Activity options lookup failed", { cause: parentsError });
  if (!activity) notFound();

  const standardRows = activity.activity_standards as Array<{ standard_id: string }> | null;
  const initialSelected: StandardOption[] = (standardRows ?? []).map(({ standard_id }) => {
    const standard = loader.getStandard(standard_id);
    return standard
      ? { id: standard.id, grade: standard.grade, subject: standard.subject, domain: standard.domain, description: standard.description }
      : { id: standard_id, grade: "미확인", subject: "미확인", domain: "미확인", description: "공유 교육과정 원문에서 찾을 수 없는 기존 연결" };
  });
  const activityGradeBand = gradeBandForNumericGrade(activity.grade);
  const initialCandidates: StandardOption[] = (activityGradeBand ? loader.findStandards({
    grade: activityGradeBand,
    subject: activity.subject ?? undefined,
    limit: 20,
  }) : []).map((standard) => ({
    id: standard.id,
    grade: standard.grade,
    subject: standard.subject,
    domain: standard.domain,
    description: standard.description,
  }));
  const parent = activity.parent_activity_id ? parents?.find((item) => item.id === activity.parent_activity_id) ?? null : null;
  const status = activityStatus[activity.status as keyof typeof activityStatus];
  const parsedContent = ActivityDraftContentSchema.safeParse(activity.content_json);
  const aiContent = parsedContent.success ? parsedContent.data : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={activity.title}
        description={activity.activity_code ?? "교사 확인 전 초안 — Activity Code 미발급"}
        actions={activity.status === "ACTIVE" ? <Link href={`/activities/${activity.id}/assign`} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700">학급에 배정 <ArrowRight className="h-4 w-4" /></Link> : undefined}
      />
      {query.created === "1" && <p className="rounded-lg bg-success-bg px-4 py-3 text-sm text-success">활동 초안을 저장했어요. 내용을 확인한 뒤 활성화하세요.</p>}
      {query["ai-created"] === "1" && <p className="rounded-lg bg-success-bg px-4 py-3 text-sm text-success">검토한 AI 활동 초안을 저장했어요. 문항과 안내문을 다시 확인한 뒤 활성화하세요.</p>}
      {query.saved === "1" && <p className="rounded-lg bg-success-bg px-4 py-3 text-sm text-success">활동 변경사항을 저장했어요.</p>}
      {query.activated === "1" && <p className="rounded-lg bg-success-bg px-4 py-3 text-sm text-success">교사 확인을 반영해 활동을 활성화하고 Activity Code를 발급했어요.</p>}
      {query["activity-error"] === "invalid-parent" && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">자기 자신 또는 다른 교사의 활동은 이전 차시로 연결할 수 없어요.</p>}
      {query["activity-error"] === "confirmation-required" && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">활성화 확인 항목에 체크해 주세요.</p>}
      {query["activity-error"] === "activation-failed" && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">활동을 활성화하지 못했어요. 입력 정보와 DB 마이그레이션을 확인해 주세요.</p>}
      {query["activity-error"] === "save-failed" && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">활동 변경사항을 저장하지 못했어요.</p>}
      {query["activity-error"] === "invalid-input" && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">활동 입력값을 확인해 주세요.</p>}

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">현재 상태</p>
            <div className="mt-2 flex items-center gap-3"><StatusBadge label={status.label} tone={status.tone} /><span className="text-sm text-muted">이전 차시: {parent?.title ?? "없음"}</span></div>
          </div>
          <span className="text-sm text-muted">성취기준 {initialSelected.length}개 · 학급 배정 {activity.activity_assignments?.length ?? 0}개</span>
        </div>
        {activity.status === "DRAFT" && (
          <form action={activateActivity} className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-bg p-4">
            <input type="hidden" name="activityId" value={activity.id} />
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input required type="checkbox" name="confirmActivation" value="yes" className="mt-0.5" />
              <span>활동 내용과 성취기준 연결을 확인했습니다. 활성화하면 사람이 읽을 수 있는 Activity Code가 발급됩니다.</span>
            </label>
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700"><CheckCircle2 className="h-4 w-4" /> 확인 후 활성화</button>
          </form>
        )}
      </section>

      {aiContent && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-foreground">AI 활동 초안 내용</h2>
              <p className="mt-1 text-sm text-muted">교사가 저장한 안내문·문항·인쇄 구성이에요. 활성화 전 최종 확인이 필요합니다.</p>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
              A4 {aiContent.print_layout_data.orientation === "PORTRAIT" ? "세로" : "가로"} · 예상 {aiContent.print_layout_data.estimated_pages}쪽
            </span>
          </div>

          <div className="mt-4 rounded-xl bg-background p-4">
            <h3 className="text-sm font-bold text-foreground">학생 안내문</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{aiContent.instructions}</p>
          </div>

          <div className="mt-4 space-y-3">
            {aiContent.questions.map((question) => (
              <article key={question.question_id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-brand-700">{question.question_id}</strong>
                  <span className="rounded-full bg-neutral-bg px-2 py-0.5 text-xs text-muted">
                    {AI_QUESTION_TYPE_LABEL[question.question_type]}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{question.prompt}</p>
                {question.options.length > 0 && (
                  <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
                    {question.options.map((option) => <li key={option}>{option}</li>)}
                  </ol>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <ActivityForm mode="edit" activity={activity} parentOptions={parents ?? []} initialCandidates={initialCandidates} initialSelected={initialSelected} />
    </div>
  );
}
