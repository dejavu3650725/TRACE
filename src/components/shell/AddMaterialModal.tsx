"use client";

import { useRouter } from "next/navigation";
import { X, Upload, Camera, QrCode, Users, UserRound } from "lucide-react";

/**
 * 전역 [+ 학습자료 추가] Modal (TRD §33.1)
 * ├─ 교사 일괄 업로드 → [일괄 업로드 시작] → /results/upload
 * │                   → [카메라로 연속 촬영] → /results/upload?mode=scan
 * └─ 학생 직접 제출   → [제출 링크 만들기] → QRSharePanel(INPUT 모듈 구현)
 * 좌우 2분할 동일 비중. CSV/XLSX Import는 이 Modal에 노출하지 않는다.
 */
export function AddMaterialModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  if (!open) return null;

  const go = (path: string) => {
    onClose();
    router.push(path);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-surface p-6 shadow-2xl duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-label="학습자료 추가"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">학습자료 추가</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-neutral-bg hover:text-foreground"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 교사 일괄 업로드 */}
          <section className="flex flex-col rounded-2xl border border-line p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-base font-bold text-foreground">교사 일괄 업로드</h3>
            <p className="mt-1 flex-1 text-sm text-muted">
              모아둔 활동지 이미지·PDF를 한 번에 올리거나, 카메라로 종이 활동지를
              연속 촬영해요.
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => go("/results/upload")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-700"
              >
                <Upload className="h-4 w-4" />
                일괄 업로드 시작
              </button>
              <button
                type="button"
                onClick={() => go("/results/upload?mode=scan")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:bg-neutral-bg"
              >
                <Camera className="h-4 w-4" />
                카메라로 연속 촬영
              </button>
            </div>
          </section>

          {/* 학생 직접 제출 */}
          <section className="flex flex-col rounded-2xl border border-line p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <UserRound className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-base font-bold text-foreground">학생 직접 제출</h3>
            <p className="mt-1 flex-1 text-sm text-muted">
              QR·짧은 링크를 학생에게 보여주고, 학생이 자기 기기로 촬영해 제출해요.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => go("/results/add")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-700"
              >
                <QrCode className="h-4 w-4" />
                제출 링크 만들기
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
