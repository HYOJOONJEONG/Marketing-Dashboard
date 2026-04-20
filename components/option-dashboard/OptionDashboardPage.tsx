import React, { useEffect, useMemo, useState } from "react"
import { OptionDetailTable } from "./OptionDetailTable"
import { SummaryCards } from "./SummaryCards"
import { useOptionDashboardData } from "../../hooks/use-option-dashboard-data"

const cardClass = "rounded-[24px] border border-slate-200 bg-white shadow-sm"

export function OptionDashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [basis, setBasis] = useState<"seed" | "latest" | "date">("seed")
  const [date, setDate] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("BOND")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")

  const { data, loading, error } = useOptionDashboardData({
    basis,
    date,
    category: categoryFilter,
    search,
    refreshKey,
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
    }, 220)
    return () => clearTimeout(timer)
  }, [searchInput])

  const historyDates = data?.historyDates || []
  const cards = useMemo(() => {
    if (!data?.cards) return []
    return [...data.cards]
      .filter((card) => card.category_code !== "API")
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  }, [data?.cards])
  const categories = useMemo(() => {
    if (!data?.categories) return []
    return data.categories.filter((cat) => cat.category_code !== "API")
  }, [data?.categories])
  const records = useMemo(() => {
    if (!data?.records) return []
    return data.records.filter((row) => row.category_code !== "API")
  }, [data?.records])

  useEffect(() => {
    if (basis === "date" && !date && historyDates.length) {
      setDate(historyDates[0])
    }
  }, [basis, date, historyDates])

  useEffect(() => {
    if (!categories.length) return
    const hasCurrent = categories.some((cat) => cat.category_code === categoryFilter)
    if (hasCurrent) return
    const fallback = categories.find((cat) => cat.category_code === "BOND")?.category_code || categories[0].category_code
    setCategoryFilter(fallback)
  }, [categories, categoryFilter])

  const handleBasisChange = (next: { basis: "seed" | "latest" | "date"; date: string }) => {
    setBasis(next.basis)
    if (next.basis === "date") {
      setDate(next.date)
    } else {
      setDate("")
    }
  }

  const handleSaveRecord = async (record: any) => {
    await fetch("/api/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert", record }),
    })
    setRefreshKey((prev) => prev + 1)
  }

  const handleDeleteRecord = async (recordId: string) => {
    await fetch("/api/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", record_id: recordId }),
    })
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <div className="space-y-4" id="option-dashboard-section">
      <div className={`${cardClass} p-5`}>
        {loading && <div className="mb-2 text-[12px] text-slate-500">데이터 동기화 중...</div>}
        {error && <div className="text-[12px] text-rose-500">{error}</div>}
        {!error && (
          <SummaryCards
            cards={cards}
            activeCode={categoryFilter === "all" ? undefined : categoryFilter}
            onSelect={(code) => {
              setCategoryFilter(code)
            }}
          />
        )}
      </div>

      <div className={`${cardClass} p-5`}>
        <OptionDetailTable
          records={records}
          categories={categories}
          search={searchInput}
          selectedCategoryCode={categoryFilter}
          onSearchChange={setSearchInput}
          onSaveRecord={handleSaveRecord}
          onDeleteRecord={handleDeleteRecord}
        />
      </div>
    </div>
  )
}
