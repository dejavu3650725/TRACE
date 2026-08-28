-- TRACE INPUT baseline integrity hardening (ISSUE-02)
-- Forward-only migration following the repository's existing migration convention.
-- Adds no new shared Entity, status, or data field.

-- A Class Code is either fully inactive or has an explicit expiry timestamp.
alter table classes
  add constraint classes_code_expiry_pair
  check (
    (class_code is null and class_code_expires_at is null)
    or
    (class_code is not null and class_code_expires_at is not null)
  );

-- Attempt numbers and PDF page references are one-based.
alter table submissions
  add constraint submissions_current_attempt_positive
  check (current_attempt_no >= 1);

alter table artifacts
  add constraint artifacts_attempt_positive
  check (attempt_no >= 1),
  add constraint artifacts_page_range_valid
  check (
    (page_start is null and page_end is null)
    or
    (
      page_start is not null
      and page_start >= 1
      and (page_end is null or page_end >= page_start)
    )
  );

-- Persistent job counters cannot become negative or exceed the declared total.
alter table processing_jobs
  add constraint processing_jobs_counts_valid
  check (
    total_count >= 0
    and completed_count >= 0
    and failed_count >= 0
    and completed_count + failed_count <= total_count
  );

-- Relationship/status lookup indexes used by INPUT screens and handoff checks.
create index idx_activities_parent
  on activities (parent_activity_id)
  where parent_activity_id is not null;

create index idx_activities_teacher_status
  on activities (teacher_id, status, updated_at desc);

create index idx_assignments_class_status
  on activity_assignments (class_id, status, updated_at desc);

create index idx_submissions_assignment_input_status
  on submissions (activity_assignment_id, input_status, updated_at desc);

create index idx_artifacts_source
  on artifacts (source_artifact_id)
  where source_artifact_id is not null;

create index idx_audit_logs_entity
  on audit_logs (entity_type, entity_id, created_at desc)
  where entity_id is not null;

create index idx_processing_jobs_teacher_status
  on processing_jobs (teacher_id, status, updated_at desc);
