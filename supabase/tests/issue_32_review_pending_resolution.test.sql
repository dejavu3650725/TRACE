begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000003201', 'review-a@example.test'),
  ('00000000-0000-4000-8000-000000003202', 'review-b@example.test');

insert into public.teachers (id, auth_user_id, name) values
  ('00000000-0000-4000-8000-000000003211', '00000000-0000-4000-8000-000000003201', 'Synthetic Review Teacher A'),
  ('00000000-0000-4000-8000-000000003212', '00000000-0000-4000-8000-000000003202', 'Synthetic Review Teacher B');

insert into public.classes (id, teacher_id, name, grade) values
  ('00000000-0000-4000-8000-000000003221', '00000000-0000-4000-8000-000000003211', 'Synthetic Review Class A', 3),
  ('00000000-0000-4000-8000-000000003222', '00000000-0000-4000-8000-000000003212', 'Synthetic Review Class B', 3);

insert into public.students (id, class_id, student_number, name) values
  ('00000000-0000-4000-8000-000000003231', '00000000-0000-4000-8000-000000003221', 1, 'Synthetic Review Student A1'),
  ('00000000-0000-4000-8000-000000003232', '00000000-0000-4000-8000-000000003221', 2, 'Synthetic Review Student A2'),
  ('00000000-0000-4000-8000-000000003233', '00000000-0000-4000-8000-000000003222', 1, 'Synthetic Review Student B');

insert into public.activities (id, teacher_id, title, status) values
  ('00000000-0000-4000-8000-000000003241', '00000000-0000-4000-8000-000000003211', 'Synthetic Review Activity A1', 'ACTIVE'),
  ('00000000-0000-4000-8000-000000003242', '00000000-0000-4000-8000-000000003211', 'Synthetic Review Activity A2', 'ACTIVE'),
  ('00000000-0000-4000-8000-000000003243', '00000000-0000-4000-8000-000000003212', 'Synthetic Review Activity B', 'ACTIVE');

insert into public.activity_assignments (id, activity_id, class_id, status) values
  ('00000000-0000-4000-8000-000000003251', '00000000-0000-4000-8000-000000003241', '00000000-0000-4000-8000-000000003221', 'OPEN'),
  ('00000000-0000-4000-8000-000000003252', '00000000-0000-4000-8000-000000003242', '00000000-0000-4000-8000-000000003221', 'OPEN'),
  ('00000000-0000-4000-8000-000000003253', '00000000-0000-4000-8000-000000003243', '00000000-0000-4000-8000-000000003222', 'OPEN');

insert into public.submissions (id, student_id, activity_assignment_id, structured_input, input_status, process_status) values
  ('00000000-0000-4000-8000-000000003261', '00000000-0000-4000-8000-000000003231', '00000000-0000-4000-8000-000000003251', '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"unknown","response":{"raw_text":"uncertain"}}]}', 'REVIEW_PENDING', 'NOT_STARTED'),
  ('00000000-0000-4000-8000-000000003262', '00000000-0000-4000-8000-000000003231', '00000000-0000-4000-8000-000000003252', '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"short_text","response":{"raw_text":"ready"}}]}', 'READY_FOR_PROCESS', 'READY_TO_ANALYZE'),
  ('00000000-0000-4000-8000-000000003263', '00000000-0000-4000-8000-000000003232', '00000000-0000-4000-8000-000000003251', null, 'REVIEW_PENDING', 'NOT_STARTED');

insert into public.artifacts (
  id, submission_id, owner_teacher_id, source_artifact_id, storage_path,
  file_name, mime_type, artifact_role, page_start, page_end
) values
  ('00000000-0000-4000-8000-000000003271', null, '00000000-0000-4000-8000-000000003211', null, 'synthetic/review/source.pdf', 'source.pdf', 'application/pdf', 'ORIGINAL', 1, 2),
  ('00000000-0000-4000-8000-000000003272', '00000000-0000-4000-8000-000000003261', null, '00000000-0000-4000-8000-000000003271', 'synthetic/review/source.pdf', 'student-page.pdf', 'application/pdf', 'DERIVED', 1, 1);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000003201', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003201","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.resolve_submission_input_review(
    '00000000-0000-4000-8000-000000003261',
    '00000000-0000-4000-8000-000000003232',
    '00000000-0000-4000-8000-000000003252',
    '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"long_text","response":{"raw_text":"teacher confirmed observation"}}]}'::jsonb
  )$$,
  'Teacher resolves Student, ActivityAssignment, and StructuredInput atomically'
);
select is((select student_id from public.submissions where id = '00000000-0000-4000-8000-000000003261'), '00000000-0000-4000-8000-000000003232'::uuid, 'confirmed Student is stored');
select is((select activity_assignment_id from public.submissions where id = '00000000-0000-4000-8000-000000003261'), '00000000-0000-4000-8000-000000003252'::uuid, 'confirmed ActivityAssignment is stored');
select is((select input_status::text from public.submissions where id = '00000000-0000-4000-8000-000000003261'), 'READY_FOR_PROCESS', 'all INPUT requirements move Submission to READY_FOR_PROCESS');
select is((select process_status::text from public.submissions where id = '00000000-0000-4000-8000-000000003261'), 'READY_TO_ANALYZE', 'PROCESS status becomes ready without starting analysis');
select is((select structured_input #>> '{questions,0,response,raw_text}' from public.submissions where id = '00000000-0000-4000-8000-000000003261'), 'teacher confirmed observation', 'confirmed observable response is stored');
select is((select submission_id from public.artifacts where id = '00000000-0000-4000-8000-000000003272'), '00000000-0000-4000-8000-000000003261'::uuid, 'page-range Artifact remains attached');
select is((select owner_teacher_id from public.artifacts where id = '00000000-0000-4000-8000-000000003271'), '00000000-0000-4000-8000-000000003211'::uuid, 'Batch ORIGINAL remains Teacher-owned and preserved');

select throws_ok(
  $$select public.resolve_submission_input_review('00000000-0000-4000-8000-000000003262', '00000000-0000-4000-8000-000000003231', '00000000-0000-4000-8000-000000003252', '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"short_text","response":{"raw_text":"x"}}]}'::jsonb)$$,
  '22023', 'Submission is not awaiting INPUT review', 'successful Submission cannot receive redundant INPUT approval'
);
select throws_ok(
  $$select public.resolve_submission_input_review('00000000-0000-4000-8000-000000003263', '00000000-0000-4000-8000-000000003232', '00000000-0000-4000-8000-000000003251', '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"short_text","response":{"raw_text":"x"}}]}'::jsonb)$$,
  '22023', 'Stored ORIGINAL Artifact is required', 'READY is blocked when no stored ORIGINAL reference exists'
);
select throws_ok(
  $$select public.resolve_submission_input_review('00000000-0000-4000-8000-000000003263', '00000000-0000-4000-8000-000000003233', '00000000-0000-4000-8000-000000003253', '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"short_text","response":{"raw_text":"x"}}]}'::jsonb)$$,
  '42501', 'Student and ActivityAssignment are outside current Teacher Class scope', 'foreign Student and Assignment are rejected'
);
select throws_ok(
  $$select public.resolve_submission_input_review('00000000-0000-4000-8000-000000003263', '00000000-0000-4000-8000-000000003232', '00000000-0000-4000-8000-000000003251', '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"short_text","response":{"score":3}}]}'::jsonb)$$,
  '22023', 'Invalid observable response', 'judgment fields are rejected from StructuredInput'
);

reset role;
select * from finish();
rollback;
