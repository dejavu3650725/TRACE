import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "결과 가져오기" };

/**
 * CSV/XLSX Result Import (TRD §21 Result Spreadsheet)
 * Template 다운로드 → 업로드 → Validation → Preview → Roster Match → 저장
 * Owner: INPUT (feat/input)
 */
export default function ResultsImportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="결과 가져오기"
        description="TRACE 표준 CSV/XLSX 템플릿으로 작성한 결과를 가져와요."
      />
      <EmptyState
        title="가져오기 기능 준비 중"
        description="INPUT 모듈(feat/input)에서 구현합니다."
      />
    </div>
  );
}
