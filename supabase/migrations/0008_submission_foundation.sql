-- ISSUE-14: idempotent Submission foundation.
-- Preserves the shared invariant: one Student x one ActivityAssignment = one Submission.

create or replace function public.get_or_create_submission(
  p_student_id uuid,
  p_activity_assignment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid := public.current_teacher_id();
  v_class_id uuid;
  v_submission_id uuid;
begin
  if v_teacher_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
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

  if not exists (
    select 1
    from public.students student
    where student.id = p_student_id
      and student.class_id = v_class_id
  ) then
    raise exception using errcode = '42501', message = 'Student is outside ActivityAssignment Class';
  end if;

  insert into public.submissions (
    student_id,
    activity_assignment_id,
    structured_input,
    input_status,
    process_status,
    current_attempt_no
  ) values (
    p_student_id,
    p_activity_assignment_id,
    null,
    'UPLOADING',
    'NOT_STARTED',
    1
  )
  on conflict (student_id, activity_assignment_id) do nothing
  returning id into v_submission_id;

  if v_submission_id is null then
    select submission.id into v_submission_id
    from public.submissions submission
    where submission.student_id = p_student_id
      and submission.activity_assignment_id = p_activity_assignment_id;
  end if;

  if v_submission_id is null then
    raise exception using errcode = '40001', message = 'Submission could not be created or retrieved';
  end if;

  return v_submission_id;
end;
$$;

revoke all on function public.get_or_create_submission(uuid, uuid) from public;
grant execute on function public.get_or_create_submission(uuid, uuid) to authenticated;
