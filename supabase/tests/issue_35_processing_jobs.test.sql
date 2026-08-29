begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000003501', 'job-a@example.test'),
  ('00000000-0000-4000-8000-000000003502', 'job-b@example.test');

insert into public.teachers (id, auth_user_id, name) values
  ('00000000-0000-4000-8000-000000003511', '00000000-0000-4000-8000-000000003501', 'Synthetic Job Teacher A'),
  ('00000000-0000-4000-8000-000000003512', '00000000-0000-4000-8000-000000003502', 'Synthetic Job Teacher B');

insert into public.processing_jobs (
  id, teacher_id, job_type, status, total_count, current_step, payload_json
) values (
  '00000000-0000-4000-8000-000000003521',
  '00000000-0000-4000-8000-000000003512',
  'ANALYSIS', 'QUEUED', 1, 'foreign queued',
  '{"submission_ids":["00000000-0000-4000-8000-000000003599"]}'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000003501', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003501","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$insert into public.processing_jobs (
    id, teacher_id, job_type, status, total_count, completed_count,
    failed_count, current_step, payload_json
  ) values (
    '00000000-0000-4000-8000-000000003522',
    '00000000-0000-4000-8000-000000003511',
    'ANALYSIS', 'QUEUED', 2, 0, 0, '분석 대기 중',
    '{"submission_ids":["00000000-0000-4000-8000-000000003531","00000000-0000-4000-8000-000000003532"]}'
  )$$,
  'Teacher can persist an owned QUEUED Job'
);
select is((select status::text from public.processing_jobs where id = '00000000-0000-4000-8000-000000003522'), 'QUEUED', 'reload reads the persisted initial state');
select is((select count(*)::integer from public.processing_jobs job cross join lateral jsonb_object_keys(job.payload_json) payload_key where job.id = '00000000-0000-4000-8000-000000003522'), 1, 'payload stores only required IDs');

select lives_ok(
  $$update public.processing_jobs
    set status = 'PROCESSING', current_step = '1/2 분석 중', completed_count = 1
    where id = '00000000-0000-4000-8000-000000003522'$$,
  'Job progress can be persisted while work is running'
);
select is((select completed_count from public.processing_jobs where id = '00000000-0000-4000-8000-000000003522'), 1, 'polling reads the real completed count');

select lives_ok(
  $$update public.processing_jobs
    set status = 'REVIEW_REQUIRED', current_step = '분석 1건 완료 · 교사 검토 대기',
        completed_count = 1, failed_count = 1,
        error_message = '일부 자료 분석에 실패했습니다.'
    where id = '00000000-0000-4000-8000-000000003522'$$,
  'partial success reaches a persisted final state'
);
select is((select status::text from public.processing_jobs where id = '00000000-0000-4000-8000-000000003522'), 'REVIEW_REQUIRED', 'one failed item does not fail the whole Job');
select is((select completed_count + failed_count from public.processing_jobs where id = '00000000-0000-4000-8000-000000003522'), 2, 'final counts cover the complete Batch without fake completion');
select is((select error_message from public.processing_jobs where id = '00000000-0000-4000-8000-000000003522'), '일부 자료 분석에 실패했습니다.', 'persistent error is minimal and generic');
select is((select count(*) from public.processing_jobs where id = '00000000-0000-4000-8000-000000003521'), 0::bigint, 'foreign Teacher Job is invisible through RLS');

update public.processing_jobs
set status = 'FAILED'
where id = '00000000-0000-4000-8000-000000003521';

reset role;
select is(
  (select status::text from public.processing_jobs where id = '00000000-0000-4000-8000-000000003521'),
  'QUEUED',
  'foreign Teacher Job cannot be updated'
);
select * from finish();
rollback;
