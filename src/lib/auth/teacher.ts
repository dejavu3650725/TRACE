import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface TeacherProfile {
  id: string;
  name: string;
  nickname: string | null;
}

/**
 * 현재 세션의 Auth User와 그에 연결된 Teacher Profile을 조회한다.
 * auth_user_id는 반드시 서버 세션에서 가져온다 — Client가 임의 지정할 수 없다.
 */
export async function getSessionTeacher(): Promise<{
  userId: string | null;
  teacher: TeacherProfile | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { userId: null, teacher: null };

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, name, nickname")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return { userId: user.id, teacher: teacher ?? null };
}
