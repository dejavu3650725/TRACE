import "server-only";

import type { ServerSupabaseClient } from "@/lib/auth/teacher";
import { STORAGE } from "@/lib/config";
import {
  buildProcessHandoffContexts,
  ProcessHandoffContractError,
  type ProcessHandoffArtifactRecord,
  type ProcessHandoffSourceRecord,
  type ProcessHandoffSubmissionRecord,
} from "./handoff-contract";

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function resolveProcessHandoff(
  supabase: ServerSupabaseClient,
  teacherId: string,
  submissionIds: readonly string[],
) {
  const { data, error } = await supabase
    .from("submissions")
    .select(`
      id, student_id, activity_assignment_id, structured_input, input_status, process_status,
      students!inner(
        id, class_id,
        classes!inner(id, teacher_id)
      ),
      activity_assignments!inner(
        id, class_id, activity_id,
        classes!inner(id, teacher_id),
        activities!inner(
          id, teacher_id, title, description,
          activity_standards(standard_id)
        )
      )
    `)
    .in("id", [...submissionIds]);
  if (error) throw new ProcessHandoffContractError("READ_FAILED", "Shared Submission graph lookup failed");

  /* Supabase relation inference can return a row or a one-row array. */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const submissions: ProcessHandoffSubmissionRecord[] = (data ?? []).flatMap((row: any) => {
    const student = one(row.students as any);
    const studentClass = one(student?.classes as any);
    const assignment = one(row.activity_assignments as any);
    const assignmentClass = one(assignment?.classes as any);
    const activity = one(assignment?.activities as any);
    if (!student || !studentClass || !assignment || !assignmentClass || !activity) return [];
    return [{
      id: row.id,
      studentId: row.student_id,
      studentClassId: student.class_id,
      classId: assignment.class_id,
      classTeacherId: assignmentClass.teacher_id,
      assignmentId: row.activity_assignment_id,
      activityId: assignment.activity_id,
      activityTeacherId: activity.teacher_id,
      activityTitle: activity.title,
      activityDescription: activity.description,
      standardIds: (activity.activity_standards ?? []).map((standard: any) => standard.standard_id),
      structuredInput: row.structured_input,
      inputStatus: row.input_status,
      processStatus: row.process_status,
    }];
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const { data: artifactData, error: artifactError } = await supabase
    .from("artifacts")
    .select("id, submission_id, source_artifact_id, storage_path, mime_type, artifact_role, page_start, page_end")
    .in("submission_id", [...submissionIds])
    .order("created_at", { ascending: true });
  if (artifactError) throw new ProcessHandoffContractError("READ_FAILED", "Artifact reference lookup failed");

  const artifacts: ProcessHandoffArtifactRecord[] = (artifactData ?? []).map((artifact) => ({
    id: artifact.id,
    submissionId: artifact.submission_id!,
    sourceArtifactId: artifact.source_artifact_id,
    storagePath: artifact.storage_path,
    mimeType: artifact.mime_type,
    artifactRole: artifact.artifact_role,
    pageStart: artifact.page_start,
    pageEnd: artifact.page_end,
  }));
  const sourceIds = [...new Set(artifacts.flatMap((artifact) => artifact.sourceArtifactId ? [artifact.sourceArtifactId] : []))];
  let sources: ProcessHandoffSourceRecord[] = [];
  if (sourceIds.length > 0) {
    const { data: sourceData, error: sourceError } = await supabase
      .from("artifacts")
      .select("id, owner_teacher_id, storage_path, mime_type, artifact_role")
      .in("id", sourceIds);
    if (sourceError) throw new ProcessHandoffContractError("READ_FAILED", "ORIGINAL Artifact lookup failed");
    sources = (sourceData ?? []).map((source) => ({
      id: source.id,
      ownerTeacherId: source.owner_teacher_id,
      storagePath: source.storage_path,
      mimeType: source.mime_type,
      artifactRole: source.artifact_role,
    }));
  }

  const contexts = buildProcessHandoffContexts({
    requestedSubmissionIds: submissionIds,
    teacherId,
    submissions,
    artifacts,
    sources,
  });

  const originalPaths = [...new Set(contexts.flatMap((context) => (
    context.artifacts.map((artifact) => artifact.storagePath)
  )))];
  const { data: signedPaths, error: signedPathError } = await supabase.storage
    .from(STORAGE.BUCKET)
    .createSignedUrls(originalPaths, 60);
  if (
    signedPathError
    || !signedPaths
    || signedPaths.length !== originalPaths.length
    || signedPaths.some((item) => item.error || !item.signedUrl)
  ) {
    throw new ProcessHandoffContractError("NOT_READY", "Private ORIGINAL Storage object is not readable");
  }

  return contexts;
}
