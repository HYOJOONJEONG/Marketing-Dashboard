import React from "react"

type Props = {
  basis: "seed" | "latest" | "date"
  date: string
  historyDates: string[]
  onChange: (next: { basis: "seed" | "latest" | "date"; date: string }) => void
}

export function HistorySelector({ basis, date, historyDates, onChange }: Props) {
  const dateOptions = historyDates.length ? historyDates : []
  const selectValue = basis === "date" ? date || (dateOptions[0] ?? "") : basis

  return (
    <select
      value={selectValue}
      onChange={(event) => {
        const value = event.target.value
        if (value === "seed" || value === "latest") {
          onChange({ basis: value, date: "" })
        } else {
          onChange({ basis: "date", date: value })
        }
      }}
      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
    >
      <option value="seed">캡처기준</option>
      <option value="latest">최신 요약기준</option>
      {dateOptions.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}
