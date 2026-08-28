import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { ResultImportPanel, type AssignmentOption } from "@/features/submissions/ResultImportPanel";

export const metadata: Metadata = { title: "결과 가져오기" };
export const dynamic = "force-dynamic";

/**
 * CSV/XLSX Result Import (TRD §21, ISSUE-21/22)
 * Template 다운로드 → 업로드 → Validation → Preview → Roster Match → 확정 저장
 */
export default async function ResultsImportPage() {
  const hasSupabaseEnv = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY),
  );

  let assignments: AssignmentOption[] = [];
  if (hasSupabaseEnv) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("activity_assignments")
      .select("id, status, activities ( title ), classes ( name )")
      .in("status", ["OPEN", "CLOSED"])
      .order("created_at", { ascending: false })
      .limit(50);
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const one = (v: any) => (Array.isArray(v) ? v[0] : v);
    assignments = (data ?? []).map((a: any) => ({
      id: a.id as string,
      label: `${one(a.classes)?.name ?? "학급"} · ${one(a.activities)?.title ?? "활동"}${
        a.status === "CLOSED" ? " (마감됨)" : ""
      }`,
    }));
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="결과 가져오기"
        description="TRACE 표준 CSV/XLSX 템플릿으로 작성한 결과를 검증하고 미리 본 뒤 저장해요."
      />
      {!hasSupabaseEnv ? (
        <EmptyState title="환경 변수 설정이 필요해요" description=".env에 Supabase 설정을 넣은 뒤 다시 실행해 주세요." />
      ) : (
        <ResultImportPanel assignments={assignments} />
      )}
    </div>
  );
}
