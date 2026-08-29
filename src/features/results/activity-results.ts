export type ActivityResultInputStatus =
  | "UPLOADING"
  | "STORED"
  | "PREPROCESSING"
  | "STRUCTURING"
  | "REVIEW_PENDING"
  | "READY_FOR_PROCESS"
  | "FAILED";

export type ActivityResultProcessStatus =
  | "NOT_STARTED"
  | "READY_TO_ANALYZE"
  | "ANALYZING"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "FAILED";

export type ActivityResultStudent = {
  id: string;
  studentNumber: number;
  studentName: string;
};

export type ActivityResultSubmission = {
  id: string;
  studentId: string;
  inputStatus: ActivityResultInputStatus;
  processStatus: ActivityResultProcessStatus;
  submittedAt: string | null;
  updatedAt: string;
  artifactCount: number;
};

export type ActivityResultAssignment = {
  assignmentId: string;
  activityId: string;
  title: string;
  activityCode: string | null;
  grade: number | null;
  subject: string | null;
  domain: string | null;
  standardIds: string[];
  classId: string;
  className: string;
  createdAt: string;
  students: ActivityResultStudent[];
  submissions: ActivityResultSubmission[];
};

export type ActivityResultFilters = {
  keyword?: string;
  classId?: string;
  subject?: string;
  standardId?: string;
  studentId?: string;
  inputStatus?: ActivityResultInputStatus;
  periodDays?: number;
};

export type ActivityResultRow = {
  student: ActivityResultStudent;
  submission: ActivityResultSubmission | null;
};

export type ActivityResultCard = ActivityResultAssignment & {
  total: number;
  submitted: number;
  missing: number;
  reviewPending: number;
  readyForProcess: number;
  rows: ActivityResultRow[];
};

function isReviewPending(submission: ActivityResultSubmission): boolean {
  return submission.inputStatus === "REVIEW_PENDING";
}

function isReadyForProcess(submission: ActivityResultSubmission): boolean {
  return submission.inputStatus === "READY_FOR_PROCESS"
    && (submission.processStatus === "NOT_STARTED" || submission.processStatus === "READY_TO_ANALYZE");
}

export function buildActivityResultCards(
  assignments: readonly ActivityResultAssignment[],
  filters: ActivityResultFilters = {},
  now = new Date(),
): ActivityResultCard[] {
  const cutoff = filters.periodDays
    ? new Date(now.getTime() - filters.periodDays * 24 * 60 * 60 * 1_000)
    : null;
  const keyword = filters.keyword?.trim().toLocaleLowerCase("ko-KR") ?? "";

  return assignments
    .filter((assignment) => !keyword || [
      assignment.title,
      assignment.activityCode,
      assignment.subject,
      assignment.domain,
      assignment.className,
      ...assignment.standardIds,
    ].filter(Boolean).join(" ").toLocaleLowerCase("ko-KR").includes(keyword))
    .filter((assignment) => !filters.classId || assignment.classId === filters.classId)
    .filter((assignment) => !filters.subject || assignment.subject === filters.subject)
    .filter((assignment) => !filters.standardId || assignment.standardIds.includes(filters.standardId))
    .filter((assignment) => !cutoff || new Date(assignment.createdAt) >= cutoff)
    .map((assignment) => {
      const submissionByStudent = new Map(
        assignment.submissions.map((submission) => [submission.studentId, submission]),
      );
      const allRows = assignment.students.map((student) => ({
        student,
        submission: submissionByStudent.get(student.id) ?? null,
      }));
      const rows = filters.studentId
        ? allRows.filter((row) => row.student.id === filters.studentId)
        : allRows;
      const submittedRows = allRows.filter((row) => row.submission !== null);

      return {
        ...assignment,
        total: allRows.length,
        submitted: submittedRows.length,
        missing: allRows.length - submittedRows.length,
        reviewPending: submittedRows.filter((row) => isReviewPending(row.submission!)).length,
        readyForProcess: submittedRows.filter((row) => isReadyForProcess(row.submission!)).length,
        rows,
      };
    })
    .filter((card) => card.rows.length > 0)
    .filter((card) => !filters.inputStatus || card.rows.some((row) => row.submission?.inputStatus === filters.inputStatus))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export function filterActivityResultCardsByTab(
  cards: readonly ActivityResultCard[],
  tab: "all" | "review" | "ready",
): ActivityResultCard[] {
  switch (tab) {
    case "review": return cards.filter((card) => card.reviewPending > 0);
    case "ready": return cards.filter((card) => card.readyForProcess > 0);
    default: return [...cards];
  }
}
