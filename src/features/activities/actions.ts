"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTeacherOwnership } from "@/lib/auth/ownership";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { getCurriculumLoader } from "@/lib/curriculum/loader-full";
import { buildActivityCodePrefix } from "./code";
import {
  CURRICULUM_GRADE_BANDS,
  CURRICULUM_SCHOOL_LEVELS,
  gradeBandsForSchoolLevel,
  type CurriculumSchoolLevel,
} from "./curriculum";
import { parseActivityInput, parseAssignmentSchedule } from "./validation";

const idSchema = z.string().uuid();

export type StandardOption = {
  id: string;
  grade: string;
  subject: string;
  domain: string;
  description: string;
};

export type StandardsSearchState = {
  candidates: StandardOption[];
  message: string | null;
  schoolLevel: CurriculumSchoolLevel | null;
  grade: string | null;
};

function minimalStandard(standard: {
  id: string;
  grade: string;
  subject: string;
  domain: string;
  description: string;
}): StandardOption {
  return {
    id: standard.id,
    grade: standard.grade,
    subject: standard.subject,
    domain: standard.domain,
    description: standard.description,
  };
}

export async function searchActivityStandards(
  _previous: StandardsSearchState,
  formData: FormData,
): Promise<StandardsSearchState> {
  await requireSessionTeacher();
  const keyword = String(formData.get("keyword") ?? "").trim();
  const subject = String(formData.get("searchSubject") ?? "").trim();
  const schoolLevel = String(formData.get("searchSchoolLevel") ?? "").trim();
  const grade = String(formData.get("searchGrade") ?? "").trim();
  const validSchoolLevel = CURRICULUM_SCHOOL_LEVELS.find((value) => value === schoolLevel);
  if (
    keyword.length > 100 ||
    subject.length > 100 ||
    !validSchoolLevel ||
    !CURRICULUM_GRADE_BANDS.some((gradeBand) => gradeBand === grade) ||
    !gradeBandsForSchoolLevel(validSchoolLevel).some((gradeBand) => gradeBand === grade) ||
    (validSchoolLevel === "고등학교" && subject !== "정보")
  ) {
    return { candidates: [], message: "학교급·학년군·교과와 검색어를 확인해 주세요.", schoolLevel: null, grade: null };
  }

  const loader = await getCurriculumLoader();
  const candidates = loader.findStandards({
    keyword: keyword || undefined,
    subject: subject || undefined,
    grade,
    limit: 20,
  });

  return {
    candidates: candidates.map(minimalStandard),
    message: candidates.length === 0 ? "조건에 맞는 성취기준이 없어요." : null,
    schoolLevel: validSchoolLevel,
    grade,
  };
}

async function standardsExist(standardIds: string[]) {
  const loader = await getCurriculumLoader();
  return standardIds.every((id) => loader.getStandard(id) !== null);
}

async function parentIsOwned(parentActivityId: string | null, ownActivityId?: string) {
  if (!parentActivityId || parentActivityId === ownActivityId) return parentActivityId !== ownActivityId;
  const { teacher, supabase } = await requireSessionTeacher();
  const { data, error } = await supabase
    .from("activities")
    .select("id")
    .eq("id", parentActivityId)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (error) throw new Error("Parent Activity ownership check failed", { cause: error });
  return Boolean(data);
}

function activityErrorPath(path: string, reason = "invalid-input") {
  return `${path}${path.includes("?") ? "&" : "?"}activity-error=${reason}`;
}

async function saveActivity(activityId: string | null, formData: FormData) {
  const input = parseActivityInput(formData);
  const failurePath = activityId ? `/activities/${activityId}` : "/activities/new";
  if (!input || !(await standardsExist(input.standardIds))) {
    redirect(activityErrorPath(failurePath));
  }
  if (!(await parentIsOwned(input.parentActivityId, activityId ?? undefined))) {
    redirect(activityErrorPath(failurePath, "invalid-parent"));
  }

  const { supabase } = await requireSessionTeacher();
  const { data, error } = await supabase.rpc("save_activity", {
    p_activity_id: activityId,
    p_title: input.title,
    p_grade: input.grade,
    p_subject: input.subject,
    p_domain: input.domain,
    p_unit: input.unit,
    p_activity_type: input.activityType,
    p_description: input.description,
    p_parent_activity_id: input.parentActivityId,
    p_standard_ids: input.standardIds,
  });

  if (error || typeof data !== "string") {
    console.error("Activity save RPC failed", { code: error?.code, message: error?.message });
    redirect(activityErrorPath(failurePath, "save-failed"));
  }
  return data;
}

export async function createActivity(formData: FormData) {
  const activityId = await saveActivity(null, formData);
  revalidatePath("/activities");
  redirect(`/activities/${activityId}?created=1`);
}

export async function updateActivity(formData: FormData) {
  const activityId = String(formData.get("activityId") ?? "");
  if (!idSchema.safeParse(activityId).success) redirect("/activities?activity-error=invalid-input");
  await requireTeacherOwnership("activity", activityId);
  await saveActivity(activityId, formData);
  revalidatePath("/activities");
  revalidatePath(`/activities/${activityId}`);
  redirect(`/activities/${activityId}?saved=1`);
}

export async function activateActivity(formData: FormData) {
  const activityId = String(formData.get("activityId") ?? "");
  if (!idSchema.safeParse(activityId).success || formData.get("confirmActivation") !== "yes") {
    redirect(activityErrorPath(`/activities/${activityId}`, "confirmation-required"));
  }
  await requireTeacherOwnership("activity", activityId);
  const { teacher, supabase } = await requireSessionTeacher();
  const { data: activity, error } = await supabase
    .from("activities")
    .select("grade, subject, activity_standards(standard_id)")
    .eq("id", activityId)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (error || !activity) throw new Error("Activity activation lookup failed", { cause: error });

  const standards = activity.activity_standards as Array<{ standard_id: string }> | null;
  const primaryStandardId = standards
    ?.map((standard) => standard.standard_id)
    .sort((left, right) => left.localeCompare(right, "ko-KR"))[0] ?? null;
  const prefix = buildActivityCodePrefix({
    subject: activity.subject,
    grade: activity.grade,
    standardId: primaryStandardId,
  });
  const { error: activationError } = await supabase.rpc("activate_activity", {
    p_activity_id: activityId,
    p_code_prefix: prefix,
  });
  if (activationError) {
    console.error("Activity activation RPC failed", {
      code: activationError.code,
      message: activationError.message,
    });
    redirect(activityErrorPath(`/activities/${activityId}`, "activation-failed"));
  }

  revalidatePath("/activities");
  revalidatePath(`/activities/${activityId}`);
  redirect(`/activities/${activityId}?activated=1`);
}

export async function assignActivityToClasses(formData: FormData) {
  const activityId = String(formData.get("activityId") ?? "");
  const classIds = [...new Set(formData.getAll("classIds").map(String))];
  const parsedIds = z.array(z.string().uuid()).min(1).max(100).safeParse(classIds);
  const schedule = parseAssignmentSchedule(formData);
  const path = `/activities/${activityId}/assign`;
  if (!idSchema.safeParse(activityId).success || !parsedIds.success || !schedule) {
    redirect(`${path}?assignment-error=invalid-input`);
  }
  await requireTeacherOwnership("activity", activityId);
  const { supabase } = await requireSessionTeacher();
  const { data, error } = await supabase.rpc("assign_activity_to_classes", {
    p_activity_id: activityId,
    p_class_ids: parsedIds.data,
    p_open_at: schedule.openAt,
    p_due_at: schedule.dueAt,
  });
  if (error) {
    console.error("Activity assignment RPC failed", { code: error.code, message: error.message });
    redirect(`${path}?assignment-error=save-failed`);
  }

  revalidatePath(path);
  revalidatePath(`/activities/${activityId}`);
  redirect(`${path}?assigned=${Number(data) || 0}`);
}

export async function updateActivityAssignment(formData: FormData) {
  const activityId = String(formData.get("activityId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const schedule = parseAssignmentSchedule(formData);
  const path = `/activities/${activityId}/assign`;
  if (!idSchema.safeParse(activityId).success || !idSchema.safeParse(assignmentId).success || !schedule) {
    redirect(`${path}?assignment-error=invalid-input`);
  }
  await Promise.all([
    requireTeacherOwnership("activity", activityId),
    requireTeacherOwnership("activityAssignment", assignmentId),
  ]);
  const { supabase } = await requireSessionTeacher();
  const { error } = await supabase.rpc("update_activity_assignment", {
    p_assignment_id: assignmentId,
    p_status: schedule.status,
    p_open_at: schedule.openAt,
    p_due_at: schedule.dueAt,
  });
  if (error) {
    console.error("Activity assignment update RPC failed", { code: error.code, message: error.message });
    redirect(`${path}?assignment-error=save-failed`);
  }

  revalidatePath(path);
  revalidatePath(`/activities/${activityId}`);
  redirect(`${path}?updated=1`);
}
