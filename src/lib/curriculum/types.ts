/** Shared Curriculum JSON read model (TRACE TRD §15). */

export type CurriculumDatasetKind = "standards" | "achievement_levels";

export interface CurriculumStandard {
  /** Shared `standard_id`; it is the source JSON's `code` without alteration. */
  id: string;
  schoolLevel: string | null;
  grade: string;
  subject: string;
  /** The source JSON calls this field `area`. */
  domain: string;
  /** The supplied source files do not define a unit field. */
  unit: null;
  description: string;
  coreIdea: string | null;
  sourceFile: string;
}

export interface CurriculumAchievementLevel {
  /** Matches `CurriculumStandard.id` after only outer square brackets are removed. */
  standardId: string;
  description: string;
  levels: Readonly<Record<string, string>>;
  schoolLevel: string | null;
  gradeBand: string | null;
  sourceFile: string;
}

export interface FindStandardsInput {
  grade?: string;
  subject?: string;
  domain?: string;
  /** Supported for the shared contract; current source data has no unit values. */
  unit?: string;
  keyword?: string;
  limit?: number;
}

export interface CurriculumSnapshot {
  standards: readonly CurriculumStandard[];
  achievementLevels: readonly CurriculumAchievementLevel[];
}
