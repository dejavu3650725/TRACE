# TRACE Agent Guide

## Read first

Use these documents in this order:

1. `TRACE_PRD_v3.md` — product purpose, Teacher Approval Gate, privacy rules
2. `TRACE_TRD_v3.md` — shared entities, physical schema, statuses, routes, security, component contracts
3. `TRACE_INPUT_MODULE_PRD_v2.md` — INPUT scope, flows, acceptance criteria
4. `TRACE_INPUT_ISSUE_PROMPT_PLAN_FINAL_WITH_CODEX_MODELS.md` — scoped issue plan and prerequisites
5. `CODEBASE_ANALYSIS.md` — repository map, existing-code classification, and known integration risks

The issue plan's unversioned document names are references to the versioned files above. Do not create duplicate copies simply to match those names.

## Authority and contract changes

- Product behavior follows the PRD; shared technical contracts follow the TRD.
- Do not invent or change a shared Entity, DB field/table, enum, route, RLS rule, Storage rule, or module handoff contract.
- If the requested work requires such a change, stop before coding and report: the exact conflict, affected contract, smallest proposed change, and downstream impact.
- Existing code, fixtures, prototypes, and old prompts are reference material only when they conflict with the documents above.

## Existing code and hackathon rule

- Read `CODEBASE_ANALYSIS.md` before extending repository code.
- Do not copy, restore, move, or silently reuse a pre-hackathon feature implementation.
- Existing configuration or organizer-approved scaffold may be retained only when its provenance and compatibility are confirmed.
- The existing Google OAuth/Profile implementation and `teachers.nickname` migration are approved main shared foundation. Validate them against current contracts before extending them; do not recreate them in parallel.
- Other existing shared Shell, routes, helpers, types, and migrations still require the provenance/compatibility checks recorded in `CODEBASE_ANALYSIS.md`.
- Do not create a second Next.js application, parallel Shell, or duplicate shared component system.

## INPUT scope

- INPUT owns Class/Roster setup, Activity and ActivityAssignment, collection, original Artifact preservation, Student/Activity matching, observable-response StructuredInput, `input_status`, and PROCESS handoff.
- INPUT must not judge correctness, achievement level, strengths, difficulties, Evidence, feedback, or growth. Those are PROCESS/OUTPUT responsibilities.
- Shared Student entity is `Student`; do not add StudentAlias, School, EvaluationContext, Extraction, or AI Rubric entities/features.
- One `Student × ActivityAssignment` maps to one `Submission`.
- Store observable responses only in `submissions.structured_input` with the shared envelope:

```text
schema_version
questions[].question_id
questions[].response_type
questions[].response
```

- Keep `input_status` and `process_status` independent.
- Set `READY_FOR_PROCESS` only when Student and ActivityAssignment are confirmed, an ORIGINAL Artifact is stored and recorded, and valid StructuredInput is persisted.
- INPUT → PROCESS passes explicit `submission_id[]` only. Do not copy full Student, Activity, Artifact, or StructuredInput payloads between modules.

## Security and privacy

- Teacher access requires Supabase Google OAuth session validation, RLS, and server-side ownership checks.
- Never trust a client-supplied `teacher_id` or Student identity.
- Student Browser access uses public server APIs only; it must not query the roster directly.
- Verify public submission with `submission_token + class_code + student_number + student_name`; return one uniform failure message.
- QR/token/Storage keys must not contain Student PII. Use private Storage, UUID-based object keys, and short-lived signed URLs only after ownership checks.
- Keep API keys, service-role credentials, tokens, signed URLs, prompts, and PII out of the client and audit logs.
- AI/VLM calls are server-side and use a privacy context that excludes Student name/number, Teacher email, full roster, and unrelated data.
- Use synthetic Student data and artifacts only for development, test, and demo.
- Required audit events must be persistent and minimal: `LOGIN`, `ROSTER_IMPORT`, `ARTIFACT_UPLOAD`, and `DATA_DELETE` when deletion exists in scope.

## Implementation rules

- Work inside the existing TRACE Next.js application using TypeScript and Supabase.
- Preserve ORIGINAL Artifacts; never overwrite them with processed data.
- Reuse a single `AutoCaptureView` for Student Submit and Teacher Scan when its shared implementation is introduced. Manual shutter, auto-capture off, and file selection remain available.
- Use the common file limits and Class Code/Rate Limit configuration; validate limits on both client and server.
- Do not fake DB, Storage, AI, or job success. Isolate partial failures and keep retries bounded.
- Keep long-running work in `processing_jobs`; job status never replaces INPUT/PROCESS statuses.
- Do not refactor unrelated files.
- Do not push to a remote unless the user explicitly instructs it.

## Per-issue workflow

1. Confirm the issue's prerequisites and read only the relevant authoritative sections.
2. Inspect current integration points and list intended files before changing code.
3. Check whether a shared-contract change is required; stop and report if so.
4. Implement only the scoped issue.
5. Run the repository scripts that exist plus issue-appropriate automated, DB, Storage, AI, security, local, device, or visual checks.
6. Do not claim checks that require credentials, hardware, or a deployed service without actually running them.

## Completion report

At the end of every issue, report:

1. Files created or changed
2. DB migrations created or applied
3. Commands and tests run, with pass/fail result
4. Local/manual checks still required
5. Acceptance criteria passed, failed, or blocked
6. Remaining risks, TODOs, or contract decisions
7. Whether a commit or push occurred (push requires explicit user instruction)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
