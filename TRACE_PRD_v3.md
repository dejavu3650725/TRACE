# TRACE Product Requirements Document
**Team:** PROCESS 101  
**근거 자료 추가:** 종이 프로토타입 12장면(uiux 프로토타입.pdf) · 교사 설문/인터뷰(2026.8.24~26, 설계도.pdf)  
**Purpose:** 인터뷰 기반 문제 재정의, 2026-08-25 회의 결정사항, 기존 TRACE PRD의 핵심 구조를 통합하여 팀원과 AI가 프로그램의 동작 방식·데이터 흐름·구현 방안을 동일하게 이해하도록 하는 기준 문서

---

# 0. 문제 재정의

우리는 처음에 **학생의 학습·평가자료와 기록이 여러 곳에 흩어져 있어 학생별 데이터를 누적하고 성장 과정과 도달 수준을 파악하기 어렵고, 그 결과 맞춤형 피드백과 후속학습·상담·기록으로 연결하기 어렵다**고 보았다.

설문·인터뷰를 통해 교사들은 이미 종이, Drive, Excel, 플랫폼, 개인 메모 등 다양한 방식으로 많은 자료를 저장하고 있으며, 핵심 어려움은 단순히 “자료가 없다/찾기 어렵다”가 아니라 **흩어진 자료를 적은 추가 업무로 하나의 흐름에 연결하고, 의미 있는 학습 근거와 변화 과정을 빠르게 해석하여 다음 교육적 행동으로 전환하는 것**임을 확인했다.

> **최종 문제 정의**  
> 교사는 이미 축적되고 있는 학생의 다양한 학습자료를 적은 추가 업무로 하나의 흐름에 연결하고, 그 안에서 의미 있는 학습 Evidence와 변화 과정을 빠르게 파악하여 근거 있는 피드백·후속학습·상담·교육기록으로 활용하기 어렵다.

따라서 TRACE의 핵심은 **더 많이 입력하게 하는 것**이 아니라 **이미 존재하는 자료를 쉽게 넣고, 구조화하고, 교사 승인된 근거로 누적하여 다시 활용하게 하는 것**이다.

---

# 0.1 인터뷰·설문 정량 근거 → 제품 규칙

TRACE의 제품 결정은 취향이 아니라 현직 교사 대상 설문·대면 인터뷰(2026.8.24~8.26, 초·중·고 재직 교사) 결과에 근거한다. 아래는 그 결과를 제품 규칙으로 고정한 것이다.

| 확인된 사실 | 응답 | 제품 규칙 |
|---|---|---|
| 자료가 분산 저장됨 (구글 드라이브 16 / 종이 15 / 엑셀 12 / 개인 메모 10) | — | 입력 경로를 **교사 일괄 입력 · 학생 직접 제출** 두 축으로 단순화한다. 세 번째 축을 늘리지 않는다 |
| 피드백이 어려운 이유: 시간 부족 22, 학생별 표현 만들기 17, 근거 찾기 10 | 22/17/10 | 피드백은 **초안이 이미 작성된 상태**로 제시하고 교사는 수정만 한다. 근거는 문장에 항상 동반한다 |
| AI 오류 시 필요한 기능 1순위: **원자료 확인 19** | 19 | 분석·검토 화면은 **원본이 항상 함께 보이는 구조**를 기본형으로 한다 |
| 도입 걸림돌: 개인정보 유출 21, AI 분석 오류 18, 자료 등록 부담 14 | 21/18/14 | 보안·승인·근거 확인은 옵션이 아니라 **기본 구조**로 구현한다 |
| 자료 등록 부담 완화 요구: 파일 일괄 등록 20, 이미지 자동 업로드 15, 학생 자동 인식 14 | 20/15/14 | 입력은 **다중 파일·자동 인식·자동 매칭**을 기본값으로 한다. 파일당 수동 입력을 강제하지 않는다 |
| 기록 작성에 필요한 것: 성장 과정 요약 23, 관찰 기록 모아보기 23, 문장 자동생성 15, 성취기준 연결 15 | 23/23 | 학생 리포트 최상단은 **성장 요약 + 관찰 기록 모아보기**로 한다 |
| 보고 싶은 정보: 최근 성장 19(학생화면 1위), 후속학습 제안 17, 반복되는 어려움 16 | 19/17/16 | 리포트 섹션 순서를 **① 최근 성장 → ② 반복되는 어려움 → ③ 후속학습 제안**으로 고정한다 |
| AI 역할 요구: "최종 판단은 교사", "근거를 제시해야", "수정·삭제·재분석 가능해야" | — | **AI는 판정자가 아니라 근거를 찾아 정리하는 보조자**로 정의한다 (§3 Teacher Approval Gate의 근거) |
| 누적 방식: 전수 수집은 비현실적. 주요 평가자료만 8, 수행평가만 5 | — | "모든 자료를 넣으라"고 요구하지 않는다. **적게 넣어도 값이 나오는 제품**으로 설계한다 |
| 학교급 차이: 초등=활동지·전교과 통합 / 중등=여러 학급·수행평가·생기부 | — | **공통 구조 유지, 진입 화면 기본 필터만 학교급별로 다르게.** 별도 앱을 만들지 않는다 |

---

# 1. 제품 정의

**TRACE는 학생의 종이·디지털 학습결과를 입력받아 교육과정 기준에 맞게 구조화하고, 성취기준별 기존 AchievementLevel을 기준으로 분석·누적하여 피드백, 후속학습, 성장 리포트와 교육기록으로 연결하는 교사용 학습 성장 지원 시스템이다. 관찰 가능한 입력 데이터는 신뢰 가능한 경우 자동 저장할 수 있으며, 성취수준·강점·어려움·Evidence 등 교육적 판단은 교사 검토·승인을 거쳐 확정한다.**

## 개발 목표

TRACE는 정적 프로토타입이 아니라 실제 기능이 동작하는 제품으로 구현한다.

- 실제 이미지/PDF/스프레드시트 입력
- 실제 파일 저장
- 실제 VLM/API 호출
- 실제 JSON 구조화
- 실제 DB 저장·조회
- 실제 교사 승인 상태 관리
- 실제 학생·학급·과목·성취기준 연결
- 실제 누적 분석
- 실제 리포트/대시보드 생성

> **가상 학생 데이터는 사용할 수 있지만 기능은 가짜로 구현하지 않는다.**

---

# 2. 전체 아키텍처 — INPUT → PROCESS → OUTPUT

TRACE는 학생 정보 처리를 크게 **입력(INPUT) → 처리(PROCESS) → 출력(OUTPUT)** 3단계로 구성한다.

AI가 생성한 **교육적 판단**과 Activity/Standard 등 교육과정 의미를 확정하는 결과는 반드시 **교사 검토·편집·승인(Teacher Approval Gate)** 을 거친다. 단, 학생이 실제로 쓴 글·선택·체크 등 관찰 가능한 입력 데이터는 신뢰 가능한 경우 자동 저장하며, 불확실한 경우에만 `REVIEW_PENDING`으로 보내 교사가 확인한다.

```text
                           ┌───────────────────────────────┐
                           │        SHARED CORE            │
                           │ Auth · Curriculum DB · Class  │
                           │ Student · Storage · Audit Log │
                           └──────────────┬────────────────┘
                                          │
                                          ↓
┌──────────────────────────────────────────────────────────────────────┐
│ ① INPUT · 학습자료 생성 / 입력 / 구조화                            │
│                                                                      │
│ [A] 새 활동 생성                    [B] 기존 자료 입력               │
│ 교사 활동내용/학년/교과/단원        이미지·PDF·디지털 자료          │
│          ↓ [AI]                              ↓ [VLM]                  │
│ 활동자료·문항 초안           학년·교과·영역·성취기준 후보   │
│          └──────────────┬─────────────────────┘                       │
│                         ↓                                             │
│                 교사 검토·편집·승인                                 │
│                         ↓                                             │
│   TRACE Content Code + StructuredInput + 원본 Artifact      │
│                         ↓                                             │
│                      DB / Storage                                    │
└─────────────────────────┬────────────────────────────────────────────┘
                          │ 필요할 때 처리 실행
                          ↓
┌──────────────────────────────────────────────────────────────────────┐
│ ② PROCESS · 성취기준·AchievementLevel 기반 분석 / 누적 분석                            │
│                                                                      │
│ StructuredInput + 원본 + Approved Standard + AchievementLevel + 기존 Approved Evidence              │
│                         ↓ [VLM/AI]                                   │
│ Evidence 추출 · 강점 · 어려움 · 반복 실수 · 도달수준               │
│                         ↓                                             │
│                 교사 검토·편집·승인                                 │
│                         ↓                                             │
│                Approved Evidence / Analysis                          │
│                         ↓                                             │
│ 데이터 누적 시: 변화·성장·반복 패턴 비교                           │
│                         ↓                                             │
│                 교사 검토·편집·승인                                 │
└─────────────────────────┬────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────────┐
│ ③ OUTPUT · 조회 / 대시보드 / 리포트 / 다음 학습                    │
│                                                                      │
│ Filter: 학생 · 학급 · 과목 · 영역 · 성취기준 · 활동 · 기간 · 종합 │
│                         ↓                                             │
│ ┌──────────────┬────────────────┬────────────────┬────────────────┐ │
│ │ 통합 대시보드 │ 개별 활동 Report│ 누적 성장 Report │ Feedback/Next │ │
│ │ [CODE+AI]    │ [CODE+AI]      │ [CODE+AI]      │ [AI]          │ │
│ └──────────────┴────────────────┴────────────────┴────────────────┘ │
│                         ↓                                             │
│                 교사 검토·편집·승인                                 │
│                         ↓                                             │
│ 화면 조회 · PDF/출력 · 상담 활용 · 교육기록 · Follow-up Activity    │
└──────────────────────────────────────────────────────────────────────┘
```

## 순환 구조

```text
INPUT → PROCESS → OUTPUT → 피드백/Follow-up Activity → 새로운 학생 결과 → INPUT
```

TRACE의 최종 가치는 보고서를 만드는 데 그치지 않고 **분석 → 지원 → 새로운 Evidence → 성장 확인**의 순환을 만드는 데 있다.

---


# 2.1 입력된 학생 정보의 흐름 — Raw → Draft → Approved → Aggregated

TRACE에서 학생 정보는 단순히 “파일을 올리고 AI가 답을 내는” 흐름이 아니다. **원본 데이터, AI가 만든 파생 데이터, 교사가 승인한 데이터, 누적 분석 데이터**를 구분하여 이동시킨다.

## 데이터 상태 범례

- `[RAW]` 학생이 실제로 제출한 원본 자료
- `[LINKED]` 학생·Activity·성취기준과 연결된 상태
- `[AI-DRAFT]` AI/VLM이 만든 미승인 분류·인식·분석 결과
- `[APPROVED]` 교사가 확인·수정·승인한 확정 데이터
- `[AGGREGATED]` 여러 승인 데이터를 모아 만든 누적/집계 결과

```text
학생의 실제 학습결과
[RAW]
이미지 · PDF · XLSX/CSV · 코드 · 텍스트
        │
        │ 업로드/촬영/Import
        ↓
Artifact 원본 저장 ────────────────────────────────┐
[RAW]                                              │
Storage + checksum + sourceType + createdAt        │
        │                                          │
        ↓                                          │ 원본은 항상 보존
학생/Activity 연결                                 │
[LINKED]                                           │
student_id + activity_assignment_id + submission_id           │
        │                                          │
        ↓                                          │
VLM 분류·인식                                      │
[AI-DRAFT]                                         │
학년·교과·영역·성취기준 후보 + 학생 응답 인식      │
        │                                          │
        ↓                                          │
┌─────────────────────────────────────────────┐     │
│         Teacher Approval Gate               │     │
│ 원본 ↔ AI 결과 비교 → 수정/승인/반려        │◀────┘
└─────────────────────┬───────────────────────┘
                      ↓
StructuredInput
[STORED / REVIEW_PENDING]
관찰 가능한 학생 응답 + schema_version. 신뢰 가능하면 저장하고, 불확실하면 교사 확인
                      │
                      │ 즉시 분석 또는 나중에 선택 분석
                      ↓
AchievementLevel 기반 VLM 분석
[AI-DRAFT]
Evidence · 강점 · 어려움 · 오류 · 도달수준
                      │
                      ↓
┌─────────────────────────────────────────────┐
│         Teacher Approval Gate               │
│ Evidence/분석 수정 · 승인 · 반려            │
└─────────────────────┬───────────────────────┘
                      ↓
Approved Evidence / Analysis
[APPROVED]
                      │
              ┌───────┴────────┐
              │                │
              ↓                ↓
개별 Activity 조회      누적 데이터 풀
                      [APPROVED]
                               │
                               ↓
                      누적 비교 / 집계
                      [AI-DRAFT + CODE]
                               │
                               ↓
                      Teacher Approval Gate
                               │
                               ↓
                      GrowthEvent / Pattern
                      [AGGREGATED + APPROVED]
                               │
               ┌───────────────┼─────────────────┐
               ↓               ↓                 ↓
          Dashboard        Report           Feedback/Next
          [VIEW]           [OUTPUT]         [ACTION]
                                                   │
                                                   ↓
                                           Follow-up Activity
                                                   │
                                                   └→ 새로운 [RAW] 입력
```

## 이 구조가 필요한 이유

1. **AI 오류를 데이터베이스의 사실로 굳히지 않는다.** 미승인 AI 결과는 `draft` 상태로 분리한다.
2. **원본 근거를 항상 추적할 수 있다.** Report의 한 문장을 클릭하면 해당 Evidence와 원본 Artifact까지 거슬러 올라갈 수 있어야 한다.
3. **입력과 처리를 분리할 수 있다.** 자료를 먼저 저장하고 필요할 때 분석해 API 비용과 대기시간을 조절한다.
4. **학생 정보의 출처를 구분한다.** 원본, AI 추출, 교사 수정, 누적 분석을 같은 필드에 덮어쓰지 않는다.
5. **교사가 최종 책임자라는 제품 원칙을 시스템 구조로 강제한다.** 승인 전 데이터는 누적 성장·교육기록의 근거로 사용하지 않는다.

## 데이터베이스 관점의 연결

```text
Student ──────┐
              ├─ Submission ─ Artifact [RAW]
Activity ─────┘                    │
                                  ├─ StructuredInput [JSONB]
                                  │
                                  └─ Analysis [AI-DRAFT]
                                         │
                                         ├─ Review
                                         │    └─ reviewer / decision / editedFields
                                         │
                                         └─ Evidence [APPROVED only after Review]
                                                │
                                                ├─ Support
                                                ├─ GrowthEvent
                                                └─ Report
```

## 데이터 사용 원칙

| 데이터 | 저장 | 누적 분석 사용 | 리포트 근거 사용 |
|---|---|---|---|
| 원본 Artifact | 항상 | 직접 집계 X, 근거 확인에 사용 | 원본 근거로 연결 |
| AI Draft 분류/분석 | 저장 | X | X |
| StructuredInput | 저장 | PROCESS 입력으로 사용 | 원본 응답 근거로 연결 |
| 승인 Evidence | 저장 | O | O |
| 반려된 Evidence | 이력 보존 | X | X |
| 승인 GrowthEvent | 저장 | O | O |

---

# 3. 전역 규칙 — Teacher Approval Gate

TRACE는 **관찰 데이터의 저장**과 **교육적 판단의 확정**을 구분한다.

## 3.1 반드시 교사 검토·승인이 필요한 것

- AI가 만든 Activity/문항 초안의 최종 확정
- 자동 분류한 학년·교과·영역·성취기준
- 성취수준 판단
- Evidence
- 강점·어려움·오류
- 성장 분석
- 학생 피드백
- 후속학습
- 리포트 설명
- 교육기록 초안

## 3.2 자동 저장 가능한 것

학생 결과물에서 **직접 관찰 가능한 데이터**는 신뢰 가능한 경우 자동 저장할 수 있다.

예:
- 학생이 작성한 글
- 선택한 보기
- 체크/동그라미/밑줄
- 빈칸 여부
- 명확하게 일치한 학생 이름/번호

불확실하거나 인식 실패한 경우에는:

```text
REVIEW_PENDING
→ 교사 확인/수정
→ READY_FOR_PROCESS 조건 재평가
```

교육적 판단에는 다음 승인 상태를 사용한다.

```text
AI_DRAFT
   ↓
TEACHER_REVIEW
   ├─ APPROVED
   ├─ EDITED_APPROVED
   └─ REJECTED
```

### 구현 원칙
- `APPROVED`, `EDITED_APPROVED` 교육적 판단만 누적 성장·리포트의 확정 근거로 사용한다.
- AI 원본과 교사 수정본을 분리 저장한다.
- 누가 언제 승인·수정했는지 Audit Log를 남긴다.
- 교사는 필요할 때 원본 Artifact를 보면서 AI 결과를 수정할 수 있어야 한다.
- 정상적으로 구조화된 관찰 응답 1건마다 별도 승인 클릭을 강제하지 않는다.

---

# 4. 핵심 개념

## 4.1 Activity

**하나의 수업·과제·평가 활동을 나타내는 TRACE의 기본 작업 단위**이다.

예: 초3 분수 비교 활동, 주장하는 글쓰기, 과학 관찰 보고서, 고등 정보 프로그래밍 수행평가

최소 데이터:

```text
activity_id
title
grade
subject
domain_or_unit
source_type
parent_activity_id
status
```

Activity와 Standard는 **N:M 관계**로 연결한다. `standard_ids[]`를 Activity 본문이나 단일 DB 컬럼에 중복 저장하지 않고 `activity_standards` 관계를 기준으로 관리한다.

```text
Activity
  ↕
activity_standards
  ↕
Standard
```

Activity는 새로 생성할 수도 있고 기존 자료를 업로드하여 역분류한 뒤 생성할 수도 있다.

## 4.2 Artifact

**학생 또는 교사가 TRACE에 넣은 원본 파일**이다.

예: 종이 활동지 촬영 이미지, 스캔 PDF, XLSX/CSV, 코드 파일, 텍스트 결과물

원본 Artifact는 AI 분석 결과와 분리해 보존한다.

## 4.3 StructuredInput

**INPUT이 학생 결과물에서 읽어낸 관찰 가능한 응답을 PROCESS가 안정적으로 사용할 수 있도록 구조화한 데이터**이다.

`StructuredInput`은 별도 대형 Entity로 중복 저장하기보다 Hackathon 구현에서는 `submissions.structured_input JSONB`를 우선한다.

학생·Activity·Standard·Artifact 정보는 JSON 안에 복사해서 반복 저장하지 않고 관계형 DB의 ID로 연결한다.

### StructuredInput 공통 Envelope — 확정

모든 Activity 유형의 세부 응답 구조를 하나로 고정하지는 않되, INPUT과 PROCESS가 공유하는 **최소 Envelope**는 다음과 같이 고정한다.

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
question_id
response_type
response
```

`response` 내부는 `response_type`별로 확장할 수 있다. 새 Activity 유형을 추가해도 공통 Envelope 자체는 깨지 않는다. Activity 유형별 세부 JSON Schema는 Module PRD에서 정의한다.

### 생성 시점

```text
원본 입력
→ Student / Activity 연결
→ VLM 문항·관찰 응답 구조화
→ Schema Validation
→ 신뢰 가능: StructuredInput 자동 저장
→ 불확실: REVIEW_PENDING → 교사 수정
```

`StructuredInput` 자체는 정답/오답, 성취수준, 강점, 어려움, Evidence를 포함하지 않는다.

## 4.4 Evidence

**학생 결과물에서 실제로 관찰 가능한 학습 근거**이다.

Evidence 예: “분모가 같은 분수에서 분자가 큰 분수가 더 크다는 규칙을 적용함.”

공통 필드:

```text
evidence_id
analysis_id
standard_id
artifact_id
question_id
source_page / source_region
claim
```

Evidence는 `Analysis`에 소속된다. Student와 Activity 정보는 `Analysis → Submission → Student / ActivityAssignment → Activity` 관계로 추적하고 Evidence에 중복 저장하지 않는다.

승인 단위는 개별 Evidence가 아니라 **Analysis 전체**다. `APPROVED` 또는 `EDITED_APPROVED` Analysis에 포함된 Evidence만 누적 분석·리포트의 확정 근거로 사용한다. Evidence별 별도 Approval Status를 만들지 않는다.

## 4.5 AchievementLevel

**Standard별로 미리 준비된 3단계 성취수준 데이터**를 PROCESS의 분석 기준으로 사용한다.

- Shared Curriculum Data에서 동일 JSON/Type을 사용
- INPUT에서 새로운 AI Rubric을 생성하지 않음
- Activity는 Standard를 선택/연결
- PROCESS는 `StructuredInput + Standard + AchievementLevel + Artifact`를 바탕으로 분석
- 성취수준 판단 결과는 Teacher Approval Gate를 거침

해커톤 MVP에서는 별도의 Activity별 AI Rubric 생성 기능을 필수 범위에 포함하지 않는다.

## 4.6 Growth Event

**시간이 다른 2개 이상의 승인 Evidence를 비교하여 확인된 변화**이다.

예: 반복 오류 감소, 설명 근거 증가, 피드백 반영 후 결과물 개선, 코드 구조 개선

AI가 후보를 제안하고 교사가 승인한다.

---

# 5. TRACE Content Code

## 의미

**TRACE Content Code는 코드만 보고도 해당 Activity의 내용을 대략 식별할 수 있도록 만든 사람이 읽을 수 있는 분류 코드**이다.

내부 DB의 UUID와 별도로 사용한다.

## 권장 형식

```text
SUBJ-GG-DD-SS-NNN
```

| 구간 | 의미 | 예 |
|---|---|---|
| `SUBJ` | 영문 과목코드 | `MATH`, `KOR`, `SCI`, `INFO` |
| `GG` | 학년 | `03` |
| `DD` | 영역/단원 분류 번호 | `02` |
| `SS` | 성취기준 매핑 번호 | `04` |
| `NNN` | Activity 일련번호 | `012` |

예: `MATH-03-02-04-012`

## 역할

1. 파일명·PDF·DB 레코드를 빠르게 식별
2. Activity와 Submission 연결
3. QR payload와 연결 가능
4. 운영·디버깅 시 사람이 자료 종류를 빠르게 추정
5. 향후 대량 데이터 정리 기준

정확한 교육과정 의미는 DB의 `subject`, `grade`, `domain`, `standard_ids`에 저장하고, Code는 **사람이 읽기 쉬운 보조 식별자**로 사용한다.

---


# 5.1 Class & Roster Setup — 학급 생성과 학생 명단 등록

TRACE에서 학생 자료를 수집하기 전에 교사는 자신의 학급과 학생 명단을 등록할 수 있어야 한다.

이 데이터는 단순 사용자 편의 기능이 아니라 다음 기능의 **기초 기준 데이터**다.

```text
교사 Google 로그인
→ Class 생성
→ Student Roster 등록
→ Activity 생성/배정
→ 학생 자료 수집
→ Student Roster Match
→ 제출 / 미제출 현황 계산
```

## Class 생성

교사는 최소 다음 정보를 입력하여 Class를 생성할 수 있다.

```text
학년
학급명/반
필요 시 교과
```

Class 생성 시 학생 제출 검증에 사용할 `class_code`를 발급할 수 있다.

## Student Roster 등록

MVP에서는 다음 두 경로를 지원한다.

```text
A. TRACE 표준 CSV/XLSX 학생명단 업로드
B. 화면에서 학생 직접 추가/수정
```

학생 최소 필드:

```text
student_number
student_name
```

업로드 흐름:

```text
TRACE 학생명단 Template 다운로드
→ 번호/이름 작성
→ CSV/XLSX 업로드
→ Preview
→ Schema / 중복 / 빈 값 Validation
→ 교사 확인
→ students 저장
```

학생은 `class_id`에 직접 연결한다.

## Roster 활용

등록된 Roster는 다음의 기준으로 사용한다.

```text
학생 QR 제출
→ Class Code + Number + Name 검증

교사 Batch PDF/Image Upload
→ VLM이 읽은 Number + Name과 Roster Matching

디지털 결과 Import
→ Student Roster Matching

Activity 제출 현황
→ Class 전체 Student - Submission 존재 Student
→ 제출 / 미제출 계산
```

별도의 제출현황 원본 테이블을 만들기보다 Class Roster와 Submission의 존재 여부를 기준으로 계산한다.

---

# 6. INPUT Module

INPUT의 학생 결과 수집 기능은 원칙적으로 **Teacher 로그인 + Class 생성 + Student Roster 등록** 이후 사용한다.


INPUT의 목적은 **교사가 최소한의 행동으로 다양한 자료를 TRACE 공통 데이터 구조에 넣도록 하는 것**이다.

## 6.1 Path A — 새 Activity / 활동자료 생성

교사는 학년, 교과, 단원/영역, 성취기준, 활동 목적, 활동 내용 중 일부만 입력해도 시작할 수 있어야 한다. 모든 필드를 강제하지 않는다.

```text
교사 최소 정보 입력
→ 교육과정 JSON 검색
→ 관련 성취기준 후보
→ AI 활동자료/문항 초안
→ 기존 Standard/AchievementLevel 연결
→ 교사 검토·수정·승인
→ Activity 생성
→ TRACE Content Code
→ PDF/온라인 Activity
```

### 구현 방안
- 교육과정/성취기준은 JSON 또는 DB로 관리
- AI Prompt에 교육과정 정보와 교사 입력을 함께 전달
- AI 응답은 Structured JSON으로 받음
- 승인 전 `DRAFT`, 승인 후 `ACTIVE`

## 6.2 Path B — 기존 자료 입력 후 역분류

교사는 생성 단계를 건너뛰고 기존 활동지를 바로 입력할 수 있다.

예: 초등학교 수학익힘책 한 페이지를 촬영해 업로드

TRACE는 VLM으로 다음 후보를 추출한다.

```text
학년
교과
영역
단원
관련 성취기준
활동 유형
문항 구조
```

### Flow

```text
기존 이미지/PDF
→ VLM 문서 이해
→ 교육과정 JSON과 후보 매칭
→ 학년·교과·영역·성취기준 후보
→ 교사 검토·수정·승인
→ Activity 생성/연결
→ TRACE Content Code
→ StructuredInput 저장
```

### 구현 방안
VLM에 교육과정 JSON 전체를 항상 넣지 않는다.

1. 파일에서 학년/교과/핵심 키워드 후보 추출
2. 코드에서 교육과정 DB 후보 범위를 축소
3. 관련 성취기준 후보만 VLM에 전달
4. AI가 후보와 판단 근거 반환
5. 교사가 최종 선택

이 방식으로 토큰·속도·오분류를 줄인다.

---

# 7. 학생 결과 입력 방식

```text
                  Student Result
                        │
       ┌────────────────┼─────────────────┐
       ↓                ↓                 ↓
교사 일괄 업로드   학생 개별 촬영     디지털 자료 Import
Image/PDF          Mobile            XLSX/CSV
       └────────────────┼─────────────────┘
                        ↓
                   Artifact
                        ↓
                 공통 Input Pipeline
```

## 7.1 교사 일괄 입력

두 가지 방식을 제공한다. 둘 다 동일한 Artifact 파이프라인으로 합류한다.

**(a) 파일 업로드**
- 이미지 여러 장 또는 PDF 업로드
- 동일 Activity 컨텍스트 자동 적용
- 학생 번호/QR/선택 정보로 학생 매칭
- 업로드 후 즉시 분석하지 않고 저장만 가능

구현: `teacher_batch_upload → Storage → Artifact[] → matching queue`

**(b) 카메라 연속 스캔**

교사가 노트북·크롬북 웹캠 또는 태블릿 카메라 앞에서 종이 활동지를 넘기기만 하면 자동으로 연속 촬영된다. 스캐너·복합기 없이 종이 30장을 몇 분 안에 디지털화하는 경로다.

```text
/results/upload → [카메라로 연속 촬영]
→ AutoCapture (§7.3 공통 촬영 계약)
→ 한 장씩 자동 촬영 → 촬영 스트립 누적
→ 촬영 종료
→ Artifact[] 일괄 생성
→ 학생 자동 매칭 → 불확실 건만 교사 확인
```

- 학생 직접 제출과 **동일한 AutoCapture 엔진을 재사용**한다. 별도 촬영 구현을 만들지 않는다.
- 차이점은 촬영 이후다. 학생 제출은 제출자가 이미 확정되어 있고, 교사 스캔은 **촬영 후 학생 매칭 단계가 필요**하다.
- 인터뷰 근거: "파일 일괄 등록" 20명, "이미지 자동 업로드" 15명, "학생 자동 인식" 14명.

## 7.2 학생 개별 촬영 제출

```text
교사가 Activity 생성 → ActivityAssignment 배정
→ submission_token 발급 → QR / 짧은 링크 배부 (교실 화면에 전체화면 투사)
→ 학생이 개인 기기 브라우저로 접속 (설치·회원가입 없음)
→ 학급 코드 + 학생 번호 + 이름
→ Roster 서버 검증
→ 촬영 (§7.3 AutoCapture) 또는 파일 선택
→ 미리보기 · 다시 찍기 · 장 추가
→ 제출
```

### 구현
- **접속 수단은 QR/짧은 링크 단 하나다.** 학생 계정·비밀번호·앱 설치를 요구하지 않는다.
- `submission_token`은 ActivityAssignment 범위의 Opaque Token이며 학생 식별정보를 담지 않는다.
- 학급 코드는 교사가 발급하고 만료·재발급할 수 있다. 링크가 유출되어도 학급 코드 없이는 제출할 수 없다.
- 학생은 자신의 제출 화면만 접근한다. 명단·타 학생 제출물은 어떤 경로로도 노출하지 않는다.
- 검증 실패 사유를 세분화해 알려주지 않는다(명단 역추적 방지).
- 제출 완료 후 `submission_id` 발급. 한 Submission에 여러 Artifact(여러 장)를 연결할 수 있다.

## 7.3 촬영 입력 공통 계약 — AutoCapture

> **설계 목표: 활동지를 카메라 앞에 들고만 있으면 자동으로 촬영된다.**
> 셔터 버튼을 찾아 누르는 동작 자체가 저학년 학생에게는 실패 지점이다. 셔터를 없앤다.

### 7.3.1 지원 기기 — 전 기기 동등 지원

교실 기기 환경은 학교마다 다르다. **스마트폰 전용으로 설계하지 않는다.**

| 기기 | 카메라 | 처리 |
|---|---|---|
| 스마트폰 · 태블릿 | 후면 카메라 우선 | 후면 요청, 실패 시 사용 가능한 카메라로 자동 대체 |
| 크롬북 | 전면 웹캠 | 프리뷰 좌우 반전, 저화질 보정 임계값 적용 |
| 노트북 (Windows/Mac) | 내장 또는 외장 웹캠 | 카메라 선택 목록 제공 |
| 데스크톱 · 카메라 없음 · 권한 거부 | — | 파일 선택 경로로 자동 전환 |

기기 판별은 User-Agent가 아니라 **실제 사용 가능한 카메라 목록과 화면 방향**으로 한다.

### 7.3.2 자동 촬영 판정

카메라 영상에서 다음 네 가지를 실시간으로 관찰하고, 네 조건이 동시에 약 1초간 유지되면 자동으로 촬영한다.

```text
① 화면 채움    활동지가 화면에서 차지하는 비율이 적정 범위 안에 있는가
② 정지         손떨림이 멈췄는가
③ 선명도       초점이 맞았는가
④ 밝기·반사     너무 어둡거나, 빛 반사로 글씨가 날아가지 않았는가
```

- 판정 임계값은 기기마다 카메라 성능이 다르므로 **접속 직후 짧은 관찰 구간에서 자동 보정**한다. 고정 상수를 쓰지 않는다.
- 조건이 깨지면 촬영을 취소하고 대기 상태로 돌아간다. 흔들린 사진을 저장하지 않는다.
- 촬영 직전 짧은 카운트다운을 보여 학생이 자세를 유지하도록 한다.
- **촬영 후 자동으로 다음 장 대기 상태가 된다.** 다음 활동지를 들면 다시 찍힌다. 여러 장 제출이 별도 조작 없이 이루어진다.
- 무음 촬영을 기본으로 한다(수업 중 사용).

### 7.3.3 안내 문구 — 실패 원인을 화면이 먼저 말한다

상태마다 **한 줄만** 표시한다.

```text
활동지를 화면 안에 맞춰 주세요
조금 더 가까이 들어 주세요
조금만 뒤로 물러나 주세요
흔들리지 않게 들어 주세요
화면에 비치는 빛을 피해 주세요
좋아요, 그대로 들고 계세요
찍었어요! 다음 장을 들어 주세요
```

### 7.3.4 반드시 함께 제공하는 대체 경로

자동 촬영은 **편의 기능이지 유일 경로가 아니다.** 아래 세 가지가 항상 함께 있어야 한다.

```text
[직접 촬영]      자동 판정을 무시하고 즉시 촬영하는 수동 버튼
[자동 촬영 끄기]  자동 판정을 끄고 수동 촬영만 사용 (선택 상태 기억)
[파일에서 선택]   갤러리·다운로드 폴더·스캔 파일 업로드 (다중 선택 가능)
```

카메라 권한이 거부되면 **오류 화면을 띄우지 않고 파일 선택 경로로 자연스럽게 전환**한다.

### 7.3.5 개인정보·안전

- 촬영 영상은 학생 기기 메모리에서만 처리하며 제출 전까지 서버로 전송하지 않는다.
- 촬영 이미지는 재인코딩 과정에서 **촬영 위치·기기 정보(EXIF)가 제거**된다.
- 촬영 화면을 벗어나거나 앱이 백그라운드로 가면 **카메라를 즉시 해제**한다.
- 촬영 화면에 다른 학생의 정보를 표시하지 않는다.

## 7.4 디지털 자료 Import

해커톤 MVP에서는 **TRACE 표준 CSV/XLSX Template**을 우선 지원한다.

```text
Activity 선택
→ TRACE Template 다운로드
→ 교사 작성
→ CSV/XLSX 업로드
→ Schema Validation
→ 미리보기
→ Student Roster Match
→ Submission + StructuredInput 저장
```

기본 Column 예:

```text
class
student_number
student_name
question_1
question_2
...
```

임의 형식 파일의 자동 Header Mapping은 향후 확장 기능으로 두며, MVP에서 교사에게 모든 Column을 처음부터 직접 Mapping하도록 강제하지 않는다.

## 7.5 INPUT File Limit — MVP 기본값

업로드 실패를 늦게 발견하거나 브라우저·서버 자원을 과도하게 사용하는 문제를 줄이기 위해 MVP 기본 제한값을 둔다. 값은 코드에 흩어져 하드코딩하지 않고 **Config 상수로 관리**한다.

```text
Image        ≤ 10 MB / file
PDF          ≤ 30 MB / file
PDF pages    ≤ 100 pages / file
CSV / XLSX   ≤ 10 MB / file
Batch Images ≤ 100 files / upload
```

- Client 사전검증과 Server 최종검증을 모두 적용한다.
- 제한 초과 시 이유와 허용 범위를 사용자에게 표시한다.
- 운영 환경에서 조정할 수 있지만 Module PRD가 임의로 서로 다른 값을 사용하지 않는다.

---

# 8. Input Confirmation & Storage

INPUT은 **정확히 관찰된 데이터와 교사 판단이 필요한 데이터를 구분**한다.

### 자동 저장 가능
- QR로 Activity가 이미 확정된 경우
- Class + Student Number + Name이 Roster와 정확히 일치한 경우
- VLM이 읽은 관찰 응답이 Schema Validation을 통과하고 신뢰 가능한 경우

### 교사 확인 필요
- 기존 자료의 Activity/Standard 자동 분류
- 학생 이름/번호가 누락·불확실한 경우
- 학생 응답 인식이 불확실하거나 실패한 경우
- 파일 품질 문제로 자동 처리가 어려운 경우

```text
확실한 데이터
→ 자동 저장

불확실한 데이터
→ REVIEW_PENDING
→ 원본과 비교
→ 교사 수정/확인
```

저장 구조:

```text
Artifact 원본 → Object Storage
Submission 관계/상태 → PostgreSQL
StructuredInput → submissions.structured_input JSONB
Student / Activity / Standard / Artifact → ID/FK로 연결
필요한 검토·승인 → Review/Audit Log
```

---

# 9. PROCESS Module

PROCESS는 **저장된 자료를 교사가 원하는 시점에 분석하는 단계**다. INPUT 완료와 PROCESS 실행을 분리한다.

이유:
- 모든 자료를 즉시 AI 분석하면 API 사용량 증가
- 지금 분석할 필요 없는 자료도 존재
- 대량 업로드 후 필요한 학생/Activity만 분석 가능해야 함

## 9.1 상태 분리

INPUT과 PROCESS의 상태를 하나로 합치지 않는다.

```text
input_status
UPLOADING
STORED
PREPROCESSING
STRUCTURING
REVIEW_PENDING
READY_FOR_PROCESS
FAILED

process_status
NOT_STARTED
READY_TO_ANALYZE
ANALYZING
REVIEW_REQUIRED
APPROVED
FAILED
```

INPUT이 `READY_FOR_PROCESS`가 되면 교사가 분석 범위를 선택하여 PROCESS를 실행한다.

교사는 개별 학생, Activity 전체, 선택 학생, 특정 기간을 골라 분석할 수 있다.

## 9.2 Standard/AchievementLevel-based Analysis

### Input

```text
StructuredInput
+ Original Artifact
+ Approved Standard
+ Standard별 AchievementLevel
+ Previous Approved Evidence (선택)
```

### AI Output

```text
evidence[]
strengths[]
difficulties[]
errors[]
achievement_level
feedback_candidate
follow_up_candidate
```

### 구현 방안
- VLM을 기본 분석 엔진으로 사용
- 원본 이미지/PDF 직접 전달
- Structured Output(JSON Schema) 강제
- “관찰되지 않은 사실을 생성하지 말 것”을 시스템 규칙에 포함
- Evidence마다 원본 위치/문항/페이지 연결
- 오류 시 retry + `FAILED` 상태

## 9.3 교사 분석 검토

가능한 행동:

```text
승인
수정 후 승인
Evidence 추가
Evidence 삭제
분석 반려
재분석 요청
```

승인 전 분석은 성장/리포트 집계에 포함하지 않는다.

---

# 10. 누적 분석

데이터가 누적되면 단일 Activity가 아니라 시간 흐름을 분석한다.

분석 대상:
- 강점의 지속 여부
- 반복되는 어려움
- 반복 실수
- 오류 감소/증가
- 피드백 이후 변화
- 성취기준별 변화
- 최근 성장

```text
Approved Evidence A
+ Approved Evidence B
+ Approved Evidence C
→ AI 비교
→ Growth / Pattern Candidate
→ 교사 검토·수정·승인
→ Approved Growth Event
```

### 표현 원칙

```text
X: 이 학생은 분수 개념이 부족하다.
O: 최근 3개 활동에서 분모가 다른 분수 비교 과정에서 동일 유형의 오류가 반복 관찰되었다.
```

---

# 11. OUTPUT Module

OUTPUT은 승인된 데이터를 **교사가 원하는 관점으로 골라 이해하고 활용하는 단계**다.

## 11.1 Filter System

대상:
- 학생
- 학급
- 학생 그룹

범위:
- 개별 Activity
- 누적
- 과목
- 영역/단원
- 성취기준
- 기간
- 종합

목적:
- 교사용
- 학생용
- 학부모 상담용
- 교육기록용

## 11.2 Individual Activity Report
- 원본 결과물
- 성취기준
- 성취수준 결과
- Evidence
- 강점
- 어려움
- 피드백
- 학급 공통 패턴

## 11.3 Cumulative Growth Report
- 성취기준별 변화
- Evidence Timeline
- 강점의 지속
- 반복 어려움
- 최근 성장
- 교사 Support
- Support 이후 변화
- 다음 목표

## 11.4 Integrated Dashboard

```text
┌────────────────────────────────────────────────────┐
│ 오늘의 TRACE                                      │
│ 검토 대기 8 · 분석 가능 21 · 확인 필요 2          │
├────────────────────────────────────────────────────┤
│ 최근 Activity                                     │
│ 제출 / 분석 / 승인 진행률                         │
├──────────────────────┬─────────────────────────────┤
│ 학급 공통 어려움     │ 최근 성장                  │
├──────────────────────┼─────────────────────────────┤
│ 지원 필요한 학생     │ 후속학습 진행              │
└──────────────────────┴─────────────────────────────┘
```

## 11.5 Visualization
- 성취기준별 상태 카드
- Evidence Timeline
- 도달수준 분포
- 반복 오류 빈도
- 전/후 비교
- Activity 제출·승인 현황

긴 AI 설명보다 시각자료를 우선하고, AI 설명문은 보조한다.

---

# 12. Feedback & Follow-up

문제 재정의에서 확인된 핵심 요구인 **분석을 다음 교육적 행동으로 연결**하기 위한 기능이다.

AI는 학생 피드백, 다음 목표, 재지도, 보충학습, 심화학습, 수정 과제, 추가 질문, Follow-up Activity를 제안할 수 있다.

모두 교사가 수정·승인한다.

승인된 Follow-up Activity는 다시 INPUT으로 들어가고 기존 Activity와 관계를 저장한다.

```text
parent_activity_id
support_id
target_student_ids
```

---

# 13. 상담 / 교육기록 출력

교육기록은 AI가 기억으로 쓰지 않는다.

```text
교사 조건 입력
→ Approved Evidence DB 검색
→ 관련 Evidence Chain
→ AI 요약 초안
→ 교사 검토·편집·승인
```

원칙:

> **Evidence → Summary → Draft**

---

# 14. 인증과 접근

## Teacher
교사 인증은 **Supabase Auth의 Google Provider를 이용한 Google OAuth**를 MVP 기본 인증 방식으로 사용한다.

사용자 화면에서는 별도의 `회원가입` / `로그인` 절차를 나누지 않고 **`Google로 계속하기`** 하나의 진입점을 사용한다.

```text
[신규 교사]
Google로 계속하기
→ Google OAuth
→ Supabase Auth User 생성
→ Teacher Profile 기본정보 설정
   - name 필수
   - nickname 선택
→ TRACE Teacher Profile 생성
→ 최초 설정(Onboarding)
   1. Class 생성
   2. Student Roster 등록
→ TRACE 사용 시작

[기존 교사]
Google로 계속하기
→ Google OAuth
→ 기존 Supabase Auth User 확인
→ teachers.auth_user_id로 기존 Teacher Profile 조회
→ 기존 Class / Student / Activity 데이터 로드
→ 대시보드
```

### 회원 Lifecycle 원칙
- **신규 사용자의 첫 Google 인증은 회원가입을 겸한다.**
- **기존 사용자의 Google 인증은 로그인으로 처리한다.**
- 별도 이메일/비밀번호 회원가입은 MVP에서 제공하지 않는다.
- Google OAuth 성공 후 Supabase Auth의 `auth.users.id`를 기준으로 TRACE `teachers.auth_user_id`와 연결한다.
- Teacher Profile은 `name`을 필수로 저장하고 화면 개인화를 위한 `nickname`을 선택적으로 저장할 수 있다.
- 신규 사용자는 OAuth callback 후 Teacher Profile이 없으면 `/onboarding/profile`에서 기본정보를 설정한다.
- 최초 로그인 시 대응되는 Teacher Profile이 없으면 생성한다.
- 기존 Teacher Profile이 있으면 새로 만들지 않고 기존 Profile과 데이터를 재사용한다.
- Google Access Token 자체를 TRACE 내부 식별키로 사용하지 않는다.
- TRACE 내부 관계는 `teachers.id` UUID를 기준으로 한다.
- OAuth callback 및 Session 검증은 Server/Supabase Auth 기준으로 처리한다.
- 역할은 MVP에서 `teacher` 하나로 단순화한다.
- 본인 `teacher_id`에 연결된 Class / Student / Activity만 접근할 수 있다.

### 최초 설정(Onboarding)
최초 Teacher Profile 생성 직후에는 다음 순서로 초기 설정을 안내한다.

```text
Teacher Profile 기본정보 설정 및 생성
→ Class 생성
→ Student Roster 등록
→ Activity 생성/배정 가능
```

학급/명단이 없는 신규 교사는 Dashboard에 바로 빈 화면으로 진입시키기보다 Class/Roster Setup CTA를 우선 제공한다.

### 시연 계정
해커톤 시연에서는 사전에 한 번 Google OAuth 로그인을 완료하여 Teacher Profile과 Session/Account 연결이 이미 존재하는 계정을 사용할 수 있다.

다만 구현 자체는 신규/기존 사용자 두 경우를 모두 처리해야 하며, 시연 편의를 위해 신규 가입 흐름을 생략 구현하지 않는다.

## Student

```text
QR / Short Link
→ Class Code
→ Student Number + Name
→ 해당 Activity 제출 화면
```

보안:
- Class Code 만료/재발급
- Activity 범위 접근
- 다른 학생 Submission 조회 금지
- QR에 실명·민감정보 포함 금지
- 학생 계정·비밀번호를 만들지 않는다
- 학생 기기·브라우저 종류를 제한하지 않는다. 폰·태블릿·크롬북·노트북에서 모두 동작해야 한다
- 카메라를 쓸 수 없는 학생을 배제하지 않는다. 파일 선택 경로가 항상 열려 있어야 한다

---

# 15. 데이터 아키텍처

```text
Teacher
  ↓
Class
  ↓
Student

Activity
  ├─ Standard[]
  └─ TRACE Content Code
        ↓
Submission
        ↓
Artifact (Original)
        ↓
StructuredInput
        ↓
Analysis (AI Draft)
        ↓
Review
        ↓
Approved Evidence
        ↓
Support
        ↓
Follow-up Activity
        ↓
New Evidence
        ↓
GrowthEvent
        ↓
Report
```

## 권장 Core Entities

| Entity | 역할 |
|---|---|
| `Teacher` | 교사 계정 |
| `Class` | 학급 및 참여 코드 |
| `Student` | Class에 소속된 학생 식별자 |
| `Activity` | 학습활동 |
| `Standard` | 교육과정 성취기준 |
| `Submission` | 학생의 Activity 제출 기록 |
| `Artifact` | 원본 이미지/PDF/파일 |
| `StructuredInput` | 관찰 가능한 학생 응답을 담는 구조화 JSONB (`STORED / REVIEW_PENDING`) |
| `Analysis` | AI 분석 원본 |
| `Evidence` | 승인 가능한 학습 근거 |
| `Review` | 교사 검토·수정·승인 기록 |
| `Support` | 피드백·후속 지원 |
| `GrowthEvent` | 승인된 변화/성장 근거 |
| `Report` | 필터 기반 출력 결과 |

---

# 16. 기술 구현 아키텍처

```text
[Frontend]
Teacher Web / Student Mobile Web
        │
        ↓
[Server/API]
Auth
Activity API
Upload API
AI Orchestrator
Review API
Report API
        │
 ┌──────┼────────────┐
 ↓      ↓            ↓
DB    Storage     VLM Provider
 │      │            │
 └──────┴────┬───────┘
             ↓
     Structured Data Layer
```

## Frontend
- React/Next.js 계열
- Responsive Web
- 학생 제출은 Mobile 우선
- 교사 화면은 Desktop/Tablet 우선

## Database
Supabase PostgreSQL을 사용한다. Student↔Activity↔Submission, Activity↔Standard, Submission↔Artifact, Analysis↔Evidence 관계를 명시적으로 관리한다.

## File Storage
Supabase Storage를 사용한다. 원본 이미지/PDF/XLSX는 Object Storage에 저장하고 DB에는 참조값을 저장한다.

## 기본 Web Stack
- Next.js + TypeScript
- Supabase Auth / PostgreSQL / Storage
- Vercel 배포


## AI Layer
Provider가 바뀌어도 제품 코드를 크게 수정하지 않도록 Adapter 구조를 사용한다.

```text
AIProvider
 ├─ analyzeArtifact()
 ├─ classifyActivity()
 ├─ generateActivity()
 ├─ analyzeEvidence()
 └─ generateReport()
```

현재 기본 전략은 **별도 OCR 없이 VLM이 이미지/PDF를 직접 이해**하는 구조이다.

---


# 16.1 프론트엔드 ↔ 백엔드 통신 구조

TRACE의 프론트엔드는 **화면·사용자 입력·상태 표시**를 담당하고, 백엔드는 **인증·권한검사·DB·Storage·VLM 호출·승인 상태·집계**를 담당한다.

가장 중요한 원칙은 **브라우저가 VLM Provider나 DB Secret에 직접 접근하지 않는 것**이다.

```text
┌──────────────────────── CLIENT / FRONTEND ────────────────────────┐
│                                                                  │
│ Teacher Web                         Student Mobile Web            │
│ - OAuth Login                       - QR/Short Link               │
│ - Activity Builder                  - Class Code                  │
│ - Upload / Review                   - Camera/File Submit          │
│ - Dashboard / Report                - Submission Status           │
│                                                                  │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTPS / JSON / multipart
                            ↓
┌──────────────────────── SERVER / BACKEND ─────────────────────────┐
│ Auth & Authorization                                              │
│        ↓                                                          │
│ API / Server Actions                                              │
│ ┌────────────┬──────────────┬─────────────┬───────────────┐       │
│ │ Activity   │ Submission   │ AI Service  │ Review/Report │       │
│ │ Service    │ Service      │ Orchestrator│ Service       │       │
│ └─────┬──────┴──────┬───────┴──────┬──────┴──────┬────────┘       │
│       │             │              │             │                │
└───────┼─────────────┼──────────────┼─────────────┼────────────────┘
        │             │              │             │
        ↓             ↓              ↓             ↓
   Relational DB   Object Storage   VLM API     Aggregate/Export
   metadata        image/PDF/xlsx   Provider    PDF/Chart data
        │             │              │
        └─────────────┴──────┬───────┘
                             ↓
                    Structured Data Layer
```

## 책임 경계

| 영역 | Frontend | Backend |
|---|---|---|
| 로그인 UI | O | OAuth callback, session, 권한검사 |
| 파일 선택/카메라 | O | 업로드 검증, Storage 저장 |
| Activity 입력 폼 | O | 유효성 검사, DB 저장, 코드 생성 |
| AI 요청 버튼 | O | VLM 호출, Prompt/Schema 관리 |
| AI 결과 표시/편집 | O | Draft 저장, 승인 상태 관리 |
| Dashboard 화면 | O | 집계 Query, Filter, 통계 계산 |
| Secret/API Key | X | O, 환경변수로만 보관 |
| DB 직접 접근 | 원칙적으로 X | O |

---

# 16.2 주요 통신 시퀀스

## A. 교사가 기존 활동지를 업로드하고 자동 분류하는 경우

```text
Teacher Frontend        Backend/API          Storage           VLM          DB
      │                     │                  │                │            │
      │ 1. 파일 + 최소정보   │                  │                │            │
      ├────────────────────>│                  │                │            │
      │                     │ 2. 권한/형식검사   │                │            │
      │                     ├─────────────────>│ 저장           │            │
      │                     │<─────────────────┤ artifact_ref   │            │
      │                     │ 3. Artifact 생성 ────────────────────────────>│
      │<────────────────────┤ submission/artifact_id                        │
      │                     │                  │                │            │
      │ 4. 자동분류 요청     │                  │                │            │
      ├────────────────────>│ 5. 원본+후보 Standards ────────>│            │
      │                     │<───────────────────────────────┤ JSON Draft │
      │                     │ 6. Draft 저장 ───────────────────────────────>│
      │<────────────────────┤ review_required + draft                      │
      │                     │                                               │
      │ 7. 교사 수정/승인    │                                               │
      ├────────────────────>│ 8. 승인·수정본 저장 ────────────────────────>│
      │<────────────────────┤ approved                                      │
```

### UX 상태

```text
Uploading → Classifying → Review Required → Approved
                         ↘ Failed / Retry
```

---

## B. 학생이 QR로 촬영 제출하는 경우

```text
Student Mobile       Backend/API        DB/Auth          Storage
      │                   │                │                │
      │ QR/Short Link      │                │                │
      ├──────────────────>│ class/activity token 검증       │
      │<──────────────────┤ 제출 화면 허용                  │
      │                   │                                 │
      │ Class Code + Alias │                                 │
      ├──────────────────>│ 권한/범위 검증 ───────────────>│
      │<──────────────────┤ student_session                 │
      │                   │                                 │
      │ 사진/파일 제출      │                                 │
      ├──────────────────>│ ──────────────────────────────>│ 저장
      │                   │ Submission/Artifact 생성 ─────>│ DB
      │<──────────────────┤ submission_id + success         │
```

학생 제출 직후 PROCESS의 교육적 분석을 실행할 필요는 없다. INPUT에서 Artifact와 StructuredInput을 저장하고 `READY_FOR_PROCESS`가 된 뒤 교사가 Activity 또는 학생 범위를 선택해 PROCESS 분석을 실행한다.

---

## C. 교사가 저장된 학생자료를 분석하는 경우

```text
Teacher Frontend      Backend          DB/Storage            VLM
      │                   │                │                   │
      │ 분석 실행          │                │                   │
      ├──────────────────>│ 권한 검사       │                   │
      │                   │ 승인된 Context 조회              │
      │                   ├───────────────>│                   │
      │                   │ Artifact + AchievementLevel + Standard     │
      │                   │<───────────────┤                   │
      │                   │ ────────────────────────────────>│
      │                   │          VLM Structured JSON      │
      │                   │<────────────────────────────────│
      │                   │ Analysis Draft 저장 ────────────>│ DB
      │<──────────────────┤ review_required                   │
      │                   │                                   │
      │ 수정/승인          │                                   │
      ├──────────────────>│ Review + Approved Evidence ─────>│ DB
      │<──────────────────┤ approved                          │
```

### 장시간 AI 요청 처리

VLM 응답은 일반 DB 요청보다 느릴 수 있으므로 Frontend가 요청 하나를 계속 붙잡고 있는 구조보다 **Job 상태 기반 처리**를 권장한다.

```text
POST /analysis-jobs
→ { job_id, status: "QUEUED" }

Frontend
→ GET /analysis-jobs/{job_id}
   또는 Realtime subscription

QUEUED → PROCESSING → REVIEW_REQUIRED
                   ↘ FAILED
```

해커톤 구현에서 별도 Queue 인프라가 과도하면 Server Route에서 즉시 실행하더라도, DB 상태값과 API 형태는 위 구조를 따르도록 해 이후 비동기 처리로 교체 가능하게 한다.

MVP의 기본 영속화 방식은 **Shared PostgreSQL의 `processing_jobs` Table**로 한다. 페이지 이동·새로고침 후에도 `job_id`로 진행 상태를 다시 조회할 수 있어야 한다. 단, 공통 DB Schema에 해당 Table이 아직 반영되지 않았다면 구현에서 임의 생성하지 않고 먼저 Shared DB 계약을 갱신한 뒤 동기화한다.

---

# 16.3 권장 API Contract

경로명은 기술 스택에 따라 바뀔 수 있으나 모듈 간 역할은 고정한다.

| Method / Route | 목적 | 주요 입력 | 주요 출력 |
|---|---|---|---|
| `POST /api/activities` | Activity 생성 | 학년/교과/활동정보 | `activity_id`, `trace_code` |
| `POST /api/activities/classify` | 기존 자료 역분류 | `artifact_id` | 분류 Draft, Standard 후보 |
| `POST /api/submissions` | Submission 생성 | 학생/Activity/source | `submission_id` |
| `POST /api/artifacts/upload` | 원본 파일 저장 | multipart file | `artifact_id`, storage ref |
| `POST /api/import/spreadsheet` | TRACE 표준 XLSX/CSV Import | file + activity_id | import preview/draft |
| `POST /api/analysis-jobs` | 분석 실행 | submission/activity ids | `job_id` |
| `GET /api/analysis-jobs/:id` | 분석 상태 조회 | job id | status, progress/result |
| `PATCH /api/reviews/:id` | AI 결과 수정/승인/반려 | decision + edits | approved entity |
| `GET /api/evidence` | 승인 Evidence 조회 | filters | evidence list |
| `GET /api/dashboard` | 통합 집계 | class/period filters | chart/card data |
| `POST /api/reports` | 리포트 생성 | target/scope/purpose | report draft |
| `POST /api/follow-up` | 후속 Activity 생성 | support + target | child activity |


### Auth / Class / Roster

| Method / Path | 역할 | 주요 입력 | 주요 출력 |
|---|---|---|---|
| `GET /auth/google` 또는 Supabase Auth Client | Google 로그인 시작 | Google OAuth | OAuth redirect |
| `GET /auth/callback` | OAuth callback/session 확정 | provider callback | Teacher session |
| `POST /api/classes` | Class 생성 | grade, name, subject? | class_id, class_code |
| `GET /api/classes` | 내 Class 조회 | Teacher session | Class[] |
| `POST /api/classes/{class_id}/students/import` | 학생명단 표준 CSV/XLSX Import | roster file | preview/validation/import result |
| `POST /api/classes/{class_id}/students` | 학생 직접 추가 | number, name | student_id |
| `GET /api/classes/{class_id}/students` | Roster 조회 | class_id | Student[] |


## 응답 형식 원칙

Frontend가 AI Provider의 제각각인 응답을 직접 해석하지 않도록 Backend에서 TRACE 공통 형식으로 변환한다.

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "request_id": "REQ-...",
    "status": "REVIEW_REQUIRED"
  },
  "error": null
}
```

오류:

```json
{
  "ok": false,
  "data": null,
  "meta": { "request_id": "REQ-..." },
  "error": {
    "code": "AI_TIMEOUT",
    "message": "분석에 실패했습니다. 다시 시도할 수 있습니다."
  }
}
```

---

# 16.4 Frontend 상태와 Backend 상태의 대응

INPUT과 PROCESS는 상태 생명주기를 분리한다.

### INPUT 상태

| `input_status` | Frontend 표시 | 교사 행동 |
|---|---|---|
| `UPLOADING` | 업로드 중 | 대기 |
| `STORED` | 저장 완료 | 자동 처리 대기/계속 |
| `PREPROCESSING` | 자료 정리 중 | 다른 작업 가능 |
| `STRUCTURING` | 응답 구조화 중 | 다른 작업 가능 |
| `REVIEW_PENDING` | 검토 대기 | 불확실 항목 확인/수정 |
| `READY_FOR_PROCESS` | 분석 준비 | 분석 범위 선택 |
| `FAILED` | 처리 실패 | 원인 확인/재시도 |

### PROCESS 상태

| `process_status` | Frontend 표시 | 교사 행동 |
|---|---|---|
| `NOT_STARTED` | 미분석 | 필요 시 분석 |
| `READY_TO_ANALYZE` | 분석 대기 | 분석 시작 |
| `ANALYZING` | AI 분석 중 | 다른 작업 가능 |
| `REVIEW_REQUIRED` | 분석 검토 필요 | 원본과 비교, 수정/승인 |
| `APPROVED` | 승인 완료 | 누적 분석/리포트 사용 |
| `FAILED` | 분석 실패 | 재시도 |

Dashboard는 두 상태를 조합해 “검토 대기”, “분석 준비”, “분석 중”, “승인 완료” 등을 표시한다.

---

# 16.5 보안 경계가 포함된 통신 원칙

```text
Browser
  │  사용자 입력 / 공개 token
  │  Secret 없음
  ↓
TRACE Server
  │  Session/Role 검사
  │  Input validation
  │  Rate limit
  ├────────→ DB
  ├────────→ Private Storage
  └────────→ VLM API (Server-side Secret)
```

1. VLM API Key는 Frontend에 전달하지 않는다.
2. 학생은 `class_id`만 안다고 모든 학급 데이터를 읽을 수 없어야 한다.
3. 파일 업로드는 허용 MIME/type/size를 서버에서 다시 검증한다.
4. VLM에 전송하는 데이터는 현재 분석에 필요한 Artifact와 최소 Context만 포함한다.
5. 원본 Storage URL은 public permanent URL보다 signed URL/private access를 권장한다.
6. 모든 Teacher Approval은 `reviewer_id`, `reviewed_at`, 변경값을 Audit Log에 남긴다.
7. Frontend에서 숨겼다고 권한이 보장되는 것이 아니므로 모든 API에서 서버 권한검사를 다시 수행한다.

---

# 17. UI/UX 원칙

입력 부담을 줄이는 것이 핵심 문제이므로 UI는 기능 수보다 **행동 수 최소화**를 우선한다.

1. 한 화면의 Primary Action은 가능하면 하나
2. 이미 아는 정보는 다시 묻지 않음
3. 필수값 최소화
4. AI 자동 추천 + 교사 수정 방식
5. 자동 처리와 “확인 필요”를 명확히 구분
6. 원본과 AI 결과를 나란히 비교
7. 긴 AI 문장보다 카드·그래프·타임라인 우선
8. Responsive UI
9. 심미적 일관성 유지
10. **기기를 가리지 않는다** — 폰·태블릿·크롬북·노트북에서 같은 기능이 동작한다
11. **조작보다 상태를 먼저 알린다** — 자동 처리 중에는 사용자가 무엇을 해야 하는지 화면이 먼저 말한다

대표 UX:

```text
교사: [+ 학습자료 추가] → 일괄 업로드 또는 카메라 연속 스캔
      → AI 자동분류 → 수정할 것만 확인 → 승인
학생: QR → 학급 코드 + 번호 + 이름 확인 → 활동지를 들면 자동 촬영 → 제출
```

## 17.1 종이 프로토타입 확정 사항

2026.8.27 팀 종이 프로토타입 12장면에서 확정된 화면 구조는 이 PRD의 기능 정의와 함께 구현 기준이 된다.

```text
전역 Primary Action   모든 교사 화면 우상단에 [+ 학습자료 추가] 상시 노출
입력 진입             [교사 일괄 업로드] / [학생 직접 제출] 2분할 모달
업로드 3단계          파일 업로드 → 자료 분석 중 → 자료 정보 확인
자료 정보 확인         학년 / 과목 / 단원 / 관련 성취기준 4필드 (AI 선입력 + 교사 확인)
분석 검토             좌 원본 / 우 AI 분석 4카드(강점·어려운 점·근거·피드백 초안) + [수정][반려][승인]
리포트                좌 클래스 분석 / 우 개별 학생 2단 동시 배치
후속 활동             [+ 후속 활동 만들기] → 제안 3건 → 후속 활동 리포트 생성
```

세부 시각 규격과 카피는 `TRACE_UIUX_MASTER_PROMPT.md`를 기준 문서로 한다.

---

# 18. 보안·개인정보

TRACE는 **Privacy by Design**을 MVP 구현 원칙으로 사용한다.

본 절의 보안 요구사항은 두 수준으로 구분한다.

```text
A. Hackathon MVP에서 실제 구현할 보안
B. 실제 학생 데이터 운영 전 Production Gate로 반드시 검토·구현할 보안
```

교육분야 가명·익명정보 처리 가이드라인의 최소항목 처리, 접근권한 최소화·분리, 기록관리, 재식별 위험관리 원칙을 참고하되, TRACE의 일반 운영 전체를 가명정보 처리시스템으로 간주하지 않는다.

TRACE의 일상적인 수업 운영에서는 Teacher가 실제 Student를 식별해야 하므로 `Student.name`, `student_number` 등의 개인정보를 내부에서 사용할 수 있다. 대신 **식별정보가 필요하지 않은 AI 처리·로그·통계 영역으로 불필요하게 확산되지 않도록 경계를 구현한다.**

## 18.1 개인정보 처리 영역 구분

```text
Identity Zone
- Teacher 계정정보
- Student 이름
- Student 번호
- Class / Roster

Learning Zone
- Submission
- Artifact
- StructuredInput
- Analysis
- Evidence
- GrowthEvent

AI Boundary
- 분석에 필요한 최소 Learning Context만 전달
- Student 이름/번호, Teacher 이메일 등 직접 식별정보 제거
```

DB 관계는 `student_id` UUID로 유지하되, AI Provider에는 Student 이름/번호를 기본 전달하지 않는다.

## 18.2 MVP 구현 보안 — 확정 14개

### S-01. Google OAuth + Server Session 검증
- Teacher 인증은 Supabase Auth Google Provider를 사용한다.
- 모든 보호된 Teacher Route/API는 유효한 Session을 요구한다.
- OAuth callback 이후 Server/Supabase 기준으로 Session을 검증한다.

### S-02. Supabase RLS
MVP에서도 RLS를 활성화한다.

최소 접근 원칙:

```text
teachers
→ auth.uid() = auth_user_id인 본인

classes
→ 본인 teacher_id 소유 Class

students
→ 본인 Class의 Student

activities
→ 본인 Teacher Activity

activity_assignments
→ 본인 Activity/Class 범위

submissions
→ 본인 ActivityAssignment 범위

artifacts
→ 접근 가능한 Submission 범위

analyses / evidence / reviews / growth_events
→ 접근 가능한 Submission/Analysis/Student 범위
```

Frontend에서 숨기는 것만으로 권한을 보장하지 않는다.

### S-03. Teacher Ownership Server 재검사
모든 주요 Server API/Server Action에서 RLS와 별개로 대상 Resource가 현재 Teacher 소유 범위인지 다시 확인한다.

특히:

```text
Class
Student
Activity
ActivityAssignment
Submission
Artifact
Analysis
Report
```

에 적용한다.

### S-04. Student Public Submit API 분리
학생 제출 Browser에는 Teacher용 DB 조회 권한을 주지 않는다.

금지:

```text
Student Browser
→ students Table 직접 SELECT
```

허용:

```text
Student Browser
→ Public Submit API
→ Server Roster Verification
→ 성공/실패 결과
```

### S-05. Class Code + 번호 + 이름 Server 검증
Student 제출 본인확인은 Server에서:

```text
submission_token
+ Class Code
+ Student Number
+ Student Name
```

을 검증한다.

`submission_token`은 ActivityAssignment 범위를 결정하고, Class Code + Number + Name은 Roster 본인확인에 사용한다.

### S-06. 학생 검증 실패 메시지 통일
Roster 존재 여부를 추측할 수 없도록 실패 원인을 세분화하여 Client에 알려주지 않는다.

예:

```text
입력한 정보가 학급 정보와 일치하지 않습니다.
```

다음과 같은 응답은 금지한다.

```text
"12번 학생은 존재하지만 이름이 다릅니다."
"해당 이름은 7번입니다."
```

### S-07. QR / Submission Token에 PII 미포함
QR과 Short Link에는 다음을 넣지 않는다.

```text
Student name
Student number
Teacher email
기타 학생 개인정보
```

`submission_token`은 추측하기 어려운 Random Token으로 생성하고 ActivityAssignment 범위로 제한한다.

### S-08. Private Storage + Signed URL
- Supabase Storage의 Student Original Artifact는 Private Bucket을 사용한다.
- 영구 Public URL을 사용하지 않는다.
- Client 또는 외부 AI가 파일 URL을 필요로 할 때만 짧은 만료 Signed URL을 Server에서 생성한다.

### S-09. Storage Object Key UUID화
실제 Storage Object Key에 원본 파일명의 학생 이름 등을 사용하지 않는다.

권장:

```text
{uuid}.{ext}
```

예:

```text
teachers/{teacher_id}/submissions/{submission_id}/original/{artifact_uuid}.pdf
```

원본 Local Filename은 반드시 필요한 경우에만 별도 Metadata로 제한하여 저장하며 Server Log에는 기록하지 않는다.

이미지 Processed Artifact를 생성할 때는 가능한 경우 EXIF/위치 Metadata를 제거한다.

### S-10. API Key / Service Role Server 전용
다음 Secret은 Client Bundle에 포함하지 않는다.

```text
AI Provider API Key
Supabase Service Role Key
기타 Server Secret
```

Environment Variable은 Server Runtime에서만 사용한다.

### S-11. AI 호출 Server-side
Browser가 AI/VLM Provider를 직접 호출하지 않는다.

```text
Client
→ TRACE Server
→ Privacy Filter / Context Builder
→ AI Adapter
→ Provider
```

### S-12. AI Context PII 최소화
외부 AI Provider에 보내는 Context는 현재 분석 목적에 필요한 최소정보만 포함한다.

기본 제외:

```text
Student name
Student number
Teacher email
Google account information
불필요한 Class 표시명
전체 Roster
다른 Student 정보
```

기본 포함 가능:

```text
Activity
Standard
AchievementLevel
StructuredInput
분석에 필요한 Artifact
필요한 이전 Approved Evidence
```

AI 요청에서 영구 `student_id`도 반드시 필요한 경우가 아니면 전달하지 않는다. Provider가 Student를 장기간 추적할 수 있는 식별자를 만들지 않는다.

### S-13. 개발/시연 합성 Student Data 사용
Hackathon 개발·테스트·시연에는 실제 학생 개인정보 대신 합성 Student Data를 사용한다.

예:

```text
1번 학생A
2번 학생B
```

Demo 화면에서도 실제 학생 실명/학습자료를 사용하지 않는다.

### S-14. 최소 Audit Log 실제 구현
주요 보안·교육적 확정 이벤트는 Persistent Audit Log로 남긴다.

최소 이벤트:

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

Audit Log에는 다음을 저장하지 않는다.

```text
Student name
Student answer 전문
AI Prompt 전문
Signed URL
Access Token
Submission Token
Secret
```

최소 기록:

```text
actor_teacher_id
action
entity_type
entity_id
request_id
created_at
```

Audit Log는 제품의 교육적 `Review`와 별개다.

```text
Review
= 교사의 교육적 검토/승인

Audit Log
= 누가 언제 어떤 보안·중요 처리행위를 했는지 기록
```

## 18.3 MVP 학생 제출 추가 방어

다음은 S-04~S-07 구현의 일부로 권장한다.

```text
- submission_token 충분한 Randomness
- CLOSED/ARCHIVED Assignment 제출 차단
- Class Code 재발급
- 반복 실패에 대한 기본 Rate Limit
```

MVP 기본값은 다음과 같이 두되, **Config로 관리하여 운영 환경에서 조정 가능**하게 한다.

```text
Class Code validity = 24시간
교사 = 즉시 재발급 가능
재발급 시 기존 Code = 즉시 무효

Public verification Rate Limit default
동일 IP + submission_token 기준
5분 내 검증 실패 10회 초과
→ 10분 제한
```

성공 시 실패 누적은 초기화할 수 있다. 보안 기본값을 Module별로 임의 변경하지 않는다.

## 18.4 원본 Artifact와 AI Privacy Boundary

MVP에서는 실제 학생자료를 사용하지 않으므로 자동 PII Redaction을 필수 구현으로 두지 않는다.

다만 Architecture는 다음 확장을 허용해야 한다.

```text
ORIGINAL
- Teacher만 확인하는 원본
- Private Storage
        ↓
PROCESSED
- 필요 시 이름/번호/EXIF 제거
        ↓
AI Provider
```

`ORIGINAL`을 PII 제거 결과로 덮어쓰지 않는다.

## 18.5 Production Gate — 실제 학생 데이터 운영 전 필수 검토

다음은 Hackathon MVP 필수 구현에서는 제외하지만, 실제 Student Data를 사용한 운영 전에는 반드시 완료해야 한다.

```text
P-01 자동/반자동 PII Redaction
P-02 원본 이미지의 이름/번호 영역 마스킹 후 외부 AI 전송
P-03 AI Provider의 데이터 학습 사용 여부 검토
P-04 AI Provider 보존기간·처리지역·Subprocessor·삭제 정책 검토
P-05 실제 학생 데이터 사용에 대한 기관 승인/법적 근거 검토
P-06 개인정보 처리방침 및 위탁/제3자 제공 고지 정비
P-07 Retention 정책
P-08 Backup 포함 삭제 정책
P-09 Student 삭제 시 연결 데이터 Cascade/Anonymization 정책
P-10 재식별·개인정보 침해 사고 대응 절차
P-11 가명정보를 연구/통계 목적으로 활용하는 경우 별도 관리대장·위험성 검토
P-12 장기 Access Log 보관·점검 정책
P-13 개인정보/가명정보 취급자 역할·권한 분리
P-14 외부 위탁·제3자 제공 계약 및 재위탁 제한
P-15 정기 Privacy/Re-identification Risk Review
```

Production Gate는 단순 TODO가 아니다.

```text
실제 학생 개인정보 사용
→ Production Privacy Review 완료
→ 승인
→ 실제 데이터 사용 허용
```

순서를 따른다.

## 18.6 삭제 및 사고대응 기본 원칙

MVP에서 전체 Cascade 삭제 자동화는 필수 범위가 아니지만, `DATA_DELETE` Action은 Audit Log에 남길 수 있어야 한다.

Production에서는 최소 다음 Chain을 정의한다.

```text
Student
→ Submission
→ Artifact
→ StructuredInput
→ Analysis
→ Evidence
→ Growth 관계
```

재식별 또는 개인정보 사고가 확인된 경우:

```text
처리 중단
→ 접근 차단
→ 필요 시 외부 Provider/수탁자 회수·삭제 요청
→ 관련 Data 파기
→ 사고 및 조치 기록
```

## 18.7 보안 구현 원칙 요약

```text
인증
→ Google OAuth + Session

권한
→ RLS + Server Ownership Check

Student Public Access
→ Public Submit API만

Storage
→ Private + UUID Object Key + Signed URL

AI
→ Server-side + 최소 Context + PII 제거

Demo
→ 합성 데이터

추적
→ Review + Audit Log
```

저장 백엔드는 **Supabase(PostgreSQL/Auth/Storage)** 를 사용하고, Web은 **Next.js + TypeScript**, 배포는 **Vercel**을 기본 스택으로 확정한다.


---

# 19. 모듈화 기준

INPUT–PROCESS–OUTPUT 구조를 그대로 모듈화 기준으로 사용한다.

```text
M0 · SHARED CORE
Auth · Curriculum · Teacher/Class/Student
DB · Storage · Shared Types · Review/Audit

M1 · INPUT
Activity Builder
Existing Material Classifier
TRACE Content Code
Upload / Capture / Spreadsheet Import
StructuredInput

M2 · PROCESS
AchievementLevel-based Analysis
VLM Analysis
Evidence
Teacher Review
Cumulative Analysis
Growth Candidate

M3 · OUTPUT
Filter Engine
Dashboard
Activity Report
Growth Report
Feedback / Follow-up
Consultation / Education Record
```

각 모듈 PRD에서는 `Input / Output / DB Contract / API Contract / UI / AI Schema / Teacher Approval Point / Error Handling / Acceptance Criteria`를 별도로 정의한다.

---

# 20. Acceptance Criteria

## INPUT
- [ ] 교사는 `Google로 계속하기`로 인증할 수 있다.
- [ ] 최초 Google 인증 사용자는 Supabase Auth User + TRACE Teacher Profile이 생성된다.
- [ ] 기존 사용자는 동일 Google 계정으로 기존 Teacher Profile과 기존 데이터를 다시 불러온다.
- [ ] 최초 가입과 기존 로그인 모두 동일한 Google OAuth 진입점을 사용한다.
- [ ] 신규 Teacher는 Class 생성 + Student Roster 등록 Onboarding으로 진입한다.
- [ ] 교사는 Class를 생성할 수 있다.
- [ ] 교사는 TRACE 표준 CSV/XLSX 학생명단을 업로드해 Student Roster를 생성할 수 있다.
- [ ] 교사는 학생을 직접 추가/수정할 수 있다.
- [ ] 학생 번호 중복/필수값 누락이 검증된다.
- [ ] 등록된 Roster를 기준으로 Student Matching과 제출/미제출 현황을 계산할 수 있다.
- [ ] 교사는 새 Activity를 생성할 수 있다.
- [ ] AI 활동자료 초안을 생성하고 교사가 수정·승인할 수 있다.
- [ ] 기존 이미지/PDF를 업로드해 학년·교과·영역·성취기준 후보를 받을 수 있다.
- [ ] 교사가 후보를 수정·승인할 수 있다.
- [ ] 학생 사진과 교사 일괄 업로드가 동일한 Artifact 구조로 저장된다.
- [ ] TRACE 표준 CSV/XLSX Template을 다운로드·업로드·검증·미리보기 후 import할 수 있다.
- [ ] Schema Validation을 통과한 StructuredInput은 저장되고, 불확실한 경우에만 `REVIEW_PENDING`을 거쳐 교사 확인 후 확정된다.
- [ ] TRACE Content Code가 규칙에 따라 생성된다.
- [ ] INPUT 파일은 공통 Config 제한값으로 Client/Server 양쪽에서 검증된다.

## PROCESS
- [ ] INPUT 자료는 분석하지 않고 저장만 할 수 있으며 `READY_FOR_PROCESS` 상태로 PROCESS에 연결할 수 있다.
- [ ] 교사가 선택한 시점에 분석을 실행할 수 있다.
- [ ] 장시간 분석은 `job_id`로 추적되며 페이지 이동·새로고침 후에도 진행 상태를 다시 조회할 수 있다.
- [ ] PROCESS는 StructuredInput을 다시 인식하지 않고 교육적 분석 결과를 구조화 JSON으로 반환한다.
- [ ] Evidence가 원본 Artifact에 연결된다.
- [ ] 교사가 분석 결과를 수정·승인·반려할 수 있다.
- [ ] 승인된 Evidence만 누적 분석에 사용된다.
- [ ] 2개 이상의 승인 Evidence를 비교해 성장/반복 패턴 후보를 만들 수 있다.

## OUTPUT
- [ ] 학생/학급/과목/영역/성취기준/Activity/기간 필터가 동작한다.
- [ ] 개별 Activity Report를 만들 수 있다.
- [ ] 누적 Growth Report를 만들 수 있다.
- [ ] 통합 Dashboard가 실제 DB를 조회한다.
- [ ] 시각자료가 실제 집계 데이터에서 생성된다.
- [ ] Feedback/Follow-up 초안을 생성하고 교사가 편집·승인할 수 있다.
- [ ] 승인된 Evidence를 근거로 상담/교육기록 초안을 생성할 수 있다.

## AUTH / SECURITY
- [ ] 교사는 Supabase Auth의 Google Provider를 통해 Google OAuth 로그인한다.
- [ ] 학생은 QR/링크 + Class Code 방식으로 제출에 접근한다.
- [ ] 다른 학생 데이터에 접근할 수 없다.
- [ ] Secret/API Key가 Client에 노출되지 않는다.

---


## SECURITY / PRIVACY
- [ ] Google OAuth Session이 없는 Teacher는 보호된 Route/API에 접근할 수 없다.
- [ ] Supabase RLS가 Teacher 소유권 기준으로 활성화되어 있다.
- [ ] 주요 Server API에서 Resource Ownership을 다시 검사한다.
- [ ] Student Browser는 `students` Table을 직접 조회하지 않는다.
- [ ] Student 제출은 `submission_token + Class Code + Number + Name`을 Server에서 검증한다.
- [ ] 학생 검증 실패 응답은 Roster 존재 여부를 추측할 수 없도록 통일한다.
- [ ] QR/Short Link/Submission Token에 Student PII가 포함되지 않는다.
- [ ] Original Artifact는 Private Storage에 저장되며 영구 Public URL을 사용하지 않는다.
- [ ] Storage Object Key는 Student 이름 대신 UUID 기반으로 생성된다.
- [ ] AI Key와 Supabase Service Role Key는 Server 전용이다.
- [ ] AI/VLM 호출은 Server에서만 수행한다.
- [ ] AI Context에서 Student name/number와 Teacher email을 제거한다.
- [ ] 개발/테스트/시연은 합성 Student Data만 사용한다.
- [ ] 주요 이벤트가 Persistent Audit Log에 기록되고 Audit Log에는 학생 답안/PII/Secret을 기록하지 않는다.

---

# 21. 아직 확정할 기술 결정

- 최종 VLM Provider / Model
- 무료 quota 이후 비용 정책
- 교육과정 JSON의 최종 구조와 버전
- 영역/성취기준 숫자 매핑 규칙
- Class Code/Rate Limit 운영값 조정 범위(기본값은 §18.3 확정)
- 원본 Artifact 보존/삭제 기간
- INPUT File Limit 운영값 조정 범위(기본값은 §7.5 확정)
- 리포트 PDF 생성 방식
- Spreadsheet 확장 범위(임의 Header 자동 Mapping 등)

이 항목은 기능 삭제 여부가 아니라 **구현 Adapter 또는 설정값으로 결정할 항목**이다.

---


# 21.1 기준 동기화 결정사항

## Privacy & Security 강화 결정

Hackathon MVP는 보안 B안으로 확정한다.

```text
Google OAuth + Session
RLS
Server Ownership Check
Student Public Submit API
Class Code + Number + Name
Uniform Verification Error
PII-free QR/Token
Private Storage + Signed URL
UUID Object Key
Server-only Secrets
Server-side AI
AI Context PII Minimization
Synthetic Demo Data
Persistent Audit Log
```

자동 PII Redaction, Provider 계약/보존 정책, 실제 학생 데이터 승인, Retention/Backup 삭제, 재식별 대응 체계 등은 Production Gate로 분리한다.



INPUT Module PRD와 다음 기준으로 동기화한다.

### 인증 Lifecycle 명문화
- `Google로 계속하기` 하나의 UI로 신규 회원가입과 기존 로그인을 모두 처리한다.
- 신규 Google Auth User는 TRACE Teacher Profile을 생성하고 Class/Roster Onboarding으로 이동한다.
- 기존 Google Auth User는 `teachers.auth_user_id`로 기존 Teacher Profile과 데이터를 재사용한다.
- 시연에서는 기존 로그인 계정을 사용할 수 있으나 신규/기존 분기 로직은 실제 구현 범위에 포함한다.


0. 교사 인증은 Supabase Auth Google Provider 기반 Google OAuth를 사용한다.
0. Class 생성과 Student Roster 등록을 학생자료 입력의 선행 기능으로 포함한다.

1. 신뢰 가능한 관찰 응답은 INPUT에서 자동 저장하고, 불확실한 항목만 `REVIEW_PENDING`으로 보낸다.
2. INPUT에서 AI Rubric을 생성하지 않고 Standard별 기존 AchievementLevel을 사용한다.
3. 학생 Entity는 `Student`를 사용하며 학생 제출은 Class Code + Student Number + Name으로 검증한다.
4. CSV/XLSX MVP는 TRACE 표준 Template 방식으로 구현한다.
5. 학생 응답 구조는 `submissions.structured_input JSONB`에 저장하고 Student/Activity/Standard/Artifact는 ID 관계로 연결한다.
6. `input_status`와 `process_status`를 분리한다.
7. 학생 응답의 관찰적 인식은 INPUT에서 끝내고 PROCESS는 이를 다시 추출하지 않는다.
8. 기본 Stack은 Next.js + TypeScript + Supabase + Vercel로 통일한다.

---

# 22. 제품 성공 원칙

TRACE는 AI가 교사를 대신해 평가하는 시스템이 아니다.

```text
학생의 실제 학습자료
→ 낮은 부담으로 입력
→ AI가 구조화·분석
→ 교사가 검토·승인
→ Evidence 누적
→ 성장과 반복 어려움 확인
→ 피드백·후속학습·상담·교육기록
```

> **배움의 흔적을 연결하면, 다음 배움이 보인다.**

TRACE의 성공 기준은 “AI가 얼마나 많은 말을 생성하는가”가 아니라 **교사가 이미 가지고 있는 학생 자료를 얼마나 적은 노력으로 근거 있는 다음 행동으로 바꿀 수 있는가**이다.

---
