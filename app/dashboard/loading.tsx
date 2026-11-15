export default function DashboardLoading() {
  return (
    <div className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-10 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-44 bg-muted rounded-md" />
            <div className="h-5 w-28 bg-muted rounded-full" />
          </div>
          <div className="h-4 w-96 max-w-full bg-muted rounded" />
        </div>
        <div className="h-10 w-40 bg-muted rounded-lg" />
      </div>

      {/* Overview Stat Cards Skeleton (5 cards) */}
      <section className="space-y-4">
        <div className="h-3.5 w-20 bg-muted rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-card border rounded-xl p-5 shadow-sm flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-6 w-10 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Waiting for Review Section Skeleton */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-44 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
          <div className="h-11 bg-muted/40 border-b" />
          <div className="divide-y divide-border">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 flex items-center justify-between gap-4">
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-4 w-28 bg-muted rounded hidden sm:block" />
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-4 w-12 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Activity Section Skeleton */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-36 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
          <div className="h-11 bg-muted/40 border-b" />
          <div className="divide-y divide-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 flex items-center justify-between gap-4">
                <div className="h-4 w-36 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-4 w-16 bg-muted rounded" />
                <div className="h-4 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
