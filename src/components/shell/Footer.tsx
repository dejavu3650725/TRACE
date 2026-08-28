"use client";

import { useState } from "react";
import { LegalModal, type LegalModalType } from "./LegalModal";

/**
 * 공통 Footer — 중앙 정렬 심플 디자인.
 * 이용약관 / 개인정보처리방침 클릭 시 각각의 모달이 열린다.
 */
export function Footer() {
  const [modal, setModal] = useState<LegalModalType>(null);

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 py-6 text-center">
        <div className="flex items-center gap-4 text-sm font-medium text-muted">
          <button
            type="button"
            onClick={() => setModal("terms")}
            className="transition-colors duration-200 hover:text-foreground"
          >
            이용약관
          </button>
          <span className="h-3 w-px bg-line" aria-hidden />
          <button
            type="button"
            onClick={() => setModal("privacy")}
            className="font-semibold transition-colors duration-200 hover:text-foreground"
          >
            개인정보처리방침
          </button>
        </div>
        <p className="text-xs text-muted">정보관리책임자: PROCESS 101</p>
        <p className="text-xs text-muted">© 2026 서울특별시교육청. All rights reserved.</p>
      </div>

      <LegalModal type={modal} onClose={() => setModal(null)} />
    </footer>
  );
}
