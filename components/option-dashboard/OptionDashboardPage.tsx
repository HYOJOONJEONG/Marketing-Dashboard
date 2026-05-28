import React, { useEffect, useMemo, useState } from "react"
import { OptionDetailTable } from "./OptionDetailTable"
import { SummaryCards } from "./SummaryCards"
import { useOptionDashboardData } from "../../hooks/use-option-dashboard-data"

const cardClass = "rounded-[20px] border border-slate-200 bg-white shadow-sm"
const idKindTabs = [
  { value: "contract", label: "계약 ID" },
  { value: "trial", label: "시험 ID" },
  { value: "free", label: "무료 ID" },
] as const

type OptionIdKind = (typeof idKindTabs)[number]["value"]

function normalizeOptionIdKind(value: unknown): OptionIdKind {
  const text = String(value ?? "").trim().toLowerCase()
  if (text === "trial" || text === "test" || text === "시험" || text === "테스트") return "trial"
  if (text === "free" || text === "무료" || text === "무상") return "free"
  return "contract"
}

export function OptionDashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [basis, setBasis] = useState<"seed" | "latest" | "date">("seed")
  const [date, setDate] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("BOND")
  const [idKind, setIdKind] = useState<OptionIdKind>("contract")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")

  const { data, loading, detailLoading, error } = useOptionDashboardData({
    basis,
    date,
    category: categoryFilter,
    search,
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
    if (!data?.records) return []
    const searchTerm = search.trim().toLowerCase()
    return data.records
      .filter((row) => row.category_code !== "API")
      .filter((row) => categoryFilter === "all" || row.category_code === categoryFilter)
      .filter((row) => normalizeOptionIdKind(row.id_kind) === idKind)
      .filter((row) => {
        if (!searchTerm) return true
        return `${row.company_name || ""} ${row.user_id || ""} ${row.department || ""}`.toLowerCase().includes(searchTerm)
      })
  }, [categoryFilter, data?.records, idKind, search])

  const idKindCounts = useMemo(() => {
    const counts: Record<OptionIdKind, number> = { contract: 0, trial: 0, free: 0 }
    ;(data?.records || [])
      .filter((row) => row.category_code !== "API")
      .filter((row) => categoryFilter === "all" || row.category_code === categoryFilter)
      .forEach((row) => {
        counts[normalizeOptionIdKind(row.id_kind)] += 1
      })
    return counts
  }, [categoryFilter, data?.records])

  const activeCategoryLabel = useMemo(() => {
    return cards.find((card) => card.category_code === categoryFilter)?.category_name_ko || "옵션"
  }, [cards, categoryFilter])

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
        <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2">
            <div className="text-[13px] font-bold text-slate-900">{activeCategoryLabel} ID 구분</div>
          </div>
          <div className="grid gap-1.5 md:grid-cols-3">
            {idKindTabs.map((tab) => {
              const isActive = idKind === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setIdKind(tab.value)}
                  className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3 text-left transition ${
                    isActive
                      ? "border-blue-300 bg-white text-slate-950 shadow-sm ring-1 ring-blue-100"
                      : "border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-white"
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block text-[13px] font-bold ${isActive ? "text-blue-700" : "text-slate-700"}`}>
                      {tab.label}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[12px] font-black tabular-nums text-slate-800">
                    {idKindCounts[tab.value]}건
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <OptionDetailTable
          records={records}
          categories={categories}
          search={searchInput}
          selectedCategoryCode={categoryFilter}
          idKind={idKind}
          onSearchChange={setSearchInput}
          onSaveRecord={handleSaveRecord}
          onDeleteRecord={handleDeleteRecord}
        />
      </div>
    </div>
  )
}
