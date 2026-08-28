# TRACE 공통 로그인 · 최초 Teacher Profile 온보딩 구현 프롬프트

> 이 작업은 INPUT / PROCESS / OUTPUT 특정 모듈 구현이 아니라,  
> **TRACE 전체 서비스가 공통으로 사용하는 메인 인증·회원 기반 구조를 만드는 작업**이다.

---

## 목표

현재 팀원이 만들어둔 프로젝트의 기본 구조와 UI를 유지한 상태에서 다음을 구현한다.

1. Google OAuth 로그인
2. 최초 로그인 사용자만 Teacher Profile 1회 생성
3. 기존 사용자는 기존 Profile 재사용
4. 로그인 후 “내 TRACE 공간”이라는 느낌이 나도록 이름/닉네임 기반 개인화 표시

기술 스택은 현재 프로젝트의:

```text
Next.js
TypeScript
Supabase Auth
Supabase PostgreSQL
```

을 따른다.

기존 구조를 갈아엎거나 중복 레이아웃/라우트를 새로 만들지 않는다.

---

# 1. 로그인 화면

`/login`에 TRACE 로그인 화면을 구현한다.

화면에는 최소한 다음을 보여준다.

```text
TRACE 로고/서비스명
간단한 서비스 소개

[Google로 계속하기]
```

별도의 이메일/비밀번호 회원가입 폼은 만들지 않는다.

Google OAuth 하나로 다음을 처리한다.

```text
신규 사용자 → 회원가입
기존 사용자 → 로그인
```

---

# 2. Google OAuth 흐름

Supabase Auth Google Provider를 사용한다.

```text
/login
→ Google로 계속하기
→ Google OAuth
→ /auth/callback
→ Supabase Session 생성
→ TRACE Teacher Profile 존재 여부 확인
```

인증 성공 후 Server에서 현재 Session을 확인한다.

다음은 Client 또는 Log에 노출하지 않는다.

```text
Google access token
Supabase service role key
기타 민감한 인증정보
```

---

# 3. TRACE Teacher Profile

Google 인증 계정과 TRACE 내부 Teacher Profile을 구분한다.

관계:

```text
auth.users.id
      ↓
teachers.auth_user_id
```

동일 Auth User에 Teacher Profile이 중복 생성되지 않아야 한다.

기존 `teachers` Table/Schema가 있다면 반드시 먼저 확인하고 재사용한다.

TRACE 서비스용 기본 프로필:

```text
name
- 필수
- TRACE에서 사용할 기본 이름

nickname
- 선택
- 비워둘 수 있음
```

Google email은 인증/계정 연결 용도로 사용하고,
별도의 수정 가능한 TRACE 프로필 입력값으로 만들 필요는 없다.

---

# 4. 최초 로그인 온보딩

Google 인증 후 Teacher Profile이 없으면 최초 사용자로 판단한다.

```text
Google OAuth 성공
→ Teacher Profile 없음
→ /onboarding/profile
```

화면 예시:

```text
TRACE에 오신 것을 환영해요.
선생님의 기본 정보를 알려주세요.

이름 *
[                    ]

닉네임 (선택)
[                    ]

[TRACE 시작하기]
```

Validation:

```text
이름은 필수
공백만 입력 불가
앞뒤 공백 제거
nickname은 선택
비정상적으로 긴 입력값 제한
```

`TRACE 시작하기` 클릭 시:

```text
현재 Auth Session 서버 검증
→ 동일 auth_user_id Teacher Profile 재확인
→ 없다면 Teacher Profile 생성
→ DB 저장
→ 다시 조회
→ 성공 시 TRACE 메인 진입
```

중복 클릭이나 OAuth callback 재호출로 Teacher Profile이 두 개 만들어지지 않도록 한다.

---

# 5. 기존 사용자 로그인

Teacher Profile이 이미 있으면:

```text
Google OAuth
→ 기존 Teacher Profile 조회
→ 프로필 입력 화면 Skip
→ TRACE 메인
```

이전에 저장한 이름과 닉네임을 그대로 사용한다.

---

# 6. 로그인 후 개인화

TRACE 메인 또는 공통 상단 영역에서
현재 로그인한 Teacher의 공간이라는 느낌이 나도록 개인화 문구를 보여준다.

표시 우선순위:

```text
nickname 있음
→ nickname 사용

nickname 없음
→ name 사용
```

예:

```text
혜진쌤의 TRACE
```

또는:

```text
안녕하세요, 혜진쌤
```

nickname이 없다면:

```text
김혜진 선생님의 TRACE
```

화면마다 다른 규칙을 만들지 말고
공통 helper/component로 재사용한다.

---

# 7. 진입 규칙

```text
로그인 안 됨
→ /login

로그인됨 + Teacher Profile 없음
→ /onboarding/profile

로그인됨 + Teacher Profile 있음
→ 기존 TRACE 메인 Route
```

현재 프로젝트에 메인 Route가 이미 있으면 그것을 사용한다.

새로운 `/home`, `/main` 같은 중복 Route를 임의로 만들지 않는다.

---

# 8. 보안

반드시 지킨다.

```text
- auth_user_id를 Client가 임의 지정하지 않도록 한다.
- 현재 Server Session의 User ID를 사용한다.
- Teacher Profile 조회/수정은 로그인한 본인만 가능하게 한다.
- 다른 Teacher Profile 접근을 차단한다.
- Google access token을 Log에 남기지 않는다.
- service role key를 Client에 노출하지 않는다.
- 개인정보를 불필요하게 console/log에 출력하지 않는다.
```

---

# 9. 기존 코드 우선

구현 전에 현재 Repository를 먼저 확인한다.

특히 다음이 이미 있는지 확인한다.

```text
Supabase client/server helper
middleware
auth callback
teachers table/schema
공통 Layout
main/dashboard route
shared UI component
TRACE logo/branding
```

있으면 반드시 재사용한다.

현재 팀원이 만든 메인 구조를 대대적으로 리팩터링하지 않는다.

`teachers` Table에 이미 사용할 수 있는 name 관련 필드가 있으면 재사용한다.

nickname 필드가 없고 실제로 필요하다면
기존 Schema를 확인한 뒤 최소 변경으로 추가한다.

동일 목적의 필드를 중복 생성하지 않는다.

---

# 10. UX 상태

다음 상태를 사용자에게 보여준다.

```text
Google 인증 중
로그인 확인 중
프로필 저장 중
오류
```

저장 중 버튼 연타를 막는다.

실패 시 다시 시도할 수 있어야 한다.

무한 redirect loop가 발생하지 않도록 한다.

---

# 11. 반드시 테스트

## 신규 사용자

```text
새 Google 계정
→ Google 로그인
→ Profile 화면
→ 이름 입력
→ 필요하면 닉네임 입력
→ 저장
→ TRACE 메인 진입
```

## 기존 사용자

```text
로그아웃
→ 같은 Google 계정 재로그인
→ Profile 화면이 다시 나오지 않음
→ 기존 Teacher Profile 사용
```

추가 확인:

```text
[ ] nickname이 있으면 nickname 기반 개인화
[ ] nickname이 없으면 name 기반 개인화
[ ] 새로고침 후 로그인/프로필 유지
[ ] 다른 Teacher Profile 조회/수정 불가
[ ] 신규 사용자 Teacher Profile 중복 생성 안 됨
[ ] 기존 사용자가 새 Teacher로 분리되지 않음
[ ] typecheck/build 통과
```

---

# 12. 완료 보고

작업 후 다음 형식으로 보고한다.

```text
STATUS:

FILES CREATED:

FILES MODIFIED:

DB / MIGRATION:

GOOGLE AUTH FLOW:

FIRST LOGIN FLOW:

RETURNING LOGIN FLOW:

PERSONALIZATION:

SECURITY CHECK:

TESTS RUN:

MANUAL TESTS REQUIRED:

REMAINING RISKS:
```

가능하면 실제 로컬 환경에서:

```text
신규 사용자 1회
+
기존 사용자 재로그인 1회
```

를 모두 검증하고 결과를 알려준다.
