/**
 * TRACE 공통 Entity 타입 (TRD §7, §16 Database Schema v1.0 기준)
 * 물리 스키마: supabase/migrations/0001_init.sql
 * ⚠️ 필드 추가/변경은 팀 합의 → Shared Contract 갱신 후.
 */
import type {
  ActivityAssignmentStatus,
  ActivityStatus,
  AnalysisStatus,
  ArtifactRole,
  GrowthEventStatus,
  InputStatus,
  ProcessStatus,
  ProcessingJobStatus,
  ReviewDecision,
} from "./status";

export interface Teacher {
  id: string;
  auth_user_id: string;
  name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  teacher_id: string;
  name: string;
  grade: number | null;
  subject: string | null;
  class_code: string | null;
  class_code_expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  class_id: string;
  student_number: number;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  teacher_id: string;
  title: string;
  grade: number | null;
  subject: string | null;
  domain: string | null;
  unit: string | null;
  activity_type: string | null;
  description: string | null;
  content_json: Record<string, unknown> | null;
  activity_code: string | null;
  status: ActivityStatus;
  parent_activity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityStandard {
  id: string;
  activity_id: string;
  standard_id: string;
  created_at: string;
}

export interface ActivityAssignment {
  id: string;
  activity_id: string;
  class_id: string;
  submission_token: string | null;
  open_at: string | null;
  due_at: string | null;
  status: ActivityAssignmentStatus;
  created_at: string;
  updated_at: string;
}

/** StructuredInput 공통 Envelope (TRD §14.1) */
export interface StructuredInput {
  schema_version: string;
  questions: Array<{
    question_id: string;
    response_type: string;
    response: Record<string, unknown>;
  }>;
}

export interface Submission {
  id: string;
  student_id: string;
  activity_assignment_id: string;
  structured_input: StructuredInput | null;
  input_status: InputStatus;
  process_status: ProcessStatus;
  submission_code: string | null;
  current_attempt_no: number;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Artifact {
  id: string;
  submission_id: string | null;
  source_artifact_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number | null;
  checksum: string | null;
  artifact_role: ArtifactRole;
  attempt_no: number;
  page_start: number | null;
  page_end: number | null;
  created_at: string;
}

export interface Analysis {
  id: string;
  submission_id: string;
  version_no: number;
  analysis_json: Record<string, unknown>;
  status: AnalysisStatus;
  provider: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
}

export interface Evidence {
  id: string;
  analysis_id: string;
  standard_id: string | null;
  artifact_id: string | null;
  question_id: string | null;
  source_page: number | null;
  claim: string;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  analysis_id: string;
  reviewer_id: string;
  decision: ReviewDecision;
  teacher_edits: Record<string, unknown> | null;
  reviewed_at: string;
}

export interface GrowthEvent {
  id: string;
  student_id: string;
  standard_id: string | null;
  description: string;
  status: GrowthEventStatus;
  created_at: string;
  updated_at: string;
}

export interface GrowthEventEvidence {
  id: string;
  growth_event_id: string;
  evidence_id: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_teacher_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  request_id: string | null;
  created_at: string;
  metadata_json: Record<string, unknown> | null;
}

export interface ProcessingJob {
  id: string;
  teacher_id: string;
  job_type: string;
  status: ProcessingJobStatus;
  total_count: number;
  completed_count: number;
  failed_count: number;
  current_step: string | null;
  error_message: string | null;
  payload_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** 공통 API Response Envelope (TRD §29) */
export interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  meta: { request_id: string };
  error: { code: string; message: string } | null;
}
