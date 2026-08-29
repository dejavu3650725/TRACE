"use client";

import { useFormStatus } from "react-dom";
import { CheckCheck } from "lucide-react";
import { approveBatchAnalyses } from "@/app/(teacher)/analysis/actions";

function SubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
    >
      <CheckCheck className="h-4 w-4" />
      {pending ? "승인 중..." : `${count}건 일괄 승인`}
    </button>
  );
}

export function BatchApproveButton({
  activityAssignmentId,
  count,
}: {
  activityAssignmentId: string;
  count: number;
}) {
  return (
    <form
      action={approveBatchAnalyses}
      onSubmit={(event) => {
        if (!window.confirm(`이 활동의 AI 분석 ${count}건을 한 번에 승인할까요?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="activity_assignment_id" value={activityAssignmentId} />
      <SubmitButton count={count} />
    </form>
  );
}
