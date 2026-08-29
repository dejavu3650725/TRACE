-- Restore the existing PROCESS audit contract as a forward migration.
-- Two historical 0005 files can be applied inconsistently when migrations
-- are run manually, leaving record_analysis_event absent from PostgREST.

create or replace function public.record_analysis_event(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_request_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid;
begin
  select teacher.id into v_teacher_id
  from public.teachers teacher
  where teacher.auth_user_id = auth.uid();

  if v_teacher_id is null then
    raise exception using errcode = '42501', message = 'authenticated Teacher Profile required';
  end if;

  if p_action not in (
    'ANALYSIS_START', 'ANALYSIS_APPROVE',
    'ANALYSIS_EDIT_APPROVE', 'ANALYSIS_REJECT'
  ) then
    raise exception using errcode = '22023', message = 'unsupported analysis audit action';
  end if;

  if p_entity_type not in ('processing_job', 'analysis') then
    raise exception using errcode = '22023', message = 'unsupported analysis audit entity type';
  end if;

  insert into public.audit_logs (
    actor_teacher_id, action, entity_type, entity_id, request_id, metadata_json
  ) values (
    v_teacher_id,
    p_action,
    p_entity_type,
    p_entity_id,
    nullif(btrim(coalesce(p_request_id, '')), ''),
    null
  );
end;
$$;

revoke all on function public.record_analysis_event(text, text, uuid, text) from public;
grant execute on function public.record_analysis_event(text, text, uuid, text) to authenticated;
