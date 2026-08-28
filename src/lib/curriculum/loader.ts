import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import manifestJson from "../../shared/curriculum/manifest.json" with { type: "json" };

import type {
  CurriculumAchievementLevel,
  CurriculumDatasetKind,
  CurriculumSnapshot,
  CurriculumStandard,
  FindStandardsInput,
} from "./types";

const manifestSchema = z.object({
  schema_version: z.literal("1"),
  source_root: z.string().min(1),
  datasets: z
    .array(
      z.object({
        kind: z.enum(["standards", "achievement_levels"]),
        file_name_suffix: z.string().min(1),
        path_contains_any: z.array(z.string().min(1)).min(1).optional(),
      }),
    )
    .min(2),
});

const sourceStandardSchema = z
  .object({
    code: z.string().min(1),
    grade: z.string().min(1),
    subject: z.string().min(1),
    area: z.string().min(1),
    description: z.string().min(1),
    school: z.string().min(1).optional(),
    core_idea: z.string().min(1).optional(),
  })
  .passthrough();

const sourceAchievementRecordSchema = z
  .object({
    성취기준_코드: z.string().min(1),
    성취기준_내용: z.string().min(1),
    성취수준: z.record(z.string().min(1), z.string()).refine(
      (levels) => Object.keys(levels).length > 0,
      "at least one achievement level is required",
    ),
  })
  .passthrough();

const manifest = manifestSchema.parse(manifestJson);

export class CurriculumDataError extends Error {
  override name = "CurriculumDataError";
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "root"}: ${issue.message}`)
    .join("; ");
}

function normalizeStandardId(id: string): string {
  return id.trim().replace(/^\[/, "").replace(/\]$/, "");
}

function normalizeKeyword(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function includesKeyword(value: string, keyword: string): boolean {
  return normalizeKeyword(value).includes(normalizeKeyword(keyword));
}

function assertWithinSourceRoot(sourceRoot: string, candidatePath: string): void {
  const relativePath = path.relative(sourceRoot, candidatePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new CurriculumDataError(`Curriculum path escapes the configured source root: ${candidatePath}`);
  }
}

async function findJsonFiles(directoryPath: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CurriculumDataError(`Could not read curriculum source directory "${directoryPath}": ${detail}`);
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        return findJsonFiles(entryPath);
      }

      return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
    }),
  );

  return files.flat().sort((left, right) => left.localeCompare(right, "ko-KR"));
}

async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CurriculumDataError(`Could not parse curriculum JSON "${filePath}": ${detail}`);
  }
}

function datasetMatchesFile(
  dataset: { kind: CurriculumDatasetKind; file_name_suffix: string; path_contains_any?: string[] },
  sourceRoot: string,
  filePath: string,
): boolean {
  // Finder preserves macOS's decomposed Unicode filenames. Compare normalized
  // strings so the manifest remains portable and human-readable.
  const relativePath = path.relative(sourceRoot, filePath).split(path.sep).join("/").normalize("NFC");
  const fileName = path.basename(filePath).normalize("NFC");

  return (
    fileName.endsWith(dataset.file_name_suffix) &&
    (dataset.path_contains_any === undefined ||
      dataset.path_contains_any.some((pathSegment) => relativePath.includes(pathSegment)))
  );
}

function normaliseStandard(source: unknown, sourceFile: string): CurriculumStandard {
  const parsed = sourceStandardSchema.safeParse(source);

  if (!parsed.success) {
    throw new CurriculumDataError(`Invalid standard in "${sourceFile}": ${formatZodIssues(parsed.error)}`);
  }

  return {
    id: parsed.data.code,
    schoolLevel: parsed.data.school ?? null,
    grade: parsed.data.grade,
    subject: parsed.data.subject,
    domain: parsed.data.area,
    unit: null,
    description: parsed.data.description,
    coreIdea: parsed.data.core_idea ?? null,
    sourceFile,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectAchievementLevels(
  source: unknown,
  sourceFile: string,
  metadata: { schoolLevel: string | null; gradeBand: string | null },
): CurriculumAchievementLevel[] {
  const result: CurriculumAchievementLevel[] = [];

  function visit(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!isRecord(value)) {
      return;
    }

    const hasAchievementRecordKey =
      "성취기준_코드" in value || "성취기준_내용" in value || "성취수준" in value;

    if (hasAchievementRecordKey) {
      const parsed = sourceAchievementRecordSchema.safeParse(value);

      if (!parsed.success) {
        throw new CurriculumDataError(
          `Invalid achievement level in "${sourceFile}": ${formatZodIssues(parsed.error)}`,
        );
      }

      result.push({
        standardId: normalizeStandardId(parsed.data.성취기준_코드),
        description: parsed.data.성취기준_내용,
        levels: Object.fromEntries(
          Object.entries(parsed.data.성취수준)
            // Some supplied records explicitly leave a level blank. Preserve
            // the source truth by exposing only levels with actual text.
            .filter(([, description]) => description.trim().length > 0)
            .sort(([left], [right]) => left.localeCompare(right, "en")),
        ),
        schoolLevel: metadata.schoolLevel,
        gradeBand: metadata.gradeBand,
        sourceFile,
      });
      if (Object.keys(result.at(-1)?.levels ?? {}).length === 0) {
        throw new CurriculumDataError(`Achievement level in "${sourceFile}" has no populated level text.`);
      }

      return;
    }

    Object.values(value).forEach(visit);
  }

  visit(source);
  return result;
}

function readAchievementMetadata(source: unknown): { schoolLevel: string | null; gradeBand: string | null } {
  if (!isRecord(source)) {
    return { schoolLevel: null, gradeBand: null };
  }

  return {
    schoolLevel: typeof source.학교급 === "string" ? source.학교급 : null,
    gradeBand: typeof source.학년군 === "string" ? source.학년군 : null,
  };
}

function assertUniqueIds<T>(
  values: readonly T[],
  getId: (value: T) => string,
  label: string,
): void {
  const seen = new Set<string>();

  for (const value of values) {
    const id = getId(value);

    if (seen.has(id)) {
      throw new CurriculumDataError(`Duplicate ${label} ID in curriculum source: ${id}`);
    }

    seen.add(id);
  }
}

function requireDataset(
  kind: CurriculumDatasetKind,
): { kind: CurriculumDatasetKind; file_name_suffix: string; path_contains_any?: string[] } {
  const dataset = manifest.datasets.find((entry) => entry.kind === kind);

  if (!dataset) {
    throw new CurriculumDataError(`Curriculum manifest has no ${kind} dataset configuration.`);
  }

  return dataset;
}

async function readCurriculum(): Promise<CurriculumSnapshot> {
  const sourceRoot = path.resolve(process.cwd(), manifest.source_root);
  const allFiles = await findJsonFiles(sourceRoot);
  const standardDataset = requireDataset("standards");
  const achievementDataset = requireDataset("achievement_levels");
  const standardFiles = allFiles.filter((filePath) => datasetMatchesFile(standardDataset, sourceRoot, filePath));
  const achievementFiles = allFiles.filter((filePath) => datasetMatchesFile(achievementDataset, sourceRoot, filePath));

  if (standardFiles.length === 0 || achievementFiles.length === 0) {
    throw new CurriculumDataError(
      `Curriculum manifest matched ${standardFiles.length} standard file(s) and ${achievementFiles.length} achievement-level file(s).`,
    );
  }

  const standards = (
    await Promise.all(
      standardFiles.map(async (filePath) => {
        assertWithinSourceRoot(sourceRoot, filePath);
        const source = await readJsonFile(filePath);

        if (!Array.isArray(source)) {
          throw new CurriculumDataError(`Standard source "${filePath}" must contain a JSON array.`);
        }

        return source.map((item) => normaliseStandard(item, path.relative(sourceRoot, filePath)));
      }),
    )
  )
    .flat()
    .sort((left, right) => left.id.localeCompare(right.id, "ko-KR"));

  const achievementLevels = (
    await Promise.all(
      achievementFiles.map(async (filePath) => {
        assertWithinSourceRoot(sourceRoot, filePath);
        const source = await readJsonFile(filePath);

        return collectAchievementLevels(source, path.relative(sourceRoot, filePath), readAchievementMetadata(source));
      }),
    )
  )
    .flat()
    .sort((left, right) => left.standardId.localeCompare(right.standardId, "ko-KR"));

  if (standards.length === 0 || achievementLevels.length === 0) {
    throw new CurriculumDataError("Curriculum source did not contain any standards or achievement levels.");
  }

  assertUniqueIds(standards, (standard) => standard.id, "standard");
  assertUniqueIds(achievementLevels, (achievementLevel) => achievementLevel.standardId, "achievement level");

  return { standards, achievementLevels };
}

let curriculumSnapshotPromise: Promise<CurriculumSnapshot> | undefined;

/**
 * Loads and validates the shared source once per server process.
 * A failed read is not cached, so a corrected source file can be retried.
 */
export function loadCurriculum(): Promise<CurriculumSnapshot> {
  if (!curriculumSnapshotPromise) {
    curriculumSnapshotPromise = readCurriculum();
    void curriculumSnapshotPromise.catch(() => {
      curriculumSnapshotPromise = undefined;
    });
  }

  return curriculumSnapshotPromise;
}

export class CurriculumLoader {
  readonly #standardsById: ReadonlyMap<string, CurriculumStandard>;
  readonly #achievementLevelsByStandardId: ReadonlyMap<string, CurriculumAchievementLevel>;
  private readonly snapshot: CurriculumSnapshot;

  private constructor(snapshot: CurriculumSnapshot) {
    this.snapshot = snapshot;
    this.#standardsById = new Map(snapshot.standards.map((standard) => [standard.id, standard]));
    this.#achievementLevelsByStandardId = new Map(
      snapshot.achievementLevels.map((achievementLevel) => [achievementLevel.standardId, achievementLevel]),
    );
  }

  static async create(): Promise<CurriculumLoader> {
    return new CurriculumLoader(await loadCurriculum());
  }

  getStandard(standardId: string): CurriculumStandard | null {
    return this.#standardsById.get(normalizeStandardId(standardId)) ?? null;
  }

  getAchievementLevel(standardId: string): CurriculumAchievementLevel | null {
    return this.#achievementLevelsByStandardId.get(normalizeStandardId(standardId)) ?? null;
  }

  findStandards(input: FindStandardsInput = {}): CurriculumStandard[] {
    const limit = input.limit ?? 20;

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new CurriculumDataError("Curriculum search limit must be an integer between 1 and 100.");
    }

    return this.snapshot.standards
      .filter((standard) => {
        if (input.grade !== undefined && standard.grade !== input.grade) return false;
        if (input.subject !== undefined && standard.subject !== input.subject) return false;
        if (input.domain !== undefined && standard.domain !== input.domain) return false;
        if (input.unit !== undefined && standard.unit !== input.unit) return false;

        if (input.keyword === undefined || input.keyword.trim() === "") return true;

        return [standard.id, standard.subject, standard.domain, standard.description, standard.coreIdea ?? ""].some(
          (value) => includesKeyword(value, input.keyword ?? ""),
        );
      })
      .slice(0, limit);
  }
}

let sharedCurriculumLoaderPromise: Promise<CurriculumLoader> | undefined;

/** Server-only singleton for INPUT, PROCESS, and OUTPUT server code. */
export function getCurriculumLoader(): Promise<CurriculumLoader> {
  if (!sharedCurriculumLoaderPromise) {
    sharedCurriculumLoaderPromise = CurriculumLoader.create();
    void sharedCurriculumLoaderPromise.catch(() => {
      sharedCurriculumLoaderPromise = undefined;
    });
  }

  return sharedCurriculumLoaderPromise;
}
