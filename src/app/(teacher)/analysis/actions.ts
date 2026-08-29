"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSessionTeacher } from "@/lib/auth/teacher";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("code" in error)) return "UNKNOWN";
  return String(error.code);
}

/**
 * 교사가 올린 Batch PDF가 연결된 한 ActivityAssignment의 AI 초안을 일괄 승인한다.
 * 승인 단위는 계속 Analysis 전체이며, Review와 Audit은 Analysis마다 각각 기록한다.
 */
export async function approveBatchAnalyses(formData: FormData): Promise<never> {
  const assignmentId = String(formData.get("activity_assignment_id") ?? "").trim();
  if (!UUID_PATTERN.test(assignmentId)) redirect("/analysis?batchError=1");

  const { teacher, supabase } = await requireSessionTeacher();

  const { data: assignment, error: assignmentError } = await supabase
    .from("activity_assignments")
    .select("id, activity_id, class_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (assignmentError || !assignment) redirect("/analysis?batchError=1");

  const [{ data: activity }, { data: classItem }] = await Promise.all([
    supabase
      .from("activities")
      .select("id")
      .eq("id", assignment.activity_id)
      .eq("teacher_id", teacher.id)
      .maybeSingle(),
    supabase
      .from("classes")
      .select("id")
      .eq("id", assignment.class_id)
      .eq("teacher_id", teacher.id)
      .maybeSingle(),
  ]);
  if (!activity || !classItem) redirect("/analysis?batchError=1");

  const { data: submissions, error: submissionError } = await supabase
    .from("submissions")
    .select("id")
    .eq("activity_assignment_id", assignmentId)
    .limit(100);
  if (submissionError || !submissions?.length) redirect("/analysis?batchError=1");
  const submissionIds = submissions.map((submission) => submission.id);

  // 일반 제출물까지 일괄 승인되지 않도록 Teacher-owned Batch PDF 연결을 서버에서 재확인한다.
  const { data: ranges, error: rangeError } = await supabase
    .from("artifacts")
    .select("source_artifact_id")
    .in("submission_id", submissionIds)
    .eq("artifact_role", "DERIVED")
    .not("source_artifact_id", "is", null);
  if (rangeError) redirect("/analysis?batchError=1");
  const sourceIds = [...new Set((ranges ?? []).flatMap((range) => (
    range.source_artifact_id ? [range.source_artifact_id] : []
  )))];
  if (sourceIds.length === 0) redirect("/analysis?batchError=1");

  const { count: batchSourceCount, error: sourceError } = await supabase
    .from("artifacts")
    .select("id", { count: "exact", head: true })
    .in("id", sourceIds)
    .eq("owner_teacher_id", teacher.id)
    .eq("artifact_role", "ORIGINAL")
    .eq("mime_type", "application/pdf")
    .is("submission_id", null)
    .is("source_artifact_id", null);
  if (sourceError || !batchSourceCount) redirect("/analysis?batchError=1");

  const { data: analyses, error: analysisError } = await supabase
    .from("analyses")
    .select("id, submission_id, status")
    .in("submission_id", submissionIds)
    .in("status", ["AI_DRAFT", "TEACHER_REVIEW"])
    .order("created_at", { ascending: true })
    .limit(100);
  if (analysisError) redirect("/analysis?batchError=1");
  if (!analyses?.length) redirect("/analysis?batchApproved=0");

  let approvedCount = 0;
  let failedCount = 0;

  for (const analysis of analyses) {
    const { data: submission } = await supabase
      .from("submissions")
      .select("process_status")
      .eq("id", analysis.submission_id)
      .maybeSingle();
    if (!submission) {
      failedCount += 1;
      continue;
    }

    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .insert({
        analysis_id: analysis.id,
        reviewer_id: teacher.id,
        decision: "APPROVED",
        teacher_edits: null,
      })
      .select("id")
      .single();
    if (reviewError || !review) {
      failedCount += 1;
      console.error(`Batch Analysis approval failed [${errorCode(reviewError)}]`);
      continue;
    }

    let analysisUpdated = false;
    let submissionUpdated = false;
    try {
      const { data: updatedAnalysis, error: updateAnalysisError } = await supabase
        .from("analyses")
        .update({ status: "APPROVED" })
        .eq("id", analysis.id)
        .eq("status", analysis.status)
        .select("id")
        .maybeSingle();
      if (updateAnalysisError || !updatedAnalysis) throw updateAnalysisError ?? new Error("Analysis state changed");
      analysisUpdated = true;

      const { data: updatedSubmission, error: updateSubmissionError } = await supabase
        .from("submissions")
        .update({ process_status: "APPROVED" })
        .eq("id", analysis.submission_id)
        .eq("process_status", submission.process_status)
        .select("id")
        .maybeSingle();
      if (updateSubmissionError || !updatedSubmission) throw updateSubmissionError ?? new Error("Submission state changed");
      submissionUpdated = true;

      const { error: auditError } = await supabase.rpc("record_analysis_event", {
        p_action: "ANALYSIS_APPROVE",
        p_entity_type: "analysis",
        p_entity_id: analysis.id,
        p_request_id: randomUUID(),
      });
      // 승인 데이터가 정상 저장된 뒤 선택적 PROCESS 감사 기록의 배포 지연이
      // 교사의 승인 자체를 되돌리지 않도록 격리한다. 0015 적용 후 자동 복구된다.
      if (auditError) {
        console.error(`Batch Analysis audit record failed [${errorCode(auditError)}]`);
      }

      approvedCount += 1;
    } catch (error) {
      // 한 학생의 실패가 나머지 학생 승인을 막지 않도록 해당 건만 원래 상태로 되돌린다.
      if (submissionUpdated) {
        await supabase
          .from("submissions")
          .update({ process_status: submission.process_status })
          .eq("id", analysis.submission_id);
      }
      if (analysisUpdated) {
        await supabase.from("analyses").update({ status: analysis.status }).eq("id", analysis.id);
      }
      await supabase.from("reviews").delete().eq("id", review.id);
      failedCount += 1;
      console.error(`Batch Analysis approval failed [${errorCode(error)}]`);
    }
  }

  revalidatePath("/analysis");
  revalidatePath("/results");
  revalidatePath("/reports");

  if (failedCount > 0) {
    redirect(`/analysis?batchApproved=${approvedCount}&batchError=1`);
  }
  redirect(`/analysis?batchApproved=${approvedCount}`);
}
