import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "학급 만들기" };

/**
 * Onboarding 1단계 /onboarding/class (TRD §9, §10)
 * 학년 · 학급명/반 · (선택) 교과 입력 → Class 생성 → class_code 발급
 * Owner: Shared + INPUT
 */
export default function OnboardingClassPage() {
  // Class 생성 폼은 /classes에 한 번만 둔다. 온보딩 진입도 같은 실제 CRUD를 사용한다.
  redirect("/classes");
}
