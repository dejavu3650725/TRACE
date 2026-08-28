import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "평가관리" };

/**
 * 평가관리 /analysis (TRD §43, UIUX Master Prompt B)
 * 3단 구조: 01 자료 선택 → 02 분석 설정 → 03 분석 진행
 * 분석 가능 조건: input_status = READY_FOR_PROCESS
 * Owner: PROCESS (feat/process)
 */
const STEPS = [
  { no: "01", title: "자료 선택", desc: "분석 준비가 끝난 제출물을 선택해요" },
  { no: "02", title: "분석 설정", desc: "성취기준과 성취수준을 확인해요" },
  { no: "03", title: "분석 진행", desc: "AI 분석 진행률을 확인해요" },
];

export default function AnalysisPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="평가관리"
        description="분석 준비가 끝난 자료를 선택해 AI 분석을 실행하고 검토해요."
      />

      <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {STEPS.map(({ no, title, desc }, i) => (
          <li
            key={no}
            className={`rounded-2xl border p-5 ${
              i === 0 ? "border-brand-200 bg-brand-50/50" : "border-line bg-surface"
            }`}
          >
            <p className="text-xs font-bold tracking-widest text-brand-600">{no}</p>
            <p className="mt-1 text-base font-bold text-foreground">{title}</p>
            <p className="mt-1 text-sm text-muted">{desc}</p>
          </li>
        ))}
      </ol>

      {/* TODO(PROCESS): READY_FOR_PROCESS Submission 목록 + 분석 실행(Job 생성) */}
      <EmptyState
        title="분석할 수 있는 자료가 없어요"
        description="학습관리에서 자료가 '분석 준비' 상태가 되면 여기에 표시돼요."
        ctaLabel="학습관리로 이동"
        ctaHref="/results"
      />
    </div>
  );
}
