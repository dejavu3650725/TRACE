-- 0011: 학생 공개 제출 — 검증 시도 기록 (rate limit 근거)
-- 공개 검증 API(ISSUE-18)의 IP+token 실패 카운트를 서버(service_role)만 기록/조회한다.

create table if not exists public_verify_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  submission_token text not null,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_public_verify_attempts_lookup
  on public_verify_attempts (submission_token, ip, created_at desc);

-- RLS: 정책을 만들지 않는다 → anon/authenticated 접근 전면 차단, service_role만 사용.
alter table public_verify_attempts enable row level security;

comment on table public_verify_attempts is
  'ISSUE-18 학생 공개 검증 rate limit 기록. service_role 전용, PII 없음(IP+token만).';
