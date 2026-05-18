import React, { useEffect, useMemo, useState } from "react"
import { OptionDetailTable } from "./OptionDetailTable"
import { SummaryCards } from "./SummaryCards"
import { useOptionDashboardData } from "../../hooks/use-option-dashboard-data"

const cardClass = "rounded-[20px] border border-slate-200 bg-white shadow-sm"

export function OptionDashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [basis, setBasis] = useState<"seed" | "latest" | "date">("seed")
  const [date, setDate] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("BOND")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")

  const { data, loading, detailLoading, error, isStale } = useOptionDashboardData({
    basis,
    date,
    refreshKey,
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
    }, 120)
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
    if (!data?.records || isStale) return []
    const searchTerm = search.trim().toLowerCase()
    return data.records
      .filter((row) => row.category_code !== "API")
      .filter((row) => categoryFilter === "all" || row.category_code === categoryFilter)
      .filter((row) => {
        if (!searchTerm) return true
        return `${row.company_name || ""} ${row.user_id || ""} ${row.department || ""}`.toLowerCase().includes(searchTerm)
      })
  }, [categoryFilter, data?.records, isStale, search])

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
    const response = await fetch("/api/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert", record }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `옵션 저장 실패 (${response.status})`)
    }
    setRefreshKey((prev) => prev + 1)
  }

  const handleDeleteRecord = async (recordId: string) => {
    const response = await fetch("/api/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", record_id: recordId }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `옵션 삭제 실패 (${response.status})`)
    }
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <div className="space-y-4" id="option-dashboard-section">
      <div className={`${cardClass} p-4`}>
        {loading && !data && <div className="mb-2 text-[12px] text-slate-500">옵션 현황 불러오는 중...</div>}
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

      <div className={`${cardClass} p-4`}>
        {detailLoading && !error ? (
          <div className="mb-2 text-[11.5px] font-semibold text-blue-600">목록 갱신 중...</div>
        ) : null}
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
