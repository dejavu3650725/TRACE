-- ISSUE-30: teacher-confirmed Batch page-group correction.
-- Reuses the ISSUE-29 commit contract after deriving visible identity from the
-- owned Class roster. No Student PII is accepted as a trusted client value.

create or replace function public.commit_batch_teacher_correction(
  p_source_artifact_id uuid,
  p_range_artifact_id uuid,
  p_activity_assignment_id uuid,
  p_student_id uuid,
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
  v_student_number text;
  v_student_name text;
begin
  if v_teacher_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select student.student_number::text, student.name
    into v_student_number, v_student_name
  from public.activity_assignments assignment
  join public.activities activity on activity.id = assignment.activity_id
  join public.classes class on class.id = assignment.class_id
  join public.students student
    on student.class_id = assignment.class_id
   and student.id = p_student_id
   and student.is_active = true
  where assignment.id = p_activity_assignment_id
    and activity.teacher_id = v_teacher_id
    and class.teacher_id = v_teacher_id;

  if v_student_number is null or v_student_name is null then
    raise exception using errcode = '42501', message = 'Student is outside ActivityAssignment Class';
  end if;

  return public.commit_batch_student_match(
    p_source_artifact_id,
    p_range_artifact_id,
    p_activity_assignment_id,
    p_student_id,
    v_student_number,
    v_student_name,
    p_structured_input,
    p_input_status
  );
end;
$$;

revoke all on function public.commit_batch_teacher_correction(uuid, uuid, uuid, uuid, jsonb, public.input_status) from public;
grant execute on function public.commit_batch_teacher_correction(uuid, uuid, uuid, uuid, jsonb, public.input_status) to authenticated;
