import { Skeleton } from "@/components/ui/Skeleton";

/** Lightweight mobile loading state for the public student-submit route. */
export default function StudentSubmitLoading() {
  return (
    <div className="space-y-6" aria-label="제출 화면을 불러오는 중">
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
