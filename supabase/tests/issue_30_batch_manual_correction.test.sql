begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000003001', 'batch-correction-a@example.test'),
  ('00000000-0000-4000-8000-000000003002', 'batch-correction-b@example.test');
insert into public.teachers (id, auth_user_id, name) values
  ('00000000-0000-4000-8000-000000003011', '00000000-0000-4000-8000-000000003001', 'Synthetic Correction Teacher A'),
  ('00000000-0000-4000-8000-000000003012', '00000000-0000-4000-8000-000000003002', 'Synthetic Correction Teacher B');
insert into public.classes (id, teacher_id, name) values
  ('00000000-0000-4000-8000-000000003021', '00000000-0000-4000-8000-000000003011', 'Synthetic Correction Class A'),
  ('00000000-0000-4000-8000-000000003022', '00000000-0000-4000-8000-000000003012', 'Synthetic Correction Class B');
insert into public.students (id, class_id, student_number, name) values
  ('00000000-0000-4000-8000-000000003031', '00000000-0000-4000-8000-000000003021', 7, 'Synthetic Corrected Student'),
  ('00000000-0000-4000-8000-000000003032', '00000000-0000-4000-8000-000000003022', 8, 'Synthetic Foreign Student');
insert into public.activities (id, teacher_id, title, status) values
  ('00000000-0000-4000-8000-000000003041', '00000000-0000-4000-8000-000000003011', 'Synthetic Correction Activity', 'ACTIVE');
insert into public.activity_assignments (id, activity_id, class_id, status) values
  ('00000000-0000-4000-8000-000000003051', '00000000-0000-4000-8000-000000003041', '00000000-0000-4000-8000-000000003021', 'OPEN');
insert into storage.objects (bucket_id, name) values
  ('trace', 'teachers/00000000-0000-4000-8000-000000003011/batches/00000000-0000-4000-8000-000000003061/original/00000000-0000-4000-8000-000000003061.pdf');
insert into public.artifacts (
  id, owner_teacher_id, storage_path, file_name, mime_type, file_size_bytes,
  checksum, artifact_role, page_start, page_end
) values
  ('00000000-0000-4000-8000-000000003061', '00000000-0000-4000-8000-000000003011', 'teachers/00000000-0000-4000-8000-000000003011/batches/00000000-0000-4000-8000-000000003061/original/00000000-0000-4000-8000-000000003061.pdf', 'synthetic-correction.pdf', 'application/pdf', 4096, repeat('c', 64), 'ORIGINAL', 1, 2),
  ('00000000-0000-4000-8000-000000003071', '00000000-0000-4000-8000-000000003011', 'teachers/00000000-0000-4000-8000-000000003011/batches/00000000-0000-4000-8000-000000003061/original/00000000-0000-4000-8000-000000003061.pdf', 'synthetic-correction.pdf', 'application/pdf', 4096, repeat('c', 64), 'DERIVED', 1, 2);
update public.artifacts
set source_artifact_id = '00000000-0000-4000-8000-000000003061'
where id = '00000000-0000-4000-8000-000000003071';

select has_function('public', 'commit_batch_teacher_correction', array['uuid','uuid','uuid','uuid','jsonb','input_status'], 'teacher correction RPC exists');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000003001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.commit_batch_teacher_correction(
    '00000000-0000-4000-8000-000000003061',
    '00000000-0000-4000-8000-000000003071',
    '00000000-0000-4000-8000-000000003051',
    '00000000-0000-4000-8000-000000003031',
    '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"long_text","response":{"raw_text":"teacher confirmed answer"}}]}'::jsonb,
    'READY_FOR_PROCESS'
  )$$,
  'teacher can confirm an uncertain two-page group'
);
select is((select page_start from public.artifacts where id = '00000000-0000-4000-8000-000000003071'), 1, 'confirmed group keeps its first page');
select is((select page_end from public.artifacts where id = '00000000-0000-4000-8000-000000003071'), 2, 'confirmed group keeps its last page');
select is((select student_id from public.submissions where activity_assignment_id = '00000000-0000-4000-8000-000000003051'), '00000000-0000-4000-8000-000000003031'::uuid, 'teacher correction persists the selected roster Student');

select throws_ok(
  $$select public.commit_batch_teacher_correction(
    '00000000-0000-4000-8000-000000003061',
    '00000000-0000-4000-8000-000000003071',
    '00000000-0000-4000-8000-000000003051',
    '00000000-0000-4000-8000-000000003032',
    '{"schema_version":"1","questions":[{"question_id":"Q1","response_type":"blank","response":{"is_blank":true}}]}'::jsonb,
    'REVIEW_PENDING'
  )$$,
  '42501', 'Student is outside ActivityAssignment Class', 'foreign Class Student cannot be selected'
);

reset role;
select * from finish();
rollback;
