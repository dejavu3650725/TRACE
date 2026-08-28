begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

select ok(
  (
    select count(*) = 10
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'teachers', 'classes', 'students', 'activities', 'activity_standards',
        'activity_assignments', 'submissions', 'artifacts', 'audit_logs', 'processing_jobs'
      )
  ),
  'all INPUT baseline tables exist'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teachers'
      and column_name = 'auth_user_id' and is_nullable = 'NO' and data_type = 'uuid'
  ),
  'teachers.auth_user_id is required uuid'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'teachers'
      and column_name = 'nickname' and is_nullable = 'YES' and data_type = 'text'
  ),
  'teachers.nickname is optional text'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'classes'
      and column_name = 'class_code' and is_nullable = 'YES' and data_type = 'text'
  ),
  'classes.class_code exists'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'classes'
      and column_name = 'class_code_expires_at' and is_nullable = 'YES'
      and data_type = 'timestamp with time zone'
  ),
  'classes.class_code_expires_at exists'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'students' and c.contype = 'u'
      and pg_get_constraintdef(c.oid) = 'UNIQUE (class_id, student_number)'
  ),
  'students are unique by class and number'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'activity_standards' and c.contype = 'u'
      and pg_get_constraintdef(c.oid) = 'UNIQUE (activity_id, standard_id)'
  ),
  'Activity to Standard relation is unique'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'activity_assignments'
      and column_name = 'submission_token' and data_type = 'text'
  ),
  'ActivityAssignment has submission_token'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'activity_assignments' and c.contype = 'u'
      and pg_get_constraintdef(c.oid) = 'UNIQUE (activity_id, class_id)'
  ),
  'ActivityAssignment is unique by Activity and Class'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'submissions'
      and column_name = 'structured_input' and data_type = 'jsonb'
  ),
  'submissions.structured_input is JSONB'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'submissions'
      and column_name = 'input_status' and udt_name = 'input_status'
  ),
  'Submission owns input_status'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'submissions'
      and column_name = 'process_status' and udt_name = 'process_status'
  ),
  'Submission keeps process_status separate'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'submissions' and c.contype = 'u'
      and pg_get_constraintdef(c.oid) = 'UNIQUE (student_id, activity_assignment_id)'
  ),
  'one Student and ActivityAssignment maps to one Submission'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_class rt on rt.oid = c.confrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'submissions'
      and rt.relname = 'students' and c.contype = 'f'
  ),
  'Submission references Student'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_class rt on rt.oid = c.confrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'submissions'
      and rt.relname = 'activity_assignments' and c.contype = 'f'
  ),
  'Submission references ActivityAssignment'
);

select ok(
  (
    select count(*) = 5
    from information_schema.columns
    where table_schema = 'public' and table_name = 'artifacts'
      and column_name in ('source_artifact_id', 'artifact_role', 'attempt_no', 'page_start', 'page_end')
  ),
  'Artifact derivation, role, attempt, and page fields exist'
);

select ok(
  (
    select array_agg(e.enumlabel::text order by e.enumsortorder)
    from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'artifact_role'
  ) = array['ORIGINAL', 'PROCESSED', 'DERIVED'],
  'Artifact roles match the shared enum'
);

select ok(
  (
    select count(*) = 7
    from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs'
      and column_name in (
        'actor_teacher_id', 'action', 'entity_type', 'entity_id',
        'request_id', 'created_at', 'metadata_json'
      )
  ),
  'audit_logs has the minimum persistent fields'
);

select ok(
  (
    select count(*) = 10
    from information_schema.columns
    where table_schema = 'public' and table_name = 'processing_jobs'
      and column_name in (
        'teacher_id', 'job_type', 'status', 'total_count', 'completed_count',
        'failed_count', 'current_step', 'error_message', 'payload_json', 'updated_at'
      )
  ),
  'processing_jobs has persistent progress fields'
);

select ok(
  (
    select array_agg(e.enumlabel::text order by e.enumsortorder)
    from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'input_status'
  ) = array[
    'UPLOADING', 'STORED', 'PREPROCESSING', 'STRUCTURING',
    'REVIEW_PENDING', 'READY_FOR_PROCESS', 'FAILED'
  ],
  'input_status values match the shared contract'
);

select ok(
  (
    select array_agg(e.enumlabel::text order by e.enumsortorder)
    from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'process_status'
  ) = array[
    'NOT_STARTED', 'READY_TO_ANALYZE', 'ANALYZING',
    'REVIEW_REQUIRED', 'APPROVED', 'FAILED'
  ],
  'process_status values match the shared contract'
);

select ok(
  (
    select array_agg(e.enumlabel::text order by e.enumsortorder)
    from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'processing_job_status'
  ) = array['QUEUED', 'PROCESSING', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED'],
  'processing_job_status values match the shared contract'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'classes_code_expiry_pair' and contype = 'c'
  ),
  'Class Code and expiry pairing is enforced'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'submissions_current_attempt_positive' and contype = 'c'
  ),
  'Submission attempt number is positive'
);

select ok(
  (
    select count(*) = 2 from pg_constraint
    where conname in ('artifacts_attempt_positive', 'artifacts_page_range_valid') and contype = 'c'
  ),
  'Artifact attempt and page range constraints exist'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'processing_jobs_counts_valid' and contype = 'c'
  ),
  'Processing Job counters are bounded'
);

select ok(
  (
    select count(*) = 7
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'idx_activities_parent',
        'idx_activities_teacher_status',
        'idx_assignments_class_status',
        'idx_submissions_assignment_input_status',
        'idx_artifacts_source',
        'idx_audit_logs_entity',
        'idx_processing_jobs_teacher_status'
      )
  ),
  'INPUT relationship and status indexes exist'
);

-- Exercise the two uniqueness boundaries called out in the ISSUE-02 local checks.
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-000000000201', 'issue-02@example.test');

insert into teachers (id, auth_user_id, name)
values (
  '00000000-0000-0000-0000-000000000202',
  '00000000-0000-0000-0000-000000000201',
  'ISSUE-02 Teacher'
);

insert into classes (id, teacher_id, name)
values (
  '00000000-0000-0000-0000-000000000203',
  '00000000-0000-0000-0000-000000000202',
  'ISSUE-02 Class'
);

insert into students (id, class_id, student_number, name)
values (
  '00000000-0000-0000-0000-000000000204',
  '00000000-0000-0000-0000-000000000203',
  1,
  'Student One'
);

select throws_ok(
  $$
    insert into students (id, class_id, student_number, name)
    values (
      '00000000-0000-0000-0000-000000000205',
      '00000000-0000-0000-0000-000000000203',
      1,
      'Duplicate Student Number'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "students_class_id_student_number_key"',
  'duplicate student number in one Class is rejected'
);

insert into activities (id, teacher_id, title)
values (
  '00000000-0000-0000-0000-000000000206',
  '00000000-0000-0000-0000-000000000202',
  'ISSUE-02 Activity'
);

insert into activity_assignments (id, activity_id, class_id)
values (
  '00000000-0000-0000-0000-000000000207',
  '00000000-0000-0000-0000-000000000206',
  '00000000-0000-0000-0000-000000000203'
);

insert into submissions (id, student_id, activity_assignment_id)
values (
  '00000000-0000-0000-0000-000000000208',
  '00000000-0000-0000-0000-000000000204',
  '00000000-0000-0000-0000-000000000207'
);

select throws_ok(
  $$
    insert into submissions (id, student_id, activity_assignment_id)
    values (
      '00000000-0000-0000-0000-000000000209',
      '00000000-0000-0000-0000-000000000204',
      '00000000-0000-0000-0000-000000000207'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "submissions_student_id_activity_assignment_id_key"',
  'duplicate Student and ActivityAssignment Submission is rejected'
);

select * from finish();

rollback;
