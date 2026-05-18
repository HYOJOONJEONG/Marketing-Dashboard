import React from "react"
import { OptionCategory } from "../../hooks/use-option-dashboard-data"

type Props = {
  cards: OptionCategory[]
  activeCode?: string
  onSelect?: (code: string) => void
}

const accentByCode: Record<string, string> = {
  BOND: "bg-sky-500",
  INDEX: "bg-indigo-500",
  STOCK: "bg-emerald-500",
  LME: "bg-amber-500",
  SIGNAGE: "bg-cyan-500",
  SOFR: "bg-violet-500",
}

export function SummaryCards({ cards, activeCode, onSelect }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
      <div className="grid gap-1.5 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const isActive = activeCode === card.category_code
        const accentClass = accentByCode[card.category_code] || "bg-slate-400"
        return (
          <button
            type="button"
            key={card.category_code}
            onClick={() => onSelect?.(card.category_code)}
            className={`group flex h-14 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left transition ${
              isActive
                ? "border-blue-300 bg-white text-slate-950 shadow-sm ring-1 ring-blue-100"
                : "border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-white"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${accentClass}`} />
              <span className={`truncate text-[13px] font-semibold ${isActive ? "text-blue-700" : "text-slate-600"}`}>
                {card.category_name_ko}
              </span>
            </span>
            <span className="flex shrink-0 items-baseline gap-1 tabular-nums">
              <span className={`text-[20px] font-black leading-none ${isActive ? "text-slate-950" : "text-slate-800"}`}>
                {card.count_value ?? 0}
              </span>
              <span className="text-[11px] font-bold text-slate-400">건</span>
            </span>
          </button>
        )
      })}
      </div>
    </div>
  )
}
