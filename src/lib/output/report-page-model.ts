import type {
  Activity,
  Analysis,
  Artifact,
  Evidence,
  GrowthEvent,
  GrowthEventEvidence,
  Review,
  StructuredInput,
  Student,
  Submission,
} from "@/shared/types/db";

export type ReportDataConnection = "ready" | "not-configured" | "unavailable";

export interface ReportPageStats {
  connection: ReportDataConnection;
  studentCount: number;
  submissionCount: number;
  approvedAnalysisCount: number;
  evidenceCount: number;
}

type ReportStudent = Pick<Student, "id" | "student_number" | "name" | "is_active">;
type ReportActivity = Pick<Activity, "id" | "title" | "subject" | "status" | "created_at">;
type ReportSubmission = Omit<Pick<
  Submission,
  "id" | "student_id" | "structured_input" | "input_status" | "process_status" | "submitted_at"
>, "structured_input"> & { structured_input: StructuredInput };
type ReportArtifact = Pick<
  Artifact,
  "id" | "submission_id" | "storage_path" | "file_name" | "mime_type" | "artifact_role" | "page_start" | "page_end"
> & {
  source_url: string | null;
};
type ReportAnalysis = Pick<
  Analysis,
  "id" | "submission_id" | "version_no" | "analysis_json" | "status" | "provider" | "model" | "created_at"
>;
type ReportEvidence = Pick<
  Evidence,
  "id" | "analysis_id" | "artifact_id" | "question_id" | "source_page" | "claim" | "created_at"
>;
type ReportReview = Pick<Review, "id" | "analysis_id" | "reviewer_id" | "decision" | "reviewed_at"> & {
  teacher_edits: { feedback_after: string } | null;
};
type ReportGrowthEvent = Pick<
  GrowthEvent,
  "id" | "student_id" | "description" | "status" | "created_at"
>;
type ReportGrowthEventEvidence = Pick<
  GrowthEventEvidence,
  "id" | "growth_event_id" | "evidence_id"
>;

export interface ReportPageTimepoint {
  date: string;
  activity: ReportActivity;
  submission: ReportSubmission;
  artifact: ReportArtifact;
  analysis: ReportAnalysis;
  evidence: ReportEvidence;
  review: ReportReview;
}

export interface ReportPageModel {
  data_mode: "live";
  student: ReportStudent;
  subject_label: string;
  timepoints: readonly [ReportPageTimepoint, ...ReportPageTimepoint[]];
  growthEvent: ReportGrowthEvent;
  growthEventEvidence: readonly ReportGrowthEventEvidence[];
  neisDraft: string;
}

export interface ReportPageData {
  report: ReportPageModel | null;
  stats: ReportPageStats;
}

export const EMPTY_REPORT_PAGE_STATS: ReportPageStats = {
  connection: "not-configured",
  studentCount: 0,
  submissionCount: 0,
  approvedAnalysisCount: 0,
  evidenceCount: 0,
};
