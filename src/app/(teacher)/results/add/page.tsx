import type { Metadata } from "next";
import Link from "next/link";
import { Upload, QrCode, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: "자료 추가" };

/**
 * 자료 추가 /results/add — 세 경로 (TRD §40)
 * Owner: INPUT (feat/input)
 */
const PATHS = [
  {
    href: "/results/upload",
    icon: Upload,
    title: "교사 이미지/PDF 업로드",
    desc: "모아둔 파일을 한 번에 올리거나 카메라로 연속 촬영해요.",
  },
  {
    href: "/results/add",
    icon: QrCode,
    title: "학생 직접 제출",
    desc: "QR·짧은 링크로 학생이 자기 기기에서 촬영해 제출해요.",
    todo: "TODO(INPUT): QRSharePanel 연결",
  },
  {
    href: "/results/import",
    icon: FileSpreadsheet,
    title: "CSV/XLSX 결과 가져오기",
    desc: "TRACE 표준 템플릿으로 작성한 결과를 가져와요.",
  },
];

export default function ResultsAddPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="자료 추가" description="학습자료를 넣는 방법을 선택하세요." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PATHS.map(({ href, icon: Icon, title, desc }) => (
          <Link
            key={title}
            href={href}
            className="group flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-base font-bold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
