begin;

create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000001501', 'artifact-a@example.test'),
  ('00000000-0000-4000-8000-000000001502', 'artifact-b@example.test');

insert into public.teachers (id, auth_user_id, name) values
  ('00000000-0000-4000-8000-000000001511', '00000000-0000-4000-8000-000000001501', 'Synthetic Artifact Teacher A'),
  ('00000000-0000-4000-8000-000000001512', '00000000-0000-4000-8000-000000001502', 'Synthetic Artifact Teacher B');

insert into public.classes (id, teacher_id, name) values
  ('00000000-0000-4000-8000-000000001521', '00000000-0000-4000-8000-000000001511', 'Synthetic Artifact Class A'),
  ('00000000-0000-4000-8000-000000001522', '00000000-0000-4000-8000-000000001512', 'Synthetic Artifact Class B');

insert into public.students (id, class_id, student_number, name) values
  ('00000000-0000-4000-8000-000000001531', '00000000-0000-4000-8000-000000001521', 1, 'Synthetic Artifact Student A'),
  ('00000000-0000-4000-8000-000000001532', '00000000-0000-4000-8000-000000001522', 1, 'Synthetic Artifact Student B');

insert into public.activities (id, teacher_id, title, status) values
  ('00000000-0000-4000-8000-000000001541', '00000000-0000-4000-8000-000000001511', 'Synthetic Artifact Activity A', 'ACTIVE'),
  ('00000000-0000-4000-8000-000000001542', '00000000-0000-4000-8000-000000001512', 'Synthetic Artifact Activity B', 'ACTIVE');

insert into public.activity_assignments (id, activity_id, class_id, status) values
  ('00000000-0000-4000-8000-000000001551', '00000000-0000-4000-8000-000000001541', '00000000-0000-4000-8000-000000001521', 'OPEN'),
  ('00000000-0000-4000-8000-000000001552', '00000000-0000-4000-8000-000000001542', '00000000-0000-4000-8000-000000001522', 'OPEN');

insert into public.submissions (id, student_id, activity_assignment_id, input_status, process_status) values
  ('00000000-0000-4000-8000-000000001561', '00000000-0000-4000-8000-000000001531', '00000000-0000-4000-8000-000000001551', 'UPLOADING', 'NOT_STARTED'),
  ('00000000-0000-4000-8000-000000001562', '00000000-0000-4000-8000-000000001532', '00000000-0000-4000-8000-000000001552', 'UPLOADING', 'NOT_STARTED');

insert into storage.objects (bucket_id, name) values
  ('trace', 'teachers/00000000-0000-4000-8000-000000001511/submissions/00000000-0000-4000-8000-000000001561/original/00000000-0000-4000-8000-000000001571.pdf'),
  ('trace', 'teachers/00000000-0000-4000-8000-000000001512/submissions/00000000-0000-4000-8000-000000001562/original/00000000-0000-4000-8000-000000001572.pdf');

select is((select public from storage.buckets where id = 'trace'), false, 'TRACE Storage bucket remains private');
select is(
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('trace_storage_select', 'trace_storage_insert', 'trace_storage_delete')),
  3::bigint,
  'Storage has split select, insert and guarded delete policies'
);
select is(
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'trace_storage%' and cmd in ('ALL', 'UPDATE')),
  0::bigint,
  'Storage has no ALL or UPDATE policy that could overwrite an ORIGINAL object'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'artifacts' and permissive = 'RESTRICTIVE' and policyname like 'artifacts_original_%_guard'),
  3::bigint,
  'restrictive Artifact policies guard ORIGINAL insert, update and delete'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001501', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000001501","role":"authenticated"}', true);
set local role authenticated;

select is(
  public.record_teacher_artifact_upload(
    '00000000-0000-4000-8000-000000001561',
    '00000000-0000-4000-8000-000000001571',
    'teachers/00000000-0000-4000-8000-000000001511/submissions/00000000-0000-4000-8000-000000001561/original/00000000-0000-4000-8000-000000001571.pdf',
    'synthetic-response.pdf', 'application/pdf', 2048::bigint,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 1::smallint
  ),
  '00000000-0000-4000-8000-000000001571'::uuid,
  'owned private Storage object records an Artifact'
);
select is((select artifact_role::text from public.artifacts where id = '00000000-0000-4000-8000-000000001571'), 'ORIGINAL', 'Artifact role is ORIGINAL');
select is((select submission_id from public.artifacts where id = '00000000-0000-4000-8000-000000001571'), '00000000-0000-4000-8000-000000001561'::uuid, 'Artifact remains related to its Submission');
select is((select storage_path from public.artifacts where id = '00000000-0000-4000-8000-000000001571'), 'teachers/00000000-0000-4000-8000-000000001511/submissions/00000000-0000-4000-8000-000000001561/original/00000000-0000-4000-8000-000000001571.pdf', 'Storage key uses only scoped UUIDs');
select is((select file_name from public.artifacts where id = '00000000-0000-4000-8000-000000001571'), 'synthetic-response.pdf', 'display file name is stored only as Artifact metadata');
select is((select checksum from public.artifacts where id = '00000000-0000-4000-8000-000000001571'), repeat('a', 64), 'SHA-256 checksum is persisted');
select is((select input_status::text from public.submissions where id = '00000000-0000-4000-8000-000000001561'), 'STORED', 'successful original storage advances only input_status to STORED');
select is((select process_status::text from public.submissions where id = '00000000-0000-4000-8000-000000001561'), 'NOT_STARTED', 'upload does not start PROCESS');
select is((select count(*) from public.audit_logs where action = 'ARTIFACT_UPLOAD' and entity_id = '00000000-0000-4000-8000-000000001571'), 1::bigint, 'one minimal ARTIFACT_UPLOAD audit event is persisted');
select ok((select metadata_json is null from public.audit_logs where action = 'ARTIFACT_UPLOAD' and entity_id = '00000000-0000-4000-8000-000000001571'), 'upload audit metadata contains no file name or Student PII');
select is((select actor_teacher_id from public.audit_logs where action = 'ARTIFACT_UPLOAD' and entity_id = '00000000-0000-4000-8000-000000001571'), '00000000-0000-4000-8000-000000001511'::uuid, 'audit actor is derived from the JWT Teacher');

select lives_ok(
  $$update public.artifacts set file_name = 'changed.pdf' where id = '00000000-0000-4000-8000-000000001571'$$,
  'direct ORIGINAL update is rejected without revealing row details'
);
select is(
  (select file_name from public.artifacts where id = '00000000-0000-4000-8000-000000001571'),
  'synthetic-response.pdf',
  'recorded ORIGINAL Artifact metadata stays immutable'
);
select lives_ok(
  $$delete from public.artifacts where id = '00000000-0000-4000-8000-000000001571'$$,
  'direct ORIGINAL Artifact delete is rejected without revealing row details'
);
select is(
  (select count(*) from public.artifacts where id = '00000000-0000-4000-8000-000000001571'),
  1::bigint,
  'recorded ORIGINAL Artifact row survives a direct delete attempt'
);
select ok(
  (select qual like '%NOT (EXISTS%' and qual like '%artifact.storage_path = objects.name%'
   from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname = 'trace_storage_delete'),
  'Storage delete policy excludes paths already recorded as ORIGINAL'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'trace' and name = 'teachers/00000000-0000-4000-8000-000000001511/submissions/00000000-0000-4000-8000-000000001561/original/00000000-0000-4000-8000-000000001571.pdf'),
  1::bigint,
  'recorded ORIGINAL object survives a direct authenticated delete attempt'
);
select is(
  (select count(*) from storage.objects where name like 'teachers/00000000-0000-4000-8000-000000001512/%'),
  0::bigint,
  'foreign Teacher Storage objects are hidden by RLS'
);
select is(
  (select count(*) from storage.objects where name like 'teachers/00000000-0000-4000-8000-000000001511/%'),
  1::bigint,
  'current Teacher Storage object remains readable in the private bucket'
);

select throws_ok(
  $$select public.record_teacher_artifact_upload(
    '00000000-0000-4000-8000-000000001561', '00000000-0000-4000-8000-000000001573',
    'teachers/00000000-0000-4000-8000-000000001511/submissions/00000000-0000-4000-8000-000000001561/original/00000000-0000-4000-8000-000000001573.pdf',
    'missing.pdf', 'application/pdf', 1024::bigint, repeat('b', 64), 1::smallint)$$,
  '22023', 'Private Storage object is required before Artifact record', 'Artifact row requires a pre-existing private object'
);
select throws_ok(
  $$select public.record_teacher_artifact_upload(
    '00000000-0000-4000-8000-000000001561', '00000000-0000-4000-8000-000000001574',
    'teachers/00000000-0000-4000-8000-000000001511/submissions/00000000-0000-4000-8000-000000001561/original/00000000-0000-4000-8000-000000001571.pdf',
    'mismatch.pdf', 'application/pdf', 1024::bigint, repeat('b', 64), 1::smallint)$$,
  '22023', 'Artifact UUID must match storage object key', 'Artifact UUID must equal the UUID object key'
);
select throws_ok(
  $$select public.record_teacher_artifact_upload(
    '00000000-0000-4000-8000-000000001561', '00000000-0000-4000-8000-000000001575',
    'irrelevant', 'attempt.pdf', 'application/pdf', 1024::bigint, repeat('b', 64), 2::smallint)$$,
  '22023', 'Artifact attempt does not match current Submission attempt', 'Artifact attempt must match the Submission attempt'
);
select throws_ok(
  $$select public.record_teacher_artifact_upload(
    '00000000-0000-4000-8000-000000001561', '00000000-0000-4000-8000-000000001576',
    'teachers/00000000-0000-4000-8000-000000001511/submissions/00000000-0000-4000-8000-000000001561/original/00000000-0000-4000-8000-000000001576.txt',
    'unsupported.txt', 'text/plain', 1024::bigint, repeat('b', 64), 1::smallint)$$,
  '22023', 'Unsupported Artifact MIME type', 'server rejects unsupported MIME types'
);
select throws_ok(
  $$select public.record_teacher_artifact_upload(
    '00000000-0000-4000-8000-000000001561', '00000000-0000-4000-8000-000000001577',
    'teachers/00000000-0000-4000-8000-000000001511/submissions/00000000-0000-4000-8000-000000001561/original/00000000-0000-4000-8000-000000001577.pdf',
    'large.pdf', 'application/pdf', 31457281::bigint, repeat('b', 64), 1::smallint)$$,
  '22023', 'Artifact file size is outside the allowed limit', 'server enforces the PDF size limit'
);
select throws_ok(
  $$select public.record_teacher_artifact_upload(
    '00000000-0000-4000-8000-000000001562', '00000000-0000-4000-8000-000000001572',
    'teachers/00000000-0000-4000-8000-000000001512/submissions/00000000-0000-4000-8000-000000001562/original/00000000-0000-4000-8000-000000001572.pdf',
    'foreign.pdf', 'application/pdf', 1024::bigint, repeat('b', 64), 1::smallint)$$,
  '42501', 'Submission is outside current Teacher scope', 'foreign Teacher Submission cannot receive an Artifact'
);

reset role;
select * from finish();
rollback;
