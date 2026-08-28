import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { reissueClassCode, updateClass } from "@/features/classes/actions";
import { isClassCodeActive } from "@/features/classes/class-code";
import { addStudent, updateStudent } from "@/features/roster/actions";
import { RosterImportPanel } from "@/features/roster/RosterImportPanel";
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
  searchParams: Promise<{ code?: string; updated?: string; error?: string; roster?: string; "roster-error"?: string }>;
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
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, student_number, name, is_active")
    .eq("class_id", classItem.id)
    .order("student_number", { ascending: true });

  if (studentsError) throw new Error("Student roster lookup failed", { cause: studentsError });
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
      {query.roster === "added" && <p className="rounded-lg bg-success-bg px-4 py-3 text-sm text-success">학생을 명단에 추가했어요.</p>}
      {query.roster === "updated" && <p className="rounded-lg bg-success-bg px-4 py-3 text-sm text-success">학생 정보를 저장했어요.</p>}
      {query.roster === "imported" && <p className="rounded-lg bg-success-bg px-4 py-3 text-sm text-success">명단을 저장했고 가져오기 기록을 남겼어요.</p>}
      {query["roster-error"] === "invalid-input" && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">학생 번호와 이름을 확인해 주세요.</p>}
      {query["roster-error"] === "duplicate-number" && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">이 학급에 이미 같은 번호의 학생이 있어요.</p>}
      {query["roster-error"] === "import-failed" && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">명단을 저장하지 못했어요. 미리보기부터 다시 확인해 주세요.</p>}

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

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-foreground">학생 명단</h2>
            <p className="mt-1 text-sm text-muted">학생 번호와 이름을 직접 추가·수정할 수 있어요.</p>
          </div>
          <span className="text-sm text-muted">총 {students?.length ?? 0}명</span>
        </div>

        <form action={addStudent} className="mt-5 grid gap-3 rounded-xl bg-background p-4 md:grid-cols-[120px_1fr_auto]">
          <input type="hidden" name="classId" value={classItem.id} />
          <label className="grid gap-1.5 text-sm font-medium text-foreground">번호<input required name="studentNumber" type="number" step="1" inputMode="numeric" className="rounded-lg border border-border bg-surface px-3 py-2" /></label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">이름<input required name="name" className="rounded-lg border border-border bg-surface px-3 py-2" /></label>
          <button type="submit" className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700"><UserPlus className="h-4 w-4" /> 학생 추가</button>
        </form>

        {students && students.length > 0 ? (
          <div className="mt-4 space-y-3">
            {students.map((student) => (
              <form key={student.id} action={updateStudent} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[120px_1fr_auto_auto] md:items-end">
                <input type="hidden" name="classId" value={classItem.id} />
                <input type="hidden" name="studentId" value={student.id} />
                <label className="grid gap-1.5 text-sm font-medium text-foreground">번호<input required name="studentNumber" type="number" step="1" inputMode="numeric" defaultValue={student.student_number} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">이름<input required name="name" defaultValue={student.name} className="rounded-lg border border-border bg-background px-3 py-2" /></label>
                <label className="flex h-10 items-center gap-2 text-sm text-foreground"><input name="isActive" type="checkbox" defaultChecked={student.is_active} /> 활성 학생</label>
                <button type="submit" className="rounded-lg border border-brand-600 px-4 py-2.5 text-sm font-bold text-brand-700 hover:bg-brand-50">저장</button>
              </form>
            ))}
          </div>
        ) : (
          <div className="mt-4"><EmptyState icon={<Users className="h-6 w-6" />} title="등록된 학생이 없어요" description="위 양식에서 번호와 이름을 입력해 첫 학생을 추가해 주세요." /></div>
        )}
      </section>

      <RosterImportPanel classId={classItem.id} />
    </div>
  );
}
