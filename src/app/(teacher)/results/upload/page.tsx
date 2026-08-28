import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import {
  TeacherArtifactUploadPanel,
  type ArtifactUploadAssignmentOption,
  type ArtifactUploadStudentOption,
  type RecentTeacherArtifact,
} from "@/features/artifacts/TeacherArtifactUploadPanel";
import {
  BatchPdfUploadPanel,
  type RecentBatchPdf,
} from "@/features/artifacts/BatchPdfUploadPanel";

export const metadata: Metadata = { title: "일괄 업로드" };
export const dynamic = "force-dynamic";

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Teacher original Artifact upload. OCR/VLM and matching automation are later issues. */
export default async function ResultsUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const isScan = mode === "scan";

  if (isScan) {
    return (
      <div className="space-y-6">
        <PageHeader title="카메라로 연속 촬영" description="종이 활동지를 카메라 앞에 들면 자동으로 촬영돼요." />
        <EmptyState title="촬영 기능 준비 중" description="자동 촬영은 후속 이슈에서 같은 원본 저장 경로에 연결합니다." />
      </div>
    );
  }

  const { supabase } = await requireSessionTeacher();
  const [assignmentResult, studentResult, artifactResult, batchResult] = await Promise.all([
    supabase
      .from("activity_assignments")
      .select("id, class_id, status, activities!inner(title), classes!inner(name)")
      .neq("status", "ARCHIVED")
      .order("created_at", { ascending: false }),
    supabase
      .from("students")
      .select("id, class_id, student_number, name")
      .eq("is_active", true)
      .order("student_number", { ascending: true }),
    supabase
      .from("artifacts")
      .select(`
        id, file_name, mime_type, file_size_bytes, created_at,
        submissions!inner(
          students!inner(name, student_number),
          activity_assignments!inner(
            activities!inner(title),
            classes!inner(name)
          )
        )
      `)
      .eq("artifact_role", "ORIGINAL")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("artifacts")
      .select("id, file_name, page_end, created_at")
      .is("submission_id", null)
      .not("owner_teacher_id", "is", null)
      .is("source_artifact_id", null)
      .eq("artifact_role", "ORIGINAL")
      .eq("mime_type", "application/pdf")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (assignmentResult.error) throw new Error("ActivityAssignment upload options could not be loaded", { cause: assignmentResult.error });
  if (studentResult.error) throw new Error("Student upload options could not be loaded", { cause: studentResult.error });
  if (artifactResult.error) throw new Error("Recent ORIGINAL Artifacts could not be loaded", { cause: artifactResult.error });
  if (batchResult.error) throw new Error("Recent Batch PDFs could not be loaded", { cause: batchResult.error });

  /* Supabase relation inference can return a row or a one-row array. */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const assignments: ArtifactUploadAssignmentOption[] = (assignmentResult.data ?? []).map((row: any) => {
    const activity = one(row.activities as { title: string } | { title: string }[] | null);
    const classItem = one(row.classes as { name: string } | { name: string }[] | null);
    return {
      id: row.id,
      classId: row.class_id,
      label: `${activity?.title ?? "활동 미상"} · ${classItem?.name ?? "학급 미상"}`,
    };
  });
  const students: ArtifactUploadStudentOption[] = (studentResult.data ?? []).map((row) => ({
    id: row.id,
    classId: row.class_id,
    studentNumber: row.student_number,
    name: row.name,
  }));
  const recentArtifacts: RecentTeacherArtifact[] = (artifactResult.data ?? []).map((row: any) => {
    const submission = one(row.submissions);
    const student = one(submission?.students);
    const assignment = one(submission?.activity_assignments);
    const activity = one(assignment?.activities);
    const classItem = one(assignment?.classes);
    return {
      id: row.id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      createdAt: row.created_at,
      studentLabel: student ? `${student.student_number}번 ${student.name}` : "학생 미상",
      assignmentLabel: `${activity?.title ?? "활동 미상"} · ${classItem?.name ?? "학급 미상"}`,
    };
  });
  const recentBatches: RecentBatchPdf[] = (batchResult.data ?? []).flatMap((row) => (
    typeof row.page_end === "number"
      ? [{ id: row.id, fileName: row.file_name, pageCount: row.page_end, createdAt: row.created_at }]
      : []
  ));
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <div className="space-y-6">
      <PageHeader
        title="일괄 업로드"
        description="학생과 활동을 확인한 뒤 이미지·PDF 원본을 비공개로 저장해요. 분석은 실행하지 않습니다."
      />
      <BatchPdfUploadPanel recentBatches={recentBatches} />
      <TeacherArtifactUploadPanel assignments={assignments} students={students} recentArtifacts={recentArtifacts} />
    </div>
  );
}
