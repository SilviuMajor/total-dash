import { Skeleton } from "@/components/ui/skeleton";

export function ConversationsSkeleton() {
  return (
    <div className="grid grid-cols-12 h-full">
      {/* Left: conversation list */}
      <div className="col-span-3 border-r border-border p-4 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>

      {/* Center: message bubbles */}
      <div className="col-span-6 border-r border-border p-4 space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
            <Skeleton className="h-10 w-2/3 rounded-2xl" />
          </div>
        ))}
      </div>

      {/* Right: detail fields */}
      <div className="col-span-3 p-4 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
