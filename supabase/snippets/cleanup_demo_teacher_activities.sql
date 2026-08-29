-- One-time demo reset: keep the registered Class/Roster and delete demo data.
-- Run the complete file in the Supabase SQL Editor.
--
-- Safety guard:
-- - ignores synthetic @example.test users;
-- - requires exactly one real Teacher whose retained Roster has 20 Students;
-- - aborts atomically without deleting anything when the target is ambiguous.
--
-- Deletes Activities and their dependent rows, Teacher-owned Batch Artifact
-- rows, processing Jobs, and GrowthEvents for the retained Roster.
-- It does not delete Classes, Students, required audit history, or Storage
-- objects. Delete the returned Storage prefix through the Storage Dashboard.

begin;

do $$
declare
  target_teacher_ids uuid[];
  target_teacher_id uuid;
  deleted_activity_count integer;
begin
  select array_agg(teacher.id)
  into target_teacher_ids
  from public.teachers teacher
  join auth.users auth_user on auth_user.id = teacher.auth_user_id
  where auth_user.email is not null
    and auth_user.email not like '%@example.test'
    and exists (
      select 1
      from public.classes class
      where class.teacher_id = teacher.id
    )
    and 20 = (
      select count(*)
      from public.students student
      join public.classes class on class.id = student.class_id
      where class.teacher_id = teacher.id
    );

  if coalesce(cardinality(target_teacher_ids), 0) <> 1 then
    raise exception
      'Cleanup aborted: expected exactly one real Teacher with a 20-Student Roster, found %',
      coalesce(cardinality(target_teacher_ids), 0);
  end if;

  target_teacher_id := target_teacher_ids[1];

  delete from public.activities activity
  where activity.teacher_id = target_teacher_id;
  get diagnostics deleted_activity_count = row_count;

  -- Delete child Batch range rows before their Teacher-owned source rows.
  delete from public.artifacts artifact
  where artifact.owner_teacher_id = target_teacher_id
    and artifact.source_artifact_id is not null;

  delete from public.artifacts artifact
  where artifact.owner_teacher_id = target_teacher_id;

  delete from public.processing_jobs job
  where job.teacher_id = target_teacher_id;

  delete from public.growth_events growth_event
  where growth_event.student_id in (
    select student.id
    from public.students student
    join public.classes class on class.id = student.class_id
    where class.teacher_id = target_teacher_id
  );

  insert into public.audit_logs (
    actor_teacher_id, action, entity_type, entity_id, request_id, metadata_json
  ) values (
    target_teacher_id,
    'DATA_DELETE',
    'Teacher',
    target_teacher_id,
    gen_random_uuid()::text,
    null
  );

  raise notice 'Deleted % Activities for Teacher %', deleted_activity_count, target_teacher_id;
end;
$$;

with target as (
  select teacher.id
  from public.teachers teacher
  join auth.users auth_user on auth_user.id = teacher.auth_user_id
  where auth_user.email is not null
    and auth_user.email not like '%@example.test'
    and 20 = (
      select count(*)
      from public.students student
      join public.classes class on class.id = student.class_id
      where class.teacher_id = teacher.id
    )
)
select
  (select count(*)::integer
   from public.classes class
   where class.teacher_id = target.id) as remaining_class_count,
  (select count(*)::integer
   from public.students student
   join public.classes class on class.id = student.class_id
   where class.teacher_id = target.id) as remaining_student_count,
  (select count(*)::integer
   from public.activities activity
   where activity.teacher_id = target.id) as remaining_activity_count,
  (select count(*)::integer
   from public.artifacts artifact
   where artifact.owner_teacher_id = target.id) as remaining_batch_artifact_count,
  (select count(*)::integer
   from public.processing_jobs job
   where job.teacher_id = target.id) as remaining_processing_job_count,
  (select count(*)::integer
   from public.growth_events growth_event
   join public.students student on student.id = growth_event.student_id
   join public.classes class on class.id = student.class_id
   where class.teacher_id = target.id) as remaining_growth_event_count,
  'teachers/' || target.id::text || '/' as storage_prefix_to_delete
from target;

commit;
