import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireSessionTeacher } from "@/lib/auth/teacher";
import { issueSubmissionToken } from "@/features/activities/token-actions";
import { QuickQrPanel } from "@/features/activities/QuickQrPanel";

export const metadata: Metadata = { title: "학생 직접 제출" };
export const dynamic = "force-dynamic";

/**
 * 학생 직접 제출 QR 공유 /results/share (ISSUE-17 QRSharePanel)
 * 제출 가능(OPEN) 배정의 QR을 한 화면에서 발급·공유한다.
 * QR에는 학생 정보가 담기지 않는다 — /submit/[token] 링크만.
 */
export default async function ResultsSharePage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string; token?: string }>;
}) {
  const { quick } = await searchParams;
  const { supabase } = await requireSessionTeacher();
  const { data: teacherClasses } = await supabase
    .from("classes")
    .select("id, name")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  const { data: assignments } = await supabase
    .from("activity_assignments")
    .select("id, submission_token, status, activities ( id, title ), classes ( name, class_code, class_code_expires_at )")
    .eq("status", "OPEN")
    .order("created_at", { ascending: false })
    .limit(30);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const one = (v: any) => (Array.isArray(v) ? v[0] : v);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  const rows = await Promise.all(
    (assignments ?? []).map(async (assignment) => {
      const activity = one(assignment.activities);
      const cls = one(assignment.classes);
      const url = assignment.submission_token ? `${baseUrl}/submit/${assignment.submission_token}` : null;
      const qrDataUrl = url
        ? await QRCode.toDataURL(url, { margin: 1, width: 200, color: { dark: "#101b30", light: "#ffffff" } })
        : null;
      const codeActive = Boolean(
        cls?.class_code &&
          cls?.class_code_expires_at &&
          new Date(cls.class_code_expires_at).getTime() > Date.now(),
      );
      return {
        id: assignment.id,
        activityId: activity?.id as string | undefined,
        title: (activity?.title as string) ?? "활동",
        className: (cls?.name as string) ?? "학급",
        classCode: codeActive ? (cls?.class_code as string) : null,
        url,
        qrDataUrl,
      };
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="학생 직접 제출"
        description="QR을 화면에 띄우면 학생이 자기 기기로 스캔해 활동지를 촬영·제출해요."
      />

      {quick === "created" && (
        <p className="rounded-2xl border border-success/20 bg-success-bg px-4 py-3 text-sm font-semibold text-success">
          ✨ 활동지에서 활동을 만들고 QR을 발급했어요. 아래 새 카드의 QR을 학생들에게 보여주세요 — 제출되면 AI가 바로 분석을 시작해요.
        </p>
      )}

      <QuickQrPanel classes={teacherClasses ?? []} />

      {rows.length === 0 ? (
        <EmptyState
          title="제출 가능한 활동 배정이 없어요"
          description="활동을 학급에 배정(OPEN)하면 여기에서 QR을 발급할 수 있어요."
          ctaLabel="활동 관리로 가기"
          ctaHref="/activities"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{row.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{row.className}</p>
                </div>
                {row.classCode ? (
                  <span className="shrink-0 rounded-lg bg-brand-50 px-2.5 py-1 font-display text-sm font-bold tracking-[0.25em] text-brand-700">
                    {row.classCode}
                  </span>
                ) : (
                  <StatusBadge label="학급 코드 만료" tone="warning" />
                )}
              </div>

              {row.qrDataUrl ? (
                <div className="mt-4 flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.qrDataUrl} alt={`${row.title} 제출 QR`} className="h-36 w-36 rounded-xl border border-line bg-white p-1.5" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="break-all rounded-lg bg-neutral-bg/60 px-3 py-2 font-mono text-[11px] text-muted">{row.url}</p>
                    <p className="text-xs leading-relaxed text-muted">
                      학생: QR 스캔 → 학급 코드 <b className="text-foreground">{row.classCode ?? "(재발급 필요)"}</b> + 번호·이름 →
                      촬영 제출
                    </p>
                  </div>
                </div>
              ) : (
                <form action={issueSubmissionToken} className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-background px-4 py-3">
                  <p className="text-sm text-muted">아직 QR이 없어요.</p>
                  <input type="hidden" name="activityId" value={row.activityId ?? ""} />
                  <input type="hidden" name="assignmentId" value={row.id} />
                  <input type="hidden" name="returnTo" value="share" />
                  <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">
                    <QrCode className="h-4 w-4" /> QR 발급
                  </button>
                </form>
              )}

              {!row.classCode && (
                <p className="mt-3 text-xs text-warning">
                  학급 코드가 없거나 만료됐어요 —{" "}
                  <Link href="/classes" className="font-bold underline underline-offset-2">
                    클래스 관리
                  </Link>
                  에서 새로 발급하세요.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted">
        QR·링크에는 학생 이름과 번호가 담기지 않아요. 본인 확인은 서버가 학급 코드·번호·이름으로만 수행해요.
      </p>
    </div>
  );
}
