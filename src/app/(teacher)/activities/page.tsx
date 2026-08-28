import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireSessionTeacher } from "@/lib/auth/teacher";

export const metadata: Metadata = { title: "학습 활동" };

const activityStatus = {
  DRAFT: { label: "초안", tone: "warning" as const },
  ACTIVE: { label: "활성", tone: "success" as const },
  ARCHIVED: { label: "보관됨", tone: "neutral" as const },
};

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ "activity-error"?: string }> }) {
  const query = await searchParams;
  const { teacher, supabase } = await requireSessionTeacher();
  const { data: activities, error } = await supabase
    .from("activities")
    .select("id, title, grade, subject, domain, status, activity_code, updated_at, activity_standards(standard_id), activity_assignments(id)")
    .eq("teacher_id", teacher.id)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Activity list lookup failed", { cause: error });

  return (
    <div className="space-y-6">
      <PageHeader
        title="학습 활동"
        description="활동을 만들고 성취기준·연계 차시·배정 학급을 관리해요."
        actions={<Link href="/activities/new" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700"><Plus className="h-4 w-4" /> 활동 만들기</Link>}
      />
      {query["activity-error"] && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">활동 요청을 처리하지 못했어요. 다시 시도해 주세요.</p>}

      {activities && activities.length > 0 ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activities.map((activity) => {
            const status = activityStatus[activity.status as keyof typeof activityStatus];
            return (
              <Link key={activity.id} href={`/activities/${activity.id}`} className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:border-brand-400 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-foreground">{activity.title}</h2>
                    <p className="mt-1 text-sm text-muted">{[activity.grade ? `${activity.grade}학년` : null, activity.subject, activity.domain].filter(Boolean).join(" · ") || "선택 메타데이터 없음"}</p>
                  </div>
                  <StatusBadge label={status.label} tone={status.tone} />
                </div>
                <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted">
                  <span>성취기준 {activity.activity_standards?.length ?? 0}개 · 학급 배정 {activity.activity_assignments?.length ?? 0}개</span>
                  <span className="font-mono">{activity.activity_code ?? "코드 미발급"}</span>
                </div>
              </Link>
            );
          })}
        </section>
      ) : (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="등록된 활동이 없어요" description="첫 활동을 초안으로 만들고 교사 확인 후 활성화해 주세요." ctaLabel="활동 만들기" ctaHref="/activities/new" />
      )}
    </div>
  );
}
