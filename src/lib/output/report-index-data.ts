import "server-only";

import { requireTeacherReportScope } from "@/lib/auth/ownership";
import { APPROVED_OUTPUT_ANALYSIS_STATUSES } from "@/lib/output/activity-report-demo";

type Relation<T> = T | readonly T[] | null;

interface ReviewRow {
  reviewer_id: string;
  decision: string;
  teacher_edits: Record<string, unknown> | null;
  reviewed_at: string;
}

interface EvidenceRow {
  id: string;
  standard_id: string | null;
  question_id: string | null;
  source_page: number | null;
  claim: string;
  analyses: Relation<{
    id: string;
    submission_id: string;
    analysis_json: Record<string, unknown>;
    status: string;
    created_at: string;
    submissions: Relation<{
      id: string;
      submitted_at: string | null;
      students: Relation<{
        id: string;
        student_number: number;
        name: string;
        classes: Relation<{ id: string; name: string; teacher_id: string }>;
      }>;
      activity_assignments: Relation<{
        activities: Relation<{
          id: string;
          title: string;
          subject: string | null;
          domain: string | null;
          unit: string | null;
          activity_standards: Relation<{ standard_id: string }>;
        }>;
      }>;
    }>;
    reviews: Relation<ReviewRow>;
  }>;
}

export interface ReportDifficulty {
  text: string;
  isRepeatedError: boolean;
}

export interface ReportEvidenceItem {
  id: string;
  standardId: string | null;
  questionId: string | null;
  sourcePage: number | null;
  claim: string;
}

export interface ReportTimelineItem {
  analysisId: string;
  submissionId: string;
  activityId: string;
  activityTitle: string;
  subject: string;
  domain: string | null;
  unit: string | null;
  observedAt: string;
  achievementLevel: string | null;
  strengths: string[];
  difficulties: ReportDifficulty[];
  evidence: ReportEvidenceItem[];
  feedback: string | null;
  standards: string[];
}

export type StudentLearningTrend = "UP" | "STABLE" | "DOWN" | "NEW" | "UNKNOWN";

export interface StudentReportIndexItem {
  studentId: string;
  studentNumber: number;
  studentName: string;
  classId: string;
  className: string;
  records: ReportTimelineItem[];
  subjects: string[];
  trend: StudentLearningTrend;
  hasRepeatedDifficulty: boolean;
  approvedGrowthEvents: Array<{
    id: string;
    standardId: string | null;
    description: string;
    createdAt: string;
  }>;
  searchText: string;
}

export interface ReportIndexData {
  students: StudentReportIndexItem[];
  approvedRecordCount: number;
  approvedEvidenceCount: number;
  cumulativeStudentCount: number;
  repeatedDifficultyStudentCount: number;
}

function one<T>(relation: Relation<T>): T | null {
  if (relation === null) return null;
  return Array.isArray(relation) ? relation[0] ?? null : (relation as T);
}

function list<T>(relation: Relation<T>): readonly T[] {
  if (relation === null) return [];
  return Array.isArray(relation) ? relation : [relation as T];
}

function recordString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (
    typeof item === "string" && item.trim() ? [item.trim()] : []
  ));
}

function difficultyList(value: unknown): ReportDifficulty[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
    return text ? [{ text, isRepeatedError: candidate.is_repeated_error === true }] : [];
  });
}

function approvedReview(reviews: Relation<ReviewRow>, teacherId: string): ReviewRow | null {
  return [...list(reviews)]
    .filter((review) => (
      review.reviewer_id === teacherId
      && ["APPROVED", "EDITED_APPROVED"].includes(review.decision)
    ))
    .sort((left, right) => right.reviewed_at.localeCompare(left.reviewed_at))[0] ?? null;
}

function trendFor(records: readonly ReportTimelineItem[]): StudentLearningTrend {
  if (records.length < 2) return "NEW";
  const ranks: Record<string, number> = { 하: 0, 중: 1, 상: 2 };
  const first = records.find((record) => record.achievementLevel && record.achievementLevel in ranks);
  const latest = [...records].reverse().find((record) => record.achievementLevel && record.achievementLevel in ranks);
  if (!first?.achievementLevel || !latest?.achievementLevel) return "UNKNOWN";
  const delta = ranks[latest.achievementLevel] - ranks[first.achievementLevel];
  return delta > 0 ? "UP" : delta < 0 ? "DOWN" : "STABLE";
}

/**
 * OUTPUT 조회용 데이터. 확정 근거는 현재 교사가 승인한 Analysis/Evidence와
 * 승인된 GrowthEvent만 포함하며, 별도의 점수나 성장 이벤트를 만들지 않는다.
 */
export async function loadReportIndexData(): Promise<ReportIndexData> {
  const { teacherId, supabase } = await requireTeacherReportScope();
  const { data, error } = await supabase
    .from("evidence")
    .select(
      `id, standard_id, question_id, source_page, claim,
       analyses!inner(
         id, submission_id, analysis_json, status, created_at,
         submissions!inner(
           id, submitted_at,
           students!inner(
             id, student_number, name,
             classes!inner(id, name, teacher_id)
           ),
           activity_assignments!inner(
             activities!inner(
               id, title, subject, domain, unit, teacher_id,
               activity_standards(standard_id)
             )
           )
         ),
         reviews(reviewer_id, decision, teacher_edits, reviewed_at)
       )`,
    )
    .eq("analyses.submissions.activity_assignments.activities.teacher_id", teacherId)
    .eq("analyses.submissions.students.classes.teacher_id", teacherId)
    .in("analyses.status", APPROVED_OUTPUT_ANALYSIS_STATUSES)
    .order("created_at", { ascending: true });

  if (error) throw new Error("Approved report index lookup failed", { cause: error });

  const analysisRecords = new Map<string, {
    studentId: string;
    studentNumber: number;
    studentName: string;
    classId: string;
    className: string;
    item: ReportTimelineItem;
  }>();

  for (const evidenceRow of (data ?? []) as unknown as EvidenceRow[]) {
    const analysis = one(evidenceRow.analyses);
    const submission = one(analysis?.submissions ?? null);
    const student = one(submission?.students ?? null);
    const classItem = one(student?.classes ?? null);
    const assignment = one(submission?.activity_assignments ?? null);
    const activity = one(assignment?.activities ?? null);
    if (!analysis || !submission || !student || !classItem || !activity) continue;
    if (!approvedReview(analysis.reviews, teacherId)) continue;

    const existing = analysisRecords.get(analysis.id);
    const evidence: ReportEvidenceItem = {
      id: evidenceRow.id,
      standardId: evidenceRow.standard_id,
      questionId: evidenceRow.question_id,
      sourcePage: evidenceRow.source_page,
      claim: evidenceRow.claim,
    };
    if (existing) {
      existing.item.evidence.push(evidence);
      if (evidence.standardId && !existing.item.standards.includes(evidence.standardId)) {
        existing.item.standards.push(evidence.standardId);
      }
      continue;
    }

    const review = approvedReview(analysis.reviews, teacherId);
    const editedFeedback = review
      ? recordString(review.teacher_edits, "feedback_after")
        ?? recordString(review.teacher_edits, "feedback_candidate")
      : null;
    const analysisJson = analysis.analysis_json ?? {};
    const standards = [...new Set([
      ...list(activity.activity_standards).map(({ standard_id }) => standard_id),
      ...(evidence.standardId ? [evidence.standardId] : []),
    ])];

    analysisRecords.set(analysis.id, {
      studentId: student.id,
      studentNumber: student.student_number,
      studentName: student.name,
      classId: classItem.id,
      className: classItem.name,
      item: {
        analysisId: analysis.id,
        submissionId: submission.id,
        activityId: activity.id,
        activityTitle: activity.title,
        subject: activity.subject?.trim() || "교과 미분류",
        domain: activity.domain,
        unit: activity.unit,
        observedAt: submission.submitted_at ?? analysis.created_at,
        achievementLevel: recordString(analysisJson, "achievement_level"),
        strengths: stringList(analysisJson.strengths),
        difficulties: difficultyList(analysisJson.difficulties),
        evidence: [evidence],
        feedback: editedFeedback ?? recordString(analysisJson, "feedback_candidate"),
        standards,
      },
    });
  }

  const growthResult = await supabase
    .from("growth_events")
    .select(
      "id, student_id, standard_id, description, status, created_at, students!inner(classes!inner(teacher_id))",
    )
    .eq("students.classes.teacher_id", teacherId)
    .in("status", ["APPROVED", "EDITED_APPROVED"])
    .order("created_at", { ascending: true });
  if (growthResult.error) {
    throw new Error("Approved GrowthEvent lookup failed", { cause: growthResult.error });
  }

  const growthByStudent = new Map<string, StudentReportIndexItem["approvedGrowthEvents"]>();
  for (const event of growthResult.data ?? []) {
    const current = growthByStudent.get(event.student_id) ?? [];
    current.push({
      id: event.id,
      standardId: event.standard_id,
      description: event.description,
      createdAt: event.created_at,
    });
    growthByStudent.set(event.student_id, current);
  }

  const grouped = new Map<string, Omit<StudentReportIndexItem, "trend" | "hasRepeatedDifficulty" | "searchText">>();
  for (const record of analysisRecords.values()) {
    const current = grouped.get(record.studentId) ?? {
      studentId: record.studentId,
      studentNumber: record.studentNumber,
      studentName: record.studentName,
      classId: record.classId,
      className: record.className,
      records: [],
      subjects: [],
      approvedGrowthEvents: growthByStudent.get(record.studentId) ?? [],
    };
    current.records.push(record.item);
    if (!current.subjects.includes(record.item.subject)) current.subjects.push(record.item.subject);
    grouped.set(record.studentId, current);
  }

  const students = [...grouped.values()].map((student): StudentReportIndexItem => {
    student.records.sort((left, right) => left.observedAt.localeCompare(right.observedAt));
    student.subjects.sort((left, right) => left.localeCompare(right, "ko-KR"));
    const hasRepeatedDifficulty = student.records.some((record) => (
      record.difficulties.some((difficulty) => difficulty.isRepeatedError)
    ));
    const searchText = [
      student.studentNumber,
      student.studentName,
      student.className,
      ...student.subjects,
      ...student.records.flatMap((record) => [
        record.activityTitle,
        record.domain,
        record.unit,
        ...record.standards,
        ...record.strengths,
        ...record.difficulties.map(({ text }) => text),
      ]),
    ].filter(Boolean).join(" ").toLocaleLowerCase("ko-KR");
    return {
      ...student,
      trend: trendFor(student.records),
      hasRepeatedDifficulty,
      searchText,
    };
  }).sort((left, right) => (
    left.className.localeCompare(right.className, "ko-KR")
    || left.studentNumber - right.studentNumber
  ));

  return {
    students,
    approvedRecordCount: analysisRecords.size,
    approvedEvidenceCount: (data ?? []).length,
    cumulativeStudentCount: students.filter(({ records }) => records.length >= 2).length,
    repeatedDifficultyStudentCount: students.filter(({ hasRepeatedDifficulty }) => hasRepeatedDifficulty).length,
  };
}
