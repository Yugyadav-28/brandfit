export default function InsightsLoading() {
  return (
    <div className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-56 bg-muted rounded-md" />
            <div className="h-5 w-28 bg-muted rounded-full" />
          </div>
          <div className="h-4 w-96 max-w-full bg-muted rounded" />
        </div>
        <div className="h-10 w-64 bg-muted rounded-lg" />
      </div>

      {/* 4 Stat Highlights Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border rounded-xl p-4 shadow-sm space-y-2">
            <div className="h-3 w-28 bg-muted rounded" />
            <div className="h-7 w-16 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* 4 Chart Cards Skeleton (2x2 Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-6 w-44 bg-muted rounded" />
              <div className="h-8 w-24 bg-muted rounded-md" />
            </div>
            <div className="h-4 w-72 max-w-full bg-muted rounded" />
            <div className="h-64 w-full bg-muted/40 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
