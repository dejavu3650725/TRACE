import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { ActivityForm } from "@/features/activities/ActivityForm";
import { AiActivityDraftPanel } from "@/features/activities/AiActivityDraftPanel";
import type { StandardOption } from "@/features/activities/actions";
import { requireSessionTeacher } from "@/lib/auth/teacher";

export const metadata: Metadata = { title: "활동 만들기" };

export default async function ActivityNewPage({
  searchParams,
}: {
  searchParams: Promise<{ "activity-error"?: string; "ai-save-error"?: string }>;
}) {
  const query = await searchParams;
  const { teacher, supabase } = await requireSessionTeacher();
  const { data: parents, error } = await supabase
    .from("activities")
    .select("id, title, status")
    .eq("teacher_id", teacher.id)
    .neq("status", "ARCHIVED")
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Parent Activity options lookup failed", { cause: error });

  const initialCandidates: StandardOption[] = [];

  return (
    <div className="space-y-6">
      <PageHeader title="활동 만들기" description="직접 입력하거나 AI 제안을 검토해 활동 초안으로 저장해요." />
      {query["activity-error"] === "invalid-parent" && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">이전 차시는 본인의 다른 활동만 선택할 수 있어요.</p>}
      {query["activity-error"] === "save-failed" && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">활동을 저장하지 못했어요. DB 마이그레이션과 입력값을 확인해 주세요.</p>}
      {query["activity-error"] === "invalid-input" && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">활동명과 입력값을 확인해 주세요.</p>}
      {query["ai-save-error"] && <p className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">AI 초안을 저장하지 못했어요. 수정한 입력값과 DB 마이그레이션을 확인해 주세요.</p>}
      <AiActivityDraftPanel parentOptions={parents ?? []} />
      <ActivityForm
        mode="create"
        activity={{ title: "", grade: null, subject: null, domain: null, unit: null, activity_type: null, description: null, parent_activity_id: null }}
        parentOptions={parents ?? []}
        initialCandidates={initialCandidates}
        initialSelected={[]}
      />
    </div>
  );
}
