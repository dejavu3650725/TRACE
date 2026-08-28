"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { PrivacyContent, TermsContent } from "./LegalContent";

export type LegalModalType = "terms" | "privacy" | null;

/**
 * 이용약관 / 개인정보처리방침 모달 (LegalModal — TRD §50 Shell)
 * 본문은 LegalContent를 /terms, /privacy 페이지와 공유한다.
 * Portal로 body에 렌더링해 어떤 레이아웃에서도 잘리지 않는다.
 */
export function LegalModal({
  type,
  onClose,
}: {
  type: LegalModalType;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!type || !mounted) return null;

  const title = type === "terms" ? "이용약관" : "개인정보처리방침";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors duration-200 hover:bg-neutral-bg hover:text-foreground"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">
          {type === "terms" ? <TermsContent /> : <PrivacyContent />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
