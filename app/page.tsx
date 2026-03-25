"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"

type ViewKey = "weekly-report" | "contracts" | "weekly-selection" | "manual-input" | "collection" | "termination"
type SortState = { key: string; dir: "asc" | "desc" }

const INDUSTRIES = ["국내증권", "국내은행", "외국계", "자산운용", "보험", "일반기업", "공사/정부", "연기금", "기타금융"]

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function normalizeDate(value: string) {
  const digits = String(value || "").replace(/[^\d]/g, "")
  if (digits.length === 8) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
  if (digits.length === 6) return `20${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}`
  return value || ""
}

function toInputDate(value: string) {
  return normalizeDate(value).replace(/\./g, "-")
}

function dateNumber(value: string) {
  const digits = String(value || "").replace(/[^\d]/g, "")
  if (digits.length === 8) return Number(digits)
  if (digits.length === 6) return Number(`20${digits}`)
  return 0
}

function monthNumber(value: string) {
  const digits = String(value || "").replace(/[^\d]/g, "")
  return digits ? Number(digits) : 0
}

function compareValue(left: any, right: any, key: string) {
  if (key.toLowerCase().includes("date")) return dateNumber(left) - dateNumber(right)
  if (key.toLowerCase().includes("month")) return monthNumber(left) - monthNumber(right)
  if (typeof left === "number" || typeof right === "number") return Number(left || 0) - Number(right || 0)
  return String(left || "").localeCompare(String(right || ""), "ko", { numeric: true })
}

function sortRows<T extends Record<string, any>>(rows: T[], sort: SortState) {
  return [...rows].sort((a, b) => {
    const result = compareValue(a[sort.key], b[sort.key], sort.key)
    return sort.dir === "asc" ? result : -result
  })
}

function money(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value || 0)
}

function metric(value: number) {
  return `${value || 0}대`
}

function today() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}.${m}.${d}`
}

function autoRevenue(summary: any) {
  return `주간 순증 매출 (약 ${money((summary.weeklyNetUnits || 0) * 6160000)}원)`
}

function esc(text: string) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function openPrint(title: string, html: string) {
  const popup = window.open("", "_blank", "width=1200,height=900")
  if (!popup) return
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
  popup.document.title = title
  popup.onload = () => popup.print()
}

function weeklyReportHtml(state: any) {
  const report = state.weeklyReport
  const included = state.contracts.filter((row: any) => row.includedInWeekly)
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
  <title>주간실적보고 ${state.weeklyReport.baseDate.replaceAll("-", "").slice(2)}</title>
  <style>
    body{font-family:"Malgun Gothic",sans-serif;margin:24px;color:#0f172a}
    .top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
    .title{font-size:30px;font-weight:800}
    table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:14px}
    th,td{border:1px solid #cbd5e1;padding:6px 8px;font-size:12px;text-align:center}
    th{background:#e8f0fb}.note{font-size:12px;color:#475569}
  </style></head><body>
  <div class="top"><div class="title">주간실적보고</div><div>기준일 ${esc(report.baseDate)}</div></div>
  <table><thead><tr><th>회사명</th><th>부서</th><th>아이디</th><th>업종</th><th>계약월</th><th>계약서 회수</th><th>미회수</th></tr></thead>
  <tbody>${included.map((row: any) => `<tr><td>${esc(row.companyName)}</td><td>${esc(row.departmentName)}</td><td>${esc(row.idCode)}</td><td>${esc(row.industry)}</td><td>${esc(row.contractMonth)}</td><td>${row.documentStatus === "회수" ? "○" : ""}</td><td>${row.documentStatus !== "회수" ? "○" : ""}</td></tr>`).join("")}</tbody></table>
  <div class="note">${esc(report.revenueHeaderText)} / ${esc(report.subtitleOne)} / ${esc(report.subtitleTwo)}</div>
  </body></html>`
}

function collectionHtml(state: any, rows: any[]) {
  const groups = [2026, 2025, 2024, 2022]
    .map((year) => ({
      year,
      all: rows.filter((row) => row.year === year),
      missing: rows.filter((row) => row.year === year && row.status === "미회수"),
    }))
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
  <title>계약서미회수현황 ${state.weeklyReport.baseDate.replaceAll("-", "").slice(2)}</title>
  <style>
  body{font-family:"Malgun Gothic",sans-serif;margin:24px;color:#111827}
  .title{font-size:28px;font-weight:800;margin-bottom:4px}.meta{text-align:right;font-size:14px;color:#475569;margin-bottom:14px}
  .block{margin-bottom:18px}.head{font-size:14px;font-weight:700;margin-bottom:6px}
  table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #d1d5db;padding:6px 8px;font-size:12px;text-align:center}th{background:#eef4ff}
  </style></head><body>
  <div class="title">계약서 미회수 현황</div><div class="meta">기준일 ${esc(state.weeklyReport.baseDate)}</div>
  ${groups.map((group) => `<section class="block"><div class="head">${String(group.year).slice(2)}년 총 ${group.all.length}건 중 ${group.missing.length}건 미회수</div><table><thead><tr><th>No.</th><th>회사명</th><th>부서명</th><th>ID</th><th>업종</th><th>청구월</th></tr></thead><tbody>${group.missing.length ? group.missing.map((row, index) => `<tr><td>${index + 1}</td><td>${esc(row.companyName)}</td><td>${esc(row.departmentName)}</td><td>${esc(row.idCode)}</td><td>${esc(row.industry)}</td><td>${esc(row.claimMonth)}</td></tr>`).join("") : `<tr><td colspan="6">미회수 데이터 없음</td></tr>`}</tbody></table></section>`).join("")}
  </body></html>`
}

export default function Page() {
  const [state, setState] = useState<any>(null)
  const [view, setView] = useState<ViewKey>("weekly-report")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [undoStack, setUndoStack] = useState<any[]>([])
  const [sorts, setSorts] = useState<Record<string, SortState>>({
    collection: { key: "claimMonth", dir: "desc" },
    termination: { key: "receivedDate", dir: "desc" },
    hold: { key: "receivedDate", dir: "desc" },
  })
  const [openSections, setOpenSections] = useState({ performance: true, termination: true })
  const [collectionEditId, setCollectionEditId] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" })
        const data = await response.json()
        setState(syncState(data))
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "데이터를 불러오지 못했습니다.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function syncState(input: any) {
    const next = clone(input)
    next.weeklyReport.revenueHeaderText = next.weeklyReport.revenueHeaderText || autoRevenue(next.weeklyReport.manualSummary)
    next.contracts = (next.contracts || []).map((row: any) => ({
      ...row,
      documentStatus: row.documentStatus || "미정",
      includedInWeekly: Boolean(row.includedInWeekly),
    }))
    next.termination.sheets = (next.termination.sheets || []).map((sheet: any) => ({
      ...sheet,
      items: (sheet.items || []).map((row: any, index: number) => ({ ...row, no: index + 1, receivedDate: normalizeDate(row.receivedDate), terminationDate: normalizeDate(row.terminationDate) })),
      holdItems: (sheet.holdItems || []).map((row: any, index: number) => ({ ...row, no: index + 1, receivedDate: normalizeDate(row.receivedDate), startDate: normalizeDate(row.startDate), endDate: normalizeDate(row.endDate) })),
    }))
    return next
  }

  async function persist(next: any) {
    await fetch("/api/dashboard", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
  }

  async function commit(updater: (draft: any) => void, after?: (next: any) => void) {
    if (!state) return
    const previous = clone(state)
    const next = clone(state)
    updater(next)
    const synced = syncState(next)
    setUndoStack((current) => [...current, previous])
    setState(synced)
    await persist(synced)
    if (after) after(synced)
  }

  async function undo() {
    const latest = undoStack[undoStack.length - 1]
    if (!latest) return
    setUndoStack((current) => current.slice(0, -1))
    setState(latest)
    await persist(latest)
  }

  const currentSheet = useMemo(() => {
    if (!state) return null
    return state.termination.sheets.find((sheet: any) => sheet.id === state.termination.currentSheetId) || state.termination.sheets[0]
  }, [state])

  const selectedContracts = useMemo(() => (state?.contracts || []).filter((row: any) => row.includedInWeekly), [state])
  const activeCollectionRows = useMemo(() => {
    if (!state) return []
    return state.collection.tab === "integrated" ? state.collection.integrated : state.collection.longTerm
  }, [state])
  const filteredCollectionRows = useMemo(() => {
    if (!state) return []
    return activeCollectionRows.filter((row: any) => (state.collection.yearFilter === "all" || row.year === state.collection.yearFilter) && (state.collection.statusFilter === "all" || row.status === state.collection.statusFilter))
  }, [activeCollectionRows, state])
  const sortedCollectionRows = useMemo(() => sortRows(filteredCollectionRows, sorts.collection), [filteredCollectionRows, sorts.collection])
  const terminationRows = useMemo(() => sortRows(currentSheet?.items || [], sorts.termination), [currentSheet, sorts.termination])
  const holdRows = useMemo(() => sortRows(currentSheet?.holdItems || [], sorts.hold), [currentSheet, sorts.hold])

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">로딩 중...</div>
  if (error || !state) return <div className="flex min-h-screen items-center justify-center p-8"><div className="rounded-2xl border border-rose-200 bg-white px-6 py-5 text-sm text-rose-600">화면 로드 오류<div className="mt-2 text-slate-500">{error || "데이터가 없습니다."}</div></div></div>

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1720px]">
        <aside className="w-[248px] border-r border-slate-200 bg-white px-4 py-5">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Marketing Division</div>
            <div className="mt-3 text-[18px] font-extrabold leading-tight tracking-[-0.04em]">정보사업본부 통합 대시보드</div>
            <div className="mt-3 h-1.5 w-10 rounded-full bg-blue-500" />
          </div>

          <div className="mt-8 space-y-6">
            <NavSection title="실적 관리" open={openSections.performance} onToggle={() => setOpenSections((current) => ({ ...current, performance: !current.performance }))}>
              <NavButton active={view === "weekly-report"} onClick={() => setView("weekly-report")}>주간실적보고</NavButton>
              <NavButton active={view === "contracts"} onClick={() => setView("contracts")}>신규계약 리스트</NavButton>
              <NavButton active={view === "weekly-selection"} onClick={() => setView("weekly-selection")}>주간 반영 리스트</NavButton>
              <NavButton active={view === "manual-input"} onClick={() => setView("manual-input")}>수동 입력 리스트</NavButton>
              <NavButton active={view === "collection"} onClick={() => setView("collection")}>계약서통합관리</NavButton>
            </NavSection>

            <NavSection title="해지 관리" open={openSections.termination} onToggle={() => setOpenSections((current) => ({ ...current, termination: !current.termination }))}>
              <NavButton active={view === "termination"} onClick={() => setView("termination")}>해지 진행사항</NavButton>
            </NavSection>
          </div>

          <div className="mt-10">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Excel</div>
            <div className="mt-3 space-y-3">
              <ExcelButton tone="emerald" label="엑셀 백업" action="export" />
              <ExcelButton tone="blue" label="엑셀 복구" action="import" />
            </div>
          </div>
        </aside>

        <main className="flex-1 px-5 py-5">
          <div className="sticky top-0 z-20 mb-5 rounded-[28px] border border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-500">기준일 {state.weeklyReport.baseDate}</div>
                <h1 className="mt-2 text-[26px] font-extrabold tracking-[-0.04em]">{({
                  "weekly-report": "주간실적보고",
                  contracts: "신규계약 리스트",
                  "weekly-selection": "주간 반영 리스트",
                  "manual-input": "수동 입력 리스트",
                  collection: "계약서통합관리",
                  termination: "해지 진행사항",
                } as Record<ViewKey, string>)[view]}</h1>
              </div>
              <div className="flex items-center gap-3">
                <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold" value={state.currentYear} onChange={(event) => commit((draft) => { draft.currentYear = Number(event.target.value) })}>
                  {state.availableYears.map((year: number) => <option key={year} value={year}>{year}년</option>)}
                </select>
                <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" onClick={undo}>직전 작업 실행취소</button>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {view === "weekly-report" && <WeeklyReportView state={state} selectedContracts={selectedContracts} onPrint={() => openPrint(`주간실적보고 ${state.weeklyReport.baseDate.replaceAll("-", "").slice(2)}`, weeklyReportHtml(state))} />}
            {view === "contracts" && <ContractsView contracts={state.contracts} onChange={(nextContracts) => commit((draft) => { draft.contracts = nextContracts })} />}
            {view === "weekly-selection" && <WeeklySelectionView contracts={state.contracts} onToggle={(id) => commit((draft) => { draft.contracts = draft.contracts.map((item: any) => item.id === id ? { ...item, includedInWeekly: !item.includedInWeekly } : item) })} onMoveToCollection={() => {
              const selected = state.contracts.filter((item: any) => item.includedInWeekly)
              if (!selected.length) return
              if (!window.confirm("신규 계약 리스트에서 삭제가 됩니다.")) return
              commit((draft) => {
                const moved = selected.map((item: any) => ({
                  id: `moved-${item.id}`,
                  year: draft.currentYear,
                  companyName: item.companyName,
                  departmentName: item.departmentName,
                  idCode: item.idCode,
                  industry: item.industry,
                  claimMonth: normalizeDate(draft.weeklyReport.baseDate).slice(0, 7),
                  status: item.documentStatus,
                  receiptDate: item.documentStatus === "회수" ? today() : "",
                  reportDate: draft.weeklyReport.baseDate,
                }))
                draft.collection.integrated = [...moved, ...draft.collection.integrated]
                draft.contracts = draft.contracts.filter((item: any) => !item.includedInWeekly)
              }, () => setView("collection"))
            }} />}
            {view === "manual-input" && <ManualInputView draft={{
              revenueHeaderText: state.weeklyReport.revenueHeaderText,
              subtitleOne: state.weeklyReport.subtitleOne,
              subtitleTwo: state.weeklyReport.subtitleTwo,
              manualSummary: state.weeklyReport.manualSummary,
              additionalSales: state.weeklyReport.additionalSales,
            }} onChange={(draft) => setState((current: any) => {
              if (!current) return current
              const next = clone(current)
              next.weeklyReport.revenueHeaderText = draft.revenueHeaderText
              next.weeklyReport.subtitleOne = draft.subtitleOne
              next.weeklyReport.subtitleTwo = draft.subtitleTwo
              next.weeklyReport.manualSummary = draft.manualSummary
              next.weeklyReport.additionalSales = draft.additionalSales
              return next
            })} onUpdate={async () => {
              const next = syncState(state)
              setState(next)
              await persist(next)
              setView("weekly-report")
            }} />}
            {view === "collection" && <CollectionView state={state} rows={sortedCollectionRows} editId={collectionEditId} onEdit={setCollectionEditId} onSort={(key) => setSorts((current) => ({ ...current, collection: current.collection.key === key ? { key, dir: current.collection.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" } }))} onTabChange={(tab) => commit((draft) => { draft.collection.tab = tab; draft.collection.yearFilter = 2026; draft.collection.statusFilter = "all" })} onYearFilter={(year) => commit((draft) => { draft.collection.yearFilter = year })} onStatusFilter={(status) => commit((draft) => { draft.collection.statusFilter = status })} onRowChange={(rowId, updater) => commit((draft) => {
              const bucket = draft.collection.tab === "integrated" ? draft.collection.integrated : draft.collection.longTerm
              const target = bucket.find((item: any) => item.id === rowId)
              if (!target) return
              updater(target)
              if (target.status === "회수" && !target.receiptDate) target.receiptDate = today()
              if (target.status !== "회수") target.receiptDate = ""
            })} onDelete={(rowId) => commit((draft) => {
              if (draft.collection.tab === "integrated") draft.collection.integrated = draft.collection.integrated.filter((item: any) => item.id !== rowId)
              else draft.collection.longTerm = draft.collection.longTerm.filter((item: any) => item.id !== rowId)
            })} onPrint={() => openPrint(`계약서미회수현황 ${state.weeklyReport.baseDate.replaceAll("-", "").slice(2)}`, collectionHtml(state, sortedCollectionRows))} />}
            {view === "termination" && currentSheet && <TerminationView sheet={currentSheet} sortState={sorts} reasonCounts={(() => {
              const bucket = new Map<string, number>()
              ;(currentSheet.items || []).forEach((row: any) => bucket.set(row.reason, (bucket.get(row.reason) || 0) + 1))
              return [...bucket.entries()]
            })()} onSheetSelect={(sheetId: string) => commit((draft) => { draft.termination.currentSheetId = sheetId })} onCreateSheet={() => commit((draft) => {
              const newSheet = { id: `sheet-${Date.now()}`, name: "새시트", items: [], holdItems: [] }
              draft.termination.sheets = [newSheet, ...draft.termination.sheets]
              draft.termination.currentSheetId = newSheet.id
            })} onRenameSheet={() => {
              const nextName = window.prompt("시트명을 입력하세요.", currentSheet.name)
              if (!nextName) return
              commit((draft) => {
                const target = draft.termination.sheets.find((sheet: any) => sheet.id === draft.termination.currentSheetId)
                if (target) target.name = nextName
              })
            }} onDeleteSheet={() => {
              if (!window.confirm("현재 시트를 삭제하시겠습니까?")) return
              commit((draft) => {
                if (draft.termination.sheets.length <= 1) return
                draft.termination.sheets = draft.termination.sheets.filter((sheet: any) => sheet.id !== draft.termination.currentSheetId)
                draft.termination.currentSheetId = draft.termination.sheets[0].id
              })
            }} onToggleSelection={(itemId: string) => commit((draft) => {
              const sheet = draft.termination.sheets.find((row: any) => row.id === draft.termination.currentSheetId)
              if (!sheet) return
              sheet.items = sheet.items.map((item: any) => item.id === itemId ? { ...item, selected: !item.selected } : item)
            })} onSort={(bucket: "termination" | "hold", key: string) => setSorts((current) => {
              const prev = bucket === "termination" ? current.termination : current.hold
              return { ...current, [bucket]: prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" } }
            })} rows={terminationRows} holdRows={holdRows} onAddTermination={(item: Omit<any, "id" | "no" | "selected">) => commit((draft) => {
              const sheet = draft.termination.sheets.find((row: any) => row.id === draft.termination.currentSheetId)
              if (!sheet) return
              sheet.items = [{ ...item, id: `term-${Date.now()}`, no: 1, selected: false }, ...sheet.items.map((row: any, index: number) => ({ ...row, no: index + 2 }))]
            })} onAddHold={(item: Omit<any, "id" | "no">) => commit((draft) => {
              const sheet = draft.termination.sheets.find((row: any) => row.id === draft.termination.currentSheetId)
              if (!sheet) return
              sheet.holdItems = [{ ...item, id: `hold-${Date.now()}`, no: 1 }, ...sheet.holdItems.map((row: any, index: number) => ({ ...row, no: index + 2 }))]
            })} />}
          </div>
        </main>
      </div>
    </div>
  )
}

function NavSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div>
      <button className="flex w-full items-center justify-between text-left text-[15px] font-bold text-slate-800" onClick={onToggle}>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          {title}
        </span>
        <span className="text-slate-400">{open ? "⌄" : "›"}</span>
      </button>
      {open ? <div className="mt-3 space-y-1">{children}</div> : null}
    </div>
  )
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${
        active ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  )
}

function ExcelButton({
  tone,
  label,
  action,
}: {
  tone: "emerald" | "blue"
  label: string
  action: string
}) {
  return (
    <button className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50">
      <span className="flex items-center gap-3">
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${tone === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>X</span>
        {label}
      </span>
      <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{action}</span>
    </button>
  )
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[28px] border border-slate-200 bg-white ${className}`}>{children}</section>
}

function SectionTitle({
  title,
  description,
  right,
}: {
  title: string
  description?: string
  right?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[22px] font-extrabold tracking-[-0.04em]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {right}
    </div>
  )
}

function LabeledField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-1 min-h-[18px] text-xs font-semibold text-slate-500">{label}</div>
      {children}
    </label>
  )
}

function CompactTable({
  headers,
  children,
}: {
  headers: React.ReactNode[]
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className="w-full table-fixed border-collapse">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((header, index) => (
              <th key={index} className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function StatPill({
  label,
  value,
  tone = "slate",
}: {
  label: string
  value: string
  tone?: "slate" | "green" | "red" | "blue"
}) {
  const color =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "red"
        ? "bg-rose-50 text-rose-700"
        : tone === "blue"
          ? "bg-blue-50 text-blue-700"
          : "bg-slate-100 text-slate-700"
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${color}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function SummaryBox({
  title,
  value,
  accent = "slate",
}: {
  title: string
  value: string
  accent?: "slate" | "blue" | "green" | "red"
}) {
  const color =
    accent === "blue"
      ? "border-blue-200 bg-blue-50/60"
      : accent === "green"
        ? "border-emerald-200 bg-emerald-50/60"
        : accent === "red"
          ? "border-rose-200 bg-rose-50/60"
          : "border-slate-200 bg-slate-50/80"
  return (
    <div className={`rounded-2xl border px-4 py-3 ${color}`}>
      <div className="text-xs font-semibold text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-extrabold tracking-[-0.04em]">{value}</div>
    </div>
  )
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: "asc" | "desc"
  onClick: () => void
}) {
  return (
    <button className={`font-semibold ${active ? "text-blue-700" : ""}`} onClick={onClick}>
      {label}
      {active ? ` (${dir === "asc" ? "ASC" : "DESC"})` : ""}
    </button>
  )
}

function WeeklyReportView({
  state,
  selectedContracts,
  onPrint,
}: {
  state: any
  selectedContracts: any[]
  onPrint: () => void
}) {
  const report = state.weeklyReport
  const revenueRows = report.revenueRows.map((row: any) => ({
    ...row,
    total: row.months.reduce((sum: number, value: number) => sum + value, 0),
  }))

  return (
    <Card className="p-6">
      <SectionTitle
        title="주간실적보고"
        description="수동 입력 리스트와 주간 반영 리스트가 연결된 전면 보고 화면입니다."
        right={<button className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={onPrint}>PDF 출력</button>}
      />

      <CompactTable headers={["회사명", "부서", "아이디", "업종", "계약월", "계약서 회수", "미회수"]}>
        {selectedContracts.map((row) => (
          <tr key={row.id} className="border-b border-slate-200 text-center text-[13px]">
            <td className="px-3 py-2">{row.companyName}</td>
            <td className="px-3 py-2">{row.departmentName}</td>
            <td className="px-3 py-2">{row.idCode}</td>
            <td className="px-3 py-2">{row.industry}</td>
            <td className="px-3 py-2">{row.contractMonth}</td>
            <td className="px-3 py-2">{row.documentStatus === "회수" ? "○" : ""}</td>
            <td className="px-3 py-2">{row.documentStatus !== "회수" ? "○" : ""}</td>
          </tr>
        ))}
      </CompactTable>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full table-fixed border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">구분(월)</th>
              {Array.from({ length: 12 }, (_, index) => (
                <th key={index} className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                  {index + 1}월
                </th>
              ))}
              <th className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">합계</th>
            </tr>
          </thead>
          <tbody>
            {revenueRows.map((row: any) => (
              <tr key={row.key} className="border-b border-slate-200 text-center text-[13px]">
                <th className="px-3 py-2 font-semibold">{row.label}</th>
                {row.months.map((month: number, index: number) => (
                  <td key={index} className="px-3 py-2">{month}</td>
                ))}
                <td className="px-3 py-2 font-semibold">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[13px] font-semibold text-slate-800">
        {report.revenueHeaderText}/{report.subtitleOne}/{report.subtitleTwo}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        ※ 대당 연 616만 원으로 매출을 산정 ({report.baseDate} 기준) / 위약금 및 이전비는 월 단위로 계산하되, 모든 금액 단위는 백만 원으로 표기.
      </div>

      <div className="mt-5 grid gap-3">
        <CompactTable headers={["주간순증 합계", "신규계약", "해지계약", "누적순증 합계", "누적신규 계약", "누적해지계약", "총 계약대수"]}>
          <tr className="text-center text-[13px]">
            <td className="px-3 py-3">{metric(report.manualSummary.weeklyNetUnits)}</td>
            <td className="px-3 py-3">{metric(report.manualSummary.weeklyNewContracts)}</td>
            <td className="px-3 py-3">{metric(report.manualSummary.weeklyTerminationContracts)}</td>
            <td className="px-3 py-3">{metric(report.manualSummary.cumulativeNetUnits)}</td>
            <td className="px-3 py-3">{metric(report.manualSummary.cumulativeNewContracts)}</td>
            <td className="px-3 py-3">{metric(report.manualSummary.cumulativeTerminationContracts)}</td>
            <td className="px-3 py-3">{metric(report.manualSummary.totalContracts)}</td>
          </tr>
        </CompactTable>
      </div>
    </Card>
  )
}

function ContractsView({
  contracts,
  onChange,
}: {
  contracts: any[]
  onChange: (nextContracts: any[]) => void
}) {
  const emptyRow = {
    id: `contract-${Date.now()}`,
    companyName: "",
    departmentName: "",
    idCode: "",
    industry: INDUSTRIES[0],
    contractMonth: "26년 3월",
    documentStatus: "미정",
    includedInWeekly: false,
    recommender: "",
    replacementType: "",
    note: "",
  }
  const [form, setForm] = useState<any>(emptyRow)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <Card className="p-6">
      <SectionTitle title="신규계약 리스트" description="원장 입력과 수정은 여기에서 관리합니다." />
      <div className="grid grid-cols-5 gap-3">
        <LabeledField label="회사명"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></LabeledField>
        <LabeledField label="부서명"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={form.departmentName} onChange={(event) => setForm({ ...form, departmentName: event.target.value })} /></LabeledField>
        <LabeledField label="ID"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={form.idCode} onChange={(event) => setForm({ ...form, idCode: event.target.value })} /></LabeledField>
        <LabeledField label="업종"><select className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })}>{INDUSTRIES.map((industry) => <option key={industry} value={industry}>{industry}</option>)}</select></LabeledField>
        <LabeledField label="계약월"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={form.contractMonth} onChange={(event) => setForm({ ...form, contractMonth: event.target.value })} /></LabeledField>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => { onChange([form, ...contracts]); setForm({ ...emptyRow, id: `contract-${Date.now()}` }) }}>신규 계약 추가</button>
        <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => setForm({ ...emptyRow, id: `contract-${Date.now()}` })}>필드 삭제</button>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50">
            <tr>{["No.", "회사명", "부서명", "ID", "업종", "계약월", "계약서 회수", "작업"].map((head) => <th key={head} className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">{head}</th>)}</tr>
          </thead>
          <tbody>
            {contracts.map((row, index) => {
              const editing = editingId === row.id
              return (
                <tr key={row.id} className="border-b border-slate-200 text-[13px]">
                  <td className="px-3 py-2 text-center">{index + 1}</td>
                  <td className="px-3 py-2">{editing ? <input className="h-9 w-full rounded-lg border border-slate-200 px-2" defaultValue={row.companyName} onChange={(event) => (row.companyName = event.target.value)} /> : row.companyName}</td>
                  <td className="px-3 py-2">{editing ? <input className="h-9 w-full rounded-lg border border-slate-200 px-2" defaultValue={row.departmentName} onChange={(event) => (row.departmentName = event.target.value)} /> : row.departmentName}</td>
                  <td className="px-3 py-2">{editing ? <input className="h-9 w-full rounded-lg border border-slate-200 px-2" defaultValue={row.idCode} onChange={(event) => (row.idCode = event.target.value)} /> : row.idCode}</td>
                  <td className="px-3 py-2">{editing ? <select className="h-9 w-full rounded-lg border border-slate-200 px-2" defaultValue={row.industry} onChange={(event) => (row.industry = event.target.value)}>{INDUSTRIES.map((industry) => <option key={industry} value={industry}>{industry}</option>)}</select> : row.industry}</td>
                  <td className="px-3 py-2">{editing ? <input className="h-9 w-full rounded-lg border border-slate-200 px-2" defaultValue={row.contractMonth} onChange={(event) => (row.contractMonth = event.target.value)} /> : row.contractMonth}</td>
                  <td className="px-3 py-2 text-center">{row.documentStatus}</td>
                  <td className="px-3 py-2 text-center">{editing ? <div className="flex justify-center gap-2"><button className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => { onChange([...contracts]); setEditingId(null) }}>수정완료</button><button className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700" onClick={() => onChange(contracts.filter((item) => item.id !== row.id))}>삭제</button><button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700" onClick={() => setEditingId(null)}>취소</button></div> : <button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700" onClick={() => setEditingId(row.id)}>수정</button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function WeeklySelectionView({
  contracts,
  onToggle,
  onMoveToCollection,
}: {
  contracts: any[]
  onToggle: (id: string) => void
  onMoveToCollection: () => void
}) {
  return (
    <Card className="p-6">
      <SectionTitle title="주간 반영 리스트" description={`현재 ${contracts.length}건 / 선택 ${contracts.filter((item) => item.includedInWeekly).length}건`} right={<button className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={onMoveToCollection}>계약서통합관리로 이동</button>} />
      <CompactTable headers={["선택", "No.", "회사명", "부서", "ID", "업종", "계약월", "권유자", "계약서 회수"]}>
        {contracts.map((row, index) => (
          <tr key={row.id} className={`border-b border-slate-200 text-[13px] ${row.includedInWeekly ? "bg-blue-50/80" : ""}`}>
            <td className="px-3 py-2 text-center"><input type="checkbox" checked={row.includedInWeekly} onChange={() => onToggle(row.id)} /></td>
            <td className="px-3 py-2 text-center">{index + 1}</td>
            <td className="px-3 py-2">{row.companyName}</td>
            <td className="px-3 py-2">{row.departmentName}</td>
            <td className="px-3 py-2">{row.idCode}</td>
            <td className="px-3 py-2">{row.industry}</td>
            <td className="px-3 py-2">{row.contractMonth}</td>
            <td className="px-3 py-2">{row.recommender}</td>
            <td className="px-3 py-2 text-center">{row.documentStatus}</td>
          </tr>
        ))}
      </CompactTable>
    </Card>
  )
}

function ManualInputView({
  draft,
  onChange,
  onUpdate,
}: {
  draft: any
  onChange: (draft: any) => void
  onUpdate: () => void
}) {
  const setSummary = (key: string, value: string) => onChange({ ...draft, manualSummary: { ...draft.manualSummary, [key]: Number(value || 0) } })
  return (
    <Card className="p-6">
      <SectionTitle title="수동 입력 리스트" description="입력 후 업데이트를 누르면 전면 주간실적보고에 바로 반영됩니다." right={<button className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={onUpdate}>업데이트</button>} />
      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold">요약 수동입력</h3><span className="text-xs font-semibold text-slate-400">핵심 지표</span></div>
        <div className="grid grid-cols-3 gap-3">
          <LabeledField label="매출 헤더 (자동계산)"><input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={draft.revenueHeaderText} onChange={(event) => onChange({ ...draft, revenueHeaderText: event.target.value })} /></LabeledField>
          <LabeledField label="매출 부제 1"><input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={draft.subtitleOne} onChange={(event) => onChange({ ...draft, subtitleOne: event.target.value })} /></LabeledField>
          <LabeledField label="매출 부제 2"><input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" value={draft.subtitleTwo} onChange={(event) => onChange({ ...draft, subtitleTwo: event.target.value })} /></LabeledField>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-3">
          <LabeledField label="주간순증 합계"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" type="number" value={draft.manualSummary.weeklyNetUnits} onChange={(event) => setSummary("weeklyNetUnits", event.target.value)} /></LabeledField>
          <LabeledField label="신규계약"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" type="number" value={draft.manualSummary.weeklyNewContracts} onChange={(event) => setSummary("weeklyNewContracts", event.target.value)} /></LabeledField>
          <LabeledField label="해지계약"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" type="number" value={draft.manualSummary.weeklyTerminationContracts} onChange={(event) => setSummary("weeklyTerminationContracts", event.target.value)} /></LabeledField>
          <LabeledField label="누적순증 합계"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" type="number" value={draft.manualSummary.cumulativeNetUnits} onChange={(event) => setSummary("cumulativeNetUnits", event.target.value)} /></LabeledField>
          <LabeledField label="누적신규 계약"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" type="number" value={draft.manualSummary.cumulativeNewContracts} onChange={(event) => setSummary("cumulativeNewContracts", event.target.value)} /></LabeledField>
          <LabeledField label="누적해지계약"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" type="number" value={draft.manualSummary.cumulativeTerminationContracts} onChange={(event) => setSummary("cumulativeTerminationContracts", event.target.value)} /></LabeledField>
          <LabeledField label="총 계약대수"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" type="number" value={draft.manualSummary.totalContracts} onChange={(event) => setSummary("totalContracts", event.target.value)} /></LabeledField>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold">추가 매출</h3><button className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700" onClick={() => onChange({ ...draft, additionalSales: [...draft.additionalSales, { id: `extra-${Date.now()}`, title: "", amount: 0 }] })}>행 추가</button></div>
        <div className="space-y-2">
          {draft.additionalSales.map((sale: any) => (
            <div key={sale.id} className="grid grid-cols-[1fr_180px_80px] gap-2">
              <input className="h-10 rounded-xl border border-slate-200 px-3 text-sm" value={sale.title} onChange={(event) => onChange({ ...draft, additionalSales: draft.additionalSales.map((row: any) => row.id === sale.id ? { ...row, title: event.target.value } : row) })} />
              <input className="h-10 rounded-xl border border-slate-200 px-3 text-sm" type="number" value={sale.amount} onChange={(event) => onChange({ ...draft, additionalSales: draft.additionalSales.map((row: any) => row.id === sale.id ? { ...row, amount: Number(event.target.value || 0) } : row) })} />
              <button className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700" onClick={() => onChange({ ...draft, additionalSales: draft.additionalSales.filter((row: any) => row.id !== sale.id) })}>삭제</button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function CollectionView({
  state,
  rows,
  editId,
  onEdit,
  onSort,
  onTabChange,
  onYearFilter,
  onStatusFilter,
  onRowChange,
  onDelete,
  onPrint,
}: {
  state: any
  rows: any[]
  editId: string | null
  onEdit: (id: string | null) => void
  onSort: (key: string) => void
  onTabChange: (tab: "integrated" | "long-term") => void
  onYearFilter: (year: number | "all") => void
  onStatusFilter: (status: "all" | "회수" | "미회수" | "미정") => void
  onRowChange: (rowId: string, updater: (row: any) => void) => void
  onDelete: (rowId: string) => void
  onPrint: () => void
}) {
  const total = rows.length
  const received = rows.filter((row) => row.status === "회수").length
  const missing = rows.filter((row) => row.status === "미회수").length
  const pending = rows.filter((row) => row.status === "미정").length
  const industryCounts = INDUSTRIES.map((industry) => ({
    industry,
    received: rows.filter((row) => row.industry === industry && row.status === "회수").length,
    missing: rows.filter((row) => row.industry === industry && row.status === "미회수").length,
  })).filter((row) => row.received || row.missing)

  return (
    <Card className="p-6">
      <SectionTitle title="계약서통합관리" description="회수와 미회수 상태를 통합 관리합니다." right={<button className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={onPrint}>PDF 출력</button>} />
      <div className="flex flex-wrap items-center gap-2">
        <button className={`rounded-full px-3 py-1.5 text-sm font-semibold ${state.collection.tab === "integrated" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => onTabChange("integrated")}>통합관리</button>
        <button className={`rounded-full px-3 py-1.5 text-sm font-semibold ${state.collection.tab === "long-term" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => onTabChange("long-term")}>장기미회수</button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatPill label="전체" value={`${total}건`} tone="blue" />
        <StatPill label="회수" value={`${received}건`} tone="green" />
        <StatPill label="미회수" value={`${missing}건`} tone="red" />
        <StatPill label="미정" value={`${pending}건`} tone="slate" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {["all", 2026, 2025, 2024, 2022].map((year) => (
          <button key={String(year)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${state.collection.yearFilter === year ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => onYearFilter(year as number | "all")}>{year === "all" ? "전체" : `${year}년`}</button>
        ))}
        <div className="mx-1 h-5 w-px bg-slate-200" />
        {(["all", "회수", "미회수", "미정"] as const).map((status) => (
          <button key={status} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${state.collection.statusFilter === status ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => onStatusFilter(status)}>{status}</button>
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full border-collapse table-fixed">
          <thead className="bg-slate-50">
            <tr><th className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">구분</th><th className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">합계</th>{industryCounts.map((row) => <th key={row.industry} className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">{row.industry}</th>)}</tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200 text-center text-[13px]"><th className="px-3 py-2 font-semibold">회수</th><td className="px-3 py-2">{received}</td>{industryCounts.map((row) => <td key={row.industry} className="px-3 py-2">{row.received}</td>)}</tr>
            <tr className="text-center text-[13px]"><th className="px-3 py-2 font-semibold">미회수</th><td className="px-3 py-2">{missing}</td>{industryCounts.map((row) => <td key={row.industry} className="px-3 py-2">{row.missing}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50">
            <tr>{[["year", "연도"], ["companyName", "회사명"], ["departmentName", "부서명"], ["idCode", "ID"], ["industry", "업종"], ["claimMonth", "청구월"], ["receiptDate", "회수일"], ["reportDate", "실적반영일자"]].map(([key, label]) => <th key={key} className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"><button className="font-semibold" onClick={() => onSort(key)}>{label}</button></th>)}<th className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">상태</th><th className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">작업</th></tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const editing = editId === row.id
              return (
                <tr key={row.id} className="border-b border-slate-200 text-[13px]">
                  <td className="px-3 py-2 text-center">{index + 1}</td>
                  <td className="px-3 py-2">{editing ? <input className="h-9 w-full rounded-lg border border-slate-200 px-2" defaultValue={row.companyName} onChange={(event) => onRowChange(row.id, (draft) => { draft.companyName = event.target.value })} /> : row.companyName}</td>
                  <td className="px-3 py-2">{editing ? <input className="h-9 w-full rounded-lg border border-slate-200 px-2" defaultValue={row.departmentName} onChange={(event) => onRowChange(row.id, (draft) => { draft.departmentName = event.target.value })} /> : row.departmentName}</td>
                  <td className="px-3 py-2">{editing ? <input className="h-9 w-full rounded-lg border border-slate-200 px-2" defaultValue={row.idCode} onChange={(event) => onRowChange(row.id, (draft) => { draft.idCode = event.target.value })} /> : row.idCode}</td>
                  <td className="px-3 py-2">{editing ? <select className="h-9 w-full rounded-lg border border-slate-200 px-2" defaultValue={row.industry} onChange={(event) => onRowChange(row.id, (draft) => { draft.industry = event.target.value })}>{INDUSTRIES.map((industry) => <option key={industry} value={industry}>{industry}</option>)}</select> : row.industry}</td>
                  <td className="px-3 py-2">{editing ? <input className="h-9 w-full rounded-lg border border-slate-200 px-2" defaultValue={row.claimMonth} onChange={(event) => onRowChange(row.id, (draft) => { draft.claimMonth = event.target.value })} /> : row.claimMonth}</td>
                  <td className="px-3 py-2">{editing ? <input className="h-9 w-28 rounded-lg border border-slate-200 px-2" defaultValue={row.receiptDate} onChange={(event) => onRowChange(row.id, (draft) => { draft.receiptDate = event.target.value })} /> : row.receiptDate || "-"}</td>
                  <td className="px-3 py-2">{editing ? <input className="h-9 w-full rounded-lg border border-slate-200 px-2" defaultValue={row.reportDate} onChange={(event) => onRowChange(row.id, (draft) => { draft.reportDate = event.target.value })} /> : row.reportDate || "-"}</td>
                  <td className="px-3 py-2 text-center">{editing ? <select className="h-9 rounded-lg border border-slate-200 px-2" value={row.status} onChange={(event) => onRowChange(row.id, (draft) => { draft.status = event.target.value })}><option value="회수">회수</option><option value="미회수">미회수</option><option value="미정">미정</option></select> : <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${row.status === "회수" ? "bg-emerald-50 text-emerald-700" : row.status === "미회수" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{row.status}</span>}</td>
                  <td className="px-3 py-2 text-center">{editing ? <div className="flex justify-center gap-2"><button className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => onEdit(null)}>수정완료</button><button className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700" onClick={() => onDelete(row.id)}>삭제</button><button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700" onClick={() => onEdit(null)}>취소</button></div> : <button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700" onClick={() => onEdit(row.id)}>수정</button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function TerminationView(props: any) {
  const { sheet, sortState, reasonCounts, onSheetSelect, onCreateSheet, onRenameSheet, onDeleteSheet, onToggleSelection, onSort, rows, holdRows, onAddTermination, onAddHold } = props
  const [entryType, setEntryType] = useState<"termination" | "hold">("termination")
  const [terminationForm, setTerminationForm] = useState<any>({ receivedDate: toInputDate(today()), manager: "", customerId: "", reason: "계약만료", terminationDate: "", companyName: "", departmentName: "", penalty: 0, extraReason: "" })
  const [holdForm, setHoldForm] = useState<any>({ receivedDate: toInputDate(today()), manager: "", customerId: "", reason: "청구연장", startDate: "", endDate: "", companyName: "", departmentName: "" })
  const reasonLine = reasonCounts.map(([reason, count]: [string, number]) => `${reason} ${count}건`).join(" · ")

  return (
    <Card className="p-6">
      <SectionTitle title={`해지 진행사항(${sheet.name})`} description="원본 엑셀 구조를 기준으로 해지와 청구보류를 관리합니다." />
      <div className="grid grid-cols-4 gap-3">
        <SummaryBox title="기준 시트" value={sheet.name} accent="blue" />
        <SummaryBox title="금주 해지 건수" value={`${sheet.items.length}건`} accent="red" />
        <SummaryBox title="금주 청구보류 건수" value={`${sheet.holdItems.length}건`} accent="blue" />
        <SummaryBox title="위약금 합계" value={`${money(sheet.items.reduce((sum: number, row: any) => sum + row.penalty, 0))}원`} accent="slate" />
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between"><div className="text-base font-bold">시트 보기</div><div className="flex gap-2"><button className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700" onClick={onRenameSheet}>시트명 수정</button><button className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700" onClick={onDeleteSheet}>시트삭제</button></div></div>
        <div className="flex flex-wrap gap-2"><button className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white" onClick={onCreateSheet}>새시트</button></div>
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 p-4"><div className="text-sm font-semibold text-slate-700">해지 현황 구분</div><div className="mt-2 text-sm text-slate-600">{reasonLine || "등록된 해지 사유 없음"}</div></div>
      <div className="mt-4 rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold">신규 입력</h3><div className="flex gap-2"><button className={`rounded-full px-3 py-1.5 text-sm font-semibold ${entryType === "termination" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setEntryType("termination")}>해지 입력</button><button className={`rounded-full px-3 py-1.5 text-sm font-semibold ${entryType === "hold" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setEntryType("hold")}>청구보류 입력</button></div></div>
        {entryType === "termination" ? <div><div className="grid grid-cols-4 gap-3"><LabeledField label="접수일"><input type="date" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={terminationForm.receivedDate} onChange={(event) => setTerminationForm({ ...terminationForm, receivedDate: event.target.value })} /></LabeledField><LabeledField label="담당자"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={terminationForm.manager} onChange={(event) => setTerminationForm({ ...terminationForm, manager: event.target.value })} /></LabeledField><LabeledField label="고객번호"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={terminationForm.customerId} onChange={(event) => setTerminationForm({ ...terminationForm, customerId: event.target.value })} /></LabeledField><LabeledField label="고객사"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={terminationForm.companyName} onChange={(event) => setTerminationForm({ ...terminationForm, companyName: event.target.value })} /></LabeledField><LabeledField label="고객 부서"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={terminationForm.departmentName} onChange={(event) => setTerminationForm({ ...terminationForm, departmentName: event.target.value })} /></LabeledField><LabeledField label="해지 사유"><select className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={terminationForm.reason} onChange={(event) => setTerminationForm({ ...terminationForm, reason: event.target.value })}>{["계약만료", "비용절감", "사용자퇴사", "조직개편", "휴직/장기출장", "합병매각", "활용저조", "타사대체", "비용미납", "기타"].map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></LabeledField><LabeledField label="기타 사유"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={terminationForm.extraReason} onChange={(event) => setTerminationForm({ ...terminationForm, extraReason: event.target.value })} /></LabeledField><LabeledField label="해지일"><input type="date" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={terminationForm.terminationDate} onChange={(event) => setTerminationForm({ ...terminationForm, terminationDate: event.target.value })} /></LabeledField><LabeledField label="위약금"><input type="number" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={terminationForm.penalty} onChange={(event) => setTerminationForm({ ...terminationForm, penalty: Number(event.target.value || 0) })} /></LabeledField></div><div className="mt-3 flex justify-end"><button className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={() => onAddTermination({ receivedDate: normalizeDate(terminationForm.receivedDate), manager: terminationForm.manager, customerId: terminationForm.customerId, reason: terminationForm.reason === "기타" && terminationForm.extraReason ? `기타(${terminationForm.extraReason})` : terminationForm.reason, terminationDate: normalizeDate(terminationForm.terminationDate), companyName: terminationForm.companyName, departmentName: terminationForm.departmentName, penalty: terminationForm.penalty })}>등록</button></div></div> : <div><div className="grid grid-cols-4 gap-3"><LabeledField label="접수일"><input type="date" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={holdForm.receivedDate} onChange={(event) => setHoldForm({ ...holdForm, receivedDate: event.target.value })} /></LabeledField><LabeledField label="담당자"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={holdForm.manager} onChange={(event) => setHoldForm({ ...holdForm, manager: event.target.value })} /></LabeledField><LabeledField label="고객번호"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={holdForm.customerId} onChange={(event) => setHoldForm({ ...holdForm, customerId: event.target.value })} /></LabeledField><LabeledField label="고객사"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={holdForm.companyName} onChange={(event) => setHoldForm({ ...holdForm, companyName: event.target.value })} /></LabeledField><LabeledField label="고객 부서"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={holdForm.departmentName} onChange={(event) => setHoldForm({ ...holdForm, departmentName: event.target.value })} /></LabeledField><LabeledField label="보류 사유"><input className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={holdForm.reason} onChange={(event) => setHoldForm({ ...holdForm, reason: event.target.value })} /></LabeledField><LabeledField label="시작일"><input type="date" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={holdForm.startDate} onChange={(event) => setHoldForm({ ...holdForm, startDate: event.target.value })} /></LabeledField><LabeledField label="종료일"><input type="date" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={holdForm.endDate} onChange={(event) => setHoldForm({ ...holdForm, endDate: event.target.value })} /></LabeledField></div><div className="mt-3 flex justify-end"><button className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white" onClick={() => onAddHold({ receivedDate: normalizeDate(holdForm.receivedDate), manager: holdForm.manager, customerId: holdForm.customerId, reason: holdForm.reason, startDate: normalizeDate(holdForm.startDate), endDate: normalizeDate(holdForm.endDate), companyName: holdForm.companyName, departmentName: holdForm.departmentName })}>등록</button></div></div>}
      </div>
      <div className="mt-5"><SectionTitle title="해지 리스트" right={<div className="text-sm font-semibold text-slate-500">{rows.length}건</div>} /><CompactTable headers={["No.", "선택", <SortButton key="received" label="접수일" active={sortState.termination.key === "receivedDate"} dir={sortState.termination.dir} onClick={() => onSort("termination", "receivedDate")} />, "담당자", "고객번호", "고객사", "고객 부서", "해지 사유", <SortButton key="termination" label="해지일" active={sortState.termination.key === "terminationDate"} dir={sortState.termination.dir} onClick={() => onSort("termination", "terminationDate")} />, "위약금", "작업"]}>{rows.map((row: any) => <tr key={row.id} className={`border-b border-slate-200 text-[13px] ${row.selected ? "bg-rose-50" : ""}`}><td className="px-3 py-2 text-center">{row.no}</td><td className="px-3 py-2 text-center"><input type="checkbox" checked={row.selected} onChange={() => onToggleSelection(row.id)} /></td><td className="px-3 py-2 text-center">{row.receivedDate}</td><td className="px-3 py-2 text-center">{row.manager}</td><td className="px-3 py-2 text-center">{row.customerId}</td><td className="px-3 py-2 text-center">{row.companyName}</td><td className="px-3 py-2 text-center">{row.departmentName}</td><td className="px-3 py-2 text-center">{row.reason}</td><td className="px-3 py-2 text-center">{row.terminationDate}</td><td className="px-3 py-2 text-center">{row.penalty ? money(row.penalty) : ""}</td><td className="px-3 py-2 text-center"><button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">수정</button></td></tr>)}</CompactTable></div>
      <div className="mt-5"><SectionTitle title="청구보류 리스트" right={<div className="text-sm font-semibold text-slate-500">{holdRows.length}건</div>} /><CompactTable headers={["No.", <SortButton key="received-hold" label="접수일" active={sortState.hold.key === "receivedDate"} dir={sortState.hold.dir} onClick={() => onSort("hold", "receivedDate")} />, "담당자", "고객번호", "고객사", "고객 부서", "보류 사유", <SortButton key="start-hold" label="시작일" active={sortState.hold.key === "startDate"} dir={sortState.hold.dir} onClick={() => onSort("hold", "startDate")} />, <SortButton key="end-hold" label="종료일" active={sortState.hold.key === "endDate"} dir={sortState.hold.dir} onClick={() => onSort("hold", "endDate")} />, "작업"]}>{holdRows.map((row: any) => <tr key={row.id} className="border-b border-slate-200 text-[13px]"><td className="px-3 py-2 text-center">{row.no}</td><td className="px-3 py-2 text-center">{row.receivedDate}</td><td className="px-3 py-2 text-center">{row.manager}</td><td className="px-3 py-2 text-center">{row.customerId}</td><td className="px-3 py-2 text-center">{row.companyName}</td><td className="px-3 py-2 text-center">{row.departmentName}</td><td className="px-3 py-2 text-center">{row.reason}</td><td className="px-3 py-2 text-center">{row.startDate}</td><td className="px-3 py-2 text-center">{row.endDate}</td><td className="px-3 py-2 text-center"><button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">수정</button></td></tr>)}</CompactTable></div>
    </Card>
  )
}
