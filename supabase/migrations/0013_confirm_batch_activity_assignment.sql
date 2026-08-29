-- ISSUE-26/27: teacher-confirmed Activity selection for an unassigned Batch PDF.
-- Existing shared Activity/Standard/Assignment contracts are reused atomically.

create or replace function public.confirm_batch_activity_assignment(
  p_source_artifact_id uuid,
  p_class_id uuid,
  p_existing_activity_id uuid,
  p_title text,
  p_grade smallint,
  p_subject text,
  p_domain text,
  p_unit text,
  p_activity_type text,
  p_description text,
  p_standard_ids text[],
  p_content_json jsonb,
  p_code_prefix text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid := public.current_teacher_id();
  v_activity_id uuid;
  v_assignment_id uuid;
  v_created boolean := false;
begin
  if v_teacher_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if not exists (
    select 1 from public.artifacts artifact
    where artifact.id = p_source_artifact_id
      and artifact.owner_teacher_id = v_teacher_id
      and artifact.submission_id is null
      and artifact.source_artifact_id is null
      and artifact.artifact_role = 'ORIGINAL'
      and artifact.mime_type = 'application/pdf'
  ) then
    raise exception using errcode = '42501', message = 'Batch PDF is outside current Teacher scope';
  end if;
  if not exists (
    select 1 from public.classes class
    where class.id = p_class_id and class.teacher_id = v_teacher_id and class.is_active = true
  ) then
    raise exception using errcode = '42501', message = 'Class is outside current Teacher scope';
  end if;

  if p_existing_activity_id is not null then
    select activity.id into v_activity_id
    from public.activities activity
    where activity.id = p_existing_activity_id
      and activity.teacher_id = v_teacher_id
      and activity.status = 'ACTIVE';
    if v_activity_id is null then
      raise exception using errcode = '42501', message = 'Owned ACTIVE Activity required';
    end if;
  else
    if p_content_json is null
       or jsonb_typeof(p_content_json) <> 'object'
       or p_content_json ->> 'schema_version' <> '1'
       or p_content_json ->> 'source' <> 'AI_DRAFT'
       or jsonb_typeof(p_content_json -> 'questions') <> 'array'
       or jsonb_array_length(p_content_json -> 'questions') < 1 then
      raise exception using errcode = '22023', message = 'Invalid scanned Activity content';
    end if;

    v_activity_id := public.save_activity(
      null, p_title, p_grade, p_subject, p_domain, p_unit, p_activity_type,
      p_description, null, p_standard_ids
    );
    update public.activities
    set content_json = p_content_json
    where id = v_activity_id and teacher_id = v_teacher_id;
    perform public.activate_activity(v_activity_id, p_code_prefix);
    v_created := true;
  end if;

  perform public.assign_activity_to_classes(
    v_activity_id,
    array[p_class_id]::uuid[],
    null::timestamptz,
    null::timestamptz
  );
  select assignment.id into v_assignment_id
  from public.activity_assignments assignment
  where assignment.activity_id = v_activity_id and assignment.class_id = p_class_id;

  if v_assignment_id is null then
    raise exception using errcode = '40001', message = 'ActivityAssignment could not be created or retrieved';
  end if;

  return jsonb_build_object(
    'activity_id', v_activity_id,
    'activity_assignment_id', v_assignment_id,
    'created_activity', v_created
  );
end;
$$;

revoke all on function public.confirm_batch_activity_assignment(uuid, uuid, uuid, text, smallint, text, text, text, text, text, text[], jsonb, text) from public;
grant execute on function public.confirm_batch_activity_assignment(uuid, uuid, uuid, text, smallint, text, text, text, text, text, text[], jsonb, text) to authenticated;
