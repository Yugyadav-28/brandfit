export default function ReviewLoading() {
  return (
    <div className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-48 bg-muted rounded-md" />
            <div className="h-5 w-24 bg-muted rounded-full" />
          </div>
          <div className="h-4 w-80 max-w-full bg-muted rounded" />
        </div>
        <div className="h-10 w-44 bg-muted rounded-lg" />
      </div>

      {/* Filter Tabs Skeleton */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-24 bg-muted rounded-lg shrink-0" />
        ))}
      </div>

      {/* Review Submissions Table Skeleton */}
      <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
        <div className="h-12 bg-muted/40 border-b flex items-center px-6">
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-5 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-48 bg-muted rounded" />
                  <div className="h-4 w-16 bg-muted rounded-full" />
                </div>
                <div className="h-3 w-64 bg-muted rounded" />
              </div>
              <div className="h-4 w-24 bg-muted rounded hidden sm:block" />
              <div className="h-9 w-20 bg-muted rounded-md shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
