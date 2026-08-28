-- TRACE authentication, RLS, and ownership foundation (ISSUE-03)
-- Forward-only migration following the repository migration convention.

-- Resolve the current Teacher only from the verified Supabase JWT subject.
create or replace function public.current_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.teachers where auth_user_id = auth.uid()
$$;

revoke all on function public.current_teacher_id() from public;
grant execute on function public.current_teacher_id() to anon, authenticated, service_role;

-- Require both the Activity and Class to belong to the current Teacher.
drop policy if exists assignments_all on public.activity_assignments;
create policy assignments_all on public.activity_assignments for all
  using (
    exists (
      select 1
      from public.activities a
      join public.classes c on c.id = activity_assignments.class_id
      where a.id = activity_assignments.activity_id
        and a.teacher_id = public.current_teacher_id()
        and c.teacher_id = public.current_teacher_id()
    )
  )
  with check (
    exists (
      select 1
      from public.activities a
      join public.classes c on c.id = activity_assignments.class_id
      where a.id = activity_assignments.activity_id
        and a.teacher_id = public.current_teacher_id()
        and c.teacher_id = public.current_teacher_id()
    )
  );

-- Require a Student to belong to the Assignment's Class as well as its Teacher.
drop policy if exists submissions_all on public.submissions;
create policy submissions_all on public.submissions for all
  using (
    exists (
      select 1
      from public.activity_assignments aa
      join public.activities a on a.id = aa.activity_id
      join public.classes c on c.id = aa.class_id
      join public.students st on st.id = submissions.student_id and st.class_id = aa.class_id
      where aa.id = submissions.activity_assignment_id
        and a.teacher_id = public.current_teacher_id()
        and c.teacher_id = public.current_teacher_id()
    )
  )
  with check (
    exists (
      select 1
      from public.activity_assignments aa
      join public.activities a on a.id = aa.activity_id
      join public.classes c on c.id = aa.class_id
      join public.students st on st.id = submissions.student_id and st.class_id = aa.class_id
      where aa.id = submissions.activity_assignment_id
        and a.teacher_id = public.current_teacher_id()
        and c.teacher_id = public.current_teacher_id()
    )
  );

-- Artifact access inherits the complete valid Submission ownership path.
-- Unassigned Artifacts stay inaccessible until that separate contract is approved.
drop policy if exists artifacts_all on public.artifacts;
create policy artifacts_all on public.artifacts for all
  using (
    exists (
      select 1
      from public.submissions s
      join public.activity_assignments aa on aa.id = s.activity_assignment_id
      join public.activities a on a.id = aa.activity_id
      join public.classes c on c.id = aa.class_id
      join public.students st on st.id = s.student_id and st.class_id = aa.class_id
      where s.id = artifacts.submission_id
        and a.teacher_id = public.current_teacher_id()
        and c.teacher_id = public.current_teacher_id()
    )
  )
  with check (
    exists (
      select 1
      from public.submissions s
      join public.activity_assignments aa on aa.id = s.activity_assignment_id
      join public.activities a on a.id = aa.activity_id
      join public.classes c on c.id = aa.class_id
      join public.students st on st.id = s.student_id and st.class_id = aa.class_id
      where s.id = artifacts.submission_id
        and a.teacher_id = public.current_teacher_id()
        and c.teacher_id = public.current_teacher_id()
    )
  );

-- Browser clients cannot forge arbitrary audit actions. LOGIN is fixed-shape.
drop policy if exists audit_logs_insert on public.audit_logs;

create or replace function public.record_login()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid;
begin
  select id into v_teacher_id
  from public.teachers
  where auth_user_id = auth.uid();

  if v_teacher_id is null then
    raise exception using errcode = '42501', message = 'authenticated Teacher Profile required';
  end if;

  insert into public.audit_logs (
    actor_teacher_id, action, entity_type, entity_id, request_id, metadata_json
  ) values (
    v_teacher_id, 'LOGIN', 'Teacher', v_teacher_id, gen_random_uuid()::text, null
  );

  return v_teacher_id;
end;
$$;

revoke all on function public.record_login() from public;
grant execute on function public.record_login() to authenticated;

-- Profile creation and the first LOGIN audit succeed or roll back together.
create or replace function public.complete_teacher_profile_and_login(
  p_name text,
  p_nickname text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_teacher_id uuid;
  v_email text;
  v_name text := btrim(coalesce(p_name, ''));
  v_nickname text := nullif(btrim(coalesce(p_nickname, '')), '');
begin
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if v_name = '' or char_length(v_name) > 30
     or char_length(coalesce(v_nickname, '')) > 30 then
    raise exception using errcode = '22023', message = 'invalid Teacher Profile input';
  end if;

  select email into v_email from auth.users where id = v_auth_user_id;

  insert into public.teachers (auth_user_id, name, nickname, email)
  values (v_auth_user_id, v_name, v_nickname, v_email)
  on conflict (auth_user_id) do nothing
  returning id into v_teacher_id;

  if v_teacher_id is null then
    select id into v_teacher_id
    from public.teachers
    where auth_user_id = v_auth_user_id;
  end if;

  perform public.record_login();
  return v_teacher_id;
end;
$$;

revoke all on function public.complete_teacher_profile_and_login(text, text) from public;
grant execute on function public.complete_teacher_profile_and_login(text, text) to authenticated;
