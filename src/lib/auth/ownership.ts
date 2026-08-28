import "server-only";

import {
  requireSessionTeacher,
  type ServerSupabaseClient,
  type TeacherProfile,
} from "@/lib/auth/teacher";

export type TeacherOwnedResource =
  | "class"
  | "student"
  | "activity"
  | "activityAssignment"
  | "submission"
  | "artifact"
  | "analysis";

type Context = { teacher: TeacherProfile; supabase: ServerSupabaseClient };
type Row = { id: string };
type StudentRow = Row & { class_id: string };
type AssignmentRow = Row & { activity_id: string; class_id: string };
type SubmissionRow = Row & { student_id: string; activity_assignment_id: string };
type ArtifactRow = Row & { submission_id: string | null };
type AnalysisRow = Row & { submission_id: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Uniform 403: callers must not reveal whether a foreign resource exists. */
export class ResourceForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  readonly status = 403;

  constructor() {
    super("Resource is outside the current Teacher scope");
    this.name = "ResourceForbiddenError";
  }
}

function validateId(id: string) {
  if (!UUID_PATTERN.test(id)) throw new ResourceForbiddenError();
}

async function ownedClass(context: Context, id: string) {
  const { data, error } = await context.supabase
    .from("classes")
    .select("id")
    .eq("id", id)
    .eq("teacher_id", context.teacher.id)
    .maybeSingle();
  if (error) throw new Error("Class ownership check failed", { cause: error });
  if (!data) throw new ResourceForbiddenError();
  return data as Row;
}

async function ownedStudent(context: Context, id: string) {
  const { data, error } = await context.supabase
    .from("students")
    .select("id, class_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Student ownership check failed", { cause: error });
  if (!data) throw new ResourceForbiddenError();
  const row = data as StudentRow;
  await ownedClass(context, row.class_id);
  return row;
}

async function ownedActivity(context: Context, id: string) {
  const { data, error } = await context.supabase
    .from("activities")
    .select("id")
    .eq("id", id)
    .eq("teacher_id", context.teacher.id)
    .maybeSingle();
  if (error) throw new Error("Activity ownership check failed", { cause: error });
  if (!data) throw new ResourceForbiddenError();
  return data as Row;
}

async function ownedAssignment(context: Context, id: string) {
  const { data, error } = await context.supabase
    .from("activity_assignments")
    .select("id, activity_id, class_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("ActivityAssignment ownership check failed", { cause: error });
  if (!data) throw new ResourceForbiddenError();
  const row = data as AssignmentRow;
  await Promise.all([
    ownedActivity(context, row.activity_id),
    ownedClass(context, row.class_id),
  ]);
  return row;
}

async function ownedSubmission(context: Context, id: string) {
  const { data, error } = await context.supabase
    .from("submissions")
    .select("id, student_id, activity_assignment_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Submission ownership check failed", { cause: error });
  if (!data) throw new ResourceForbiddenError();
  const row = data as SubmissionRow;
  const [student, assignment] = await Promise.all([
    ownedStudent(context, row.student_id),
    ownedAssignment(context, row.activity_assignment_id),
  ]);
  if (student.class_id !== assignment.class_id) throw new ResourceForbiddenError();
  return row;
}

async function ownedArtifact(context: Context, id: string) {
  const { data, error } = await context.supabase
    .from("artifacts")
    .select("id, submission_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Artifact ownership check failed", { cause: error });
  if (!data) throw new ResourceForbiddenError();
  const row = data as ArtifactRow;
  if (!row.submission_id) throw new ResourceForbiddenError();
  await ownedSubmission(context, row.submission_id);
  return row;
}

async function ownedAnalysis(context: Context, id: string) {
  const { data, error } = await context.supabase
    .from("analyses")
    .select("id, submission_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Analysis ownership check failed", { cause: error });
  if (!data) throw new ResourceForbiddenError();
  const row = data as AnalysisRow;
  await ownedSubmission(context, row.submission_id);
  return row;
}

/** Explicit server-side ownership check, independent of client-supplied teacher_id. */
export async function requireTeacherOwnership(
  resource: TeacherOwnedResource,
  resourceId: string,
) {
  validateId(resourceId);
  const { teacher, supabase } = await requireSessionTeacher();
  const context = { teacher, supabase };

  switch (resource) {
    case "class": return ownedClass(context, resourceId);
    case "student": return ownedStudent(context, resourceId);
    case "activity": return ownedActivity(context, resourceId);
    case "activityAssignment": return ownedAssignment(context, resourceId);
    case "submission": return ownedSubmission(context, resourceId);
    case "artifact": return ownedArtifact(context, resourceId);
    case "analysis": return ownedAnalysis(context, resourceId);
  }
}

/** Report queries have no single resource id but still derive Teacher scope here. */
export async function requireTeacherReportScope() {
  const { teacher, supabase } = await requireSessionTeacher();
  return { teacherId: teacher.id, supabase };
}
