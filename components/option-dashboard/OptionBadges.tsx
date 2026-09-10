const optionStyles: Record<string, { color: string }> = {
  "해외채권": { color: "bg-sky-100 text-sky-800" },
  "해외지수": { color: "bg-indigo-100 text-indigo-800" },
  "해외종목": { color: "bg-emerald-100 text-emerald-800" },
  LME: { color: "bg-amber-100 text-amber-800" },
  "전광판": { color: "bg-cyan-100 text-cyan-800" },
  SOFR: { color: "bg-violet-100 text-violet-800" },
}

export function OptionBadges({ labels }: { labels: string[] }) {
  if (!labels.length) return null
  return (
    <span className="ml-1 inline-flex max-w-full flex-wrap items-center justify-center gap-0.5 align-middle">
      {[...new Set(labels)].filter(Boolean).map((label) => {
        const style = optionStyles[label]
        return (
          <span
            key={label}
            title={label}
            aria-label={label}
            className={`inline-flex h-4 min-w-[30px] shrink-0 items-center justify-center whitespace-nowrap rounded-full px-1.5 text-[9px] font-semibold leading-none tracking-normal print:[print-color-adjust:exact] ${style?.color || "bg-slate-100 text-slate-800"}`}
          >
            {label}
          </span>
        )
      })}
    </span>
  )
}
