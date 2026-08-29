begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000002601', 'material-a@example.test'),
  ('00000000-0000-4000-8000-000000002602', 'material-b@example.test');
insert into public.teachers (id, auth_user_id, name) values
  ('00000000-0000-4000-8000-000000002611', '00000000-0000-4000-8000-000000002601', 'Synthetic Material Teacher A'),
  ('00000000-0000-4000-8000-000000002612', '00000000-0000-4000-8000-000000002602', 'Synthetic Material Teacher B');
insert into public.classes (id, teacher_id, name, grade) values
  ('00000000-0000-4000-8000-000000002621', '00000000-0000-4000-8000-000000002611', 'Synthetic Material Class A', 3),
  ('00000000-0000-4000-8000-000000002622', '00000000-0000-4000-8000-000000002612', 'Synthetic Material Class B', 3);
insert into public.activities (id, teacher_id, title, grade, subject, status, activity_code) values
  ('00000000-0000-4000-8000-000000002631', '00000000-0000-4000-8000-000000002611', 'Existing Fraction Activity', 3, '수학', 'ACTIVE', 'MATH-03-01-11-900');
insert into storage.objects (bucket_id, name) values
  ('trace', 'teachers/00000000-0000-4000-8000-000000002611/batches/00000000-0000-4000-8000-000000002641/original/00000000-0000-4000-8000-000000002641.pdf');
insert into public.artifacts (
  id, owner_teacher_id, storage_path, file_name, mime_type, file_size_bytes,
  checksum, artifact_role, page_start, page_end
) values (
  '00000000-0000-4000-8000-000000002641', '00000000-0000-4000-8000-000000002611',
  'teachers/00000000-0000-4000-8000-000000002611/batches/00000000-0000-4000-8000-000000002641/original/00000000-0000-4000-8000-000000002641.pdf',
  'synthetic-material.pdf', 'application/pdf', 4096, repeat('d', 64), 'ORIGINAL', 1, 2
);

select has_function(
  'public', 'confirm_batch_activity_assignment',
  array['uuid','uuid','uuid','text','smallint','text','text','text','text','text','text[]','jsonb','text'],
  'Batch Activity confirmation RPC exists'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002601', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002601","role":"authenticated"}', true);
set local role authenticated;

select is(
  (public.confirm_batch_activity_assignment(
    '00000000-0000-4000-8000-000000002641', '00000000-0000-4000-8000-000000002621',
    '00000000-0000-4000-8000-000000002631', null, null, null, null, null, null, null, array[]::text[], null, null
  ) ->> 'created_activity')::boolean,
  false,
  'teacher can connect an existing ACTIVE Activity'
);
select is((select count(*) from public.activity_assignments where activity_id = '00000000-0000-4000-8000-000000002631'), 1::bigint, 'existing Activity is assigned to the selected Class');

create temporary table created_batch_activity as
select public.confirm_batch_activity_assignment(
  '00000000-0000-4000-8000-000000002641', '00000000-0000-4000-8000-000000002621',
  null::uuid, 'Scanned Fraction Activity', 3::smallint, '수학', '수와 연산', '분수', '활동지', 'Synthetic description',
  array['4수01-11'],
  '{"schema_version":"1","source":"AI_DRAFT","instructions":"Solve the printed questions","questions":[{"question_id":"Q1","prompt":"Compare fractions","question_type":"SHORT_TEXT","options":[]}],"print_layout_data":{"paper_size":"A4","orientation":"PORTRAIT","estimated_pages":2}}'::jsonb,
  'MATH-03-01-11'
) as result;

select ok((select (result ->> 'created_activity')::boolean from created_batch_activity), 'teacher confirmation creates a new Activity');
select is((select status::text from public.activities where title = 'Scanned Fraction Activity'), 'ACTIVE', 'confirmed scanned Activity is activated');
select is((select count(*) from public.activity_standards where activity_id = (select id from public.activities where title = 'Scanned Fraction Activity')), 1::bigint, 'confirmed Curriculum Standard persists');
select is((select count(*) from public.activity_assignments where activity_id = (select id from public.activities where title = 'Scanned Fraction Activity')), 1::bigint, 'new Activity is assigned atomically');

select throws_ok(
  $$select public.confirm_batch_activity_assignment(
    '00000000-0000-4000-8000-000000002641', '00000000-0000-4000-8000-000000002622',
    '00000000-0000-4000-8000-000000002631', null, null, null, null, null, null, null, array[]::text[], null, null
  )$$,
  '42501', 'Class is outside current Teacher scope', 'foreign Class is rejected'
);

reset role;
select * from finish();
rollback;
