import type { CurriculumLoader } from "../../lib/curriculum/loader-full.ts";
import { inferCurriculumLabel, type CurriculumGradeBand } from "./curriculum.ts";

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
