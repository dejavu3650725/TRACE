import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "일괄 업로드" };

/**
 * Teacher Upload /results/upload (TRD §41)
 * Stepper: 1 파일 업로드 → 2 자료 정리 중 → 3 연결 정보 확인 → 4 저장 결과
 * ?mode=scan 이면 카메라 연속 촬영(Teacher Scan, AutoCapture §42 재사용)
 * Owner: INPUT (feat/input)
 */
export default async function ResultsUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const isScan = mode === "scan";

  return (
    <div className="space-y-6">
      <PageHeader
        title={isScan ? "카메라로 연속 촬영" : "일괄 업로드"}
        description={
          isScan
            ? "종이 활동지를 카메라 앞에 들면 자동으로 촬영돼요."
            : "이미지·PDF를 한 번에 올려요. 업로드 후 분석은 원하는 시점에 실행해요."
        }
      />
      {/* TODO(INPUT): UploadDropzone / AutoCaptureView + Stepper 구현 */}
      <EmptyState
        title={isScan ? "촬영 기능 준비 중" : "업로드 기능 준비 중"}
        description="INPUT 모듈(feat/input)에서 구현합니다."
      />
    </div>
  );
}
