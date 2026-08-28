begin;

create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000002801', 'batch-a@example.test'),
  ('00000000-0000-4000-8000-000000002802', 'batch-b@example.test');
insert into public.teachers (id, auth_user_id, name) values
  ('00000000-0000-4000-8000-000000002811', '00000000-0000-4000-8000-000000002801', 'Synthetic Batch Teacher A'),
  ('00000000-0000-4000-8000-000000002812', '00000000-0000-4000-8000-000000002802', 'Synthetic Batch Teacher B');

insert into storage.objects (bucket_id, name) values
  ('trace', 'teachers/00000000-0000-4000-8000-000000002811/batches/00000000-0000-4000-8000-000000002821/original/00000000-0000-4000-8000-000000002821.pdf'),
  ('trace', 'teachers/00000000-0000-4000-8000-000000002812/batches/00000000-0000-4000-8000-000000002822/original/00000000-0000-4000-8000-000000002822.pdf');

insert into public.artifacts (
  id, owner_teacher_id, storage_path, file_name, mime_type, file_size_bytes,
  checksum, artifact_role, page_start, page_end
) values (
  '00000000-0000-4000-8000-000000002822',
  '00000000-0000-4000-8000-000000002812',
  'teachers/00000000-0000-4000-8000-000000002812/batches/00000000-0000-4000-8000-000000002822/original/00000000-0000-4000-8000-000000002822.pdf',
  'synthetic-foreign-batch.pdf', 'application/pdf', 4096, repeat('b', 64),
  'ORIGINAL', 1, 8
);

select has_column('public', 'artifacts', 'owner_teacher_id', 'Artifact has the approved pre-matching Teacher owner');
select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.artifacts'::regclass and conname = 'artifacts_exactly_one_owner'),
  'Artifact ownership-path constraint exists'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'artifacts' and policyname = 'artifacts_owned_select' and cmd = 'SELECT'),
  1::bigint,
  'Artifact RLS has one explicit owned read policy'
);
select throws_ok(
  $$insert into public.artifacts (
      id, storage_path, file_name, mime_type, artifact_role
    ) values (
      '00000000-0000-4000-8000-000000002899', 'synthetic/ownerless',
      'ownerless.pdf', 'application/pdf', 'DERIVED'
    )$$,
  '23514',
  'new row for relation "artifacts" violates check constraint "artifacts_exactly_one_owner"',
  'new Artifact cannot be created without either ownership path'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002801', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002801","role":"authenticated"}', true);
set local role authenticated;

select is(
  public.record_teacher_batch_pdf(
    '00000000-0000-4000-8000-000000002821',
    'teachers/00000000-0000-4000-8000-000000002811/batches/00000000-0000-4000-8000-000000002821/original/00000000-0000-4000-8000-000000002821.pdf',
    'synthetic-batch-12-pages.pdf', 8192::bigint, repeat('a', 64), 12
  ),
  '00000000-0000-4000-8000-000000002821'::uuid,
  'owned private Batch object records one ORIGINAL Artifact'
);
select is((select owner_teacher_id from public.artifacts where id = '00000000-0000-4000-8000-000000002821'), '00000000-0000-4000-8000-000000002811'::uuid, 'Batch ORIGINAL is owned by the JWT Teacher');
select ok((select submission_id is null from public.artifacts where id = '00000000-0000-4000-8000-000000002821'), 'pre-matching Batch ORIGINAL has no Submission');
select is((select artifact_role::text from public.artifacts where id = '00000000-0000-4000-8000-000000002821'), 'ORIGINAL', 'Batch source role is ORIGINAL');
select is((select page_start from public.artifacts where id = '00000000-0000-4000-8000-000000002821'), 1, 'Batch ORIGINAL starts at page 1');
select is((select page_end from public.artifacts where id = '00000000-0000-4000-8000-000000002821'), 12, 'Batch ORIGINAL records the calculated page count');
select is(
  (select storage_path from public.artifacts where id = '00000000-0000-4000-8000-000000002821'),
  'teachers/00000000-0000-4000-8000-000000002811/batches/00000000-0000-4000-8000-000000002821/original/00000000-0000-4000-8000-000000002821.pdf',
  'Batch object key contains scoped UUIDs and no original file name'
);
select is((select count(*) from public.audit_logs where action = 'ARTIFACT_UPLOAD' and entity_id = '00000000-0000-4000-8000-000000002821'), 1::bigint, 'Batch upload produces one ARTIFACT_UPLOAD audit event');
select ok((select metadata_json is null from public.audit_logs where action = 'ARTIFACT_UPLOAD' and entity_id = '00000000-0000-4000-8000-000000002821'), 'Batch audit contains no file name or Student PII');
select is((select count(*) from storage.objects where name like 'teachers/00000000-0000-4000-8000-000000002811/batches/%'), 1::bigint, 'one Batch source has exactly one stored Binary');

select is(
  jsonb_array_length(public.replace_teacher_batch_page_ranges(
    '00000000-0000-4000-8000-000000002821',
    '[{"page_start":1,"page_end":2},{"page_start":3,"page_end":3},{"page_start":4,"page_end":6}]'::jsonb
  )),
  3,
  'three logical page ranges are saved'
);
select is((select count(*) from public.artifacts where source_artifact_id = '00000000-0000-4000-8000-000000002821'), 3::bigint, 'three range Artifact rows can be revisited');
select is((select count(distinct storage_path) from public.artifacts where source_artifact_id = '00000000-0000-4000-8000-000000002821'), 1::bigint, 'all ranges reference one Storage object');
select is((select count(*) from public.artifacts where source_artifact_id = '00000000-0000-4000-8000-000000002821' and artifact_role = 'DERIVED'), 3::bigint, 'page ranges are logical DERIVED references');
select is(
  (select string_agg(page_start::text || '-' || page_end::text, ',' order by page_start) from public.artifacts where source_artifact_id = '00000000-0000-4000-8000-000000002821'),
  '1-2,3-3,4-6',
  'saved ranges preserve their exact page boundaries'
);
select lives_ok(
  $$select public.replace_teacher_batch_page_ranges(
    '00000000-0000-4000-8000-000000002821',
    '[{"page_start":1,"page_end":5},{"page_start":7,"page_end":12}]'::jsonb
  )$$,
  'saved ranges can be replaced during later inspection'
);
select is((select count(*) from public.artifacts where source_artifact_id = '00000000-0000-4000-8000-000000002821'), 2::bigint, 'reinspection replaces stale range references');
select throws_ok(
  $$select public.replace_teacher_batch_page_ranges(
    '00000000-0000-4000-8000-000000002821',
    '[{"page_start":1,"page_end":5},{"page_start":5,"page_end":7}]'::jsonb
  )$$,
  '22023', 'Batch PDF ranges must not overlap', 'overlapping ranges are rejected'
);
select throws_ok(
  $$select public.replace_teacher_batch_page_ranges(
    '00000000-0000-4000-8000-000000002821',
    '[{"page_start":12,"page_end":13}]'::jsonb
  )$$,
  '22023', 'Batch PDF range is outside the source page count', 'out-of-source range is rejected'
);
select throws_ok(
  $$select public.replace_teacher_batch_page_ranges(
    '00000000-0000-4000-8000-000000002822',
    '[{"page_start":1,"page_end":2}]'::jsonb
  )$$,
  '42501', 'Batch PDF is outside current Teacher scope', 'foreign Teacher Batch cannot be inspected'
);
select is((select count(*) from public.artifacts where owner_teacher_id = '00000000-0000-4000-8000-000000002812'), 0::bigint, 'foreign Teacher Batch and ranges are hidden by RLS');
select lives_ok(
  $$update public.artifacts set page_end = 1 where id = '00000000-0000-4000-8000-000000002821'$$,
  'direct Batch ORIGINAL update is rejected without revealing row details'
);
select is((select page_end from public.artifacts where id = '00000000-0000-4000-8000-000000002821'), 12, 'Batch ORIGINAL page count remains immutable');

reset role;
select * from finish();
rollback;
