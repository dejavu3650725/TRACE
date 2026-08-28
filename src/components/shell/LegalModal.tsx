"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type LegalModalType = "terms" | "privacy" | null;

/** 조항 블록 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

function TermsContent() {
  return (
    <>
      <Section title="제1조 (목적)">
        <p>
          이 약관은 TRACE(이하 &ldquo;서비스&rdquo;)의 이용과 관련하여 운영자와 사용자 간의
          권리, 의무 및 책임사항을 규정함을 목적으로 합니다. TRACE는 학생의 학습결과를
          구조화하고 누적 분석하는 교사용 학습 성장 지원 시스템입니다.
        </p>
      </Section>
      <Section title="제2조 (용어의 정의)">
        <p>1. &ldquo;서비스&rdquo;란 학생의 학습결과를 입력·구조화·분석하여 성장 리포트로 제공하는 TRACE 웹 서비스를 말합니다.</p>
        <p>2. &ldquo;사용자&rdquo;란 이 약관에 동의하고 서비스를 이용하는 교사를 말합니다.</p>
        <p>3. &ldquo;학습자료&rdquo;란 사용자가 서비스에 입력하는 학생의 활동지, 이미지, PDF, 스프레드시트 등 결과물을 말합니다.</p>
        <p>4. &ldquo;운영자&rdquo;란 서비스를 관리·운영하는 PROCESS 101을 말합니다.</p>
      </Section>
      <Section title="제3조 (약관의 효력 및 변경)">
        <p>1. 이 약관은 서비스 화면에 게시함으로써 효력이 발생합니다.</p>
        <p>2. 운영자는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지 후 적용됩니다. 변경에 동의하지 않는 사용자는 서비스 이용을 중단할 수 있습니다.</p>
      </Section>
      <Section title="제4조 (서비스의 제공 및 변경)">
        <p>1. 서비스는 교육적 목적을 위해 무상으로 제공됩니다.</p>
        <p>2. 운영자는 서비스의 내용, 기능, 운영 시간을 필요에 따라 변경하거나 중단할 수 있으며, 중요한 변경은 사전에 안내합니다.</p>
      </Section>
      <Section title="제5조 (사용자의 의무)">
        <p>1. 사용자는 서비스를 해킹, 무단 접근, 비정상적 방법으로 이용해서는 안 됩니다.</p>
        <p>2. 사용자는 서비스와 그 결과물을 상업적 목적으로 무단 도용할 수 없습니다.</p>
        <p>3. 사용자는 자신이 입력하는 학습자료에 대해 정당한 권한을 보유해야 하며, 관련 법령과 소속 기관의 지침을 준수해야 합니다.</p>
      </Section>
      <Section title="제6조 (저작권 및 지적재산권)">
        <p>1. 서비스(시스템, 화면, 소스코드 등)에 대한 저작권 및 지적재산권은 운영자에게 있습니다.</p>
        <p>2. 사용자가 입력한 학습자료에 대한 1차적 권리와 관리 책임은 해당 자료를 입력한 사용자에게 있습니다.</p>
      </Section>
      <Section title="제7조 (면책 조항)">
        <p>1. 운영자는 천재지변, 시스템 장애 등 불가항력으로 인한 서비스 중단에 대해 책임을 지지 않습니다.</p>
        <p>2. AI가 생성한 분석 결과는 교사의 검토·승인을 보조하는 참고 자료이며, 교육적 판단의 최종 책임은 이를 승인한 사용자에게 있습니다.</p>
        <p>3. 해커톤 테스트 기간 중 제공되는 서비스의 완전성·정확성은 보장되지 않습니다.</p>
      </Section>
      <Section title="부칙">
        <p>이 약관은 2026년 8월 29일부터 시행합니다.</p>
      </Section>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <Section title="1. 개인정보의 처리 목적">
        <p>
          TRACE는 서비스 제공 및 운영을 위해 최소한의 개인정보를 처리합니다. 처리 목적은
          학생 학습 결과의 AI 구조화, 누적 분석, 성장 리포트 제공, 교사용 대시보드 운영입니다.
        </p>
      </Section>
      <Section title="2. 수집하는 개인정보 항목">
        <p>1. 교사: 구글 계정 정보(OAuth 인증 시 이름, 이메일)</p>
        <p>2. 학생: 이름 및 번호(학급 명단), 제출 결과물(이미지, PDF 등 학습자료)</p>
        <p>학생은 별도의 회원가입 없이 학급 코드와 번호/이름만으로 제출에 참여하며, 계정·비밀번호를 만들지 않습니다.</p>
      </Section>
      <Section title="3. 개인정보의 보유 및 이용 기간">
        <p>
          수집된 개인정보는 테스트 기간 만료 혹은 서비스 종료 시 지체 없이 파기합니다.
        </p>
      </Section>
      <Section title="4. TRACE 프라이버시 설계 (Privacy by Design)">
        <p>1. 외부 AI 모델(VLM)로 데이터를 전송할 때 학생의 이름, 번호 등 직접 식별 정보를 제거합니다.</p>
        <p>2. 원본 자료는 비공개 저장소에 보관하며, 조회 시에만 짧은 만료 시간의 서명 URL을 사용합니다.</p>
        <p>3. QR·제출 링크에는 학생의 개인정보를 포함하지 않습니다.</p>
      </Section>
      <Section title="5. 개인정보 보호책임자">
        <p>정보관리책임자: PROCESS 101</p>
        <p>개인정보 처리에 관한 문의는 서비스 내 안내 채널을 통해 접수할 수 있습니다.</p>
      </Section>
      <Section title="부칙">
        <p>이 방침은 2026년 8월 29일부터 시행합니다.</p>
      </Section>
    </>
  );
}

/**
 * 이용약관 / 개인정보처리방침 모달 (LegalModal — TRD §50 Shell)
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
