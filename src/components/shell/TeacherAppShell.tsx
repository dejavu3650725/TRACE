import { Footer } from "./Footer";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * 모든 보호된 Teacher Route가 사용하는 공통 App Shell (TRD §32).
 * 각 모듈이 별도의 Shell을 만들지 않는다.
 * displayName은 공통 규칙(shared/displayName.ts)으로 만든 개인화 이름이다.
 */
export function TeacherAppShell({
  displayName = "선생님",
  reviewPendingCount,
  children,
}: {
  displayName?: string;
  reviewPendingCount?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar displayName={displayName} reviewPendingCount={reviewPendingCount} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
