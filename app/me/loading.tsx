const cardClass = "rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]"

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />
}

export default function MyPageLoading() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eef6ff_0%,#f8fbff_36%,#f3f6fb_100%)] px-3 py-3 sm:px-4">
      <div className="mx-auto max-w-[1680px] space-y-4">
        <section className={`${cardClass} p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SkeletonBlock className="h-12 w-12 rounded-full" />
              <div className="min-w-[240px] space-y-2">
                <SkeletonBlock className="h-5 w-32" />
                <SkeletonBlock className="h-4 w-56" />
              </div>
            </div>
            <div className="flex gap-2">
              <SkeletonBlock className="h-10 w-32" />
              <SkeletonBlock className="h-10 w-32" />
              <SkeletonBlock className="h-10 w-28" />
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <section key={item} className={cardClass}>
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="mt-5 h-8 w-16" />
            </section>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className={cardClass}>
            <SkeletonBlock className="h-5 w-36" />
            <div className="mt-4 space-y-3">
              {[0, 1, 2, 3].map((item) => (
                <SkeletonBlock key={item} className="h-12 w-full" />
              ))}
            </div>
          </section>
          <section className={cardClass}>
            <SkeletonBlock className="h-5 w-40" />
            <div className="mt-4 space-y-2">
              {[0, 1, 2, 3, 4].map((item) => (
                <SkeletonBlock key={item} className="h-10 w-full" />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
