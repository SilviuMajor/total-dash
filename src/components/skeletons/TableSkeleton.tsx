import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton() {
  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="grid grid-cols-4 gap-4 px-4 py-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      {/* Body rows */}
      {[...Array(5)].map((_, row) => (
        <div key={row} className="grid grid-cols-4 gap-4 px-4 py-3 border-t border-border">
          {[...Array(4)].map((_, col) => (
            <Skeleton key={col} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
