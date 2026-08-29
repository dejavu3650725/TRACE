-- ISSUE-29: privacy-safe exact Batch identity matching and Submission attachment.
-- Adds no shared Entity or status. Visible identity is transient and is never
-- copied into processing_jobs, audit_logs, or submissions.structured_input.

create or replace function public.enforce_batch_page_range_non_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_artifact_id is null or new.page_start is null or new.page_end is null then
    return new;
  end if;

  if exists (
    select 1
    from public.artifacts source
    where source.id = new.source_artifact_id
      and source.submission_id is null
      and source.owner_teacher_id is not null
      and source.source_artifact_id is null
      and source.artifact_role = 'ORIGINAL'
      and source.mime_type = 'application/pdf'
  ) and exists (
    select 1
    from public.artifacts sibling
    where sibling.source_artifact_id = new.source_artifact_id
      and sibling.id <> new.id
      and sibling.page_start is not null
      and sibling.page_end is not null
      and new.page_start <= sibling.page_end
      and sibling.page_start <= new.page_end
  ) then
    raise exception using errcode = '23514', message = 'Batch PDF page ranges must not overlap';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_artifacts_batch_range_non_overlap on public.artifacts;
create trigger trg_artifacts_batch_range_non_overlap
before insert or update of source_artifact_id, page_start, page_end on public.artifacts
for each row execute function public.enforce_batch_page_range_non_overlap();

create or replace function public.commit_batch_student_match(
  p_source_artifact_id uuid,
  p_range_artifact_id uuid,
  p_activity_assignment_id uuid,
  p_student_id uuid,
  p_visible_student_number text,
  p_visible_student_name text,
  p_structured_input jsonb,
  p_input_status public.input_status
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid := public.current_teacher_id();
  v_class_id uuid;
  v_source public.artifacts%rowtype;
  v_range public.artifacts%rowtype;
  v_student public.students%rowtype;
  v_submission_id uuid;
  v_existing_input jsonb;
begin
  if v_teacher_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_input_status not in ('REVIEW_PENDING', 'READY_FOR_PROCESS') then
    raise exception using errcode = '22023', message = 'Invalid Batch match input status';
  end if;

  select * into v_source
  from public.artifacts source
  where source.id = p_source_artifact_id
    and source.owner_teacher_id = v_teacher_id
    and source.submission_id is null
    and source.source_artifact_id is null
    and source.artifact_role = 'ORIGINAL'
    and source.mime_type = 'application/pdf';
  if v_source.id is null then
    raise exception using errcode = '42501', message = 'Batch PDF is outside current Teacher scope';
  end if;

  select assignment.class_id into v_class_id
  from public.activity_assignments assignment
  join public.activities activity on activity.id = assignment.activity_id
  join public.classes class on class.id = assignment.class_id
  where assignment.id = p_activity_assignment_id
    and activity.teacher_id = v_teacher_id
    and class.teacher_id = v_teacher_id;
  if v_class_id is null then
    raise exception using errcode = '42501', message = 'ActivityAssignment is outside current Teacher scope';
  end if;

  select * into v_student
  from public.students student
  where student.id = p_student_id
    and student.class_id = v_class_id
    and student.is_active = true;
  if v_student.id is null then
    raise exception using errcode = '42501', message = 'Student is outside ActivityAssignment Class';
  end if;
  if btrim(coalesce(p_visible_student_number, '')) !~ '^[1-9][0-9]{0,4}$'
     or btrim(p_visible_student_number)::integer <> v_student.student_number
     or lower(regexp_replace(btrim(coalesce(p_visible_student_name, '')), '\s+', '', 'g'))
        <> lower(regexp_replace(btrim(v_student.name), '\s+', '', 'g')) then
    raise exception using errcode = '22023', message = 'Visible identity is not an exact Roster match';
  end if;

  select * into v_range
  from public.artifacts range_artifact
  where range_artifact.id = p_range_artifact_id
    and range_artifact.source_artifact_id = v_source.id
    and range_artifact.owner_teacher_id = v_teacher_id
    and range_artifact.submission_id is null
    and range_artifact.artifact_role = 'DERIVED'
    and range_artifact.page_start is not null
    and range_artifact.page_end is not null
  for update;
  if v_range.id is null then
    raise exception using errcode = '42501', message = 'Batch page range is outside current Teacher scope';
  end if;

  if p_structured_input is null
     or jsonb_typeof(p_structured_input) <> 'object'
     or p_structured_input ->> 'schema_version' <> '1'
     or jsonb_typeof(p_structured_input -> 'questions') <> 'array'
     or jsonb_array_length(p_structured_input -> 'questions') < 1
     or (p_structured_input - array['schema_version', 'questions']) <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'Invalid StructuredInput envelope';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_structured_input -> 'questions') question(value)
    where jsonb_typeof(question.value) <> 'object'
      or nullif(btrim(question.value ->> 'question_id'), '') is null
      or question.value ->> 'response_type' not in (
        'short_text', 'long_text', 'selection', 'checkbox', 'matching',
        'underline', 'circle', 'drawing_or_mark', 'blank', 'unknown'
      )
      or jsonb_typeof(question.value -> 'response') <> 'object'
      or (question.value - array['question_id', 'response_type', 'response']) <> '{}'::jsonb
      or exists (
        select 1
        from jsonb_object_keys(question.value -> 'response') response_key(key)
        where lower(regexp_replace(response_key.key, '[^a-z0-9]', '', 'g')) in (
          'correct', 'correctness', 'iscorrect', 'score', 'achievementlevel',
          'strength', 'strengths', 'difficulty', 'difficulties', 'evidence',
          'feedback', 'growth', 'studentid', 'studentname', 'studentnumber', 'teacheremail'
        )
      )
  ) then
    raise exception using errcode = '22023', message = 'Invalid observable response';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_structured_input -> 'questions') question(value)
    group by question.value ->> 'question_id'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'Duplicate StructuredInput question ID';
  end if;

  insert into public.submissions (
    student_id, activity_assignment_id, structured_input, input_status,
    process_status, current_attempt_no, submitted_at
  ) values (
    v_student.id, p_activity_assignment_id, p_structured_input, p_input_status,
    case when p_input_status = 'READY_FOR_PROCESS' then 'READY_TO_ANALYZE'::public.process_status else 'NOT_STARTED'::public.process_status end,
    1, now()
  )
  on conflict (student_id, activity_assignment_id) do nothing
  returning id into v_submission_id;

  if v_submission_id is null then
    select submission.id, submission.structured_input
      into v_submission_id, v_existing_input
    from public.submissions submission
    where submission.student_id = v_student.id
      and submission.activity_assignment_id = p_activity_assignment_id
    for update;
    if v_submission_id is null then
      raise exception using errcode = '40001', message = 'Submission could not be created or retrieved';
    end if;
    if v_existing_input is not null and v_existing_input <> p_structured_input then
      raise exception using errcode = '23505', message = 'Submission already contains different StructuredInput';
    end if;
    update public.submissions
    set structured_input = p_structured_input,
        input_status = p_input_status,
        process_status = case
          when process_status in ('NOT_STARTED', 'READY_TO_ANALYZE') and p_input_status = 'READY_FOR_PROCESS'
            then 'READY_TO_ANALYZE'::public.process_status
          when process_status in ('NOT_STARTED', 'READY_TO_ANALYZE')
            then 'NOT_STARTED'::public.process_status
          else process_status
        end,
        submitted_at = coalesce(submitted_at, now())
    where id = v_submission_id;
  end if;

  update public.artifacts
  set submission_id = v_submission_id,
      owner_teacher_id = null
  where id = v_range.id;

  return jsonb_build_object(
    'submission_id', v_submission_id,
    'range_artifact_id', v_range.id,
    'page_start', v_range.page_start,
    'page_end', v_range.page_end,
    'input_status', p_input_status::text
  );
end;
$$;

revoke all on function public.commit_batch_student_match(uuid, uuid, uuid, uuid, text, text, jsonb, public.input_status) from public;
grant execute on function public.commit_batch_student_match(uuid, uuid, uuid, uuid, text, text, jsonb, public.input_status) to authenticated;
