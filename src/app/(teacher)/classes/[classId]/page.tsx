import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { reissueClassCode, updateClass } from "@/features/classes/actions";
import { isClassCodeActive } from "@/features/classes/class-code";
import { requireTeacherOwnership } from "@/lib/auth/ownership";
import { requireSessionTeacher } from "@/lib/auth/teacher";

export const metadata: Metadata = { title: "학급 상세" };

/**
 * Class Detail /classes/[classId] (TRD §37)
 * 탭: 학생 명단 | 활동
 * Owner: Shared + INPUT
 */
export default async function ClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ code?: string; updated?: string; error?: string }>;
}) {
  const { classId } = await params;
  const query = await searchParams;
  try {
    await requireTeacherOwnership("class", classId);
  } catch {
    notFound();
  }
  const { teacher, supabase } = await requireSessionTeacher();
  const { data: classItem, error } = await supabase
    .from("classes")
    .select("id, name, grade, subject, class_code, class_code_expires_at")
    .eq("id", classId)
    .eq("teacher_id", teacher.id)
    .maybeSingle();

  if (error) throw new Error("Class detail lookup failed", { cause: error });
  if (!classItem) notFound();
  const codeActive = isClassCodeActive(classItem.class_code, classItem.class_code_expires_at);
  const expiryText = classItem.class_code_expires_at
    ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(classItem.class_code_expires_at))
    : null;
  return (
    <div className="space-y-6">
      <PageHeader title={classItem.name} description="학급 정보와 학생 제출용 클래스 코드를 관리해요." />
      {query.code === "reissued" && <p className="rounded-lg bg-success-bg px-4 py-3 text-sm text-success">새 클래스 코드를 발급했어요. 이전 코드는 즉시 무효예요.</p>}
      {query.updated === "1" && <p className="rounded-lg bg-success-bg px-4 py-3 text-sm text-success">학급 정보를 저장했어요.</p>}
      {query.error === "invalid-input" && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">입력 값을 확인해 주세요.</p>}

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-foreground">학생 제출용 클래스 코드</h2>
            <p className="mt-1 text-sm text-muted">학생의 번호·이름과 함께 서버에서 제출 범위를 확인해요.</p>
          </div>
          <StatusBadge label={classItem.class_code ? (codeActive ? "유효" : "만료") : "미발급"} tone={codeActive ? "success" : classItem.class_code ? "warning" : "neutral"} />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-background p-4">
          <div>
            <p className="font-mono text-2xl font-bold tracking-[0.3em] text-foreground">{classItem.class_code ?? "—"}</p>
            <p className="mt-2 text-sm text-muted">{expiryText ? `${codeActive ? "만료" : "만료됨"}: ${expiryText}` : "아직 코드가 발급되지 않았어요."}</p>
          </div>
          <form action={reissueClassCode}>
            <input type="hidden" name="classId" value={classItem.id} />
            <button type="submit" className="rounded-lg border border-brand-600 px-4 py-2.5 text-sm font-bold text-brand-700 hover:bg-brand-50">{classItem.class_code ? "새 코드로 재발급" : "코드 발급"}</button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-bold text-foreground">학급 정보</h2>
        <form action={updateClass} className="mt-4 grid gap-4 md:grid-cols-3">
          <input type="hidden" name="classId" value={classItem.id} />
          <label className="grid gap-1.5 text-sm font-medium text-foreground">학급명/반<input required name="name" maxLength={100} defaultValue={classItem.name} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">학년 <span className="font-normal text-muted">(선택)</span><input name="grade" type="number" min="1" max="12" defaultValue={classItem.grade ?? ""} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">교과 <span className="font-normal text-muted">(선택)</span><input name="subject" maxLength={100} defaultValue={classItem.subject ?? ""} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 md:col-start-3">저장</button>
        </form>
      </section>
    </div>
  );
}
