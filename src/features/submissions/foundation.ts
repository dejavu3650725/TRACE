import "server-only";

import { z } from "zod";
import { requireTeacherOwnership } from "@/lib/auth/ownership";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import type { InputStatus, ProcessStatus } from "@/shared/types/status";

const submissionRelationSchema = z.object({
  studentId: z.string().uuid(),
  activityAssignmentId: z.string().uuid(),
});

export type SubmissionFoundationRecord = {
  id: string;
  studentId: string;
  activityAssignmentId: string;
  inputStatus: InputStatus;
  processStatus: ProcessStatus;
  currentAttemptNo: number;
};

/**
 * Creates or re-reads the one logical Submission for a Student/Assignment pair.
 * Existing status, StructuredInput, attempt and Artifact relations are never reset.
 */
export async function getOrCreateSubmission(input: {
  studentId: string;
  activityAssignmentId: string;
}): Promise<SubmissionFoundationRecord> {
  const parsed = submissionRelationSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid Submission relation IDs");

  await Promise.all([
    requireTeacherOwnership("student", parsed.data.studentId),
    requireTeacherOwnership("activityAssignment", parsed.data.activityAssignmentId),
  ]);

  const { supabase } = await requireSessionTeacher();
  const { data: submissionId, error: rpcError } = await supabase.rpc("get_or_create_submission", {
    p_student_id: parsed.data.studentId,
    p_activity_assignment_id: parsed.data.activityAssignmentId,
  });
  if (rpcError || typeof submissionId !== "string") {
    throw new Error("Submission could not be created or retrieved", { cause: rpcError });
  }

  const { data: submission, error: readError } = await supabase
    .from("submissions")
    .select("id, student_id, activity_assignment_id, input_status, process_status, current_attempt_no")
    .eq("id", submissionId)
    .eq("student_id", parsed.data.studentId)
    .eq("activity_assignment_id", parsed.data.activityAssignmentId)
    .maybeSingle();
  if (readError || !submission) {
    throw new Error("Submission relation did not survive DB re-read", { cause: readError });
  }

  return {
    id: submission.id,
    studentId: submission.student_id,
    activityAssignmentId: submission.activity_assignment_id,
    inputStatus: submission.input_status as InputStatus,
    processStatus: submission.process_status as ProcessStatus,
    currentAttemptNo: submission.current_attempt_no,
  };
}
