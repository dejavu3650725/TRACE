import type { CurriculumLoader } from "../../lib/curriculum/loader-full.ts";
import type { CurriculumStandard } from "../../lib/curriculum/types.ts";
import { inferCurriculumLabel, type CurriculumGradeBand } from "./curriculum.ts";

const MATERIAL_STOP_WORDS = new Set([
  "교과", "내용", "다음", "대한", "문제", "문항", "보기", "사용", "학생",
  "작성", "활동", "활동지", "알맞은", "설명", "해보세요", "하세요",
]);

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function compactText(value: string): string {
  return normalizeText(value).replace(/[^0-9a-z가-힣]+/g, "");
}

function normalizeTerm(value: string): string {
  let term = normalizeText(value).replace(/[^0-9a-z가-힣]/g, "");
  if (term.length >= 3) {
    term = term.replace(/(으로|에서|에게|까지|부터|처럼|보다|하고|하며|하여|하기|되는|하는|된|한|을|를|은|는|이|가|과|와|의|에)$/u, "");
  }
  return term;
}

function terms(value: string): string[] {
  return [...new Set(
    normalizeText(value)
      .split(/[^0-9a-z가-힣]+/u)
      .map(normalizeTerm)
      .filter((term) => term.length >= 2 && !MATERIAL_STOP_WORDS.has(term)),
  )];
}

function countDescriptionMatches(description: string, values: readonly string[]): number {
  const normalizedDescription = compactText(description);
  return [...new Set(values.flatMap(terms))]
    .filter((term) => normalizedDescription.includes(compactText(term)))
    .length;
}

export function selectMostRelevantMaterialStandard(input: {
  standards: readonly CurriculumStandard[];
  title: string;
  description: string;
  instructions: string;
  domain: string | null;
  unit: string | null;
  keywords: readonly string[];
  questionPrompts: readonly string[];
}): CurriculumStandard | null {
  const ranked = input.standards.map((standard) => {
    let score = 0;
    const standardDescription = standard.description;

    if (input.domain && compactText(input.domain) === compactText(standard.domain)) score += 8;
    score += countDescriptionMatches(standardDescription, input.keywords) * 10;
    score += countDescriptionMatches(standardDescription, input.unit ? [input.unit] : []) * 7;
    score += countDescriptionMatches(standardDescription, [input.title]) * 5;
    score += countDescriptionMatches(standardDescription, input.questionPrompts) * 3;
    score += countDescriptionMatches(standardDescription, [input.description, input.instructions]);

    for (const keyword of input.keywords) {
      const compactKeyword = compactText(keyword);
      if (compactKeyword.length >= 4 && compactText(standardDescription).includes(compactKeyword)) score += 8;
    }

    return { standard, score };
  });

  return ranked
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.standard.id.localeCompare(right.standard.id, "ko-KR"))
    .map((candidate) => candidate.standard)[0] ?? null;
}

export function resolveAiCurriculumContext({
  loader,
  gradeBand,
  teacherPrompt,
  subject,
  domain,
  standardKeyword,
}: {
  loader: CurriculumLoader;
  gradeBand: CurriculumGradeBand;
  teacherPrompt: string;
  subject: string | null;
  domain: string | null;
  standardKeyword: string | null;
}) {
  const resolvedSubject = subject ?? inferCurriculumLabel(
    teacherPrompt,
    loader.listStandardSubjects(gradeBand),
  );
  const resolvedDomain = domain ?? (resolvedSubject
    ? inferCurriculumLabel(
        teacherPrompt,
        loader.listStandardDomains({ grade: gradeBand, subject: resolvedSubject }),
      )
    : null);
  const baseFilters = {
    grade: gradeBand,
    subject: resolvedSubject ?? undefined,
    limit: 8,
  };
  let standards = resolvedSubject ? loader.findStandards({
    ...baseFilters,
    domain: resolvedDomain ?? undefined,
    keyword: standardKeyword ?? undefined,
  }) : [];

  if (standards.length === 0 && resolvedSubject && (resolvedDomain || standardKeyword)) {
    standards = loader.findStandards(baseFilters);
  }

  return { resolvedSubject, resolvedDomain, standards };
}
