-- ============================================================
-- TRACE 개발/데모용 합성 데이터 시드
-- 전제: Google 로그인을 최소 1회 완료해 teachers에 내 프로필이 있어야 한다.
-- 실행: Supabase SQL Editor에 붙여넣고 Run (여러 번 실행해도 중복 생성 안 됨)
-- 주의: 실제 학생 데이터가 아닌 합성 데이터만 사용한다 (TRD §54)
-- ============================================================

do $$
declare
  v_teacher_id uuid;
  v_class_id uuid;
  v_activity_id uuid;
  v_assignment_id uuid;
  v_student record;
begin
  -- 내 Teacher (가장 먼저 만들어진 프로필 사용)
  select id into v_teacher_id from teachers order by created_at limit 1;
  if v_teacher_id is null then
    raise exception '교사 프로필이 없습니다. 먼저 Google 로그인을 완료하세요.';
  end if;

  -- 데모 학급
  select id into v_class_id from classes where teacher_id = v_teacher_id and name = '데모 3학년 1반';
  if v_class_id is null then
    insert into classes (teacher_id, name, grade, subject, class_code, class_code_expires_at)
    values (v_teacher_id, '데모 3학년 1반', 3, '수학', 'DEMO01', now() + interval '24 hours')
    returning id into v_class_id;
  end if;

  -- 합성 학생 4명
  insert into students (class_id, student_number, name)
  select v_class_id, n, '학생' || chr(64 + n)
  from generate_series(1, 4) as n
  on conflict (class_id, student_number) do nothing;

  -- 데모 활동 (분수 비교) + 성취기준 연결
  select id into v_activity_id from activities where teacher_id = v_teacher_id and title = '분모가 같은 분수의 크기 비교';
  if v_activity_id is null then
    insert into activities (teacher_id, title, grade, subject, description, status)
    values (
      v_teacher_id,
      '분모가 같은 분수의 크기 비교',
      3, '수학',
      '분모가 같은 두 분수의 크기를 비교하고 그 이유를 설명하는 활동지',
      'ACTIVE'
    )
    returning id into v_activity_id;
  end if;

  insert into activity_standards (activity_id, standard_id)
  values (v_activity_id, '4수01-11')
  on conflict (activity_id, standard_id) do nothing;

  -- 학급 배정
  select id into v_assignment_id from activity_assignments
  where activity_id = v_activity_id and class_id = v_class_id;
  if v_assignment_id is null then
    insert into activity_assignments (activity_id, class_id, status, submission_token)
    values (v_activity_id, v_class_id, 'OPEN', encode(gen_random_bytes(12), 'hex'))
    returning id into v_assignment_id;
  end if;

  -- 학생별 제출물 (READY_FOR_PROCESS, 합성 응답)
  for v_student in select id, student_number from students where class_id = v_class_id loop
    insert into submissions (student_id, activity_assignment_id, structured_input, input_status, process_status, submitted_at)
    values (
      v_student.id,
      v_assignment_id,
      case v_student.student_number
        when 1 then '{"schema_version":"1","questions":[
          {"question_id":"Q1","response_type":"selection","response":{"selected_option":"3/5"}},
          {"question_id":"Q2","response_type":"long_text","response":{"raw_text":"분모가 같으면 분자가 큰 분수가 더 큽니다. 5분의 3은 5분의 2보다 조각이 하나 더 많기 때문입니다."}}
        ]}'::jsonb
        when 2 then '{"schema_version":"1","questions":[
          {"question_id":"Q1","response_type":"selection","response":{"selected_option":"3/5"}},
          {"question_id":"Q2","response_type":"long_text","response":{"raw_text":"3이 2보다 커서요."}}
        ]}'::jsonb
        when 3 then '{"schema_version":"1","questions":[
          {"question_id":"Q1","response_type":"selection","response":{"selected_option":"2/5"}},
          {"question_id":"Q2","response_type":"long_text","response":{"raw_text":"2가 3보다 먼저 나오는 수라서 2/5가 더 큽니다."}}
        ]}'::jsonb
        else '{"schema_version":"1","questions":[
          {"question_id":"Q1","response_type":"selection","response":{"selected_option":"3/5"}},
          {"question_id":"Q2","response_type":"long_text","response":{"raw_text":"그림을 그려보면 5칸 중에 3칸을 칠한 것이 5칸 중 2칸보다 넓습니다. 그래서 3/5가 큽니다."}}
        ]}'::jsonb
      end,
      'READY_FOR_PROCESS',
      'NOT_STARTED',
      now()
    )
    on conflict (student_id, activity_assignment_id) do nothing;
  end loop;

  raise notice '시드 완료: 학급/학생 4명/활동/제출물 4건';
end $$;
