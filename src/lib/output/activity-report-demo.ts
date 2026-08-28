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
import type { AnalysisStatus } from "@/shared/types/status";

export const APPROVED_OUTPUT_ANALYSIS_STATUSES: readonly AnalysisStatus[] = [
  "APPROVED",
  "EDITED_APPROVED",
];

type DemoStudent = Pick<Student, "id" | "student_number" | "name" | "is_active">;
type DemoActivity = Pick<Activity, "id" | "title" | "subject" | "status" | "created_at">;
type DemoSubmission = Pick<
  Submission,
  "id" | "student_id" | "structured_input" | "input_status" | "process_status" | "submitted_at"
>;
type DemoArtifact = Pick<
  Artifact,
  "id" | "submission_id" | "storage_path" | "file_name" | "mime_type" | "artifact_role" | "page_start" | "page_end"
>;
type DemoAnalysis = Pick<
  Analysis,
  "id" | "submission_id" | "version_no" | "analysis_json" | "status" | "provider" | "model" | "created_at"
>;
type DemoEvidence = Pick<
  Evidence,
  "id" | "analysis_id" | "artifact_id" | "question_id" | "source_page" | "claim" | "created_at"
>;

export interface TeacherEditDelta {
  feedback_before: string;
  feedback_after: string;
  rationale: string;
}

type DemoReview = Pick<Review, "id" | "analysis_id" | "reviewer_id" | "decision" | "reviewed_at"> & {
  teacher_edits: TeacherEditDelta | null;
};
type DemoGrowthEvent = Pick<GrowthEvent, "id" | "student_id" | "description" | "status" | "created_at">;
type DemoGrowthEventEvidence = Pick<GrowthEventEvidence, "id" | "growth_event_id" | "evidence_id">;

export interface ActivityReportDemoTimepoint {
  date: string;
  activity: DemoActivity;
  submission: DemoSubmission;
  artifact: DemoArtifact;
  analysis: DemoAnalysis;
  analyses: readonly DemoAnalysis[];
  evidence: DemoEvidence;
  review: DemoReview;
}

export interface ActivityReportDemo {
  contract_version: "output-demo-v0.1";
  provisional: true;
  student: DemoStudent;
  timepoints: readonly [ActivityReportDemoTimepoint, ActivityReportDemoTimepoint];
  growthEvent: DemoGrowthEvent;
  growthEventEvidence: readonly [DemoGrowthEventEvidence, DemoGrowthEventEvidence];
}

const DEMO_PDF_STORAGE_PATH = "demo/trace-fraction-activity.pdf";
type ResponseValueKind = "number" | "string";
type ResponseSchema = Readonly<Record<string, ResponseValueKind>>;

const OBSERVED_RESPONSE_SCHEMAS = {
  selection: { selected_option: "number" },
  long_text: { raw_text: "string" },
  work_sample: {
    marked_parts: "number",
    total_parts: "number",
    written_expression: "string",
  },
} as const satisfies Record<string, ResponseSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isAllowedResponseType(value: string): value is keyof typeof OBSERVED_RESPONSE_SCHEMAS {
  return Object.hasOwn(OBSERVED_RESPONSE_SCHEMAS, value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  return (
    Object.keys(value).length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

function matchesResponseSchema(response: Record<string, unknown>, schema: ResponseSchema): boolean {
  const schemaEntries = Object.entries(schema);
  if (Object.keys(response).length !== schemaEntries.length) {
    return false;
  }

  return schemaEntries.every(([key, valueKind]) => typeof response[key] === valueKind);
}

export function isObservedOnlyStructuredInput(input: unknown): input is StructuredInput {
  if (!isRecord(input) || !hasExactKeys(input, ["schema_version", "questions"])) {
    return false;
  }

  const candidate = input as Partial<StructuredInput>;
  return (
    candidate.schema_version === "observed-input-v0.1" &&
    Array.isArray(candidate.questions) &&
    candidate.questions.length > 0 &&
    candidate.questions.every(
      (question) =>
        isRecord(question) &&
        hasExactKeys(question, ["question_id", "response_type", "response"]) &&
        typeof question.question_id === "string" &&
        typeof question.response_type === "string" &&
        isAllowedResponseType(question.response_type) &&
        isRecord(question.response) &&
        matchesResponseSchema(question.response, OBSERVED_RESPONSE_SCHEMAS[question.response_type]),
    )
  );
}

export function selectApprovedOutputAnalyses(
  structuredInput: unknown,
  analyses: readonly DemoAnalysis[],
): DemoAnalysis[] {
  if (!isObservedOnlyStructuredInput(structuredInput)) {
    throw new Error("Output selection requires observed-only StructuredInput.");
  }

  return analyses.filter((analysis) => APPROVED_OUTPUT_ANALYSIS_STATUSES.includes(analysis.status));
}

export const activityReportDemo = {
  contract_version: "output-demo-v0.1",
  provisional: true,
  student: {
    id: "synthetic-student-01",
    student_number: 1,
    name: "김하늘",
    is_active: true,
  } satisfies DemoStudent,
  timepoints: [
    {
      date: "2026-08-18",
      activity: {
        id: "synthetic-activity-fraction-models",
        title: "분수 모형으로 양 나타내기",
        subject: "수학",
        status: "ACTIVE",
        created_at: "2026-08-18T08:00:00.000Z",
      } satisfies DemoActivity,
      submission: {
        id: "synthetic-submission-fraction-models",
        student_id: "synthetic-student-01",
        structured_input: {
          schema_version: "observed-input-v0.1",
          questions: [
            {
              question_id: "q-fraction-model-1",
              response_type: "work_sample",
              response: {
                marked_parts: 2,
                total_parts: 4,
                written_expression: "2/4",
              },
            },
          ],
        },
        input_status: "READY_FOR_PROCESS",
        process_status: "APPROVED",
        submitted_at: "2026-08-18T09:15:00.000Z",
      } satisfies DemoSubmission,
      artifact: {
        id: "synthetic-artifact-fraction-page-1",
        submission_id: "synthetic-submission-fraction-models",
        storage_path: DEMO_PDF_STORAGE_PATH,
        file_name: "trace-fraction-activity.pdf",
        mime_type: "application/pdf",
        artifact_role: "ORIGINAL",
        page_start: 1,
        page_end: 1,
      } satisfies DemoArtifact,
      analysis: {
        id: "synthetic-analysis-fraction-models-approved",
        submission_id: "synthetic-submission-fraction-models",
        version_no: 1,
        analysis_json: {
          schema_version: "output-demo-v0.1",
          provisional: true,
          observation: "그림과 분수식에서 4등분한 전체 중 색칠한 2부분을 2/4로 나타냈습니다.",
        },
        status: "APPROVED",
        provider: "synthetic-fixture",
        model: "none",
        created_at: "2026-08-18T09:30:00.000Z",
      } satisfies DemoAnalysis,
      analyses: [
        {
          id: "synthetic-analysis-fraction-models-approved",
          submission_id: "synthetic-submission-fraction-models",
          version_no: 1,
          analysis_json: {
            schema_version: "output-demo-v0.1",
            provisional: true,
            observation: "그림과 분수식에서 4등분한 전체 중 색칠한 2부분을 2/4로 나타냈습니다.",
          },
          status: "APPROVED",
          provider: "synthetic-fixture",
          model: "none",
          created_at: "2026-08-18T09:30:00.000Z",
        } satisfies DemoAnalysis,
        {
          id: "synthetic-analysis-fraction-models-rejected",
          submission_id: "synthetic-submission-fraction-models",
          version_no: 2,
          analysis_json: {
            schema_version: "output-demo-v0.1",
            provisional: true,
            observation: "제외 후보: 관찰된 작업을 넘어선 성취 판단이 포함되었습니다.",
          },
          status: "REJECTED",
          provider: "synthetic-fixture",
          model: "none",
          created_at: "2026-08-18T09:32:00.000Z",
        } satisfies DemoAnalysis,
      ],
      evidence: {
        id: "synthetic-evidence-fraction-page-1",
        analysis_id: "synthetic-analysis-fraction-models-approved",
        artifact_id: "synthetic-artifact-fraction-page-1",
        question_id: "q-fraction-model-1",
        source_page: 1,
        claim: "학생 산출물에서 똑같이 나눈 4부분 중 2부분을 색칠하고 2/4로 기록한 모습이 확인됩니다.",
        created_at: "2026-08-18T09:35:00.000Z",
      } satisfies DemoEvidence,
      review: {
        id: "synthetic-review-fraction-models-approved",
        analysis_id: "synthetic-analysis-fraction-models-approved",
        reviewer_id: "synthetic-teacher-01",
        decision: "APPROVED",
        teacher_edits: null,
        reviewed_at: "2026-08-18T09:40:00.000Z",
      } satisfies DemoReview,
    },
    {
      date: "2026-08-25",
      activity: {
        id: "synthetic-activity-fraction-equivalence",
        title: "모형으로 동치분수 비교하기",
        subject: "수학",
        status: "ACTIVE",
        created_at: "2026-08-25T08:00:00.000Z",
      } satisfies DemoActivity,
      submission: {
        id: "synthetic-submission-fraction-equivalence",
        student_id: "synthetic-student-01",
        structured_input: {
          schema_version: "observed-input-v0.1",
          questions: [
            {
              question_id: "q-fraction-equivalence-1",
              response_type: "work_sample",
              response: {
                marked_parts: 4,
                total_parts: 8,
                written_expression: "4/8 = 2/4",
              },
            },
          ],
        },
        input_status: "READY_FOR_PROCESS",
        process_status: "APPROVED",
        submitted_at: "2026-08-25T09:20:00.000Z",
      } satisfies DemoSubmission,
      artifact: {
        id: "synthetic-artifact-fraction-page-2",
        submission_id: "synthetic-submission-fraction-equivalence",
        storage_path: DEMO_PDF_STORAGE_PATH,
        file_name: "trace-fraction-activity.pdf",
        mime_type: "application/pdf",
        artifact_role: "ORIGINAL",
        page_start: 2,
        page_end: 2,
      } satisfies DemoArtifact,
      analysis: {
        id: "synthetic-analysis-fraction-equivalence-edited-approved",
        submission_id: "synthetic-submission-fraction-equivalence",
        version_no: 1,
        analysis_json: {
          schema_version: "output-demo-v0.1",
          provisional: true,
          observation: "같은 양을 색칠한 두 모형을 4/8과 2/4로 연결해 나타냈습니다.",
        },
        status: "EDITED_APPROVED",
        provider: "synthetic-fixture",
        model: "none",
        created_at: "2026-08-25T09:35:00.000Z",
      } satisfies DemoAnalysis,
      analyses: [
        {
          id: "synthetic-analysis-fraction-equivalence-edited-approved",
          submission_id: "synthetic-submission-fraction-equivalence",
          version_no: 1,
          analysis_json: {
            schema_version: "output-demo-v0.1",
            provisional: true,
            observation: "같은 양을 색칠한 두 모형을 4/8과 2/4로 연결해 나타냈습니다.",
          },
          status: "EDITED_APPROVED",
          provider: "synthetic-fixture",
          model: "none",
          created_at: "2026-08-25T09:35:00.000Z",
        } satisfies DemoAnalysis,
      ],
      evidence: {
        id: "synthetic-evidence-fraction-page-2",
        analysis_id: "synthetic-analysis-fraction-equivalence-edited-approved",
        artifact_id: "synthetic-artifact-fraction-page-2",
        question_id: "q-fraction-equivalence-1",
        source_page: 2,
        claim: "학생 산출물에서 같은 양을 나타낸 두 모형을 4/8 = 2/4로 기록한 모습이 확인됩니다.",
        created_at: "2026-08-25T09:42:00.000Z",
      } satisfies DemoEvidence,
      review: {
        id: "synthetic-review-fraction-equivalence-edited-approved",
        analysis_id: "synthetic-analysis-fraction-equivalence-edited-approved",
        reviewer_id: "synthetic-teacher-01",
        decision: "EDITED_APPROVED",
        teacher_edits: {
          feedback_before: "다음에는 크기가 같은 분수를 사용해 보세요.",
          feedback_after:
            "색칠한 두 영역의 크기를 비교하고, 4/8을 2/4로 다시 묶어 나타낼 수 있는 까닭을 설명해 보세요.",
          rationale:
            "일반적인 안내를 학생 산출물에서 확인된 다시 묶기 전략과 직접 연결된 질문으로 수정했습니다.",
        },
        reviewed_at: "2026-08-25T09:50:00.000Z",
      } satisfies DemoReview,
    },
  ],
  growthEvent: {
    id: "synthetic-growth-fraction-representation",
    student_id: "synthetic-student-01",
    description:
      "두 차례의 산출물에서 같은 양을 분수 모형과 식으로 나타내고, 2/4와 4/8의 관계를 연결해 표현했습니다.",
    status: "APPROVED",
    created_at: "2026-08-25T10:00:00.000Z",
  } satisfies DemoGrowthEvent,
  growthEventEvidence: [
    {
      id: "synthetic-growth-evidence-link-1",
      growth_event_id: "synthetic-growth-fraction-representation",
      evidence_id: "synthetic-evidence-fraction-page-1",
    } satisfies DemoGrowthEventEvidence,
    {
      id: "synthetic-growth-evidence-link-2",
      growth_event_id: "synthetic-growth-fraction-representation",
      evidence_id: "synthetic-evidence-fraction-page-2",
    } satisfies DemoGrowthEventEvidence,
  ],
} satisfies ActivityReportDemo;

export function validateActivityReportDemo(fixture: ActivityReportDemo): boolean {
  if (
    fixture.contract_version !== "output-demo-v0.1" ||
    fixture.provisional !== true ||
    fixture.timepoints.length !== 2 ||
    fixture.growthEvent.status !== "APPROVED"
  ) {
    return false;
  }

  const [firstTimepoint, secondTimepoint] = fixture.timepoints;
  if (
    firstTimepoint.date === secondTimepoint.date ||
    firstTimepoint.submission.submitted_at === secondTimepoint.submission.submitted_at ||
    firstTimepoint.artifact.storage_path !== secondTimepoint.artifact.storage_path ||
    firstTimepoint.artifact.page_start !== 1 ||
    firstTimepoint.artifact.page_end !== 1 ||
    secondTimepoint.artifact.page_start !== 2 ||
    secondTimepoint.artifact.page_end !== 2
  ) {
    return false;
  }

  const evidenceIds = new Set<string>();
  for (const timepoint of fixture.timepoints) {
    if (
      !isObservedOnlyStructuredInput(timepoint.submission.structured_input) ||
      timepoint.evidence.artifact_id !== timepoint.artifact.id ||
      timepoint.evidence.analysis_id !== timepoint.analysis.id ||
      timepoint.review.analysis_id !== timepoint.analysis.id ||
      timepoint.review.decision !== timepoint.analysis.status ||
      !APPROVED_OUTPUT_ANALYSIS_STATUSES.includes(timepoint.analysis.status) ||
      !timepoint.analyses.some((analysis) => analysis.id === timepoint.analysis.id) ||
      timepoint.analysis.analysis_json.schema_version !== "output-demo-v0.1" ||
      timepoint.analysis.analysis_json.provisional !== true
    ) {
      return false;
    }

    evidenceIds.add(timepoint.evidence.id);
  }

  const linkedEvidenceIds = new Set(fixture.growthEventEvidence.map(({ evidence_id }) => evidence_id));
  return (
    linkedEvidenceIds.size === evidenceIds.size &&
    [...evidenceIds].every((evidenceId) => linkedEvidenceIds.has(evidenceId)) &&
    fixture.growthEventEvidence.every(({ growth_event_id }) => growth_event_id === fixture.growthEvent.id)
  );
}
