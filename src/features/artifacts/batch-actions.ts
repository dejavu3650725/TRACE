"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { activityContentFromAiDraft, AiActivityDraftSchema, type AiActivityDraft } from "@/features/activities/ai-schema";
import {
  resolveAiCurriculumContext,
  selectMostRelevantMaterialStandard,
} from "@/features/activities/ai-curriculum";
import { buildActivityCodePrefix } from "@/features/activities/code";
import { gradeBandForNumericGrade } from "@/features/activities/curriculum";
import { rankExistingActivityCandidates } from "@/features/activities/material-candidate-matching";
import { extractBatchPdfWithVlm } from "@/lib/ai/batch-pdf-extraction";
import { VlmAdapterRequestError } from "@/lib/ai/contracts";
import { classifyMaterialPdfWithVlm } from "@/lib/ai/material-classification";
import { PrivacyContextViolationError } from "@/lib/ai/privacy-context";
import { getVlmAdapter } from "@/lib/ai/vlm-adapter";
import { requireTeacherOwnership } from "@/lib/auth/ownership";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { STORAGE } from "@/lib/config";
import { getCurriculumLoader } from "@/lib/curriculum/loader-full";
import {
  StructuredInputRuntimeSchema,
  type StructuredInputRuntime,
} from "@/features/submissions/structured-input-schema";
import {
  matchVisibleStudentIdentity,
  type BatchRosterStudent,
} from "./batch-matching";
import {
  BatchPageRangeValidationError,
  groupExtractedBatchPages,
  normalizeBatchPageRanges,
  type BatchPageRange,
} from "./batch-ranges";
import {
  ArtifactFileValidationError,
  validateTeacherArtifactFile,
} from "./validation";

export type BatchPdfUploadResult =
  | { ok: true; artifactId: string; pageCount: number; message: string }
  | { ok: false; message: string };

export async function uploadTeacherBatchPdf(formData: FormData): Promise<BatchPdfUploadResult> {
  const { teacher, supabase } = await requireSessionTeacher();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "PDF 파일을 다시 선택해 주세요." };

  let validated;
  try {
    validated = await validateTeacherArtifactFile(file);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ArtifactFileValidationError
        ? error.message
        : "PDF 파일을 검증하지 못했어요.",
    };
  }
  if (validated.mimeType !== "application/pdf" || validated.pageCount === null) {
    return { ok: false, message: "Batch 자료는 PDF 한 파일로 올려 주세요." };
  }

  const artifactId = crypto.randomUUID();
  const storagePath = STORAGE.teacherBatchOriginalPath(teacher.id, artifactId);
  const checksum = createHash("sha256").update(validated.bytes).digest("hex");
  const { error: storageError } = await supabase.storage
    .from(STORAGE.BUCKET)
    .upload(storagePath, validated.bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (storageError) {
    console.error("Teacher Batch PDF Storage upload failed", { artifactId });
    return { ok: false, message: "비공개 저장소에 Batch PDF를 올리지 못했어요." };
  }

  const { data: recordedId, error: recordError } = await supabase.rpc("record_teacher_batch_pdf", {
    p_artifact_id: artifactId,
    p_storage_path: storagePath,
    p_file_name: validated.fileName,
    p_file_size_bytes: validated.fileSizeBytes,
    p_checksum: checksum,
    p_page_count: validated.pageCount,
  });
  if (recordError || recordedId !== artifactId) {
    const { error: cleanupError } = await supabase.storage.from(STORAGE.BUCKET).remove([storagePath]);
    console.error("Teacher Batch PDF DB record failed after Storage success", {
      artifactId,
      cleanupFailed: Boolean(cleanupError),
    });
    return { ok: false, message: "PDF 관계를 저장하지 못했어요. 원본 파일을 정리했으니 다시 시도해 주세요." };
  }

  const { data: artifact, error: readError } = await supabase
    .from("artifacts")
    .select("id, owner_teacher_id, submission_id, artifact_role, page_start, page_end, storage_path")
    .eq("id", artifactId)
    .maybeSingle();
  if (
    readError
    || !artifact
    || artifact.owner_teacher_id !== teacher.id
    || artifact.submission_id !== null
    || artifact.artifact_role !== "ORIGINAL"
    || artifact.page_start !== 1
    || artifact.page_end !== validated.pageCount
    || artifact.storage_path !== storagePath
  ) {
    return { ok: false, message: "원본은 저장됐지만 페이지 정보를 다시 읽지 못했어요." };
  }

  revalidatePath("/results/upload");
  return {
    ok: true,
    artifactId,
    pageCount: validated.pageCount,
    message: `${validated.pageCount}쪽 Batch PDF 원본을 한 번만 저장했어요.`,
  };
}

const saveRangesSchema = z.object({
  sourceArtifactId: z.string().uuid(),
  pageCount: z.number().int().min(1).max(100),
  ranges: z.array(z.object({
    page_start: z.number(),
    page_end: z.number(),
  })).min(1).max(100),
});

export type SaveBatchRangesResult =
  | { ok: true; ranges: (BatchPageRange & { id: string })[]; message: string }
  | { ok: false; message: string };

export async function replaceTeacherBatchPageRanges(input: {
  sourceArtifactId: string;
  pageCount: number;
  ranges: BatchPageRange[];
}): Promise<SaveBatchRangesResult> {
  const parsed = saveRangesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "학생 자료 묶음을 다시 확인해 주세요." };
  try {
    await requireTeacherOwnership("artifact", parsed.data.sourceArtifactId);
  } catch {
    return { ok: false, message: "이 Batch PDF를 수정할 권한이 없어요." };
  }

  let ranges: BatchPageRange[];
  try {
    ranges = normalizeBatchPageRanges(parsed.data.ranges, parsed.data.pageCount);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof BatchPageRangeValidationError
        ? error.message
        : "학생 자료 묶음을 검증하지 못했어요.",
    };
  }

  const { supabase } = await requireSessionTeacher();
  const { data, error } = await supabase.rpc("replace_teacher_batch_page_ranges", {
    p_source_artifact_id: parsed.data.sourceArtifactId,
    p_ranges: ranges,
  });
  if (error || !Array.isArray(data)) {
    return { ok: false, message: "학생 자료 묶음을 저장하지 못했어요." };
  }

  const resultSchema = z.array(z.object({
    id: z.string().uuid(),
    page_start: z.number().int(),
    page_end: z.number().int(),
  }));
  const result = resultSchema.safeParse(data);
  if (!result.success) return { ok: false, message: "저장 결과를 다시 읽지 못했어요." };

  revalidatePath(`/results/upload/batches/${parsed.data.sourceArtifactId}`);
  return {
    ok: true,
    ranges: result.data,
    message: `${result.data.length}명분의 학생 자료 묶음을 준비했어요.`,
  };
}

const classifyBatchActivitySchema = z.object({
  sourceArtifactId: z.string().uuid(),
  classId: z.string().uuid(),
});

export type BatchActivityStandardOption = {
  id: string;
  grade: string;
  subject: string;
  domain: string;
  description: string;
};

export type BatchActivityCandidate = {
  id: string;
  title: string;
  score: number;
  reasons: string[];
};

export type ClassifyTeacherBatchActivityResult =
  | {
      ok: true;
      provider: string;
      model: string;
      draft: AiActivityDraft;
      suggestedPagesPerStudent: number;
      standardOptions: BatchActivityStandardOption[];
      existingCandidates: BatchActivityCandidate[];
      message: string;
    }
  | { ok: false; message: string };

export async function classifyTeacherBatchActivity(input: {
  sourceArtifactId: string;
  classId: string;
}): Promise<ClassifyTeacherBatchActivityResult> {
  const parsed = classifyBatchActivitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "PDF와 대상 학급을 다시 선택해 주세요." };
  try {
    await Promise.all([
      requireTeacherOwnership("artifact", parsed.data.sourceArtifactId),
      requireTeacherOwnership("class", parsed.data.classId),
    ]);
  } catch {
    return { ok: false, message: "이 PDF 또는 학급을 확인할 권한이 없어요." };
  }

  const { teacher, supabase } = await requireSessionTeacher();
  const [{ data: source, error: sourceError }, { data: classItem, error: classError }] = await Promise.all([
    supabase.from("artifacts")
      .select("id, storage_path, page_end")
      .eq("id", parsed.data.sourceArtifactId)
      .eq("owner_teacher_id", teacher.id)
      .is("submission_id", null)
      .is("source_artifact_id", null)
      .eq("artifact_role", "ORIGINAL")
      .eq("mime_type", "application/pdf")
      .maybeSingle(),
    supabase.from("classes")
      .select("id, grade")
      .eq("id", parsed.data.classId)
      .eq("teacher_id", teacher.id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  if (sourceError || !source || classError || !classItem) {
    return { ok: false, message: "PDF 또는 활성 학급 정보를 불러오지 못했어요." };
  }
  const { data: pdfBlob, error: downloadError } = await supabase.storage.from(STORAGE.BUCKET).download(source.storage_path);
  if (downloadError || !pdfBlob) return { ok: false, message: "비공개 저장소에서 PDF를 읽지 못했어요." };

  const adapter = getVlmAdapter();
  let metadata;
  try {
    metadata = await classifyMaterialPdfWithVlm({
      classGrade: classItem.grade,
      pdfBase64: Buffer.from(await pdfBlob.arrayBuffer()).toString("base64"),
    }, adapter);
  } catch (error) {
    const errorCode = error && typeof error === "object" && "code" in error ? String(error.code) : null;
    const validationIssuePaths = error instanceof z.ZodError
      ? error.issues.slice(0, 5).map((issue) => issue.path.join("."))
      : undefined;
    console.error("Batch Activity metadata classification failed", {
      artifactId: source.id,
      errorType: error instanceof Error ? error.name : "UnknownError",
      errorCode,
      validationIssuePaths,
    });
    return {
      ok: false,
      message: errorCode === "RATE_LIMITED"
        ? "AI 사용량 제한으로 활동을 찾지 못했어요. 잠시 후 다시 시도해 주세요."
        : errorCode === "CONFIGURATION_ERROR" || errorCode === "AUTHENTICATION_FAILED"
          ? "AI 연결 설정을 확인해 주세요."
          : errorCode === "TIMEOUT" || errorCode === "NETWORK_ERROR" || errorCode === "PROVIDER_UNAVAILABLE"
            ? "AI 연결이 지연되어 활동을 찾지 못했어요. 잠시 후 다시 시도해 주세요."
            : error instanceof z.ZodError
              ? "PDF는 읽었지만 활동과 문항 형식을 정리하지 못했어요. 다시 시도해 주세요."
          : "PDF에서 활동 정보를 파악하지 못했어요. 잠시 후 다시 시도해 주세요.",
    };
  }

  const resolvedGrade = metadata.grade ?? classItem.grade;
  const searchableText = [
    metadata.title_candidate,
    metadata.description,
    metadata.subject,
    metadata.domain,
    metadata.unit,
    ...metadata.keywords,
    ...metadata.questions.map((question) => question.prompt),
  ].filter((value): value is string => Boolean(value)).join(" ");
  let loader;
  let curriculum;
  try {
    loader = await getCurriculumLoader();
    const gradeBand = gradeBandForNumericGrade(resolvedGrade);
    curriculum = gradeBand
      ? resolveAiCurriculumContext({
          loader,
          gradeBand,
          teacherPrompt: searchableText,
          subject: metadata.subject,
          domain: metadata.domain,
          standardKeyword: metadata.keywords[0] ?? null,
        })
      : { resolvedSubject: metadata.subject, resolvedDomain: metadata.domain, standards: [] };
  } catch (error) {
    console.error("Batch Curriculum candidate lookup failed", {
      artifactId: source.id,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return { ok: false, message: "활동은 읽었지만 성취기준 자료를 불러오지 못했어요." };
  }
  const standardPool = curriculum.resolvedSubject && gradeBandForNumericGrade(resolvedGrade)
    ? loader.findStandards({
        grade: gradeBandForNumericGrade(resolvedGrade) ?? undefined,
        subject: curriculum.resolvedSubject,
        limit: 100,
      })
    : [];
  const mostRelevantStandard = selectMostRelevantMaterialStandard({
    standards: standardPool,
    title: metadata.title_candidate,
    description: metadata.description,
    instructions: metadata.instructions,
    domain: curriculum.resolvedDomain,
    unit: metadata.unit,
    keywords: metadata.keywords,
    questionPrompts: metadata.questions.map((question) => question.prompt),
  });
  const standards = mostRelevantStandard ? [mostRelevantStandard] : [];
  const parsedDraft = AiActivityDraftSchema.safeParse({
    title: metadata.title_candidate,
    description: metadata.description,
    instructions: metadata.instructions,
    grade: resolvedGrade,
    subject: curriculum.resolvedSubject,
    domain: curriculum.resolvedDomain,
    unit: metadata.unit,
    activity_type: metadata.activity_type ?? "활동지",
    standard_candidates: standards.map((standard) => standard.id),
    questions: metadata.questions,
    print_layout_data: {
      paper_size: "A4",
      orientation: "PORTRAIT",
      estimated_pages: Math.max(1, Math.min(10, metadata.pages_per_student)),
    },
  });
  if (!parsedDraft.success) {
    console.error("Batch Activity metadata normalization failed", {
      artifactId: source.id,
      issueCount: parsedDraft.error.issues.length,
    });
    return { ok: false, message: "PDF의 활동과 문항 구조를 정리하지 못했어요. 다시 시도해 주세요." };
  }
  const draft = parsedDraft.data;

  const { data: existingRows, error: existingError } = await supabase.from("activities")
    .select("id, title, grade, subject, domain, unit, activity_type, activity_standards(standard_id)")
    .eq("teacher_id", teacher.id)
    .eq("status", "ACTIVE");
  if (existingError) return { ok: false, message: "기존 활동 후보를 불러오지 못했어요." };
  const existingCandidates = rankExistingActivityCandidates({
    title: draft.title,
    grade: draft.grade,
    subject: draft.subject,
    domain: draft.domain,
    unit: draft.unit,
    activityType: draft.activity_type,
    standardIds: draft.standard_candidates,
  }, (existingRows ?? []).map((activity) => ({
    id: activity.id,
    title: activity.title,
    grade: activity.grade,
    subject: activity.subject,
    domain: activity.domain,
    unit: activity.unit,
    activityType: activity.activity_type,
    standardIds: (activity.activity_standards ?? []).map((standard) => standard.standard_id),
  }))).map((candidate) => ({
    id: candidate.id,
    title: candidate.title,
    score: candidate.score,
    reasons: candidate.reasons,
  }));

  return {
    ok: true,
    provider: adapter.provider,
    model: adapter.model,
    draft,
    suggestedPagesPerStudent: Math.min(source.page_end ?? 1, metadata.pages_per_student),
    standardOptions: standards.map((standard) => ({
      id: standard.id,
      grade: standard.grade,
      subject: standard.subject,
      domain: standard.domain,
      description: standard.description,
    })),
    existingCandidates,
    message: standards.length > 0
      ? "PDF에서 활동과 가장 관련성 높은 성취기준 1개를 찾았어요. 아래 내용을 확인해 주세요."
      : "PDF에서 활동은 찾았지만 관련 성취기준을 확정하지 못했어요. 아래 내용을 확인해 주세요.",
  };
}

const confirmBatchActivitySchema = z.object({
  sourceArtifactId: z.string().uuid(),
  classId: z.string().uuid(),
  existingActivityId: z.string().uuid().nullable(),
  draft: AiActivityDraftSchema,
});

export type ConfirmTeacherBatchActivityResult =
  | {
      ok: true;
      activityId: string;
      assignmentId: string;
      createdActivity: boolean;
      title: string;
      message: string;
    }
  | { ok: false; message: string };

export async function confirmTeacherBatchActivity(input: z.input<typeof confirmBatchActivitySchema>): Promise<ConfirmTeacherBatchActivityResult> {
  const parsed = confirmBatchActivitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "활동 후보와 학급을 다시 확인해 주세요." };
  if (
    parsed.data.existingActivityId === null
    && parsed.data.draft.grade !== null
    && parsed.data.draft.grade >= 10
    && parsed.data.draft.subject !== "정보"
  ) {
    return { ok: false, message: "고등학교 자료는 현재 정보 교과만 새 활동으로 저장할 수 있어요." };
  }
  try {
    await Promise.all([
      requireTeacherOwnership("artifact", parsed.data.sourceArtifactId),
      requireTeacherOwnership("class", parsed.data.classId),
    ]);
  } catch {
    return { ok: false, message: "이 PDF 또는 학급을 확인할 권한이 없어요." };
  }

  const loader = await getCurriculumLoader();
  if (!parsed.data.draft.standard_candidates.every((id) => loader.getStandard(id) !== null)) {
    return { ok: false, message: "성취기준 후보를 다시 확인해 주세요." };
  }
  const content = activityContentFromAiDraft(parsed.data.draft);
  const prefix = buildActivityCodePrefix({
    subject: parsed.data.draft.subject,
    grade: parsed.data.draft.grade,
    standardId: parsed.data.draft.standard_candidates[0] ?? null,
  });
  const { supabase } = await requireSessionTeacher();
  const { data, error } = await supabase.rpc("confirm_batch_activity_assignment", {
    p_source_artifact_id: parsed.data.sourceArtifactId,
    p_class_id: parsed.data.classId,
    p_existing_activity_id: parsed.data.existingActivityId,
    p_title: parsed.data.draft.title,
    p_grade: parsed.data.draft.grade,
    p_subject: parsed.data.draft.subject,
    p_domain: parsed.data.draft.domain,
    p_unit: parsed.data.draft.unit,
    p_activity_type: parsed.data.draft.activity_type,
    p_description: parsed.data.draft.description,
    p_standard_ids: parsed.data.draft.standard_candidates,
    p_content_json: content,
    p_code_prefix: prefix,
  });
  const committed = z.object({
    activity_id: z.string().uuid(),
    activity_assignment_id: z.string().uuid(),
    created_activity: z.boolean(),
  }).safeParse(data);
  if (error || !committed.success) {
    const errorCode = error?.code ?? "INVALID_RPC_RESPONSE";
    console.error(`Batch Activity confirmation failed [${errorCode}]`);

    if (errorCode === "PGRST202" || errorCode === "42883") {
      return {
        ok: false,
        message: "원격 DB에 활동 연결 기능이 아직 적용되지 않았어요. 0013 마이그레이션을 적용한 뒤 다시 눌러 주세요.",
      };
    }
    if (errorCode === "42501") {
      return { ok: false, message: "이 PDF·활동·학급을 연결할 권한을 확인하지 못했어요." };
    }
    if (errorCode === "22023") {
      return { ok: false, message: "활동 또는 학급 정보가 올바르지 않아요. 선택한 내용을 다시 확인해 주세요." };
    }
    return { ok: false, message: "활동 확정과 학급 배정에 실패했어요. 잠시 후 다시 시도해 주세요." };
  }
  const { data: confirmedActivity } = await supabase.from("activities")
    .select("title")
    .eq("id", committed.data.activity_id)
    .maybeSingle();

  revalidatePath("/activities");
  revalidatePath(`/results/upload/batches/${parsed.data.sourceArtifactId}`);
  return {
    ok: true,
    activityId: committed.data.activity_id,
    assignmentId: committed.data.activity_assignment_id,
    createdActivity: committed.data.created_activity,
    title: confirmedActivity?.title ?? parsed.data.draft.title,
    message: committed.data.created_activity
      ? "새 활동을 저장하고 선택한 학급에 배정했어요. 이제 학생 연결을 실행하세요."
      : "기존 활동을 선택한 학급에 연결했어요. 이제 학생 연결을 실행하세요.",
  };
}

const matchBatchSchema = z.object({
  sourceArtifactId: z.string().uuid(),
  activityAssignmentId: z.string().uuid(),
});

const activityContentSchema = z.object({
  questions: z.array(z.object({
    question_id: z.string().trim().min(1).max(100),
    prompt: z.string().trim().min(1).max(2_000),
    question_type: z.string().trim().max(100).nullable().optional(),
    options: z.array(z.string().trim().max(500)).max(20).optional(),
  })).max(200),
});

export type BatchMatchItem = {
  rangeArtifactId: string;
  pageStart: number;
  pageEnd: number;
  status: "MATCHED" | "REVIEW_PENDING" | "FAILED";
  grade: string | null;
  className: string | null;
  studentNumber: string | null;
  studentName: string | null;
  studentId: string | null;
  submissionId: string | null;
  questionCount: number;
  questions: Array<{
    questionId: string;
    visiblePrompt: string | null;
    responseType: StructuredInputRuntime["questions"][number]["response_type"];
    response: Record<string, unknown>;
    uncertain: boolean;
  }>;
  message: string;
};

export type MatchTeacherBatchResult =
  | {
      ok: true;
      jobId: string;
      provider: string;
      model: string;
      matched: number;
      reviewPending: number;
      failed: number;
      items: BatchMatchItem[];
      message: string;
    }
  | { ok: false; message: string };

const correctBatchReviewSchema = z.object({
  sourceArtifactId: z.string().uuid(),
  rangeArtifactId: z.string().uuid(),
  activityAssignmentId: z.string().uuid(),
  studentId: z.string().uuid(),
  structuredInput: StructuredInputRuntimeSchema,
  responseNeedsReview: z.boolean(),
});

export type CorrectTeacherBatchReviewResult =
  | { ok: true; submissionId: string; inputStatus: "REVIEW_PENDING" | "READY_FOR_PROCESS"; message: string }
  | { ok: false; message: string };

export async function correctTeacherBatchReview(input: {
  sourceArtifactId: string;
  rangeArtifactId: string;
  activityAssignmentId: string;
  studentId: string;
  structuredInput: unknown;
  responseNeedsReview: boolean;
}): Promise<CorrectTeacherBatchReviewResult> {
  const parsed = correctBatchReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "학생과 인식 결과를 다시 확인해 주세요." };

  try {
    await Promise.all([
      requireTeacherOwnership("artifact", parsed.data.sourceArtifactId),
      requireTeacherOwnership("activityAssignment", parsed.data.activityAssignmentId),
    ]);
  } catch {
    return { ok: false, message: "이 Batch PDF 또는 활동 배정을 수정할 권한이 없어요." };
  }

  const { supabase } = await requireSessionTeacher();
  const inputStatus = parsed.data.responseNeedsReview ? "REVIEW_PENDING" : "READY_FOR_PROCESS";
  const { data, error } = await supabase.rpc("commit_batch_teacher_correction", {
    p_source_artifact_id: parsed.data.sourceArtifactId,
    p_range_artifact_id: parsed.data.rangeArtifactId,
    p_activity_assignment_id: parsed.data.activityAssignmentId,
    p_student_id: parsed.data.studentId,
    p_structured_input: parsed.data.structuredInput,
    p_input_status: inputStatus,
  });
  const committed = z.object({ submission_id: z.string().uuid() }).safeParse(data);
  if (error || !committed.success) {
    console.error("Batch teacher correction failed", {
      rangeArtifactId: parsed.data.rangeArtifactId,
      code: error?.code,
    });
    return { ok: false, message: "교사 확인 결과를 저장하지 못했어요. 페이지 묶음과 학생을 다시 확인해 주세요." };
  }

  revalidatePath(`/results/upload/batches/${parsed.data.sourceArtifactId}`);
  revalidatePath("/results");
  return {
    ok: true,
    submissionId: committed.data.submission_id,
    inputStatus,
    message: inputStatus === "REVIEW_PENDING"
      ? "학생 연결은 확정했고, 불확실한 답안은 검토 대기로 유지했어요."
      : "선택한 학생으로 페이지 묶음을 확정했어요.",
  };
}

function readableMatchReason(reason: string): string {
  switch (reason) {
    case "MISSING_IDENTITY": return "번호 또는 이름을 읽지 못해 검토가 필요해요.";
    case "UNCERTAIN_IDENTITY": return "작성자 표기가 불확실해 자동 연결하지 않았어요.";
    case "AMBIGUOUS_EXACT_MATCH": return "완전히 일치하는 학생이 둘 이상이라 자동 연결하지 않았어요.";
    default: return "번호와 이름이 모두 일치하는 학생이 없어 검토가 필요해요.";
  }
}

export async function matchTeacherBatchPdf(input: {
  sourceArtifactId: string;
  activityAssignmentId: string;
}): Promise<MatchTeacherBatchResult> {
  const parsed = matchBatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Batch PDF와 활동 배정을 다시 선택해 주세요." };
  try {
    await Promise.all([
      requireTeacherOwnership("artifact", parsed.data.sourceArtifactId),
      requireTeacherOwnership("activityAssignment", parsed.data.activityAssignmentId),
    ]);
  } catch {
    return { ok: false, message: "이 Batch PDF 또는 활동 배정을 처리할 권한이 없어요." };
  }

  const { teacher, supabase } = await requireSessionTeacher();
  const [{ data: source, error: sourceError }, { data: assignment, error: assignmentError }] = await Promise.all([
    supabase
      .from("artifacts")
      .select("id, owner_teacher_id, submission_id, source_artifact_id, storage_path, artifact_role, mime_type, page_end")
      .eq("id", parsed.data.sourceArtifactId)
      .eq("owner_teacher_id", teacher.id)
      .is("submission_id", null)
      .is("source_artifact_id", null)
      .eq("artifact_role", "ORIGINAL")
      .eq("mime_type", "application/pdf")
      .maybeSingle(),
    supabase
      .from("activity_assignments")
      .select("id, class_id, activity_id")
      .eq("id", parsed.data.activityAssignmentId)
      .maybeSingle(),
  ]);
  if (sourceError || !source || assignmentError || !assignment) {
    return { ok: false, message: "PDF 또는 활동 정보를 불러오지 못했어요." };
  }
  const pageCount = source.page_end;
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 100) {
    return { ok: false, message: "PDF 전체 페이지 수를 확인하지 못했어요." };
  }
  const pageProbeRanges = Array.from({ length: pageCount }, (_, index) => ({
    rangeIndex: index,
    pageStart: index + 1,
    pageEnd: index + 1,
  }));

  const [{ data: classItem, error: classError }, { data: activity, error: activityError }, { data: rosterRows, error: rosterError }] = await Promise.all([
    supabase.from("classes").select("id, grade").eq("id", assignment.class_id).maybeSingle(),
    supabase.from("activities").select("id, title, description, grade, content_json").eq("id", assignment.activity_id).maybeSingle(),
    supabase.from("students").select("id, student_number, name").eq("class_id", assignment.class_id).eq("is_active", true),
  ]);
  if (classError || !classItem || activityError || !activity || rosterError) {
    return { ok: false, message: "선택한 활동의 학급·학생 명단을 서버에서 확인하지 못했어요." };
  }
  const roster: BatchRosterStudent[] = (rosterRows ?? []).map((student) => ({
    id: student.id,
    studentNumber: student.student_number,
    studentName: student.name,
  }));
  if (roster.length === 0) return { ok: false, message: "선택한 학급에 활성 학생 명단이 없어요." };

  const { data: job, error: jobError } = await supabase
    .from("processing_jobs")
    .insert({
      teacher_id: teacher.id,
      job_type: "BATCH_STUDENT_MATCH",
      status: "PROCESSING",
      total_count: pageCount,
      completed_count: 0,
      failed_count: 0,
      current_step: "PDF에서 작성자 표기와 관찰 응답을 인식하는 중",
      payload_json: {
        source_artifact_id: source.id,
        activity_assignment_id: assignment.id,
      },
    })
    .select("id")
    .single();
  if (jobError || !job) return { ok: false, message: "Batch 처리 작업을 시작하지 못했어요." };

  const failJob = async (message: string) => {
    await supabase.from("processing_jobs").update({
      status: "FAILED",
      failed_count: pageCount,
      current_step: "Batch 인식 실패",
      error_message: message,
    }).eq("id", job.id);
  };

  const { data: pdfBlob, error: downloadError } = await supabase.storage
    .from(STORAGE.BUCKET)
    .download(source.storage_path);
  if (downloadError || !pdfBlob) {
    await failJob("원본 PDF를 읽지 못했습니다.");
    return { ok: false, message: "비공개 저장소에서 원본 PDF를 읽지 못했어요." };
  }

  const knownContent = activityContentSchema.safeParse(activity.content_json);
  const adapter = getVlmAdapter();
  let extracted;
  try {
    extracted = await extractBatchPdfWithVlm({
      activity: {
        title: activity.title,
        description: activity.description,
        grade: activity.grade ?? classItem.grade,
        questions: knownContent.success
          ? knownContent.data.questions.map((question) => ({
              questionId: question.question_id,
              prompt: question.prompt,
              responseType: question.question_type ?? null,
              options: question.options ?? [],
            }))
          : [],
      },
      pageRanges: pageProbeRanges,
      pdfBase64: Buffer.from(await pdfBlob.arrayBuffer()).toString("base64"),
    }, adapter);
  } catch (error) {
    const errorCode = error instanceof VlmAdapterRequestError
      ? error.code
      : error instanceof PrivacyContextViolationError
        ? "PRIVACY_BLOCKED"
        : error instanceof z.ZodError
          ? "INVALID_RESPONSE_SCHEMA"
          : error instanceof Error
            ? error.name
            : "UNKNOWN_ERROR";
    console.error(`Batch PDF VLM extraction failed [${errorCode}]`);
    await failJob(`AI 인식 요청 실패 (${errorCode})`);
    const message = errorCode === "RATE_LIMITED"
      ? "AI 요청이 잠시 몰렸어요. 잠시 후 학생 연결을 다시 실행해 주세요."
      : errorCode === "AUTHENTICATION_FAILED" || errorCode === "CONFIGURATION_ERROR"
        ? "AI 연결 설정을 확인하지 못했어요. 관리자 설정을 확인해 주세요."
        : errorCode === "INVALID_RESPONSE_SCHEMA" || errorCode === "ZodError"
          ? "PDF는 읽었지만 학생·답안 결과 형식이 맞지 않았어요. 학생 연결을 다시 실행해 주세요."
          : "PDF의 작성자 표기와 답안을 인식하지 못했어요. 학생 연결을 다시 실행해 주세요.";
    return { ok: false, message };
  }

  const extractedByIndex = new Map(extracted.map((group) => [group.rangeIndex, group]));
  const packets = groupExtractedBatchPages(pageProbeRanges.map((pageRange) => {
    const group = extractedByIndex.get(pageRange.rangeIndex);
    return {
      page: pageRange.pageStart,
      identity: group?.identity ?? {
        grade: null,
        className: null,
        studentNumber: null,
        studentName: null,
        uncertain: true,
      },
      questions: group?.questions ?? [],
    };
  }));

  const { data: storedRanges, error: storedRangeError } = await supabase.rpc(
    "replace_teacher_batch_page_ranges",
    {
      p_source_artifact_id: source.id,
      p_ranges: packets.map((packet) => ({
        page_start: packet.pageStart,
        page_end: packet.pageEnd,
      })),
    },
  );
  const storedRangesResult = z.array(z.object({
    id: z.string().uuid(),
    page_start: z.number().int(),
    page_end: z.number().int(),
  })).safeParse(storedRanges);
  if (storedRangeError || !storedRangesResult.success || storedRangesResult.data.length !== packets.length) {
    await failJob("페이지별 학생 자료 분리를 저장하지 못했습니다.");
    return { ok: false, message: "페이지별 학생 자료를 분리해 저장하지 못했어요." };
  }
  const usableRanges = storedRangesResult.data;
  await supabase.from("processing_jobs").update({ total_count: packets.length }).eq("id", job.id);
  const items: BatchMatchItem[] = [];
  const matchedArtifactIds: string[] = [];
  const reviewArtifactIds: string[] = [];
  const failedArtifactIds: string[] = [];
  const submissionIds: string[] = [];

  for (let rangeIndex = 0; rangeIndex < usableRanges.length; rangeIndex += 1) {
    const range = usableRanges[rangeIndex];
    const packet = packets[rangeIndex];
    const group = packet ? {
      rangeIndex,
      identity: packet.identity,
      questions: packet.questions,
    } : null;
    if (!group) {
      failedArtifactIds.push(range.id);
      items.push({
        rangeArtifactId: range.id, pageStart: range.page_start as number, pageEnd: range.page_end as number,
        status: "FAILED", grade: null, className: null, studentNumber: null, studentName: null,
        studentId: null, submissionId: null, questionCount: 0, questions: [],
        message: "이 학생 자료 묶음의 인식 결과가 누락됐어요.",
      });
      continue;
    }

    const identityMatch = matchVisibleStudentIdentity(group.identity, roster);
    if (identityMatch.status === "REVIEW_PENDING") {
      reviewArtifactIds.push(range.id);
      items.push({
        rangeArtifactId: range.id, pageStart: range.page_start as number, pageEnd: range.page_end as number,
        status: "REVIEW_PENDING", grade: group.identity.grade, className: group.identity.className,
        studentNumber: group.identity.studentNumber, studentName: group.identity.studentName,
        studentId: null, submissionId: null, questionCount: group.questions.length,
        questions: group.questions.map((question) => ({ ...question })),
        message: readableMatchReason(identityMatch.reason),
      });
      continue;
    }

    const structuredInput = StructuredInputRuntimeSchema.parse({
      schema_version: "1",
      questions: group.questions.map((question) => ({
        question_id: question.questionId,
        response_type: question.responseType,
        response: question.response,
      })),
    });
    const responseNeedsReview = group.questions.some((question) => question.uncertain);
    const inputStatus = responseNeedsReview ? "REVIEW_PENDING" : "READY_FOR_PROCESS";
    const { data: committed, error: commitError } = await supabase.rpc("commit_batch_student_match", {
      p_source_artifact_id: source.id,
      p_range_artifact_id: range.id,
      p_activity_assignment_id: assignment.id,
      p_student_id: identityMatch.student.id,
      p_visible_student_number: group.identity.studentNumber,
      p_visible_student_name: group.identity.studentName,
      p_structured_input: structuredInput,
      p_input_status: inputStatus,
    });
    const commitResult = z.object({ submission_id: z.string().uuid() }).safeParse(committed);
    if (commitError || !commitResult.success) {
      console.error("Batch exact match DB commit failed", {
        jobId: job.id,
        artifactId: range.id,
        code: commitError?.code,
      });
      failedArtifactIds.push(range.id);
      items.push({
        rangeArtifactId: range.id, pageStart: range.page_start as number, pageEnd: range.page_end as number,
        status: "FAILED", grade: group.identity.grade, className: group.identity.className,
        studentNumber: group.identity.studentNumber, studentName: group.identity.studentName,
        studentId: null, submissionId: null, questionCount: group.questions.length,
        questions: group.questions.map((question) => ({ ...question })),
        message: "정확히 일치했지만 Submission 연결을 저장하지 못했어요.",
      });
      continue;
    }

    submissionIds.push(commitResult.data.submission_id);
    if (responseNeedsReview) reviewArtifactIds.push(range.id);
    else matchedArtifactIds.push(range.id);
    items.push({
      rangeArtifactId: range.id, pageStart: range.page_start as number, pageEnd: range.page_end as number,
      status: responseNeedsReview ? "REVIEW_PENDING" : "MATCHED",
      grade: group.identity.grade, className: group.identity.className,
      studentNumber: group.identity.studentNumber, studentName: group.identity.studentName,
      studentId: identityMatch.student.id, submissionId: commitResult.data.submission_id,
      questionCount: group.questions.length,
      questions: group.questions.map((question) => ({ ...question })),
      message: responseNeedsReview
        ? "학생은 정확히 연결됐고 일부 답안 확인이 필요해요."
        : "번호와 이름이 모두 일치해 자동 연결했어요.",
    });
  }

  const matched = items.filter((item) => item.status === "MATCHED").length;
  const reviewPending = items.filter((item) => item.status === "REVIEW_PENDING").length;
  const failed = items.filter((item) => item.status === "FAILED").length;
  const finalStatus = matched === 0 && reviewPending === 0
    ? "FAILED"
    : reviewPending > 0 || failed > 0
      ? "REVIEW_REQUIRED"
      : "COMPLETED";
  await supabase.from("processing_jobs").update({
    status: finalStatus,
    completed_count: matched + reviewPending,
    failed_count: failed,
    current_step: `연결 ${matched} · 검토 ${reviewPending} · 실패 ${failed}`,
    error_message: failed > 0 ? "일부 학생 자료 묶음 처리에 실패했습니다." : null,
    payload_json: {
      source_artifact_id: source.id,
      activity_assignment_id: assignment.id,
      matched_range_artifact_ids: matchedArtifactIds,
      review_pending_range_artifact_ids: reviewArtifactIds,
      failed_range_artifact_ids: failedArtifactIds,
      submission_ids: submissionIds,
    },
  }).eq("id", job.id);

  revalidatePath(`/results/upload/batches/${source.id}`);
  revalidatePath("/results");
  return {
    ok: true,
    jobId: job.id,
    provider: adapter.provider,
    model: adapter.model,
    matched,
    reviewPending,
    failed,
    items,
    message: `자동 연결 ${matched}건 · 검토 대기 ${reviewPending}건 · 실패 ${failed}건`,
  };
}
