begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000801', 'roster-a@example.test'),
  ('00000000-0000-4000-8000-000000000802', 'roster-b@example.test');

insert into public.teachers (id, auth_user_id, name) values
  ('00000000-0000-4000-8000-000000000811', '00000000-0000-4000-8000-000000000801', 'Roster Teacher A'),
  ('00000000-0000-4000-8000-000000000812', '00000000-0000-4000-8000-000000000802', 'Roster Teacher B');

insert into public.classes (id, teacher_id, name) values
  ('00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000811', 'Roster Class A'),
  ('00000000-0000-4000-8000-000000000822', '00000000-0000-4000-8000-000000000812', 'Roster Class B');

insert into public.students (class_id, student_number, name, is_active) values
  ('00000000-0000-4000-8000-000000000821', 1, 'Synthetic Previous Name', false);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000801","role":"authenticated"}', true);
set local role authenticated;

select ok(
  public.commit_roster_import(
    '00000000-0000-4000-8000-000000000821',
    '[{"student_number":1,"student_name":"Synthetic Updated Name"},{"student_number":2,"student_name":"Synthetic Student Two"}]'::jsonb
  ) is not null,
  'owned Class roster import persists and writes an audit event'
);
select is((select count(*) from public.students where class_id = '00000000-0000-4000-8000-000000000821'), 2::bigint, 'import inserts missing Student rows');
select is((select name from public.students where class_id = '00000000-0000-4000-8000-000000000821' and student_number = 1), 'Synthetic Updated Name', 'import updates matching Student number');
select ok((select is_active from public.students where class_id = '00000000-0000-4000-8000-000000000821' and student_number = 1), 'import reactivates matching Student');
select ok(
  exists (
    select 1 from public.audit_logs
    where actor_teacher_id = '00000000-0000-4000-8000-000000000811'
      and action = 'ROSTER_IMPORT'
      and entity_type = 'Class'
      and entity_id = '00000000-0000-4000-8000-000000000821'
      and request_id is not null
      and metadata_json is null
  ),
  'ROSTER_IMPORT audit contains IDs only and no student PII metadata'
);
select throws_ok(
  $$select public.commit_roster_import('00000000-0000-4000-8000-000000000822', '[{"student_number":1,"student_name":"Synthetic Unauthorized"}]'::jsonb)$$,
  '42501', 'Class is outside current Teacher scope',
  'another Teacher cannot import a foreign Class roster'
);

reset role;
select * from finish();
rollback;
