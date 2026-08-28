begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000901', 'activity-a@example.test'),
  ('00000000-0000-4000-8000-000000000902', 'activity-b@example.test');

insert into public.teachers (id, auth_user_id, name) values
  ('00000000-0000-4000-8000-000000000911', '00000000-0000-4000-8000-000000000901', 'Synthetic Activity Teacher A'),
  ('00000000-0000-4000-8000-000000000912', '00000000-0000-4000-8000-000000000902', 'Synthetic Activity Teacher B');

insert into public.classes (id, teacher_id, name) values
  ('00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000911', 'Synthetic Class A1'),
  ('00000000-0000-4000-8000-000000000922', '00000000-0000-4000-8000-000000000911', 'Synthetic Class A2'),
  ('00000000-0000-4000-8000-000000000923', '00000000-0000-4000-8000-000000000912', 'Synthetic Class B');

insert into public.activities (id, teacher_id, title, status) values
  ('00000000-0000-4000-8000-000000000931', '00000000-0000-4000-8000-000000000912', 'Synthetic Foreign Activity', 'ACTIVE');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000901', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000901","role":"authenticated"}', true);
set local role authenticated;

select ok(
  public.save_activity(null, 'Synthetic Lesson 1', 3, '국어', '읽기', '문단', '활동지', 'Synthetic description', null, array['4국03-01']) is not null,
  'owned Teacher can create an Activity'
);
select is((select status::text from public.activities where title = 'Synthetic Lesson 1'), 'DRAFT', 'new Activity is DRAFT');
select is((select count(*) from public.activity_standards where activity_id = (select id from public.activities where title = 'Synthetic Lesson 1')), 1::bigint, 'ActivityStandard persists');
select is((select content_json from public.activities where title = 'Synthetic Lesson 1'), null::jsonb, 'non-AI Activity does not create AI content or Rubric data');

select ok(
  public.save_activity(
    null, 'Synthetic Lesson 2', 3, '국어', '읽기', '문단', '활동지', null,
    (select id from public.activities where title = 'Synthetic Lesson 1'), array['4국03-01']
  ) is not null,
  'second Activity can use the first Activity as its parent'
);
select is(
  (select parent_activity_id from public.activities where title = 'Synthetic Lesson 2'),
  (select id from public.activities where title = 'Synthetic Lesson 1'),
  'parent relation survives re-read'
);
select throws_ok(
  $$select public.save_activity(
    (select id from public.activities where title = 'Synthetic Lesson 1'), 'Synthetic Lesson 1', 3, '국어', null, null, null, null,
    (select id from public.activities where title = 'Synthetic Lesson 1'), array[]::text[]
  )$$,
  '23514', 'Activity cannot be its own parent', 'self-parent is rejected'
);
select throws_ok(
  $$select public.save_activity(null, 'Synthetic Cross Parent', 3, '국어', null, null, null, null, '00000000-0000-4000-8000-000000000931', array[]::text[])$$,
  '42501', 'Parent Activity is outside current Teacher scope', 'cross-Teacher parent is rejected'
);
select throws_ok(
  $$select public.save_activity(
    (select id from public.activities where title = 'Synthetic Lesson 1'), 'Synthetic Lesson 1', 3, '국어', null, null, null, null,
    (select id from public.activities where title = 'Synthetic Lesson 2'), array['4국03-01']
  )$$,
  '23514', 'Activity parent chain cannot contain a cycle', 'parent cycle is rejected'
);

select is(
  public.activate_activity((select id from public.activities where title = 'Synthetic Lesson 1'), 'KOR-03-03-01'),
  'KOR-03-03-01-001', 'activation issues the first human-readable Activity Code'
);
select is(
  public.activate_activity((select id from public.activities where title = 'Synthetic Lesson 2'), 'KOR-03-03-01'),
  'KOR-03-03-01-002', 'Activity Code serial increments within the same prefix'
);
select is(
  public.assign_activity_to_classes(
    (select id from public.activities where title = 'Synthetic Lesson 1'),
    array['00000000-0000-4000-8000-000000000921'::uuid, '00000000-0000-4000-8000-000000000922'::uuid], null, null
  ),
  2, 'one Activity can be assigned to multiple owned Classes'
);
select is(
  (select count(*) from public.activity_assignments where activity_id = (select id from public.activities where title = 'Synthetic Lesson 1')),
  2::bigint, 'assignments persist after re-read'
);
select is(
  public.assign_activity_to_classes(
    (select id from public.activities where title = 'Synthetic Lesson 1'),
    array['00000000-0000-4000-8000-000000000921'::uuid], null, null
  ),
  0, 'duplicate Activity/Class assignment is handled without a second row'
);
select throws_ok(
  $$select public.assign_activity_to_classes(
    (select id from public.activities where title = 'Synthetic Lesson 1'),
    array['00000000-0000-4000-8000-000000000923'::uuid], null, null
  )$$,
  '42501', 'Class is outside current Teacher scope', 'cross-Teacher Class assignment is rejected'
);
select ok(
  public.update_activity_assignment(
    (select id from public.activity_assignments where class_id = '00000000-0000-4000-8000-000000000921'),
    'CLOSED', null, null
  ) is not null,
  'owned Assignment status can be updated'
);
select is(
  (select status::text from public.activity_assignments where class_id = '00000000-0000-4000-8000-000000000921'),
  'CLOSED', 'CLOSED Assignment status survives re-read'
);

reset role;
select * from finish();
rollback;

