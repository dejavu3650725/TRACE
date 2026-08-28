"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionTeacher } from "@/lib/auth/teacher";
import { AnalysisResultSchema } from "@/features/process/schema";

export interface ReviewActionState {
  error: string | null;
}

/**
 * 분석 검토 결정 (TRD §20, §45)
 * - 승인 단위는 Analysis 전체. Evidence별 승인 없음.
 * - APPROVED / EDITED_APPROVED / REJECTED → reviews 기록 + 상태 전이 + audit_logs
 * - 반려 시 submission은 READY_TO_ANALYZE로 되돌려 재분석 가능하게 한다.
 */
export async function submitReview(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const analysisId = String(formData.get("analysis_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const editedJsonRaw = formData.get("edited_json");

  if (!analysisId || !["APPROVED", "EDITED_APPROVED", "REJECTED"].includes(decision)) {
    return { error: "잘못된 요청이에요." };
  }

  const { userId, teacher } = await getSessionTeacher();
  if (!userId || !teacher) redirect("/login");

  const supabase = await createClient();

  // 소유권 확인 (RLS 범위에서 조회되는지) + submission 연결
  const { data: analysis } = await supabase
    .from("analyses")
    .select("id, submission_id, analysis_json, status")
    .eq("id", analysisId)
    .maybeSingle();
  if (!analysis) return { error: "분석을 찾을 수 없어요." };
  if (!["AI_DRAFT", "TEACHER_REVIEW"].includes(analysis.status)) {
    return { error: "이미 검토가 끝난 분석이에요." };
  }

  // 수정 승인이면 편집본 검증 후 analysis_json 교체 (AI 원본은 teacher_edits와 함께 reviews에 남는다)
  let teacherEdits: Record<string, unknown> | null = null;
  if (decision === "EDITED_APPROVED") {
    try {
      const parsed = AnalysisResultSchema.parse(JSON.parse(String(editedJsonRaw ?? "")));
      teacherEdits = parsed;
    } catch {
      return { error: "수정한 내용의 형식이 올바르지 않아요." };
    }
  }

  const { error: reviewError } = await supabase.from("reviews").insert({
    analysis_id: analysisId,
    reviewer_id: teacher.id,
    decision,
    teacher_edits: teacherEdits,
  });
  if (reviewError) return { error: "검토 기록 저장에 실패했어요." };

  const analysisUpdate: Record<string, unknown> = { status: decision };
  if (teacherEdits) analysisUpdate.analysis_json = teacherEdits;
  await supabase.from("analyses").update(analysisUpdate).eq("id", analysisId);

  await supabase
    .from("submissions")
    .update({
      process_status: decision === "REJECTED" ? "READY_TO_ANALYZE" : "APPROVED",
    })
    .eq("id", analysis.submission_id);

  const auditAction =
    decision === "APPROVED"
      ? "ANALYSIS_APPROVE"
      : decision === "EDITED_APPROVED"
        ? "ANALYSIS_EDIT_APPROVE"
        : "ANALYSIS_REJECT";
  await supabase.from("audit_logs").insert({
    actor_teacher_id: teacher.id,
    action: auditAction,
    entity_type: "analysis",
    entity_id: analysisId,
  });

  redirect("/analysis");
}
