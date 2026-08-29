import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeSubmissionWithVlm } from "@/lib/ai/submission-analysis";
import { getVlmAdapter } from "@/lib/ai/vlm-adapter";
import { resolveStandards } from "@/lib/curriculum/resolve";
import { STORAGE } from "@/lib/config";
import type { StructuredInput } from "@/shared/types/db";
import type { ProcessArtifactReference } from "./handoff-contract";

/**
 * Submission 1건을 분석해서 analyses + evidence에 AI_DRAFT로 저장한다.
 * - 상태 전이: ANALYZING → (성공) REVIEW_REQUIRED / (실패) FAILED  (TRD §18)
 * - 재분석은 version_no를 올려 INSERT. 기존 Analysis 덮어쓰기 금지 (TRD §24)
 * - 이미 검토 대기 중인 최신 분석이 있으면 재호출을 생략한다 (데모 재사용/비용 절약)
 */
export async function analyzeOneSubmission(
  supabase: SupabaseClient,
  submissionId: string,
  resolvedArtifacts?: readonly ProcessArtifactReference[],
): Promise<{ status: "completed" | "skipped"; analysisId: string }> {
  // 1. Submission + 관계 조회 (RLS로 본인 범위 강제)
  const { data: submission, error: subError } = await supabase
    .from("submissions")
    .select(
      `id, structured_input, input_status, process_status, current_attempt_no, submitted_at,
       activity_assignments (
         activities ( id, title, description,
           activity_standards ( standard_id )
         )
       )`,
    )
    .eq("id", submissionId)
    .single();

  if (subError || !submission) throw new Error("제출물을 찾을 수 없습니다.");
  if (submission.input_status !== "READY_FOR_PROCESS") {
    throw new Error("분석 준비(READY_FOR_PROCESS) 상태가 아닙니다.");
  }

  // 이미 검토 대기 중인 "최신 제출 기준" 분석이 있으면 재실행하지 않는다.
  // 단, 분석 이후에 학생이 다시 제출했다면(재제출) 새 버전으로 다시 분석한다.
  const { data: latest } = await supabase
    .from("analyses")
    .select("id, version_no, status, created_at")
    .eq("submission_id", submissionId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestIsPending =
    latest && (latest.status === "AI_DRAFT" || latest.status === "TEACHER_REVIEW");
  const analysisIsFresh =
    latest &&
    (!submission.submitted_at ||
      new Date(latest.created_at).getTime() >= new Date(submission.submitted_at).getTime());
  if (latestIsPending && analysisIsFresh) {
    // 근거까지 갖춘 신선한 초안만 재사용한다. 근거가 빈 불완전 초안은 FAILED 처리 후 재분석 (input)
    const { count: evidenceCount } = await supabase
      .from("evidence")
      .select("id", { count: "exact", head: true })
      .eq("analysis_id", latest.id);
    if ((evidenceCount ?? 0) > 0) {
      await supabase
        .from("submissions")
        .update({ process_status: "REVIEW_REQUIRED" })
        .eq("id", submissionId);
      return { status: "skipped", analysisId: latest.id };
    }
    await supabase.from("analyses").update({ status: "FAILED" }).eq("id", latest.id);
  }

  await supabase
    .from("submissions")
    .update({ process_status: "ANALYZING" })
    .eq("id", submissionId);

  try {
    // 2. 분석 컨텍스트 구성 (TRD §24) — 학생 이름/번호는 조회조차 하지 않는다 (§30.12)
    const assignment = Array.isArray(submission.activity_assignments)
      ? submission.activity_assignments[0]
      : submission.activity_assignments;
    const activity = Array.isArray(assignment?.activities)
      ? assignment?.activities[0]
      : assignment?.activities;
    if (!activity) throw new Error("연결된 활동을 찾을 수 없습니다.");

    const standardIds: string[] = (activity.activity_standards ?? []).map(
      (s: { standard_id: string }) => s.standard_id,
    );
    const standards = await resolveStandards(standardIds);

    // 3. 원본 Artifact → 짧은 만료 Signed URL → base64 (TRD §23, §30.8)
    // input의 artifactReferences 구조 유지 + 최신 시도(attempt)의 사진만 사용 (재제출 격리, TRD §24)
    let artifactReferences = resolvedArtifacts ? [...resolvedArtifacts] : [];
    if (!resolvedArtifacts) {
      const { data: artifacts } = await supabase
        .from("artifacts")
        .select("id, storage_path, mime_type, artifact_role, page_start, page_end, attempt_no")
        .eq("submission_id", submissionId)
        .eq("artifact_role", "ORIGINAL")
        .eq("attempt_no", submission.current_attempt_no ?? 1)
        .order("created_at", { ascending: true })
        .limit(4);
      artifactReferences = (artifacts ?? []).map((artifact) => ({
        artifactId: artifact.id,
        originalArtifactId: artifact.id,
        storagePath: artifact.storage_path,
        mimeType: artifact.mime_type,
        pageStart: artifact.page_start,
        pageEnd: artifact.page_end,
      }));
    }

    const images: Array<{ mimeType: string; base64: string }> = [];
    for (const artifact of artifactReferences) {
      if (!artifact.mimeType.startsWith("image/")) continue;
      const { data: signed } = await supabase.storage
        .from(STORAGE.BUCKET)
        .createSignedUrl(artifact.storagePath, 300);
      if (!signed?.signedUrl) continue;
      const res = await fetch(signed.signedUrl);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      images.push({ mimeType: artifact.mimeType, base64: buf.toString("base64") });
    }

    // 4. AI 분석
    const adapter = getVlmAdapter();
    const result = await analyzeSubmissionWithVlm({
      structuredInput: (submission.structured_input as StructuredInput | null) ?? null,
      images,
      activity: { title: activity.title, description: activity.description },
      standards,
    }, adapter);

    // 5. 저장 — analyses (버전 INSERT) + evidence
    const nextVersion = (latest?.version_no ?? 0) + 1;
    const { data: analysis, error: insertError } = await supabase
      .from("analyses")
      .insert({
        submission_id: submissionId,
        version_no: nextVersion,
        analysis_json: result,
        status: "AI_DRAFT",
        provider: adapter.provider,
        model: adapter.model,
      })
      .select("id")
      .single();
    if (insertError || !analysis) throw new Error("분석 결과 저장에 실패했습니다.");

    // 재제출로 만들어진 새 버전이 확정판이므로, 이전의 미검토 초안은 자동 대체(REJECTED) 처리
    await supabase
      .from("analyses")
      .update({ status: "REJECTED" })
      .eq("submission_id", submissionId)
      .in("status", ["AI_DRAFT", "TEACHER_REVIEW"])
      .neq("id", analysis.id);

    // Batch 제출은 Submission-owned DERIVED 범위를 Evidence에 연결한다 (input)
    const firstArtifactId = artifactReferences[0]?.artifactId ?? null;
    const evidenceRows = result.evidence.map((e) => ({
      analysis_id: analysis.id,
      standard_id: standards[0]?.standard_id ?? null,
      artifact_id: firstArtifactId,
      question_id: e.question_id ?? null,
      source_page: e.source_page ?? null,
      claim: e.claim,
    }));
    if (evidenceRows.length > 0) {
      const { error: evError } = await supabase.from("evidence").insert(evidenceRows);
      if (evError) throw new Error("근거 저장에 실패했습니다.");
    }

    await supabase
      .from("submissions")
      .update({ process_status: "REVIEW_REQUIRED" })
      .eq("id", submissionId);

    return { status: "completed", analysisId: analysis.id };
  } catch (e) {
    // 중복 실행 중 다른 요청이 먼저 완전한 초안+Evidence를 저장했다면
    // 늦게 실패한 요청이 정상 상태를 FAILED로 덮지 않는다.
    const { data: recoverable } = await supabase
      .from("analyses")
      .select("id")
      .eq("submission_id", submissionId)
      .in("status", ["AI_DRAFT", "TEACHER_REVIEW"])
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recoverable) {
      const { count: evidenceCount } = await supabase
        .from("evidence")
        .select("id", { count: "exact", head: true })
        .eq("analysis_id", recoverable.id);
      if ((evidenceCount ?? 0) > 0) {
        await supabase
          .from("submissions")
          .update({ process_status: "REVIEW_REQUIRED" })
          .eq("id", submissionId);
        return { status: "skipped", analysisId: recoverable.id };
      }
    }

    // 원인 추적을 위해 서버 로그에 남긴다 (학생 PII 없음 — submission id만)
    const errorCode = e && typeof e === "object" && "code" in e ? String(e.code) : null;
    console.error(`[PROCESS] 분석 실패 submission=${submissionId} code=${errorCode ?? "UNKNOWN"}`);
    await supabase
      .from("submissions")
      .update({ process_status: "FAILED" })
      .eq("id", submissionId);
    throw e;
  }
}
