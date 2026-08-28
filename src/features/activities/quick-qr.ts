"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { getCurriculumLoader } from "@/lib/curriculum/loader-full";
import { getVlmAdapter } from "@/lib/ai/vlm-adapter";
import { createPrivacySafeVlmRequest } from "@/lib/ai/privacy-context";
import { VlmAdapterRequestError } from "@/lib/ai/contracts";
import { FILE_LIMITS } from "@/lib/config";

/**
 * 빈 활동지 촬영 → AI가 성취기준 연결 + 활동 생성 → 즉시 QR 발급 (원스텝)
 * 교사가 활동을 미리 만들 필요가 없다. 사진 한 장이 수업 구상의 시작이 된다.
 * - 성취기준은 서버가 좁힌 해당 학년군 후보 목록 안에서만 AI가 고른다.
 * - 사진은 활동지(빈 문제지)이므로 학생 PII가 없어야 하며, AI에는 사진과 후보 목록만 보낸다.
 */

export interface QuickQrState {
  status: "idle" | "error";
  message: string | null;
}

const QuickDraftSchema = z.object({
  title: z.string().min(2).max(80),
  subject: z.string().min(1).max(20),
  standard_ids: z.array(z.string().min(3).max(40)).min(1).max(3),
  questions: z
    .array(
      z.object({
        question_id: z.string().min(1).max(10),
        prompt: z.string().min(1).max(300),
      }),
    )
    .min(1)
    .max(12),
});

function gradeBandFor(grade: number | null): string {
  if (grade === 1 || grade === 2) return "1~2학년";
  if (grade === 5 || grade === 6) return "5~6학년";
  return "3~4학년";
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function createQrFromWorksheet(
  _prev: QuickQrState,
  formData: FormData,
): Promise<QuickQrState> {
  const { teacher, supabase } = await requireSessionTeacher();

  const classId = String(formData.get("classId") ?? "");
  const photo = formData.get("photo");
  if (!classId || !(photo instanceof File) || photo.size === 0) {
    return { status: "error", message: "학급을 선택하고 활동지 사진을 올려주세요." };
  }
  if (!ALLOWED_MIME.has(photo.type)) {
    return { status: "error", message: "사진 파일(JPG/PNG/WEBP/HEIC)만 올릴 수 있어요." };
  }
  if (photo.size > FILE_LIMITS.IMAGE_MAX_BYTES) {
    return { status: "error", message: "사진은 10MB 이하여야 해요." };
  }

  const { data: cls } = await supabase
    .from("classes")
    .select("id, grade")
    .eq("id", classId)
    .eq("teacher_id", teacher.id)
    .maybeSingle();
  if (!cls) return { status: "error", message: "학급을 찾을 수 없어요." };

  // 서버가 좁힌 성취기준 후보 (해당 학년군 전 교과)
  const loader = await getCurriculumLoader().catch(() => null);
  if (!loader) {
    return { status: "error", message: "교육과정 데이터를 불러오지 못했어요." };
  }
  const gradeBand = gradeBandFor(cls.grade ?? null);
  // 교과별로 고르게 후보를 모은다 (한 교과가 후보 목록을 독식하지 않게)
  const subjects = loader.listStandardSubjects(gradeBand);
  const candidates = subjects.flatMap((subject) =>
    loader.findStandards({ grade: gradeBand, subject, limit: 60 }),
  );
  if (candidates.length === 0) {
    return { status: "error", message: `${gradeBand} 성취기준 데이터가 없어요.` };
  }
  const candidateLines = candidates
    .map((s) => `${s.id} | ${s.subject} | ${s.domain} | ${s.description.slice(0, 90)}`)
    .join("\n");

  const prompt = `당신은 대한민국 초등 교사의 수업 설계를 보조합니다.
첨부된 사진은 학생에게 배포할 "빈 활동지(문제지)"입니다.

임무:
1. 활동지 내용을 읽고 활동 제목(title)과 교과(subject)를 정합니다.
2. 아래 성취기준 후보 목록 안에서 이 활동지와 가장 맞는 성취기준 코드를 1~3개 고릅니다(standard_ids). 목록 밖 코드는 절대 금지.
3. 활동지의 문항을 Q1부터 순서대로 추출합니다(questions). 문항 구분이 어려우면 활동 전체를 Q1 하나로 요약합니다.

[성취기준 후보 — ${gradeBand}]
${candidateLines}

반드시 아래 JSON만 반환:
{"title":"...","subject":"...","standard_ids":["..."],"questions":[{"question_id":"Q1","prompt":"..."}]}`;

  const base64 = Buffer.from(await photo.arrayBuffer()).toString("base64");
  const adapter = getVlmAdapter();
  const request = createPrivacySafeVlmRequest({
    purpose: "ACTIVITY_DRAFT",
    prompt,
    media: [{ mimeType: photo.type, base64 }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    timeoutMs: 60_000,
  });

  let draft: z.infer<typeof QuickDraftSchema> | null = null;
  let lastMessage = "AI 분석에 실패했어요. 잠시 후 다시 시도해 주세요.";
  for (let attempt = 0; attempt < 2 && !draft; attempt += 1) {
    const result = await adapter.generate(request);
    if (!result.ok) {
      lastMessage = new VlmAdapterRequestError(result).message;
      continue;
    }
    try {
      const cleaned = result.outputText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      draft = QuickDraftSchema.parse(JSON.parse(cleaned));
    } catch {
      lastMessage = "AI 응답 형식이 올바르지 않았어요. 다시 시도해 주세요.";
    }
  }
  if (!draft) return { status: "error", message: lastMessage };

  const allowed = new Set(candidates.map((s) => s.id));
  const standardIds = draft.standard_ids.filter((id) => allowed.has(id));
  if (standardIds.length === 0) {
    return { status: "error", message: "활동지에 맞는 성취기준을 찾지 못했어요. 사진을 더 선명하게 찍어보세요." };
  }

  // 활동 생성 → 성취기준 연결 → 배정 + QR 토큰 (원스텝)
  const { data: activity, error: actError } = await supabase
    .from("activities")
    .insert({
      teacher_id: teacher.id,
      title: draft.title,
      grade: cls.grade ?? null,
      subject: draft.subject,
      description: "활동지 사진에서 AI가 자동 구성한 활동이에요. 필요하면 활동 관리에서 수정하세요.",
      content_json: {
        schema_version: "1",
        questions: draft.questions.map((q, i) => ({
          question_id: `Q${i + 1}`,
          question_type: "OPEN",
          prompt: q.prompt,
          options: [],
        })),
      },
      status: "ACTIVE",
    })
    .select("id")
    .single();
  if (actError || !activity) {
    return { status: "error", message: "활동 생성에 실패했어요." };
  }

  await supabase
    .from("activity_standards")
    .insert(standardIds.map((standardId) => ({ activity_id: activity.id, standard_id: standardId })));

  const token = randomBytes(18).toString("base64url");
  const { error: assignError } = await supabase.from("activity_assignments").insert({
    activity_id: activity.id,
    class_id: classId,
    status: "OPEN",
    submission_token: token,
  });
  if (assignError) {
    return { status: "error", message: "학급 배정에 실패했어요." };
  }

  redirect("/results/share?quick=created");
}
