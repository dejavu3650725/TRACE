# TRACE Codebase Analysis

> Issue: `ISSUE-00 Repository Analysis`
> Analysis date: 2026-08-28 (Asia/Seoul)
> Scope: repository inspection and documentation only
> Application source changes: none

## 1. Purpose and authority

This document records the current repository structure so later TRACE INPUT issues can be implemented without silently copying or depending on an unverified pre-hackathon feature implementation.

The authoritative files currently present in this repository are:

1. `TRACE_PRD_v3.md` — product behavior and global approval/privacy rules
2. `TRACE_TRD_v3.md` — shared technical contracts, schema, routes, status ownership, and security boundaries
3. `TRACE_INPUT_MODULE_PRD_v2.md` — INPUT behavior, UX, errors, and acceptance criteria
4. `TRACE_INPUT_ISSUE_PROMPT_PLAN_FINAL_WITH_CODEX_MODELS.md` — issue execution plan

The issue plan currently refers to unversioned names (`TRACE_PRD.md`, `TRACE_TRD.md`, `TRACE_INPUT_MODULE_PRD.md`) that do not exist. Later prompts must use the versioned names above unless the files are intentionally renamed through a separately approved documentation change.

`AGENTS.md` did not exist when this analysis was performed. It is expected to be created in ISSUE-01.

## 2. Repository baseline

### 2.1 Git state at analysis start

- Branch: `main`
- HEAD: `6e2311c feat: public /terms and /privacy pages for OAuth consent screen`
- The issue plan and INPUT PRD were untracked before this issue:
  - `TRACE_INPUT_ISSUE_PROMPT_PLAN_FINAL_WITH_CODEX_MODELS.md`
  - `TRACE_INPUT_MODULE_PRD_v2.md`
- Those user-owned untracked files were not modified by ISSUE-00.
- No push was performed.

### 2.2 Framework and dependencies

| Area | Current repository |
|---|---|
| Framework | Next.js `16.3.3`, App Router |
| Language | TypeScript `5`, strict mode, `@/*` alias to `src/*` |
| UI | React `19.2.8`, Tailwind CSS `4`, `lucide-react` |
| Backend SDK | `@supabase/ssr`, `@supabase/supabase-js` |
| Validation | Zod `4.4.3` installed, not yet used for INPUT contracts |
| Package manager | npm (`package-lock.json`) |
| Deployment target | Vercel, documented in README |
| AI | Interface stub plus Gemini API-key accessor; no real provider implementation |
| Tests | No unit/integration/E2E framework or test files |

Expected INPUT dependencies that are not installed yet include SheetJS (`xlsx`), Sharp, a QR library, and a PDF library. Add each only in the issue that actually needs it and after checking Vercel/runtime compatibility.

### 2.3 Available scripts

```text
npm run dev
npm run build
npm run start
npm run lint
```

There is no `typecheck` or application `test` script. Dependencies were installed after ISSUE-00, and `npx tsc --noEmit` passes. `npm run lint` currently reaches ESLint but fails on the pre-existing synchronous-effect state updates in `SidebarAccount.tsx`, `AddMaterialModal.tsx`, and `LegalModal.tsx` (plus one navigation warning in `SidebarAccount.tsx`).

## 3. Current repository map

```text
src/
├─ app/
│  ├─ (teacher)/
│  │  ├─ layout.tsx                 protected Teacher shell boundary
│  │  ├─ dashboard/
│  │  ├─ onboarding/class|roster/   placeholder routes
│  │  ├─ classes/                   placeholder routes
│  │  ├─ activities/                placeholder routes
│  │  ├─ results/                   placeholder routes
│  │  ├─ analysis/                  PROCESS placeholders
│  │  └─ reports/                   OUTPUT placeholders
│  ├─ auth/callback/route.ts        OAuth code exchange
│  ├─ login/                        Google login UI
│  ├─ onboarding/profile/           implemented profile form/action
│  ├─ submit/[token]/               student placeholder, no verification/upload
│  ├─ privacy/ and terms/            public legal pages
│  └─ globals.css                   design tokens and Tailwind theme
├─ components/
│  ├─ auth/                         Google login/sidebar account behavior
│  ├─ shell/                        shared shell, navigation, modal, footer/legal UI
│  └─ ui/                           reusable presentational primitives
├─ lib/
│  ├─ ai/provider.ts                incomplete server-only adapter contract
│  ├─ auth/teacher.ts               session/profile lookup only
│  ├─ config.ts                     file/class-code/rate-limit/storage constants
│  └─ supabase/client|server.ts     browser/server clients
└─ shared/
   ├─ displayName.ts
   └─ types/db|status.ts            hand-maintained shared interfaces/enums

supabase/
├─ config.toml                      local Supabase CLI configuration
├─ migrations/
│  ├─ 0001_init.sql                 full schema, RLS, private bucket
│  ├─ 0002_teacher_nickname.sql     idempotent nickname addition
│  ├─ 0003_input_contract_hardening.sql
│                                      INPUT constraints and lookup indexes
│  └─ 0004_auth_rls_ownership.sql   Auth/RLS/LOGIN audit hardening
└─ tests/
   ├─ issue_02_input_contract.test.sql
   └─ issue_03_auth_rls.test.sql    cross-Teacher security pgTAP tests
```

## 4. Routing and UI conventions

### 4.1 Routing

The repository uses Next.js App Router and route groups. The principal TRD routes already resolve as placeholder pages:

```text
/login
/auth/callback
/dashboard
/onboarding/class
/onboarding/roster
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
/analysis
/analysis/jobs/[jobId]
/analysis/[analysisId]/review
/reports
/reports/classes/[classId]
/reports/students/[studentId]
/submit/[token]
```

`/onboarding/profile` is additionally implemented. On 2026-08-28 the user confirmed it was created as part of the main Google-login foundation and approved it, together with optional `teachers.nickname`, as a shared contract. The PRD/TRD/INPUT PRD were synchronized in ISSUE-02.

### 4.2 Shared UI patterns

Existing shared components establish these conventions:

- `TeacherAppShell` wraps protected teacher pages.
- `Sidebar` uses the fixed Korean menu labels and TRD routes.
- `TopBar` owns the global `학습자료 추가` action.
- `AddMaterialModal` already links teacher upload, scan mode, and student-submit preparation entry points.
- `/submit/[token]` deliberately excludes the teacher shell.
- Status labels are mapped from technical enums in `shared/types/status.ts`.
- UI primitives use Tailwind utility classes and CSS design tokens rather than a component framework.
- Feature routes are mostly `EmptyState` placeholders; they do not implement INPUT persistence or business logic.

The visual shell and UI primitives are shared infrastructure candidates, but their reuse is conditional on the hackathon/organizer provenance decision in Section 5.

## 5. Existing-code classification

Git history shows the current app was added in repository commits on 2026-08-28. The repository itself does not prove which files were organizer-provided versus authored before the allowed implementation window. Therefore provenance must not be guessed.

### 5.1 Clearly configuration/infrastructure

These files describe tooling rather than TRACE feature behavior and are candidates to retain if the hackathon rules allow the current repository scaffold:

```text
.gitignore
.env.example
package.json
package-lock.json
tsconfig.json
next.config.ts
postcss.config.mjs
eslint.config.mjs
public/* default assets
```

### 5.2 Conditional shared infrastructure — confirm before reuse

These files look like a shared foundation or placeholder skeleton, but their organizer/provenance status is not established by the repository:

```text
src/app/globals.css
src/app/layout.tsx
src/app/(teacher)/layout.tsx
src/components/shell/*
src/components/ui/*
src/lib/supabase/*
src/lib/config.ts
src/shared/types/*
supabase/migrations/*
all placeholder route files
```

If confirmed as permitted starter/shared infrastructure, later issues should integrate with them rather than create a second shell, second status system, or parallel app. If they are classified as prohibited pre-hackathon implementation, do not copy their implementation into replacement files; rebuild the required behavior from the authoritative documents during the permitted session.

### 5.3 Existing functional implementation — do not silently reuse

The following are more than placeholders and implement behavior already:

```text
src/components/auth/GoogleLoginButton.tsx
src/components/auth/SidebarAccount.tsx
src/app/auth/callback/route.ts
src/app/onboarding/profile/*
src/lib/auth/teacher.ts
src/shared/displayName.ts
src/components/shell/Footer.tsx
src/components/shell/LegalModal.tsx
src/components/shell/LegalContent.tsx
src/app/terms/page.tsx
src/app/privacy/page.tsx
```

The Google OAuth/Profile implementation and `teachers.nickname` migration were confirmed by the user as approved main shared foundation on 2026-08-28. They may be retained and verified, but must not be copied into a parallel implementation. Legal/footer provenance is still not established by that approval and must be checked before feature-level reuse.

### 5.4 INPUT-like placeholders, not completed functionality

The `/classes`, `/activities`, `/results`, `/results/upload`, `/results/import`, and `/submit/[token]` pages contain explanatory UI and TODOs but no working Class/Roster/Activity/Submission/Artifact flows. They must not be reported as completed INPUT features.

## 6. Database and migration analysis

### 6.1 What already matches the TRD

`0001_init.sql` contains the major shared enums and tables, including:

```text
teachers, classes, students
activities, activity_standards, activity_assignments
submissions, artifacts
analyses, evidence, reviews
growth_events, growth_event_evidence
audit_logs, processing_jobs
```

It also contains the important uniqueness rules, separate INPUT/PROCESS statuses, private `trace` Storage bucket, and teacher-folder Storage policy.

### 6.2 Migration strategy

- The repository uses ordered SQL files in `supabase/migrations`.
- README currently instructs users to paste `0001_init.sql` manually into Supabase SQL Editor.
- ISSUE-02 added Supabase CLI configuration and a pgTAP DB contract test. `npx supabase db reset` applies `0001` through `0003` from a clean local database.
- `0001_init.sql` was later edited to include `teachers.nickname`; `0002_teacher_nickname.sql` also adds it with `if not exists`. A clean sequential run is idempotent for that column, but editing an already-published baseline weakens migration reproducibility.
- No down migrations are present.
- TypeScript DB interfaces are hand-maintained, not generated from Supabase.

### 6.3 Contract/security issues to resolve before relying on the schema

Do not patch these in ISSUE-00. They are findings for the relevant implementation issue.

1. `teachers.nickname` and `/onboarding/profile` were approved as a shared contract on 2026-08-28 and synchronized into the PRD/TRD/INPUT PRD during ISSUE-02.
2. `ARTIFACT_SOURCE_TYPE` exists in TypeScript, while `artifacts` has no `source_type` DB column. The AutoCapture contract asks to record the capture source, so the documents/schema must be reconciled before implementation.
3. ISSUE-03 resolved the ActivityAssignment Activity/Class cross-Teacher RLS gap in forward migration `0004`.
4. ISSUE-03 resolved the Submission Student/Assignment Class consistency RLS gap and propagated that path to Artifact access.
5. `reviews` RLS primarily checks `reviewer_id`; it does not independently require that the referenced Analysis is in the teacher's accessible scope.
6. Artifact RLS follows `submission_id`. An unassigned/batch Artifact with nullable `submission_id` cannot use that policy, yet unclassified teacher uploads need a safe pre-matching intake path.
7. ISSUE-03 fixed `current_teacher_id()` to an empty search path, explicit schema names, and explicit role grants; clean-DB cross-Teacher tests now cover it.

## 7. Authentication and authorization analysis

Current behavior:

- Browser and server Supabase helpers exist.
- Google OAuth is initiated from the client.
- Callback exchanges the code and branches on Teacher Profile existence.
- Teacher Profile creation avoids duplicate `auth_user_id` rows.
- Protected teacher layout always checks the server session/profile; the public auth bypass was removed in ISSUE-03.
- `proxy.ts` refreshes Supabase auth cookies before Server Components validate the user.
- Existing and first-time Teacher login paths persist fixed-shape `LOGIN` audit rows.
- Reusable server ownership helpers cover Class, Student, Activity, Assignment, Submission, Artifact, Analysis, and report Teacher scope.

Missing or risky behavior relative to ISSUE-03:

- The remote Supabase project must receive migration `0004` before its Google OAuth flow can call the new audit/profile RPCs; local DB validation does not deploy remote schema.
- Student public verification/upload APIs do not exist.
- No short-lived server-side Student Submit Grant/session is defined between successful roster verification and later uploads.
- Rate-limit constants exist, but no durable rate-limit storage/implementation exists.

## 8. AI, curriculum, capture, and file-processing analysis

- ISSUE-24 adds a shared server-only Privacy Context Builder and provider-independent VLM adapter. Activity generation and PROCESS submission analysis both pass a privacy-sealed request through that boundary; Provider success/error metadata is normalized and raw error bodies are not propagated.
- Gemini remains the configured hackathon Provider behind `AI_PROVIDER`/`GEMINI_MODEL`; this is environment configuration rather than a shared-contract change. The browser bundle is checked against the configured secret after production builds.
- No `shared/curriculum/manifest.json` or curriculum JSON files are present.
- No StructuredInput runtime schema exists; there is only a broad TypeScript interface.
- No upload API, signed-URL helper, checksum/idempotency handling, image preprocessing, spreadsheet parser, QR generation, PDF handling, or processing-job polling exists.
- No `AutoCaptureView`, camera state machine, device picker, lifecycle cleanup, quality-signal analysis, file fallback component, or Teacher Scan implementation exists.

## 9. Test and validation baseline

Current repository:

- has ESLint configuration;
- has no test runner configuration;
- has one ISSUE-02 database-contract pgTAP test, but no unit, integration, security-boundary, browser, or E2E tests yet;
- has no `typecheck` script;
- has a local Supabase CLI test harness and clean reset command;
- has no shared application-fixture reset mechanism beyond the transactional ISSUE-02 DB fixture.

Before feature issues claim completion, the team needs a minimal repeatable test strategy. At minimum:

```text
static: npm run lint + TypeScript noEmit + npm run build
unit: validation, code expiry, matching, status eligibility
DB/security: clean migration, constraints, RLS/cross-teacher tests
integration: Storage/DB/AI paths with synthetic data
browser/device: student submit and AutoCapture fallbacks
E2E: the three required INPUT paths and submission_id[] handoff
```

Tests requiring credentials or a device must be reported separately from automated tests rather than silently marked as passed.

## 10. Missing foundations and integration risks

### Highest priority

1. Decide the provenance/reuse status of the existing shared foundation and functional auth/legal implementation.
2. Keep the ISSUE-01 `AGENTS.md` contract guide synchronized as later issues approve shared-contract changes.
3. Reconcile the remaining shared-contract deviations before changing schema/routes: Artifact `source_type` and unassigned Artifact access. The `nickname` and `/onboarding/profile` decision is resolved.
4. Validate/fix clean migrations, RLS, and server ownership before feature CRUD.
5. Remove or tightly constrain auth bypass before treating routes as protected.

### Dependency-order corrections accepted for the issue plan

Implement shared prerequisites before their consumers:

```text
StructuredInput runtime schema
→ spreadsheet commit and observable extraction

AI/VLM adapter + privacy context builder
→ AI Activity Draft, extraction, classification, identity extraction

processing_jobs foundation
→ first long-running AI/batch flow

shared AutoCaptureView
→ Student Capture and Teacher Continuous Scan
```

### Public/student submission risks

- Decide how successful public verification authorizes subsequent uploads without exposing Student IDs or accepting client-asserted identity.
- Decide a durable rate-limit store compatible with Vercel/Supabase without inventing an unapproved shared table.
- Revalidate Assignment status, Class Code expiry, Student/Assignment binding, and upload authorization on every server mutation.

### Artifact intake risks

- Known-Submission upload and unassigned/batch intake are different authorization/relationship states.
- The current schema permits nullable `artifacts.submission_id`, but current RLS does not provide a teacher-owned path for those records.
- Batch PDF original storage, per-Submission page references, and teacher image batches need one explicit ownership model before ISSUE-15/26/28.

## 11. Recommended implementation order

Subject to the shared-contract/provenance decisions above:

```text
00 Repository analysis
01 AGENTS/repository contract
02 DB migration baseline and RLS contract
03 Auth + server ownership
04 Curriculum loader
05 Shared shell/routes (reuse only if permitted)
23 StructuredInput runtime schema
24 AI/VLM adapter + privacy boundary
35 processing_jobs foundation
06-08 Class/Roster
09-10 Activity/Assignment
14-16 Submission/Storage/Preprocessing
17-18 Public token/verification and secure submit grant
Shared AutoCaptureView
19-20 Student capture/quality
Teacher Continuous Scan integration
21-22 Spreadsheet
25 Observable extraction
26-30 Classification and batch PDF
25A Demo dataset
31-34 Results/review/handoff
36-37 Audit/stability
38 INPUT E2E, with cross-module demo checks reported separately
```

AI Activity generation/partial revision/printable PDF (ISSUE-11–13) can follow the core manual Activity and INPUT demo path if hackathon time prioritizes end-to-end collection.

## 12. ISSUE-00 completion record

- Repository framework, routing, Supabase helpers, migrations, shared UI, tests, environment conventions, and INPUT-like files were inspected.
- Existing code was classified without copying, moving, or modifying it.
- Gaps and integration risks were compared with the current PRD/TRD/INPUT PRD.
- Only this analysis document was created by ISSUE-00.
- No application feature was implemented.
- No DB migration was created or applied.
- No commit or push was performed.
