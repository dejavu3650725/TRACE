# TRACE INPUT Module PRD

> **Document Status:** Module Baseline for Synchronization  
> **Module:** INPUT  
> **Parent Document:** TRACE Product PRD  
> **Technical Baseline:** TRACE TRD  
> **Primary Goal:** 교사가 이미 가지고 있거나 새로 생성한 학습자료와 학생 결과물을 최소한의 추가 업무로 TRACE에 수집하고, Activity·Student·Curriculum에 연결하여 PROCESS가 사용할 수 있는 구조화 데이터로 저장한다.

---

# 0. 문서 역할과 경계

이 문서는 **INPUT 모듈의 기능, UX, 처리 흐름, 통신 방식, 기술 구성, 오류 처리, 비기능 요구사항, 구현 순서**를 정의한다.

다음 항목은 본 문서에서 새로 정의하지 않고 `TRACE TRD`를 따른다.

- Teacher / Class / Student의 공통 정의
- Activity / ActivityAssignment / Submission / Artifact / StructuredInput의 공통 의미
- Standard / AchievementLevel의 공통 구조
- Submission → Analysis → Evidence 관계
- DB 내부 UUID와 Human-readable Code 분리 원칙
- `input_status` / `process_status` 분리 원칙
- INPUT → PROCESS Data Contract
- 공통 Storage / Auth / Security 원칙

INPUT PRD는 위 공통 계약을 **어떻게 실제 입력 기능으로 구현할지**에 집중한다.

## 0.1 Product PRD 동기화 기준

본 버전은 Product PRD와 다음 사항을 동일하게 사용한다.

- 교사 인증은 **Supabase Auth Google Provider 기반 Google OAuth**를 사용
- `Google로 계속하기` 하나의 진입점으로 신규 회원가입과 기존 로그인을 모두 처리
- 신규 Auth User는 TRACE Teacher Profile 생성 후 Class/Roster Onboarding
- 기존 Auth User는 기존 Teacher Profile/Class/Student/Activity 재사용
- 시연은 기존 로그인 이력이 있는 계정을 사용할 수 있으나 신규/기존 분기 로직은 실제 구현
- 학생자료 입력 전에 **Class 생성 + Student Roster 등록**을 선행 가능하게 구현
- Student Roster는 QR 본인검증, Batch Matching, CSV/XLSX 결과 Import, 제출/미제출 계산의 기준으로 사용
- 신뢰 가능한 관찰 응답은 자동 저장하고 불확실한 항목만 `REVIEW_PENDING`
- INPUT에서 AI Rubric 생성 제외, 기존 Standard/AchievementLevel 사용
- Activity ↔ Standard는 `activity_standards` N:M 관계를 사용하고 `standard_ids[]`를 Activity에 중복 저장하지 않음
- Student는 Class/Roster 기준으로 관리하고, Submission은 `Student × ActivityAssignment` 관계를 기준으로 생성
- 학생 제출 검증은 Class Code + Student Number + Name을 사용
- CSV/XLSX MVP는 TRACE 표준 Template 방식
- `StructuredInput = submissions.structured_input JSONB`
- StructuredInput은 공통 Envelope `schema_version + questions[].question_id + response_type + response`를 유지
- `input_status` / `process_status` 분리
- 관찰 응답 추출은 INPUT에서 완료하고 PROCESS에서 중복 추출하지 않음
- 기본 Stack은 Next.js + TypeScript + Supabase + Vercel
- Teacher App은 Shared `TeacherAppShell`을 재사용하고 Student Submit은 별도 Mobile Shell 사용
- INPUT Route는 TRD의 `/classes`, `/activities`, `/results`, `/submit/[token]` 계약을 사용
- 촬영은 Student Submit과 Teacher Scan이 공유하는 단일 `AutoCaptureView` 구현을 사용
- Phone / Tablet / Chromebook / Laptop을 동등 지원하고 카메라 없음·권한 거부 시 File Select로 전환
- 수동 촬영 / 자동 촬영 끄기 / 파일에서 선택 Fallback을 항상 제공
- 모든 보호된 Teacher Route에는 전역 Primary Action `+ 학습자료 추가`를 상시 노출
- MVP 보안 B안 14개를 실제 구현
- StructuredInput 공통 Envelope는 `schema_version / questions[].question_id / response_type / response`
- 장시간 INPUT 작업 상태는 Shared PostgreSQL `processing_jobs` Table에 영속화하고 `job_id`로 재조회
- Class Code는 `class_code_expires_at`에 실제 만료시각을 저장하며 기본 TTL은 24시간 Config
- Public Student Verification 기본 Rate Limit은 동일 IP + submission_token 기준 5분 내 실패 10회 초과 시 10분 제한이며 공통 Config로 관리
- INPUT File Limit 기본값은 Image 10MB, PDF 30MB/100pages, CSV/XLSX 10MB, Batch Image 100 files이며 공통 Config + Client/Server 이중 검증
- VLM Provider/Model은 Adapter 뒤에 두고 Prompt Plan 작성 전 최종 선택


---

# 1. INPUT 모듈 한 줄 정의

> **INPUT은 교사가 Google 로그인 후 Class와 Student Roster를 준비하고, 학습활동을 만들거나 기존 자료를 받아들이며, 학생 결과물을 수집·식별·구조화·저장한 뒤 원하는 범위를 PROCESS에 전달할 수 있게 만드는 모듈이다.**

INPUT의 종료점은 단순 업로드가 아니다.

```text
Google 로그인
        ↓
Class 생성 + Student Roster 등록
        ↓
학습활동 생성 또는 기존 자료 등록
        ↓
학생 결과 수집
        ↓
Activity / Student / Curriculum 연결
        ↓
문항 구조 및 관찰 가능한 학생 응답 구조화
        ↓
필요한 항목만 교사 검토
        ↓
Storage / DB 저장
        ↓
학습결과에서 상태 확인
        ↓
분석 범위 선택
        ↓
READY_FOR_PROCESS
```

---

# 2. 목표

## 2.1 제품 목표

1. 교사는 Google OAuth로 로그인하고 자신의 Class와 Student Roster를 준비할 수 있어야 한다.
2. Roster는 학생 본인 검증, 자동 Matching, 제출/미제출 현황 계산의 기준 데이터로 사용되어야 한다.
3. 교사가 이미 가지고 있는 종이·PDF·이미지·디지털 자료를 재작성하지 않고 TRACE에 넣을 수 있어야 한다.
4. 교사 자료 입력(파일 업로드 + 카메라 연속 스캔), 학생 직접 제출, CSV/XLSX Import의 3개 INPUT 경로를 모두 실제 기능으로 지원한다.
5. Activity 생성 시 구조화 입력과 자연어 입력을 모두 허용한다.
6. 기존 자료는 가능한 경우 Activity, 학년, 교과, 단원, 성취기준과 자동 연결한다.
7. 학생 결과는 학생별 Submission 단위로 분리되어 PROCESS와 OUTPUT에서 개별 접근 가능해야 한다.
8. AI/VLM 자동 인식 결과를 교사가 전부 하나씩 승인하게 하지 않고, 불확실하거나 교육과정 의미를 확정해야 하는 부분만 검토하도록 한다.
9. 자료 입력과 학습 분석을 분리하여, 업로드 직후 불필요한 AI 분석 비용을 발생시키지 않는다.
10. 처리 시간이 긴 경우 현재 상태와 진행 정도를 사용자에게 항상 보여주고, 페이지 이동·새로고침 후에도 `job_id`로 다시 조회할 수 있어야 한다.
11. 촬영은 특정 기기 전용으로 설계하지 않고 AutoCapture 실패가 제출 실패가 되지 않도록 항상 대체 경로를 제공한다.
---

# 3. 비목표

INPUT에서는 다음을 수행하지 않는다.

```text
정답/오답 판정
성취수준 판정
강점/어려움 해석
Evidence 생성
반복 오류 판단
피드백 생성
후속학습 추천
성장 분석
누적 패턴 생성
리포트 작성
```

핵심 경계:

```text
INPUT
"학생이 무엇을 제출했고, 무엇을 쓰거나 표시했는가?"

PROCESS
"그 결과가 교육적으로 무엇을 의미하는가?"
```

---

# 4. INPUT 모듈 구조

```text
INPUT
│
├─ I0. Class & Roster Setup
│   ├─ Google OAuth 로그인
│   ├─ Class 생성/조회
│   ├─ TRACE 학생명단 Template
│   ├─ CSV/XLSX Roster Import
│   ├─ Student 직접 추가/수정
│   ├─ Roster Validation
│   └─ 제출/미제출 기준 제공
│
├─ I1. Learning Activity
│   ├─ Activity 생성/수정
│   ├─ Curriculum 연결
│   ├─ AI Activity 생성
│   ├─ 직접 수정 + AI 부분 수정
│   ├─ PDF 생성
│   ├─ ActivityAssignment
│   └─ 학생 제출 QR
│
├─ I2. Collect
│   ├─ 교사 PDF/Image Upload
│   ├─ 교사 Camera Continuous Scan
│   ├─ 학생 QR/Direct Submit + AutoCapture
│   ├─ CSV/XLSX Import
│   ├─ 원본 Storage
│   └─ 이미지 품질 검사/전처리
│
├─ I3. Understand
│   ├─ 기존 자료 Activity Metadata 추출
│   ├─ 기존 Activity 후보 검색
│   ├─ 문항 구조 추출
│   └─ 관찰 가능한 학생 응답 구조화
│
├─ I4. Organize
│   ├─ Student/Roster Matching
│   ├─ Submission 구성
│   ├─ Artifact 연결
│   ├─ 일괄 PDF 학생별 논리 분리
│   └─ 검토 대기 처리
│
└─ I5. Manage & Handoff
    ├─ 학습결과 Activity View
    ├─ 상태/필터
    ├─ 검토 대기 해결
    ├─ 분석 범위 선택
    └─ PROCESS Handoff
```

---

# 5. 핵심 사용자 화면 명칭

모든 보호된 Teacher Route 우상단에는 Shared Shell의 전역 Primary Action **`+ 학습자료 추가`**를 상시 노출한다. INPUT 담당자가 화면별로 별도 CTA를 만들지 않는다.

`+ 학습자료 추가` 진입 후에는 다음 세 INPUT 경로를 선택할 수 있어야 한다.

```text
① 교사 자료 입력
   ├─ 파일 업로드
   └─ 카메라 연속 촬영
② 학생 직접 제출 링크/QR
③ CSV/XLSX 결과 Import
```

## 5.0 학급 관리

학생자료 입력에 앞서 교사가 자신의 Class와 Student Roster를 관리하는 영역.

주요 기능:
- Google 로그인 후 Teacher Session 확인
- Class 생성/조회
- TRACE 학생명단 Template 다운로드
- CSV/XLSX 학생명단 업로드
- 업로드 Preview/Validation
- Student 직접 추가/수정
- Roster 조회
- Activity별 제출/미제출 현황의 기준 데이터 제공

## 5.1 학습활동

교사가 Activity를 생성하고 관리하는 영역.

주요 기능:

- 새 Activity 만들기
- 기존 Activity 조회
- Class 배정
- 활동자료 수정
- PDF 생성
- 학생 제출 QR 생성

## 5.2 학습결과

학생 Submission을 Activity 단위로 관리하는 영역.

기본 View:

```text
Activity
  ↓
학생별 Submission
  ↓
Artifact
```

예:

```text
문단의 짜임 3차시
28명 제출 · 분석 준비 26 · 검토 대기 2
```

## 5.3 검토 대기

자동 처리 결과 중 교사 확인이 필요한 상태의 사용자 표시명.

예:

- 학생 이름/번호 인식 불확실
- Activity 자동 분류 불확실
- 학생 응답 구조화 실패
- 파일 인식 품질 부족

---


# 5.4 I0 — Google 로그인 · Class & Roster Setup

Class와 Student Roster는 INPUT의 학생자료 수집 기능이 동작하기 위한 선행 기준 데이터다.

## FR-CR01. 교사 Google OAuth 회원 Lifecycle

MVP 교사 인증은 **Supabase Auth Google Provider**를 사용한다.

사용자 UI는 별도 회원가입/로그인 화면으로 나누지 않고:

```text
[ Google로 계속하기 ]
```

하나의 진입점을 사용한다.

### 신규 사용자

```text
Google로 계속하기
→ Google OAuth
→ Supabase Auth User 생성
→ OAuth callback / Session 확정
→ teachers.auth_user_id 조회
→ Teacher Profile 없음
→ /onboarding/profile
→ 기본정보 설정(name 필수, nickname 선택)
→ TRACE Teacher Profile 생성
→ Class & Student Roster Onboarding
```

### 기존 사용자

```text
Google로 계속하기
→ Google OAuth
→ Supabase Auth 기존 User 확인
→ OAuth callback / Session 확정
→ teachers.auth_user_id 조회
→ 기존 Teacher Profile 로드
→ 기존 Class / Student / Activity 데이터 로드
→ Dashboard
```

### 요구사항
- 최초 Google 인증은 **회원가입을 겸한다**.
- 이후 동일 Google 계정 인증은 **로그인**으로 처리한다.
- 별도 이메일/비밀번호 회원가입은 MVP에서 제공하지 않는다.
- `auth.users.id`를 `teachers.auth_user_id`와 연결한다.
- Teacher Profile은 `name`을 필수로 저장하고 `nickname`은 화면 개인화를 위한 선택값으로 저장한다.
- 신규 사용자는 Teacher Profile이 없으면 `/onboarding/profile`에서 기본정보를 설정한다.
- Teacher Profile이 없을 때만 생성한다.
- 기존 Profile이 있으면 중복 Teacher를 만들지 않는다.
- TRACE 내부 관계는 `teachers.id` UUID를 사용한다.
- Google Access Token을 TRACE 내부 Teacher ID로 사용하지 않는다.
- 로그인 이후 본인 `teacher_id`에 속한 Class/Student/Activity만 접근한다.
- OAuth callback 및 Session 유효성 검증을 수행한다.

### 신규 사용자 Onboarding 완료 기준

```text
Teacher Profile 존재
+ name 저장 완료
+ Class 1개 이상 생성 가능
+ Student Roster 등록 가능
```

Roster가 아직 없으면 자료 입력 기능 진입 전 Class/Roster Setup을 안내한다.

### Hackathon Demo 정책
시연은 이미 Google OAuth 인증과 Teacher Profile 생성이 완료된 기존 계정을 사용할 수 있다.

그러나 구현 Acceptance는 신규/기존 사용자 양쪽 흐름을 모두 포함한다.

## FR-CR02. Class 생성

교사는 최소 다음 정보를 입력해 Class를 생성한다.

```text
grade
name
subject? (교과전담 등 필요한 경우)
```

저장:
```text
classes
- id
- teacher_id
- grade
- name
- subject
- class_code
```

## FR-CR03. Student Roster 표준 Template

MVP에서 TRACE 표준 CSV/XLSX 학생명단 양식을 제공한다.

필수 Column:

```text
student_number
student_name
```

필요 시 Class 정보는 업로드 화면에서 이미 선택된 `class_id`를 사용하며 파일에 반복 입력시키지 않는다.

## FR-CR04. Student Roster Import

```text
Class 선택
→ TRACE Roster Template 다운로드
→ 교사 작성
→ CSV/XLSX 업로드
→ Schema Validation
→ Preview
→ 교사 확인
→ students Insert/Update
```

Validation:
- 번호 필수
- 이름 필수
- 동일 Class 내 학생 번호 중복 차단
- 빈 행 무시
- 유효하지 않은 행은 저장 전에 표시

## FR-CR05. Student 직접 추가/수정

소수 학생 수정이나 전입생 추가를 위해 UI에서:

```text
번호
이름
```

을 직접 추가/수정할 수 있다.

## FR-CR06. Roster의 사용

저장된 Roster는 다음의 기준 데이터다.

```text
학생 QR
→ Class Code + Number + Name exact match

Batch Upload
→ VLM Number/Name ↔ Roster Matching

Digital Result Import
→ Student Roster Matching

제출현황
→ Class Student 전체 목록과 Submission 존재 여부 비교
```

제출/미제출 현황은 별도 원본 테이블을 만들지 않고 다음처럼 계산한다.

```text
해당 Class의 Student[]
-
해당 ActivityAssignment의 Submission.student_id[]
=
미제출 Student[]
```

---

# 6. I1 — 학습활동 생성 및 관리

## FR-A01. Activity 생성 진입 방식

Activity는 두 방식으로 생성할 수 있어야 한다.

### 구조화 입력

교사가 다음 중 일부를 선택 또는 입력한다.

```text
학년
교과
영역/단원
성취기준
활동 목적
활동 유형
자유 설명
```

모든 필드를 필수로 강제하지 않는다.

### 자연어 입력

예:

```text
"3학년 국어 문단의 짜임 단원에서 중심 문장과
뒷받침 문장을 연습하는 활동지를 만들어줘."
```

AI가 필요한 Metadata와 Activity Draft를 제안한다.

### 완료 조건

- 구조화 입력만으로도 Activity 생성 가능
- 자연어만으로도 Activity Draft 생성 가능
- 두 방식을 섞어 사용할 수 있음
- 교사가 AI 결과를 확인·수정한 후 저장

---

## FR-A02. Curriculum 연결

교육과정 및 성취수준 데이터는 Shared Core의 동일 JSON/Type을 사용한다.

처리 흐름:

```text
교사 입력 또는 자료에서 추출된 정보
→ 학년/교과/키워드 기준 Curriculum 후보 검색
→ 관련 Standard 범위 축소
→ 후보 표시 또는 AI 재판단
→ 교사 최종 선택
```

전체 Curriculum JSON을 매 요청마다 AI에 전달하지 않는다.

### 이유

- 토큰 절감
- 응답 속도 개선
- 존재하지 않는 성취기준 생성 위험 감소
- 교사 확인 범위 축소

---

## FR-A03. AI Activity Draft 생성

AI가 생성하는 최소 데이터:

```text
activity_title
activity_description
questions[]
question_type
instruction
standard_candidates[]
print_layout_data
```

성취수준 A/B/C 자체는 새로 생성하지 않고 Shared Core의 데이터를 참조한다.

---

## FR-A04. Activity 편집

교사는 AI가 생성한 Activity를 두 방식으로 수정할 수 있어야 한다.

### 직접 수정

- 문항 텍스트 수정
- 문항 추가
- 문항 삭제
- 문항 순서 변경
- 안내문 수정

### AI 부분 수정

예:

```text
"3번 문제를 더 쉽게 바꿔줘."
"이 문항을 서술형으로 바꿔줘."
"보기 3개를 만들어줘."
```

### 제외 범위

이번 구현에서는 다음 수준의 자유 편집기를 만들지 않는다.

- Canva 수준 자유 배치
- 텍스트박스 자유 이동
- 복잡한 도형 편집
- 완전한 WYSIWYG 문서 편집

---

## FR-A05. Activity 승인 및 Code 발급

```text
Draft
→ 교사 수정
→ 승인
→ ACTIVE 저장
→ Activity Code 발급
```

Activity Code의 정확한 문자열 규칙은 Shared Core / DB Schema를 따른다.

Draft 단계에서는 Code를 발급하지 않는다.

---

## FR-A06. PDF 생성

승인된 Activity는 실제 인쇄 가능한 PDF로 생성할 수 있어야 한다.

요구사항:

- A4 인쇄 가능
- 한글 렌더링 정상
- 문항/쓰기 영역이 잘리지 않음
- Activity 저장과 PDF 생성 성공 여부를 분리
- PDF 생성 실패 시 Activity 데이터는 유지

---

## FR-A07. ActivityAssignment

Activity는 한 Class에 직접 귀속하지 않고 Shared Core의 `ActivityAssignment`를 사용한다.

하나의 Activity를 여러 Class에 배정할 수 있어야 한다.

---

## FR-A08. 학생 제출 QR

교사가 Class에 배정한 Activity에 대해 학생 제출용 QR을 생성한다.

QR은 특정 ActivityAssignment와 연결한다.

QR/Short Link에 포함하지 않는 정보:

```text
Student name
Student number
Student ID
Teacher email
기타 개인 식별정보
```

학생은 접속 후 별도로 본인 정보를 검증한다.

`submission_token`은 추측하기 어려운 **Opaque Random Token**으로 생성한다.

```text
ActivityAssignment OPEN
→ 제출 허용

CLOSED / ARCHIVED
→ 제출 차단
```

Class Code:
- `classes.class_code_expires_at`에 실제 만료시각 저장
- 기본 TTL = 24시간이며 공통 Config로 관리
- 교사 즉시 재발급 가능
- 재발급 시 새 `class_code`와 새 만료시각을 저장하고 기존 Code는 즉시 무효

---

# 7. I2 — 학생 결과 수집

세 가지 입력 경로를 모두 필수 구현한다.

```text
① 교사 자료 입력
   - PDF/Image Upload
   - Camera Continuous Scan
② 학생 QR/Direct Submit
   - AutoCapture 또는 File Select Fallback
③ CSV/XLSX Import
```

세 경로는 서로 다른 UX를 가지지만 최종적으로 Shared Core의 Submission / Artifact / StructuredInput 구조로 수렴한다.

---

# 8. 입력 경로별 Activity 식별 원칙

AI로 Activity를 다시 추론해야 하는 경우와 그렇지 않은 경우를 분리한다.

| 입력 경로 | Activity 결정 방식 |
|---|---|
| 학생 QR 제출 | QR의 ActivityAssignment로 확정 |
| 특정 Activity 안에서 교사 업로드 | 현재 Activity/ActivityAssignment로 확정 |
| Teacher Scan | 촬영 전에 선택한 ActivityAssignment로 확정 |
| 교사 미분류 자료 업로드 | 자동 분류 후 기존 Activity 후보 탐색 |
| CSV/XLSX Import | 업로드 전 Activity 선택 |

**이미 Activity가 확정된 경로에서는 불필요한 Activity 추론을 하지 않는다.**

---

# 9. 학생 QR / Direct Submit

## FR-C01. 접속 및 학생 검증

```text
QR 접속
→ 학급 코드
→ 번호
→ 이름
→ Roster 검증
```

세 값은 모두 입력하도록 한다.

### 일치

```text
Class + Number + Name 일치
→ 촬영 화면 진입
```

### 불일치

```text
제출 차단
→ 학생이 바로 수정
```

Client에는 Roster 존재 여부를 추측할 수 없는 동일 메시지만 반환한다.

> 입력한 정보가 학급 정보와 일치하지 않습니다.

다음처럼 실패 원인을 노출하지 않는다.

```text
"12번은 존재하지만 이름이 다릅니다."
"김OO 학생은 7번입니다."
```

교사 검토 대기로 넘기기보다 학생이 현장에서 바로 수정하게 한다.

---


## FR-C01A. Public Student Verification API

Student Browser는 `students` Table을 직접 조회하지 않는다.

```text
Student Browser
→ Public Submit API
→ Server
→ submission_token 확인
→ Class Code 확인
→ Number + Name Roster exact match
→ 성공/실패 최소 응답
```

검증 입력:

```text
submission_token
class_code
student_number
student_name
```

Rate Limit:

```text
동일 IP + submission_token
5분 내 검증 실패 10회
→ 10분 제한
```

성공 시 실패 누적은 초기화할 수 있다.


---

## FR-C02. AutoCapture — 학생 제출 촬영

학생 제출과 Teacher Scan은 **동일한 `AutoCaptureView` 구현**을 공유한다. 촬영 기능을 학생용/교사용으로 두 벌 만들지 않는다.

지원 기기:

```text
Phone / Tablet
Chromebook
Laptop (Windows / macOS)
Desktop + external camera
카메라 없음 / 권한 거부 → File Select Fallback
```

기기 판별은 User-Agent가 아니라 실제 사용 가능한 camera device와 화면 방향을 기준으로 한다.

기본 흐름:

```text
Camera Preview
→ 화면 채움 / 정지 / 선명도 / 밝기·반사 판정
→ 조건이 짧게 안정되면 자동 촬영
→ Preview Strip
→ 다음 장 대기
→ Submit
```

반드시 함께 제공하는 Fallback:

```text
[직접 촬영]
[자동 촬영 끄기]
[파일에서 선택]
```

카메라 권한이 없거나 사용할 수 없으면 오류 화면에서 막지 않고 File Select로 자연스럽게 전환한다.
한 Submission에 여러 Artifact를 허용한다.

### Capture Lifecycle / Privacy

- 촬영 영상 frame은 제출 전까지 Client memory에서만 처리한다.
- 촬영/선택 이미지는 재인코딩하여 EXIF 위치·기기 정보를 제거한다.
- 화면 이탈 또는 background 진입 시 active media track을 즉시 `stop()`한다.
- 전면 웹캠의 좌우 반전은 preview에만 적용하고 저장 이미지에는 적용하지 않는다.

---

## FR-C03. 촬영 품질 안내

제출 전 기본 품질 문제를 가능한 범위에서 탐지한다.

예:

- 너무 밝음
- 너무 어두움
- 심하게 흐림
- 기울어짐
- 주요 영역 잘림

문제가 있으면 재촬영을 권장한다.

```text
사진이 너무 밝아요.
글씨가 잘 보이도록 다시 촬영해 주세요.

[다시 촬영]
[그래도 제출]
```

---

# 9.1 Teacher Scan — 카메라 연속 촬영

교사는 노트북·크롬북 웹캠 또는 태블릿 카메라로 종이 활동지를 연속 촬영할 수 있어야 한다. Student Submit과 동일한 `AutoCaptureView`를 사용하고 촬영 이후에만 교사 전용 흐름으로 분기한다.

```text
ActivityAssignment 선택
→ AutoCapture
→ Frame[] / Blob[] 누적
→ 촬영 종료
→ Original Storage
→ Artifact[]
→ Student Match
→ StructuredInput
→ 불확실 항목만 REVIEW_PENDING
→ READY_FOR_PROCESS
```

학생 직접 제출과의 차이:

```text
Student Submit = 학생이 이미 검증되어 있음
Teacher Scan = 촬영 후 Student Matching 필요
```

Capture 이후 Storage / Preprocess / Matching / StructuredInput Pipeline은 기존 Teacher Upload와 동일하게 합류한다.

---

# 10. 교사 일괄 PDF/Image Upload

## FR-C04. 원본 보존

교사가 올린 Batch PDF/Image를 먼저 원본 Artifact로 Storage에 저장한다.

원본은 이후 분리/보정 과정에서 덮어쓰지 않는다.

---

## FR-C05. 학생별 Submission 분리

교사 스캔 순서는 학생 번호순이라고 가정하지 않는다.

처리:

```text
Batch PDF
→ 페이지 단위 이해
→ 이름/번호 인식
→ Roster 비교
→ 학생별 Submission 연결
```

한 학생의 활동지가 여러 페이지인 경우 동일 Submission에 여러 페이지/Artifact를 연결한다.

---

## FR-C06. 학생 Matching

기본 판단 정보:

```text
Class
Student Number
Student Name
Activity
```

정확하게 일치:

```text
→ 자동 연결
```

불확실 / 누락:

```text
→ 검토 대기
```

교사가 검토 대기 화면에서 후보 학생을 선택하여 해결할 수 있어야 한다.

---

## FR-C07. Batch 원본과 Page Range

원본 PDF를 학생 수만큼 복제할 필요는 없다.

예:

```text
batch.pdf
├─ Student A Submission → p.1~2
├─ Student B Submission → p.3~4
└─ Student C Submission → p.5~6
```

Artifact는 Shared Core에서 정의한 PDF Page Range 참조를 지원한다.

학생 매칭 전에는 Batch ORIGINAL과 미확정 Page Range Artifact를
`owner_teacher_id`로 현재 Teacher에게 귀속한다. 학생 매칭 후에는 같은
`storage_path`와 `source_artifact_id`를 사용하는 Submission별 논리 참조만
추가하며 PDF Binary를 다시 업로드하지 않는다.

---

# 11. CSV/XLSX Import

## FR-C08. TRACE 표준 양식

해커톤 필수 범위에서는 표준 양식을 제공한다.

```text
[TRACE 입력 양식 다운로드]
→ 교사 작성
→ CSV/XLSX 업로드
→ Schema Validation
→ 미리보기
→ Import
```

Activity는 업로드 전에 선택한다.

기본 Column 예:

```text
class
student_number
student_name
question_1
question_2
...
```

---

## FR-C09. 임의 CSV/XLSX 확장

이번 필수 범위에는 포함하지 않는다.

향후:

```text
임의 Header 분석
→ TRACE 자동 Mapping
→ Confidence 표시
→ 불확실한 Column만 교사 확인
```

교사가 처음부터 모든 Column을 직접 Mapping하는 UX는 기본 방식으로 두지 않는다.

---

# 12. 이미지 품질 검사 및 전처리


## FR-P00. Private Storage / Object Key

Original/Processed Artifact는 Private Supabase Storage에 저장한다.

Object Key는 Student PII를 포함하지 않는다.

```text
teachers/{teacher_id}/submissions/{submission_id}/original/{artifact_uuid}.{ext}
```

금지 예:

```text
김하늘_12번_수학평가.pdf
```

Viewer 또는 외부 AI가 파일 URL을 필요로 할 때:

```text
Server Ownership Check
→ 짧은 만료 Signed URL
```

을 생성한다.

Permanent Public URL을 사용하지 않는다.

Processed Image 생성 시 가능한 범위에서 EXIF/위치 Metadata를 제거한다.


---

## FR-P01. 원본/가공본 분리

```text
Original Artifact
→ Quality Check
→ 필요 시 Preprocessing
→ Processed Artifact
→ VLM Input
```

원본을 덮어쓰지 않는다.

---

## FR-P02. 전처리 범위

코드 기반으로 다음 기능을 지원할 수 있어야 한다.

```text
Brightness adjustment
Contrast adjustment
Rotation correction
Deskew
Crop
Resize
Compression
PDF page rendering
```

VLM 자체에 “사진을 밝게 만들어라”라고 맡기기보다, 서버에서 보정된 파일을 만들어 VLM에 전달한다.

---

## FR-P03. 실패 처리

교사 Batch 자료는 이미 다시 촬영하기 어려울 수 있으므로:

```text
원본
→ 자동 보정
→ 구조화 재시도
→ 실패
→ 검토 대기
```

로 처리한다.

---


# 12.1 INPUT File Limit

Hackathon MVP의 **공통 Config 기본값**은 다음과 같다. Module PRD나 화면별 구현에서 서로 다른 값으로 임의 변경하지 않는다.

```text
Image        ≤ 10 MB / file
PDF          ≤ 30 MB / file
PDF pages    ≤ 100 pages / file
CSV / XLSX   ≤ 10 MB / file
Batch Images ≤ 100 files / upload
```

Client에서 가능한 범위의 사전검증을 수행하고 Server에서 동일한 공통 Config 기준으로 최종 검증한다. Client 검증만으로 통과 처리하지 않는다.

초과 시:
- 업로드/처리를 시작하지 않음
- 허용 범위를 사용자에게 표시
- 이미 성공한 다른 Batch 파일은 유지


---

# 13. I3 — 자료 이해 및 구조화

## FR-U01. 기존 자료 Metadata 추출

Activity가 사전에 확정되지 않은 교사 업로드에서만 다음 후보를 추출한다.

```text
grade
subject
domain
unit
standard_candidates[]
activity_type
title_candidate
```

---

## FR-U02. 기존 Activity 후보 검색

자동 추출한 Metadata를 이용하여 DB의 기존 Activity를 먼저 검색한다.

```text
자료 분류
→ 기존 Activity 후보 검색
→ 후보 있음
   → 기존 Activity 연결 제안
→ 후보 없음
   → 신규 Activity 후보 생성
```

UI 예:

```text
비슷한 학습활동이 있어요.

수학익힘책 42~43쪽

[기존 활동에 연결]
[새 활동으로 만들기]
```

학생 QR 제출이나 Activity 내부 업로드에서는 이 과정을 생략한다.

---

## FR-U03. 문항 구조 추출

가능한 범위에서 문항을 구조화한다.

예시 유형:

```text
short_text
long_text
multiple_choice
checkbox
matching
underline
circle
drawing_or_mark
unknown
```

실제 Enum은 DB/Type 정의에서 최종 확정한다.

---

## FR-U04. 관찰 가능한 학생 응답 추출

INPUT이 구조화하는 것은 **관찰 가능한 응답**이다.

예:

```json
{
  "question_id": "Q2",
  "response_type": "long_text",
  "raw_response": "우리 반 친구들은 서로 도와줍니다."
}
```

또는:

```json
{
  "question_id": "Q1",
  "response_type": "selection",
  "selected_option": 3
}
```

가능한 대상:

- 손글씨
- 선택 보기
- 체크
- 동그라미
- 밑줄
- 물결선
- 선 잇기 결과
- 빈칸
- 간단한 표시

INPUT에서는 이 응답이 정답인지, 어떤 성취수준인지 판단하지 않는다. PROCESS는 저장된 `StructuredInput`을 사용하며 동일 학생 응답을 다시 추출하는 것을 기본 흐름으로 두지 않는다.

---


## FR-U04A. StructuredInput 공통 Envelope

INPUT이 저장하는 `submissions.structured_input`은 다음 공통 Envelope를 따른다.

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
    },
    {
      "question_id": "Q2",
      "response_type": "long_text",
      "response": {
        "raw_text": "우리 반 친구들은 서로 도와줍니다."
      }
    }
  ]
}
```

공통 필수 축:

```text
schema_version
questions[].question_id
questions[].response_type
questions[].response
```

`response` 내부는 `response_type`별로 확장한다.

예:

```text
selection   → selected_option
long_text   → raw_text
checkbox    → selected_options[]
underline   → marked_text / region reference
circle      → marked_option / region reference
drawing_or_mark → observation payload
unknown     → raw payload
```

세부 response Schema는 Prompt Plan에서 구현 Issue별로 확정할 수 있으나 공통 Envelope를 변경하지 않는다.


---

## FR-U05. Structured Output Validation

VLM 응답은 자유 텍스트보다 Structured JSON을 우선한다.

```text
VLM Response
→ JSON Schema Validation
→ 성공
   → submissions.structured_input(JSONB) 저장
→ 실패
   → 자동 Retry 1회
→ 재실패
   → 검토 대기
```

---

# 14. I4 — Organize

## FR-O01. Submission 구성

Shared Core에 따라:

> **Student 1명 × ActivityAssignment 1개 = Submission**

한 Submission에는 여러 Artifact가 연결될 수 있다.

재촬영/재제출은 Shared Core의 Attempt/Version 정책을 따른다.

---

## FR-O02. Submission Code

Submission 저장 후 Human-readable Submission Code를 발급한다.

사용자가 직접 입력할 필요는 없다.

Code는 다음 목적으로 사용한다.

- 운영/디버깅
- 파일 식별
- PROCESS 연결 확인
- 재제출 추적

정확한 Code 형식은 Shared Core / DB Schema를 따른다.

---

## FR-O03. 자동 확정과 검토 대기 구분

### 자동 확정 가능

- QR로 Activity가 확정됨
- Roster exact match
- 정상 파일 저장
- JSON Schema 정상

### 검토 대기

- 학생 이름/번호 인식 불확실
- Activity 후보 불확실
- 문항 구조/응답 추출 실패
- 파일 품질 부족
- 자동 처리 재시도 실패

---

# 15. 교사 검토 정책

모든 학생 자료를 한 개씩 승인하게 하지 않는다.

## 15.1 Activity Metadata

자동 분류로 만들어진 Activity/Standard 후보는 교사가 최종 확인한다.

```text
자동 후보
→ 수정 또는 승인
```

## 15.2 Student Matching

```text
Roster exact match
→ 자동 확정

불확실
→ 검토 대기
```

## 15.3 StructuredInput

관찰 가능한 응답은 자동 저장 가능하다.

정답/성취수준/Evidence 등 교육적 판단은 PROCESS의 Teacher Approval Gate에서 처리한다.

---

# 16. I5 — 학습결과 관리

## FR-M01. Activity 중심 View

학습결과 기본 단위는 파일이 아니라 Activity다.

예:

```text
학습결과

문단의 짜임 1차시
28명 제출 · 분석 준비 27 · 검토 대기 1

문단의 짜임 2차시
26명 제출 · 미제출 2
```

Activity 클릭:

```text
Activity
→ 학생별 Submission
→ Artifact
```

---

## FR-M02. 상태 표시

최소 사용자 표시:

```text
전체
처리 중
분석 준비
검토 대기
미제출
처리하지 못함
```

내부 상태값은 Shared Core의 `input_status`를 따른다.

---

## FR-M03. Filter

최소 필터:

```text
학급
교과
성취기준
학생
기간
상태
```

필터를 위한 정보는 INPUT 구조화/연결 과정에서 DB에 저장되어 있어야 한다.

---

## FR-M04. 검토 대기 해결

교사는 검토 대기 항목에서 다음 행동을 할 수 있어야 한다.

```text
학생 다시 연결
Activity 다시 연결
인식된 값 수정
재처리 요청
원본 확인
```

해결 후 `READY_FOR_PROCESS` 조건을 다시 평가한다.

---

# 17. 분석 범위 선택 및 PROCESS Handoff

## FR-H01. 분석 범위 선택

교사는 다음 단위로 분석 대상을 선택할 수 있어야 한다.

```text
Activity 전체
특정 학생
선택 학생
필터 결과
```

기간 필터와 결합할 수 있다.

---

## FR-H02. Handoff 조건

TRD의 최소 조건을 그대로 따른다.

```text
Student 확정
+ ActivityAssignment 확정
+ Original Artifact Storage 저장 성공
+ Artifact DB Record 존재
+ StructuredInput 저장 성공
```

충족:

```text
input_status = READY_FOR_PROCESS
```

PROCESS는 Shared Core Data Contract의 ID를 사용해 동일 Submission을 읽는다.

모듈 간 전달 원칙:

```text
INPUT
→ Shared DB/Storage에 저장
→ input_status = READY_FOR_PROCESS
→ 분석 실행 시 submission_id[] 전달

PROCESS
→ 전달받은 submission_id로 Shared DB 조회
→ StructuredInput / Activity / Student / Standard / Artifact 참조
```

INPUT은 학생 응답 전체를 PROCESS용 별도 JSON으로 복제하여 전달하지 않는다.

---


# 17.1 INPUT UI / Route Contract

Teacher Route는 Shared `TeacherAppShell` 안에서 동작한다.

```text
/classes
/classes/[classId]

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

Student 제출:

```text
/submit/[token]
```

`/submit/[token]`은 TeacherAppShell을 사용하지 않고 Mobile-first Student Submit Shell을 사용한다.

INPUT 담당자는 별도 Sidebar/TopBar/Layout을 새로 만들지 않고 Shared Shell을 재사용한다.

모든 보호된 Teacher Route에서는 Shared Shell의 `+ 학습자료 추가`를 유일한 전역 Primary Action으로 사용한다. 화면마다 경쟁하는 전역 CTA를 추가하지 않는다.


---

# 18. 데이터 통신 방식

## 18.1 기본 구조

```text
Client
Next.js / TypeScript
      │
      │ HTTPS / JSON
      ↓
TRACE Server Layer
      │
      ├─ Supabase PostgreSQL
      ├─ Supabase Storage
      ├─ Curriculum Service
      ├─ Image Preprocessing
      ├─ PDF Service
      └─ AI/VLM Adapter
```

---

## 18.2 원칙

### Client → Server

- Metadata: JSON
- File: multipart upload 또는 Signed Upload
- 학생 QR URL: 공개 Token 기반 접근
- API Key는 Client에 노출하지 않음

### Server → DB/Storage

```text
파일 → Storage
메타데이터/상태/관계 → PostgreSQL
```

### Server → AI/VLM

```text
Server
→ Privacy Context Builder
→ VLM Adapter
→ Provider
```

Provider를 Frontend에서 직접 호출하지 않는다.

---

# 19. 처리 작업과 상태 통신

장시간 작업은 동기 요청 하나로 화면을 오래 막지 않는다.

Hackathon MVP에서는 Shared `processing_jobs` Table + Polling을 사용한다.

```text
사용자 작업 시작
→ processing_jobs row 생성
→ job_id 반환
→ 서버 단계 처리
→ processing_jobs 진행상태 업데이트
→ Client Polling
→ 완료 시 UI 갱신
```

필드:

```text
job_id
job_type
status
total_count
completed_count
failed_count
current_step
error_message
```

Job Status는 TRD의 `processing_job_status` 계약을 그대로 사용한다.

```text
QUEUED
PROCESSING
REVIEW_REQUIRED
COMPLETED
FAILED
```

Job Status는 `input_status` / `process_status`를 대체하지 않는다.

`payload_json`에는 전체 Student/Submission 데이터를 복제하지 않고 필요한 ID만 저장한다.

---

# 20. 기술 구성

## 20.1 확정 기본 스택

```text
Next.js
TypeScript
Supabase
- PostgreSQL
- Auth
- Storage

Vercel

AI / VLM Adapter
- OpenRouter / Gemini 등 Provider 교체 가능
```

---

## 20.2 권장 구현 라이브러리

### 데이터 검증

```text
Zod
```

용도:

- API Request Validation
- VLM Structured Output Validation
- CSV/XLSX Schema Validation
- Shared Type과 Runtime Validation 연결

### 이미지 전처리

```text
Sharp
```

용도:

- resize
- rotate
- brightness
- contrast
- compression
- 기본 crop/format 변환

### CSV/XLSX

```text
SheetJS(xlsx)
```

용도:

- TRACE Template 생성
- XLSX/CSV Parsing
- Header/Data Validation

### QR

```text
qrcode 또는 react-qr-code
```

### PDF

Activity 출력과 Batch PDF 처리는 목적이 다르므로 분리한다.

- Activity 인쇄 PDF: 구조화된 Activity Data → PDF 생성
- Batch PDF: Page count / page reference / 필요 시 page rendering

정확한 PDF Library는 한글 렌더링과 Vercel 실행 가능성을 작은 Spike로 확인한 뒤 결정한다.

후보:

```text
@react-pdf/renderer
pdf-lib
```

---

# 21. API 기능 계약 초안

정확한 URL Naming은 팀 공통 규칙에 맞춰 확정한다.

## Auth / Class / Roster

```text
Google Login / OAuth Callback
POST /api/classes
GET  /api/classes
GET  /api/classes/:classId/students
POST /api/classes/:classId/students
POST /api/classes/:classId/students/import
```

`students/import`는 TRACE 표준 학생명단 CSV/XLSX를 받아 Preview/Validation 후 저장한다.

## Google Auth / Class / Roster

- Google OAuth 로그인 성공
- Supabase Session 유지
- Teacher ↔ auth_user_id 연결
- Class 실제 DB 저장
- 학생명단 표준 CSV/XLSX Import
- Roster Preview / Validation
- Student 실제 DB 저장
- Student 직접 추가/수정
- 등록 Roster 기반 QR/Batch Matching 가능
- ActivityAssignment 기준 제출/미제출 계산 가능

## Activity

```text
createActivity
generateActivityDraft
updateActivity
reviseQuestionWithAI
approveActivity
generateActivityPdf
assignActivityToClass
createSubmissionQr
```

## Collect

```text
uploadArtifact
createStudentSubmission
uploadBatch
downloadSpreadsheetTemplate
importSpreadsheet
```

## Understand

```text
classifyUnassignedArtifact
extractStructuredInput
findActivityCandidates
retryExtraction
```

## Organize

```text
matchStudent
resolveStudentMatch
resolveActivityMatch
resolveReviewPending
```

## Manage

```text
getActivityResultSummary
getActivitySubmissions
filterLearningResults
handoffToProcess
```

REST Route Handler / Server Action 중 구체 방식은 팀 코드 구조에 맞춰 선택한다.

---

# 22. 상태 모델과 사용자 표시

Shared Core의 `input_status`를 사용하되 사용자에게 기술 Enum을 그대로 노출하지 않는다.

| input_status | 사용자 표시 예 |
|---|---|
| UPLOADING | 업로드 중 |
| STORED | 업로드 완료 |
| PREPROCESSING | 자료를 정리하는 중 |
| STRUCTURING | 내용을 확인하는 중 |
| REVIEW_PENDING | 검토 대기 |
| READY_FOR_PROCESS | 분석 준비 |
| FAILED | 처리하지 못함 |

`process_status`는 PROCESS 모듈에서 관리한다.

---

# 23. Long-running Operation UX

## NFR-01. Progress Visibility

> **빈 화면 또는 무응답 상태를 허용하지 않는다.**

예상 처리시간별 UI:

```text
0~1초
→ 즉시 반응

1~3초
→ Spinner + 상태 문구

3~10초
→ 현재 단계 표시

10초 이상
→ 완료/처리 중/실패 수 또는 Progress 표시
```

예:

```text
학생 자료를 정리하고 있어요.

✓ 파일 업로드 완료
✓ 이미지 보정 완료
● 학생 정보를 연결하고 있어요
○ 답안을 정리할 예정이에요
○ 저장
```

Batch 예:

```text
28명의 자료를 처리하고 있어요.

완료 21
처리 중 3
검토 대기 2
대기 2
```

가능하면 사용자가 다른 화면으로 이동해도 처리 상태가 유지되어야 한다.

---

# 24. 오류 처리

## 24.1 AI/VLM 실패

```text
1차 실패
→ 자동 Retry 1회

2차 실패
→ 검토 대기
```

---

## 24.2 Schema Validation 실패

```text
Structured Output
→ Validation 실패
→ Retry
→ 재실패
→ 검토 대기
```

---

## 24.3 Batch 부분 실패

한 학생의 오류 때문에 Batch 전체를 실패시키지 않는다.

예:

```text
28명
→ 26명 분석 준비
→ 2명 검토 대기
```

---

## 24.4 업로드 실패

- 실패한 Artifact를 성공 상태로 기록하지 않는다.
- 사용자에게 재시도 가능 상태를 제공한다.
- 이미 성공한 다른 Artifact는 유지한다.

---

# 25. 비기능 요구사항

## NFR-02. Original Preservation

Original Artifact는 자동 보정·AI 처리 과정에서 덮어쓰지 않는다.

## NFR-03. Partial Failure Isolation

한 Submission 또는 Artifact의 실패가 다른 학생 데이터 처리에 영향을 주지 않는다.

## NFR-04. Idempotency

중복 클릭/네트워크 재전송으로 같은 Submission 또는 Artifact가 의도치 않게 중복 생성되지 않아야 한다.

## NFR-05. Multi-device Student Capture

학생 촬영 화면은 Phone / Tablet / Chromebook / Laptop에서 동등하게 사용할 수 있어야 한다. 특정 기기 전용 구현을 만들지 않는다. 작은 화면에서는 mobile-first 배치를 사용하되 기능 범위는 동일해야 한다.

필수:

```text
촬영
미리보기
재촬영
한 장 더
제출
```

## NFR-06. Validation

저장 전 가능한 범위에서 다음을 검증한다.

```text
Activity 존재
Student/Class 일치
파일 형식/크기
Structured JSON Schema
Spreadsheet Schema
```


## NFR-07. Security & Privacy

INPUT은 Product PRD/TRD의 Security B안 14개를 실제 MVP 구현에 반영한다.

### 1. Google OAuth + Session
- Supabase Auth Google Provider
- OAuth callback / Session 검증
- 보호된 Teacher Route/API는 Session 필수

### 2. Supabase RLS
최소:
```text
teachers → 본인
classes → 본인 teacher_id
students → 본인 Class
activities → 본인 Activity
activity_assignments → 본인 Activity/Class
submissions/artifacts → 본인 Assignment 범위
audit_logs → 본인 Resource 범위
```

### 3. Server Ownership Check
RLS와 별도로 Server에서 Class/Student/Activity/Assignment/Submission/Artifact 소유권을 재검사한다.

### 4. Student Public API 분리
Student Browser는 Roster Table을 직접 SELECT하지 않는다.

### 5. Student Verification
```text
submission_token + Class Code + Number + Name
```
을 Server에서 검증한다.

### 6. Uniform Failure
Client에는 학생 존재 여부를 추측할 수 없는 동일 실패 메시지를 반환한다.

### 7. PII-free QR/Token
QR/Token에 Student name/number/id, Teacher email을 포함하지 않는다.

### 8. Private Storage + Signed URL
Original Artifact는 Private이고 필요 시 Server에서 짧은 Signed URL을 생성한다.

### 9. UUID Object Key
Object Key에 학생 이름/번호/원래 파일명을 넣지 않는 것을 기본으로 한다.

### 10. Server-only Secrets
AI Key, Service Role Key 등 Secret은 Client에 노출하지 않는다.

### 11. Server-side AI
```text
Client
→ TRACE Server
→ Privacy Context Builder
→ AI/VLM Adapter
→ Provider
```

### 12. AI Context PII Minimization
AI Context에서 기본 제거:
```text
Student name
Student number
Teacher email
Google Account 정보
전체 Roster
다른 Student 정보
불필요한 Class 표시명
```

Hackathon Artifact는 합성 Student Data만 사용한다. 실제 Student Artifact의 자동 PII Redaction은 Production Gate다.

### 13. Synthetic Data
개발/테스트/시연에는 실제 학생 개인정보·답안·사진을 사용하지 않는다.

### 14. Persistent Audit Log
INPUT에서 최소 기록:
```text
LOGIN
ROSTER_IMPORT
ARTIFACT_UPLOAD
DATA_DELETE
```

Shared `audit_logs`에:
```text
actor_teacher_id
action
entity_type
entity_id
request_id
created_at
```
를 기록한다.

Audit Log에 금지:
```text
Student PII
학생 답안 전문
AI Prompt 전문
Signed URL
Submission Token
Secret
```


## NFR-08. Provider Independence

VLM Provider 교체가 INPUT 전체 코드 수정으로 이어지지 않아야 한다.

## NFR-09. Observability

다음 정보를 최소한 서버 로그 또는 처리 이력에서 확인할 수 있어야 한다.

```text
submission_id
artifact_id
processing_step
provider/model
retry_count
error_type
processing_time
```

## NFR-10. Cost Awareness

- Activity가 이미 확정된 경로에서는 Activity 재분류를 하지 않는다.
- 전체 Curriculum JSON을 매 요청마다 AI에 보내지 않는다.
- 원본을 매번 재분석하지 않도록 처리 결과를 저장한다.

---

# 26. 구현 순서

구현은 **기반 → 실제 저장 → 입력 경로 → AI 구조화 → 관리 → Handoff** 순서로 진행한다.

## Phase 0. Shared Contract 연결

- 최신 TRACE TRD의 Shared Type / DB / Status 계약 적용
- Curriculum JSON 연결
- `Activity / Submission / Artifact` 최소 DB Schema 연결
- `input_status / process_status` 필드 연결

### 완료 기준

Shared Type과 DB 필드명이 세 모듈에서 동일해야 한다.

---

## Phase 1. Google Auth + Class/Roster Foundation

구현:
- Supabase Auth Google Provider 설정
- `Google로 계속하기` 단일 진입 UI
- Google OAuth / callback / Session 처리
- 신규 Auth User → Teacher Profile 생성
- 신규 Auth User → `/onboarding/profile`에서 name 필수/nickname 선택 저장
- 기존 Auth User → 기존 Teacher Profile 조회/재사용
- 중복 Teacher Profile 생성 방지
- 신규 Teacher → Class/Roster Onboarding 분기
- Supabase RLS 적용
- Teacher Server Ownership Check
- `LOGIN` Audit Log
- Class CRUD 최소 기능
- TRACE Roster CSV/XLSX Template
- Roster Import / Preview / Validation
- Student 직접 추가/수정
- Roster 목록
- 제출/미제출 계산용 Query 기반

### 완료 기준
- 신규 Google 사용자는 별도 회원가입 화면 없이 인증 후 Teacher Profile이 생성된다.
- 기존 Google 사용자는 기존 Teacher Profile과 데이터를 다시 불러온다.
- 동일 Auth User에 Teacher Profile이 중복 생성되지 않는다.
- 교사가 Google 로그인 후 자신의 Class를 생성할 수 있다.
- 표준 명단 파일을 업로드해 students가 실제 DB에 저장된다.
- 잘못된 번호/이름/중복 번호가 저장 전에 검증된다.
- 이후 QR/Batch/Import Matching에서 동일 Roster를 조회할 수 있다.

---

## Phase 2. Activity Foundation

구현:

- Activity CRUD
- Curriculum 선택
- ActivityAssignment
- 학습활동 기본 화면

### 완료 기준

```text
실제 생성
→ DB 저장
→ 재조회
→ 수정
```

---

## Phase 3. Storage + Teacher Upload

구현:

- Image/PDF Upload
- Private Supabase Storage
- UUID 기반 Object Key
- Signed URL helper
- Artifact DB 저장
- `ARTIFACT_UPLOAD` Audit Log
- Activity 연결
- 처리 상태 표시

### 완료 기준

```text
파일 업로드
→ Storage Write
→ DB Write
→ Re-read
```

---

## Phase 4. Student QR Submission

구현:

- ActivityAssignment QR
- Class Code
- `submission_token + Class Code + 번호 + 이름` Server 검증
- Student Public API 분리
- 동일 실패 메시지
- 24시간 Class Code + 재발급
- 5분/10회 실패 → 10분 Rate Limit
- 촬영/미리보기/재촬영
- 다중 이미지
- Submission 저장

---

## Phase 5. CSV/XLSX Import

구현:

- TRACE Template Download
- Upload
- Validation
- Preview
- Student Match
- StructuredInput 저장

---

## Phase 6. Image Preprocessing

구현:

- Original/Processed 분리
- Brightness/Contrast
- Rotation/Resize
- 가능한 범위에서 EXIF/위치 Metadata 제거
- Processed Artifact 저장

---

## Phase 7. 기존 자료 자동 분류

구현:

- Metadata 추출
- Curriculum 후보
- 기존 Activity 후보
- 교사 수정/승인

---

## Phase 8. 학생 응답 구조화

구현:

- Question Structure
- Observable Response
- StructuredInput 공통 Envelope
- Privacy Context Builder
- JSON Schema Validation
- `structured_input JSONB`
- Retry / 검토 대기

---

## Phase 9. Batch PDF 학생 Matching

구현:

- 이름/번호 추출
- Roster Match
- Page Range
- 학생별 Submission
- 불확실 항목 검토 대기

---

## Phase 10. AI Activity Builder + PDF

구현:

- 구조화 + 자연어 생성
- 직접 수정
- AI 부분 수정
- 승인
- 인쇄 PDF

---

## Phase 11. 학습결과

구현:

- Activity Card
- Submission 목록
- 상태 집계
- Filter
- 검토 대기 해결

---

## Phase 12. PROCESS Handoff

구현:

- 분석 범위 선택
- READY_FOR_PROCESS 검증
- 선택 Submission 전달
- PROCESS에서 동일 ID 조회

---

# 27. Definition of Done

INPUT 모듈 완료는 Mock 화면이 아니라 실제 데이터 흐름으로 판단한다.

## Activity

```text
사용자 입력
→ 실제 DB 저장
→ 재조회
```

## Teacher Upload

```text
실제 파일
→ Storage
→ Artifact
→ Submission
→ 재조회
```

## Student Submission

```text
실제 QR
→ 학생 검증
→ 촬영/업로드
→ Submission
→ Artifact
```

## CSV/XLSX

```text
Template
→ Upload
→ Parse
→ Preview
→ StructuredInput 저장
```

## AI/VLM

```text
실제 Artifact
→ 실제 Provider 호출
→ Structured JSON
→ Validation
→ DB 저장
```

## Batch

```text
다학생 자료
→ 학생별 Submission 구분
→ 일부 실패 시 검토 대기
```


## Security / Privacy

```text
Google OAuth Session
→ RLS
→ Server Ownership Check
```

```text
Student Public Browser
→ Roster 직접 조회 X
→ Public Submit API
→ token + Class Code + Number + Name 검증
```

```text
Original Artifact
→ Private Storage
→ UUID Object Key
→ 필요 시 Signed URL
```

```text
AI/VLM
→ Server-side
→ Privacy Context Builder
→ Student name/number/Teacher email 제거
```

```text
Demo/Test
→ 합성 Student Data only
```

```text
LOGIN / ROSTER_IMPORT / ARTIFACT_UPLOAD / DATA_DELETE
→ audit_logs
```


## Handoff

```text
READY_FOR_PROCESS
→ PROCESS에서 같은 submission_id로 읽기
```

Hard-coded AI 결과나 Sample JSON만 화면에 표시하는 것은 완료로 인정하지 않는다.

---

# 28. 주요 Acceptance Scenario

## Scenario 0 — Google 회원 Lifecycle → Class / Student Roster 준비

### 신규 사용자

```text
Google로 계속하기
→ Google OAuth
→ Supabase Auth User 생성
→ /onboarding/profile
→ name 필수 / nickname 선택 입력
→ TRACE Teacher Profile 생성
→ Class 생성
→ TRACE 학생명단 Template 업로드
→ Preview / Validation
→ Roster 저장
→ 학생 목록 확인
```

### 기존 사용자

```text
Google로 계속하기
→ Google OAuth
→ 기존 Auth User / Teacher Profile 확인
→ 기존 Class / Student 데이터 로드
→ Dashboard
```

Acceptance:
- 신규 사용자는 별도 회원가입 입력폼 없이 Google 인증으로 가입된다.
- 기존 사용자는 동일 Google 계정으로 기존 데이터에 다시 접근한다.
- `teachers.auth_user_id`는 동일 Auth User에 대해 중복 연결되지 않는다.
- Teacher 계정과 Class가 연결된다.
- 학생 번호/이름이 `students`에 저장된다.
- 중복 번호/누락 값은 저장 전에 차단된다.
- 이후 QR 제출에서 같은 Roster로 이름/번호를 검증한다.
- ActivityAssignment별 제출/미제출 학생을 Roster와 Submission으로 계산할 수 있다.
- Hackathon Demo는 기존 사용자 경로를 기본 시연 경로로 사용할 수 있다.

## Scenario A — 새 Activity 생성 → 학생 직접 제출

```text
교사
→ 자연어 또는 구조화 입력
→ Activity Draft
→ 교사 수정
→ 승인
→ PDF
→ Class 배정
→ QR

학생
→ QR
→ 학급코드/번호/이름
→ 촬영
→ 미리보기
→ 제출

TRACE
→ Submission
→ Artifact
→ StructuredInput
→ 분석 준비
```

---

## Scenario B — 교사 기존자료 일괄 업로드

```text
교사
→ Batch PDF 업로드

TRACE
→ 원본 보존
→ Activity Metadata 후보
→ 기존 Activity 탐색
→ 교사 연결/승인
→ 학생 이름/번호 Matching
→ 학생별 Submission
→ 응답 구조화
→ 분석 준비 / 검토 대기 분리
```

---

## Scenario C — 디지털 결과 Import

```text
교사
→ Activity 선택
→ TRACE XLSX 양식 다운로드
→ 작성
→ 업로드

TRACE
→ Schema Validation
→ 미리보기
→ Roster Match
→ Submission
→ StructuredInput
→ 분석 준비
```

---


# 29. INPUT 모듈 내부에서 추후 확정할 세부 사항

다음은 현재 Product PRD/TRD 계약을 변경하지 않고 INPUT Prompt Plan 또는 구현 Spike에서 확정할 수 있다.

```text
1. 학생 촬영 품질검사의 정확한 Threshold
2. Batch PDF에서 학생별 Page Grouping 알고리즘
3. Activity 기존 후보 유사도 Threshold
4. response_type별 `response` 세부 JSON Schema
5. PDF 생성 Library 최종 선택
6. 지원 Image/PDF MIME Type 세부 목록
7. Processing Job Polling 주기
8. 검토 대기 화면의 세부 Interaction
9. Activity Builder UI Layout
10. 최종 VLM Provider / Model
```

이미 확정되어 더 이상 미결정이 아닌 항목:

```text
StructuredInput 공통 Envelope
→ schema_version / questions[].question_id / response_type / response

Processing Job 저장
→ shared processing_jobs Table

Class Code
→ class_code_expires_at 저장 / 기본 TTL 24시간 Config / 즉시 재발급

Public Verification Rate Limit
→ IP + submission_token / 기본 5분 실패 10회 → 10분 제한 / 공통 Config

File Limit
→ Image 10MB
→ PDF 30MB / 100 pages
→ CSV/XLSX 10MB
→ Batch Image 100 files
→ 공통 Config + Client/Server 이중 검증
```

VLM Provider/Model은 Adapter 계약을 유지한 채 **Module Prompt Plan 작성 직전 최종 선택**한다.


---

# 30. 요약

```text
인증
- Teacher = Google OAuth / Supabase Auth Google Provider
- UI = `Google로 계속하기` 단일 진입점
- 신규 사용자 = Auth User + Teacher Profile 생성
- 기존 사용자 = 기존 Teacher Profile/데이터 재사용
- Demo = 기존 로그인 계정 사용 가능

선행 설정
- Class 생성
- TRACE 표준 Student Roster CSV/XLSX
- 번호 + 이름 Validation
- Roster 저장
- QR / Batch / Import Matching 기준
- 제출/미제출 계산 기준
```



보안/개인정보
- Google OAuth + Session
- RLS + Server Ownership
- Student Public Submit API
- Uniform Verification Failure
- PII-free QR/Token
- Private Storage + Signed URL
- UUID Object Key
- Server-only Secret
- Server-side AI + Privacy Context Builder
- 합성 Demo Data
- audit_logs

INPUT 기술 확정
- StructuredInput Envelope = schema_version / questions[].question_id / response_type / response
- Processing Job = shared processing_jobs Table + job_id 재조회 + processing_job_status
- Class Code = class_code_expires_at 저장 + 기본 TTL 24시간 Config + 재발급
- Rate Limit = 기본 5분 실패 10회 → 10분 제한, 공통 Config
- File Limit = Image 10MB / PDF 30MB·100pages / CSV-XLSX 10MB / Batch Image 100, 공통 Config + Client/Server 검증
- Capture = AutoCaptureView 단일 구현 / Phone·Tablet·Chromebook·Laptop / Fallback 3종
- Teacher Global CTA = + 학습자료 추가
- VLM Provider/Model = Prompt Plan 작성 직전 선택


```text
INPUT의 핵심은 "파일 업로드"가 아니다.

학습활동을 만들거나 기존 자료를 받아들이고,
서로 다른 입력 경로를
Activity → Submission → Artifact → StructuredInput
이라는 동일 구조로 정리하는 것이 핵심이다.

학생 QR 제출은 Activity를 미리 확정한다.
교사 미분류 자료만 Activity를 자동 추론한다.

학생 결과는 학생별 Submission으로 분리한다.
한 Submission에는 여러 Artifact가 들어갈 수 있다.

INPUT은 문항 구조와 관찰 가능한 응답까지만 구조화한다.
교육적 판단은 PROCESS가 담당한다.

학습결과는 Activity 중심으로 보여준다.
불확실한 자료만 "검토 대기"로 모은다.

장시간 처리는 항상 현재 진행 상황을 보여준다.

최종 성공 기준은:
실제 입력 → 실제 저장 → 실제 구조화 → 재조회
→ PROCESS가 동일 ID로 이어받는 것이다.
```
