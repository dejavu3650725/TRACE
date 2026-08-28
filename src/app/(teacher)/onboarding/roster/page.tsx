import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "학생 명단 등록" };

/**
 * Onboarding 2단계 /onboarding/roster (TRD §10)
 * CSV/XLSX 업로드 또는 직접 추가. 번호+이름 필수, 학급 내 번호 중복 금지.
 * Owner: Shared + INPUT
 */
export default function OnboardingRosterPage() {
  // Roster는 Class에 종속되므로, Class 선택 후 단일 상세 화면에서 직접 관리한다.
  redirect("/classes");
}
