-- ISSUE-32: atomically resolve an INPUT review without weakening READY_FOR_PROCESS.

create or replace function public.resolve_submission_input_review(
  p_submission_id uuid,
  p_student_id uuid,
  p_activity_assignment_id uuid,
  p_structured_input jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid := public.current_teacher_id();
  v_submission public.submissions%rowtype;
begin
  if v_teacher_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select submission.* into v_submission
  from public.submissions submission
  join public.activity_assignments assignment on assignment.id = submission.activity_assignment_id
  join public.activities activity on activity.id = assignment.activity_id
  join public.classes class on class.id = assignment.class_id
  where submission.id = p_submission_id
    and activity.teacher_id = v_teacher_id
    and class.teacher_id = v_teacher_id
  for update of submission;

  if v_submission.id is null then
    raise exception using errcode = '42501', message = 'Submission is outside current Teacher scope';
  end if;
  if v_submission.input_status <> 'REVIEW_PENDING'::public.input_status then
    raise exception using errcode = '22023', message = 'Submission is not awaiting INPUT review';
  end if;
  if v_submission.process_status not in ('NOT_STARTED', 'READY_TO_ANALYZE') then
    raise exception using errcode = '22023', message = 'Submission processing has already started';
  end if;

  if not exists (
    select 1
    from public.activity_assignments assignment
    join public.activities activity on activity.id = assignment.activity_id
    join public.classes class on class.id = assignment.class_id
    join public.students student
      on student.class_id = assignment.class_id
     and student.id = p_student_id
     and student.is_active = true
    where assignment.id = p_activity_assignment_id
      and assignment.status <> 'ARCHIVED'::public.activity_assignment_status
      and activity.teacher_id = v_teacher_id
      and activity.status = 'ACTIVE'::public.activity_status
      and class.teacher_id = v_teacher_id
      and class.is_active = true
  ) then
    raise exception using errcode = '42501', message = 'Student and ActivityAssignment are outside current Teacher Class scope';
  end if;

  if jsonb_typeof(p_structured_input) <> 'object'
    or p_structured_input ->> 'schema_version' <> '1'
    or jsonb_typeof(p_structured_input -> 'questions') <> 'array'
    or jsonb_array_length(p_structured_input -> 'questions') = 0
    or jsonb_array_length(p_structured_input -> 'questions') > 200
    or (p_structured_input - array['schema_version', 'questions']) <> '{}'::jsonb
  then
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
      or question.value -> 'response' = '{}'::jsonb
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

  if not exists (
    select 1
    from public.artifacts artifact
    left join public.artifacts source on source.id = artifact.source_artifact_id
    where artifact.submission_id = v_submission.id
      and (
        (
          artifact.artifact_role = 'ORIGINAL'::public.artifact_role
          and nullif(artifact.storage_path, '') is not null
        )
        or (
          source.id is not null
          and source.artifact_role = 'ORIGINAL'::public.artifact_role
          and source.owner_teacher_id = v_teacher_id
          and nullif(source.storage_path, '') is not null
        )
      )
  ) then
    raise exception using errcode = '22023', message = 'Stored ORIGINAL Artifact is required';
  end if;

  update public.submissions
  set student_id = p_student_id,
      activity_assignment_id = p_activity_assignment_id,
      structured_input = p_structured_input,
      input_status = 'READY_FOR_PROCESS',
      process_status = 'READY_TO_ANALYZE',
      submitted_at = coalesce(submitted_at, now())
  where id = v_submission.id;

  return jsonb_build_object(
    'submission_id', v_submission.id,
    'student_id', p_student_id,
    'activity_assignment_id', p_activity_assignment_id,
    'input_status', 'READY_FOR_PROCESS',
    'process_status', 'READY_TO_ANALYZE'
  );
end;
$$;

revoke all on function public.resolve_submission_input_review(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.resolve_submission_input_review(uuid, uuid, uuid, jsonb) to authenticated;
