-- Fix the UUID function reference used by the roster-import audit event.
-- 0005 was already applied to the development database, so this forward
-- migration replaces the deployed RPC without changing its public contract.

create or replace function public.commit_roster_import(
  p_class_id uuid,
  p_students jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid;
  v_audit_id uuid;
begin
  select c.teacher_id into v_teacher_id
  from public.classes c
  where c.id = p_class_id
    and c.teacher_id = public.current_teacher_id();

  if v_teacher_id is null then
    raise exception using errcode = '42501', message = 'Class is outside current Teacher scope';
  end if;

  if p_students is null or jsonb_typeof(p_students) <> 'array' then
    raise exception using errcode = '22023', message = 'roster rows must be an array';
  end if;
  if jsonb_array_length(p_students) = 0 then
    raise exception using errcode = '22023', message = 'roster rows must not be empty';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_students) as row_data(student_number integer, student_name text)
    where student_number is null
      or student_number < -32768
      or student_number > 32767
      or nullif(btrim(student_name), '') is null
  ) then
    raise exception using errcode = '22023', message = 'invalid roster rows';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_students) as row_data(student_number integer, student_name text)
    group by student_number
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'duplicate student number in roster rows';
  end if;

  insert into public.students (class_id, student_number, name, is_active)
  select p_class_id, row_data.student_number::smallint, btrim(row_data.student_name), true
  from jsonb_to_recordset(p_students) as row_data(student_number integer, student_name text)
  on conflict (class_id, student_number) do update
    set name = excluded.name,
        is_active = true;

  insert into public.audit_logs (
    actor_teacher_id, action, entity_type, entity_id, request_id, metadata_json
  ) values (
    v_teacher_id,
    'ROSTER_IMPORT',
    'Class',
    p_class_id,
    gen_random_uuid()::text,
    null
  ) returning id into v_audit_id;

  return v_audit_id;
end;
$$;

revoke all on function public.commit_roster_import(uuid, jsonb) from public;
grant execute on function public.commit_roster_import(uuid, jsonb) to authenticated;
