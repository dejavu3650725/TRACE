begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000003101', 'results-a@example.test'),
  ('00000000-0000-4000-8000-000000003102', 'results-b@example.test');
insert into public.teachers (id, auth_user_id, name) values
  ('00000000-0000-4000-8000-000000003111', '00000000-0000-4000-8000-000000003101', 'Synthetic Results Teacher A'),
  ('00000000-0000-4000-8000-000000003112', '00000000-0000-4000-8000-000000003102', 'Synthetic Results Teacher B');
insert into public.classes (id, teacher_id, name) values
  ('00000000-0000-4000-8000-000000003121', '00000000-0000-4000-8000-000000003111', 'Synthetic Results Class A'),
  ('00000000-0000-4000-8000-000000003122', '00000000-0000-4000-8000-000000003112', 'Synthetic Results Class B');
insert into public.students (id, class_id, student_number, name) values
  ('00000000-0000-4000-8000-000000003131', '00000000-0000-4000-8000-000000003121', 1, 'Synthetic Results Student 1'),
  ('00000000-0000-4000-8000-000000003132', '00000000-0000-4000-8000-000000003121', 2, 'Synthetic Results Student 2'),
  ('00000000-0000-4000-8000-000000003133', '00000000-0000-4000-8000-000000003121', 3, 'Synthetic Results Student 3'),
  ('00000000-0000-4000-8000-000000003134', '00000000-0000-4000-8000-000000003122', 1, 'Synthetic Foreign Results Student');
insert into public.activities (id, teacher_id, title, status) values
  ('00000000-0000-4000-8000-000000003141', '00000000-0000-4000-8000-000000003111', 'Synthetic Results Activity A', 'ACTIVE'),
  ('00000000-0000-4000-8000-000000003142', '00000000-0000-4000-8000-000000003112', 'Synthetic Results Activity B', 'ACTIVE');
insert into public.activity_assignments (id, activity_id, class_id, status) values
  ('00000000-0000-4000-8000-000000003151', '00000000-0000-4000-8000-000000003141', '00000000-0000-4000-8000-000000003121', 'OPEN'),
  ('00000000-0000-4000-8000-000000003152', '00000000-0000-4000-8000-000000003142', '00000000-0000-4000-8000-000000003122', 'OPEN');
insert into public.submissions (
  id, student_id, activity_assignment_id, input_status, process_status
) values
  ('00000000-0000-4000-8000-000000003161', '00000000-0000-4000-8000-000000003131', '00000000-0000-4000-8000-000000003151', 'REVIEW_PENDING', 'NOT_STARTED'),
  ('00000000-0000-4000-8000-000000003162', '00000000-0000-4000-8000-000000003132', '00000000-0000-4000-8000-000000003151', 'READY_FOR_PROCESS', 'READY_TO_ANALYZE'),
  ('00000000-0000-4000-8000-000000003163', '00000000-0000-4000-8000-000000003134', '00000000-0000-4000-8000-000000003152', 'READY_FOR_PROCESS', 'READY_TO_ANALYZE');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000003101', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003101","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.activity_assignments), 1::bigint, 'RLS exposes only the current Teacher assignment');
select is((select count(*) from public.students where class_id = '00000000-0000-4000-8000-000000003121'), 3::bigint, 'active Class roster total is queryable');
select is((select count(*) from public.submissions where activity_assignment_id = '00000000-0000-4000-8000-000000003151'), 2::bigint, 'submitted count comes from persisted Submission rows');
select is((
  select count(*) from public.students student
  where student.class_id = '00000000-0000-4000-8000-000000003121'
    and not exists (
      select 1 from public.submissions submission
      where submission.student_id = student.id
        and submission.activity_assignment_id = '00000000-0000-4000-8000-000000003151'
    )
), 1::bigint, 'missing is Class roster minus Submission existence');
select is((select count(*) from public.submissions where input_status = 'REVIEW_PENDING'), 1::bigint, 'review-pending count uses persisted input_status');
select is((select count(*) from public.submissions where input_status = 'READY_FOR_PROCESS'), 1::bigint, 'ready count uses persisted input_status');

reset role;
select * from finish();
rollback;
