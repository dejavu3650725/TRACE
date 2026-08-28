---
doc_id: TRACE-TRD-001
authority: synchronized-from-latest-four-technical-documents
status: integrated-technical-baseline
owner: PROCESS 101
primary_sources:
  - TRACE_SHARED_CORE_SPEC_v0.3.md
  - TRACE_DATABASE_SCHEMA_v1.0.md
  - TRACE_MODULE_COMMUNICATION_CONTRACT_v1.0.md
  - TRACE_APP_SHELL_UIUX_PLAN_v2.0.md
  - TRACE_PAPER_PROTOTYPE_12SCENES (uiux 프로토타입.pdf)
  - TRACE_USER_RESEARCH_2026-08-24~26 (설계도.pdf)
product_alignment:
  - TRACE_PRD_v3.md
  - TRACE_INPUT_MODULE_PRD_v1.4.md
  - TRACE_UIUX_MASTER_PROMPT_v2.1.md
---

# TRACE 기술 요구사항 문서 (TRD)

## 1. 문서 목적

이 문서는 TRACE의 최신 기술 합의 문서 네 개를 하나의 기술 기준으로 통합한다.

통합 대상은 다음과 같다.

```text
TRACE Shared Core Specification v0.3
TRACE Database Schema v1.0
TRACE Module Communication Contract v1.0
TRACE App Shell & UI/UX Implementation Plan v2.0
```

이 TRD의 목적은 **이 문서 하나만 AI에게 주고 전체 앱을 일괄 개발시키는 것**이 아니다.

이 문서는 다음 작업의 공통 기술 기준으로 사용한다.

```text
Product PRD
+
TRD
      ↓
각 Module PRD 점검·동기화
      ↓
INPUT / PROCESS / OUTPUT별 구현 범위 확정
      ↓
각 모듈 Codex / 바이브코딩 Prompt Plan 작성
      ↓
Issue 단위 구현
```

따라서 TRD는 다음을 고정한다.

- 공통 Entity와 ID
- 물리 DB Schema
- 파일 보존 방식
- 상태 Ownership
- INPUT → PROCESS → OUTPUT 통신 계약
- 인증·권한·Storage 원칙
- 공통 App Shell과 Route
- 공통 UI 상태와 컴포넌트 계약
- 모듈 PRD가 임의로 바꾸면 안 되는 기술 경계

세부 AI Prompt, Module 내부 JSON Schema, 화면별 세부 UX는 각 Module PRD와 Prompt Plan에서 더 구체화한다.

---

## 2. 문서 권한과 충돌 해결 원칙

### 2.1 최신 네 문서가 우선한다

기존 저장소의 오래된 SOT, Domain Model, API Contract, Prototype, Fixture는 참고 자료로 사용할 수 있으나, 최신 네 기술 문서와 충돌할 경우 최신 네 문서를 따른다.

```text
최신 기술 기준
├─ Shared Core v0.3
├─ Database Schema v1.0
├─ Module Communication Contract v1.0
└─ App Shell/UIUX Plan v2.0
```

기존 문서에서만 존재하는 Entity, 상태, API, 데이터 흐름을 최신 계약에 자동으로 추가하지 않는다.

### 2.2 영역별 기준 문서

| 영역 | 기준 문서 |
|---|---|
| 공통 개념·모듈 경계·ID·상태 Ownership | Shared Core v0.3 |
| PostgreSQL Table/Column/FK/Enum | Database Schema v1.0 |
| INPUT→PROCESS→OUTPUT 데이터 전달/API 원칙 | Module Communication Contract v1.0 |
| Route/App Shell/UI 상태/공통 컴포넌트 | App Shell & UI/UX Plan v2.0 |

### 2.3 이 TRD의 역할

본 TRD는 위 네 문서의 내용을 **재해석하여 새로운 설계를 만드는 문서가 아니라, 충돌 없이 하나로 정리한 통합본**이다.

새 공통 Entity나 물리 Table이 필요하면:

```text
TRD에서 임의 추가
X

팀 합의
→ Shared Core / DB Schema / Communication Contract 변경
→ TRD 동기화
O
```

---

## 3. 현재 저장소 자료의 사용 원칙

기존 저장소에 정적 HTML Prototype, Wireframe, Fixture, 이전 Domain/API 문서가 있을 수 있다.

이 자료들은 다음 용도로만 사용한다.

```text
Prototype
→ 화면 배치와 사용자 흐름 참고

Fixture
→ 테스트/데모용 합성 데이터

이전 Domain/API 문서
→ 누락 요구 탐색 및 배경 이해
```

다음 용도로 사용하지 않는다.

```text
최신 Shared Entity 대체
최신 DB Schema 대체
최신 상태 Enum 대체
최신 Module Handoff 대체
최신 Route 대체
```

특히 기존 문서에서 사용하던 `StudentAlias`, `EvaluationContext`, `Extraction` 등의 이름은 최신 네 문서에 공통 Entity로 확정되지 않았으므로 **Shared Core Entity로 취급하지 않는다.**

---

# 4. TRACE 기술 구조 요약

TRACE는 하나의 Next.js 애플리케이션이다.

```text
TRACE Web App
│
├─ Teacher Web
│  ├─ Shared App Shell
│  ├─ INPUT
│  ├─ PROCESS
│  └─ OUTPUT
│
└─ Student Browser Submit
```

모든 모듈은 동일한 Supabase PostgreSQL과 Supabase Storage를 사용한다.

```text
INPUT
→ DB / Storage 저장
→ input_status = READY_FOR_PROCESS
→ submission_id[]

PROCESS
→ submission_id로 Shared DB 조회
→ Analysis / Evidence 저장
→ Teacher Review
→ process_status = APPROVED

OUTPUT
→ Shared DB에서 승인된 결과 조회
→ Dashboard / Report / Follow-up
```

핵심 통신 원칙:

> 모듈끼리 전체 학생 데이터 객체를 복사해 넘기지 않는다. 공통 ID를 전달하고 동일한 Shared DB/Storage를 조회한다.

---

# 5. 확정 기본 기술 스택

```text
Web
- Next.js
- TypeScript

Backend
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage

Authentication
- Google OAuth
- Supabase Auth Google Provider

Deployment
- Vercel

Validation
- Zod

Spreadsheet
- SheetJS(xlsx)

Image Preprocessing
- Sharp

QR
- qrcode 또는 react-qr-code

AI/VLM
- Adapter 구조
- Provider 교체 가능

Capture
- MediaDevices getUserMedia
- Canvas 2D 기반 프레임 분석 (외부 CV 라이브러리 미사용)
- HTMLInputElement[type=file][accept=image/*][multiple] Fallback
```

다음은 아직 구현 세부 선택으로 남길 수 있다.

```text
최종 VLM Provider / Model
PDF Library
Storage 실제 Bucket 이름
원본 보존 기간
Curriculum JSON 실제 파일명 정리 방식
```

단, 위 세부사항이 미정이라고 해서 Next.js/Supabase/Google OAuth/Vercel 자체를 다시 미결정으로 되돌리지 않는다.

---

# 6. 모듈 책임 경계

## 6.1 Shared Core

소유:

```text
Teacher
Class
Student
Activity 공통 구조
ActivityAssignment
공통 ID
공통 Status Enum
Curriculum Loader
Auth
Storage 접근 원칙
Shared Types
```

Shared Core는 교육적 판단을 만들지 않는다.

## 6.2 INPUT

INPUT의 질문:

> 학생이 무엇을 쓰거나 표시했는가?

책임:

```text
Class / Roster Setup
Activity 생성·관리
Teacher Image/PDF Upload
Student Browser Submit
CSV/XLSX Import
Original Artifact 보존
Student Matching
Activity Matching
StructuredInput 생성
input_status 관리
PROCESS Handoff
```

금지:

```text
정답/오답 판단
성취수준 확정
강점/어려움 판단
Evidence 확정
성장 판단
Feedback 확정
```

## 6.3 PROCESS

PROCESS의 질문:

> 학생 결과가 교육적으로 무엇을 의미하는가?

책임:

```text
submission_id로 Shared Data 조회
Standard/AchievementLevel 조회
Artifact 필요 시 원본 조회
AI/VLM 교육적 분석
Analysis 생성
Evidence 생성
재분석 Version 관리
Teacher Review
process_status 관리
GrowthEvent 후보 생성
```

## 6.4 OUTPUT

책임:

```text
Approved Analysis 조회
Approved Evidence 조회
Approved GrowthEvent 조회
학생/학급 Dashboard
개별/누적 Report
Feedback / Follow-up 활용
```

확정되지 않은 AI Draft를 최종 근거로 사용하지 않는다.

---

# 7. 공통 Entity 계약

최신 Shared Core 기준 Entity:

```text
Teacher
Class
Student
Standard
AchievementLevel
Activity
ActivityAssignment
Submission
StructuredInput
Artifact
Analysis
Evidence
Review
GrowthEvent
```

논리 관계:

```text
Teacher
  └─ Class
      └─ Student

Activity
  ├─ ActivityStandard ── standard_id
  └─ ActivityAssignment ── Class
          └─ Submission ── Student
               ├─ structured_input JSONB
               ├─ Artifact[]
               └─ Analysis[]
                    ├─ Evidence[]
                    └─ Review

Evidence[]
  └─ GrowthEvent
       └─ GrowthEventEvidence
```

---

# 8. Student 계약

공통 학생 Entity는 `Student`다.

```text
Student
- id
- class_id
- student_number
- name
- is_active
```

`StudentAlias`를 Shared Core Entity로 추가하지 않는다.

개발/데모에서 개인정보를 줄여야 하는 경우에도 동일 Student Schema를 사용하되 합성값을 넣는다.

예:

```text
student_number = 1
name = 학생A
```

즉:

```text
합성 데이터 사용
≠
StudentAlias라는 별도 Domain Entity 사용
```

---

# 9. Teacher 인증 Lifecycle

교사 UI 진입점:

```text
[ Google로 계속하기 ]
```

별도 이메일/비밀번호 회원가입을 MVP 필수로 만들지 않는다.

## 신규 교사

```text
Google로 계속하기
→ Google OAuth
→ Supabase Auth User 생성
→ /onboarding/profile
→ Teacher Profile 기본정보 설정(name 필수, nickname 선택)
→ Teacher Profile 생성
→ Class 생성
→ Student Roster 등록
→ Dashboard
```

## 기존 교사

```text
Google로 계속하기
→ Google OAuth
→ 기존 Auth User 확인
→ teachers.auth_user_id
→ 기존 Teacher Profile
→ 기존 Class / Student / Activity 로드
→ Dashboard
```

TRACE 내부 관계 ID:

```text
teachers.id
```

Google Access Token을 내부 Teacher ID로 사용하지 않는다.

---

# 10. Class & Roster 계약

학생 자료 입력 전에 Teacher는 Class와 Student Roster를 준비할 수 있어야 한다.

## Class

최소 정보:

```text
grade
name
subject(optional)
class_code
```

## Student Roster

MVP 등록 방식:

```text
TRACE 표준 CSV/XLSX 업로드
또는
화면에서 학생 직접 추가/수정
```

필수 학생 데이터:

```text
student_number
student_name
```

Validation:

```text
번호 필수
이름 필수
동일 Class 내 번호 중복 금지
빈 행 무시
오류 행 저장 전 표시
```

Roster는 다음의 기준이다.

```text
Student Submit Verification
Batch Student Matching
Spreadsheet Result Matching
제출/미제출 계산
```

제출/미제출 계산:

```text
Class 전체 Student
-
해당 ActivityAssignment에 Submission이 존재하는 Student
=
미제출 Student
```

별도 제출현황 원본 Table은 만들지 않는다.

---

# 11. Activity / ActivityAssignment 계약

## Activity

학습활동 자체.

Activity는 Class에 직접 귀속되지 않는다.

## Activity ↔ Standard

다대다 관계:

```text
activities
↕
activity_standards
↕
standard_id
```

`standard_ids[]` 배열을 Activity Table에 중복 저장하지 않는다.

## ActivityAssignment

Activity를 실제 Class에 배정한 기록.

```text
Activity
→ ActivityAssignment
→ Class
```

학생 제출용:

```text
submission_token
```

은 ActivityAssignment에 연결한다.

---

# 12. Submission 계약

학생 학습결과의 중심 연결 단위.

```text
Student 1명 × ActivityAssignment 1개
= Submission 1개
```

Submission은 다음을 연결한다.

```text
Student
ActivityAssignment
StructuredInput
Artifact[]
Analysis[]
```

재제출은 별도 Attempts Table을 만들지 않고:

```text
submissions.current_attempt_no
artifacts.attempt_no
```

를 사용한다.

---

# 13. Artifact 계약

실제 File Binary는 Supabase Storage에 저장한다.

DB에는 File Reference/Metadata를 저장한다.

Artifact Role:

```text
ORIGINAL
PROCESSED
DERIVED
```

원칙:

```text
ORIGINAL은 덮어쓰지 않는다.
```

가공본:

```text
source_artifact_id
```

로 원본을 추적한다.

## Batch PDF

Batch PDF 원본 Binary는 Storage에 한 번 저장한다.

학생 매칭 전 Batch 원본/페이지 참조는 `artifacts.owner_teacher_id`로
Teacher 소유권을 확인한다. 이때 `submission_id`는 null이며, 매칭 후 생성되는
Submission 참조 Artifact는 `source_artifact_id`로 Batch ORIGINAL을 추적한다.

학생별 Submission은 필요 시 동일 `storage_path`와:

```text
page_start
page_end
```

로 논리 연결한다.

복수 학생을 위해 Binary 자체를 반복 저장하지 않는다.

---

# 14. StructuredInput 계약

저장 위치:

```text
submissions.structured_input JSONB
```

StructuredInput은 관찰 가능한 학생 응답만 담는다.

포함 가능:

```text
학생이 실제로 작성한 글
선택한 보기
체크
동그라미
밑줄
문항별 Raw Response
```

포함 금지:

```text
정답/오답
성취수준
Evidence
강점
어려움
성장 판단
Feedback
```

Student / Activity / Standard / Artifact 관계 ID는 JSON 안에 반복 복사하지 않고 관계형 DB로 연결한다.

## 14.1 StructuredInput 공통 Envelope

모든 Activity 유형의 세부 응답 구조를 하나로 고정하지는 않되, INPUT과 PROCESS가 공유하는 최소 Envelope는 다음과 같이 고정한다.

```json
{
  "schema_version": "1",
  "questions": [
    {
      "question_id": "Q1",
      "response_type": "selection",
      "response": {
        "selected_option": 3
      }
    }
  ]
}
```

공통 필수 축:

```text
schema_version
question_id
response_type
response
```

`response` 내부는 `response_type`별로 확장할 수 있다. Activity 유형별 상세 JSON Schema는 Module PRD에서 정의하되 공통 Envelope를 깨지 않는다.

생성 흐름:

```text
원본 입력
→ Student / ActivityAssignment 연결
→ 문항·관찰 응답 구조화
→ Schema Validation
→ 신뢰 가능: StructuredInput 저장
→ 불확실: REVIEW_PENDING → 교사 수정
```

StructuredInput에는 정답/오답, 성취수준, 강점, 어려움, Evidence 등 교육적 판단을 넣지 않는다.

---

# 15. Curriculum / AchievementLevel 계약

Standard와 AchievementLevel의 원문은 공통 JSON에서 읽는다.

DB에 원문을 복제하지 않는다.

```text
Shared Curriculum JSON
→ Standard / AchievementLevel

DB
→ standard_id
```

권장 파일명:

```text
{school_level}_{subject}_{data_type}_v{version}.json
```

예:

```text
elementary_KOR_standards_v1.json
elementary_KOR_achievement_levels_v1.json
elementary_MATH_standards_v1.json
```

기존 파일 이름이 일관되지 않으면:

```text
shared/curriculum/manifest.json
```

으로 실제 Path를 Mapping한다.

각 Module이 Curriculum File Path를 Hard-code하지 않는다.

`EvaluationContext`를 Shared Core Entity나 필수 DB Table로 추가하지 않는다.

PROCESS가 분석 시점에 필요한:

```text
Activity
Standard
AchievementLevel
Previous Approved Evidence
```

를 조합한 Runtime Context/DTO를 만드는 것은 가능하지만, 이는 공통 Domain Entity가 아니다.

---

# 16. Database Schema

## 16.1 teachers

```text
id uuid PK
auth_user_id uuid UNIQUE NOT NULL
name text NOT NULL
nickname text nullable
email text nullable
created_at timestamptz
updated_at timestamptz
```

## 16.2 classes

```text
id uuid PK
teacher_id uuid FK → teachers.id
name text NOT NULL
grade smallint nullable
subject text nullable
class_code text UNIQUE nullable
class_code_expires_at timestamptz nullable
is_active boolean default true
created_at timestamptz
updated_at timestamptz
```

학생 직접 제출을 사용하는 Class는 `class_code`와 유효한 `class_code_expires_at`이 존재해야 한다. Class Code 재발급 시 새 만료시각을 저장하고 기존 Code는 즉시 무효화한다.

## 16.3 students

```text
id uuid PK
class_id uuid FK → classes.id
student_number smallint NOT NULL
name text NOT NULL
is_active boolean default true
created_at timestamptz
updated_at timestamptz
```

Unique:

```text
UNIQUE(class_id, student_number)
```

## 16.4 activities

```text
id uuid PK
teacher_id uuid FK → teachers.id
title text NOT NULL
grade smallint nullable
subject text nullable
domain text nullable
unit text nullable
activity_type text nullable
description text nullable
content_json jsonb nullable
activity_code text UNIQUE nullable
status activity_status
parent_activity_id uuid FK → activities.id nullable
created_at timestamptz
updated_at timestamptz
```

## 16.5 activity_standards

```text
id uuid PK
activity_id uuid FK → activities.id
standard_id text NOT NULL
created_at timestamptz
```

Unique:

```text
UNIQUE(activity_id, standard_id)
```

## 16.6 activity_assignments

```text
id uuid PK
activity_id uuid FK → activities.id
class_id uuid FK → classes.id
submission_token text UNIQUE nullable
open_at timestamptz nullable
due_at timestamptz nullable
status activity_assignment_status
created_at timestamptz
updated_at timestamptz
```

Unique:

```text
UNIQUE(activity_id, class_id)
```

## 16.7 submissions

```text
id uuid PK
student_id uuid FK → students.id
activity_assignment_id uuid FK → activity_assignments.id
structured_input jsonb nullable
input_status input_status
process_status process_status
submission_code text UNIQUE nullable
current_attempt_no smallint default 1
submitted_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

Unique:

```text
UNIQUE(student_id, activity_assignment_id)
```

## 16.8 artifacts

```text
id uuid PK
submission_id uuid FK → submissions.id nullable
owner_teacher_id uuid FK → teachers.id nullable
source_artifact_id uuid FK → artifacts.id nullable
storage_path text NOT NULL
file_name text NOT NULL
mime_type text NOT NULL
file_size_bytes bigint nullable
checksum text nullable
artifact_role artifact_role
attempt_no smallint default 1
page_start integer nullable
page_end integer nullable
created_at timestamptz
```

Artifact는 `submission_id` 또는 `owner_teacher_id` 중 정확히 하나의 소유권
경로를 가져야 한다. 기존 Submission Artifact는 `submission_id`, 학생 매칭 전
Batch/Activity Artifact는 `owner_teacher_id`를 사용한다.

## 16.9 analyses

```text
id uuid PK
submission_id uuid FK → submissions.id
version_no smallint default 1
analysis_json jsonb NOT NULL
status analysis_status
provider text nullable
model text nullable
created_at timestamptz
updated_at timestamptz
```

Unique:

```text
UNIQUE(submission_id, version_no)
```

## 16.10 evidence

```text
id uuid PK
analysis_id uuid FK → analyses.id
standard_id text nullable
artifact_id uuid FK → artifacts.id nullable
question_id text nullable
source_page integer nullable
claim text NOT NULL
created_at timestamptz
updated_at timestamptz
```

## 16.11 reviews

```text
id uuid PK
analysis_id uuid FK → analyses.id
reviewer_id uuid FK → teachers.id
decision review_decision
teacher_edits jsonb nullable
reviewed_at timestamptz
```

## 16.12 growth_events

```text
id uuid PK
student_id uuid FK → students.id
standard_id text nullable
description text NOT NULL
status growth_event_status
created_at timestamptz
updated_at timestamptz
```

## 16.13 growth_event_evidence

```text
id uuid PK
growth_event_id uuid FK → growth_events.id
evidence_id uuid FK → evidence.id
created_at timestamptz
```

Unique:

```text
UNIQUE(growth_event_id, evidence_id)
```

---


## 16.14 audit_logs

Hackathon MVP에서 주요 보안·교육적 확정 이벤트를 Persistent Audit Log로 기록한다.

```text
id uuid PK
actor_teacher_id uuid FK → teachers.id nullable
action text NOT NULL
entity_type text nullable
entity_id uuid nullable
request_id text nullable
created_at timestamptz default now()
metadata_json jsonb nullable
```

### 최소 Action

```text
LOGIN
ROSTER_IMPORT
ARTIFACT_UPLOAD
ANALYSIS_START
ANALYSIS_APPROVE
ANALYSIS_EDIT_APPROVE
ANALYSIS_REJECT
DATA_DELETE
```

### Audit Log 최소화 원칙

`metadata_json`을 사용하더라도 다음은 저장하지 않는다.

```text
Student name
Student number
학생 답안 전문
AI Prompt 전문
Signed URL
Access Token
Submission Token
API Secret
```

Audit Log와 교육적 Review는 목적이 다르다.

```text
reviews
= Analysis의 교사 검토/수정/승인

audit_logs
= 누가 언제 어떤 중요 처리행위를 수행했는지 추적
```

본 Table은 Persistent Audit Log 요구를 구현하는 공통 DB 계약이며, Shared Database Schema 문서에도 동일하게 동기화해야 한다.

---

## 16.15 processing_jobs

장시간 INPUT/PROCESS 작업은 페이지 이동·새로고침 이후에도 `job_id`로 상태를 재조회할 수 있도록 Shared PostgreSQL의 `processing_jobs` Table에 영속화한다.

```text
id uuid PK
teacher_id uuid FK → teachers.id
job_type text NOT NULL
status processing_job_status NOT NULL
total_count integer default 0
completed_count integer default 0
failed_count integer default 0
current_step text nullable
error_message text nullable
payload_json jsonb nullable
created_at timestamptz default now()
updated_at timestamptz default now()
```

`payload_json`에는 Student 전체 객체, StructuredInput 전체 복제본, 원본 Artifact Binary를 넣지 않는다. 처리 범위 식별에는 `submission_id[]` 등 최소 공통 ID를 사용한다.

Job Status는 `input_status`/`process_status`를 대체하지 않는다.

---

# 17. Database에서 아직 고정하지 않는 구조

최신 DB Schema v1.0에 존재하지 않는 다음 구조를 TRD에서 임의의 공통 Table로 확정하지 않는다.

```text
StudentAlias
EvaluationContext
Extraction
ProcessingJob Table
GrowthEventReview Table
Support Table
Report Table
```

이 중 일부는 Module PRD 구현 과정에서 필요성이 확인될 수 있다.

그 경우:

```text
Module PRD에서 필요 발견
→ Shared Contract 변경 영향 보고
→ 팀 합의
→ Shared Core / DB Schema 수정
→ TRD 동기화
```

순서를 따른다.

### Processing Job 영속화 원칙

Communication Contract와 App Shell의 긴 작업은 `job_id` 기반 진행상태를 사용한다. 기본 영속화 방식은 Shared PostgreSQL의 `processing_jobs` Table이다.

```text
작업 시작
→ processing_jobs Row 생성
→ job_id 반환
→ Server 처리
→ 진행상태 갱신
→ Client Polling 또는 Realtime Subscription
→ 완료 / 검토 필요 / 실패
```

공통 DB Schema에 해당 Table이 반영되지 않은 상태라면 구현자가 임의의 Runtime Store로 우회하지 않는다. 먼저 Shared DB 계약을 갱신하고 TRD를 동기화한 뒤 구현한다.

---

# 18. Status Enum 계약

## activity_status

```text
DRAFT
ACTIVE
ARCHIVED
```

## activity_assignment_status

```text
OPEN
CLOSED
ARCHIVED
```

## input_status

```text
UPLOADING
STORED
PREPROCESSING
STRUCTURING
REVIEW_PENDING
READY_FOR_PROCESS
FAILED
```

Ownership:

```text
INPUT
```

## process_status

```text
NOT_STARTED
READY_TO_ANALYZE
ANALYZING
REVIEW_REQUIRED
APPROVED
FAILED
```

Ownership:

```text
PROCESS
```

## artifact_role

```text
ORIGINAL
PROCESSED
DERIVED
```

## analysis_status

```text
AI_DRAFT
TEACHER_REVIEW
APPROVED
EDITED_APPROVED
REJECTED
FAILED
```

## review_decision

```text
APPROVED
EDITED_APPROVED
REJECTED
```

## growth_event_status

```text
AI_DRAFT
TEACHER_REVIEW
APPROVED
EDITED_APPROVED
REJECTED
```

## processing_job_status

```text
QUEUED
PROCESSING
REVIEW_REQUIRED
COMPLETED
FAILED
```

Job Status는 `input_status`/`process_status`를 대체하지 않는다.

---

# 19. READY_FOR_PROCESS 계약

최소 조건:

```text
Student 확정
+ ActivityAssignment 확정
+ Original Artifact Storage 저장 성공
+ Artifact DB Record 존재
+ StructuredInput 저장 성공
```

충족 시:

```text
input_status = READY_FOR_PROCESS
```

의미:

```text
PROCESS가 읽을 준비 완료
```

의미하지 않는 것:

```text
교육적 AI 분석 완료
교육적 AI 분석 자동 시작
```

---

# 20. Teacher Approval Gate

TRACE는 관찰 데이터 저장과 교육적 판단 확정을 구분한다.

## INPUT 자동 저장 가능

신뢰 가능한 관찰 정보:

```text
Exact Student Match
확정된 Activity 연결
학생 작성 글
선택한 보기
체크/동그라미
Schema 검증 통과 StructuredInput
```

불확실:

```text
REVIEW_PENDING
```

## 교육적 판단

다음은 Teacher Review를 거친다.

```text
Activity/Standard 의미 확정이 필요한 AI 분류
성취수준
Evidence
강점
어려움
오류 해석
GrowthEvent
Feedback/Follow-up 교육적 제안
Report 설명
```

## Analysis 승인

```text
AI_DRAFT
→ TEACHER_REVIEW
→ APPROVED
 / EDITED_APPROVED
 / REJECTED
```

승인 단위:

```text
Analysis 전체
```

Evidence마다 별도 Approval Status를 만들지 않는다.

승인된 Analysis에 포함된 Evidence만 확정 Evidence로 사용한다.

---

# 21. INPUT 경로

MVP의 학생 결과 입력 경로는 세 가지다.

```text
1. Teacher Image/PDF Upload
2. Student Direct Submit / AutoCapture
3. TRACE 표준 CSV/XLSX Result Import
```

어느 하나를 다른 경로로 대체하지 않는다.

## Teacher Upload

```text
File
→ Original Storage
→ Artifact
→ 필요 시 Preprocess
→ Student Match
→ StructuredInput
→ REVIEW_PENDING 또는 READY_FOR_PROCESS
```

## Teacher Scan

교사가 웹캠·태블릿 카메라로 종이 활동지를 연속 촬영하는 경로.

```text
ActivityAssignment 선택
→ AutoCapture (§42)
→ Frame[] → Blob[]
→ Original Storage
→ Preprocess
→ Student Match
→ StructuredInput
→ 필요한 항목 Review
→ READY_FOR_PROCESS
```

Teacher Upload와 동일한 Pipeline에 합류한다. Capture 이후 단계를 별도로 만들지 않는다.

Student Submit과 **동일한 AutoCapture 구현을 재사용**한다.

## Student Submit

```text
QR / Short Link
→ Class Code
→ Student Number + Name
→ Roster Exact Match
→ AutoCapture (§42)  또는  File Select Fallback
→ Preview
→ Retake / Add Page
→ Submit
→ Original Artifact
→ StructuredInput
```

## Result Spreadsheet

```text
ActivityAssignment 선택
→ TRACE Template
→ XLSX/CSV Upload
→ Schema Validation
→ Preview
→ Roster Match
→ Submission
→ StructuredInput
```

MVP에서 Arbitrary Header Mapping은 필수 아님.

---

# 22. INPUT → PROCESS 통신 계약

교사가 분석 범위를 선택하면 Frontend는 최종적으로:

```text
submission_id[]
```

를 생성한다.

예:

```json
{
  "submission_ids": [
    "uuid-1",
    "uuid-2"
  ]
}
```

PROCESS에 다음을 복사해서 넘기지 않는다.

```text
Student 전체 객체
Activity 전체 객체
StructuredInput 전체 복제본
Artifact Metadata 복제본
```

PROCESS는 각 `submission_id`로 Shared DB를 조회한다.

```text
Submission
├─ Student
│  └─ Class
│
├─ ActivityAssignment
│  └─ Activity
│     └─ ActivityStandard
│        └─ standard_id
│
├─ structured_input
└─ Artifact[]
```

Standard/AchievementLevel은 Shared Curriculum Loader로 조회한다.

---

# 23. 원본 파일 조회 계약

PROCESS는 필요한 경우 Artifact의:

```text
storage_path
artifact_role
page_start
page_end
```

를 사용한다.

```text
Artifact
→ Private Supabase Storage
→ Original Image/PDF
```

Provider가 URL을 요구할 때만 Server에서 짧은 만료 Signed URL을 발급한다.

Browser에서 영구 Public URL을 사용하지 않는다.

---

# 24. PROCESS 계약

분석 실행 조건:

```text
input_status == READY_FOR_PROCESS
```

PROCESS Input Context:

```text
StructuredInput
Original Artifact
Activity
Approved/Confirmed Standard
Standard AchievementLevel
Previous Approved Evidence(optional)
```

PROCESS Output:

```text
Analysis
Evidence[]
```

`Extraction`을 PROCESS의 별도 Shared Entity로 만들지 않는다.

Provider의 Raw Response가 필요하면 `analysis_json`, Provider adapter 내부 로그/참조 등 Module 내부 구현에서 보존할 수 있지만, Evidence와 동일한 것으로 취급하지 않는다.

## 재분석

```text
Analysis v1
→ 보존

Re-analysis
→ Analysis v2 INSERT
```

기존 Analysis 덮어쓰기 금지.

---

# 25. Evidence 계약

Evidence는 Analysis에 소속된다.

필드:

```text
analysis_id
standard_id
artifact_id
question_id
source_page
claim
```

가능하면 Evidence는 Original Artifact로 추적 가능해야 한다.

```text
Evidence
→ artifact_id
→ Artifact
→ storage_path
→ Original
```

원본 위치 정보가 충분하면:

```text
question_id
source_page
```

를 추가해 근거를 더 정확히 연결한다.

최신 Schema에 없는 `claimType`, `sourceKind`, `sourceRegion`, `confidence` 등을 공통 DB 필드로 임의 추가하지 않는다.

PROCESS Module PRD에서 필요성이 확인되면 Shared Schema 변경 절차를 따른다.

---

# 26. GrowthEvent 계약

```text
Student
+ Standard
+ Approved Evidence[]
→ GrowthEvent Candidate
→ Teacher Review
→ Approved GrowthEvent
```

OUTPUT은 승인된 GrowthEvent만 확정 성장 근거로 사용한다.

GrowthEvent 승인 상태는:

```text
growth_event_status
```

를 사용한다.

별도 `growth_event_reviews` Table은 현재 DB Schema에 없으므로 TRD에서 임의 확정하지 않는다.

교사 승인 이력을 어떤 구조로 저장할지는 PROCESS/OUTPUT Module PRD 검토 단계에서 Shared Contract 변경 필요 여부를 판단한다.

---

# 27. PROCESS → OUTPUT 계약

PROCESS는 Shared DB에:

```text
Analysis
Evidence
Review
GrowthEvent
```

를 저장한다.

OUTPUT은 이를 직접 조회한다.

사용 가능:

```text
APPROVED
EDITED_APPROVED
```

사용 금지:

```text
AI_DRAFT
TEACHER_REVIEW
REJECTED
FAILED
```

OUTPUT 전용 복제 데이터 모델을 기본으로 만들지 않는다.

---

# 28. 장시간 작업 계약

AI/VLM/Batch 작업에서 사용자가 긴 시간 무응답 화면을 보지 않도록 한다.

개념:

```text
작업 시작
→ job_id
→ Server 처리
→ 상태 갱신
→ Client Polling
→ 완료/검토 필요/실패
```

권장 PROCESS API:

```text
POST /api/process/analysis-jobs
GET  /api/process/analysis-jobs/{jobId}
```

Job 상태 예:

```text
QUEUED
PROCESSING
REVIEW_REQUIRED
COMPLETED
FAILED
```

UI:

```text
0~1초
→ 즉시 반응

1~3초
→ Spinner + 상태

3~10초
→ 현재 단계

10초+
→ Count / Progress
```

Batch 일부 실패:

```text
전체 28
성공 26
검토 대기 1
실패 1
```

한 학생 오류로 Batch 전체를 실패 처리하지 않는다.

---

# 29. 공통 API 통신 원칙

Client → Server:

```text
HTTPS / JSON
multipart upload 또는 Signed Upload
```

Server → Storage/DB:

```text
File
→ Storage

Relation / Status / JSON
→ PostgreSQL
```

Server → AI:

```text
TRACE Server
→ AI/VLM Adapter
→ Provider
```

금지:

```text
Browser → AI Provider 직접 호출
Client에 API Key 노출
Client에 Supabase Service Role 노출
모듈 간 Full Payload 복제
```

공통 Response 권장:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "request_id": "REQ-..."
  },
  "error": null
}
```

Failure:

```json
{
  "ok": false,
  "data": null,
  "meta": {
    "request_id": "REQ-..."
  },
  "error": {
    "code": "ERROR_CODE",
    "message": "사용자에게 보여줄 메시지"
  }
}
```

Frontend가 AI Provider Raw Response를 직접 해석하지 않는다.

---

# 30. Security / Privacy / Access 계약

본 절은 Hackathon MVP에서 **실제로 구현해야 하는 B안 14개 보안 통제**와 실제 학생 데이터 운영 전 **Production Gate**를 구분한다.

TRACE 일반 운영 전체를 가명정보 처리시스템으로 간주하지 않는다. Teacher는 실제 수업 운영을 위해 Student를 식별할 수 있어야 한다.

대신 시스템 내부를 다음 Privacy Boundary로 구분한다.

```text
Identity Zone
- teachers
- classes
- students
- Roster

Learning Zone
- submissions
- artifacts
- structured_input
- analyses
- evidence
- growth_events

AI Boundary
- 최소 Learning Context
- 직접 식별정보 제거
```

`student_id` UUID는 내부 관계를 유지하는 기술키이고, 외부 AI Provider에는 반드시 필요한 경우가 아니면 전달하지 않는다.

## 30.1 S-01 Google OAuth + Server Session

- Supabase Auth Google Provider 사용
- 보호된 Teacher Route/API는 Session 필수
- OAuth callback 후 Server에서 Session 검증
- `auth.users.id ↔ teachers.auth_user_id` 연결
- Client가 보내는 `teacher_id`만 신뢰하지 않는다

## 30.2 S-02 Supabase RLS

MVP에서 RLS를 활성화한다.

최소 Policy Matrix:

| Resource | Teacher Access Rule |
|---|---|
| `teachers` | `auth.uid() = auth_user_id`인 본인 |
| `classes` | 본인 `teacher_id` 소유 |
| `students` | 본인 Class 소속 |
| `activities` | 본인 Teacher Activity |
| `activity_assignments` | 본인 Activity/Class 범위 |
| `submissions` | 본인 ActivityAssignment 범위 |
| `artifacts` | 접근 가능한 Submission 범위 |
| `analyses` | 접근 가능한 Submission 범위 |
| `evidence` | 접근 가능한 Analysis 범위 |
| `reviews` | 접근 가능한 Analysis 범위 |
| `growth_events` | 본인 Student 범위 |
| `audit_logs` | 본인 Actor/Resource 범위에서 필요한 최소 조회 |

Service Role은 일반 Client 접근을 우회하기 위한 편의수단으로 사용하지 않는다.

## 30.3 S-03 Server Ownership Check

RLS와 별개로 주요 Server API/Server Action은 요청 대상 Resource의 소유권을 다시 검사한다.

```text
Class
Student
Activity
ActivityAssignment
Submission
Artifact
Analysis
Report Query
```

검증 실패:

```text
403 FORBIDDEN
```

Resource 존재 여부를 불필요하게 노출하지 않는다.

## 30.4 S-04 Student Public Submit API 분리

Student Browser는 Teacher용 Supabase Data Access를 받지 않는다.

금지:

```text
Student Browser
→ students SELECT
→ 이름/번호 검색
```

허용:

```text
Student Browser
→ /api/submit/... 
→ Server Verification
→ 최소 성공/실패 Response
```

학생 Public Route는 `/submit/[token]` 범위만 사용한다.

## 30.5 S-05 Student Verification

검증 Input:

```text
submission_token
Class Code
Student Number
Student Name
```

Server:

```text
token → ActivityAssignment
Class Code → Class 확인
Number + Name → 해당 Class Roster exact match
```

성공할 때만 해당 Student의 Submission을 생성/갱신할 수 있다.

## 30.6 S-06 Uniform Verification Failure

Client에 Roster 추측 가능한 상세 실패이유를 반환하지 않는다.

사용:

```text
입력한 정보가 학급 정보와 일치하지 않습니다.
```

금지:

```text
12번은 존재하지만 이름이 틀렸습니다.
김OO 학생은 7번입니다.
```

Server 내부 Log에는 필요 시 Error Code를 남길 수 있지만 PII는 남기지 않는다.

## 30.7 S-07 PII-free QR / Token

QR/Short Link에 포함 금지:

```text
Student name
Student number
Teacher email
Student ID
```

`submission_token`은 충분한 Randomness를 가진 Opaque Token으로 생성한다.

Token은 ActivityAssignment 범위이며:

```text
CLOSED
ARCHIVED
```

Assignment에는 사용 불가.

Class Code는 재발급 가능해야 한다. 재발급 시 기존 Code는 즉시 무효화한다.

MVP 기본값은 아래와 같이 두되 코드에 흩어져 하드코딩하지 않고 Config로 관리한다.

```text
Class Code validity = 24시간

Public verification Rate Limit default
동일 IP + submission_token 기준
5분 내 검증 실패 10회 초과
→ 10분 제한
```

성공 시 실패 누적은 초기화할 수 있다. Module PRD가 이 기본값을 임의 변경하지 않는다.

## 30.8 S-08 Private Storage + Signed URL

- Original Artifact는 Private Supabase Storage
- Permanent Public URL 금지
- Viewer/AI가 필요할 때 Server에서 짧은 만료 Signed URL
- Signed URL을 Audit/Application Log에 저장하지 않음
- Teacher가 접근 가능한 Artifact인지 확인한 후 Signed URL 발급

## 30.9 S-09 UUID Storage Object Key

Storage Key는 학생 이름/번호/원래 파일명을 포함하지 않는 것을 기본으로 한다.

```text
teachers/{teacher_id}/submissions/{submission_id}/original/{artifact_uuid}.{ext}
```

원본 File Name이 UI에 반드시 필요하면 DB Metadata에서 제한적으로 보존 가능하지만:

```text
Server Log
Audit Log
Object Key
```

에는 복사하지 않는다.

Processed Image 생성 시 가능한 범위에서 EXIF/위치 Metadata를 제거한다.

## 30.10 S-10 Server-only Secrets

Client Bundle에 노출 금지:

```text
AI API Key
Supabase Service Role
Signing Secret
기타 Server Credential
```

브라우저에 필요한 Supabase anon/public 설정과 Server Secret을 명확히 분리한다.

## 30.11 S-11 Server-side AI

```text
Client
→ TRACE Server
→ Privacy Context Builder
→ AI Adapter
→ Provider
```

Browser에서 Provider 직접 호출 금지.

Provider Raw Response는 Server에서 Validation/Normalization 후 Shared Schema로 변환한다.

## 30.12 S-12 AI Context PII Minimization

AI Context Builder를 공통 Server Boundary로 둔다.

기본 제거:

```text
Student name
Student number
Teacher email
Google Account 정보
전체 Roster
다른 Student 정보
불필요한 Class 표시명
```

기본 허용:

```text
Activity
Standard
AchievementLevel
StructuredInput
현재 분석에 필요한 Artifact
필요한 Previous Approved Evidence
```

Artifact 자체에 Student 이름/번호가 보일 수 있으므로:

```text
MVP
→ 합성 Student Data만 사용

Production
→ PII Redaction Gate
```

로 구분한다.

외부 Provider에 영구 Student Identifier를 만들지 않는다.

## 30.13 S-13 Synthetic Data Only for Hackathon

Hackathon 개발/테스트/시연:

```text
실제 Student 개인정보 X
실제 학생 답안/사진 X
합성 Student/Roster/Artifact O
```

예:

```text
1번 학생A
2번 학생B
```

개발 편의를 이유로 실제 학생자료를 샘플 데이터로 사용하지 않는다.

## 30.14 S-14 Persistent Audit Log

Table:

```text
audit_logs
```

최소 기록 이벤트:

```text
LOGIN
ROSTER_IMPORT
ARTIFACT_UPLOAD
ANALYSIS_START
ANALYSIS_APPROVE
ANALYSIS_EDIT_APPROVE
ANALYSIS_REJECT
DATA_DELETE
```

최소 필드:

```text
actor_teacher_id
action
entity_type
entity_id
request_id
created_at
```

금지:

```text
Student PII
학생 답안 전문
AI Prompt 전문
Token
Signed URL
Secret
```

MVP Audit Log의 목적은 보안·중요행위 추적이다.

## 30.15 Public Submission Abuse Protection

MVP 구현 권장:

```text
submission_token Randomness
Assignment status check
Class Code 재발급
IP/token 단위 기본 Rate Limit
반복 실패 Delay/차단
```

정확한 수치는 환경 Config.

## 30.16 Privacy-aware Artifact Pipeline

현재 Artifact Role:

```text
ORIGINAL
PROCESSED
DERIVED
```

을 Privacy 확장에도 사용한다.

Production 목표:

```text
ORIGINAL
- Private
- Teacher-authorized access
        ↓
PII Redaction / Metadata removal
        ↓
PROCESSED
        ↓
External AI
```

원본을 Processed 파일로 덮어쓰지 않는다.

## 30.17 Production Gate

실제 Student Data를 사용한 운영 전 다음을 반드시 검토·완료한다.

```text
P-01 자동/반자동 PII Redaction
P-02 원본 이름/번호 영역 마스킹 후 외부 AI 전송
P-03 Provider의 학습 데이터 사용 여부
P-04 Provider 보존기간/처리지역/Subprocessor/삭제 정책
P-05 기관 승인 및 실제 학생 데이터 처리의 법적 근거
P-06 개인정보 처리방침/위탁/제3자 제공 고지
P-07 Retention Policy
P-08 Backup 삭제 정책
P-09 Student 삭제 시 연결 Data 삭제/비식별 정책
P-10 개인정보·재식별 사고 대응
P-11 연구/통계 가명정보 활용 시 별도 위험성/적정성 검토 및 관리대장
P-12 장기 Access Log 보관/점검 정책
P-13 개인정보/가명정보 취급자 Role 분리
P-14 외부 위탁/제3자 제공 계약 및 재위탁 통제
P-15 정기 Privacy/Re-identification Risk Review
```

Production Gate가 완료되지 않은 상태에서는 실제 Student 개인정보로 외부 AI 연동을 활성화하지 않는다.

## 30.18 Data Deletion / Incident Principle

MVP:
- `DATA_DELETE` 이벤트 Audit
- 필요한 Resource 삭제 API는 Ownership 검증

Production:

```text
Student
→ Submission
→ Artifact
→ StructuredInput
→ Analysis
→ Evidence
→ Growth 관계
```

에 대한 삭제/비식별 정책을 확정한다.

재식별/개인정보 사고:

```text
처리 중단
→ 접근 차단
→ 영향 범위 확인
→ 외부 Provider/수탁자 필요 시 회수·삭제
→ 데이터 파기
→ 조치 기록
```

## 30.19 Security Definition of Done

MVP 보안 완료 조건:

```text
✓ Google OAuth Session
✓ RLS
✓ Server Ownership
✓ Public Student API Separation
✓ Class Code + Number + Name Verification
✓ Uniform Failure Message
✓ PII-free QR/Token
✓ Private Storage + Signed URL
✓ UUID Storage Key
✓ Server-only Secrets
✓ Server-side AI
✓ AI PII Minimization
✓ Synthetic Demo Data
✓ Persistent Audit Log
```



---

# 31. Storage Path 권장 구조

```text
trace/
└─ teachers/{teacher_id}/
   ├─ activities/{activity_id}/
   │  ├─ source/
   │  └─ generated/
   ├─ submissions/{submission_id}/
   │  ├─ original/
   │  └─ processed/
   └─ batches/
      └─ ...
```

실제 Bucket 이름과 세부 Batch Path는 구현 시 확정 가능하다.

## 31.1 INPUT File Limits — MVP 기본값

```text
Image        ≤ 10 MB / file
PDF          ≤ 30 MB / file
PDF pages    ≤ 100 pages / file
CSV / XLSX   ≤ 10 MB / file
Batch Images ≤ 100 files / upload
```

- 제한값은 Config 상수로 관리한다.
- Client 사전검증과 Server 최종검증을 모두 적용한다.
- 제한 초과 시 이유와 허용 범위를 사용자에게 표시한다.
- 운영 환경에서 조정할 수 있지만 Module PRD가 서로 다른 값을 임의로 사용하지 않는다.

---

# 32. Teacher App Shell

모든 보호된 Teacher Route는 동일한 App Shell을 사용한다.

```text
┌──────────────┬────────────────────────────────────────┐
│ Sidebar      │ TopBar                                 │
│              │ Search | Class Selector | User Menu   │
│ 대시보드     ├────────────────────────────────────────┤
│ 학습 활동    │ Page Header                            │
│ 학습 결과    │                                        │
│ 분석         │ Main Content                           │
│ 리포트       │                                        │
│ 클래스 관리  │                                        │
│              │                                        │
│ 설정         │                                        │
│ 도움말       │                                        │
└──────────────┴────────────────────────────────────────┘
```

Sidebar 확정:

```text
대시보드
학습관리          → /results  (활동 | 학생별 자료 | 검토 대기 Tab)
평가관리          → /analysis
리포트            → /reports
클래스 관리        → /classes
공지사항          → 비활성(준비 중). 라우트 없음
────────
설정
도움말
────────
개인정보처리방침   → Modal (하단 고정)
```

**라벨과 라우트를 함께 바꾸지 않는다.** 사용자에게 보이는 라벨은 프로토타입 확정본을 쓰고, 내부 라우트는 `/results` `/analysis`를 그대로 유지한다.

`학습 활동`(`/activities`)은 독립 Top-level 메뉴에서 제외하고 **학습관리 내부 Tab**으로 흡수한다. 라우트 `/activities/*`는 유지한다.

Top-level 메뉴로 만들지 않는다.

```text
School
수집함
검토 대기
문항 은행
```

`검토 대기`는 학습관리 내부 Tab/Filter다.

`공지사항`은 사이드바에 표시하되 비활성 상태로 둔다. 구현 대상이 아니다.

---

# 33. TopBar

종이 프로토타입 확정본:

```text
[Greeting 2줄]  안녕하세요, {교사명} 선생님!
                오늘도 학생들의 성장을 함께 만들어요.
[Global Search] 검색어를 입력하세요
[Notification]  검토 대기 건수 Badge
[Help]          ?
[User Menu]     {교사명} 선생님 ▾
────────────────────────────────────────
[+ 학습자료 추가]  ← 전역 Primary Action, 우측 정렬
```

## 33.1 전역 Primary Action

`+ 학습자료 추가`는 **모든 보호된 Teacher Route에 상시 노출**되는 이 앱의 유일한 전역 Primary Action이다.

클릭 시 `AddMaterialModal`을 연다.

```text
AddMaterialModal
├─ 교사 일괄 업로드   → [일괄 업로드 시작]      → /results/upload
│                     → [카메라로 연속 촬영]     → Teacher Scan (§21)
└─ 학생 직접 제출     → [제출 링크 만들기]      → QRSharePanel
```

좌우 2분할 동일 비중으로 배치한다. CSV/XLSX Import는 이 Modal에 노출하지 않는다.

Class Selector는 Page 단위 FilterBar로 이동한다.

`School Selector`는 만들지 않는다.

DB에 School Entity가 없기 때문이다.

Class Selector는 `classes`를 사용한다.

---

# 34. Route Map

## Auth

```text
/login
/auth/callback
```

## Onboarding

```text
/onboarding/profile
/onboarding/class
/onboarding/roster
```

## Shared Teacher

```text
/dashboard
/classes
/classes/[classId]
```

## INPUT

```text
/activities
/activities/new
/activities/[activityId]
/activities/[activityId]/assign

/results
/results/add
/results/upload
/results/import
/results/[submissionId]
```

검토 대기:

```text
/results?inputStatus=REVIEW_PENDING
```

## PROCESS

```text
/analysis
/analysis/jobs/[jobId]
/analysis/[analysisId]/review
```

## OUTPUT

```text
/reports
/reports/classes/[classId]
/reports/students/[studentId]
```

## Student

```text
/submit/[token]
```

Route 변경이 필요하면 App Shell Contract 변경으로 보고한다.

---

# 35. Route Ownership

| Route | Owner |
|---|---|
| `/login`, `/auth/callback` | Shared |
| `/onboarding/*` | Shared + INPUT |
| `/classes/*` | Shared + INPUT |
| `/activities/*` | INPUT |
| `/results/*` | INPUT |
| `/submit/*` | INPUT |
| `/analysis/*` | PROCESS |
| `/reports/*` | OUTPUT |
| `/dashboard` | Shared View / 모듈 상태 집계 |

---

# 36. Dashboard

기본 Card는 실제 DB에서 계산 가능한 정보 중심으로 구성한다.

```text
진행 중 Activity
제출 현황
검토 대기
분석 준비 / 승인 완료
```

기본 Dashboard에 `평균 정답률`을 Hard-code하지 않는다.

PROCESS/OUTPUT의 승인된 분석 데이터로 실제 계산 가능한 경우에만 추가한다.

Hard-coded Demo 숫자를 완료 구현으로 인정하지 않는다.

---

# 37. 클래스 관리 UI

`/classes`

기능:

```text
Class 생성
Class 조회
학생명단 Import
Student 직접 추가/수정
Roster 조회
```

Class Detail:

```text
학생 명단
활동
```

명단 Import:

```text
Template
→ Upload
→ Validation
→ Preview
→ Save
```

---

# 38. 학습 활동 UI

`/activities`

표시:

```text
title
grade / subject
Standard
status
assigned class
submission summary
updated_at
```

`/activities/new`

생성 방식:

```text
직접 설정
자연어로 만들기
```

AI Activity Draft:

```text
교사 수정
AI 부분 수정
문항 추가/삭제/재정렬
확정 저장
```

AI Rubric 생성 기능은 만들지 않는다.

AchievementLevel은 Shared Curriculum Data를 사용한다.

---

# 39. 학습 결과 UI

`/results`는 INPUT Manage & Handoff의 중심이다.

Filter:

```text
Class
Subject
Standard
Student
Input Status
Process Status
```

Tab:

```text
전체
검토 대기
분석 준비
분석 중
승인 완료
```

View:

```text
Activity별
학생별
```

Activity Summary:

```text
submitted / total
missing
review pending
ready for process
approved
```

`READY_FOR_PROCESS`인 Submission을 선택하여 PROCESS에 넘긴다.

---

# 40. 자료 추가 UI

`/results/add`

세 경로:

```text
교사 이미지/PDF 업로드
학생 직접 제출
CSV/XLSX 결과 가져오기
```

Student Roster Import와 Student Result Spreadsheet Import는 서로 다른 기능이다.

---

# 41. Teacher Upload UI

Known Activity:

```text
ActivityAssignment 선택
→ Upload
→ Original Storage
→ Preprocess
→ Student Match
→ StructuredInput
→ 필요한 항목 Review
→ READY_FOR_PROCESS
```

Unknown Activity:

```text
Upload
→ Original Storage
→ Activity/Standard Candidate
→ Teacher Confirm
→ Student Match
→ StructuredInput
```

Stepper:

```text
1. 파일 업로드
2. 자료 정리 중
3. 연결 정보 확인
4. 저장 결과
```

Upload 완료 후 PROCESS 교육적 분석을 자동 실행하지 않는다.

최종 CTA:

```text
학습 결과에서 확인
```

---

# 42. AutoCapture 계약 — 멀티 디바이스 촬영

Student Submit과 Teacher Scan이 **공유하는 단일 촬영 구현**이다. 두 벌로 만들지 않는다.

## 42.1 Student Submit UI

Teacher App Shell을 사용하지 않는다.

```text
/submit/[token]
```

Flow:

```text
Activity 안내
→ Class Code
→ Number + Name
→ Roster Verification
→ AutoCapture  (또는 File Select Fallback)
→ Preview
→ Retake / Add Page
→ Submit
→ Complete
```

한 Submission에 여러 Artifact를 연결할 수 있다.

## 42.2 지원 기기 계약

특정 기기 전용으로 구현하지 않는다.

| 기기 | Camera 요청 | 처리 |
|---|---|---|
| Phone / Tablet | `facingMode: { ideal: 'environment' }` | 실패 시 제약 없이 재요청 |
| Chromebook | 전면 Webcam | Preview `transform: scaleX(-1)` · 저화질 임계 완화 |
| Laptop (Win/Mac) | 내장·외장 Webcam | `enumerateDevices()` 목록 제공 |
| Camera 없음 / 권한 거부 | — | File Select Fallback으로 자동 전환 |

```text
필수: Preview는 반전하되 저장 Frame은 반전하지 않는다.
```

기기 분기는 User-Agent가 아니라 `enumerateDevices()` 결과와 화면 방향으로 판단한다.

`getUserMedia`는 Secure Context에서만 동작한다. 로컬 IP 접속(`http://192.168.x.x`)에서는 카메라가 열리지 않는다. 시연·테스트는 배포 HTTPS URL로 한다.

## 42.3 자동 촬영 State Machine

```text
INIT → CALIBRATING → SEARCHING → FRAMED → STEADY → COUNTDOWN → CAPTURED → SEARCHING
                                    ↑__________________|
                                  (조건 이탈 시 복귀)
```

- `CALIBRATING`: 접속 직후 짧은 관찰 구간. 이 기기의 관측 최대 선명도를 기준으로 임계값을 정한다. **고정 상수 사용 금지.**
- `STEADY` 약 1초 유지 시 `COUNTDOWN` 진입. `COUNTDOWN` 중 조건 이탈 시 취소하고 `SEARCHING` 복귀.
- `CAPTURED` 후 자동으로 `SEARCHING`으로 돌아간다. 다음 장 촬영에 추가 조작이 필요 없다.

## 42.4 판정 신호 4종

매 Frame(Throttle 약 10fps) Video를 저해상도 Grayscale로 다운샘플하여 계산한다.

```text
coverage    문서 영역이 Frame에서 차지하는 비율 (하한·상한 모두 검사)
motion      직전 Frame 대비 평균 절대차 (정지 판정)
sharpness   Laplacian 근사 분산 (초점 판정, CALIBRATING 결과 기준 상대 임계)
exposure    평균 밝기 + 과다노출 픽셀 비율 (어두움·반사 판정)
```

- 분석 Canvas는 저해상도 고정. 저사양 Chromebook에서도 동작해야 한다.
- `requestVideoFrameCallback` 가용 시 사용, 아니면 Interval Fallback.
- 외부 Computer Vision 라이브러리를 도입하지 않는다.

## 42.5 촬영 결과 계약

```text
Full-resolution Frame → OffscreenCanvas → 장변 리사이즈 → JPEG 인코딩 → Blob
```

- Canvas 재인코딩으로 **EXIF(촬영 위치·기기 정보)가 제거**된다. 별도 EXIF 제거 로직을 추가하지 않는다.
- Blob은 제출 전까지 Client 메모리에만 유지한다. 자동 촬영 중 서버 전송 금지.
- Artifact 생성 시 `source_type`에 촬영 경로를 기록한다.

```text
STUDENT_CAPTURE
TEACHER_SCAN
FILE_UPLOAD
```

## 42.6 필수 Fallback — 3종 상시 제공

```text
[직접 촬영]       수동 Shutter. 자동 판정 무시
[자동 촬영 끄기]   자동 판정 Off. 선택 상태를 Client에 기억
[파일에서 선택]    input[type=file][accept=image/*][multiple]
```

권한 거부 시 Error 화면을 띄우지 않고 File Select 경로로 전환한다.

**자동 촬영 실패가 제출 실패가 되어서는 안 된다.**

## 42.7 Lifecycle · 안전

```text
화면 이탈 / visibilitychange hidden / Unmount
→ MediaStreamTrack.stop() 필수
```

카메라 LED가 계속 켜져 있는 상태를 남기지 않는다.

촬영 화면에 타 학생 정보를 표시하지 않는다.

## 42.8 상태별 안내 문구 (1줄 고정)

```text
SEARCHING            활동지를 화면 안에 맞춰 주세요
 coverage 하한 미달   조금 더 가까이 들어 주세요
 coverage 상한 초과   조금만 뒤로 물러나 주세요
 sharpness 미달       흔들리지 않게 들어 주세요
 exposure 반사        화면에 비치는 빛을 피해 주세요
FRAMED               좋아요, 그대로 들고 계세요
STEADY               곧 찍을게요
COUNTDOWN            3 · 2 · 1
CAPTURED             찍었어요! 다음 장을 들어 주세요
```

## 42.9 축소 구현 허용 범위 (Hackathon)

시간이 부족하면 판정 신호를 `coverage + motion` 2종으로 축소할 수 있다.

축소해도 **제거 금지** 항목:

```text
수동 Shutter
File Select Fallback
전면 Webcam Preview 반전
Track.stop() Lifecycle
```

---

# 43. PROCESS UI

`/analysis`

Shared DB의 Submission을 조회한다.

분석 가능 조건:

```text
input_status = READY_FOR_PROCESS
```

Analysis Setting:

```text
선택 Submission 수
Activity
Standard
Shared AchievementLevel
```

새 AI Rubric을 만들지 않는다.

---

# 44. Analysis Job UI

```text
/analysis/jobs/[jobId]
```

표시:

```text
상태
현재 단계
완료 수
실패 수
전체 수
```

사용자는 긴 작업 중 다른 화면으로 이동할 수 있어야 한다.

---

# 45. Analysis Review UI

```text
/analysis/[analysisId]/review
```

Desktop:

```text
Original Artifact
|
AI Analysis
```

Analysis Panel (종이 프로토타입 4카드 구조로 확정):

```text
[상단]  Achievement Level  ← Select 1개
[4카드]
 ① 강점          Strengths
 ② 어려운 점      Difficulties  (반복 오류는 이 카드 내부 Tag로 표기)
 ③ 근거          Evidence[]
 ④ 피드백 초안    Feedback Candidate
```

`Errors`를 독립 블록으로 분리하지 않는다. `② 어려운 점` 내부 Tag로 표현한다.

모든 필드는 Inline 편집 가능해야 한다.

Actions (프로토타입 순서 고정):

```text
수정
반려
승인
```

Panel 하단에 고정 주석을 표시한다.

```text
학생 이름과 번호는 AI로 전송되지 않습니다.
```

Evidence마다 Approval Button을 만들지 않는다.

Evidence 클릭 시:

```text
artifact_id
+ source_page
→ Original Viewer
```

MVP에서 좌표 단위 Highlight는 필수 아님.

---

# 46. OUTPUT UI

`/reports`

Filter:

```text
Class
Student
Subject
Standard
Period
```

Class Report:

```text
개요
공통 어려움
성취 분포
성장 인사이트
```

Student Report:

```text
성장 타임라인
영역 분석
강점 & 보완점
학습 기록
```

Approved Analysis/Evidence/GrowthEvent만 확정 근거로 사용한다.

OUTPUT 세부 범위는 OUTPUT Module PRD 검토에서 Product PRD와 함께 다시 구체화한다.

---

# 47. Follow-up Loop

TRACE의 전체 순환:

```text
INPUT
→ PROCESS
→ Approved Analysis/Evidence
→ OUTPUT
→ Feedback / Follow-up Candidate
→ Teacher Confirm
→ Follow-up Activity
→ INPUT
```

후속 Activity는:

```text
parent_activity_id
```

를 통해 기존 Activity와 연결할 수 있다.

Support/Feedback의 별도 물리 Table 여부는 최신 DB Schema에서 확정되지 않았으므로 OUTPUT Module PRD 검토 시 결정한다.

---

# 48. 공통 UI Status Mapping

## INPUT

| DB Enum | 사용자 표시 |
|---|---|
| `UPLOADING` | 업로드 중 |
| `STORED` | 저장 완료 |
| `PREPROCESSING` | 자료 정리 중 |
| `STRUCTURING` | 내용을 확인하는 중 |
| `REVIEW_PENDING` | 검토 대기 |
| `READY_FOR_PROCESS` | 분석 준비 |
| `FAILED` | 처리 실패 |

## PROCESS

| DB Enum | 사용자 표시 |
|---|---|
| `NOT_STARTED` | 미분석 |
| `READY_TO_ANALYZE` | 분석 대기 |
| `ANALYZING` | AI 분석 중 |
| `REVIEW_REQUIRED` | 분석 검토 필요 |
| `APPROVED` | 승인 완료 |
| `FAILED` | 분석 실패 |

기술 Enum 문자열을 그대로 사용자에게 노출하지 않는다.

---

# 49. Loading / Empty / Error / Partial Success

## Loading

```text
0~1초
→ 즉시 반응

1~3초
→ Spinner

3~10초
→ 현재 단계 표시

10초+
→ Progress / Count
```

## Empty

행동 가능한 CTA를 제공한다.

예:

```text
등록된 학생이 없어요.
[학생 명단 등록하기]
```

## Error

재시도 가능하면:

```text
다시 시도
파일 다시 선택
검토하기
```

를 제공한다.

## Partial Success

일부 실패를 전체 실패로 표시하지 않는다.

---

# 50. 공통 Component Contract

## Shell

```text
TeacherAppShell
Sidebar
TopBar
PageHeader
ContentSection
SplitPane
```

## Navigation

```text
ClassSelector
TabNav
Breadcrumb
BackButton
```

## Feedback

```text
StatusBadge
ProgressPanel
InlineAlert
EmptyState
ErrorState
Skeleton
```

## Data

```text
StatCard
ActivityCard
SubmissionRow
StudentRow
EvidenceCard
GrowthEventCard
FilterBar
DataTable
```

## Input

```text
SearchInput
SelectField
TextField
TextArea
UploadDropzone
FilePreview
RosterPreviewTable
Stepper
```

## Domain

```text
OriginalArtifactViewer
StructuredInputViewer
QRSharePanel
StudentVerificationForm
CapturePreview
AnalysisSummaryPanel
EvidenceList
TeacherReviewBar
```

## Capture

```text
AutoCaptureView        Camera Preview + 판정 Overlay + State Machine
CaptureGuideOverlay    가이드 프레임 + 1줄 안내 + Countdown Ring
CaptureFilmStrip       촬영 결과 Thumbnail 목록 · 삭제 · 다시 찍기
CameraPicker           enumerateDevices 기반 카메라 선택
FileFallbackInput      input[type=file][multiple] 대체 경로
```

`AutoCaptureView`는 Student Submit과 Teacher Scan이 공유한다. 모듈별로 중복 구현하지 않는다.

## Shell

```text
GreetingBlock
GlobalAddButton
AddMaterialModal
MaterialInfoModal
LegalModal
TraceWordmark
```

각 Module이 같은 역할의 Shell/Status Component를 중복 생성하지 않는다.

---

# 51. Frontend 구조 권장

```text
src/
├─ app/
│  ├─ (auth)/
│  ├─ auth/
│  ├─ (teacher)/
│  │  ├─ dashboard/
│  │  ├─ onboarding/
│  │  ├─ classes/
│  │  ├─ activities/
│  │  ├─ results/
│  │  ├─ analysis/
│  │  └─ reports/
│  └─ submit/[token]/
│
├─ components/
│  ├─ shell/
│  ├─ ui/
│  └─ shared/
│
├─ features/
│  ├─ auth/
│  ├─ classes/
│  ├─ activities/
│  ├─ input/
│  ├─ process/
│  └─ output/
│
├─ lib/
│  ├─ supabase/
│  ├─ api/
│  ├─ curriculum/
│  └─ validation/
│
└─ shared/
   └─ types/
```

기존 Repository 안에 구현한다.

별도 TRACE App을 병렬로 새로 만들지 않는다.

---

# 52. App Shell First Merge Gate

모듈 페이지를 본격 구현하기 전에 최소한 다음이 하나의 Shared UI로 존재해야 한다.

```text
TeacherAppShell
Sidebar
TopBar
PageHeader
Design Tokens
StatusBadge
ProgressPanel
EmptyState
ErrorState
ClassSelector
Protected Teacher Layout
Student Submit Layout
```

이 Gate는 세 모듈이 서로 다른 UI 뼈대를 만드는 것을 방지한다.

---

# 53. Module PRD 점검 시 사용할 기술 체크리스트

이 TRD 다음 단계는 Module PRD 검토다.

각 Module PRD를 볼 때 아래를 확인한다.

## INPUT PRD

```text
□ StudentAlias가 아니라 Student를 사용하는가?
□ Class/Roster가 선행 기능으로 포함되는가?
□ 세 입력 경로가 모두 있는가?
□ StructuredInput에 교육적 판단이 들어가지 않는가?
□ Original Artifact를 보존하는가?
□ input_status만 소유하는가?
□ PROCESS에는 submission_id[]를 넘기는가?
□ App Shell Route와 일치하는가?
```

## PROCESS PRD

```text
□ submission_id로 Shared DB를 조회하는가?
□ INPUT의 응답 인식을 반복하지 않는가?
□ Standard/AchievementLevel Shared Loader를 사용하는가?
□ Analysis를 버전으로 보존하는가?
□ Evidence가 Artifact로 추적되는가?
□ Analysis 전체가 승인 단위인가?
□ process_status만 소유하는가?
□ Long-running Job UX와 맞는가?
```

## OUTPUT PRD

```text
□ Approved Data만 최종 근거로 사용하는가?
□ Analysis/Evidence를 별도 복제하지 않는가?
□ GrowthEvent가 Approved Evidence에 근거하는가?
□ Report/Filter가 Shared ID를 사용하는가?
□ Follow-up이 Activity로 다시 연결되는가?
□ App Shell Route와 일치하는가?
```

---

## Security / Privacy 공통

```text
□ Google OAuth Session 검증이 있는가?
□ RLS + Server Ownership Check가 모두 있는가?
□ Student Public API가 Teacher Data Access와 분리되어 있는가?
□ QR/Token에 PII가 없는가?
□ Private Storage + Signed URL을 사용하는가?
□ Storage Key가 UUID 기반인가?
□ AI 호출이 Server-side인가?
□ AI Context에서 Student name/number/Teacher email을 제거하는가?
□ Demo/Test가 합성 Student Data만 사용하는가?
□ 주요 Event가 audit_logs에 기록되는가?
```


# 54. Prompt Plan 작성 시 고정할 공통 규칙

각 Module Prompt Plan은 최소한 다음 규칙을 상속한다.

```text
- 기존 TRACE Next.js App 안에서 구현한다.
- 새 앱을 생성하지 않는다.
- Shared Entity/DB Field/Status를 임의 변경하지 않는다.
- Shared App Shell을 재사용한다.
- Original Artifact를 보존한다.
- INPUT과 PROCESS의 책임을 섞지 않는다.
- Module 간 전체 Payload를 복제하지 않는다.
- submission_id 기반 Handoff를 사용한다.
- AI/DB/Storage/Auth의 가짜 성공을 구현하지 않는다.
- Student Public Route에서 Roster Table을 직접 조회하지 않는다.
- QR/Token/Object Key에 Student PII를 넣지 않는다.
- AI Context에서 Student name/number와 Teacher email을 제거한다.
- Hackathon에서는 실제 학생 데이터 대신 합성 데이터를 사용한다.
- 주요 보안 이벤트를 audit_logs에 남긴다.
- Shared Contract 변경이 필요하면 구현 전에 변경 필요성을 보고한다.
```

각 Module의 구체 Prompt는 해당 Module PRD에서 더 세분화한다.

---

# 55. 최신 문서와의 동기화 상태


## Privacy & Security 동기화

Product PRD의 Security 원칙에 따라 다음을 실제 MVP 구현으로 확정했다.

```text
Google OAuth + Session
Supabase RLS
Server Ownership Check
Student Public Submit API
Class Code + Number + Name
Uniform Verification Failure
PII-free QR/Token
Private Storage + Signed URL
UUID Storage Object Key
Server-only Secrets
Server-side AI
AI Context PII Minimization
Synthetic Demo Data
Persistent Audit Log
```

`audit_logs` Table은 본 TRD에서 새로 확정되었으며, 다음 Shared Database Schema Revision에서 반드시 반영한다.

자동 PII Redaction, 실제 학생 데이터 운영승인, Provider 계약/보존 정책, Retention/Backup 삭제, 재식별 대응 등은 Production Gate로 분리한다.


이 TRD는 다음 사항을 최신 네 문서에 맞춰 정규화했다.

```text
✓ Student를 공통 Entity로 사용
✓ StudentAlias를 Shared Entity에서 제거
✓ EvaluationContext를 Shared Entity에서 제거
✓ Extraction을 Shared Entity에서 제거
✓ Next.js + TypeScript + Supabase + Vercel 기준 확정 유지
✓ Google OAuth / Supabase Google Provider 확정 유지
✓ Class + Roster Setup 반영
✓ 세 INPUT 경로 반영
✓ Submission 중심 구조 반영
✓ StructuredInput JSONB 반영
✓ Original Artifact 보존 반영
✓ ActivityAssignment 반영
✓ Activity-Standard N:M 반영
✓ input_status / process_status Ownership 분리
✓ READY_FOR_PROCESS 조건 반영
✓ submission_id[] Handoff 반영
✓ Analysis Version 반영
✓ Analysis 전체 Teacher Approval 반영
✓ Evidence Original Trace 반영
✓ GrowthEvent 구조 반영
✓ Curriculum JSON/manifest 방식 반영
✓ Teacher/Student App Shell 분리 반영
✓ Route Map 반영
✓ Class Selector 반영
✓ School Entity 미생성 반영
✓ AI Rubric 생성 기능 제외
✓ 공통 Component Contract 반영
```

---

# 56. 아직 Module PRD 검토에서 확인해야 할 사항

다음은 이 TRD에서 임의 확정하지 않고 다음 단계에서 점검한다.

```text
PROCESS analysis_json의 정확한 JSON Schema
StructuredInput `response_type`별 세부 `response` Schema
GrowthEvent Teacher Review 이력의 물리 저장 방식
OUTPUT의 Support/Feedback 저장 구조
Report를 DB Entity로 저장할지 View/Generated Output으로 둘지
Activity Report의 정확한 Route/화면 구조
상담/교육기록 Output의 정확한 Scope
최종 VLM Provider / Model
PDF Library
Production Provider Privacy/DPA 및 데이터 보존·처리지역 정책
실데이터 Retention / Backup 삭제 정책
자동 PII Redaction 방식
```

이 중 Shared DB/Entity/Status 변경이 필요한 결정이 나오면 네 최신 기술 문서를 먼저 수정하고 TRD를 다시 동기화한다.

---

# 57. 최종 기술 불변조건

Module PRD 및 Prompt Plan은 아래를 임의로 바꾸지 않는다.

```text
1. TRACE는 하나의 Next.js App이다.
2. Next.js + TypeScript + Supabase + Vercel을 기본 Stack으로 사용한다.
3. Teacher Auth는 Supabase Google OAuth다.
4. 공통 학생 Entity는 Student다.
5. Class/Roster가 Student 자료 입력의 기준이다.
6. Student Submit 검증은 Class Code + Number + Name이다.
7. Submission이 학생 결과의 중심 Hub다.
8. Original Artifact는 보존한다.
9. StructuredInput은 submissions.structured_input JSONB다.
10. INPUT은 관찰 가능한 학생 응답까지 담당한다.
11. Standard/AchievementLevel은 Shared Curriculum Data를 사용한다.
12. INPUT→PROCESS는 submission_id[] 기반이다.
13. PROCESS는 Shared DB/Storage를 직접 조회한다.
14. input_status와 process_status Ownership을 분리한다.
15. Analysis 재분석은 새 Version이다.
16. Analysis 전체가 Teacher Approval 단위다.
17. Evidence는 Original Artifact로 추적 가능해야 한다.
18. OUTPUT은 승인된 교육적 판단만 확정 근거로 사용한다.
19. Teacher UI는 하나의 Shared App Shell을 사용한다.
20. School Entity와 AI Rubric 기능을 임의로 만들지 않는다.
21. Shared Contract 변경은 Module 구현 전에 팀 합의를 거친다.
22. Student Public Browser는 Roster Table을 직접 조회하지 않는다.
23. Student QR/Token/Storage Object Key에는 PII를 넣지 않는다.
24. Student Original Artifact는 Private Storage에 저장한다.
25. AI 호출은 Server-side이고 AI Context에서 Student name/number와 Teacher email을 제거한다.
26. Hackathon Demo/Test에는 합성 Student Data만 사용한다.
27. 주요 중요행위는 Persistent `audit_logs`에 남긴다.
28. Production Gate 완료 전 실제 Student Data의 외부 AI 전송을 활성화하지 않는다.
29. 촬영 구현은 AutoCaptureView 하나다. Student Submit과 Teacher Scan이 공유한다.
30. 촬영은 Phone / Tablet / Chromebook / Laptop에서 모두 동작해야 한다. 특정 기기 전용 구현을 만들지 않는다.
31. 수동 Shutter와 File Select Fallback은 항상 제공한다. 자동 촬영 실패가 제출 실패가 되어서는 안 된다.
32. Sidebar 라벨은 프로토타입 확정본, 라우트는 이 TRD의 Route Map을 유지한다. 둘을 함께 바꾸지 않는다.
33. `+ 학습자료 추가`는 모든 보호된 Teacher Route에 상시 노출되는 유일한 전역 Primary Action이다.
34. StructuredInput은 공통 Envelope(`schema_version`, `questions[].question_id`, `response_type`, `response`)를 유지한다.
35. 장시간 작업 상태는 Shared PostgreSQL `processing_jobs`에 영속화한다.
36. Class Code는 `class_code_expires_at`으로 실제 만료시각을 저장하고, 기본 TTL/Rate Limit은 공통 Config로 관리한다.
37. INPUT File Limit은 공통 Config 기본값과 Client/Server 이중 검증을 사용한다.
```

---

# 58. 이 TRD 이후의 문서 흐름

```text
최신 Product PRD
+
이 TRD
      ↓
INPUT PRD 검토·수정
PROCESS PRD 검토·수정
OUTPUT PRD 검토·수정
      ↓
각 Module PRD 확정
      ↓
Module별 Codex Issue / Prompt Plan
      ↓
공통 Shell → Module별 Issue 구현
      ↓
E2E Demo / Acceptance
```

이 TRD는 이 흐름에서 **공통 기술 계약을 고정하는 중간 기준문서**다.

제품 요구사항을 대체하지 않고, Module PRD의 세부 기능을 대신하지 않으며, 개별 Issue Prompt를 대신하지 않는다.

---

**End of TRACE Technical Requirements Document**
