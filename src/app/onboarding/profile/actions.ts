"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface ProfileFormState {
  error: string | null;
}

const MAX_LEN = 30;

/**
 * 최초 로그인 Teacher Profile 생성 + LOGIN audit (Server Action)
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

  const { error } = await supabase.rpc("complete_teacher_profile_and_login", {
    p_name: name,
    p_nickname: nickname || null,
  });

  if (error) {
    return { error: "저장에 실패했어요. 잠시 후 다시 시도해 주세요." };
  }

  redirect("/dashboard");
}
