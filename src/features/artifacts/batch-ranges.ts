import type { StructuredInputRuntime } from "../submissions/structured-input-schema.ts";

export type BatchPageRange = {
  page_start: number;
  page_end: number;
};

export type PageIdentity = Readonly<{
  grade: string | null;
  className: string | null;
  studentNumber: string | null;
  studentName: string | null;
  uncertain: boolean;
}>;

export type PageQuestion = Readonly<{
  questionId: string;
  visiblePrompt: string | null;
  responseType: StructuredInputRuntime["questions"][number]["response_type"];
  response: Record<string, unknown>;
  uncertain: boolean;
}>;

export type ExtractedBatchPage = Readonly<{
  page: number;
  identity: PageIdentity;
  questions: readonly PageQuestion[];
}>;

export type ExtractedStudentPacket = Readonly<{
  pageStart: number;
  pageEnd: number;
  identity: PageIdentity;
  questions: readonly PageQuestion[];
}>;

export class BatchPageRangeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BatchPageRangeValidationError";
  }
}

export function groupBatchPagesByStudent(
  pageCount: number,
  pagesPerStudent: number,
): BatchPageRange[] {
  if (
    !Number.isInteger(pageCount)
    || pageCount < 1
    || pageCount > 100
    || !Number.isInteger(pagesPerStudent)
    || pagesPerStudent < 1
    || pagesPerStudent > pageCount
  ) {
    throw new BatchPageRangeValidationError("학생 한 명의 활동지 쪽수를 다시 확인해 주세요.");
  }

  const ranges: BatchPageRange[] = [];
  for (let pageStart = 1; pageStart <= pageCount; pageStart += pagesPerStudent) {
    ranges.push({
      page_start: pageStart,
      page_end: Math.min(pageCount, pageStart + pagesPerStudent - 1),
    });
  }
  return ranges;
}

function normalizedIdentityPart(value: string | null): string | null {
  const normalized = value?.normalize("NFKC").trim().replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
  return normalized ? normalized : null;
}

function exactVisibleIdentityKey(identity: PageIdentity): string | null {
  if (identity.uncertain) return null;
  const studentNumber = identity.studentNumber?.trim() ?? "";
  const studentName = normalizedIdentityPart(identity.studentName);
  if (!/^[1-9][0-9]{0,4}$/.test(studentNumber) || !studentName) return null;
  return `${Number(studentNumber)}:${studentName}`;
}

function mergePacketQuestions(
  current: readonly PageQuestion[],
  incoming: readonly PageQuestion[],
  page: number,
): PageQuestion[] {
  const merged = [...current];
  const existingIds = new Set(current.map(({ questionId }) => questionId));

  for (const question of incoming) {
    if (!existingIds.has(question.questionId)) {
      merged.push(question);
      existingIds.add(question.questionId);
      continue;
    }
    const existing = merged.find((candidate) => candidate.questionId === question.questionId);
    if (
      existing
      && existing.responseType === question.responseType
      && JSON.stringify(existing.response) === JSON.stringify(question.response)
    ) {
      continue;
    }
    let questionId = `${question.questionId}-p${page}`;
    let suffix = 2;
    while (existingIds.has(questionId)) {
      questionId = `${question.questionId}-p${page}-${suffix}`;
      suffix += 1;
    }
    merged.push({ ...question, questionId, uncertain: true });
    existingIds.add(questionId);
  }

  return merged;
}

/** Every page is inspected independently before exact adjacent identities are joined. */
export function groupExtractedBatchPages(
  input: readonly ExtractedBatchPage[],
): ExtractedStudentPacket[] {
  const pages = [...input].sort((left, right) => left.page - right.page);
  const packets: Array<{
    pageStart: number;
    pageEnd: number;
    identity: PageIdentity;
    questions: PageQuestion[];
    identityKey: string | null;
  }> = [];

  for (const page of pages) {
    const identityKey = exactVisibleIdentityKey(page.identity);
    const previous = packets.at(-1);
    if (
      previous
      && identityKey !== null
      && previous.identityKey === identityKey
      && previous.pageEnd + 1 === page.page
    ) {
      previous.pageEnd = page.page;
      previous.questions = mergePacketQuestions(previous.questions, page.questions, page.page);
      continue;
    }
    packets.push({
      pageStart: page.page,
      pageEnd: page.page,
      identity: page.identity,
      questions: [...page.questions],
      identityKey,
    });
  }

  return packets.map((packet) => ({
    pageStart: packet.pageStart,
    pageEnd: packet.pageEnd,
    identity: packet.identity,
    questions: packet.questions,
  }));
}

export function normalizeBatchPageRanges(
  input: readonly BatchPageRange[],
  pageCount: number,
): BatchPageRange[] {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 100) {
    throw new BatchPageRangeValidationError("PDF 전체 페이지 수를 확인하지 못했어요.");
  }
  if (!Array.isArray(input) || input.length < 1 || input.length > 100) {
    throw new BatchPageRangeValidationError("학생 자료 묶음은 1개 이상 100개 이하로 지정해 주세요.");
  }

  const ranges = input.map((range) => ({
    page_start: Number(range.page_start),
    page_end: Number(range.page_end),
  }));
  if (ranges.some((range) => (
    !Number.isInteger(range.page_start)
    || !Number.isInteger(range.page_end)
    || range.page_start < 1
    || range.page_start > range.page_end
    || range.page_end > pageCount
  ))) {
    throw new BatchPageRangeValidationError(`학생 자료 묶음은 1~${pageCount}쪽 안에서 지정해 주세요.`);
  }

  ranges.sort((left, right) => left.page_start - right.page_start || left.page_end - right.page_end);
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index].page_start <= ranges[index - 1].page_end) {
      throw new BatchPageRangeValidationError("학생 자료 묶음은 서로 겹칠 수 없어요.");
    }
  }
  return ranges;
}
