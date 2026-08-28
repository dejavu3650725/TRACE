begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000001401', 'submission-a@example.test'),
  ('00000000-0000-4000-8000-000000001402', 'submission-b@example.test');

insert into public.teachers (id, auth_user_id, name) values
  ('00000000-0000-4000-8000-000000001411', '00000000-0000-4000-8000-000000001401', 'Synthetic Submission Teacher A'),
  ('00000000-0000-4000-8000-000000001412', '00000000-0000-4000-8000-000000001402', 'Synthetic Submission Teacher B');

insert into public.classes (id, teacher_id, name) values
  ('00000000-0000-4000-8000-000000001421', '00000000-0000-4000-8000-000000001411', 'Synthetic Submission Class A1'),
  ('00000000-0000-4000-8000-000000001422', '00000000-0000-4000-8000-000000001411', 'Synthetic Submission Class A2'),
  ('00000000-0000-4000-8000-000000001423', '00000000-0000-4000-8000-000000001412', 'Synthetic Submission Class B');

insert into public.students (id, class_id, student_number, name) values
  ('00000000-0000-4000-8000-000000001431', '00000000-0000-4000-8000-000000001421', 1, 'Synthetic Student A1'),
  ('00000000-0000-4000-8000-000000001432', '00000000-0000-4000-8000-000000001422', 1, 'Synthetic Student A2'),
  ('00000000-0000-4000-8000-000000001433', '00000000-0000-4000-8000-000000001423', 1, 'Synthetic Student B');

insert into public.activities (id, teacher_id, title, status) values
  ('00000000-0000-4000-8000-000000001441', '00000000-0000-4000-8000-000000001411', 'Synthetic Submission Activity A', 'ACTIVE'),
  ('00000000-0000-4000-8000-000000001442', '00000000-0000-4000-8000-000000001412', 'Synthetic Submission Activity B', 'ACTIVE');

insert into public.activity_assignments (id, activity_id, class_id, status) values
  ('00000000-0000-4000-8000-000000001451', '00000000-0000-4000-8000-000000001441', '00000000-0000-4000-8000-000000001421', 'OPEN'),
  ('00000000-0000-4000-8000-000000001452', '00000000-0000-4000-8000-000000001442', '00000000-0000-4000-8000-000000001423', 'OPEN');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001401', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001401","role":"authenticated"}', true);
set local role authenticated;

select ok(
  public.get_or_create_submission(
    '00000000-0000-4000-8000-000000001431',
    '00000000-0000-4000-8000-000000001451'
  ) is not null,
  'owned Student and Assignment create a Submission'
);

select is(
  public.get_or_create_submission(
    '00000000-0000-4000-8000-000000001431',
    '00000000-0000-4000-8000-000000001451'
  ),
  (select id from public.submissions where student_id = '00000000-0000-4000-8000-000000001431'),
  'duplicate request returns the existing Submission ID'
);

select is(
  (select count(*) from public.submissions where student_id = '00000000-0000-4000-8000-000000001431' and activity_assignment_id = '00000000-0000-4000-8000-000000001451'),
  1::bigint,
  'Student and ActivityAssignment have exactly one logical Submission'
);
select is((select input_status::text from public.submissions where student_id = '00000000-0000-4000-8000-000000001431'), 'UPLOADING', 'new Submission starts in INPUT-owned UPLOADING');
select is((select process_status::text from public.submissions where student_id = '00000000-0000-4000-8000-000000001431'), 'NOT_STARTED', 'new Submission starts in PROCESS-owned NOT_STARTED');
select is((select current_attempt_no from public.submissions where student_id = '00000000-0000-4000-8000-000000001431'), 1::smallint, 'new Submission starts at attempt 1');
select is((select structured_input from public.submissions where student_id = '00000000-0000-4000-8000-000000001431'), null::jsonb, 'StructuredInput remains nullable JSONB at foundation creation');

update public.submissions
set input_status = 'STORED', process_status = 'READY_TO_ANALYZE', current_attempt_no = 2,
    structured_input = '{"schema_version":"1","questions":[]}'::jsonb
where student_id = '00000000-0000-4000-8000-000000001431';

select lives_ok(
  $$select public.get_or_create_submission(
    '00000000-0000-4000-8000-000000001431',
    '00000000-0000-4000-8000-000000001451'
  )$$,
  'existing Submission can be retrieved after state changes'
);
select is((select input_status::text from public.submissions where student_id = '00000000-0000-4000-8000-000000001431'), 'STORED', 'idempotent retrieval does not reset input_status');
select is((select process_status::text from public.submissions where student_id = '00000000-0000-4000-8000-000000001431'), 'READY_TO_ANALYZE', 'idempotent retrieval does not reset process_status');
select is((select current_attempt_no from public.submissions where student_id = '00000000-0000-4000-8000-000000001431'), 2::smallint, 'idempotent retrieval does not reset current_attempt_no');
select is((select jsonb_typeof(structured_input) from public.submissions where student_id = '00000000-0000-4000-8000-000000001431'), 'object', 'StructuredInput persists as JSONB');

-- ISSUE-15+ blocks authenticated clients from inserting ORIGINAL rows directly;
-- use the privileged fixture phase only to verify the ISSUE-14 one-to-many relation.
reset role;
insert into public.artifacts (submission_id, storage_path, file_name, mime_type, artifact_role, attempt_no) values
  ((select id from public.submissions where student_id = '00000000-0000-4000-8000-000000001431'), 'synthetic/submission/page-1.png', 'page-1.png', 'image/png', 'ORIGINAL', 2),
  ((select id from public.submissions where student_id = '00000000-0000-4000-8000-000000001431'), 'synthetic/submission/page-2.png', 'page-2.png', 'image/png', 'ORIGINAL', 2);
set local role authenticated;
select is((select count(*) from public.artifacts where submission_id = (select id from public.submissions where student_id = '00000000-0000-4000-8000-000000001431')), 2::bigint, 'one Submission can own multiple Artifacts');

select throws_ok(
  $$select public.get_or_create_submission('00000000-0000-4000-8000-000000001432', '00000000-0000-4000-8000-000000001451')$$,
  '42501', 'Student is outside ActivityAssignment Class', 'same-Teacher Student from another Class is rejected'
);
select throws_ok(
  $$select public.get_or_create_submission('00000000-0000-4000-8000-000000001433', '00000000-0000-4000-8000-000000001452')$$,
  '42501', 'ActivityAssignment is outside current Teacher scope', 'foreign Assignment is rejected'
);

reset role;
select * from finish();
rollback;
