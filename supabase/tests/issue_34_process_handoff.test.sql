begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000003401', 'handoff-a@example.test'),
  ('00000000-0000-4000-8000-000000003402', 'handoff-b@example.test');

insert into public.teachers (id, auth_user_id, name) values
  ('00000000-0000-4000-8000-000000003411', '00000000-0000-4000-8000-000000003401', 'Synthetic Handoff Teacher A'),
  ('00000000-0000-4000-8000-000000003412', '00000000-0000-4000-8000-000000003402', 'Synthetic Handoff Teacher B');

insert into public.classes (id, teacher_id, name, grade) values
  ('00000000-0000-4000-8000-000000003421', '00000000-0000-4000-8000-000000003411', 'Synthetic Handoff Class A', 3),
  ('00000000-0000-4000-8000-000000003422', '00000000-0000-4000-8000-000000003412', 'Synthetic Handoff Class B', 3);

insert into public.students (id, class_id, student_number, name) values
  ('00000000-0000-4000-8000-000000003431', '00000000-0000-4000-8000-000000003421', 19, 'Synthetic Live Student S'),
  ('00000000-0000-4000-8000-000000003432', '00000000-0000-4000-8000-000000003421', 20, 'Synthetic Live Student T'),
  ('00000000-0000-4000-8000-000000003433', '00000000-0000-4000-8000-000000003422', 1, 'Synthetic Foreign Student');

insert into public.activities (id, teacher_id, title, status) values
  ('00000000-0000-4000-8000-000000003441', '00000000-0000-4000-8000-000000003411', 'Synthetic Live Activity A4', 'ACTIVE'),
  ('00000000-0000-4000-8000-000000003442', '00000000-0000-4000-8000-000000003412', 'Synthetic Foreign Activity', 'ACTIVE');

insert into public.activity_standards (activity_id, standard_id) values
  ('00000000-0000-4000-8000-000000003441', '4국02-01'),
  ('00000000-0000-4000-8000-000000003442', '4국02-01');

insert into public.activity_assignments (id, activity_id, class_id, status) values
  ('00000000-0000-4000-8000-000000003451', '00000000-0000-4000-8000-000000003441', '00000000-0000-4000-8000-000000003421', 'OPEN'),
  ('00000000-0000-4000-8000-000000003452', '00000000-0000-4000-8000-000000003442', '00000000-0000-4000-8000-000000003422', 'OPEN');

insert into public.submissions (
  id, student_id, activity_assignment_id, structured_input, input_status, process_status
) values
  ('00000000-0000-4000-8000-000000003461', '00000000-0000-4000-8000-000000003431', '00000000-0000-4000-8000-000000003451', '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"short_text","response":{"raw_text":"synthetic S response"}}]}', 'READY_FOR_PROCESS', 'READY_TO_ANALYZE'),
  ('00000000-0000-4000-8000-000000003462', '00000000-0000-4000-8000-000000003432', '00000000-0000-4000-8000-000000003451', '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"short_text","response":{"raw_text":"synthetic T response"}}]}', 'READY_FOR_PROCESS', 'READY_TO_ANALYZE'),
  ('00000000-0000-4000-8000-000000003463', '00000000-0000-4000-8000-000000003433', '00000000-0000-4000-8000-000000003452', '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"short_text","response":{"raw_text":"foreign response"}}]}', 'READY_FOR_PROCESS', 'READY_TO_ANALYZE');

insert into public.artifacts (
  id, submission_id, owner_teacher_id, source_artifact_id, storage_path,
  file_name, mime_type, artifact_role, page_start, page_end
) values
  ('00000000-0000-4000-8000-000000003471', '00000000-0000-4000-8000-000000003461', null, null, 'teachers/synthetic/submission-s/original.png', 'synthetic-s.png', 'image/png', 'ORIGINAL', null, null),
  ('00000000-0000-4000-8000-000000003472', null, '00000000-0000-4000-8000-000000003411', null, 'teachers/synthetic/batch/original.pdf', 'synthetic-batch.pdf', 'application/pdf', 'ORIGINAL', 1, 4),
  ('00000000-0000-4000-8000-000000003473', '00000000-0000-4000-8000-000000003462', null, '00000000-0000-4000-8000-000000003472', 'teachers/synthetic/batch/original.pdf', 'synthetic-t-pages.pdf', 'application/pdf', 'DERIVED', 3, 4);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000003401', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003401","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.submissions where id in ('00000000-0000-4000-8000-000000003461', '00000000-0000-4000-8000-000000003462')),
  2::bigint,
  'PROCESS reads exactly live S/T Submission IDs'
);
select is(
  (select count(*) from public.submissions submission join public.students student on student.id = submission.student_id join public.classes class on class.id = student.class_id where submission.id in ('00000000-0000-4000-8000-000000003461', '00000000-0000-4000-8000-000000003462') and class.id = '00000000-0000-4000-8000-000000003421'),
  2::bigint,
  'Submission resolves Student and Class relation'
);
select is(
  (select count(*) from public.submissions submission join public.activity_assignments assignment on assignment.id = submission.activity_assignment_id join public.activities activity on activity.id = assignment.activity_id where submission.id in ('00000000-0000-4000-8000-000000003461', '00000000-0000-4000-8000-000000003462') and activity.id = '00000000-0000-4000-8000-000000003441'),
  2::bigint,
  'Submission resolves ActivityAssignment and Activity'
);
select is(
  (select count(*) from public.activity_standards where activity_id = '00000000-0000-4000-8000-000000003441' and standard_id = '4국02-01'),
  1::bigint,
  'Activity resolves Standard relation'
);
select is(
  (select count(*) from public.submissions where id in ('00000000-0000-4000-8000-000000003461', '00000000-0000-4000-8000-000000003462') and structured_input ->> 'schema_version' = '1' and jsonb_array_length(structured_input -> 'questions') = 1),
  2::bigint,
  'PROCESS reads persisted StructuredInput from Shared Submission'
);
select is(
  (select count(*) from public.submissions submission where submission.id in ('00000000-0000-4000-8000-000000003461', '00000000-0000-4000-8000-000000003462') and exists (select 1 from public.artifacts artifact left join public.artifacts source on source.id = artifact.source_artifact_id where artifact.submission_id = submission.id and ((artifact.artifact_role = 'ORIGINAL' and artifact.storage_path <> '') or (artifact.artifact_role = 'DERIVED' and source.artifact_role = 'ORIGINAL' and source.owner_teacher_id = '00000000-0000-4000-8000-000000003411' and source.storage_path <> '')))),
  2::bigint,
  'direct and Batch-derived Artifacts both resolve an ORIGINAL reference'
);
select is((select count(*) from public.submissions where id in ('00000000-0000-4000-8000-000000003461', '00000000-0000-4000-8000-000000003462') and input_status = 'READY_FOR_PROCESS'), 2::bigint, 'both INPUT statuses are READY_FOR_PROCESS');
select is((select count(*) from public.submissions where id in ('00000000-0000-4000-8000-000000003461', '00000000-0000-4000-8000-000000003462') and process_status = 'READY_TO_ANALYZE'), 2::bigint, 'PROCESS status remains independent and ready');
select is((select count(*) from public.submissions where id = '00000000-0000-4000-8000-000000003463'), 0::bigint, 'foreign Teacher Submission is invisible through RLS');

insert into public.processing_jobs (teacher_id, job_type, payload_json, total_count) values (
  '00000000-0000-4000-8000-000000003411',
  'ANALYSIS',
  '{"submission_ids":["00000000-0000-4000-8000-000000003461","00000000-0000-4000-8000-000000003462"]}',
  2
);
select is((
  select count(*)::integer
  from public.processing_jobs job
  cross join lateral jsonb_object_keys(job.payload_json) payload_key
  where job.teacher_id = '00000000-0000-4000-8000-000000003411'
), 1, 'Job payload contains only the submission_ids field');
select is((select jsonb_array_length(payload_json -> 'submission_ids') from public.processing_jobs where teacher_id = '00000000-0000-4000-8000-000000003411'), 2, 'Job payload carries only live S/T IDs');

reset role;
select * from finish();
rollback;
