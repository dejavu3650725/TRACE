import assert from "node:assert/strict";
import test from "node:test";
import type { AnalysisStatus, ReviewDecision } from "@/shared/types/status";

const {
  mapLiveReportRows,
}: typeof import("./report-page-data") = await import("./report-page-data" + ".ts");

const growthEvent = {
  id: "growth-1",
  student_id: "student-1",
  description: "분수 표현을 비교하며 자신의 풀이 근거를 구체적으로 설명함.",
  status: "APPROVED" as const,
  created_at: "2026-08-29T03:00:00.000Z",
  students: {
    id: "student-1",
    student_number: 7,
    name: "테스트학생",
    is_active: true,
    classes: { name: "3학년 1반" },
  },
};

function approvedLink() {
  return {
    id: "growth-evidence-1",
    growth_event_id: "growth-1",
    evidence_id: "evidence-1",
    evidence: {
      id: "evidence-1",
      analysis_id: "analysis-1",
      artifact_id: "artifact-1",
      question_id: "question-1",
      source_page: 2,
      claim: "서로 다른 분수 표현을 그림과 식으로 연결함.",
      created_at: "2026-08-29T02:30:00.000Z",
      analyses: {
        id: "analysis-1",
        submission_id: "submission-1",
        version_no: 1,
        analysis_json: { feedback_candidate: "근거를 더 자세히 써 보세요." },
        status: "EDITED_APPROVED" as AnalysisStatus,
        provider: "test-provider",
        model: "test-model",
        created_at: "2026-08-29T02:00:00.000Z",
        submissions: {
          id: "submission-1",
          student_id: "student-1",
          structured_input: {
            schema_version: "observed-input-v0.1",
            questions: [
              {
                question_id: "question-1",
                response_type: "work_sample",
                response: {
                  marked_parts: 3,
                  total_parts: 6,
                  written_expression: "3/6",
                },
              },
            ],
          },
          input_status: "READY_FOR_PROCESS" as const,
          process_status: "APPROVED" as const,
          submitted_at: "2026-08-28T07:00:00.000Z",
          activity_assignments: {
            activities: {
              id: "activity-1",
              title: "분수 표현 비교하기",
              subject: "수학",
              domain: "수와 연산",
              unit: "분수",
              status: "ACTIVE" as const,
              created_at: "2026-08-27T07:00:00.000Z",
            },
          },
        },
        reviews: {
          id: "review-1",
          reviewer_id: "teacher-1",
          decision: "EDITED_APPROVED" as ReviewDecision,
          teacher_edits: { feedback_candidate: "식과 그림의 관계를 설명해 보세요." },
          reviewed_at: "2026-08-29T02:20:00.000Z",
        },
      },
      artifacts: {
        id: "artifact-1",
        submission_id: "submission-1",
        storage_path: "teachers/test/submissions/submission-1/original/artifact.pdf",
        file_name: "분수활동.pdf",
        mime_type: "application/pdf",
        artifact_role: "ORIGINAL" as const,
        page_start: 1,
        page_end: 2,
      },
    },
  };
}

test("approved teacher-owned rows map to the exact live report values", () => {
  const link = approvedLink();
  const signedUrl = "https://example.test/signed-artifact";
  const report = mapLiveReportRows(
    growthEvent,
    [link],
    new Map([[link.evidence.artifacts.storage_path, signedUrl]]),
  );

  assert.ok(report);
  assert.equal(report.data_mode, "live");
  assert.equal(report.student.name, "테스트학생");
  assert.equal(report.student.student_number, 7);
  assert.equal(report.subject_label, "수학");
  assert.equal(report.timepoints[0].activity.title, "분수 표현 비교하기");
  assert.equal(report.timepoints[0].evidence.claim, link.evidence.claim);
  assert.equal(report.timepoints[0].artifact.source_url, signedUrl);
  assert.equal(report.timepoints[0].review.teacher_edits?.feedback_after, "식과 그림의 관계를 설명해 보세요.");
  assert.equal(report.neisDraft, growthEvent.description);
});

test("unapproved analysis and judgment-shaped input cannot become a live report", () => {
  const rejected = approvedLink();
  rejected.evidence.analyses.status = "REJECTED";
  rejected.evidence.analyses.reviews.decision = "REJECTED";
  assert.equal(mapLiveReportRows(growthEvent, [rejected]), null);

  const invalidInput = approvedLink();
  invalidInput.evidence.analyses.submissions.structured_input = {
    ...invalidInput.evidence.analyses.submissions.structured_input,
    judgment: "성취 수준이 높음",
  } as typeof invalidInput.evidence.analyses.submissions.structured_input;
  assert.equal(mapLiveReportRows(growthEvent, [invalidInput]), null);
});
