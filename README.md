# TRACE

학생의 종이·디지털 학습결과를 입력받아 교육과정 기준으로 구조화하고, 성취기준별 AchievementLevel을 기준으로 분석·누적하여 피드백·후속학습·성장 리포트로 연결하는 **교사용 학습 성장 지원 시스템**.

> 기준 문서: `TRACE_PRD_v3.md` · `TRACE_TRD_v3.md` (팀 공유 문서)
> AI는 판정자가 아니라 근거를 찾아 정리하는 보조자다. 교육적 판단은 반드시 Teacher Approval Gate를 거친다.

## 기술 스택

Next.js (App Router) · TypeScript · Tailwind CSS · lucide-react · Supabase (Auth/PostgreSQL/Storage) · Gemini (VLM, 서버 전용) · Vercel

## 시작하기

```bash
npm install
cp .env.example .env   # 값은 팀 채널에서 안전하게 공유 (절대 커밋 금지)
npm run dev            # http://localhost:3000
```

보호된 교사 화면은 개발·배포 환경 모두 유효한 Supabase Session을 요구한다.

## 로컬 DB 만들기

Docker/OrbStack을 실행한 뒤 `npx supabase start`와 `npx supabase db reset`을 사용한다.
순서가 보장된 migration으로 테이블, RLS 정책, Private Storage Bucket(`trace`)이 생성된다.

## 브랜치 규칙 (3인 팀)

| 브랜치 | 담당 | 라우트 |
|---|---|---|
| `main` | 배포 (직접 푸시 금지, PR로만) | — |
| `feat/input` | INPUT 모듈 | `/results/*` `/activities/*` `/submit/*` `/classes/*` |
| `feat/process` | PROCESS 모듈 | `/analysis/*` |
| `feat/output` | OUTPUT 모듈 | `/reports/*` `/dashboard` |

작업 → 푸시 → GitHub PR → 리뷰 후 main 머지. 브랜치 푸시마다 Vercel Preview URL이 생성된다.

## 공통 구조 (임의 변경 금지 — 팀 합의 후 변경)

```
src/
├─ app/
│  ├─ (teacher)/        보호된 교사 화면 (공통 App Shell 적용)
│  ├─ login/  auth/     Google OAuth
│  └─ submit/[token]/   학생 제출 (Shell 미적용, 모바일 우선)
├─ components/
│  ├─ shell/            TeacherAppShell · Sidebar · TopBar · AddMaterialModal ...
│  └─ ui/               StatusBadge · TrustBadge · EmptyState · StatCard · DataTable ...
├─ lib/
│  ├─ supabase/         client.ts(브라우저) · server.ts(서버)
│  ├─ ai/               AI Adapter (서버 전용, GEMINI_API_KEY)
│  └─ config.ts         파일 제한 등 공통 Config 상수
└─ shared/types/        공통 Entity 타입 · Status Enum · UI 라벨 매핑
```

핵심 규칙 (TRD 요약):

- 모듈 간 데이터 전달은 `submission_id[]` — 전체 객체 복제 금지
- 기술 Enum을 화면에 그대로 노출하지 않는다 (`shared/types/status.ts` 매핑 사용)
- AI 호출은 서버에서만. 브라우저에 API Key·Service Role 노출 금지
- 원본 Artifact는 보존, Storage는 Private + Signed URL
- MUI/AntD 등 무거운 UI 프레임워크 금지. 차트는 div+flex+%로 구현
- 하드코딩 데모 숫자로 기능 완료를 대체하지 않는다
