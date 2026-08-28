# TRACE Design System

## 1. Atmosphere & Identity

TRACE는 교사의 판단을 대신하는 평가기가 아니라, 학생의 실제 산출물에서 승인된 근거까지 거슬러 올라갈 수 있는 차분한 증거 지도다. 기본 화면은 밝고 명료한 교사용 업무 공간을 유지하며, 리포트의 시그니처는 짙은 네이비 표지 위에서 `INPUT → PROCESS → OUTPUT`이 하나의 빛나는 Evidence 체인으로 연결되는 장면이다. 화려함은 장식이 아니라 근거의 이동, 승인 상태, 최종 교사 책임을 더 잘 읽게 만드는 데 사용한다.

## 2. Color

| Role | Token | Value | Usage |
| --- | --- | --- | --- |
| Canvas | `--background` | `#f8fafc` | 앱 배경 |
| Surface | `--surface` | `#ffffff` | 카드와 문서 |
| Ink | `--foreground` | `#0f172a` | 본문과 제목 |
| Muted | `--muted` | `#64748b` | 보조 설명 |
| Divider | `--border` | `#e2e8f0` | 구분선 |
| TRACE primary | `--brand-600` | `#1d6bf3` | 핵심 인터랙션과 INPUT |
| TRACE deep | `--brand-900` | `#1e3a8a` | 리포트 표지와 깊은 표면 |
| TRACE light | `--brand-50` | `#eff5ff` | 선택·근거 배경 |
| Process | `--info` | `#0284c7` | PROCESS 상태 |
| Approved | `--success` | `#059669` | 승인·OUTPUT 상태 |
| Caution | `--warning` | `#d97706` | 교사 확인 필요 |
| Danger | `--danger` | `#dc2626` | 오류·차단 |
| Report ink | `--report-ink` | `#071426` | 리포트 표지 최심부 |
| Report glow | `--report-glow` | `#60a5fa` | Evidence 체인의 빛 |

규칙:

- 파랑은 Evidence의 이동과 주요 동작에만 사용한다.
- 초록은 승인된 결과에만 사용한다. 생성 중이거나 미확인인 초안에는 사용하지 않는다.
- 리포트의 네이비 표지는 페이지 최상단 한 곳에만 집중해 나머지 업무 화면의 가독성을 지킨다.
- 새 색상은 이 표에 먼저 정의한 뒤 사용한다.

## 3. Typography

| Level | Size | Weight | Line Height | Usage |
| --- | --- | --- | --- | --- |
| Display | `clamp(2rem, 4vw, 3.5rem)` | 800 | 1.08 | 리포트 표지 제목 |
| H1 | `1.5rem` | 700 | 1.3 | 페이지 제목 |
| H2 | `1.25rem` | 700 | 1.4 | 흐름 단계 제목 |
| H3 | `1rem` | 600 | 1.5 | 카드 제목 |
| Body/lg | `1rem` | 400 | 1.75 | 성장 기록과 생기부 제안 |
| Body | `0.875rem` | 400 | 1.6 | 기본 설명 |
| Caption | `0.75rem` | 600 | 1.4 | 상태·메타데이터 |
| Overline | `0.6875rem` | 700 | 1.3 | INPUT/PROCESS/OUTPUT 레이블 |

- Primary: `Pretendard Variable`, Pretendard, system-ui, sans-serif
- Display: `Outfit`, `Pretendard Variable`, Pretendard, system-ui, sans-serif
- 수치에는 tabular figures를 사용한다.
- 한글 제목은 `word-break: keep-all`, 본문은 `text-wrap: pretty`를 적용해 조사와 짧은 어절의 고립을 줄인다.

## 4. Spacing & Layout

4px 단위를 사용한다. 기존 Tailwind 간격 토큰을 유지한다.

| Token | Value | Usage |
| --- | --- | --- |
| `--space-1` | 4px | 아이콘과 레이블 |
| `--space-2` | 8px | 작은 클러스터 |
| `--space-3` | 12px | 내부 요소 간격 |
| `--space-4` | 16px | 모바일 카드 패딩 |
| `--space-5` | 20px | 기본 카드 패딩 |
| `--space-6` | 24px | 큰 패널 패딩 |
| `--space-8` | 32px | 흐름 단계 간격 |
| `--space-12` | 48px | 주요 섹션 간격 |

- 최대 콘텐츠 폭은 기존 교사 Shell이 소유한다.
- 리포트 표지는 비대칭 `1.2fr / 0.8fr` 구성을 사용한다.
- 1024px 미만에서는 모든 흐름을 한 열로 바꾼다.
- 375px에서 주요 콘텐츠의 수평 스크롤이 없어야 한다.
- A4 출력에서는 장식적 표지 높이를 줄이고 각 Evidence 카드와 생기부 제안이 페이지 중간에서 잘리지 않게 한다.

## 5. Components

### Report Cover

- **Structure**: `header` 안에 제목·설명·신뢰 배지와 Evidence 체인 요약을 배치한다.
- **Variants**: 화면용 짙은 표지, 출력용 흰 문서 표지.
- **States**: 정적 정보 표면이며 장식적 hover를 사용하지 않는다.
- **Accessibility**: 장식 그래픽은 `aria-hidden`, 핵심 흐름은 텍스트로 반복한다.
- **Motion**: 최초 진입 시 체인만 짧게 나타나며 reduced motion에서는 즉시 표시한다.
- **Layout**: 비대칭 grid → 모바일 stack.

### Report Ready State

- **Current presentation scope**: `/reports`의 이번 구현·QA 기준은 1280px 이상 데스크톱이다. 기존 축소 화면 stack은 안전장치로 유지하지만 모바일 전용 정보 구조와 인터랙션 최적화는 후속 범위로 둔다.

- **Structure**: 데이터 수신 상태를 보여주는 네이비 신호 보드, 실제 학생·입력·승인 집계, `INPUT → PROCESS → OUTPUT` 준비 단계, 다음 작업 링크.
- **Variants**: no-student, input-detected, review-in-progress. 빈칸·가짜 학생값·합성 수치를 사용하지 않고 실제 집계가 없는 값은 `0`과 명시적 대기 문구로 표시한다.
- **States**: 연결 대기, 학생 확인, 입력 확인, 승인 근거 대기, 리포트 전환 준비.
- **Accessibility**: 장식 신호선은 `aria-hidden`, 실제 상태는 제목·설명·수치·텍스트 레이블로 반복한다. CTA의 다음 목적지를 문구만으로 이해할 수 있어야 한다.
- **Motion**: 자동 장식 애니메이션 없이 정적인 빛·깊이·연결선으로 완성도를 만든다. 상태 변화는 서버에서 실제 데이터가 확인될 때 전체 화면 variant가 바뀌는 것으로 표현한다.
- **Layout**: desktop에서는 넓은 영웅 영역과 신호 보드의 위계를 우선한다. 1440px 미만에서는 제목 폭을 확보하기 위해 단일 열을 사용한다.

### Evidence Metric

- **Structure**: 수치, 레이블, 근거 설명.
- **Variants**: primary, neutral, approved.
- **States**: 비인터랙티브. hover 없음.
- **Accessibility**: 수치만 읽어도 의미가 없으므로 레이블을 같은 영역에 둔다.
- **Motion**: 없음.
- **Layout**: 비대칭 summary grid.

### Flow Stage

- **Structure**: 단계 표식, 단계 설명, 근거 패널.
- **Variants**: INPUT/brand, PROCESS/info, OUTPUT/success, RECORD/warning.
- **States**: 링크와 버튼에만 hover·active·focus를 제공한다.
- **Accessibility**: `ol`과 단계별 heading을 사용한다.
- **Motion**: 화면 진입 장식 대신 상태 변화에만 전환을 사용한다.
- **Layout**: desktop sidebar + content, mobile horizontal label + content.

### Teacher Draft Panel

- **Structure**: 공식 영역 레이블, 근거 요약, 편집 textarea, 바이트 수, 검토 경고, 복사·인쇄/PDF 저장 동작.
- **Variants**: editing, copied, print.
- **States**: default, hover, active, focus, copied feedback, print ready.
- **Accessibility**: textarea에 명시적 label, 상태 메시지에 `aria-live`, 44px 이상의 버튼 높이, 키보드 완전 지원.
- **Motion**: beui.dev `action-swap`의 blur/scale 상태 교체 메커니즘을 CSS로 축소 적용한다. reduced motion에서는 불투명도 전환도 제거한다.
- **Layout**: desktop editor + evidence sidebar, mobile single column.

### Report Action

- **Structure**: 아이콘, 현재 동작 레이블, 보조 설명.
- **Variants**: primary, secondary.
- **States**: default, hover, active, focus, success, disabled.
- **Accessibility**: 실제 `button`, 상태 변화는 텍스트와 `aria-live`로 전달한다.
- **Motion**: active scale은 100ms, 복사 성공 레이블 전환은 200ms. transform/opacity/filter만 사용한다.
- **Layout**: action cluster, 좁은 화면에서는 full width.

## 6. Motion & Interaction

| Token | Duration | Easing | Usage |
| --- | --- | --- | --- |
| Micro | 100ms | ease-out | 버튼 press |
| Standard | 200ms | ease-in-out | hover·복사 상태 교체 |
| Emphasis | 500ms | cubic-bezier(0.16, 1, 0.3, 1) | Evidence 체인 최초 표시 |

- motion은 Evidence 연결이나 복사 성공처럼 의미가 바뀔 때만 사용한다.
- `transform`, `opacity`, `filter`만 애니메이션한다.
- `prefers-reduced-motion: reduce`에서는 모든 비필수 애니메이션과 transform press를 제거한다.
- 인쇄 동작은 새 창을 만들지 않고 브라우저의 실제 인쇄 대화상자를 호출한다.

## 7. Depth & Surface

전략은 `mixed`다.

- 기본 업무 화면: 얇은 경계선 + 토널 시프트.
- 리포트 표지: `--report-ink`에서 `--brand-900`으로 이어지는 다층 radial/linear gradient, 안쪽 rim, 파란 광원.
- 일반 카드: 기존 `--shadow-card`.
- 강조 카드: 기존 `--shadow-card-hover`를 사용하되 실제 인터랙션 또는 최종 결과에만 적용한다.
- backdrop blur 하나만으로 유리를 표현하지 않는다.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- WCAG 2.2 AA를 목표로 한다: 일반 텍스트 4.5:1, 큰 텍스트 3:1.
- 키보드 초점이 모든 버튼·링크·편집기에 보여야 한다.
- 200% 확대와 375px 폭에서 기능 손실이 없어야 한다.
- `prefers-reduced-motion`을 존중한다.
- 한글 줄바꿈에서 조사·한 글자·짧은 술어가 고립되지 않도록 실제 캡처로 확인한다.
- 색상만으로 INPUT/PROCESS/OUTPUT 상태를 구분하지 않는다.

### Inclusive personas

- **담임 교사**: 발표 직전 빠르게 근거를 확인하고 PDF로 저장해야 한다.
- **저시력·확대 사용자**: 200% 확대 상태에서도 초안 편집과 저장 동작을 완료해야 한다.
- **키보드 사용자**: 마우스 없이 Evidence 링크, 초안, 복사, 인쇄까지 이동해야 한다.
- **인지 부담이 큰 사용자**: 현재 단계와 “AI 초안 / 교사 최종 판단”의 책임 경계를 한 번에 이해해야 한다.

### Accepted Debt

| Item | Location | Why accepted | Owner / Exit |
| --- | --- | --- | --- |
| 리포트 화면은 기존 RLS 보호 Entity를 읽지만 리포트·생기부 초안 자체는 영구 저장하지 않음 | `/reports` | TRD에서 Report를 DB Entity 또는 Generated Output으로 둘지 미결정 | 공유 Report 계약 승인 후 서버 저장 구현 |
| 모바일 전용 리포트 정보 구조와 인터랙션 최적화는 미실시 | `/reports` | 현재 발표 구현 기준이 1280px 이상 데스크톱으로 확정됨 | 모바일 지원 범위가 승인되면 별도 반응형 QA 수행 |
| `인쇄·PDF 저장`은 브라우저 인쇄 대화상자 사용 | `/reports` | 별도 PDF 생성 의존성과 서버 개인정보 처리를 추가하지 않음 | 실제 배포 환경의 PDF 요구가 확정되면 서버 렌더링 검토 |
| react-grab/react-scan은 설치하지 않음 | 개발 도구 | 프로젝트 규칙상 명시 요청 없는 새 의존성 추가 금지 | 별도 개발 도구 도입 승인 시 설치 |
