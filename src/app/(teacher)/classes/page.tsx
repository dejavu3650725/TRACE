import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createClass } from "@/features/classes/actions";
import { isClassCodeActive } from "@/features/classes/class-code";
import { requireSessionTeacher } from "@/lib/auth/teacher";

export const metadata: Metadata = { title: "클래스 관리" };

/**
 * 클래스 관리 /classes (TRD §37)
 * Class 생성/조회, 학생명단 Import, Student 직접 추가/수정
 * Owner: Shared + INPUT
 */
const message = {
  "invalid-input": "학급명은 필수이며 학년은 1~12 사이여야 해요.",
} as const;

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorCode } = await searchParams;
  const { teacher, supabase } = await requireSessionTeacher();
  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, grade, subject, class_code, class_code_expires_at, updated_at")
    .eq("teacher_id", teacher.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Class list lookup failed", { cause: error });
  const inputError = errorCode && errorCode in message ? message[errorCode as keyof typeof message] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="클래스 관리"
        description="학급을 만들고 학생 명단을 등록해요. 모든 자료 수집의 기준이 돼요."
      />
      {inputError && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">{inputError}</p>}

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-base font-bold text-foreground">새 학급 만들기</h2>
        <form action={createClass} className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            학급명/반
            <input required name="name" maxLength={100} placeholder="예: 3학년 1반" className="rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            학년 <span className="font-normal text-muted">(선택)</span>
            <input name="grade" type="number" min="1" max="12" inputMode="numeric" className="rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            교과 <span className="font-normal text-muted">(선택)</span>
            <input name="subject" maxLength={100} placeholder="예: 국어" className="rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground md:col-span-2">
            <input name="issueCode" type="checkbox" defaultChecked />
            학생 제출용 클래스 코드 발급 (발급 시점부터 24시간 유효)
          </label>
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> 학급 만들기
          </button>
        </form>
      </section>

      {classes && classes.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((classItem) => {
            const codeActive = isClassCodeActive(classItem.class_code, classItem.class_code_expires_at);
            return (
              <Link key={classItem.id} href={`/classes/${classItem.id}`} className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:border-brand-400 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-foreground">{classItem.name}</h2>
                    <p className="mt-1 text-sm text-muted">{[classItem.grade ? `${classItem.grade}학년` : null, classItem.subject].filter(Boolean).join(" · ") || "학년·교과 미설정"}</p>
                  </div>
                  <Users className="h-5 w-5 text-brand-600" />
                </div>
                <div className="mt-5 flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold tracking-widest text-foreground">{classItem.class_code ?? "코드 미발급"}</span>
                  <StatusBadge label={classItem.class_code ? (codeActive ? "유효" : "만료") : "미발급"} tone={codeActive ? "success" : classItem.class_code ? "warning" : "neutral"} />
                </div>
              </Link>
            );
          })}
        </section>
      ) : (
        <EmptyState icon={<Users className="h-6 w-6" />} title="등록된 학급이 없어요" description="위 양식에서 첫 학급을 만들면 학생 명단을 등록할 수 있어요." />
      )}
    </div>
  );
}
