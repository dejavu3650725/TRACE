import type { ActivityResultInputStatus } from "./activity-results";

export type ProcessingScopeMode = "activity" | "student" | "students" | "filtered";

export type ProcessingScopeRow = {
  assignmentId: string;
  activityLabel: string;
  studentId: string;
  studentLabel: string;
  submissionId: string | null;
  inputStatus: ActivityResultInputStatus | null;
  matchesCurrentFilter: boolean;
};

export type ProcessingScopeSelection = {
  mode: ProcessingScopeMode;
  assignmentId?: string;
  studentId?: string;
  studentIds?: readonly string[];
};

export type ResolvedProcessingScope = {
  total: number;
  ready: number;
  notEligible: number;
  submissionIds: string[];
};

export function isProcessingScopeEligible(row: ProcessingScopeRow): boolean {
  return Boolean(row.submissionId) && row.inputStatus === "READY_FOR_PROCESS";
}

function rowsForSelection(
  rows: readonly ProcessingScopeRow[],
  selection: ProcessingScopeSelection,
): ProcessingScopeRow[] {
  if (selection.mode === "activity") {
    return rows.filter((row) => row.assignmentId === selection.assignmentId);
  }
  if (selection.mode === "student") {
    return rows.filter((row) => row.studentId === selection.studentId);
  }
  if (selection.mode === "students") {
    const studentIds = new Set(selection.studentIds ?? []);
    return rows.filter((row) => studentIds.has(row.studentId));
  }
  return rows.filter((row) => row.matchesCurrentFilter);
}

/**
 * Resolves UI scope to a deterministic, minimal handoff list.
 * REVIEW_PENDING and missing submissions remain in counts but never enter IDs.
 */
export function resolveProcessingScope(
  rows: readonly ProcessingScopeRow[],
  selection: ProcessingScopeSelection,
): ResolvedProcessingScope {
  const uniqueRows = new Map<string, ProcessingScopeRow>();
  for (const row of rowsForSelection(rows, selection)) {
    const logicalKey = `${row.assignmentId}:${row.studentId}`;
    if (!uniqueRows.has(logicalKey)) uniqueRows.set(logicalKey, row);
  }

  const submissionIds: string[] = [];
  const seenSubmissionIds = new Set<string>();
  for (const row of uniqueRows.values()) {
    if (!isProcessingScopeEligible(row) || seenSubmissionIds.has(row.submissionId!)) continue;
    seenSubmissionIds.add(row.submissionId!);
    submissionIds.push(row.submissionId!);
  }

  const total = uniqueRows.size;
  return {
    total,
    ready: submissionIds.length,
    notEligible: total - submissionIds.length,
    submissionIds,
  };
}
