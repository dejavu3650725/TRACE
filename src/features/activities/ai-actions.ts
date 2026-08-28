"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { getActivityDraftAIProvider } from "@/lib/ai/activity-provider";
import { getCurriculumLoader } from "@/lib/curriculum/loader-full";
import {
  activityContentFromAiDraft,
  AiActivityDraftSchema,
  type AiActivityDraft,
} from "./ai-schema";
import { resolveAiCurriculumContext } from "./ai-curriculum";
import { containsProhibitedAiContext } from "./ai-privacy";
import {
  gradeBandForNumericGrade,
  schoolLevelMatchesGrade,
  type CurriculumSchoolLevel,
} from "./curriculum";
import { parseActivityInput } from "./validation";

const generationInputSchema = z.object({
  teacherPrompt: z.string().trim().min(10).max(2000),
  schoolLevel: z.enum(["초등학교", "고등학교"]),
  grade: z.number().int().min(1).max(12),
  subject: z.string().trim().max(100).transform((value) => value || null),
  domain: z.string().trim().max(200).transform((value) => value || null),
  unit: z.string().trim().max(200).transform((value) => value || null),
  activityType: z.string().trim().max(100).transform((value) => value || null),
  standardKeyword: z.string().trim().max(100).transform((value) => value || null),
}).refine((input) => schoolLevelMatchesGrade(input.schoolLevel, input.grade), {
  path: ["grade"],
  message: "Grade does not match school level",
});

export type AiStandardOption = {
  id: string;
  grade: string;
  subject: string;
  domain: string;
  description: string;
};

export type AiActivityDraftState = {
  status: "idle" | "success" | "error";
  message: string | null;
  draft: AiActivityDraft | null;
  standardOptions: AiStandardOption[];
  provider: string | null;
  model: string | null;
  draftKey: string | null;
  requestedSchoolLevel: CurriculumSchoolLevel | null;
  requestedGrade: number | null;
};

function parseGenerationInput(formData: FormData) {
  const gradeValue = String(formData.get("aiGrade") ?? "").trim();
  return generationInputSchema.safeParse({
    teacherPrompt: String(formData.get("teacherPrompt") ?? ""),
    schoolLevel: String(formData.get("aiSchoolLevel") ?? ""),
    grade: Number(gradeValue),
    subject: String(formData.get("aiSubject") ?? ""),
    domain: String(formData.get("aiDomain") ?? ""),
    unit: String(formData.get("aiUnit") ?? ""),
    activityType: String(formData.get("aiActivityType") ?? ""),
    standardKeyword: String(formData.get("standardKeyword") ?? ""),
  });
}

function minimalStandard(standard: AiStandardOption): AiStandardOption {
  return {
    id: standard.id,
    grade: standard.grade,
    subject: standard.subject,
    domain: standard.domain,
    description: standard.description,
  };
}

export async function generateAiActivityDraft(
  _previous: AiActivityDraftState,
  formData: FormData,
): Promise<AiActivityDraftState> {
  await requireSessionTeacher();
  const parsed = parseGenerationInput(formData);
  if (!parsed.success) {
    return { status: "error", message: "학교급과 학년을 먼저 선택하고 요청을 10~2,000자로 입력해 주세요.", draft: null, standardOptions: [], provider: null, model: null, draftKey: null, requestedSchoolLevel: null, requestedGrade: null };
  }

  const input = parsed.data;
  if (containsProhibitedAiContext(input.teacherPrompt)) {
    return {
      status: "error",
      message: "학생 이름·번호·명단, 이메일 또는 전화번호를 제거한 뒤 다시 요청해 주세요.",
      draft: null,
      standardOptions: [],
      provider: null,
      model: null,
      draftKey: null,
      requestedSchoolLevel: input.schoolLevel,
      requestedGrade: input.grade,
    };
  }
  const loader = await getCurriculumLoader();
  const gradeBand = gradeBandForNumericGrade(input.grade);
  if (!gradeBand) {
    return { status: "error", message: "선택한 학교급과 학년에 해당하는 교육과정이 없어요.", draft: null, standardOptions: [], provider: null, model: null, draftKey: null, requestedSchoolLevel: input.schoolLevel, requestedGrade: input.grade };
  }
  const { resolvedSubject, resolvedDomain, standards } = resolveAiCurriculumContext({
    loader,
    gradeBand,
    teacherPrompt: input.teacherPrompt,
    subject: input.subject,
    domain: input.domain,
    standardKeyword: input.standardKeyword,
  });
  const standardOptions = standards.map(minimalStandard);
  let providerName: string | null = null;
  let modelName: string | null = null;

  try {
    const provider = getActivityDraftAIProvider();
    providerName = provider.provider;
    modelName = provider.model;
    const draft = await provider.generate({
      teacherPrompt: input.teacherPrompt,
      metadata: {
        grade: input.grade,
        schoolLevel: input.schoolLevel,
        subject: resolvedSubject,
        domain: resolvedDomain,
        unit: input.unit,
        activityType: input.activityType,
      },
      candidateStandards: standardOptions,
    });

    return {
      status: "success",
      message: "AI 초안을 만들었어요. 내용을 수정하고 저장해야 실제 Activity 초안이 됩니다.",
      draft,
      standardOptions,
      provider: providerName,
      model: modelName,
      draftKey: crypto.randomUUID(),
      requestedSchoolLevel: input.schoolLevel,
      requestedGrade: input.grade,
    };
  } catch (error) {
    console.error("AI Activity Draft generation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown provider error",
    });
    return {
      status: "error",
      message: "AI 초안을 만들지 못했어요. 잠시 후 다시 시도해 주세요.",
      draft: null,
      standardOptions: [],
      provider: providerName,
      model: modelName,
      draftKey: null,
      requestedSchoolLevel: input.schoolLevel,
      requestedGrade: input.grade,
    };
  }
}

function parseQuestions(formData: FormData) {
  const count = Number(String(formData.get("questionCount") ?? ""));
  if (!Number.isInteger(count) || count < 1 || count > 20) return null;

  return Array.from({ length: count }, (_, index) => ({
    question_id: String(formData.get(`questions.${index}.questionId`) ?? ""),
    prompt: String(formData.get(`questions.${index}.prompt`) ?? ""),
    question_type: String(formData.get(`questions.${index}.questionType`) ?? ""),
    options: String(formData.get(`questions.${index}.options`) ?? "")
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean),
  }));
}

export async function saveAiActivityDraft(formData: FormData) {
  const input = parseActivityInput(formData);
  const questions = parseQuestions(formData);
  const draft = AiActivityDraftSchema.safeParse(
    input && questions
      ? {
          title: input.title,
          description: input.description,
          instructions: String(formData.get("instructions") ?? ""),
          grade: input.grade,
          subject: input.subject,
          domain: input.domain,
          unit: input.unit,
          activity_type: input.activityType,
          standard_candidates: input.standardIds,
          questions,
          print_layout_data: {
            paper_size: "A4",
            orientation: String(formData.get("orientation") ?? ""),
            estimated_pages: Number(String(formData.get("estimatedPages") ?? "")),
          },
        }
      : null,
  );
  if (!input || !draft.success) redirect("/activities/new?ai-save-error=invalid-input");

  const loader = await getCurriculumLoader();
  if (!input.standardIds.every((standardId) => loader.getStandard(standardId) !== null)) {
    redirect("/activities/new?ai-save-error=invalid-standard");
  }

  const { teacher, supabase } = await requireSessionTeacher();
  if (input.parentActivityId) {
    const { data: parent, error: parentError } = await supabase
      .from("activities")
      .select("id")
      .eq("id", input.parentActivityId)
      .eq("teacher_id", teacher.id)
      .maybeSingle();
    if (parentError) throw new Error("AI Draft parent ownership check failed", { cause: parentError });
    if (!parent) redirect("/activities/new?ai-save-error=invalid-parent");
  }

  const { data: activityId, error } = await supabase.rpc("save_activity", {
    p_activity_id: null,
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
  if (error || typeof activityId !== "string") {
    console.error("AI Activity Draft DB creation failed", { code: error?.code, message: error?.message });
    redirect("/activities/new?ai-save-error=save-failed");
  }

  const content = activityContentFromAiDraft(draft.data);
  const { data: updated, error: contentError } = await supabase
    .from("activities")
    .update({ content_json: content })
    .eq("id", activityId)
    .eq("teacher_id", teacher.id)
    .select("id")
    .maybeSingle();

  if (contentError || !updated) {
    const { error: rollbackError } = await supabase
      .from("activities")
      .delete()
      .eq("id", activityId)
      .eq("teacher_id", teacher.id);
    console.error("AI Activity Draft content persistence failed", {
      code: contentError?.code,
      rollbackFailed: Boolean(rollbackError),
    });
    redirect("/activities/new?ai-save-error=save-failed");
  }

  revalidatePath("/activities");
  redirect(`/activities/${activityId}?ai-created=1`);
}
