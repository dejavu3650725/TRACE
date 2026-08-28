"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { requireSessionTeacher } from "@/lib/auth/teacher";

/**
 * ISSUE-17 — Submission Token 발급/재발급/회수
 * - opaque random token (base64url 18B ≈ 144bit): Assignment만 식별, 학생/교사 정보 없음
 * - CLOSED/ARCHIVED 배정은 발급 거부
 */
async function loadOwnedAssignment(assignmentId: string) {
  const { teacher, supabase } = await requireSessionTeacher();
  const { data: assignment } = await supabase
    .from("activity_assignments")
    .select("id, status, activity_id, classes ( teacher_id ), activities ( teacher_id )")
    .eq("id", assignmentId)
    .maybeSingle();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  const ownerOk =
    assignment &&
    (one(assignment.activities)?.teacher_id === teacher.id ||
      one(assignment.classes)?.teacher_id === teacher.id);
  if (!assignment || !ownerOk) return { supabase, assignment: null };
  return { supabase, assignment };
}

export async function issueSubmissionToken(formData: FormData) {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const activityId = String(formData.get("activityId") ?? "");
  const { supabase, assignment } = await loadOwnedAssignment(assignmentId);
  if (!assignment) redirect(`/activities/${activityId}/assign?assignment-error=save-failed`);
  if (assignment.status !== "OPEN") {
    redirect(`/activities/${activityId}/assign?assignment-error=token-closed`);
  }

  const token = randomBytes(18).toString("base64url");
  const { error } = await supabase
    .from("activity_assignments")
    .update({ submission_token: token })
    .eq("id", assignmentId);
  if (error) redirect(`/activities/${activityId}/assign?assignment-error=save-failed`);
  redirect(`/activities/${activityId}/assign?token=issued`);
}

export async function revokeSubmissionToken(formData: FormData) {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const activityId = String(formData.get("activityId") ?? "");
  const { supabase, assignment } = await loadOwnedAssignment(assignmentId);
  if (!assignment) redirect(`/activities/${activityId}/assign?assignment-error=save-failed`);

  const { error } = await supabase
    .from("activity_assignments")
    .update({ submission_token: null })
    .eq("id", assignmentId);
  if (error) redirect(`/activities/${activityId}/assign?assignment-error=save-failed`);
  redirect(`/activities/${activityId}/assign?token=revoked`);
}
