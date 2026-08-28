import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Link2 } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { assignActivityToClasses, updateActivityAssignment } from "@/features/activities/actions";
import { requireTeacherOwnership } from "@/lib/auth/ownership";
import { requireSessionTeacher } from "@/lib/auth/teacher";

export const metadata: Metadata = { title: "활동 배정" };

const assignmentStatus = {
  OPEN: { label: "제출 가능", tone: "success" as const },
  CLOSED: { label: "제출 마감", tone: "warning" as const },
  ARCHIVED: { label: "보관됨", tone: "neutral" as const },
};

function koreanDateTimeInput(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso)).replace(" ", "T");
}
export default async function ActivityAssignPage({
  params,
  searchParams,
}: {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ assigned?: string; updated?: string; "assignment-error"?: string }>;
}) {
  const { activityId } = await params;
  const query = await searchParams;
  try {
    await requireTeacherOwnership("activity", activityId);
  } catch {
    notFound();
  }

  const { teacher, supabase } = await requireSessionTeacher();
  const [{ data: activity, error }, { data: classes, error: classesError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    supabase.from("activities").select("id, title, status, activity_code").eq("id", activityId).eq("teacher_id", teacher.id).maybeSingle(),
    supabase.from("classes").select("id, name, grade, subject, is_active").eq("teacher_id", teacher.id).order("created_at", { ascending: false }),
    supabase.from("activity_assignments").select("id, class_id, submission_token, open_at, due_at, status").eq("activity_id", activityId).order("created_at", { ascending: false }),
  ]);
  if (error) throw new Error("Activity assignment Activity lookup failed", { cause: error });
  if (classesError) throw new Error("Activity assignment Class lookup failed", { cause: classesError });
  if (assignmentsError) throw new Error("ActivityAssignment list lookup failed", { cause: assignmentsError });
  if (!activity) notFound();

  const assignedClassIds = new Set(assignments?.map((assignment) => assignment.class_id) ?? []);
  const availableClasses = classes?.filter((classItem) => classItem.is_active && !assignedClassIds.has(classItem.id)) ?? [];
  const classesById = new Map(classes?.map((classItem) => [classItem.id, classItem]) ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="활동 배정"
        description={`${activity.title} · ${activity.activity_code ?? "초안"}`}
        actions={<Link href={`/activities/${activity.id}`} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-bold text-foreground hover:bg-neutral-bg"><ArrowLeft className="h-4 w-4" /> 활동으로</Link>}
      />
      {query.assigned !== undefined && <p className="rounded-lg bg-success-bg px-4 py-3 text-sm text-success">새 학급 {Number(query.assigned)}곳에 활동을 배정했어요. 이미 배정된 학급은 중복 생성하지 않았어요.</p>}
      {query.updated === "1" && <p className="rounded-lg bg-success-bg px-4 py-3 text-sm text-success">배정 상태와 일정을 저장했어요.</p>}
      {query["assignment-error"] === "invalid-input" && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">배정할 학급과 일정을 확인해 주세요. 마감 시각은 시작 시각보다 빨라서는 안 돼요.</p>}
      {query["assignment-error"] === "save-failed" && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">활동 배정을 저장하지 못했어요. 소유권과 DB 마이그레이션을 확인해 주세요.</p>}

      {activity.status !== "ACTIVE" ? (
        <EmptyState title="활동을 먼저 활성화해 주세요" description="교사가 내용을 확인해 ACTIVE 상태로 전환한 활동만 학급에 배정할 수 있어요." ctaLabel="활동 확인" ctaHref={`/activities/${activity.id}`} />
      ) : (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="font-bold text-foreground">학급 선택</h2>
          <p className="mt-1 text-sm text-muted">여러 학급을 한 번에 선택할 수 있어요. QR과 제출 토큰은 아직 발급하지 않습니다.</p>
          {availableClasses.length > 0 ? (
            <form action={assignActivityToClasses} className="mt-4 space-y-4">
              <input type="hidden" name="activityId" value={activity.id} />
              <input type="hidden" name="status" value="OPEN" />
              <div className="grid gap-2 md:grid-cols-2">
                {availableClasses.map((classItem) => (
                  <label key={classItem.id} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm text-foreground">
                    <input type="checkbox" name="classIds" value={classItem.id} />
                    <span><strong>{classItem.name}</strong><span className="ml-2 text-muted">{[classItem.grade ? `${classItem.grade}학년` : null, classItem.subject].filter(Boolean).join(" · ")}</span></span>
                  </label>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-foreground">제출 시작 <span className="font-normal text-muted">(선택, 한국시간)</span><input type="datetime-local" name="openAt" className="rounded-lg border border-border bg-background px-3 py-2" /></label>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">제출 마감 <span className="font-normal text-muted">(선택, 한국시간)</span><input type="datetime-local" name="dueAt" className="rounded-lg border border-border bg-background px-3 py-2" /></label>
              </div>
              <div className="flex justify-end"><button type="submit" className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700">선택 학급에 배정</button></div>
            </form>
          ) : (
            <p className="mt-4 rounded-xl bg-background px-4 py-3 text-sm text-muted">배정 가능한 활성 학급이 없어요. 모든 학급에 이미 배정했거나 활성 학급을 먼저 만들어야 해요.</p>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h2 className="font-bold text-foreground">현재 배정</h2><span className="text-sm text-muted">{assignments?.length ?? 0}개 학급</span></div>
        {assignments && assignments.length > 0 ? (
          <div className="mt-4 space-y-3">
            {assignments.map((assignment) => {
              const classItem = classesById.get(assignment.class_id);
              const status = assignmentStatus[assignment.status as keyof typeof assignmentStatus];
              return (
                <form key={assignment.id} action={updateActivityAssignment} className="grid gap-3 rounded-xl border border-border p-4 xl:grid-cols-[1fr_160px_210px_210px_auto] xl:items-end">
                  <input type="hidden" name="activityId" value={activity.id} />
                  <input type="hidden" name="assignmentId" value={assignment.id} />
                  <div><p className="font-bold text-foreground">{classItem?.name ?? "소유 학급"}</p><div className="mt-2 flex items-center gap-2"><StatusBadge label={status.label} tone={status.tone} /><span className="inline-flex items-center gap-1 text-xs text-muted"><Link2 className="h-3.5 w-3.5" /> {assignment.submission_token ? "제출 토큰 있음" : "QR 미발급"}</span></div></div>
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">상태<select name="status" defaultValue={assignment.status} className="rounded-lg border border-border bg-background px-3 py-2"><option value="OPEN">제출 가능</option><option value="CLOSED">제출 마감</option><option value="ARCHIVED">보관됨</option></select></label>
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">제출 시작<input type="datetime-local" name="openAt" defaultValue={koreanDateTimeInput(assignment.open_at)} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">제출 마감<input type="datetime-local" name="dueAt" defaultValue={koreanDateTimeInput(assignment.due_at)} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
                  <button type="submit" className="rounded-lg border border-brand-600 px-4 py-2.5 text-sm font-bold text-brand-700 hover:bg-brand-50">저장</button>
                </form>
              );
            })}
          </div>
        ) : (
          <div className="mt-4"><EmptyState title="아직 배정된 학급이 없어요" description="위에서 하나 이상의 학급을 선택해 배정하세요." /></div>
        )}
      </section>
    </div>
  );
}
