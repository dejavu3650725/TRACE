import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { BatchPdfInspectionPanel } from "@/features/artifacts/BatchPdfInspectionPanel";
import { requireTeacherOwnership } from "@/lib/auth/ownership";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { STORAGE } from "@/lib/config";

export const metadata: Metadata = { title: "PDF 학생·답안 연결" };
export const dynamic = "force-dynamic";

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function BatchPdfInspectionPage({
  params,
}: {
  params: Promise<{ artifactId: string }>;
}) {
  const { artifactId } = await params;
  try {
    await requireTeacherOwnership("artifact", artifactId);
  } catch {
    notFound();
  }

  const { teacher, supabase } = await requireSessionTeacher();
  const [
    { data: artifact, error: artifactError },
    { data: rangeRows, error: rangeError },
    { data: assignmentRows, error: assignmentError },
    { data: classRows, error: classListError },
  ] = await Promise.all([
    supabase
      .from("artifacts")
      .select("id, owner_teacher_id, submission_id, source_artifact_id, file_name, mime_type, storage_path, artifact_role, page_start, page_end")
      .eq("id", artifactId)
      .eq("owner_teacher_id", teacher.id)
      .is("submission_id", null)
      .is("source_artifact_id", null)
      .eq("artifact_role", "ORIGINAL")
      .eq("mime_type", "application/pdf")
      .maybeSingle(),
    supabase
      .from("artifacts")
      .select("id, submission_id, owner_teacher_id, page_start, page_end, submissions(input_status)")
      .eq("source_artifact_id", artifactId)
      .eq("artifact_role", "DERIVED")
      .order("page_start", { ascending: true }),
    supabase
      .from("activity_assignments")
      .select("id, class_id, status, activities!inner(title), classes!inner(name)")
      .neq("status", "ARCHIVED")
      .order("created_at", { ascending: false }),
    supabase
      .from("classes")
      .select("id, name, grade")
      .eq("teacher_id", teacher.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);
  if (artifactError || rangeError || assignmentError || classListError) {
    throw new Error("Batch PDF inspection data could not be loaded", { cause: artifactError ?? rangeError ?? assignmentError ?? classListError });
  }
  if (!artifact || artifact.page_start !== 1 || !artifact.page_end) notFound();

  const activeClassIds = (classRows ?? []).map((classItem) => classItem.id);
  const { data: studentRows, error: studentError } = activeClassIds.length > 0
    ? await supabase
      .from("students")
      .select("id, class_id, student_number, name")
      .in("class_id", activeClassIds)
      .eq("is_active", true)
      .order("student_number", { ascending: true })
    : { data: [], error: null };
  if (studentError) throw new Error("Batch correction roster could not be loaded", { cause: studentError });

  const { data: signed, error: signedError } = await supabase.storage
    .from(STORAGE.BUCKET)
    .createSignedUrl(artifact.storage_path, 300);
  if (signedError || !signed?.signedUrl) throw new Error("Batch PDF signed URL could not be created", { cause: signedError });

  const ranges = (rangeRows ?? []).flatMap((range) => (
    typeof range.page_start === "number" && typeof range.page_end === "number"
      ? [{
          id: range.id,
          page_start: range.page_start,
          page_end: range.page_end,
          submissionId: range.submission_id,
        }]
      : []
  ));
  const reviewSubmissionIds = (rangeRows ?? []).flatMap((range) => {
    const submission = one(range.submissions as { input_status: string } | { input_status: string }[] | null);
    return range.submission_id && submission?.input_status === "REVIEW_PENDING"
      ? [range.submission_id]
      : [];
  });
  const assignments = (assignmentRows ?? []).map((assignment) => {
    const activity = one(assignment.activities as { title: string } | { title: string }[] | null);
    const classItem = one(assignment.classes as { name: string } | { name: string }[] | null);
    return {
      id: assignment.id,
      classId: assignment.class_id,
      label: `${activity?.title ?? "활동 미상"} · ${classItem?.name ?? "학급 미상"}`,
      students: (studentRows ?? [])
        .filter((student) => student.class_id === assignment.class_id)
        .map((student) => ({
          id: student.id,
          studentNumber: student.student_number,
          studentName: student.name,
        })),
    };
  });
  const classes = (classRows ?? []).map((classItem) => ({
    id: classItem.id,
    label: `${classItem.name}${classItem.grade ? ` · ${classItem.grade}학년` : ""}`,
    students: (studentRows ?? [])
      .filter((student) => student.class_id === classItem.id)
      .map((student) => ({
        id: student.id,
        studentNumber: student.student_number,
        studentName: student.name,
      })),
  }));

  return (
    <div className="space-y-6">
      <Link href="/results/upload" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> 일괄 업로드로 돌아가기</Link>
      <PageHeader title="PDF 학생·답안 연결" description="오늘 활동 PDF에서 활동을 확인하고, 학생의 반·번호·이름과 작성 답안을 우리 반 명단에 연결합니다." />
      <BatchPdfInspectionPanel
        artifactId={artifact.id}
        fileName={artifact.file_name}
        pageCount={artifact.page_end}
        initialSignedUrl={signed.signedUrl}
        initialRanges={ranges}
        initialReviewSubmissionIds={reviewSubmissionIds}
        assignments={assignments}
        classes={classes}
      />
    </div>
  );
}
