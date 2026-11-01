import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-control", className)} />;
}

export function FormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="Loading form">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
      <Skeleton className="mt-1 h-13 w-full" />
    </div>
  );
}

/** Mirrors the app page header + content grid so navigation doesn't jump. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40 rounded-panel md:col-span-2" />
        <Skeleton className="h-40 rounded-panel" />
      </div>
    </div>
  );
}
