export type BatchPageRange = {
  page_start: number;
  page_end: number;
};

export class BatchPageRangeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BatchPageRangeValidationError";
  }
}

export function normalizeBatchPageRanges(
  input: readonly BatchPageRange[],
  pageCount: number,
): BatchPageRange[] {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 100) {
    throw new BatchPageRangeValidationError("PDF 전체 페이지 수를 확인하지 못했어요.");
  }
  if (!Array.isArray(input) || input.length < 1 || input.length > 100) {
    throw new BatchPageRangeValidationError("페이지 구간은 1개 이상 100개 이하로 지정해 주세요.");
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
    throw new BatchPageRangeValidationError(`페이지 구간은 1~${pageCount}쪽 안에서 지정해 주세요.`);
  }

  ranges.sort((left, right) => left.page_start - right.page_start || left.page_end - right.page_end);
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index].page_start <= ranges[index - 1].page_end) {
      throw new BatchPageRangeValidationError("페이지 구간은 서로 겹칠 수 없어요.");
    }
  }
  return ranges;
}
