import React from "react"
import { OptionCategory } from "../../hooks/use-option-dashboard-data"

type Props = {
  cards: OptionCategory[]
  activeCode?: string
  onSelect?: (code: string) => void
}

export function SummaryCards({ cards, activeCode, onSelect }: Props) {
  return (
    <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => {
        const isActive = activeCode === card.category_code
        return (
          <button
            type="button"
            key={card.category_code}
            onClick={() => onSelect?.(card.category_code)}
            className={`flex min-h-[82px] w-full flex-col justify-center rounded-xl border px-3 text-center transition ${
              isActive
                ? "border-blue-300 bg-blue-50 text-blue-900 shadow-sm"
                : "border-slate-200 bg-slate-50 text-slate-900 hover:border-blue-200"
            }`}
          >
            <span className={`text-[13px] font-semibold ${isActive ? "text-blue-700" : "text-slate-600"}`}>
              {card.category_name_ko}
            </span>
            <span className={`mt-2 text-[22px] font-bold ${isActive ? "text-blue-900" : "text-slate-900"}`}>
              {card.count_value ?? 0}
            </span>
          </button>
        )
      })}
    </div>
  )
}
