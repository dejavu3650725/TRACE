import { STORAGE } from "../config.ts";
import {
  APPROVED_OUTPUT_ANALYSIS_STATUSES,
  isObservedOnlyStructuredInput,
} from "./activity-report-demo.ts";
import type {
  ReportPageData,
  ReportPageModel,
  ReportPageStats,
  ReportPageTimepoint,
} from "./report-page-model.ts";
import { EMPTY_REPORT_PAGE_STATS } from "./report-page-model.ts";
import { StructuredInputRuntimeSchema } from "../../features/submissions/structured-input-schema.ts";
import type {
  ActivityStatus,
  AnalysisStatus,
  ArtifactRole,
  GrowthEventStatus,
  InputStatus,
  ProcessStatus,
  ReviewDecision,
} from "../../shared/types/status";
import type { StructuredInput } from "../../shared/types/db";

type Relation<T> = T | readonly T[] | null;

interface LiveStudentRow {
  id: string;
  student_number: number;
  name: string;
  is_active: boolean;
  classes: Relation<{ name: string }>;
}

export interface LiveGrowthEventRow {
  id: string;
  student_id: string;
  description: string;
  status: GrowthEventStatus;
  created_at: string;
  students: Relation<LiveStudentRow>;
}

interface LiveActivityRow {
  id: string;
  title: string;
  subject: string | null;
  domain: string | null;
  unit: string | null;
  status: ActivityStatus;
  created_at: string;
}

interface LiveSubmissionRow {
  id: string;
  student_id: string;
  structured_input: unknown;
  input_status: InputStatus;
  process_status: ProcessStatus;
  submitted_at: string | null;
  students?: Relation<LiveStudentRow>;
  activity_assignments: Relation<{
    activities: Relation<LiveActivityRow>;
  }>;
}

interface LiveReviewRow {
  id: string;
  reviewer_id: string;
  decision: ReviewDecision;
  teacher_edits: Record<string, unknown> | null;
  reviewed_at: string;
}

interface LiveAnalysisRow {
  id: string;
  submission_id: string;
  version_no: number;
  analysis_json: Record<string, unknown>;
  status: AnalysisStatus;
  provider: string | null;
  model: string | null;
  created_at: string;
  submissions: Relation<LiveSubmissionRow>;
  reviews: Relation<LiveReviewRow>;
}

interface LiveArtifactRow {
  id: string;
  submission_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  artifact_role: ArtifactRole;
  source_artifact_id?: string | null;
  page_start: number | null;
  page_end: number | null;
}

interface LiveEvidenceRow {
  id: string;
  analysis_id: string;
  artifact_id: string | null;
  question_id: string | null;
  source_page: number | null;
  claim: string;
  created_at: string;
  analyses: Relation<LiveAnalysisRow>;
  artifacts: Relation<LiveArtifactRow>;
}

export interface LiveGrowthEvidenceLinkRow {
  id: string;
  growth_event_id: string;
  evidence_id: string;
  evidence: Relation<LiveEvidenceRow>;
}

function one<T>(relation: Relation<T>): T | null {
  if (relation === null) return null;
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation as T;
}

function list<T>(relation: Relation<T>): readonly T[] {
  if (relation === null) return [];
  if (Array.isArray(relation)) return relation;
  return [relation as T];
}

function recordString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function teacherEditText(teacherEdits: Record<string, unknown> | null): string | null {
  return (
    recordString(teacherEdits, "feedback_after") ??
    recordString(teacherEdits, "feedback_candidate")
  );
}

function observationText(analysisJson: Record<string, unknown>, evidenceClaim: string): string {
  return recordString(analysisJson, "observation") ?? evidenceClaim;
}

function isValidObservableInput(value: unknown): value is StructuredInput {
  return isObservedOnlyStructuredInput(value) || StructuredInputRuntimeSchema.safeParse(value).success;
}

function subjectLabel(timepoints: readonly ReportPageTimepoint[]): string {
  const subjects = [...new Set(timepoints.map(({ activity }) => activity.subject).filter(Boolean))];
  return subjects.length > 0 ? subjects.join(" · ") : "교과 정보 확인 중";
}

function candidateFromLink(
  growthEvent: LiveGrowthEventRow,
  link: LiveGrowthEvidenceLinkRow,
  teacherId: string,
  sourceUrls: ReadonlyMap<string, string>,
): ReportPageTimepoint | null {
  const evidence = one(link.evidence);
  const analysis = evidence ? one(evidence.analyses) : null;
  const submission = analysis ? one(analysis.submissions) : null;
  const assignment = submission ? one(submission.activity_assignments) : null;
  const activity = assignment ? one(assignment.activities) : null;
  const artifact = evidence ? one(evidence.artifacts) : null;
  const review = analysis
    ? [...list(analysis.reviews)].sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))[0] ?? null
    : null;
  const hasOriginalReference = artifact?.artifact_role === "ORIGINAL"
    || (artifact?.artifact_role === "DERIVED" && Boolean(artifact.source_artifact_id));

  if (
    !evidence ||
    !analysis ||
    !submission ||
    !activity ||
    !artifact ||
    !review ||
    link.growth_event_id !== growthEvent.id ||
    link.evidence_id !== evidence.id ||
    evidence.analysis_id !== analysis.id ||
    evidence.artifact_id !== artifact.id ||
    analysis.submission_id !== submission.id ||
    artifact.submission_id !== submission.id ||
    review.reviewer_id !== teacherId ||
    submission.student_id !== growthEvent.student_id ||
    !isValidObservableInput(submission.structured_input) ||
    !APPROVED_OUTPUT_ANALYSIS_STATUSES.includes(analysis.status) ||
    !APPROVED_OUTPUT_ANALYSIS_STATUSES.includes(review.decision) ||
    !hasOriginalReference
  ) {
    return null;
  }

  const editedFeedback = teacherEditText(review.teacher_edits);
  const observation = observationText(analysis.analysis_json, evidence.claim);

  return {
    date: (submission.submitted_at ?? analysis.created_at).slice(0, 10),
    activity: {
      id: activity.id,
      title: activity.title,
      subject: activity.subject,
      status: activity.status,
      created_at: activity.created_at,
    },
    submission: {
      id: submission.id,
      student_id: submission.student_id,
      structured_input: submission.structured_input,
      input_status: submission.input_status,
      process_status: submission.process_status,
      submitted_at: submission.submitted_at,
    },
    artifact: {
      id: artifact.id,
      submission_id: artifact.submission_id,
      storage_path: artifact.storage_path,
      file_name: artifact.file_name,
      mime_type: artifact.mime_type,
      artifact_role: artifact.artifact_role,
      page_start: artifact.page_start,
      page_end: artifact.page_end,
      source_url: sourceUrls.get(artifact.storage_path) ?? null,
    },
    analysis: {
      id: analysis.id,
      submission_id: analysis.submission_id,
      version_no: analysis.version_no,
      analysis_json: { ...analysis.analysis_json, observation },
      status: analysis.status,
      provider: analysis.provider,
      model: analysis.model,
      created_at: analysis.created_at,
    },
    evidence: {
      id: evidence.id,
      analysis_id: evidence.analysis_id,
      artifact_id: evidence.artifact_id,
      question_id: evidence.question_id,
      source_page: evidence.source_page,
      claim: evidence.claim,
      created_at: evidence.created_at,
    },
    review: {
      id: review.id,
      analysis_id: analysis.id,
      reviewer_id: review.reviewer_id,
      decision: review.decision,
      teacher_edits: editedFeedback ? { feedback_after: editedFeedback } : null,
      reviewed_at: review.reviewed_at,
    },
  };
}

export function mapLiveReportRows(
  growthEvent: LiveGrowthEventRow,
  links: readonly LiveGrowthEvidenceLinkRow[],
  teacherId: string,
  sourceUrls: ReadonlyMap<string, string> = new Map(),
): ReportPageModel | null {
  const student = one(growthEvent.students);
  if (!student || student.id !== growthEvent.student_id || growthEvent.status !== "APPROVED") return null;

  const candidates = links
    .map((link) => candidateFromLink(growthEvent, link, teacherId, sourceUrls))
    .filter((timepoint): timepoint is ReportPageTimepoint => timepoint !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const bySubmission = new Map<string, ReportPageTimepoint>();
  for (const timepoint of candidates) {
    if (!bySubmission.has(timepoint.submission.id)) {
      bySubmission.set(timepoint.submission.id, timepoint);
    }
  }

  const timepoints = [...bySubmission.values()];
  const firstTimepoint = timepoints[0];
  if (!firstTimepoint) return null;

  const nonEmptyTimepoints: readonly [ReportPageTimepoint, ...ReportPageTimepoint[]] = [
    firstTimepoint,
    ...timepoints.slice(1),
  ];

  return {
    data_mode: "live",
    report_kind: "growth",
    student: {
      id: student.id,
      student_number: student.student_number,
      name: student.name,
      is_active: student.is_active,
    },
    subject_label: subjectLabel(nonEmptyTimepoints),
    timepoints: nonEmptyTimepoints,
    growthEvent: {
      id: growthEvent.id,
      student_id: growthEvent.student_id,
      description: growthEvent.description,
      status: growthEvent.status,
      created_at: growthEvent.created_at,
    },
    growthEventEvidence: nonEmptyTimepoints.map((timepoint) => ({
      id: links.find((link) => link.evidence_id === timepoint.evidence.id)?.id ?? timepoint.evidence.id,
      growth_event_id: growthEvent.id,
      evidence_id: timepoint.evidence.id,
    })),
    approvedEvidenceCount: nonEmptyTimepoints.length,
    neisDraft: growthEvent.description,
  };
}

export function mapLatestLiveReportRows(
  growthEvents: readonly LiveGrowthEventRow[],
  links: readonly LiveGrowthEvidenceLinkRow[],
  teacherId: string,
  sourceUrls: ReadonlyMap<string, string> = new Map(),
): ReportPageModel | null {
  const newestFirst = [...growthEvents].sort((a, b) => b.created_at.localeCompare(a.created_at));

  for (const growthEvent of newestFirst) {
    const report = mapLiveReportRows(
      growthEvent,
      links.filter((link) => link.growth_event_id === growthEvent.id),
      teacherId,
      sourceUrls,
    );
    if (report) return report;
  }

  return null;
}

function approvedEvidenceCandidate(
  evidence: LiveEvidenceRow,
  teacherId: string,
  sourceUrls: ReadonlyMap<string, string>,
): (ReportPageTimepoint & { student: LiveStudentRow }) | null {
  const analysis = one(evidence.analyses);
  const submission = analysis ? one(analysis.submissions) : null;
  const student = submission ? one(submission.students ?? null) : null;
  const assignment = submission ? one(submission.activity_assignments) : null;
  const activity = assignment ? one(assignment.activities) : null;
  const artifact = one(evidence.artifacts);
  const review = analysis
    ? [...list(analysis.reviews)].sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))[0] ?? null
    : null;
  const hasOriginalReference = artifact?.artifact_role === "ORIGINAL"
    || (artifact?.artifact_role === "DERIVED" && Boolean(artifact.source_artifact_id));

  if (
    !analysis
    || !submission
    || !student
    || !activity
    || !artifact
    || !review
    || evidence.analysis_id !== analysis.id
    || evidence.artifact_id !== artifact.id
    || analysis.submission_id !== submission.id
    || artifact.submission_id !== submission.id
    || submission.student_id !== student.id
    || review.reviewer_id !== teacherId
    || !isValidObservableInput(submission.structured_input)
    || !APPROVED_OUTPUT_ANALYSIS_STATUSES.includes(analysis.status)
    || !APPROVED_OUTPUT_ANALYSIS_STATUSES.includes(review.decision)
    || !hasOriginalReference
  ) {
    return null;
  }

  const editedFeedback = teacherEditText(review.teacher_edits);
  const observation = observationText(analysis.analysis_json, evidence.claim);
  return {
    student,
    date: (submission.submitted_at ?? analysis.created_at).slice(0, 10),
    activity: {
      id: activity.id,
      title: activity.title,
      subject: activity.subject,
      status: activity.status,
      created_at: activity.created_at,
    },
    submission: {
      id: submission.id,
      student_id: submission.student_id,
      structured_input: submission.structured_input,
      input_status: submission.input_status,
      process_status: submission.process_status,
      submitted_at: submission.submitted_at,
    },
    artifact: {
      id: artifact.id,
      submission_id: artifact.submission_id,
      storage_path: artifact.storage_path,
      file_name: artifact.file_name,
      mime_type: artifact.mime_type,
      artifact_role: artifact.artifact_role,
      page_start: artifact.page_start,
      page_end: artifact.page_end,
      source_url: sourceUrls.get(artifact.storage_path) ?? null,
    },
    analysis: {
      id: analysis.id,
      submission_id: analysis.submission_id,
      version_no: analysis.version_no,
      analysis_json: { ...analysis.analysis_json, observation },
      status: analysis.status,
      provider: analysis.provider,
      model: analysis.model,
      created_at: analysis.created_at,
    },
    evidence: {
      id: evidence.id,
      analysis_id: evidence.analysis_id,
      artifact_id: evidence.artifact_id,
      question_id: evidence.question_id,
      source_page: evidence.source_page,
      claim: evidence.claim,
      created_at: evidence.created_at,
    },
    review: {
      id: review.id,
      analysis_id: analysis.id,
      reviewer_id: review.reviewer_id,
      decision: review.decision,
      teacher_edits: editedFeedback ? { feedback_after: editedFeedback } : null,
      reviewed_at: review.reviewed_at,
    },
  };
}

function approvedDraftText(timepoints: readonly ReportPageTimepoint[]): string {
  const latest = timepoints.at(-1);
  if (!latest) return "";
  const feedback = recordString(latest.analysis.analysis_json, "feedback_candidate");
  if (feedback) return feedback;
  const strengths = latest.analysis.analysis_json.strengths;
  if (Array.isArray(strengths)) {
    const descriptions = strengths.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (descriptions.length > 0) return descriptions.join(" ");
  }
  return timepoints.map(({ evidence }) => evidence.claim).join(" ");
}

/** Individual Activity Report: approved Analysis + Evidence is sufficient; GrowthEvent is not fabricated. */
export function mapLatestApprovedAnalysisRows(
  evidenceRows: readonly LiveEvidenceRow[],
  teacherId: string,
  sourceUrls: ReadonlyMap<string, string> = new Map(),
): ReportPageModel | null {
  const candidates = evidenceRows
    .map((evidence) => approvedEvidenceCandidate(evidence, teacherId, sourceUrls))
    .filter((candidate): candidate is ReportPageTimepoint & { student: LiveStudentRow } => candidate !== null)
    .sort((left, right) => left.date.localeCompare(right.date) || left.analysis.created_at.localeCompare(right.analysis.created_at));
  const latest = candidates.at(-1);
  if (!latest) return null;

  const bySubmission = new Map<string, ReportPageTimepoint>();
  for (const candidate of candidates) {
    if (candidate.submission.student_id === latest.student.id && !bySubmission.has(candidate.submission.id)) {
      bySubmission.set(candidate.submission.id, candidate);
    }
  }
  const timepoints = [...bySubmission.values()];
  const firstTimepoint = timepoints[0];
  if (!firstTimepoint) return null;
  const nonEmptyTimepoints: readonly [ReportPageTimepoint, ...ReportPageTimepoint[]] = [
    firstTimepoint,
    ...timepoints.slice(1),
  ];

  return {
    data_mode: "live",
    report_kind: "activity",
    student: {
      id: latest.student.id,
      student_number: latest.student.student_number,
      name: latest.student.name,
      is_active: latest.student.is_active,
    },
    subject_label: subjectLabel(nonEmptyTimepoints),
    timepoints: nonEmptyTimepoints,
    growthEvent: null,
    growthEventEvidence: [],
    approvedEvidenceCount: nonEmptyTimepoints.length,
    neisDraft: approvedDraftText(nonEmptyTimepoints),
  };
}

function hasSupabaseEnvironment(): boolean {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY),
  );
}

function artifactPaths(report: ReportPageModel): string[] {
  return [...new Set(report.timepoints.map(({ artifact }) => artifact.storage_path))];
}

export async function loadLatestReportPageData(): Promise<ReportPageData> {
  if (!hasSupabaseEnvironment() || process.env.NEXT_PUBLIC_AUTH_BYPASS === "true") {
    return { report: null, stats: EMPTY_REPORT_PAGE_STATS };
  }

  const { requireTeacherReportScope } = await import("../auth/ownership");
  const { teacherId, supabase } = await requireTeacherReportScope();
  const [students, submissions, approvedAnalyses, evidence] = await Promise.all([
    supabase
      .from("students")
      .select("id, classes!inner(teacher_id)", { count: "exact", head: true })
      .eq("classes.teacher_id", teacherId)
      .eq("is_active", true),
    supabase
      .from("submissions")
      .select("id, activity_assignments!inner(activities!inner(teacher_id))", { count: "exact", head: true })
      .eq("activity_assignments.activities.teacher_id", teacherId)
      .not("submitted_at", "is", null),
    supabase
      .from("analyses")
      .select(
        "id, submissions!inner(activity_assignments!inner(activities!inner(teacher_id)))",
        { count: "exact", head: true },
      )
      .eq("submissions.activity_assignments.activities.teacher_id", teacherId)
      .in("status", APPROVED_OUTPUT_ANALYSIS_STATUSES),
    supabase
      .from("evidence")
      .select(
        "id, analyses!inner(submissions!inner(activity_assignments!inner(activities!inner(teacher_id))))",
        { count: "exact", head: true },
      )
      .eq("analyses.submissions.activity_assignments.activities.teacher_id", teacherId),
  ]);

  const queryUnavailable = [students, submissions, approvedAnalyses, evidence].some(
    ({ error }) => Boolean(error),
  );
  const stats: ReportPageStats = {
    connection: queryUnavailable ? "unavailable" : "ready",
    studentCount: students.count ?? 0,
    submissionCount: submissions.count ?? 0,
    approvedAnalysisCount: approvedAnalyses.count ?? 0,
    evidenceCount: evidence.count ?? 0,
  };

  const growthResult = await supabase
    .from("growth_events")
    .select(
      "id, student_id, description, status, created_at, students!inner(id, student_number, name, is_active, classes!inner(name, teacher_id))",
    )
    .eq("students.classes.teacher_id", teacherId)
    .eq("status", "APPROVED")
    .order("created_at", { ascending: false });

  const growthEvents = (growthResult.data ?? []) as unknown as LiveGrowthEventRow[];
  if (!growthResult.error && growthEvents.length > 0) {
    const linkResult = await supabase
      .from("growth_event_evidence")
      .select(
        `id, growth_event_id, evidence_id,
         evidence!inner(
           id, analysis_id, artifact_id, question_id, source_page, claim, created_at,
           analyses!inner(
             id, submission_id, version_no, analysis_json, status, provider, model, created_at,
             submissions!inner(
               id, student_id, structured_input, input_status, process_status, submitted_at,
               activity_assignments!inner(
                 activities!inner(id, title, subject, domain, unit, status, created_at)
               )
             ),
             reviews(id, reviewer_id, decision, teacher_edits, reviewed_at)
           ),
           artifacts(id, submission_id, source_artifact_id, storage_path, file_name, mime_type, artifact_role, page_start, page_end)
         )`,
      )
      .in("growth_event_id", growthEvents.map(({ id }) => id));

    if (!linkResult.error) {
      const links = (linkResult.data ?? []) as unknown as LiveGrowthEvidenceLinkRow[];
      const unsignedGrowthReport = mapLatestLiveReportRows(growthEvents, links, teacherId);
      if (unsignedGrowthReport) {
        const signedEntries = await Promise.all(
          artifactPaths(unsignedGrowthReport).map(async (path) => {
            const { data } = await supabase.storage.from(STORAGE.BUCKET).createSignedUrl(path, 600);
            return [path, data?.signedUrl ?? null] as const;
          }),
        );
        const sourceUrls = new Map(
          signedEntries.filter((entry): entry is readonly [string, string] => entry[1] !== null),
        );
        return { report: mapLatestLiveReportRows(growthEvents, links, teacherId, sourceUrls), stats };
      }
    }
  }

  const approvedEvidenceResult = await supabase
    .from("evidence")
    .select(
      `id, analysis_id, artifact_id, question_id, source_page, claim, created_at,
       analyses!inner(
         id, submission_id, version_no, analysis_json, status, provider, model, created_at,
         submissions!inner(
           id, student_id, structured_input, input_status, process_status, submitted_at,
           students!inner(id, student_number, name, is_active, classes!inner(name, teacher_id)),
           activity_assignments!inner(
             activities!inner(id, title, subject, domain, unit, status, created_at, teacher_id)
           )
         ),
         reviews(id, reviewer_id, decision, teacher_edits, reviewed_at)
       ),
       artifacts(id, submission_id, source_artifact_id, storage_path, file_name, mime_type, artifact_role, page_start, page_end)`,
    )
    .eq("analyses.submissions.activity_assignments.activities.teacher_id", teacherId)
    .eq("analyses.submissions.students.classes.teacher_id", teacherId)
    .in("analyses.status", APPROVED_OUTPUT_ANALYSIS_STATUSES)
    .order("created_at", { ascending: true });
  if (approvedEvidenceResult.error) return { report: null, stats };

  const approvedEvidenceRows = (approvedEvidenceResult.data ?? []) as unknown as LiveEvidenceRow[];
  const unsignedActivityReport = mapLatestApprovedAnalysisRows(approvedEvidenceRows, teacherId);
  if (!unsignedActivityReport) return { report: null, stats };
  const signedEntries = await Promise.all(
    artifactPaths(unsignedActivityReport).map(async (path) => {
      const { data } = await supabase.storage.from(STORAGE.BUCKET).createSignedUrl(path, 600);
      return [path, data?.signedUrl ?? null] as const;
    }),
  );
  const sourceUrls = new Map(
    signedEntries.filter((entry): entry is readonly [string, string] => entry[1] !== null),
  );
  return {
    report: mapLatestApprovedAnalysisRows(approvedEvidenceRows, teacherId, sourceUrls),
    stats,
  };
}
