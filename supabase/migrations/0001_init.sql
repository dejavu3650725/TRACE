-- ============================================================
-- TRACE Database Schema v1.0 (TRD §16, §18, §30.2)
-- Supabase 대시보드 → SQL Editor에 전체를 붙여넣고 Run 하세요.
-- ============================================================

-- ─── Enums (TRD §18) ─────────────────────────────────────────
create type activity_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');
create type activity_assignment_status as enum ('OPEN', 'CLOSED', 'ARCHIVED');
create type input_status as enum (
  'UPLOADING', 'STORED', 'PREPROCESSING', 'STRUCTURING',
  'REVIEW_PENDING', 'READY_FOR_PROCESS', 'FAILED'
);
create type process_status as enum (
  'NOT_STARTED', 'READY_TO_ANALYZE', 'ANALYZING',
  'REVIEW_REQUIRED', 'APPROVED', 'FAILED'
);
create type artifact_role as enum ('ORIGINAL', 'PROCESSED', 'DERIVED');
create type analysis_status as enum (
  'AI_DRAFT', 'TEACHER_REVIEW', 'APPROVED', 'EDITED_APPROVED', 'REJECTED', 'FAILED'
);
create type review_decision as enum ('APPROVED', 'EDITED_APPROVED', 'REJECTED');
create type growth_event_status as enum (
  'AI_DRAFT', 'TEACHER_REVIEW', 'APPROVED', 'EDITED_APPROVED', 'REJECTED'
);
create type processing_job_status as enum (
  'QUEUED', 'PROCESSING', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED'
);

-- ─── updated_at 자동 갱신 트리거 ─────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─── 16.1 teachers ──────────────────────────────────────────
create table teachers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users (id) on delete cascade,
  name text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_teachers_updated before update on teachers
  for each row execute function set_updated_at();

-- ─── 16.2 classes ───────────────────────────────────────────
create table classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers (id) on delete cascade,
  name text not null,
  grade smallint,
  subject text,
  class_code text unique,
  class_code_expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_classes_teacher on classes (teacher_id);
create trigger trg_classes_updated before update on classes
  for each row execute function set_updated_at();

-- ─── 16.3 students ──────────────────────────────────────────
create table students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  student_number smallint not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_number)
);
create index idx_students_class on students (class_id);
create trigger trg_students_updated before update on students
  for each row execute function set_updated_at();

-- ─── 16.4 activities ────────────────────────────────────────
create table activities (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers (id) on delete cascade,
  title text not null,
  grade smallint,
  subject text,
  domain text,
  unit text,
  activity_type text,
  description text,
  content_json jsonb,
  activity_code text unique,
  status activity_status not null default 'DRAFT',
  parent_activity_id uuid references activities (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_activities_teacher on activities (teacher_id);
create trigger trg_activities_updated before update on activities
  for each row execute function set_updated_at();

-- ─── 16.5 activity_standards ────────────────────────────────
create table activity_standards (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  standard_id text not null,
  created_at timestamptz not null default now(),
  unique (activity_id, standard_id)
);
create index idx_activity_standards_activity on activity_standards (activity_id);

-- ─── 16.6 activity_assignments ──────────────────────────────
create table activity_assignments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  submission_token text unique,
  open_at timestamptz,
  due_at timestamptz,
  status activity_assignment_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, class_id)
);
create index idx_assignments_class on activity_assignments (class_id);
create trigger trg_assignments_updated before update on activity_assignments
  for each row execute function set_updated_at();

-- ─── 16.7 submissions ───────────────────────────────────────
create table submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  activity_assignment_id uuid not null references activity_assignments (id) on delete cascade,
  structured_input jsonb,
  input_status input_status not null default 'UPLOADING',
  process_status process_status not null default 'NOT_STARTED',
  submission_code text unique,
  current_attempt_no smallint not null default 1,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, activity_assignment_id)
);
create index idx_submissions_assignment on submissions (activity_assignment_id);
create index idx_submissions_input_status on submissions (input_status);
create index idx_submissions_process_status on submissions (process_status);
create trigger trg_submissions_updated before update on submissions
  for each row execute function set_updated_at();

-- ─── 16.8 artifacts ─────────────────────────────────────────
create table artifacts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions (id) on delete cascade,
  source_artifact_id uuid references artifacts (id),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint,
  checksum text,
  artifact_role artifact_role not null default 'ORIGINAL',
  attempt_no smallint not null default 1,
  page_start integer,
  page_end integer,
  created_at timestamptz not null default now()
);
create index idx_artifacts_submission on artifacts (submission_id);

-- ─── 16.9 analyses ──────────────────────────────────────────
create table analyses (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions (id) on delete cascade,
  version_no smallint not null default 1,
  analysis_json jsonb not null,
  status analysis_status not null default 'AI_DRAFT',
  provider text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, version_no)
);
create index idx_analyses_submission on analyses (submission_id);
create trigger trg_analyses_updated before update on analyses
  for each row execute function set_updated_at();

-- ─── 16.10 evidence ─────────────────────────────────────────
create table evidence (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references analyses (id) on delete cascade,
  standard_id text,
  artifact_id uuid references artifacts (id),
  question_id text,
  source_page integer,
  claim text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_evidence_analysis on evidence (analysis_id);
create trigger trg_evidence_updated before update on evidence
  for each row execute function set_updated_at();

-- ─── 16.11 reviews ──────────────────────────────────────────
create table reviews (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references analyses (id) on delete cascade,
  reviewer_id uuid not null references teachers (id),
  decision review_decision not null,
  teacher_edits jsonb,
  reviewed_at timestamptz not null default now()
);
create index idx_reviews_analysis on reviews (analysis_id);

-- ─── 16.12 growth_events ────────────────────────────────────
create table growth_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  standard_id text,
  description text not null,
  status growth_event_status not null default 'AI_DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_growth_events_student on growth_events (student_id);
create trigger trg_growth_events_updated before update on growth_events
  for each row execute function set_updated_at();

-- ─── 16.13 growth_event_evidence ────────────────────────────
create table growth_event_evidence (
  id uuid primary key default gen_random_uuid(),
  growth_event_id uuid not null references growth_events (id) on delete cascade,
  evidence_id uuid not null references evidence (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (growth_event_id, evidence_id)
);

-- ─── 16.14 audit_logs ───────────────────────────────────────
-- metadata_json에 학생 이름/번호/답안 전문/토큰/키를 저장하지 않는다 (TRD §16.14)
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_teacher_id uuid references teachers (id),
  action text not null,
  entity_type text,
  entity_id uuid,
  request_id text,
  created_at timestamptz not null default now(),
  metadata_json jsonb
);
create index idx_audit_logs_actor on audit_logs (actor_teacher_id, created_at desc);

-- ─── 16.15 processing_jobs ──────────────────────────────────
create table processing_jobs (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers (id) on delete cascade,
  job_type text not null,
  status processing_job_status not null default 'QUEUED',
  total_count integer not null default 0,
  completed_count integer not null default 0,
  failed_count integer not null default 0,
  current_step text,
  error_message text,
  payload_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_processing_jobs_teacher on processing_jobs (teacher_id, created_at desc);
create trigger trg_processing_jobs_updated before update on processing_jobs
  for each row execute function set_updated_at();

-- ============================================================
-- RLS (TRD §30.2) — 본인 teacher_id 소유 범위만 접근
-- Student Public Submit은 RLS를 우회하지 않고 서버 API(/api/submit/*)에서
-- 별도 검증 후 처리한다 (TRD §30.4~30.5).
-- ============================================================
alter table teachers enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table activities enable row level security;
alter table activity_standards enable row level security;
alter table activity_assignments enable row level security;
alter table submissions enable row level security;
alter table artifacts enable row level security;
alter table analyses enable row level security;
alter table evidence enable row level security;
alter table reviews enable row level security;
alter table growth_events enable row level security;
alter table growth_event_evidence enable row level security;
alter table audit_logs enable row level security;
alter table processing_jobs enable row level security;

-- 현재 로그인한 auth 사용자의 teacher_id
create or replace function current_teacher_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from teachers where auth_user_id = auth.uid()
$$;

-- teachers: 본인 Row만
create policy teachers_select on teachers for select using (auth_user_id = auth.uid());
create policy teachers_insert on teachers for insert with check (auth_user_id = auth.uid());
create policy teachers_update on teachers for update using (auth_user_id = auth.uid());

-- classes
create policy classes_all on classes for all
  using (teacher_id = current_teacher_id())
  with check (teacher_id = current_teacher_id());

-- students: 본인 Class 소속
create policy students_all on students for all
  using (class_id in (select id from classes where teacher_id = current_teacher_id()))
  with check (class_id in (select id from classes where teacher_id = current_teacher_id()));

-- activities
create policy activities_all on activities for all
  using (teacher_id = current_teacher_id())
  with check (teacher_id = current_teacher_id());

-- activity_standards: 본인 Activity 범위
create policy activity_standards_all on activity_standards for all
  using (activity_id in (select id from activities where teacher_id = current_teacher_id()))
  with check (activity_id in (select id from activities where teacher_id = current_teacher_id()));

-- activity_assignments: 본인 Activity/Class 범위
create policy assignments_all on activity_assignments for all
  using (activity_id in (select id from activities where teacher_id = current_teacher_id()))
  with check (activity_id in (select id from activities where teacher_id = current_teacher_id()));

-- submissions: 본인 ActivityAssignment 범위
create policy submissions_all on submissions for all
  using (activity_assignment_id in (
    select aa.id from activity_assignments aa
    join activities a on a.id = aa.activity_id
    where a.teacher_id = current_teacher_id()))
  with check (activity_assignment_id in (
    select aa.id from activity_assignments aa
    join activities a on a.id = aa.activity_id
    where a.teacher_id = current_teacher_id()));

-- artifacts: 접근 가능한 Submission 범위
create policy artifacts_all on artifacts for all
  using (submission_id in (
    select s.id from submissions s
    join activity_assignments aa on aa.id = s.activity_assignment_id
    join activities a on a.id = aa.activity_id
    where a.teacher_id = current_teacher_id()))
  with check (submission_id in (
    select s.id from submissions s
    join activity_assignments aa on aa.id = s.activity_assignment_id
    join activities a on a.id = aa.activity_id
    where a.teacher_id = current_teacher_id()));

-- analyses
create policy analyses_all on analyses for all
  using (submission_id in (
    select s.id from submissions s
    join activity_assignments aa on aa.id = s.activity_assignment_id
    join activities a on a.id = aa.activity_id
    where a.teacher_id = current_teacher_id()))
  with check (submission_id in (
    select s.id from submissions s
    join activity_assignments aa on aa.id = s.activity_assignment_id
    join activities a on a.id = aa.activity_id
    where a.teacher_id = current_teacher_id()));

-- evidence: 접근 가능한 Analysis 범위
create policy evidence_all on evidence for all
  using (analysis_id in (
    select an.id from analyses an
    join submissions s on s.id = an.submission_id
    join activity_assignments aa on aa.id = s.activity_assignment_id
    join activities a on a.id = aa.activity_id
    where a.teacher_id = current_teacher_id()))
  with check (analysis_id in (
    select an.id from analyses an
    join submissions s on s.id = an.submission_id
    join activity_assignments aa on aa.id = s.activity_assignment_id
    join activities a on a.id = aa.activity_id
    where a.teacher_id = current_teacher_id()));

-- reviews
create policy reviews_all on reviews for all
  using (reviewer_id = current_teacher_id())
  with check (reviewer_id = current_teacher_id());

-- growth_events: 본인 Student 범위
create policy growth_events_all on growth_events for all
  using (student_id in (
    select st.id from students st
    join classes c on c.id = st.class_id
    where c.teacher_id = current_teacher_id()))
  with check (student_id in (
    select st.id from students st
    join classes c on c.id = st.class_id
    where c.teacher_id = current_teacher_id()));

-- growth_event_evidence
create policy growth_event_evidence_all on growth_event_evidence for all
  using (growth_event_id in (
    select ge.id from growth_events ge
    join students st on st.id = ge.student_id
    join classes c on c.id = st.class_id
    where c.teacher_id = current_teacher_id()))
  with check (growth_event_id in (
    select ge.id from growth_events ge
    join students st on st.id = ge.student_id
    join classes c on c.id = st.class_id
    where c.teacher_id = current_teacher_id()));

-- audit_logs: 본인 Actor 범위 최소 조회, INSERT는 본인 명의만
create policy audit_logs_select on audit_logs for select
  using (actor_teacher_id = current_teacher_id());
create policy audit_logs_insert on audit_logs for insert
  with check (actor_teacher_id = current_teacher_id());

-- processing_jobs
create policy processing_jobs_all on processing_jobs for all
  using (teacher_id = current_teacher_id())
  with check (teacher_id = current_teacher_id());

-- ============================================================
-- Storage: Private Bucket 'trace' (TRD §30.8~30.9)
-- 영구 Public URL 금지. 조회는 서버 발급 짧은 만료 Signed URL만.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('trace', 'trace', false)
on conflict (id) do nothing;

-- 본인 teacher 폴더(teachers/{teacher_id}/...)만 접근
create policy trace_storage_rw on storage.objects for all
  using (
    bucket_id = 'trace'
    and (storage.foldername(name))[1] = 'teachers'
    and (storage.foldername(name))[2] = current_teacher_id()::text
  )
  with check (
    bucket_id = 'trace'
    and (storage.foldername(name))[1] = 'teachers'
    and (storage.foldername(name))[2] = current_teacher_id()::text
  );
