"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface ProfileFormState {
  error: string | null;
}

const MAX_LEN = 30;

/**
 * 최초 로그인 Teacher Profile 생성 (Server Action)
 * - auth_user_id는 서버 세션에서만 가져온다.
 * - 동일 auth_user_id에 Profile이 이미 있으면 만들지 않고 재사용한다 (중복 생성 방지).
 */
export async function createTeacherProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const nickname = String(formData.get("nickname") ?? "").trim();

  if (!name) return { error: "이름을 입력해 주세요." };
  if (name.length > MAX_LEN || nickname.length > MAX_LEN)
    return { error: `이름과 닉네임은 ${MAX_LEN}자 이내로 입력해 주세요.` };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 이미 있으면 새로 만들지 않는다 (중복 클릭 / callback 재호출 대비)
  const { data: existing } = await supabase
    .from("teachers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("teachers").insert({
      auth_user_id: user.id,
      name,
      nickname: nickname || null,
      email: user.email ?? null,
    });
    // unique(auth_user_id) 충돌은 동시 요청으로 이미 생성된 경우 → 통과
    if (error && error.code !== "23505") {
      return { error: "저장에 실패했어요. 잠시 후 다시 시도해 주세요." };
    }
  }

  redirect("/dashboard");
}
