import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { BatchPdfInspectionPanel } from "@/features/artifacts/BatchPdfInspectionPanel";
import { requireTeacherOwnership } from "@/lib/auth/ownership";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { STORAGE } from "@/lib/config";

export const metadata: Metadata = { title: "Batch PDF 페이지 검사" };
export const dynamic = "force-dynamic";

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
  const [{ data: artifact, error: artifactError }, { data: rangeRows, error: rangeError }] = await Promise.all([
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
      .select("id, page_start, page_end")
      .eq("owner_teacher_id", teacher.id)
      .is("submission_id", null)
      .eq("source_artifact_id", artifactId)
      .eq("artifact_role", "DERIVED")
      .order("page_start", { ascending: true }),
  ]);
  if (artifactError || rangeError) throw new Error("Batch PDF inspection data could not be loaded", { cause: artifactError ?? rangeError });
  if (!artifact || artifact.page_start !== 1 || !artifact.page_end) notFound();

  const { data: signed, error: signedError } = await supabase.storage
    .from(STORAGE.BUCKET)
    .createSignedUrl(artifact.storage_path, 300);
  if (signedError || !signed?.signedUrl) throw new Error("Batch PDF signed URL could not be created", { cause: signedError });

  const ranges = (rangeRows ?? []).flatMap((range) => (
    typeof range.page_start === "number" && typeof range.page_end === "number"
      ? [{ id: range.id, page_start: range.page_start, page_end: range.page_end }]
      : []
  ));

  return (
    <div className="space-y-6">
      <Link href="/results/upload" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" /> 일괄 업로드로 돌아가기</Link>
      <PageHeader title="Batch PDF 페이지 검사" description="원본 PDF를 보면서 학생 활동지 단위의 페이지 구간만 지정합니다." />
      <BatchPdfInspectionPanel
        artifactId={artifact.id}
        fileName={artifact.file_name}
        pageCount={artifact.page_end}
        initialSignedUrl={signed.signedUrl}
        initialRanges={ranges}
      />
    </div>
  );
}
