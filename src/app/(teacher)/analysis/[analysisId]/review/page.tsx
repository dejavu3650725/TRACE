import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { createClient } from "@/lib/supabase/server";
import { getStandards } from "@/lib/curriculum/loader";
import { STORAGE } from "@/lib/config";
import { AnalysisResultSchema } from "@/features/process/schema";
import { ReviewPanel } from "@/features/process/ReviewPanel";

export const metadata: Metadata = { title: "분석 검토" };
export const dynamic = "force-dynamic";

/**
 * Analysis Review /analysis/[analysisId]/review (TRD §45)
 * Desktop: 원본 Artifact | AI Analysis 4카드 (강점·어려운 점·근거·피드백 초안)
 * Actions 순서 고정: [수정] [반려] [승인]
 * Owner: PROCESS (feat/process)
 */
const PREV_LABEL: Record<string, string> = {
  APPROVED: "승인",
  EDITED_APPROVED: "수정 후 승인",
  REJECTED: "반려",
};

export default async function AnalysisReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ analysisId: string }>;
  searchParams: Promise<{ prev?: string }>;
}) {
  const { analysisId } = await params;
  const { prev } = await searchParams;
  const prevLabel = prev ? PREV_LABEL[prev] : undefined;
  const supabase = await createClient();

  const { data: analysis } = await supabase
    .from("analyses")
    .select(
      `id, analysis_json, status, version_no, submission_id,
       submissions (
         structured_input,
         students ( name, student_number ),
         activity_assignments ( activities ( title, activity_standards ( standard_id ) ) )
       )`,
    )
    .eq("id", analysisId)
    .maybeSingle();

  if (!analysis) {
    return (
      <div className="space-y-6">
        <PageHeader title="분석 검토" />
        <ErrorState title="분석을 찾을 수 없어요" description="목록에서 다시 선택해 주세요." />
      </div>
    );
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  const submission = one(analysis.submissions);
  const student = one(submission?.students);
  const activity = one(one(submission?.activity_assignments)?.activities);
  const standardIds: string[] = (activity?.activity_standards ?? []).map(
    (s: any) => s.standard_id,
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const standards = getStandards(standardIds);
  const levelOptions =
    standards[0]?.achievement_levels.map((l) => l.level) ?? ["상", "중", "하"];

  // AI 결과 파싱 (저장 시 검증됐지만 방어적으로 재검증)
  const parsed = AnalysisResultSchema.safeParse(analysis.analysis_json);
  if (!parsed.success) {
    return (
      <div className="space-y-6">
        <PageHeader title="분석 검토" />
        <ErrorState
          title="분석 데이터 형식 오류"
          description="이 분석은 형식이 손상되어 표시할 수 없어요. 반려 후 재분석해 주세요."
        />
      </div>
    );
  }

  // 직접 ORIGINAL과 Batch DERIVED → Teacher-owned ORIGINAL을 모두 해석한다.
  // Signed URL은 서버에서 소유권/RLS 확인 후 짧게 발급한다 (TRD §30.8).
  const { data: artifacts } = await supabase
    .from("artifacts")
    .select("id, source_artifact_id, storage_path, file_name, mime_type, artifact_role, page_start, page_end")
    .eq("submission_id", analysis.submission_id)
    .order("created_at", { ascending: true })
    .limit(6);

  const sourceIds = [...new Set((artifacts ?? []).flatMap((artifact) => (
    artifact.artifact_role === "DERIVED" && artifact.source_artifact_id
      ? [artifact.source_artifact_id]
      : []
  )))];
  const { data: sourceArtifacts } = sourceIds.length > 0
    ? await supabase
      .from("artifacts")
      .select("id, storage_path, file_name, mime_type, artifact_role")
      .in("id", sourceIds)
      .eq("artifact_role", "ORIGINAL")
    : { data: [] };
  const sources = new Map((sourceArtifacts ?? []).map((source) => [source.id, source]));
  const resolvedOriginals = (artifacts ?? []).flatMap((artifact) => {
    if (artifact.artifact_role === "ORIGINAL") {
      return [{
        artifactId: artifact.id,
        originalArtifactId: artifact.id,
        storagePath: artifact.storage_path,
        fileName: artifact.file_name,
        mimeType: artifact.mime_type,
        pageStart: artifact.page_start,
        pageEnd: artifact.page_end,
      }];
    }
    if (artifact.artifact_role !== "DERIVED" || !artifact.source_artifact_id) return [];
    const source = sources.get(artifact.source_artifact_id);
    if (!source) return [];
    return [{
      artifactId: artifact.id,
      originalArtifactId: source.id,
      storagePath: source.storage_path,
      fileName: source.file_name,
      mimeType: source.mime_type,
      pageStart: artifact.page_start,
      pageEnd: artifact.page_end,
    }];
  });
  const originalFiles = [];
  for (const original of resolvedOriginals) {
    const { data: signed } = await supabase.storage
      .from(STORAGE.BUCKET)
      .createSignedUrl(original.storagePath, 600);
    if (!signed?.signedUrl) continue;
    originalFiles.push({
      artifactId: original.artifactId,
      originalArtifactId: original.originalArtifactId,
      fileName: original.fileName,
      mimeType: original.mimeType,
      pageStart: original.pageStart,
      pageEnd: original.pageEnd,
      signedUrl: signed.signedUrl,
    });
  }

  const studentLabel = student ? `${student.student_number}번 ${student.name}` : "학생";

  // 남은 검토 대기 수 (연속 검토 흐름 안내용)
  const { count: remainingCount } = await supabase
    .from("analyses")
    .select("id", { count: "exact", head: true })
    .in("status", ["AI_DRAFT", "TEACHER_REVIEW"]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="분석 검토"
        description={`${studentLabel} · ${activity?.title ?? "활동"} · 분석 v${analysis.version_no}${
          remainingCount ? ` · 검토 대기 ${remainingCount}건` : ""
        }`}
      />
      {prevLabel && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-success/20 bg-success-bg px-4 py-3 text-sm font-semibold text-success"
        >
          이전 학생 {prevLabel} 완료 — 다음 검토로 바로 이어드렸어요.
        </p>
      )}
      <ReviewPanel
        analysisId={analysis.id}
        readOnly={!["AI_DRAFT", "TEACHER_REVIEW"].includes(analysis.status)}
        initial={parsed.data}
        levelOptions={levelOptions}
        standards={standards.map((s) => ({ id: s.standard_id, text: s.text }))}
        originalFiles={originalFiles}
        structuredInput={submission?.structured_input ?? null}
      />
    </div>
  );
}
