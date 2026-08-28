import type { Metadata } from "next";
import { ShieldCheck, UserPlus, ScrollText, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/server";
import { getTeacherDisplayName } from "@/shared/displayName";

export const metadata: Metadata = { title: "관리자" };
export const dynamic = "force-dynamic";

/**
 * 관리자 콘솔 /admin — 학교 단위 운영 관리 (쇼케이스)
 * 등록된 교사 계정만 TRACE 전체 권한을 갖는 폐쇄 운영 모델의 관리 화면.
 * 현재는 화면 구성만 제공하며, 등록/정책 기능은 준비 중이다.
 */
export default async function AdminPage() {
  const hasSupabaseEnv = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY),
  );

  let teachers: Array<{ id: string; label: string; joinedAt: string | null }> = [];
  if (hasSupabaseEnv) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("teachers")
      .select("id, name, nickname, created_at")
      .order("created_at", { ascending: true })
      .limit(50);
    teachers = (data ?? []).map((t) => ({
      id: t.id,
      label: getTeacherDisplayName(t),
      joinedAt: t.created_at
        ? new Intl.DateTimeFormat("ko-KR", {
            timeZone: "Asia/Seoul",
            dateStyle: "medium",
          }).format(new Date(t.created_at))
        : null,
    }));
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="관리자"
        description="학교 단위 운영 관리 — 등록된 교사의 Google 계정만 TRACE 전체 권한을 가져요."
      />

      {/* 접근 정책 */}
      <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                승인된 교사만 이용 가능
                <StatusBadge label="준비 중" tone="neutral" />
              </p>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                이 정책을 켜면 아래 목록에 등록·승인된 교사 계정만 로그인 후 TRACE를
                이용할 수 있어요. 미승인 계정은 관리자 승인 대기 화면으로 안내돼요.
              </p>
            </div>
          </div>
          {/* 시각적 토글 — 기능 준비 중 */}
          <span
            aria-disabled
            className="relative inline-flex h-7 w-12 shrink-0 cursor-not-allowed items-center rounded-full bg-neutral-bg"
            title="준비 중이에요"
          >
            <span className="ml-1 inline-block h-5 w-5 rounded-full bg-white shadow-sm" />
          </span>
        </div>
      </section>

      {/* 등록 교사 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">등록 교사</h2>
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-muted/60"
            title="준비 중이에요"
          >
            <UserPlus className="h-4 w-4" />
            교사 등록
            <StatusBadge label="준비 중" tone="neutral" />
          </button>
        </div>

        {teachers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
            등록된 교사가 없어요.
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
            {teachers.map((t, i) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {t.label.slice(0, 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {t.label}
                    </span>
                    <span className="text-xs text-muted">
                      {t.joinedAt ? `${t.joinedAt} 등록` : "등록일 미상"}
                      {i === 0 ? " · 관리자" : ""}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {i === 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      관리자
                    </span>
                  )}
                  <StatusBadge label="승인됨" tone="success" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 감사 기록 */}
      <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <ScrollText className="h-5 w-5" />
          </span>
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-foreground">
              감사 기록
              <StatusBadge label="준비 중" tone="neutral" />
            </p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
              로그인, AI 분석 실행, 승인·반려까지 모든 판단 이력은 감사 로그로
              기록되고 있어요. 이 화면에서 시간순으로 열람하는 기능을 준비하고 있어요.
            </p>
          </div>
        </div>
      </section>

      <p className="text-center text-xs text-muted">
        모든 데이터 접근은 교사 계정 범위로 격리되며, 감사 기록은 수정할 수 없어요.
      </p>
    </div>
  );
}
