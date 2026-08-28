/**
 * Teacher 개인화 표시 이름 공통 규칙.
 * nickname 있음 → nickname (예: "혜진쌤")
 * nickname 없음 → "{name} 선생님" (예: "김혜진 선생님")
 * 화면마다 다른 규칙을 만들지 않는다.
 */
export function getTeacherDisplayName(teacher: {
  name: string;
  nickname?: string | null;
}): string {
  const nickname = teacher.nickname?.trim();
  if (nickname) return nickname;
  return `${teacher.name} 선생님`;
}
