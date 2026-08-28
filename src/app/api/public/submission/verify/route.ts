import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isClassCodeActive } from "@/features/classes/class-code";
import { RATE_LIMIT } from "@/lib/config";

export const runtime = "nodejs";

/**
 * ISSUE-18 — Public Student Verification API
 * 학생 브라우저는 roster를 절대 직접 조회하지 않는다. 서버가 service_role로 대신 확인한다.
 * 보안 계약:
 * - 모든 실패는 동일 문구 하나로만 응답 (번호/이름 어느 쪽이 틀렸는지 노출 금지)
 * - roster 내용 반환 금지, 검증 성공 전 Submission 생성 금지
 * - 동일 IP+token 10분 창 내 실패 10회 → 차단 (config RATE_LIMIT)
 */

const UNIFORM_FAIL = "입력한 정보가 학급 정보와 일치하지 않습니다.";
const RATE_LIMITED = "시도 횟수가 많아 잠시 후 다시 시도할 수 있어요.";

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : null)?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  let body: {
    token?: string;
    class_code?: string;
    student_number?: number | string;
    student_name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: UNIFORM_FAIL }, { status: 400 });
  }

  const token = String(body.token ?? "").trim();
  const classCode = String(body.class_code ?? "").trim().toUpperCase();
  const studentNumber = Number(body.student_number);
  const studentName = String(body.student_name ?? "").trim();
  if (!token || !classCode || !Number.isInteger(studentNumber) || !studentName) {
    return NextResponse.json({ ok: false, message: UNIFORM_FAIL }, { status: 400 });
  }

  const supabase = createAdminClient();
  const ip = clientIp(req);

  // ── Rate limit: 차단 창(10분) 내 실패 수 확인 ──
  const blockWindowStart = new Date(
    Date.now() - RATE_LIMIT.VERIFY_BLOCK_MINUTES * 60 * 1000,
  ).toISOString();
  const { count: recentFailures } = await supabase
    .from("public_verify_attempts")
    .select("id", { count: "exact", head: true })
    .eq("submission_token", token)
    .eq("ip", ip)
    .eq("success", false)
    .gte("created_at", blockWindowStart);
  if ((recentFailures ?? 0) >= RATE_LIMIT.VERIFY_MAX_FAILURES) {
    return NextResponse.json({ ok: false, message: RATE_LIMITED }, { status: 429 });
  }

  const fail = async (status = 400) => {
    await supabase
      .from("public_verify_attempts")
      .insert({ ip, submission_token: token, success: false });
    return NextResponse.json({ ok: false, message: UNIFORM_FAIL }, { status });
  };

  // 1) token → ActivityAssignment (+ Activity 제목, Class)
  const { data: assignment } = await supabase
    .from("activity_assignments")
    .select(
      `id, status, class_id,
       activities ( title ),
       classes ( id, name, teacher_id, class_code, class_code_expires_at )`,
    )
    .eq("submission_token", token)
    .maybeSingle();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  const cls = assignment ? one(assignment.classes) : null;
  if (!assignment || !cls) return fail();

  // 2) Assignment OPEN
  if (assignment.status !== "OPEN") return fail();

  // 3) Class Code 유효 (현재 코드 + 만료 전)
  if (cls.class_code !== classCode || !isClassCodeActive(cls.class_code, cls.class_code_expires_at)) {
    return fail();
  }

  // 4) 번호 + 이름 정확 일치 (해당 학급 안에서만)
  const { data: student } = await supabase
    .from("students")
    .select("id, name, student_number")
    .eq("class_id", assignment.class_id)
    .eq("student_number", studentNumber)
    .maybeSingle();
  if (!student || student.name !== studentName) return fail();

  // ── 성공: Submission get-or-create + 세션 코드 발급 ──
  await supabase.from("public_verify_attempts").insert({ ip, submission_token: token, success: true });

  const sessionCode = randomBytes(16).toString("base64url");
  const { data: existing } = await supabase
    .from("submissions")
    .select("id")
    .eq("student_id", student.id)
    .eq("activity_assignment_id", assignment.id)
    .maybeSingle();

  let submissionId: string;
  if (existing) {
    submissionId = existing.id;
    const { error } = await supabase
      .from("submissions")
      .update({ submission_code: sessionCode, input_status: "UPLOADING" })
      .eq("id", existing.id);
    if (error) return fail(500);
  } else {
    const { data: created, error } = await supabase
      .from("submissions")
      .insert({
        student_id: student.id,
        activity_assignment_id: assignment.id,
        submission_code: sessionCode,
        input_status: "UPLOADING",
      })
      .select("id")
      .single();
    if (error || !created) return fail(500);
    submissionId = created.id;
  }

  return NextResponse.json({
    ok: true,
    submission_id: submissionId,
    session_code: sessionCode,
    activity_title: one(assignment.activities)?.title ?? "활동",
    student_display: `${student.student_number}번 ${student.name}`,
  });
}
