/** Class Code 시간 규칙. 호출자는 공통 Config의 TTL을 명시적으로 전달한다. */
export function calculateClassCodeExpiry(issuedAt: Date, validityHours: number): Date {
  if (!Number.isFinite(validityHours) || validityHours <= 0) {
    throw new Error("Class Code validity must be a positive number of hours");
  }

  return new Date(issuedAt.getTime() + validityHours * 60 * 60 * 1000);
}

/** 만료 시각과 현재 시각을 모두 서버에서 해석한다. 만료 시각과 같아지는 즉시 무효다. */
export function isClassCodeActive(
  classCode: string | null,
  expiresAt: string | Date | null,
  now: Date = new Date(),
): boolean {
  if (!classCode || !expiresAt) return false;

  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() > now.getTime();
}

export function generateClassCode(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  if (!Number.isInteger(length) || length < 1) {
    throw new Error("Class Code length must be a positive integer");
  }

  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}
