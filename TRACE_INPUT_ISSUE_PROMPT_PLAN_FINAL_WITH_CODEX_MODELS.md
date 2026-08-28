# TRACE INPUT — Issue & Prompt Plan FINAL

> **Purpose**  
> 해커톤 당일 TRACE INPUT Module을 단계적으로 새로 구현하기 위한 Issue 단위 프롬프트 계획서.
>
> **중요 원칙**  
> 준비 단계에서는 코드를 구현하거나 기존 구현 코드를 가져오지 않는다. 기존 코드가 존재하면 **구조와 패턴을 분석하여 문서화만** 하고, 실제 기능 코드는 해커톤 현장에서 본 계획서와 기준 문서를 바탕으로 새로 작성한다.

---

## FINAL 반영 사항

이 FINAL Plan에는 다음 팀 검토안이 구현 위치까지 연결된 상태로 포함되어 있다.

```text
1. 동일 Standard의 연계 차시
   → parent_activity_id 기반 단일 선형 Activity Chain

2. Demo Dataset
   → 합성 Roster 20명
   → 학생A~R 18명 사전 Seed/분석
   → 학생S/T 2명 발표 중 실제 INPUT/PROCESS

3. Demo Seed 원칙
   → StructuredInput만 임의 삽입하지 않음
   → Submission + Original Artifact + StructuredInput 실제 계약 충족
   → 가능하면 실제 PROCESS + Teacher Approval까지 사전 완료

4. Branding
   → TRACE Logo Concept 3안은 ISSUE-05 시각 구현 참고자료
   → 최종 1안은 팀이 선택
```

복잡한 prerequisite graph, Activity DAG, 별도 `activity_relations` Table은 MVP에서 만들지 않는다.

---

# 0. 해커톤 개발 원칙

## 0.1 기준 문서

모든 Issue는 다음 세 문서를 공통 기준으로 사용한다.

```text
TRACE_PRD.md
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
```

필요한 Issue에서만 추가 자료를 투입한다.

```text
shared/curriculum/manifest.json
실제 Curriculum JSON
샘플 이미지/PDF
샘플 CSV/XLSX
합성 Student Roster
.env.local
```

---

## 0.2 기존 코드 처리 원칙 — 중요

기존 작업물이 Repository에 있더라도 구현 코드를 그대로 가져오거나 복사하지 않는다.

```text
기존 코드
↓
구조 / 패턴 / 문제점 분석
↓
CODEBASE_ANALYSIS.md
↓
PRD / TRD / Module PRD와 비교
↓
이번 해커톤 구현방식 결정
↓
해커톤 현장에서 코드 신규 작성
```

허용:

```text
- package.json 등 프로젝트 구성 확인
- Framework / Directory 구조 확인
- 기존 DB migration 방식 확인
- Naming / Component pattern 분석
- Organizer가 제공한 Starter / Scaffold 사용
- 분석 결과를 문서화
```

금지:

```text
- 사전 작성한 기능 코드 복사
- 사전 구현 Component를 그대로 이동
- 사전 구현 API Route 복사
- 기존 AI Prompt/Business Logic 코드 재사용
- "기존 코드 조금 수정" 방식으로 완성
```

기존 코드와 유사한 결과가 필요하더라도 **PRD/TRD/Module PRD를 기준으로 새로 구현**한다.

---

## 0.3 모든 Codex 작업에 붙일 공통 Prefix

아래 Prefix를 각 Issue Prompt 앞에 붙인다.

```text
You are implementing one scoped issue of TRACE INPUT during the hackathon.

AUTHORITATIVE DOCUMENTS
Read these before coding:
1. TRACE_PRD.md
2. TRACE_TRD.md
3. TRACE_INPUT_MODULE_PRD.md
4. AGENTS.md if present
5. CODEBASE_ANALYSIS.md if present

IMPORTANT HACKATHON RULE
- Do not copy or restore any pre-hackathon implementation code.
- Existing code may be inspected only to understand repository structure, conventions, dependencies, and integration constraints.
- Implement this issue from the authoritative documents during this session.
- If a pre-existing implementation of the same feature exists, do not reuse its implementation. Report it and create the new implementation according to the current documents.
- Organizer-provided starter/scaffold/configuration may be retained if permitted.

BEFORE CODING
1. Inspect the current repository.
2. Summarize relevant existing structure and integration points.
3. Identify the exact files you plan to create or modify.
4. Confirm that the planned work does not change a shared contract.
5. If the issue requires changing a shared Entity, DB field, enum, route, or security contract, STOP and report the required contract change before coding.

GLOBAL TRACE RULES
- Work inside the existing TRACE Next.js application. Do not create another app.
- Use Next.js + TypeScript + Supabase.
- Reuse the Shared App Shell and shared UI primitives after they exist.
- Do not invent School, StudentAlias, EvaluationContext, Extraction, or AI Rubric entities/features.
- Student is the shared student entity.
- One Student × one ActivityAssignment = one Submission.
- Preserve ORIGINAL Artifacts.
- Store observable responses in submissions.structured_input JSONB.
- INPUT may structure what the student wrote/selected/marked, but must not judge correctness, achievement level, strengths, difficulties, Evidence, feedback, or growth.
- Keep input_status and process_status separate.
- READY_FOR_PROCESS requires:
  Student confirmed
  + ActivityAssignment confirmed
  + Original Artifact Storage success
  + Artifact DB record
  + StructuredInput stored.
- INPUT → PROCESS handoff uses submission_id[] only.
- Use real DB / Storage / AI calls where the issue requires them. Do not fake successful integrations.
- Use synthetic student data only for development/demo.
- Never expose API keys or Supabase Service Role keys to the client.
- Student public routes must not query the roster directly from the browser.
- Do not put student PII into QR payloads, tokens, or Storage object keys.
- External AI calls are server-side and pass through the privacy context boundary.
- Log required security events to audit_logs without student PII, answers, tokens, signed URLs, prompts, or secrets.
- Do not refactor unrelated areas.

AT THE END
Report:
1. Files created/changed
2. DB migrations created/applied
3. Commands run
4. Automated tests run
5. Local/manual tests still required
6. Acceptance criteria passed/failed
7. Remaining risks/TODOs
```

---

# 0.4 테스트 표시 규칙

각 Issue에는 아래 중 하나 이상을 표시한다.

| 표시 | 의미 |
|---|---|
| `AUTO` | typecheck/unit/integration/build 등 자동 테스트 |
| `LOCAL` | localhost에서 사람이 직접 확인 |
| `DEVICE` | 스마트폰/카메라 등 실제 기기 확인 |
| `DB` | Supabase DB/RLS/migration 확인 |
| `STORAGE` | 실제 Storage upload/read 확인 |
| `AI` | 실제 Provider 호출 확인 |
| `SECURITY` | 권한/PII/오용 시나리오 확인 |
| `VISUAL` | PDF/UI 등 시각 결과 확인 |

모든 Issue 종료 시 가능하면:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

를 Repository에서 실제 제공하는 Script에 맞춰 실행한다.

---

# 0.5 Codex 모델 선택 가이드

> **기준일: 2026-08-28**  
> GPT-5.6 계열의 현재 역할을 기준으로 이 계획서의 Issue별 권장 모델을 배정한다.
>
> - **Sol**: 복잡한 추론/코딩, 여러 계약을 동시에 맞춰야 하는 작업, 보안·권한·PII·AI 경계, 복잡한 실패 복구, E2E 검증
> - **Terra**: 일반적인 기능 구현의 기본값. 성능·속도·사용량 균형이 중요한 다중 파일 구현, UI/API/DB 연결, 일반 디버깅
> - **Luna**: 계약과 구현 위치가 이미 명확한 좁고 반복적인 작업. 단순 CRUD, 템플릿 생성 등에서 사용량을 절약할 때 적합
>
> ### Reasoning 사용 원칙
>
> - `medium`: 범위가 작고 계약이 명확한 구현
> - `high`: 여러 파일/계층을 연결하거나 테스트까지 함께 판단해야 하는 구현
> - `max`: 보안·권한·PII·AI 경계, 복잡한 데이터 무결성, E2E처럼 실패 비용이 큰 작업에 한정
>
> ### 공통 승격 규칙
>
> 1. **Luna → Terra**  
>    구현 중 공유 타입/DB/Route/상태 계약 해석이 필요해지거나, 2회 이상 수정해도 테스트가 안정적으로 통과하지 않을 때.
> 2. **Terra → Sol**  
>    여러 모듈의 계약 충돌, 원인 불명 버그, 보안/권한 이슈, 데이터 무결성 문제, AI 출력 불안정이 발생할 때.
> 3. **Sol high → Sol max**  
>    RLS/인증/PII, 잘못된 Student 매칭 가능성, 가짜 성공 방지, 다중 경로 E2E처럼 오류가 데모 또는 데이터 신뢰성을 직접 깨뜨릴 때.
> 4. 모델을 승격하기 전에 현재 Issue의 범위를 넓히지 않는다. 공유 계약 변경이 필요하면 기존 공통 Prefix 규칙대로 **STOP 후 보고**한다.
>
> ### 해커톤 운영 권장
>
> - 평소 기본값은 **Terra**로 둔다.
> - 아래 Issue에서 **Sol**이 지정된 경우 처음부터 Sol을 사용한다.
> - **Luna** 지정 Issue는 계약이 이미 잠겨 있다는 전제에서만 Luna를 사용한다.
> - 구현 완료 후 테스트 실패가 단순 문법/타입 문제가 아니라 설계 판단 문제라면 같은 모델로 반복하기보다 위 승격 규칙을 따른다.

---

# Phase 0 — 코드 작성 전 현장 기준 잠금

## ISSUE-00. Repository Analysis — 코드 수정 금지

### 목표

현재 Repository를 먼저 분석하고, **기존 구현을 복사하지 않고 새 구현을 하기 위한 문서**를 만든다.

### 선행 조건

없음.

### 투입 파일

```text
TRACE_PRD.md
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
현재 Repository
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: high
```

- **선정 이유:** Repository 전체와 여러 기준 문서를 동시에 비교해 재사용 가능 영역/금지 영역/통합 위험을 판단해야 하는 광범위 분석 작업이다.
- **승격/전환 기준:** 기존 코드의 성격이 애매하거나 문서 간 충돌이 발견되면 `Sol max`로 올려 분석만 수행한다.

### Codex Prompt

```text
Do NOT implement any feature in this issue.

Analyze the current TRACE repository only.

Tasks:
1. Identify:
   - framework/version,
   - package manager,
   - directory structure,
   - existing Next.js routing style,
   - Supabase client/server helpers,
   - migration strategy,
   - existing shared UI/layout patterns,
   - testing setup,
   - environment variable conventions,
   - any existing INPUT-like implementation.
2. For any pre-existing functional implementation, mark it as:
   - organizer-provided scaffold,
   - configuration/infrastructure,
   - or pre-hackathon feature implementation.
3. Do not copy, restore, move, or modify pre-hackathon feature implementation.
4. Compare the repository with:
   - TRACE_PRD.md
   - TRACE_TRD.md
   - TRACE_INPUT_MODULE_PRD.md
5. Create CODEBASE_ANALYSIS.md containing:
   - current repository map,
   - reusable scaffold/infrastructure,
   - code that must NOT be reused,
   - missing foundations,
   - integration risks,
   - recommended implementation order.
6. Do not change application source code.

Acceptance:
- CODEBASE_ANALYSIS.md exists.
- No application feature code was added or changed.
- The document clearly separates permissible scaffold/config from prohibited prior feature code.
```

### 테스트

```text
AUTO: 필요 없음
LOCAL: 필요 없음
검증: git diff로 CODEBASE_ANALYSIS.md 외 기능 코드 변경이 없는지 확인
```

### 종료 조건

**코드 작성 없이 분석 문서만 생성.**

---

## ISSUE-01. Hackathon Agent Guide & Repository Contract

### 목표

모든 후속 Agent가 같은 문서와 규칙을 읽도록 `AGENTS.md`를 만든다.

### 선행 조건

```text
ISSUE-00
```

### 투입 파일

```text
TRACE_PRD.md
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
CODEBASE_ANALYSIS.md
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: medium
```

- **선정 이유:** 코드 구현이 아니라 이미 잠긴 규칙을 짧고 정확한 Agent 계약으로 정리하는 작업이다. 다만 이후 모든 Issue에 영향을 주므로 Luna보다 Terra가 안전하다.
- **승격/전환 기준:** 기준 문서 간 우선순위나 계약 충돌을 발견하면 `Sol high`로 승격하고 AGENTS.md 작성 전에 충돌을 보고한다.

### Codex Prompt

```text
Create or update AGENTS.md as a concise navigation and implementation rule file.

It must point developers/agents to:
- TRACE_PRD.md
- TRACE_TRD.md
- TRACE_INPUT_MODULE_PRD.md
- CODEBASE_ANALYSIS.md

Include:
1. document authority rules,
2. INPUT/PROCESS boundary,
3. shared entity/DB/status immutability,
4. security/privacy rules,
5. hackathon rule prohibiting reuse of pre-hackathon feature code,
6. required test/report format after each issue.

Do not duplicate the entire PRD/TRD into AGENTS.md.
Do not implement application functionality.

Acceptance:
- A new agent can identify the authoritative documents and critical rules immediately.
- No application feature code is changed.
```

### 테스트

```text
LOCAL: 없음
검증: AGENTS.md 링크/파일명 확인
```

---

# Phase 1 — Shared Technical Foundation

## ISSUE-02. Database Migration Baseline

### 목표

INPUT에 필요한 최신 DB 계약을 실제 Supabase migration으로 신규 구현한다.

### 선행 조건

```text
ISSUE-00
ISSUE-01
```

### 투입 파일

```text
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
CODEBASE_ANALYSIS.md
```

### 구현 범위

```text
teachers
classes
students
activities
activity_standards
activity_assignments
submissions
artifacts
audit_logs
processing_jobs
```

PROCESS/OUTPUT 테이블이 팀 공통 migration에서 함께 만들어지는 경우 중복 생성하지 않는다.

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: high
```

- **선정 이유:** 공유 DB 계약, 제약조건, 인덱스, migration 전략이 이후 전 모듈의 기반이 되므로 작은 스키마 오해도 파급이 크다.
- **승격/전환 기준:** 기존 schema/migration과 TRD 계약이 충돌하거나 되돌리기/타입 생성까지 복잡해지면 `Sol max`.

### Codex Prompt

```text
Implement the database baseline required by TRACE INPUT according to TRACE_TRD.md.

Before coding:
- inspect the repository's current migration strategy,
- inspect any organizer-provided schema,
- do not copy a pre-hackathon feature migration.

Required INPUT-relevant contracts:
- teachers.auth_user_id
- classes.class_code
- classes.class_code_expires_at
- students unique(class_id, student_number)
- activity_standards relation
- ActivityAssignment with submission_token
- Submission references Student + ActivityAssignment
- submissions.structured_input JSONB
- separate input_status / process_status
- Artifact ORIGINAL / PROCESSED / DERIVED
- Artifact attempt_no, page_start, page_end, source_artifact_id
- audit_logs
- processing_jobs

Add required constraints/indexes.

Do not invent schema fields that are not in TRACE_TRD.md.

Acceptance:
- migrations apply from a clean local/Supabase development database,
- required constraints exist,
- migrations are reversible or follow repository migration convention,
- generated/shared TypeScript DB types are updated if the repository uses them.
```

### 테스트

```text
AUTO: migration validation / typecheck
DB: 필수
LOCAL: 불필요
```

### 로컬 확인

- clean DB에 migration 적용
- 동일 학급 학생번호 중복 insert 실패
- Student + ActivityAssignment 중복 Submission 방지
- `audit_logs`, `processing_jobs` 생성 확인

---

## ISSUE-03. Supabase Auth, RLS & Server Ownership Foundation

### 목표

Google OAuth 및 Teacher 데이터 접근 경계를 실제 구현한다.

### 선행 조건

```text
ISSUE-02
```

### 투입 파일

```text
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
.env.local
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: max
```

- **선정 이유:** OAuth, 세션, RLS, server ownership, cross-teacher 차단, audit까지 한 번에 맞춰야 하는 핵심 보안 경계다.
- **승격/전환 기준:** 기본이 `max`. RLS 우회 가능성이나 ownership 기준이 불명확하면 구현을 계속하지 말고 계약 변경 필요 여부부터 보고한다.

### Codex Prompt

```text
Implement TRACE teacher authentication and authorization foundation.

Requirements:
1. Supabase Auth Google Provider.
2. One UI entry: "Google로 계속하기".
3. OAuth callback/session validation.
4. auth.users.id ↔ teachers.auth_user_id.
5. Create Teacher Profile only when missing.
6. Reuse existing Teacher Profile on later login.
7. Protected teacher routes require a valid session.
8. Implement RLS policies for INPUT-relevant tables.
9. Add server-side ownership helpers that verify resources belong to the current teacher.
10. Client-provided teacher_id must never be trusted as the authorization source.
11. Record LOGIN in audit_logs without storing Google token or sensitive payload.

Do not implement Class/Roster UI in this issue.

Acceptance:
- unauthenticated protected request is rejected,
- teacher A cannot access teacher B resources,
- repeated login does not create duplicate Teacher Profile,
- LOGIN audit event is written.
```

### 테스트

```text
AUTO: auth helper tests if practical
LOCAL: 필수
DB: 필수
SECURITY: 필수
```

### 로컬 테스트

1. 신규 Google 계정 → Teacher Profile 생성
2. 재로그인 → 동일 Profile
3. 로그아웃 후 보호 Route 접근 차단
4. Teacher A Session으로 Teacher B Class API 접근 → 403/차단
5. audit_logs에 LOGIN 존재, token/PII 없음

---

## ISSUE-04. Shared Curriculum Loader

### 목표

INPUT/PROCESS/OUTPUT에서 동일한 Curriculum Data를 읽는 계층을 만든다.

### 선행 조건

```text
ISSUE-01
```

### 투입 파일

```text
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
shared/curriculum/manifest.json
실제 Curriculum JSON
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: high
```

- **선정 이유:** 실제 JSON/manifest를 읽어 타입·runtime validation·검색 API를 연결하는 전형적인 다중 파일 기반 구현이다.
- **승격/전환 기준:** 실제 Curriculum key 구조가 문서와 다르거나 AchievementLevel 계약 해석이 필요하면 `Sol high`.

### Codex Prompt

```text
Implement the shared curriculum loader defined by TRACE_TRD.md.

Tasks:
1. Inspect the actual curriculum files and manifest.
2. Preserve their real keys; do not invent renamed copies.
3. Add TypeScript types and runtime validation.
4. Implement deterministic queries for:
   - grade,
   - subject,
   - domain/unit,
   - standard_id,
   - keyword candidate search.
5. Load AchievementLevel through the same shared loader.
6. Do not store duplicate curriculum source rows in PostgreSQL.
7. Do not send the entire curriculum dataset to AI.

Acceptance:
- real files load successfully,
- invalid data fails clearly,
- Standard and AchievementLevel can be queried by shared IDs.
```

### 테스트

```text
AUTO: 필수
LOCAL: 선택
```

---

## ISSUE-05. Shared App Shell & INPUT Route Skeleton

### 목표

INPUT 화면이 팀 공통 App Shell과 정확한 Route 계약 안에서 개발되도록 기반을 만든다.

### 선행 조건

```text
ISSUE-01
ISSUE-03
```

### 투입 파일

```text
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
CODEBASE_ANALYSIS.md
TRACE_LOGO_CONCEPT_01.png
TRACE_LOGO_CONCEPT_02.png
TRACE_LOGO_CONCEPT_03.png
```

### Branding 참고

세 Logo Concept은 **시각 방향 참고자료**다.

```text
- 팀이 1안을 선택하면 TeacherAppShell / Login / App branding에 적용
- Logo 선택은 Route/Entity/DB 계약을 바꾸지 않는다.
- 선택 전에는 임의로 새 Logo를 다시 만들지 않는다.
- Logo 때문에 Shell 구조를 중복 구현하지 않는다.
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: high
```

- **선정 이유:** Route skeleton, auth 보호, 공통 Shell, 학생 전용 layout, branding을 기존 앱 구조 안에 맞추는 통합 UI 작업이다.
- **승격/전환 기준:** 기존 routing/layout 구조와 TRD가 충돌하거나 shared shell 중복 여부 판단이 어려우면 `Sol high`.

### Codex Prompt

```text
Implement the shared teacher route skeleton required for TRACE INPUT.

Required routes:
- /classes
- /classes/[classId]
- /activities
- /activities/new
- /activities/[activityId]
- /activities/[activityId]/assign
- /results
- /results/add
- /results/upload
- /results/import
- /results/[submissionId]

Student:
- /submit/[token]

Requirements:
1. Teacher routes use the shared TeacherAppShell.
2. /submit/[token] uses a separate mobile-first student layout.
3. Do not create duplicate Sidebar/TopBar components if the shared shell exists.
4. Implement route placeholders/loading/error/empty states only; do not implement feature business logic yet.
5. Preserve the TRD menu names.
6. If the team has selected one provided TRACE logo concept, apply it only to shared branding surfaces.

Acceptance:
- all routes resolve,
- protected teacher routes require auth,
- student route does not render TeacherAppShell,
- selected logo, if provided, is reused consistently rather than duplicated.
```

### 테스트

```text
AUTO: build/typecheck
LOCAL: 필수
VISUAL: 필수
```

---
# Phase 2 — Class & Roster

## ISSUE-06. Class CRUD & Class Code Lifecycle

### 목표

Teacher가 Class를 생성/조회/수정하고 학생 제출용 Class Code를 관리한다.

### 선행 조건

```text
ISSUE-02
ISSUE-03
ISSUE-05
```

### 투입 파일

```text
TRACE_INPUT_MODULE_PRD.md
TRACE_TRD.md
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: high
```

- **선정 이유:** 일반 CRUD이지만 class_code 만료/재발급과 서버 ownership, 실제 DB 재조회가 함께 있어 보통 수준 이상의 통합 판단이 필요하다.
- **승격/전환 기준:** 코드 재발급 경쟁조건이나 권한 문제가 발생하면 `Sol high`.

### Codex Prompt

```text
Implement Class CRUD for TRACE INPUT.

Fields:
- grade
- name
- subject optional
- class_code
- class_code_expires_at

Class Code rules:
- valid for 24 hours from issuance/reissuance,
- teacher can reissue immediately,
- reissuing invalidates the previous code,
- do not put student PII into the code.

Requirements:
1. Apply server ownership checks.
2. Use real DB writes and re-read.
3. Show expiry status in teacher UI.
4. Add clear states for expired/reissued code.

Acceptance:
- create/edit/reload works,
- expiration is calculated correctly,
- old code becomes invalid after reissue,
- another teacher cannot modify the class.
```

### 테스트

```text
AUTO: date/expiry helper tests
LOCAL: 필수
DB: 필수
SECURITY: 필수
```

---

## ISSUE-07. Student Roster Manual CRUD

### 목표

Teacher가 학생 번호/이름을 직접 추가/수정할 수 있게 한다.

### 선행 조건

```text
ISSUE-06
```

### 투입 파일

```text
TRACE_INPUT_MODULE_PRD.md
합성 Student Roster
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Luna
Reasoning: high
```

- **선정 이유:** 필드와 제약이 명확한 좁은 Roster CRUD로, DB/RLS 기반이 이미 완성되어 있다는 전제에서는 반복 구현 성격이 강하다.
- **승격/전환 기준:** ownership/RLS 또는 unique constraint 동작이 예상과 다르면 즉시 `Terra high`로 승격한다.

### Codex Prompt

```text
Implement manual Student roster management for one Class.

Fields:
- student_number
- name
- is_active

Rules:
- student_number required,
- name required,
- duplicate student_number within one Class is rejected,
- teacher can access only students of owned Classes.

Use synthetic demo data only.

Acceptance:
- add/edit/deactivate/reload works,
- duplicate number fails clearly,
- cross-teacher access is blocked.
```

### 테스트

```text
AUTO: validation
LOCAL: 필수
DB: 필수
SECURITY: 필수
```

---

## ISSUE-08. Roster CSV/XLSX Template, Import & Audit

### 목표

표준 명단 파일을 Preview/Validation 후 실제 Roster에 저장한다.

### 선행 조건

```text
ISSUE-07
```

### 투입 파일

```text
TRACE_INPUT_MODULE_PRD.md
정상 Roster XLSX
중복 번호 Roster XLSX
누락 값 Roster CSV
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: high
```

- **선정 이유:** CSV/XLSX 파싱, schema validation, preview, 확정 commit, audit를 연결해야 해 단순 CRUD보다 오류 케이스가 많다.
- **승격/전환 기준:** 엑셀 포맷 변형·부분 실패·DB commit 일관성 문제가 복잡해지면 `Sol high`.

### Codex Prompt

```text
Implement TRACE roster template download and roster import.

Flow:
Class
→ template download
→ CSV/XLSX upload
→ schema validation
→ preview
→ teacher confirm
→ students insert/update
→ ROSTER_IMPORT audit event

Required columns:
- student_number
- student_name

Rules:
- Class is selected in the UI; do not require class identity in every file row.
- empty rows ignored,
- invalid rows visible before save,
- duplicate student numbers blocked,
- valid data must persist after reload,
- audit_logs must not contain student names or spreadsheet contents.

Acceptance:
- valid roster imports,
- invalid rows are explained before commit,
- DB matches confirmed preview,
- ROSTER_IMPORT audit event contains IDs only.
```

### 테스트

```text
AUTO: parser/schema tests
LOCAL: 필수
DB: 필수
SECURITY: 필수
```

---

# Phase 3 — Activity Foundation

## ISSUE-09. Activity CRUD + Standard Relation + Linear Parent Chain

### 목표

AI 없이 Activity를 생성/수정하고 Standard를 연결하며, 연계 차시를 `parent_activity_id` 기반 단일 선형 Chain으로 연결한다.

### 선행 조건

```text
ISSUE-04
ISSUE-05
```

### 투입 파일

```text
TRACE_INPUT_MODULE_PRD.md
TRACE_TRD.md
실제 Curriculum JSON
Demo 연계 차시 정의(사용 시)
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: high
```

- **선정 이유:** Activity, Standard 관계, 상태 전이, ownership, parent_activity_id 선형 체인을 공유 계약을 깨지 않고 구현해야 한다.
- **승격/전환 기준:** 기존 Activity schema와 parent 관계가 충돌하거나 cycle/ownership 처리 범위가 애매하면 `Sol max`.

### Codex Prompt

```text
Implement non-AI Activity CRUD.

Requirements:
1. Structured Activity creation.
2. Optional metadata remains optional.
3. Curriculum Standard search/select through the shared loader.
4. Persist Standard relations using activity_standards, not standard_ids[] inside activities.
5. Save new Activity as DRAFT.
6. Edit and reload.
7. Activate only after teacher confirmation.
8. Generate/use human-readable Activity Code according to the current shared contract if already defined.
9. Do not implement AI Activity generation yet.

LINEAR ACTIVITY CHAIN — MVP
10. Activity may have optional parent_activity_id.
11. parent_activity_id may reference only an Activity owned by the same Teacher.
12. An Activity cannot reference itself as parent.
13. MVP supports at most one direct parent per Activity.
14. Do not create activity_relations or a prerequisite DAG.
15. For the demo learning sequence, link related lessons as:
    1차시 → 2차시 → 3차시 → 4차시.
16. Related demo Activities should share the intended Standard through activity_standards.
17. Activity detail/read must expose the parent Activity relationship.

Acceptance:
- Activity → DB → reload,
- ActivityStandard relation persists,
- DRAFT/ACTIVE transition works,
- no AI Rubric is created,
- Activity B can persist Activity A as parent,
- parent relation survives reload,
- self-parent is rejected,
- cross-teacher parent reference is rejected,
- no new shared relation table is introduced.
```

### 테스트

```text
AUTO: typecheck/validation
LOCAL: 필수
DB: 필수
SECURITY: parent ownership 필수
```

---
## ISSUE-10. ActivityAssignment

### 목표

Activity를 하나 이상의 Class에 배정한다.

### 선행 조건

```text
ISSUE-06
ISSUE-09
```

### 투입 파일

```text
TRACE_INPUT_MODULE_PRD.md
TRACE_TRD.md
Demo Class/Activity Chain 정의(사용 시)
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Luna
Reasoning: high
```

- **선정 이유:** Activity/Class 계약이 이미 존재한 뒤 단순 관계와 상태를 연결하는 비교적 좁은 구현이다.
- **승격/전환 기준:** duplicate assignment, cross-teacher ownership, token 필드 계약이 예상보다 복잡하면 `Terra high`.

### Codex Prompt

```text
Implement ActivityAssignment.

Requirements:
1. Assign an owned Activity to one or more owned Classes.
2. Persist activity_id + class_id relation.
3. Respect OPEN/CLOSED/ARCHIVED status.
4. Prepare fields for submission_token/open_at/due_at.
5. Prevent duplicate activity/class assignment according to DB constraint.
6. Re-read assignment after reload.
7. For the demo, each Activity in the 1→2→3→4 linear chain can be assigned to the same Demo Class without changing the Activity parent relation.

Do not implement QR generation yet.

Acceptance:
- one Activity can be assigned to multiple Classes,
- duplicate assignment is handled,
- cross-teacher assignment is blocked,
- demo chain Activities can each have a valid ActivityAssignment to the Demo Class.
```

### 테스트

```text
LOCAL: 필수
DB: 필수
SECURITY: 필수
```

---
## ISSUE-11. AI Activity Draft

### 목표

자연어/구조화 입력으로 Activity Draft를 실제 AI로 생성한다.

### 선행 조건

```text
ISSUE-04
ISSUE-09
VLM/AI Provider 결정
```

### 투입 파일

```text
TRACE_INPUT_MODULE_PRD.md
실제 Curriculum JSON
.env.local
Activity 생성 예시
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: high
```

- **선정 이유:** 실제 Provider 호출, narrowed curriculum context, 구조화 출력, 서버 비밀 관리, Draft 상태 보존을 동시에 설계해야 하는 AI 경계 작업이다.
- **승격/전환 기준:** Provider 응답 변동이 크거나 adapter/shared AI contract까지 새로 결정해야 하면 `Sol max`.

### Codex Prompt

```text
Implement AI-assisted Activity draft generation.

Before coding, configure the selected provider behind the shared AI adapter boundary.

Input:
- teacher natural language and/or structured metadata,
- narrowed curriculum candidates only.

Output must be structured Activity draft data:
- title,
- description/instructions,
- questions,
- question types,
- Standard candidates,
- print layout data if required by the current schema.

Security:
- server-side provider call only,
- no secrets in client,
- do not send teacher email or unrelated Class/Student data,
- do not send the full curriculum dataset.

Rules:
- result remains DRAFT,
- teacher must review before ACTIVE,
- do not generate AchievementLevel definitions or AI Rubric.

Acceptance:
- real provider produces editable structured draft,
- invalid provider response fails visibly,
- no hard-coded draft is used as success.
```

### 테스트

```text
AUTO: schema validation
LOCAL: 필수
AI: 필수
SECURITY: 필수
```

---

## ISSUE-12. Activity Direct Edit & AI Partial Revision

### 목표

직접 수정과 선택 부분 AI 수정을 지원한다.

### 선행 조건

```text
ISSUE-11
```

### 투입 파일

```text
TRACE_INPUT_MODULE_PRD.md
Activity Draft 샘플
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: high
```

- **선정 이유:** 기존 Draft 모델 위에서 직접 편집과 선택 영역 AI 수정만 제한적으로 구현하는 작업으로 범위가 비교적 명확하다.
- **승격/전환 기준:** 부분 수정이 다른 필드를 오염시키거나 AI patch/merge 전략이 불안정하면 `Sol high`.

### Codex Prompt

```text
Implement Activity draft editing.

Direct edit:
- edit question text,
- add/delete/reorder questions,
- edit instructions.

AI partial revision:
- revise only the selected question or instruction,
- preserve unrelated fields,
- return structured output,
- teacher reviews before save.

Do not build a freeform Canva-like editor.

Acceptance:
- direct edits persist,
- partial AI revision does not rewrite unrelated questions,
- failed AI revision preserves the current draft.
```

### 테스트

```text
LOCAL: 필수
AI: 필수
```

---

## ISSUE-13. Printable Activity PDF

### 목표

승인된 Activity를 A4 PDF로 생성한다.

### 선행 조건

```text
ISSUE-12
PDF Library 결정
```

### 투입 파일

```text
TRACE_INPUT_MODULE_PRD.md
한글 Activity 샘플
목표 A4 샘플
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: high
```

- **선정 이유:** A4 PDF, 한글 렌더링, Storage artifact, 실패 독립성을 함께 맞추는 구현·시각 검증 작업이다.
- **승격/전환 기준:** PDF 라이브러리/서버 런타임/폰트 처리 충돌로 구조적 변경이 필요하면 `Sol high`.

### Codex Prompt

```text
Implement printable A4 PDF generation from approved Activity data.

Requirements:
- Korean text renders correctly,
- questions/writing areas are not clipped,
- Activity remains valid if PDF generation fails,
- clear progress/error state,
- generated artifact follows the approved Storage pattern,
- no student PII is involved.

Generate at least three different Activity shapes for verification.

Acceptance:
- PDFs open and print correctly,
- failure does not roll back Activity.
```

### 테스트

```text
AUTO: generation smoke test
LOCAL: 필수
VISUAL: 필수
```

---

# Phase 4 — Submission & Storage Foundation

## ISSUE-14. Submission Foundation

### 목표

`Student × ActivityAssignment`를 Submission으로 연결한다.

### 선행 조건

```text
ISSUE-07
ISSUE-10
```

### 투입 파일

```text
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
합성 Student/Class/Activity 데이터
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: high
```

- **선정 이유:** Student × ActivityAssignment = one Submission 불변식과 idempotency, 상태 독립성이 이후 모든 입력 경로의 핵심 데이터 계약이다.
- **승격/전환 기준:** 동시 요청/중복 생성 방지 방식이 DB와 애플리케이션 사이에서 충돌하면 `Sol max`.

### Codex Prompt

```text
Implement the TRACE INPUT Submission lifecycle.

Invariant:
One Student × one ActivityAssignment = one Submission.

Requirements:
1. create or retrieve the unique Submission,
2. keep input_status and process_status separate,
3. structured_input is JSONB,
4. current_attempt_no follows the DB contract,
5. one Submission may later own multiple Artifacts,
6. do not create educational analysis fields.

Acceptance:
- duplicate requests do not create duplicate logical Submissions,
- reload preserves the relation,
- status fields remain independent.
```

### 테스트

```text
AUTO: idempotency/constraint tests
LOCAL: 선택
DB: 필수
```

---

## ISSUE-15. Private Storage & Teacher Artifact Upload

### 목표

Teacher 이미지/PDF 원본을 Private Storage에 실제 저장한다.

### 선행 조건

```text
ISSUE-14
```

### 투입 파일

```text
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
합성 JPG/PNG/PDF 샘플
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: high
```

- **선정 이유:** Private Storage, signed URL, ownership, UUID key, audit, 실패 시 DB 일관성까지 포함하는 보안·저장소 경계다.
- **승격/전환 기준:** Storage 정책/RLS/서버 권한 또는 부분 실패 보상 로직이 꼬이면 `Sol max`.

### Codex Prompt

```text
Implement teacher Artifact upload for a known ActivityAssignment.

Security/storage requirements:
- private Supabase Storage,
- permanent public URL prohibited,
- UUID-based object key,
- student name/number/original filename not used in object key,
- signed URL issued only after server ownership check,
- do not log signed URLs,
- ARTIFACT_UPLOAD audit event with IDs only.

File limits:
- image <= 10 MB/file,
- PDF <= 30 MB/file,
- PDF <= 100 pages,
- batch images <= 100 files.

Flow:
upload original
→ Storage success
→ Artifact DB record
→ attach to Submission
→ reload/read

Do not run VLM in this issue.

Acceptance:
- real upload/storage/DB/re-read works,
- failed storage write does not create successful Artifact record,
- forbidden file size/type shows a clear error,
- original stays immutable.
```

### 테스트

```text
AUTO: file validation tests
LOCAL: 필수
DB: 필수
STORAGE: 필수
SECURITY: 필수
```

---

## ISSUE-16. Image Preprocessing & EXIF Removal

### 목표

원본을 보존하면서 AI용 Processed Artifact를 만든다.

### 선행 조건

```text
ISSUE-15
```

### 투입 파일

```text
TRACE_INPUT_MODULE_PRD.md
회전/어두움/밝음 이미지 샘플
EXIF 포함 합성 이미지
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: high
```

- **선정 이유:** 원본 불변성을 지키면서 이미지 처리와 metadata 제거, 파생 Artifact 연결을 구현하는 전문적이지만 범위가 명확한 작업이다.
- **승격/전환 기준:** 런타임별 이미지 라이브러리 제약이나 EXIF 제거 보장이 불명확하면 `Sol high`.

### Codex Prompt

```text
Implement server-side image preprocessing.

Requirements:
- never overwrite ORIGINAL,
- generate PROCESSED Artifact linked by source_artifact_id,
- support resize, rotation, brightness, contrast, compression/normalization,
- remove EXIF/location metadata where supported,
- preprocessing failure preserves ORIGINAL,
- processed Storage object key remains UUID-based.

Do not perform educational analysis.

Acceptance:
- ORIGINAL and PROCESSED are separately retrievable,
- source relationship is preserved,
- EXIF is removed from the processed sample where technically supported.
```

### 테스트

```text
AUTO: metadata/file checks
LOCAL: 선택
STORAGE: 필수
```

---

# Phase 5 — Student Public Submission

## ISSUE-17. Submission Token & QR

### 목표

ActivityAssignment용 Public Submission Token과 QR을 구현한다.

### 선행 조건

```text
ISSUE-10
```

### 투입 파일

```text
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: medium
```

- **선정 이유:** opaque token 생성과 QR 렌더링 자체는 단순하지만 공개 Route와 PII 금지, Assignment 상태 검증이 있어 Terra가 적절하다.
- **승격/전환 기준:** token lifecycle/entropy/재발급 정책이 공유 계약과 충돌하면 `Sol high`.

### Codex Prompt

```text
Implement the public submission token and QR for an ActivityAssignment.

Requirements:
- opaque random submission_token,
- QR resolves /submit/[token],
- token identifies ActivityAssignment, never Student,
- QR/token contains no:
  student name,
  student number,
  student id,
  teacher email,
- CLOSED/ARCHIVED Assignment is rejected,
- render QR in teacher ActivityAssignment UI.

Acceptance:
- scan opens correct Assignment,
- payload has no PII,
- closed Assignment cannot be used.
```

### 테스트

```text
LOCAL: 필수
DEVICE: 권장
SECURITY: 필수
```

---

## ISSUE-18. Public Student Verification API

### 목표

학생 Browser가 Roster를 직접 조회하지 않고 서버에서 본인 확인한다.

### 선행 조건

```text
ISSUE-06
ISSUE-07
ISSUE-17
```

### 투입 파일

```text
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
합성 Student Roster
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: max
```

- **선정 이유:** 공개 학생 검증 API에서 roster enumeration, uniform error, rate limit, Class Code 만료를 모두 안전하게 처리해야 하는 공격 표면이 큰 보안 Issue다.
- **승격/전환 기준:** 기본이 `max`. rate-limit 저장 방식이나 공개 API 권한 경계가 불명확하면 구현보다 보안 계약 검토를 우선한다.

### Codex Prompt

```text
Implement the public student verification boundary.

Client sends:
- submission_token
- class_code
- student_number
- student_name

Server validates:
1. token → ActivityAssignment
2. Assignment is OPEN
3. Class Code is current and not expired
4. Number + Name exact match within that Class

Security:
- Student browser must not SELECT from students directly.
- Return one uniform failure message:
  "입력한 정보가 학급 정보와 일치하지 않습니다."
- Never reveal whether number or name was correct.
- Do not return roster contents.
- Do not create a Submission before successful verification.

Rate limit:
same IP + submission_token
10 failed attempts within 5 minutes
→ block for 10 minutes.

Acceptance:
- valid combination passes,
- invalid combinations fail identically,
- expired/reissued class code fails,
- roster enumeration is not possible through detailed error responses.
```

### 테스트

```text
AUTO: validation/rate-limit tests
LOCAL: 필수
SECURITY: 필수
```

### 로컬 보안 테스트

- 틀린 번호
- 맞는 번호 + 틀린 이름
- 틀린 Class Code
- 만료 Code
- 재발급 전 Code
- 10회 반복 실패
- 다른 Student 정보 응답에 포함되지 않는지 Network 확인

---

## ISSUE-19. Student Mobile Multi-photo Capture

### 목표

검증 완료 학생이 여러 페이지를 촬영/미리보기/재촬영 후 제출한다.

### 선행 조건

```text
ISSUE-18
ISSUE-14
ISSUE-15
```

### 투입 파일

```text
TRACE_INPUT_MODULE_PRD.md
2~3페이지 합성 활동지
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: high
```

- **선정 이유:** 모바일 다중 파일 UX, 부분 실패 복구, Storage, Submission 연결을 한 흐름으로 맞추는 전형적인 복합 기능 구현이다.
- **승격/전환 기준:** 업로드 재시도/중복 Artifact/모바일 브라우저 차이로 상태 머신이 복잡해지면 `Sol high`.

### Codex Prompt

```text
Implement the student mobile capture flow after successful server verification.

Features:
- camera/file selection,
- preview,
- retake/remove,
- add another page,
- multiple images in one Submission,
- per-file and overall upload progress,
- recoverable partial failure,
- completion confirmation.

Security:
- student route cannot browse other Submissions,
- use UUID object keys,
- no PII in URLs/object keys,
- enforce image file size limit.

Do not call VLM yet.

Acceptance:
- multiple Artifact upload works,
- successful pages survive a later failed page,
- page is usable on a mobile viewport.
```

### 테스트

```text
LOCAL: 필수
DEVICE: 필수 권장
STORAGE: 필수
SECURITY: 필수
```

---

## ISSUE-20. Student Capture Quality Warning

### 목표

촬영 전에 지나치게 나쁜 품질을 경고한다.

### 선행 조건

```text
ISSUE-19
```

### 투입 파일

```text
정상 이미지
과노출 이미지
저노출 이미지
흐림 이미지
기울어진 이미지
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: high
```

- **선정 이유:** 밝기·흐림·기울기 heuristic을 실용 수준으로 조정하고 차단이 아닌 경고 UX로 연결하는 구현이다.
- **승격/전환 기준:** 샘플에 맞는 임계값 설계가 반복 실패하거나 client/server 처리 선택이 복잡하면 `Sol high`.

### Codex Prompt

```text
Implement pragmatic pre-submit image quality warnings.

Check where practical:
- overexposure,
- underexposure,
- obvious blur,
- extreme skew/rotation.

Behavior:
- warning, not final educational judgment,
- allow retake,
- allow "그래도 제출",
- thresholds configurable,
- no silent rejection solely from heuristic quality scoring.

Acceptance:
- bad synthetic samples usually warn,
- normal samples are not constantly blocked.
```

### 테스트

```text
AUTO: heuristic tests where practical
LOCAL: 필수
DEVICE: 권장
```

---

# Phase 6 — Spreadsheet Student Results

## ISSUE-21. Student Result Spreadsheet Template

### 목표

선택한 ActivityAssignment 기준 결과 Import 표준 양식을 만든다.

### 선행 조건

```text
ISSUE-10
ISSUE-14
```

### 투입 파일

```text
TRACE_INPUT_MODULE_PRD.md
합성 Roster
샘플 Activity
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Luna
Reasoning: high
```

- **선정 이유:** Activity 질문 구조를 표준 CSV/XLSX 템플릿으로 변환하는 비교적 기계적 작업이며 round-trip 테스트 기준도 명확하다.
- **승격/전환 기준:** question type별 column serialization 규칙이 불명확하거나 import와 계약 충돌이 나면 `Terra high`.

### Codex Prompt

```text
Implement the TRACE student-result spreadsheet template download.

The selected ActivityAssignment is already known.

Template includes:
- student_number
- student_name
- question columns derived from the Activity.

Do not require class name in each row because Class is already determined by ActivityAssignment.

Respect:
- CSV/XLSX <= 10 MB for import.

Acceptance:
- generated template downloads,
- an unchanged valid template can be parsed by the import implementation.
```

### 테스트

```text
AUTO: template/parser round-trip
LOCAL: 필수
```

---

## ISSUE-22. Spreadsheet Import, Preview & Commit

### 목표

표준 결과 파일을 검증해 Submission + StructuredInput으로 저장한다.

### 선행 조건

```text
ISSUE-21
ISSUE-14
```

### 투입 파일

```text
정상 CSV/XLSX
잘못된 Header 샘플
Roster 불일치 샘플
10MB 초과 샘플 또는 생성 스크립트
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: high
```

- **선정 이유:** 파일 검증→파싱→Roster match→Preview→확정 DB commit의 여러 단계를 연결하고 row-level 오류를 보존해야 한다.
- **승격/전환 기준:** 부분 commit/idempotency/StructuredInput 변환 규칙에서 충돌이 생기면 `Sol high`.

### Codex Prompt

```text
Implement TRACE standard student-result spreadsheet import.

Flow:
ActivityAssignment selected
→ upload
→ file-size validation
→ schema validation
→ parse
→ roster match by number + name
→ preview
→ teacher confirm
→ Submission + structured_input save

Requirements:
- valid rows and invalid rows clearly separated,
- no arbitrary header mapping,
- do not silently create unknown Students,
- structured_input uses the shared envelope,
- preserve row-level errors,
- real DB commit after confirmation only.

Acceptance:
- valid file imports,
- invalid header fails clearly,
- roster mismatch is visible before commit,
- persisted structured_input survives reload.
```

### 테스트

```text
AUTO: parser/schema
LOCAL: 필수
DB: 필수
```

---

# Phase 7 — StructuredInput & AI Privacy Boundary

## ISSUE-23. StructuredInput Runtime Schema

### 목표

확정된 공통 Envelope를 Zod/runtime schema로 구현한다.

### 선행 조건

```text
ISSUE-02
```

### 투입 파일

```text
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
응답 유형 샘플 JSON
TRACE_DEMO_ACTIVITY_DEFINITION.json 또는 동등한 Demo Question Structure Reference
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: high
```

- **선정 이유:** StructuredInput은 INPUT→PROCESS 공유 계약의 핵심이며 금지 필드까지 명확히 차단해야 하므로 schema 실수가 광범위하게 전파될 수 있다.
- **승격/전환 기준:** 샘플 response type이 공통 envelope와 충돌하거나 schema 확장이 필요하면 `Sol max`로 검토 후 계약 변경 여부를 보고한다.

### Codex Prompt

```text
Implement the runtime schema for submissions.structured_input.

Fixed shared envelope:
{
  "schema_version": "1",
  "questions": [
    {
      "question_id": "...",
      "response_type": "...",
      "response": {}
    }
  ]
}

Required:
- question_id
- response_type
- response

Support practical response types required by current samples:
- short_text
- long_text
- selection
- checkbox
- matching
- underline
- circle
- drawing_or_mark
- blank
- unknown

The response object may vary by response_type.

Use the provided Demo Activity Question Structure as a validation/reference fixture, not as hard-coded app output.

Do NOT include:
- correctness
- achievement level
- strengths
- difficulties
- Evidence
- feedback
- growth

Use Zod or the repository's runtime validation standard.

Acceptance:
- valid sample response shapes pass,
- invalid envelope fails before DB write,
- demo expected StructuredInput references validate without changing the shared envelope.
```

### 테스트

```text
AUTO: 필수
LOCAL: 불필요
```

---
## ISSUE-24. VLM Adapter + Privacy Context Builder

### 목표

Provider를 Feature 코드에서 분리하고 AI에 PII가 넘어가지 않게 한다.

### 선행 조건

```text
ISSUE-03
VLM Provider 결정
```

### 투입 파일

```text
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
.env.local
합성 Artifact
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: max
```

- **선정 이유:** AI/VLM Provider 추상화와 PII 제거 Privacy Context Builder는 외부 AI 경계의 핵심 보안 설계다.
- **승격/전환 기준:** 기본이 `max`. permanent identifier 필요성, provider metadata, logging 범위가 애매하면 보수적으로 차단하고 계약을 확인한다.

### Codex Prompt

```text
Implement the TRACE server-side AI/VLM adapter and privacy context builder.

Architecture:
Client
→ TRACE Server
→ Privacy Context Builder
→ AI/VLM Adapter
→ Provider

Privacy Context Builder must exclude by default:
- student name
- student number
- teacher email
- Google account data
- full roster
- other students
- unnecessary Class display names
- permanent student identifier unless strictly required

Provider:
- configured through environment variables,
- no secret in browser,
- normalized success/error metadata,
- provider/model selectable through configuration.

Important:
- Hackathon uses synthetic student artifacts only.
- Automatic image PII redaction is Production Gate, not this issue.

Acceptance:
- client never receives provider secret,
- test request context contains no prohibited identity fields,
- one real provider request succeeds when credentials exist.
```

### 테스트

```text
AUTO: privacy-context unit test 필수
LOCAL: 필수
AI: 필수
SECURITY: 필수
```

---

## ISSUE-25. Observable Response Extraction

### 목표

학생 학습지에서 “무엇을 썼거나 표시했는지”를 StructuredInput으로 저장한다.

### 선행 조건

```text
ISSUE-16
ISSUE-23
ISSUE-24
```

### 투입 파일

```text
합성 학생 작성 이미지 5종 이상
다페이지 합성 자료
expected structured_input JSON
TRACE_DEMO_ACTIVITY_DEFINITION.json
학생S/T 합성 실시간 시연 Artifact
학생S/T expected StructuredInput Reference
실제 Curriculum JSON (Activity context에 필요한 경우)
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: max
```

- **선정 이유:** 이미지→실제 VLM→관찰 응답 추출→schema 검증→retry→status 전이를 정확히 구현해야 하며 교육적 판단을 섞으면 안 되는 핵심 AI 파이프라인이다.
- **승격/전환 기준:** 기본이 `max`. 실제 샘플에서 hallucination/형식 실패/다페이지 참조 문제가 발생하면 prompt만 반복 수정하지 말고 adapter·schema·status 경계를 함께 재검토한다.

### Codex Prompt

```text
Implement observable student response extraction.

Input:
- one Submission,
- one or more ORIGINAL/PROCESSED Artifacts,
- known Activity context when available.

Output:
- validated StructuredInput envelope,
- observable responses only,
- artifact/page references where supported.

Rules:
- extract visible text/selections/marks,
- never judge correctness,
- never create achievement level, Evidence, strengths, difficulties, feedback, or growth,
- represent uncertainty instead of inventing content,
- real provider call,
- validate provider JSON before DB write,
- retry once on provider/schema failure,
- after second failure set input_status = REVIEW_PENDING,
- preserve ORIGINAL.

DEMO VERIFICATION
- Use Student S/T synthetic handwritten artifacts as live-path verification samples.
- Compare actual extraction to expected StructuredInput reference.
- Expected JSON is a test oracle/reference only; never return it as a hard-coded successful extraction.
- Report meaningful discrepancies and ambiguous handwriting.

READY_FOR_PROCESS must not be set until every required condition is true.

Acceptance:
- synthetic real image → real provider → validated DB JSONB,
- reload shows persisted StructuredInput,
- failure produces REVIEW_PENDING rather than fake success,
- S/T reference comparison can be documented without bypassing VLM extraction.
```

### 테스트

```text
AUTO: schema/status tests
LOCAL: 필수
AI: 필수
DB: 필수
STORAGE: 필수
```

---
# Phase 7A — Demo Dataset Preparation

## ISSUE-25A. Demo Fixture/Seed — 18 Preloaded + 2 Live

### 목표

실제 Shared Contract를 만족하는 20명 Demo Class를 준비한다.

```text
학생A~R 18명
→ 사전 Submission/Artifact/StructuredInput 준비

학생S/T 2명
→ 시연 전 미제출 상태 유지
→ 발표 중 실제 INPUT
```

### 선행 조건

```text
ISSUE-07/08
ISSUE-09
ISSUE-10
ISSUE-14
ISSUE-15
ISSUE-23
ISSUE-25
```

### 투입 파일

```text
TRACE_DEMO_ROSTER_20.xlsx
TRACE_DEMO_ACTIVITY_DEFINITION.json
학생A~R 합성 응답 설계/Fixture
학생A~R synthetic Original Artifact
학생S/T live-demo Artifact
학생S/T expected StructuredInput Reference
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: high
```

- **선정 이유:** 이미 확정된 Shared Contract를 이용해 18명 preload + 2명 live 상태를 재현 가능하게 seed하는 통합·반복 작업이다.
- **승격/전환 기준:** 실제 PROCESS 결과까지 seed 절차에 연결하면서 shared 상태가 어긋나면 `Sol high`.

### Codex Prompt

```text
Prepare the TRACE hackathon Demo Dataset using real shared contracts.

DEMO CLASS
- one synthetic Class,
- 20 synthetic Students A~T,
- one demo ActivityAssignment for the live-demo Activity.

PRELOAD GROUP
- Students A~R = 18 Students.
- Each preloaded Student must have a valid Submission for the demo ActivityAssignment.
- Each Submission must have:
  Student confirmed
  + ActivityAssignment confirmed
  + synthetic ORIGINAL Artifact stored in private Storage
  + Artifact DB record
  + valid StructuredInput persisted.
- READY_FOR_PROCESS may be used only when all required conditions are actually satisfied.

LIVE GROUP
- Students S/T must exist in the Roster.
- Before the demo they must NOT have a Submission for the live-demo ActivityAssignment.
- Their artifacts are used during the presentation through the actual INPUT path.

SYNTHETIC RESPONSE DESIGN
- Do not make all 18 students identical.
- Use plausible variation that can produce a readable class-level pattern.
- Keep StructuredInput observational only.
- Do not put correctness/achievement/Evidence/growth into StructuredInput.

PROCESS
- Do not hard-code fake APPROVED analyses.
- If PROCESS is available, run the real PROCESS pipeline for A~R and complete Teacher Review before final rehearsal.
- If PROCESS is not available yet, stop A~R at valid READY_FOR_PROCESS and document the remaining prerequisite.

SECURITY
- synthetic student data only,
- private Storage,
- no PII in object keys,
- no fake success.

Deliver:
- reproducible seed/setup command or documented procedure,
- exact IDs created,
- verification that A~R are submitted and S/T are missing,
- cleanup/reset instructions for rehearsal.
```

### Acceptance

```text
[ ] Roster = 20
[ ] A~R Submission = 18
[ ] S/T Submission = 0 before demo
[ ] each A~R Submission satisfies READY_FOR_PROCESS prerequisites
[ ] each A~R has a traceable ORIGINAL Artifact
[ ] /results can calculate 18/20 from actual DB state
[ ] reset/rehearsal procedure is documented
```

### 테스트

```text
LOCAL: 필수
DB: 필수
STORAGE: 필수
AI: PROCESS 수행 시 필수
SECURITY: 필수
```

---

# Phase 8 — Existing Material Classification

## ISSUE-26. Unassigned Material Metadata Classification

### 목표

Activity 미확정 Teacher Upload에서만 Curriculum 후보를 만든다.

### 선행 조건

```text
ISSUE-04
ISSUE-15
ISSUE-24
```

### 투입 파일

```text
실제 Curriculum JSON
합성 기존 활동지 이미지/PDF
예상 Metadata 메모
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: high
```

- **선정 이유:** 문서 metadata 추출, deterministic curriculum 후보 검색, 선택적 AI ranking을 조합하면서 이미 Activity가 확정된 경로는 우회해야 한다.
- **승격/전환 기준:** AI와 deterministic 후보가 지속적으로 충돌하거나 curriculum narrowing 전략이 불안정하면 `Sol max`.

### Codex Prompt

```text
Implement classification only for teacher-uploaded material with no confirmed Activity.

Flow:
Artifact
→ privacy-safe AI context
→ document metadata candidates
→ deterministic curriculum candidate search
→ optional AI ranking over narrowed candidates
→ teacher confirmation

Metadata candidates may include:
- grade
- subject
- domain
- unit
- activity_type
- title_candidate
- keywords
- standard candidates

Rules:
- do not run when Activity is already known from QR, Activity upload context, or spreadsheet import,
- do not send the full curriculum dataset to AI,
- do not auto-activate/create final Activity without teacher confirmation.

Acceptance:
- unassigned sample receives reasonable candidates,
- assigned paths bypass classification.
```

### 테스트

```text
LOCAL: 필수
AI: 필수
```

---

## ISSUE-27. Existing Activity Candidate Matching

### 목표

기존 Activity와 동일/유사한 자료가 중복 Activity가 되지 않게 후보를 보여준다.

### 선행 조건

```text
ISSUE-09
ISSUE-26
```

### 투입 파일

```text
기존 Activity 합성 세트
동일/유사/무관 자료 샘플
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: high
```

- **선정 이유:** 기존 metadata/DB를 이용한 deterministic 후보 매칭과 교사 확인 UI가 중심이며 자동 확정을 하지 않는 범위가 명확하다.
- **승격/전환 기준:** 점수 규칙이 실제 샘플에서 오탐을 많이 만들거나 assignment context 우선순위가 애매하면 `Sol high`.

### Codex Prompt

```text
Implement existing Activity candidate matching.

Use deterministic DB/metadata matching first.

Candidate signals:
- grade,
- subject,
- domain/unit,
- standards,
- normalized title/type,
- assignment context.

UI:
- candidate list,
- "기존 활동에 연결",
- "새 활동으로 만들기".

Do not silently merge or auto-confirm.

Acceptance:
- clearly matching sample suggests existing Activity,
- unrelated material is not forced into a match,
- teacher makes the final decision.
```

### 테스트

```text
AUTO: candidate scoring where possible
LOCAL: 필수
```

---

# Phase 9 — Teacher Batch PDF

## ISSUE-28. Batch PDF Page Inspection

### 목표

원본 PDF 한 개를 보존하면서 Page Range 기반으로 처리한다.

### 선행 조건

```text
ISSUE-15
```

### 투입 파일

```text
10~20페이지 합성 Batch PDF
1/2/3페이지 Student 자료가 섞인 PDF
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: high
```

- **선정 이유:** 원본 PDF 보존, page count/rendering, page range reference를 Storage/Artifact 계약에 맞춰 구현하는 전문적이지만 제한된 작업이다.
- **승격/전환 기준:** PDF runtime/library와 page-range Artifact 계약이 충돌하면 `Sol high`.

### Codex Prompt

```text
Implement batch PDF inspection.

File limits:
- <= 30 MB,
- <= 100 pages.

Requirements:
- preserve one ORIGINAL PDF,
- calculate page count,
- provide page rendering/reference for downstream processing,
- represent page_start/page_end on Artifact records,
- do not duplicate the entire PDF per Student.

Acceptance:
- original remains one source object,
- individual page/page-range references can be revisited.
```

### 테스트

```text
AUTO: page count/range
LOCAL: 필수
STORAGE: 필수
```

---

## ISSUE-29. Batch Student Identity Matching

### 목표

스캔 순서가 아닌 이름/번호 기준으로 Roster Matching한다.

### 선행 조건

```text
ISSUE-07
ISSUE-24
ISSUE-28
ISSUE-14
```

### 투입 파일

```text
합성 Roster
이름/번호 선명한 Batch PDF
흐린 이름 샘플
번호/이름 누락 샘플
순서가 섞인 PDF
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: max
```

- **선정 이유:** Batch PDF에서 학생 신원을 잘못 연결하면 데이터 오염이 발생하므로 privacy-safe AI, roster matching, ambiguity 처리, Submission 연결을 매우 보수적으로 설계해야 한다.
- **승격/전환 기준:** 기본이 `max`. 애매한 identity를 자동 연결해야만 통과하는 설계는 하지 말고 REVIEW_PENDING으로 보낸다.

### Codex Prompt

```text
Implement batch student matching for teacher-uploaded PDFs.

Rules:
- never assume scan order equals student number,
- extract visible number/name only for matching,
- compare against known Class roster server-side,
- exact match may auto-connect,
- ambiguity/missing identity → REVIEW_PENDING,
- do not send the full roster to the external AI provider,
- use the privacy context boundary.

Create/attach the correct Student × ActivityAssignment Submission.
Preserve page references.

Acceptance:
- shuffled order matches correctly,
- ambiguous identity never silently attaches to the wrong Student,
- batch summary reports matched/review-pending/failed.
```

### 테스트

```text
LOCAL: 필수
AI: 필수
DB: 필수
SECURITY: 필수
```

---

## ISSUE-30. Batch Multi-page Grouping & Manual Correction

### 목표

한 학생 여러 페이지를 같은 Submission으로 묶되 불확실하면 교사가 고친다.

### 선행 조건

```text
ISSUE-29
```

### 투입 파일

```text
1/2/3페이지 혼합 Batch PDF
첫 페이지만 이름이 있는 샘플
페이지마다 이름이 있는 샘플
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: high
```

- **선정 이유:** 다페이지 grouping heuristic과 수동 correction을 실제 샘플에 맞추되 학생 순서 가정을 금지해야 하는 추론 중심 작업이다.
- **승격/전환 기준:** 샘플별 규칙이 서로 충돌하거나 잘못된 자동 grouping 위험이 높으면 `Sol max`.

### Codex Prompt

```text
Implement pragmatic batch page grouping.

Requirements:
- use identity evidence and page context,
- do not rely on student-number sequence,
- uncertain grouping → REVIEW_PENDING,
- teacher can manually correct page grouping,
- ORIGINAL PDF remains immutable,
- use page_start/page_end or approved Artifact references.

Before implementing the heuristic:
1. inspect the supplied samples,
2. summarize the simplest rule that can pass the hackathon samples,
3. implement only after that short plan.

Acceptance:
- known samples group correctly,
- uncertainty is surfaced rather than guessed,
- teacher correction persists.
```

### 테스트

```text
AUTO: known sample grouping
LOCAL: 필수
```

---

# Phase 10 — Learning Results & Review

## ISSUE-31. Activity-centered Learning Results

### 목표

`/results`에서 Activity 중심으로 실제 Submission 상태를 조회한다.

### 선행 조건

```text
ISSUE-14
주요 Input Path 중 하나 이상
```

### 투입 파일

```text
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
합성 Activity/Submission 데이터
20명 Demo Roster + 18명 Preloaded 상태
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: high
```

- **선정 이유:** 여러 상태와 필터를 실제 DB query로 집계하고 18/20→20/20이 하드코딩 없이 바뀌게 만드는 데이터/UI 통합 작업이다.
- **승격/전환 기준:** count query가 RLS/Submission 존재 규칙과 충돌하거나 성능·정합성 문제가 생기면 `Sol high`.

### Codex Prompt

```text
Implement /results as the Activity-centered learning-results page.

Use persisted DB data.

Filters:
- Class
- Subject
- Standard
- Student
- Input Status
- Process Status
- Period where supported by the current query model.

Tabs:
- 전체
- 검토 대기
- 분석 준비
- 분석 중
- 승인 완료

Activity summary:
- submitted / total
- missing
- review pending
- ready for process
- approved

Clicking an Activity:
Activity
→ Student Submissions
→ Artifact/detail.

DEMO STATE
- With the 20-student Demo Roster and A~R preloaded, show 18/20 from actual DB state.
- Missing students must be S/T before the live demo.
- After S/T real INPUT completes, the same query must become 20/20 without hard-coded counts.

Do not default to a raw file-manager view.
Do not hard-code demo counts.

Acceptance:
- counts survive reload and reflect DB,
- missing = Class roster - Submission existence,
- demo precondition shows 18/20 from persisted data,
- after S/T submission the page can show 20/20 from persisted data.
```

### 테스트

```text
AUTO: count/query tests
LOCAL: 필수
DB: 필수
```

---
## ISSUE-32. Review Pending Resolution

### 목표

불확실한 항목만 Teacher가 빠르게 해결한다.

### 선행 조건

```text
ISSUE-25
ISSUE-27
ISSUE-29
ISSUE-31
```

### 투입 파일

```text
Student mismatch 샘플
Activity candidate 샘플
StructuredInput failure 샘플
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: high
```

- **선정 이유:** Student match, Activity match, StructuredInput, batch grouping 등 서로 다른 REVIEW_PENDING 원인을 하나의 복구 흐름에서 해결하고 READY_FOR_PROCESS를 재평가해야 한다.
- **승격/전환 기준:** 복수 blocker가 동시에 존재할 때 상태 전이가 꼬이거나 잘못 READY가 되면 `Sol max`.

### Codex Prompt

```text
Implement /results?inputStatus=REVIEW_PENDING workflow.

Support:
- resolve Student match,
- resolve Activity match,
- view ORIGINAL Artifact,
- edit observable StructuredInput,
- retry processing,
- correct batch page grouping where relevant.

After each resolution, re-evaluate the exact READY_FOR_PROCESS contract.

Do not require successful submissions to receive redundant approval.

Acceptance:
- fixing the blocker updates input_status,
- ORIGINAL remains accessible,
- READY_FOR_PROCESS appears only when all requirements are satisfied.
```

### 테스트

```text
LOCAL: 필수
DB: 필수
STORAGE: 권장
```

---

# Phase 11 — PROCESS Handoff

## ISSUE-33. Processing Scope Selection

### 목표

READY_FOR_PROCESS Submission만 분석 대상으로 선택한다.

### 선행 조건

```text
ISSUE-31
ISSUE-32
```

### 투입 파일

```text
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: medium
```

- **선정 이유:** 이미 계산된 상태를 바탕으로 READY_FOR_PROCESS만 명시적 submission_id[]로 선택하는 범위가 좁고 규칙이 명확하다.
- **승격/전환 기준:** filtered set/개별 선택의 안정성이나 eligibility 계산이 shared query와 충돌하면 `Sol high`.

### Codex Prompt

```text
Implement processing-scope selection from /results.

Selection:
- whole Activity,
- one Student,
- selected Students,
- current filtered result set.

Rules:
- only READY_FOR_PROCESS submissions are eligible,
- show total/ready/not-eligible counts,
- selection resolves to explicit submission_id[],
- do not run PROCESS educational analysis in this issue.

Acceptance:
- REVIEW_PENDING submissions are never silently included,
- selected submission_ids remain stable and explicit.
```

### 테스트

```text
AUTO: selection eligibility tests
LOCAL: 필수
```

---

## ISSUE-34. INPUT → PROCESS Handoff

### 목표

PROCESS가 `submission_id[]`만 받아 동일 Shared DB/Storage 자료를 읽게 한다.

### 선행 조건

```text
ISSUE-33
PROCESS read contract 준비
```

### 투입 파일

```text
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
PROCESS Module PRD 또는 최소 read contract
Demo S/T Submission
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: high
```

- **선정 이유:** INPUT과 PROCESS 사이의 공유 계약을 submission_id[] 하나로 고정하고 중복 payload 없이 같은 DB/Storage를 읽는 통합 경계다.
- **승격/전환 기준:** PROCESS read contract가 INPUT schema와 다르거나 live S/T와 preloaded 18명 상태가 분리되면 `Sol max`.

### Codex Prompt

```text
Implement the INPUT → PROCESS handoff boundary.

Request payload:
{
  "submission_ids": ["..."]
}

Before handoff validate READY_FOR_PROCESS:
- Student confirmed,
- ActivityAssignment confirmed,
- ORIGINAL Artifact Storage success,
- Artifact DB record exists,
- StructuredInput stored.

Do not copy full Student/Activity/Artifact/StructuredInput payload into a PROCESS-specific duplicate structure.

Add an integration test proving PROCESS-side server code can resolve from submission_id:
- Student/Class relation,
- ActivityAssignment/Activity,
- Standard relation,
- structured_input,
- Artifact references,
- input_status,
- process_status.

DEMO
- After Student S/T live INPUT reaches READY_FOR_PROCESS, hand off only S/T submission_id[].
- Do not rerun INPUT or PROCESS for the already-prepared 18 students merely for presentation.
- PROCESS must read S/T from the same Shared DB/Storage used by the preloaded class data.

Acceptance:
- real INPUT data is readable through the same IDs,
- no manual payload copying is required,
- live S/T handoff works independently from the 18 preloaded students.
```

### 테스트

```text
AUTO: integration test 필수
LOCAL: 권장
DB: 필수
```

---
# Phase 12 — Processing Jobs, Audit & Stability

## ISSUE-35. processing_jobs + Polling Progress UX

### 목표

긴 Batch/AI 작업 상태를 DB에 보존하고 화면에서 복구한다.

### 선행 조건

```text
ISSUE-02
긴 작업 Issue 1개 이상
```

### 투입 파일

```text
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Terra
Reasoning: high
```

- **선정 이유:** processing_jobs 상태 머신, 부분 실패, polling, reload 복구 UX를 DB와 화면에 연결하는 일반적인 장기 작업 인프라 구현이다.
- **승격/전환 기준:** 동시 job/재시도/중복 polling 때문에 상태 일관성이 깨지면 `Sol high`.

### Codex Prompt

```text
Implement the shared processing_jobs persistence and polling UX for INPUT long-running work.

Use the existing processing_jobs table.

Track:
- id/job_id
- teacher_id
- job_type
- status
- total_count
- completed_count
- failed_count
- current_step
- error_message
- timestamps

payload_json:
- store only required IDs,
- do not duplicate full student responses or PII.

UI:
- no frozen/blank screen,
- show current step,
- show batch counts,
- reload/navigation can restore current/final state.

DEMO
- S/T live upload/structure or analysis-triggering long work must show real progress if it uses a job.
- Demo Seed creation itself does not need to be implemented as a processing_job.
- Do not invent fake progress solely for presentation.

Acceptance:
- running/final state survives reload,
- one failed item does not fail the whole batch automatically,
- demo path never shows fake completed state while work is still pending.
```

### 테스트

```text
AUTO: status transition tests
LOCAL: 필수
DB: 필수
```

---
## ISSUE-36. Audit Log Coverage

### 목표

INPUT 보안 중요 이벤트가 실제 `audit_logs`에 남는지 통합 확인한다.

### 선행 조건

```text
ISSUE-03
ISSUE-08
ISSUE-15
```

### 투입 파일

```text
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: high
```

- **선정 이유:** 여러 경로의 audit event를 통합 검증하면서 PII·token·signed URL·prompt·secret가 로그에 섞이지 않음을 증명해야 하는 보안 검증 작업이다.
- **승격/전환 기준:** logging helper가 여러 계층에 흩어져 누락/과다 기록이 반복되면 `Sol max`.

### Codex Prompt

```text
Verify and complete INPUT audit logging.

Required INPUT events:
- LOGIN
- ROSTER_IMPORT
- ARTIFACT_UPLOAD
- DATA_DELETE when deletion exists in current scope

Audit fields:
- actor_teacher_id
- action
- entity_type
- entity_id
- request_id
- created_at

Prohibited audit content:
- student name/number
- student answer text
- AI prompt body
- signed URL
- access token
- submission token
- secrets

Add tests or verification utilities proving prohibited fields are not logged.

Acceptance:
- required events are recorded,
- PII/secrets are absent from audit rows.
```

### 테스트

```text
AUTO: 필수
DB: 필수
SECURITY: 필수
```

---

## ISSUE-37. Error, Partial Failure & Idempotency Hardening

### 목표

실패 상황에서 데이터가 망가지거나 가짜 성공하지 않게 한다.

### 선행 조건

```text
주요 입력 Path 구현 완료
```

### 투입 파일

```text
TRACE_INPUT_MODULE_PRD.md
오류 샘플
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: max
```

- **선정 이유:** 중복 요청, Storage 실패, VLM 실패, batch 부분 실패, retry 한계와 실제 status를 전체 입력 경로에서 검증하는 복합 안정성 작업이다.
- **승격/전환 기준:** 기본이 `max`. 원인 불명 race condition이나 데이터 불일치가 나오면 broad refactor 대신 최소 재현 케이스부터 격리한다.

### Codex Prompt

```text
Harden TRACE INPUT error handling and idempotency.

Verify:
1. duplicate click/network retry does not create duplicate logical Submission,
2. failed Storage upload does not create successful Artifact,
3. failed VLM does not create fake StructuredInput,
4. batch partial failure preserves successful records,
5. retry behavior is bounded,
6. user sees clear recoverable errors,
7. input_status reflects the real state.

Do not introduce broad refactors.

Acceptance:
- defined failure scenarios have reproducible expected behavior,
- no silent/fake success.
```

### 테스트

```text
AUTO: 필수
LOCAL: 필수
DB: 필수
STORAGE: 필수
AI: 해당 시
```

---

# Phase 13 — Hackathon E2E

## ISSUE-38. INPUT End-to-End Verification

### 목표

세 입력 경로와 보안을 실제 데이터 흐름으로 검증하고, 최종 18명 사전 + 2명 실시간 Demo 흐름을 검증한다.

### 선행 조건

주요 P0 Issue 완료.
Demo를 최종 형태로 검증하려면 ISSUE-25A와 PROCESS 최소 실행 경로가 준비되어야 한다.

### 투입 파일

```text
TRACE_PRD.md
TRACE_TRD.md
TRACE_INPUT_MODULE_PRD.md
TRACE_DEMO_ROSTER_20.xlsx
TRACE_DEMO_ACTIVITY_DEFINITION.json
학생A~R 사전 Demo Dataset
학생S/T 실시간 시연 Artifact
학생S/T expected StructuredInput Reference
합성 Batch PDF
정상/오류 Spreadsheet
테스트 환경 변수
```

### Codex 모델 추천

```text
권장 모델: GPT-5.6 Sol
Reasoning: max
```

- **선정 이유:** 세 입력 경로 + 보안 + PROCESS handoff + 18→20 Demo 증가를 실제 통합 상태로 검증하는 최종 품질 게이트이므로 최고 수준의 교차 검증이 필요하다.
- **승격/전환 기준:** 기본이 `max`. 실패 시 해당 하위 Issue로 되돌아가 수정하고 E2E에서 즉흥적으로 mock/우회하지 않는다.

### Codex Prompt

```text
Run and document end-to-end verification of TRACE INPUT.

Scenario A — Student
Teacher Activity
→ ActivityAssignment
→ QR
→ Class Code + Number + Name
→ mobile capture
→ ORIGINAL Artifact
→ StructuredInput
→ READY_FOR_PROCESS

Scenario B — Teacher Batch
Batch PDF
→ ORIGINAL preserved
→ Activity confirmed/classified
→ Student matching
→ page grouping
→ per-Student Submission
→ StructuredInput
→ ready/review-pending split

Scenario C — Spreadsheet
ActivityAssignment
→ template
→ upload
→ validation
→ preview
→ Roster match
→ Submission
→ StructuredInput
→ READY_FOR_PROCESS

Scenario D — Security
- unauthorized teacher cannot read another teacher's data,
- student public browser cannot enumerate roster,
- old/expired Class Code fails,
- rate limit activates,
- Storage is private,
- signed access requires ownership,
- QR/token/object keys contain no PII,
- AI Context excludes student name/number and teacher email,
- audit_logs contain no PII/secrets.

Scenario E — Handoff
Select READY_FOR_PROCESS
→ submission_id[]
→ PROCESS-side server read of same Shared DB data.

Scenario F — Demo Incremental Class Completion

PRECONDITION
- one Demo Class,
- Roster = 20,
- Students A~R have 18 persisted Submissions,
- Students S/T have no Submission for the live-demo ActivityAssignment,
- /results reports 18/20 from the DB.

LIVE FLOW
1. Open /results and verify 18/20.
2. Upload Student S/T synthetic handwritten Artifacts through the real INPUT path.
3. Verify real ORIGINAL Storage writes.
4. Verify Student matching.
5. Verify ActivityAssignment connection.
6. Run real observable response extraction.
7. Validate/persist StructuredInput.
8. Verify READY_FOR_PROCESS conditions.
9. Reload /results and verify 20/20 from the DB.
10. Handoff only S/T submission_id[] to PROCESS.
11. Run actual PROCESS for S/T.
12. Perform Teacher Review/Approve.
13. Verify class-level OUTPUT can combine the existing 18 approved results with the newly approved S/T results.

OPTIONAL GROWTH DEMO
If Student S has approved 1~3 lesson history:
- verify Activity 1→2→3→4 parent chain,
- verify same Standard linkage,
- verify OUTPUT can display previous approved evidence plus the newly approved 4th-lesson evidence.
Do not treat mere chronological order as proof of growth.

Run actual tests; do not replace failed integrations with mocks.

Produce HACKATHON_INPUT_E2E_REPORT.md with:
- test,
- exact steps,
- result,
- evidence,
- failed items,
- remaining risk,
- demo reset procedure.
```

### 테스트

```text
AUTO: 필수
LOCAL: 필수
DEVICE: 필수 권장
DB: 필수
STORAGE: 필수
AI: 필수
SECURITY: 필수
VISUAL: PDF 기능 포함 시
```

---
