"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { StructuredInputRuntimeSchema } from "@/features/submissions/structured-input-schema";
import { requireTeacherOwnership } from "@/lib/auth/ownership";
import { requireSessionTeacher } from "@/lib/auth/teacher";

const resolveInputReviewSchema = z.object({
  submissionId: z.string().uuid(),
  studentId: z.string().uuid(),
  activityAssignmentId: z.string().uuid(),
  structuredInput: StructuredInputRuntimeSchema,
});

export type ResolveInputReviewResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function resolveSubmissionInputReview(
  input: z.input<typeof resolveInputReviewSchema>,
): Promise<ResolveInputReviewResult> {
  const parsed = resolveInputReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "학생·활동·인식 응답을 다시 확인해 주세요." };
  }

  try {
    await Promise.all([
      requireTeacherOwnership("submission", parsed.data.submissionId),
      requireTeacherOwnership("student", parsed.data.studentId),
      requireTeacherOwnership("activityAssignment", parsed.data.activityAssignmentId),
    ]);
  } catch {
    return { ok: false, message: "이 제출·학생·활동을 수정할 권한을 확인하지 못했어요." };
  }

  const { supabase } = await requireSessionTeacher();
  const { data, error } = await supabase.rpc("resolve_submission_input_review", {
    p_submission_id: parsed.data.submissionId,
    p_student_id: parsed.data.studentId,
    p_activity_assignment_id: parsed.data.activityAssignmentId,
    p_structured_input: parsed.data.structuredInput,
  });
  const committed = z.object({
    submission_id: z.string().uuid(),
    input_status: z.literal("READY_FOR_PROCESS"),
    process_status: z.literal("READY_TO_ANALYZE"),
  }).safeParse(data);

  if (error || !committed.success) {
    const code = error?.code ?? "INVALID_RPC_RESPONSE";
    console.error(`Submission INPUT review resolution failed [${code}]`);
    if (code === "PGRST202" || code === "42883") {
      return { ok: false, message: "원격 DB에 검토 해결 기능이 아직 적용되지 않았어요. 0014 마이그레이션을 적용해 주세요." };
    }
    if (code === "23505") {
      return { ok: false, message: "선택한 학생에게 이미 이 활동의 제출 결과가 있어요." };
    }
    if (code === "42501") {
      return { ok: false, message: "학생과 활동이 같은 학급에 속하는지 확인해 주세요." };
    }
    return { ok: false, message: "검토 결과를 저장하지 못했어요. 원본과 인식 응답을 다시 확인해 주세요." };
  }

  revalidatePath("/results");
  revalidatePath(`/results/${parsed.data.submissionId}`);
  return { ok: true, message: "검토를 반영했고 분석 준비 상태로 전환했어요." };
}
