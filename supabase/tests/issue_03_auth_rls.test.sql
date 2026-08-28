begin;

create extension if not exists pgtap with schema extensions;
select plan(32);

-- Synthetic Auth users and owned resource graphs for Teacher A/B.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000301', 'teacher-a@example.test'),
  ('00000000-0000-4000-8000-000000000302', 'teacher-b@example.test'),
  ('00000000-0000-4000-8000-000000000303', 'teacher-c@example.test');

insert into teachers (id, auth_user_id, name) values
  ('00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000301', 'Teacher A'),
  ('00000000-0000-4000-8000-000000000312', '00000000-0000-4000-8000-000000000302', 'Teacher B');

insert into classes (id, teacher_id, name) values
  ('00000000-0000-4000-8000-000000000321', '00000000-0000-4000-8000-000000000311', 'Class A1'),
  ('00000000-0000-4000-8000-000000000322', '00000000-0000-4000-8000-000000000311', 'Class A2'),
  ('00000000-0000-4000-8000-000000000323', '00000000-0000-4000-8000-000000000312', 'Class B');

insert into students (id, class_id, student_number, name) values
  ('00000000-0000-4000-8000-000000000331', '00000000-0000-4000-8000-000000000321', 1, 'Synthetic A1'),
  ('00000000-0000-4000-8000-000000000332', '00000000-0000-4000-8000-000000000322', 1, 'Synthetic A2'),
  ('00000000-0000-4000-8000-000000000333', '00000000-0000-4000-8000-000000000323', 1, 'Synthetic B');

insert into activities (id, teacher_id, title) values
  ('00000000-0000-4000-8000-000000000341', '00000000-0000-4000-8000-000000000311', 'Activity A'),
  ('00000000-0000-4000-8000-000000000342', '00000000-0000-4000-8000-000000000312', 'Activity B');

insert into activity_standards (id, activity_id, standard_id) values
  ('00000000-0000-4000-8000-000000000351', '00000000-0000-4000-8000-000000000341', 'SYN-A'),
  ('00000000-0000-4000-8000-000000000352', '00000000-0000-4000-8000-000000000342', 'SYN-B');

insert into activity_assignments (id, activity_id, class_id) values
  ('00000000-0000-4000-8000-000000000361', '00000000-0000-4000-8000-000000000341', '00000000-0000-4000-8000-000000000321'),
  ('00000000-0000-4000-8000-000000000362', '00000000-0000-4000-8000-000000000342', '00000000-0000-4000-8000-000000000323');

insert into submissions (id, student_id, activity_assignment_id) values
  ('00000000-0000-4000-8000-000000000371', '00000000-0000-4000-8000-000000000331', '00000000-0000-4000-8000-000000000361'),
  ('00000000-0000-4000-8000-000000000372', '00000000-0000-4000-8000-000000000333', '00000000-0000-4000-8000-000000000362');

insert into artifacts (id, submission_id, storage_path, file_name, mime_type) values
  ('00000000-0000-4000-8000-000000000381', '00000000-0000-4000-8000-000000000371', 'teachers/a/a', 'a.pdf', 'application/pdf'),
  ('00000000-0000-4000-8000-000000000382', '00000000-0000-4000-8000-000000000372', 'teachers/b/b', 'b.pdf', 'application/pdf');

insert into audit_logs (id, actor_teacher_id, action) values
  ('00000000-0000-4000-8000-000000000391', '00000000-0000-4000-8000-000000000312', 'LOGIN');

insert into processing_jobs (id, teacher_id, job_type) values
  ('00000000-0000-4000-8000-0000000003a1', '00000000-0000-4000-8000-000000000311', 'SYNTHETIC_A'),
  ('00000000-0000-4000-8000-0000000003a2', '00000000-0000-4000-8000-000000000312', 'SYNTHETIC_B');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000301', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000301","role":"authenticated"}', true);
set local role authenticated;

select is(public.current_teacher_id(), '00000000-0000-4000-8000-000000000311'::uuid, 'JWT resolves Teacher A');
select is((select count(*) from teachers), 1::bigint, 'Teacher A sees only own profile');
select is((select count(*) from teachers where id = '00000000-0000-4000-8000-000000000312'), 0::bigint, 'Teacher B profile is hidden');
select is((select count(*) from classes where id = '00000000-0000-4000-8000-000000000321'), 1::bigint, 'own Class is visible');
select is((select count(*) from classes where id = '00000000-0000-4000-8000-000000000323'), 0::bigint, 'foreign Class is hidden');
select is((select count(*) from students where id = '00000000-0000-4000-8000-000000000331'), 1::bigint, 'own Student is visible');
select is((select count(*) from students where id = '00000000-0000-4000-8000-000000000333'), 0::bigint, 'foreign Student is hidden');
select is((select count(*) from activities where id = '00000000-0000-4000-8000-000000000341'), 1::bigint, 'own Activity is visible');
select is((select count(*) from activities where id = '00000000-0000-4000-8000-000000000342'), 0::bigint, 'foreign Activity is hidden');
select is((select count(*) from activity_standards where id = '00000000-0000-4000-8000-000000000351'), 1::bigint, 'own ActivityStandard is visible');
select is((select count(*) from activity_standards where id = '00000000-0000-4000-8000-000000000352'), 0::bigint, 'foreign ActivityStandard is hidden');
select is((select count(*) from activity_assignments where id = '00000000-0000-4000-8000-000000000361'), 1::bigint, 'own Assignment is visible');
select is((select count(*) from activity_assignments where id = '00000000-0000-4000-8000-000000000362'), 0::bigint, 'foreign Assignment is hidden');
select is((select count(*) from submissions where id = '00000000-0000-4000-8000-000000000371'), 1::bigint, 'own Submission is visible');
select is((select count(*) from submissions where id = '00000000-0000-4000-8000-000000000372'), 0::bigint, 'foreign Submission is hidden');
select is((select count(*) from artifacts where id = '00000000-0000-4000-8000-000000000381'), 1::bigint, 'own Artifact is visible');
select is((select count(*) from artifacts where id = '00000000-0000-4000-8000-000000000382'), 0::bigint, 'foreign Artifact is hidden');
select is((select count(*) from audit_logs where actor_teacher_id = '00000000-0000-4000-8000-000000000312'), 0::bigint, 'foreign Audit Log is hidden');
select is((select count(*) from processing_jobs where id = '00000000-0000-4000-8000-0000000003a2'), 0::bigint, 'foreign Processing Job is hidden');

select throws_ok(
  $$insert into activity_assignments (activity_id, class_id) values ('00000000-0000-4000-8000-000000000341', '00000000-0000-4000-8000-000000000323')$$,
  '42501', 'new row violates row-level security policy for table "activity_assignments"',
  'cross-Teacher Activity/Class Assignment is rejected'
);
select throws_ok(
  $$insert into submissions (student_id, activity_assignment_id) values ('00000000-0000-4000-8000-000000000332', '00000000-0000-4000-8000-000000000361')$$,
  '42501', 'new row violates row-level security policy for table "submissions"',
  'Student from another Class cannot use the Assignment'
);
select throws_ok(
  $$insert into audit_logs (actor_teacher_id, action) values ('00000000-0000-4000-8000-000000000311', 'FORGED')$$,
  '42501', 'new row violates row-level security policy for table "audit_logs"',
  'authenticated browser cannot forge arbitrary Audit actions'
);

select is(public.record_login(), '00000000-0000-4000-8000-000000000311'::uuid, 'LOGIN audit RPC uses current Teacher');
select ok(
  exists (
    select 1 from audit_logs
    where actor_teacher_id = '00000000-0000-4000-8000-000000000311'
      and action = 'LOGIN' and entity_type = 'Teacher'
      and entity_id = actor_teacher_id and request_id is not null and metadata_json is null
  ),
  'LOGIN audit is persistent and contains no metadata payload'
);
select is(
  public.complete_teacher_profile_and_login('Changed Name', 'Changed Nickname'),
  '00000000-0000-4000-8000-000000000311'::uuid,
  'repeated profile completion reuses the existing Teacher'
);
select is((select count(*) from teachers), 1::bigint, 'repeated completion does not duplicate Teacher A');
select is((select count(*) from audit_logs where action = 'LOGIN'), 2::bigint, 'existing-user login events remain persistent');

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
set local role anon;
select is(public.current_teacher_id(), null::uuid, 'unauthenticated JWT resolves no Teacher');
select is((select count(*) from classes), 0::bigint, 'unauthenticated client cannot read Teacher Classes');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000303', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000303","role":"authenticated"}', true);
set local role authenticated;
select ok(
  public.complete_teacher_profile_and_login('Teacher C', null) is not null,
  'new authenticated user creates a Teacher Profile atomically'
);
select is((select count(*) from teachers), 1::bigint, 'new user sees exactly one own Teacher Profile');
select ok(
  exists (select 1 from audit_logs where action = 'LOGIN' and metadata_json is null),
  'new Teacher first LOGIN is audited in the same transaction'
);

reset role;
select * from finish();
rollback;
