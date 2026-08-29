begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000002901', 'batch-match-a@example.test'),
  ('00000000-0000-4000-8000-000000002902', 'batch-match-b@example.test');
insert into public.teachers (id, auth_user_id, name) values
  ('00000000-0000-4000-8000-000000002911', '00000000-0000-4000-8000-000000002901', 'Synthetic Match Teacher A'),
  ('00000000-0000-4000-8000-000000002912', '00000000-0000-4000-8000-000000002902', 'Synthetic Match Teacher B');
insert into public.classes (id, teacher_id, name, grade) values
  ('00000000-0000-4000-8000-000000002921', '00000000-0000-4000-8000-000000002911', 'Synthetic Grade 3 Class 1', 3),
  ('00000000-0000-4000-8000-000000002922', '00000000-0000-4000-8000-000000002912', 'Synthetic Foreign Class', 3);
insert into public.students (id, class_id, student_number, name) values
  ('00000000-0000-4000-8000-000000002931', '00000000-0000-4000-8000-000000002921', 1, 'Synthetic Student One'),
  ('00000000-0000-4000-8000-000000002932', '00000000-0000-4000-8000-000000002921', 2, 'Synthetic Student Two'),
  ('00000000-0000-4000-8000-000000002933', '00000000-0000-4000-8000-000000002922', 1, 'Synthetic Foreign Student');
insert into public.activities (id, teacher_id, title, status) values
  ('00000000-0000-4000-8000-000000002941', '00000000-0000-4000-8000-000000002911', 'Synthetic Fraction Activity', 'ACTIVE'),
  ('00000000-0000-4000-8000-000000002942', '00000000-0000-4000-8000-000000002912', 'Synthetic Foreign Activity', 'ACTIVE');
insert into public.activity_assignments (id, activity_id, class_id, status) values
  ('00000000-0000-4000-8000-000000002951', '00000000-0000-4000-8000-000000002941', '00000000-0000-4000-8000-000000002921', 'OPEN'),
  ('00000000-0000-4000-8000-000000002952', '00000000-0000-4000-8000-000000002942', '00000000-0000-4000-8000-000000002922', 'OPEN');
insert into storage.objects (bucket_id, name) values
  ('trace', 'teachers/00000000-0000-4000-8000-000000002911/batches/00000000-0000-4000-8000-000000002961/original/00000000-0000-4000-8000-000000002961.pdf'),
  ('trace', 'teachers/00000000-0000-4000-8000-000000002912/batches/00000000-0000-4000-8000-000000002962/original/00000000-0000-4000-8000-000000002962.pdf');
insert into public.artifacts (
  id, owner_teacher_id, storage_path, file_name, mime_type, file_size_bytes,
  checksum, artifact_role, page_start, page_end
) values
  ('00000000-0000-4000-8000-000000002961', '00000000-0000-4000-8000-000000002911', 'teachers/00000000-0000-4000-8000-000000002911/batches/00000000-0000-4000-8000-000000002961/original/00000000-0000-4000-8000-000000002961.pdf', 'synthetic-match.pdf', 'application/pdf', 4096, repeat('a', 64), 'ORIGINAL', 1, 4),
  ('00000000-0000-4000-8000-000000002962', '00000000-0000-4000-8000-000000002912', 'teachers/00000000-0000-4000-8000-000000002912/batches/00000000-0000-4000-8000-000000002962/original/00000000-0000-4000-8000-000000002962.pdf', 'synthetic-foreign.pdf', 'application/pdf', 4096, repeat('b', 64), 'ORIGINAL', 1, 1),
  ('00000000-0000-4000-8000-000000002971', '00000000-0000-4000-8000-000000002911', 'teachers/00000000-0000-4000-8000-000000002911/batches/00000000-0000-4000-8000-000000002961/original/00000000-0000-4000-8000-000000002961.pdf', 'synthetic-match.pdf', 'application/pdf', 4096, repeat('a', 64), 'DERIVED', 3, 3),
  ('00000000-0000-4000-8000-000000002972', '00000000-0000-4000-8000-000000002911', 'teachers/00000000-0000-4000-8000-000000002911/batches/00000000-0000-4000-8000-000000002961/original/00000000-0000-4000-8000-000000002961.pdf', 'synthetic-match.pdf', 'application/pdf', 4096, repeat('a', 64), 'DERIVED', 1, 1);
update public.artifacts set source_artifact_id = '00000000-0000-4000-8000-000000002961' where id in ('00000000-0000-4000-8000-000000002971', '00000000-0000-4000-8000-000000002972');

select has_function('public', 'commit_batch_student_match', array['uuid','uuid','uuid','uuid','text','text','jsonb','input_status'], 'Batch match commit RPC exists');
select ok(exists (select 1 from pg_trigger where tgname = 'trg_artifacts_batch_range_non_overlap' and not tgisinternal), 'Batch range overlap trigger exists');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002901', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002901","role":"authenticated"}', true);
set local role authenticated;

select is(
  (public.commit_batch_student_match(
    '00000000-0000-4000-8000-000000002961',
    '00000000-0000-4000-8000-000000002971',
    '00000000-0000-4000-8000-000000002951',
    '00000000-0000-4000-8000-000000002931',
    '1', 'Synthetic Student One',
    '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"long_text","response":{"raw_text":"synthetic answer"}}]}'::jsonb,
    'READY_FOR_PROCESS'
  ) ->> 'input_status'),
  'READY_FOR_PROCESS',
  'shuffled page range commits by exact visible number and name'
);
select is((select student_id from public.submissions where activity_assignment_id = '00000000-0000-4000-8000-000000002951'), '00000000-0000-4000-8000-000000002931'::uuid, 'Submission connects the exact roster Student');
select is((select input_status::text from public.submissions where activity_assignment_id = '00000000-0000-4000-8000-000000002951'), 'READY_FOR_PROCESS', 'complete observable response is ready for PROCESS');
select is((select process_status::text from public.submissions where activity_assignment_id = '00000000-0000-4000-8000-000000002951'), 'READY_TO_ANALYZE', 'PROCESS handoff status is independent and ready');
select is((select structured_input -> 'questions' -> 0 -> 'response' ->> 'raw_text' from public.submissions where activity_assignment_id = '00000000-0000-4000-8000-000000002951'), 'synthetic answer', 'observable answer persists in StructuredInput');
select ok((select owner_teacher_id is null from public.artifacts where id = '00000000-0000-4000-8000-000000002971'), 'matched page range leaves the pre-match Teacher ownership path');
select ok((select submission_id is not null from public.artifacts where id = '00000000-0000-4000-8000-000000002971'), 'matched page range attaches to the Submission');
select is((select source_artifact_id from public.artifacts where id = '00000000-0000-4000-8000-000000002971'), '00000000-0000-4000-8000-000000002961'::uuid, 'matched range preserves the Batch ORIGINAL reference');
select is((select count(distinct storage_path) from public.artifacts where id in ('00000000-0000-4000-8000-000000002961','00000000-0000-4000-8000-000000002971')), 1::bigint, 'matching does not duplicate the PDF Binary path');
select ok((select (structured_input::text !~* 'student.*name|student.*number') from public.submissions where activity_assignment_id = '00000000-0000-4000-8000-000000002951'), 'StructuredInput contains no copied identity fields');

select throws_ok(
  $$select public.commit_batch_student_match(
    '00000000-0000-4000-8000-000000002961', '00000000-0000-4000-8000-000000002972',
    '00000000-0000-4000-8000-000000002951', '00000000-0000-4000-8000-000000002932',
    '2', 'Wrong Visible Name',
    '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"blank","response":{"is_blank":true}}]}'::jsonb,
    'REVIEW_PENDING'
  )$$,
  '22023', 'Visible identity is not an exact Roster match', 'non-exact identity never silently attaches'
);
select ok((select submission_id is null from public.artifacts where id = '00000000-0000-4000-8000-000000002972'), 'rejected identity leaves the page range unassigned');
select throws_ok(
  $$select public.commit_batch_student_match(
    '00000000-0000-4000-8000-000000002961', '00000000-0000-4000-8000-000000002972',
    '00000000-0000-4000-8000-000000002951', '00000000-0000-4000-8000-000000002932',
    '2', 'Synthetic Student Two',
    '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"long_text","response":{"correct":true}}]}'::jsonb,
    'READY_FOR_PROCESS'
  )$$,
  '22023', 'Invalid observable response', 'judgment fields cannot enter StructuredInput'
);
select throws_ok(
  $$insert into public.artifacts (
    id, owner_teacher_id, source_artifact_id, storage_path, file_name, mime_type,
    file_size_bytes, checksum, artifact_role, page_start, page_end
  ) values (
    '00000000-0000-4000-8000-000000002979', '00000000-0000-4000-8000-000000002911',
    '00000000-0000-4000-8000-000000002961',
    'teachers/00000000-0000-4000-8000-000000002911/batches/00000000-0000-4000-8000-000000002961/original/00000000-0000-4000-8000-000000002961.pdf',
    'overlap.pdf', 'application/pdf', 4096, repeat('a', 64), 'DERIVED', 1, 2
  )$$,
  '23514', 'Batch PDF page ranges must not overlap', 'matched or unmatched ranges cannot be overlapped later'
);
select throws_ok(
  $$select public.commit_batch_student_match(
    '00000000-0000-4000-8000-000000002962', '00000000-0000-4000-8000-000000002972',
    '00000000-0000-4000-8000-000000002952', '00000000-0000-4000-8000-000000002933',
    '1', 'Synthetic Foreign Student',
    '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"blank","response":{"is_blank":true}}]}'::jsonb,
    'REVIEW_PENDING'
  )$$,
  '42501', 'Batch PDF is outside current Teacher scope', 'foreign Teacher Batch is rejected uniformly'
);
select is((select count(*) from public.audit_logs where entity_id = '00000000-0000-4000-8000-000000002961'), 0::bigint, 'matching adds no PII-bearing audit event');
select is((select count(*) from storage.objects where name like 'teachers/00000000-0000-4000-8000-000000002911/batches/%'), 1::bigint, 'Batch source still has one stored Binary');

reset role;
select * from finish();
rollback;
