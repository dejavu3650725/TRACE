import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * ISSUE-19 — 제출 완료 확정
 * 사진이 1장 이상 업로드된 Submission만 READY_FOR_PROCESS로 전환한다.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const submissionId = String(body?.submission_id ?? "");
  const sessionCode = String(body?.session_code ?? "");
  if (!submissionId || !sessionCode) {
    return NextResponse.json({ ok: false, message: "잘못된 요청이에요." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: submission } = await supabase
    .from("submissions")
    .select("id, submission_code, activity_assignments ( status )")
    .eq("id", submissionId)
    .maybeSingle();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  if (
    !submission ||
    submission.submission_code !== sessionCode ||
    one(submission.activity_assignments)?.status !== "OPEN"
  ) {
    return NextResponse.json({ ok: false, message: "제출 세션이 만료됐어요." }, { status: 403 });
  }

  const { count } = await supabase
    .from("artifacts")
    .select("id", { count: "exact", head: true })
    .eq("submission_id", submissionId)
    .eq("artifact_role", "ORIGINAL");
  if (!count) {
    return NextResponse.json({ ok: false, message: "업로드된 사진이 없어요." }, { status: 400 });
  }

  const { error } = await supabase
    .from("submissions")
    .update({
      input_status: "READY_FOR_PROCESS",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", submissionId);
  if (error) {
    return NextResponse.json({ ok: false, message: "제출 확정에 실패했어요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, page_count: count });
}
