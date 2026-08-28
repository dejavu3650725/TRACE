import { TraceWordmark } from "@/components/shell/TraceWordmark";

/** Public, mobile-first Student Submit layout. It intentionally excludes TeacherAppShell. */
export default function StudentSubmitLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background px-5 py-8">
      <div className="flex justify-center">
        <TraceWordmark href="/" className="w-36" />
      </div>
      <div className="mt-8 flex-1 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        {children}
      </div>
    </main>
  );
}
