import {
  StructuredInputRuntimeSchema,
  type StructuredInputRuntime,
} from "../submissions/structured-input-schema.ts";

export type ProcessHandoffErrorCode = "FORBIDDEN" | "NOT_READY" | "READ_FAILED";

export class ProcessHandoffContractError extends Error {
  readonly code: ProcessHandoffErrorCode;

  constructor(
    code: ProcessHandoffErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProcessHandoffContractError";
    this.code = code;
  }
}

export type ProcessHandoffSubmissionRecord = {
  id: string;
  studentId: string;
  studentClassId: string;
  classId: string;
  classTeacherId: string;
  assignmentId: string;
  activityId: string;
  activityTeacherId: string;
  activityTitle: string;
  activityDescription: string | null;
  standardIds: string[];
  structuredInput: unknown;
  inputStatus: string;
  processStatus: string;
};

export type ProcessHandoffArtifactRecord = {
  id: string;
  submissionId: string;
  sourceArtifactId: string | null;
  storagePath: string;
  mimeType: string;
  artifactRole: string;
  pageStart: number | null;
  pageEnd: number | null;
};

export type ProcessHandoffSourceRecord = {
  id: string;
  ownerTeacherId: string | null;
  storagePath: string;
  mimeType: string;
  artifactRole: string;
};

export type ProcessArtifactReference = {
  artifactId: string;
  originalArtifactId: string;
  storagePath: string;
  mimeType: string;
  pageStart: number | null;
  pageEnd: number | null;
};

export type ProcessHandoffContext = {
  submissionId: string;
  studentId: string;
  classId: string;
  assignmentId: string;
  activity: {
    id: string;
    title: string;
    description: string | null;
    standardIds: string[];
  };
  structuredInput: StructuredInputRuntime;
  inputStatus: "READY_FOR_PROCESS";
  processStatus: string;
  artifacts: ProcessArtifactReference[];
};

function storedPath(value: string): boolean {
  return value.trim().length > 0;
}

export function buildProcessHandoffContexts(input: {
  requestedSubmissionIds: readonly string[];
  teacherId: string;
  submissions: readonly ProcessHandoffSubmissionRecord[];
  artifacts: readonly ProcessHandoffArtifactRecord[];
  sources: readonly ProcessHandoffSourceRecord[];
}): ProcessHandoffContext[] {
  const submissions = new Map(input.submissions.map((submission) => [submission.id, submission]));
  const sources = new Map(input.sources.map((source) => [source.id, source]));
  const artifactsBySubmission = new Map<string, ProcessHandoffArtifactRecord[]>();
  for (const artifact of input.artifacts) {
    const current = artifactsBySubmission.get(artifact.submissionId) ?? [];
    current.push(artifact);
    artifactsBySubmission.set(artifact.submissionId, current);
  }

  for (const submissionId of input.requestedSubmissionIds) {
    const submission = submissions.get(submissionId);
    if (
      !submission
      || submission.classTeacherId !== input.teacherId
      || submission.activityTeacherId !== input.teacherId
      || submission.studentClassId !== submission.classId
    ) {
      throw new ProcessHandoffContractError("FORBIDDEN", "Submission is outside current Teacher scope");
    }
  }

  return input.requestedSubmissionIds.map((submissionId) => {
    const submission = submissions.get(submissionId)!;
    if (submission.inputStatus !== "READY_FOR_PROCESS") {
      throw new ProcessHandoffContractError("NOT_READY", "Submission is not READY_FOR_PROCESS");
    }
    const structuredInput = StructuredInputRuntimeSchema.safeParse(submission.structuredInput);
    if (!structuredInput.success) {
      throw new ProcessHandoffContractError("NOT_READY", "Valid StructuredInput is required");
    }

    const artifactReferences = (artifactsBySubmission.get(submissionId) ?? []).flatMap((artifact) => {
      if (artifact.artifactRole === "ORIGINAL" && storedPath(artifact.storagePath)) {
        return [{
          artifactId: artifact.id,
          originalArtifactId: artifact.id,
          storagePath: artifact.storagePath,
          mimeType: artifact.mimeType,
          pageStart: artifact.pageStart,
          pageEnd: artifact.pageEnd,
        }];
      }
      if (artifact.artifactRole !== "DERIVED" || !artifact.sourceArtifactId) return [];
      const source = sources.get(artifact.sourceArtifactId);
      if (
        !source
        || source.ownerTeacherId !== input.teacherId
        || source.artifactRole !== "ORIGINAL"
        || !storedPath(source.storagePath)
      ) return [];
      return [{
        artifactId: artifact.id,
        originalArtifactId: source.id,
        storagePath: source.storagePath,
        mimeType: source.mimeType,
        pageStart: artifact.pageStart,
        pageEnd: artifact.pageEnd,
      }];
    });
    if (artifactReferences.length === 0) {
      throw new ProcessHandoffContractError("NOT_READY", "Stored ORIGINAL Artifact reference is required");
    }

    return {
      submissionId: submission.id,
      studentId: submission.studentId,
      classId: submission.classId,
      assignmentId: submission.assignmentId,
      activity: {
        id: submission.activityId,
        title: submission.activityTitle,
        description: submission.activityDescription,
        standardIds: [...submission.standardIds],
      },
      structuredInput: structuredInput.data,
      inputStatus: "READY_FOR_PROCESS",
      processStatus: submission.processStatus,
      artifacts: artifactReferences,
    };
  });
}
