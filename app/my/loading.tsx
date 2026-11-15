export default function MyPostsLoading() {
  return (
    <div className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-muted rounded-md" />
          <div className="h-4 w-72 max-w-full bg-muted rounded" />
        </div>
        <div className="h-10 w-44 bg-muted rounded-lg" />
      </div>

      {/* Filter Tabs Skeleton */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-24 bg-muted rounded-lg shrink-0" />
        ))}
      </div>

      {/* My Submissions Cards Skeleton */}
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="h-5 w-48 bg-muted rounded" />
                <div className="h-5 w-20 bg-muted rounded-full" />
              </div>
              <div className="h-4 w-28 bg-muted rounded" />
            </div>
            <div className="h-4 w-full max-w-md bg-muted rounded" />
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-8 w-24 bg-muted rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
