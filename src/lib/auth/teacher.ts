import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface TeacherProfile {
  id: string;
  name: string;
  nickname: string | null;
}

export class AuthenticationRequiredError extends Error {
  readonly code = "UNAUTHENTICATED";
  readonly status = 401;

  constructor() {
    super("Authentication required");
    this.name = "AuthenticationRequiredError";
  }
}

export class TeacherProfileRequiredError extends Error {
  readonly code = "TEACHER_PROFILE_REQUIRED";
  readonly status = 403;

  constructor() {
    super("Teacher Profile required");
    this.name = "TeacherProfileRequiredError";
  }
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

  const { data: teacher, error } = await supabase
    .from("teachers")
    .select("id, name, nickname")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw new Error("Teacher Profile lookup failed", { cause: error });

  return { userId: user.id, teacher: teacher ?? null };
}

/** Server Action/API fail-closed boundary; teacher_id always comes from the JWT. */
export async function requireSessionTeacher(): Promise<{
  userId: string;
  teacher: TeacherProfile;
  supabase: ServerSupabaseClient;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new AuthenticationRequiredError();

  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id, name, nickname")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (teacherError) throw new Error("Teacher Profile lookup failed", { cause: teacherError });
  if (!teacher) throw new TeacherProfileRequiredError();

  return { userId: user.id, teacher, supabase };
}
