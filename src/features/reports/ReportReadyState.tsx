import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Braces,
  CircleDot,
  Database,
  FileText,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ReportPageStats } from "@/lib/output/report-page-model";
import styles from "./report-experience.module.css";

interface ReportReadyStateProps {
  stats: ReportPageStats;
}

const connectionCopy = {
  ready: {
    label: "데이터 연결 완료",
    detail: "현재 교사 계정에서 확인된 실제 현황입니다.",
  },
  "not-configured": {
    label: "데이터 연결 대기",
    detail: "연결이 완료되면 실제 입력 현황이 이 자리에 반영됩니다.",
  },
  unavailable: {
    label: "데이터 확인 필요",
    detail: "현재 현황을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.",
  },
} as const;

export function ReportReadyState({ stats }: ReportReadyStateProps) {
  const connection = connectionCopy[stats.connection];
  const stages = [
    {
      index: "01",
      label: "INPUT",
      detail: stats.submissionCount > 0 ? `${stats.submissionCount}건 입력 확인` : "학생 산출물 입력 대기",
      ready: stats.submissionCount > 0,
      icon: Braces,
    },
    {
      index: "02",
      label: "PROCESS",
      detail:
        stats.approvedAnalysisCount > 0
          ? `${stats.approvedAnalysisCount}건 교사 승인`
          : "교사 검토·승인 대기",
      ready: stats.approvedAnalysisCount > 0,
      icon: ScanLine,
    },
    {
      index: "03",
      label: "OUTPUT",
      detail: stats.evidenceCount > 0 ? `${stats.evidenceCount}건 근거 연결 중` : "성장 기록 생성 대기",
      ready: stats.evidenceCount > 0,
      icon: BookOpenCheck,
    },
  ];

  return (
    <article className={`${styles.readyState} min-h-[calc(100vh-10rem)] overflow-hidden rounded-3xl border border-line`}>
      <div className={`${styles.readyAura} px-5 py-8 sm:px-8 sm:py-10 xl:px-12 xl:py-12`}>
        <div className="relative z-10 grid gap-10 min-[1440px]:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)] min-[1440px]:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                학생 정보 보호 · 실제 값만 표시
              </span>
              <span className="rounded-full border border-brand-200/40 px-3 py-1.5 font-display text-xs font-semibold text-brand-100">
                REPORT READY
              </span>
            </div>

            <p className="mt-8 font-display text-xs font-bold tracking-[0.22em] text-brand-200">
              TRACE LEARNING GROWTH REPORT
            </p>
            <h1 className="mt-3 max-w-3xl text-[clamp(2.15rem,4.4vw,3.75rem)] font-extrabold leading-[1.04] tracking-[-0.045em] text-white">
              아직 빈 리포트가 아니라,
              <span className="block bg-gradient-to-r from-brand-100 via-white to-success-bg bg-clip-text text-transparent">
                성장 기록을 기다리는 무대입니다.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-brand-100 sm:text-lg">
              실제 학생 입력과 교사 승인 근거가 연결되면 이 화면은 같은 자리에서 학생별 성장 리포트로
              전환됩니다. 값이 없을 때는 빈칸이나 가상 학생 정보를 보여주지 않습니다.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/results/add"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-brand-900 shadow-[var(--shadow-card-hover)] transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-brand-200 motion-reduce:transform-none"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                학생 결과 입력
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/results"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-brand-200"
              >
                처리 현황 확인
              </Link>
            </div>
          </div>

          <section className={`${styles.readySignalBoard} rounded-3xl p-4 sm:p-5`} aria-label="리포트 준비 흐름">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="font-display text-xs font-bold tracking-[0.16em] text-brand-200">LIVE SIGNAL BOARD</p>
                <p className="mt-1 text-sm font-semibold text-white">입력부터 출력까지 준비 상태</p>
              </div>
              <span className={`${styles.readyPulse} flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-brand-100`}>
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>

            <ol className="mt-4 space-y-3">
              {stages.map((stage) => {
                const Icon = stage.icon;
                return (
                  <li key={stage.index} className={`${styles.readyStage} flex items-center gap-4 rounded-2xl p-4`}>
                    <span className="font-display text-xs font-bold text-brand-200">{stage.index}</span>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-xs font-bold tracking-[0.14em] text-brand-200">{stage.label}</p>
                      <p className="mt-1 truncate text-sm font-semibold text-white">{stage.detail}</p>
                    </div>
                    {stage.ready ? (
                      <BadgeCheck className="h-5 w-5 shrink-0 text-success-bg" aria-label="확인됨" />
                    ) : (
                      <CircleDot className="h-5 w-5 shrink-0 text-brand-200" aria-label="대기 중" />
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>

      <section className="relative z-10 grid gap-px border-t border-line bg-line sm:grid-cols-2 xl:grid-cols-5" aria-label="실제 데이터 현황">
        <div className="bg-surface p-5 sm:col-span-2 xl:col-span-1">
          <div className="flex items-center gap-2 text-xs font-bold text-brand-700">
            <Database className="h-4 w-4" aria-hidden="true" />
            {connection.label}
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">{connection.detail}</p>
        </div>
        {[
          ["등록 학생", stats.studentCount, "명"],
          ["확인된 입력", stats.submissionCount, "건"],
          ["승인 분석", stats.approvedAnalysisCount, "건"],
          ["연결 근거", stats.evidenceCount, "건"],
        ].map(([label, value, unit]) => (
          <dl key={String(label)} className="bg-surface p-5">
            <dt className="text-xs font-bold text-muted">{label}</dt>
            <dd className="mt-2 font-display text-3xl font-extrabold tabular-nums text-foreground">
              {Number(value).toLocaleString("ko-KR")}
              <span className="ml-1 text-sm font-bold text-muted">{unit}</span>
            </dd>
          </dl>
        ))}
      </section>

      <footer className="flex flex-col gap-3 border-t border-line bg-background px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <CircleDot className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">
              {stats.latestStudentLabel ? `${stats.latestStudentLabel} 입력을 확인하고 있습니다.` : "표시할 실제 학생 정보가 아직 없습니다."}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">승인된 성장 기록이 완성되면 전체 리포트가 자동으로 표시됩니다.</p>
          </div>
        </div>
      </footer>
    </article>
  );
}
