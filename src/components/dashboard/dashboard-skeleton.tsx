import { Skeleton } from "@/components/feedback/skeletons";

/** Mirrors the dashboard grid so nothing jumps when data arrives. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading your dashboard" className="grid gap-4 lg:grid-cols-12">
      <Skeleton className="h-44 rounded-stage lg:col-span-8" />
      <Skeleton className="hidden h-44 rounded-stage lg:col-span-4 lg:block" />
      <div className="flex gap-3 lg:col-span-12">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-28 flex-1 rounded-panel" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-stage lg:col-span-7" />
      <Skeleton className="h-80 rounded-stage lg:col-span-5" />
      <Skeleton className="h-64 rounded-stage lg:col-span-12" />
    </div>
  );
}
