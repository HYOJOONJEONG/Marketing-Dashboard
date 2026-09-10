const optionStyles: Record<string, { short: string; color: string }> = {
  "해외채권": { short: "채권", color: "bg-sky-500 text-slate-950" },
  "해외지수": { short: "지수", color: "bg-indigo-500 text-white" },
  "해외종목": { short: "종목", color: "bg-emerald-500 text-slate-950" },
  LME: { short: "LME", color: "bg-amber-500 text-slate-950" },
  "전광판": { short: "전광", color: "bg-cyan-500 text-slate-950" },
  SOFR: { short: "SOFR", color: "bg-violet-500 text-white" },
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
            className={`inline-flex h-4 min-w-[30px] shrink-0 items-center justify-center whitespace-nowrap rounded-full px-1.5 text-[9px] font-semibold leading-none tracking-normal print:[print-color-adjust:exact] ${style?.color || "bg-slate-200 text-slate-900"}`}
          >
            {style?.short || label.slice(0, 2)}
          </span>
        )
      })}
    </span>
  )
}
