# TRACE DB Handoff — ISSUE-02 / ISSUE-03

## 요청 목적

TRACE INPUT의 Database Baseline과 인증/RLS 기반을 원격 **개발 Supabase 프로젝트**에 반영한다.

Google OAuth 운영 설정과 실제 Google 계정 E2E 검증은 최종 통합 단계에서 진행한다. 다만 이후 Class/Roster 구현이 Teacher 소유권과 RLS에 의존하므로 이 문서의 DB migration은 지금 적용해야 한다.

## 함께 전달된 파일

로컬 검증 기준 파일:

1. `supabase/config.toml`
2. `supabase/migrations/0001_init.sql`
3. `supabase/migrations/0002_teacher_nickname.sql`

신규 적용 대상 파일:

4. `supabase/migrations/0003_input_contract_hardening.sql`
5. `supabase/migrations/0004_auth_rls_ownership.sql`

검증 파일:

6. `supabase/tests/issue_02_input_contract.test.sql`
7. `supabase/tests/issue_03_auth_rls.test.sql`

이 안내 문서를 포함해 총 8개 파일을 전달한다.

`0001`, `0002`는 원격 DB에 무조건 다시 적용하라는 의미가 아니라 기존 기준과 로컬 clean test를 위한 참조 파일이다. 원격 DB에는 적용 이력을 확인한 뒤 누락된 migration만 적용한다.

## 적용 전 필수 확인

1. 운영 DB가 아닌 원격 개발 Supabase 프로젝트인지 확인한다.
2. 기존 `0001_init.sql`, `0002_teacher_nickname.sql`이 적용되어 있는지 확인한다.
3. 원격 migration 이력에서 `0003`, `0004`가 이미 적용됐는지 확인한다.
4. 기존 migration이 SQL Editor로 수동 적용되었다면, 팀의 migration 이력 관리 방식과 먼저 맞춘다.
5. 이미 적용된 migration을 다시 실행하지 않는다.
6. 적용 전 개발 DB 백업 또는 복구 지점을 확인한다.

기존 DB 상태가 문서와 다르거나 migration 충돌이 있으면 임의 수정하지 말고 차이를 회신한다.

## 적용 순서

누락된 migration만 다음 순서로 적용한다.

```text
0003_input_contract_hardening.sql
→ 0004_auth_rls_ownership.sql
```

Supabase CLI를 사용한다면 팀에서 이미 사용 중인 link/push 절차를 따른다. SQL Editor를 사용한다면 각 파일 전체를 번호순으로 실행하고, 수동 적용 사실과 migration 이력을 팀 규칙에 맞게 기록한다.

## 0003 변경 내용

- Class Code와 만료시각의 쌍 검증
- Submission/Artifact attempt 번호 양수 검증
- Artifact PDF page 범위 검증
- Processing Job count 범위 검증
- INPUT 관계 및 상태 조회용 index 추가

새 Entity, Table, 상태 enum 또는 데이터 필드는 추가하지 않는다.

## 0004 변경 내용

- `current_teacher_id()`의 `search_path` 및 실행 권한 보강
- ActivityAssignment의 Activity와 Class가 모두 현재 Teacher 소유인지 검증
- Submission의 Student가 Assignment Class에 속하는지 검증
- Artifact가 유효한 Submission 소유권 경로를 따르도록 검증
- 인증된 Client의 임의 `audit_logs` 직접 INSERT 차단
- 기존 Teacher 로그인 기록용 `record_login()` RPC 추가
- Teacher Profile 생성과 최초 LOGIN 기록을 원자적으로 처리하는 `complete_teacher_profile_and_login(text, text)` RPC 추가

## 중요 영향

`0004` 적용 후 인증된 Client가 `audit_logs`에 임의 Action을 직접 INSERT할 수 없다.

다른 모듈이 다음과 같은 코드를 사용 중인지 확인한다.

```text
supabase.from("audit_logs").insert(...)
```

해당 코드가 있다면 영향받는 파일과 Action을 회신한다. `ROSTER_IMPORT`, `ARTIFACT_UPLOAD`, `DATA_DELETE` 등은 각 구현 ISSUE에서 고정된 형태의 서버 함수/RPC를 추가해야 한다.

`submission_id`가 없는 미분류 Artifact 접근 계약은 아직 승인되지 않았으므로 `0004`에서도 허용하지 않는다.

## 로컬 검증

동일 migration이 적용되는 별도 로컬 Supabase DB에서 실행한다. 원격 개발 DB에 합성 fixture 테스트를 직접 실행하지 않는다.

```bash
npx supabase db reset
npx supabase test db
npx supabase db lint --local --level warning
```

기대 결과:

```text
0001 → 0002 → 0003 → 0004 clean 적용 성공
pgTAP Files=2, Tests=62, Result: PASS
DB lint: No schema errors found
```

테스트 데이터는 transaction 마지막에 rollback되는 합성 데이터만 사용한다.

## 적용 후 확인 항목

- `record_login()` 함수가 존재하고 `authenticated` 역할이 실행 가능
- `complete_teacher_profile_and_login(text, text)` 함수가 존재하고 `authenticated` 역할이 실행 가능
- `assignments_all`, `submissions_all`, `artifacts_all` RLS Policy 적용
- 동일 `auth_user_id`에 Teacher Profile이 한 건만 존재
- LOGIN Audit에 `action = 'LOGIN'`, `request_id is not null`, `metadata_json is null`
- 다른 Teacher의 Class/Student/Activity/Assignment/Submission/Artifact 조회 차단

## Google OAuth 관련

DB 담당자가 이번에 처리할 범위는 migration 적용까지다.

다음 항목은 최종 통합 단계에서 별도로 확인한다.

- Google Cloud OAuth 동의 화면 최종 설정
- 배포 URL 및 Redirect URL 최종 등록
- 실제 Google 계정 신규 사용자 로그인
- 동일 Google 계정 재로그인 및 기존 Profile 재사용

Google OAuth 애플리케이션 코드는 이미 구현되어 있으므로 DB 담당자가 별도로 프론트엔드 코드를 작성할 필요는 없다.

## 회신 요청 형식

```text
적용 환경:
기존 migration 상태:
적용한 migration:
적용 방식(CLI / SQL Editor):
적용 결과:
DB lint 결과:
다른 모듈의 audit_logs 직접 INSERT 사용 여부:
오류 또는 확인이 필요한 차이:
```
