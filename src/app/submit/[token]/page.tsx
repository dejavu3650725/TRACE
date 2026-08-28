import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { StudentSubmitFlow } from "@/features/submit/StudentSubmitFlow";

export const metadata: Metadata = { title: "과제 제출" };
export const dynamic = "force-dynamic";

/**
 * 학생 제출 /submit/[token] (TRD §42.1) — Student Submit Layout
 * Teacher App Shell을 사용하지 않는다. 모바일 우선.
 * Flow: Activity 안내 → Class Code → 번호+이름 → 서버 검증 → 촬영/미리보기 → 제출
 * 학생 브라우저는 Teacher Data Access를 받지 않는다. /api/public/submission/* 서버 검증만 사용 (TRD §30.4).
 * Owner: INPUT (ISSUE-17~20)
 */
export default async function SubmitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // 안내용 최소 조회 — 활동 제목과 OPEN 여부만. 학생/교사 정보는 내려보내지 않는다.
  let activityTitle: string | null = null;
  let isOpen = false;
  try {
    const supabase = createAdminClient();
    const { data: assignment } = await supabase
      .from("activity_assignments")
      .select("status, activities ( title )")
      .eq("submission_token", token)
      .maybeSingle();
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const one = (v: any) => (Array.isArray(v) ? v[0] : v);
    if (assignment) {
      isOpen = assignment.status === "OPEN";
      activityTitle = one(assignment.activities)?.title ?? null;
    }
  } catch (error) {
    console.error("[submit] token lookup failed", error);
  }

  if (!activityTitle || !isOpen) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-lg font-bold text-foreground">지금은 제출할 수 없어요</h1>
        <p className="text-sm leading-relaxed text-muted">
          제출 기간이 끝났거나 링크가 더 이상 유효하지 않아요.
          <br />
          선생님께 새 QR을 요청해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-bold text-foreground">{activityTitle}</h1>
      <p className="mt-1 text-sm text-muted">선생님이 알려준 학급 코드와 본인 번호·이름을 입력해 주세요.</p>
      <div className="mt-6">
        <StudentSubmitFlow token={token} />
      </div>
    </div>
  );
}
