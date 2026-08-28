-- TRACE PROCESS audit RPC (ISSUE: PROCESS 분석 파이프라인)
-- 0004가 audit_logs 직접 INSERT를 차단함에 따라, DB_HANDOFF_ISSUE_02_03 규칙대로
-- 분석 이벤트 전용 고정형 RPC를 추가한다. 허용 Action 4종 외에는 기록할 수 없다.

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
  select id into v_teacher_id
  from public.teachers
  where auth_user_id = auth.uid();

  if v_teacher_id is null then
    raise exception using errcode = '42501', message = 'authenticated Teacher Profile required';
  end if;

  if p_action not in ('ANALYSIS_START', 'ANALYSIS_APPROVE', 'ANALYSIS_EDIT_APPROVE', 'ANALYSIS_REJECT') then
    raise exception using errcode = '22023', message = 'unsupported analysis audit action';
  end if;

  if p_entity_type not in ('processing_job', 'analysis') then
    raise exception using errcode = '22023', message = 'unsupported analysis audit entity type';
  end if;

  -- Audit 최소화 원칙(TRD §16.14): metadata는 기록하지 않는다.
  insert into public.audit_logs (
    actor_teacher_id, action, entity_type, entity_id, request_id, metadata_json
  ) values (
    v_teacher_id, p_action, p_entity_type, p_entity_id,
    nullif(btrim(coalesce(p_request_id, '')), ''), null
  );
end;
$$;

revoke all on function public.record_analysis_event(text, text, uuid, text) from public;
grant execute on function public.record_analysis_event(text, text, uuid, text) to authenticated;
