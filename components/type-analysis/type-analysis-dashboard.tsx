"use client"

import { useMemo, useState } from "react"
import { BarChart3, Database, RefreshCw, Save, Search, Table2, UsersRound } from "lucide-react"

type TabKey = "summary" | "new" | "termination" | "area" | "personal"

type Props = {
  data: any
  currentYear: number | string
  isDirty: boolean
  isSaving: boolean
  saveMessage: string
  weeklyImportSummary: {
    newCount: number
    terminationCount: number
    netCount: number
  }
  onImportWeekly: () => void
  onSave: () => void
}

const tabItems: Array<{ key: TabKey; label: string }> = [
  { key: "summary", label: "요약" },
  { key: "new", label: "신규/대체" },
  { key: "termination", label: "해지" },
  { key: "area", label: "영역별 순증" },
  { key: "personal", label: "개인별 실적" },
]

function toNumber(value: unknown) {
  const number = Number(String(value ?? "").replace(/,/g, ""))
  return Number.isFinite(number) ? number : 0
}

function formatNumber(value: unknown) {
  return toNumber(value).toLocaleString("ko-KR")
}

function compactDate(value: unknown) {
  return String(value || "").replace(/-/g, ".").trim()
}

function findSummaryValue(rows: any[], matcher: (label: string) => boolean) {
  const row = (Array.isArray(rows) ? rows : []).find((item) => matcher(String(item?.label || "")))
  return toNumber(row?.value)
}

function normalizeSearch(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase()
}

function recordMatches(row: any, query: string) {
  if (!query) return true
  const haystack = normalizeSearch([
    row?.date,
    row?.idCode,
    row?.companyName,
    row?.departmentName,
    row?.recommender,
    row?.industry,
    row?.businessType,
    row?.replacementType,
    row?.reason,
    row?.competitorType,
    row?.group,
    row?.note,
  ].join(" "))
  return haystack.includes(query)
}

function sourceTitle(data: any) {
  return String(data?.newReplacement?.asOf || data?.terminationType?.asOf || "").replace(" 기준", "")
}

function sourceUpdatedLabel(value: unknown) {
  const time = Date.parse(String(value || ""))
  if (!Number.isFinite(time)) return ""
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(time))
}

function StatusPill({ children, tone = "slate" }: { children: string; tone?: "slate" | "blue" | "green" | "amber" }) {
  const color =
    tone === "blue"
      ? "border-blue-100 bg-blue-50 text-blue-700"
      : tone === "green"
        ? "border-emerald-100 bg-emerald-50 text-emerald-700"
        : tone === "amber"
          ? "border-amber-100 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
  return <span className={`inline-flex h-7 items-center rounded-full border px-3 text-[12px] font-bold ${color}`}>{children}</span>
}

function MetricTile({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string
  value: string
  sub?: string
  tone?: "slate" | "blue" | "green" | "rose"
}) {
  const accent =
    tone === "blue"
      ? "border-blue-200"
      : tone === "green"
        ? "border-emerald-200"
        : tone === "rose"
          ? "border-rose-200"
          : "border-slate-200"
  return (
    <div className={`rounded-xl border bg-white px-3 py-2.5 ${accent}`}>
      <div className="text-[12px] font-bold text-slate-500">{label}</div>
      <div className="mt-0.5 text-[20px] font-black tabular-nums text-slate-950">{value}</div>
      {sub ? <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">{sub}</div> : null}
    </div>
  )
}

function MiniSummaryTable({
  title,
  rows,
}: {
  title: string
  rows: Array<{ label: string; value: unknown }>
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-black text-slate-900">{title}</div>
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3 lg:grid-cols-5">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0 px-3 py-3">
            <div className="truncate text-[12px] font-semibold text-slate-500">{row.label}</div>
            <div className="mt-1 text-[18px] font-black tabular-nums text-slate-950">{formatNumber(row.value)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CompactKpiTable({ items }: { items: Array<{ label: string; value: string; tone?: "blue" | "green" | "rose" }> }) {
  return (
    <div className="px-5 py-3">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full table-fixed border-collapse text-[12px]">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              {items.map((item) => (
                <th key={item.label} className="border-r border-slate-200 px-2 py-2 text-center font-black last:border-r-0">
                  {item.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {items.map((item) => {
                const toneClass =
                  item.tone === "blue"
                    ? "text-blue-700"
                    : item.tone === "green"
                      ? "text-emerald-700"
                      : item.tone === "rose"
                        ? "text-rose-700"
                        : "text-slate-950"
                return (
                  <td key={item.label} className={`border-r border-slate-200 px-2 py-2 text-center text-[17px] font-black tabular-nums last:border-r-0 ${toneClass}`}>
                    {item.value}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function isTotalIndustryRow(row: any) {
  const label = String(row?.label || "").replace(/\s+/g, "")
  return label === "계" || label.includes("합계")
}

function DenseTable({
  columns,
  rows,
  emptyText,
  minWidth = "980px",
}: {
  columns: Array<{ key: string; label: string; className?: string; render?: (row: any, index: number) => any }>
  rows: any[]
  emptyText: string
  minWidth?: string
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              {columns.map((column) => (
                <th key={column.key} className={`px-3 py-2.5 text-left font-black ${column.className || ""}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, index) => (
                <tr key={`${row?.id || row?.idCode || row?.companyName || "row"}-${index}`} className="border-b border-slate-100 last:border-0 hover:bg-blue-50/30">
                  {columns.map((column) => (
                    <td key={column.key} className={`px-3 py-2.5 align-middle text-slate-700 ${column.className || ""}`}>
                      {column.render ? column.render(row, index) : row?.[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const newReplacementIndustryColumns = [
  { key: "label", label: "업종", className: "min-w-[300px] text-left font-bold text-slate-900" },
  { key: "check", label: "체크", className: "text-center tabular-nums" },
  { key: "marketPoint", label: "마켓", className: "text-center tabular-nums" },
  { key: "bloomberg", label: "블룸버그", className: "text-center tabular-nums" },
  { key: "reuters", label: "로이터", className: "text-center tabular-nums" },
  { key: "hankyungEtc", label: "기타", className: "text-center tabular-nums" },
  { key: "new", label: "신규", className: "text-center font-black tabular-nums text-blue-700" },
  { key: "total", label: "합계", className: "text-center font-black tabular-nums text-slate-950" },
]

function IndustryMatrixTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
              {newReplacementIndustryColumns.map((column) => (
                <th key={column.key} className={`border-r border-slate-200 px-2 py-2 font-black last:border-r-0 ${column.className}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, index) => {
                const isTotal = isTotalIndustryRow(row)
                return (
                  <tr key={`${row.label}-${index}`} className={`border-b border-slate-100 last:border-0 ${isTotal ? "bg-amber-50" : ""}`}>
                    {newReplacementIndustryColumns.map((column) => (
                      <td key={column.key} className={`border-r border-slate-100 px-2 py-1.5 last:border-r-0 ${column.className} ${isTotal ? "font-black" : ""}`}>
                        {column.key === "label" ? row?.[column.key] : formatNumber(row?.[column.key])}
                      </td>
                    ))}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={newReplacementIndustryColumns.length} className="px-4 py-8 text-center text-[13px] font-semibold text-slate-400">
                  업종별 신규/대체 요약이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GroupedNewRecordsTable({ groups }: { groups: Array<{ label: string; rows: any[] }> }) {
  const totalCount = groups.reduce((sum, group) => sum + group.rows.length, 0)
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-white px-3 py-2 text-[13px] font-black text-slate-900">
        상세 목록 {formatNumber(totalCount)}건
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
              <th className="w-[56px] border-r border-slate-200 px-2 py-2 text-center font-black">NO</th>
              <th className="w-[92px] border-r border-slate-200 px-2 py-2 text-left font-black">날짜</th>
              <th className="w-[96px] border-r border-slate-200 px-2 py-2 text-left font-black">ID</th>
              <th className="min-w-[170px] border-r border-slate-200 px-2 py-2 text-left font-black">회사명</th>
              <th className="min-w-[150px] border-r border-slate-200 px-2 py-2 text-left font-black">부서</th>
              <th className="w-[86px] border-r border-slate-200 px-2 py-2 text-left font-black">권유자</th>
              <th className="w-[88px] border-r border-slate-200 px-2 py-2 text-left font-black">구분</th>
              <th className="min-w-[180px] px-2 py-2 text-left font-black">비고</th>
            </tr>
          </thead>
          <tbody>
            {groups.length ? (
              groups.flatMap((group) => [
                <tr key={`${group.label}-header`} className="border-y border-slate-300 bg-slate-50">
                  <td colSpan={8} className="px-3 py-1.5 text-[12px] font-black text-slate-900">
                    ({group.label}) <span className="ml-1 text-slate-500">{formatNumber(group.rows.length)}건</span>
                  </td>
                </tr>,
                ...group.rows.map((row, index) => (
                  <tr key={`${group.label}-${row?.id || row?.sourceId || row?.idCode || index}`} className="border-b border-slate-100 hover:bg-blue-50/30">
                    <td className="border-r border-slate-100 px-2 py-1.5 text-center tabular-nums text-slate-600">{row.no || index + 1}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 tabular-nums text-slate-600">{row.date}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 font-bold text-slate-900">{row.idCode}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 font-semibold text-slate-900">{row.companyName}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 text-slate-600">{row.departmentName}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 text-slate-600">{row.recommender}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 font-semibold text-slate-700">{row.replacementType || "신규"}</td>
                    <td className="px-2 py-1.5 text-slate-600">{row.note}</td>
                  </tr>
                )),
              ])
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
                  검색 조건에 맞는 신규/대체 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const terminationIndustryColumns = [
  { key: "label", label: "업종", className: "min-w-[300px] text-left font-bold text-slate-900" },
  { key: "userMove", label: "퇴사/이직", className: "text-center tabular-nums" },
  { key: "costCut", label: "비용절감", className: "text-center tabular-nums" },
  { key: "lowUsage", label: "활용저조", className: "text-center tabular-nums" },
  { key: "contentOrCompetitor", label: "타사대체", className: "text-center tabular-nums" },
  { key: "contractEnd", label: "계약만료", className: "text-center tabular-nums" },
  { key: "reorg", label: "조직개편", className: "text-center tabular-nums" },
  { key: "leave", label: "휴직/출장", className: "text-center tabular-nums" },
  { key: "merger", label: "합병매각", className: "text-center tabular-nums" },
  { key: "unpaid", label: "미수", className: "text-center tabular-nums" },
  { key: "total", label: "합계", className: "text-center font-black tabular-nums text-rose-700" },
]

function TerminationMatrixTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
              {terminationIndustryColumns.map((column) => (
                <th key={column.key} className={`border-r border-slate-200 px-2 py-2 font-black last:border-r-0 ${column.className}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, index) => {
                const isTotal = isTotalIndustryRow(row)
                return (
                  <tr key={`${row.label}-${index}`} className={`border-b border-slate-100 last:border-0 ${isTotal ? "bg-amber-50" : ""}`}>
                    {terminationIndustryColumns.map((column) => (
                      <td key={column.key} className={`border-r border-slate-100 px-2 py-1.5 last:border-r-0 ${column.className} ${isTotal ? "font-black" : ""}`}>
                        {column.key === "label" ? row?.[column.key] : formatNumber(row?.[column.key])}
                      </td>
                    ))}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={terminationIndustryColumns.length} className="px-4 py-8 text-center text-[13px] font-semibold text-slate-400">
                  업종별 해지 요약이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GroupedTerminationRecordsTable({ groups }: { groups: Array<{ label: string; rows: any[] }> }) {
  const totalCount = groups.reduce((sum, group) => sum + group.rows.length, 0)
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-white px-3 py-2 text-[13px] font-black text-slate-900">
        상세 목록 {formatNumber(totalCount)}건
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
              <th className="w-[56px] border-r border-slate-200 px-2 py-2 text-center font-black">NO</th>
              <th className="w-[92px] border-r border-slate-200 px-2 py-2 text-left font-black">날짜</th>
              <th className="w-[96px] border-r border-slate-200 px-2 py-2 text-left font-black">ID</th>
              <th className="min-w-[170px] border-r border-slate-200 px-2 py-2 text-left font-black">회사명</th>
              <th className="min-w-[150px] border-r border-slate-200 px-2 py-2 text-left font-black">부서</th>
              <th className="w-[86px] border-r border-slate-200 px-2 py-2 text-left font-black">담당자</th>
              <th className="min-w-[140px] border-r border-slate-200 px-2 py-2 text-left font-black">해지사유</th>
              <th className="w-[98px] border-r border-slate-200 px-2 py-2 text-right font-black">위약금</th>
              <th className="min-w-[180px] px-2 py-2 text-left font-black">비고</th>
            </tr>
          </thead>
          <tbody>
            {groups.length ? (
              groups.flatMap((group) => [
                <tr key={`${group.label}-header`} className="border-y border-slate-300 bg-slate-50">
                  <td colSpan={9} className="px-3 py-1.5 text-[12px] font-black text-slate-900">
                    ({group.label}) <span className="ml-1 text-slate-500">{formatNumber(group.rows.length)}건</span>
                  </td>
                </tr>,
                ...group.rows.map((row, index) => (
                  <tr key={`${group.label}-${row?.id || row?.sourceId || row?.idCode || index}`} className="border-b border-slate-100 hover:bg-rose-50/30">
                    <td className="border-r border-slate-100 px-2 py-1.5 text-center tabular-nums text-slate-600">{row.no || index + 1}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 tabular-nums text-slate-600">{row.date}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 font-bold text-slate-900">{row.idCode}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 font-semibold text-slate-900">{row.companyName}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 text-slate-600">{row.departmentName}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 text-slate-600">{row.recommender}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 font-semibold text-slate-700">{row.reason}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-600">{formatNumber(row.penalty)}</td>
                    <td className="px-2 py-1.5 text-slate-600">{row.note}</td>
                  </tr>
                )),
              ])
            ) : (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
                  검색 조건에 맞는 해지 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function TypeAnalysisDashboard({
  data,
  currentYear,
  isDirty,
  isSaving,
  saveMessage,
  weeklyImportSummary,
  onImportWeekly,
  onSave,
}: Props) {
  const [tab, setTab] = useState<TabKey>("summary")
  const [query, setQuery] = useState("")
  const normalizedQuery = normalizeSearch(query)

  const newRecords = Array.isArray(data?.newReplacement?.records) ? data.newReplacement.records : []
  const newIndustrySummary = Array.isArray(data?.newReplacement?.industrySummary) ? data.newReplacement.industrySummary : []
  const terminationRecords = Array.isArray(data?.terminationType?.records) ? data.terminationType.records : []
  const terminationIndustrySummary = Array.isArray(data?.terminationType?.industrySummary) ? data.terminationType.industrySummary : []
  const areaRecords = Array.isArray(data?.areaNetGrowth?.records) ? data.areaNetGrowth.records : []
  const personalRows = Array.isArray(data?.personalPerformance?.rows) ? data.personalPerformance.rows : []
  const snapshots = Array.isArray(data?.weeklySnapshots) ? data.weeklySnapshots : []
  const latestSnapshot = snapshots[0]

  const newTotal = findSummaryValue(data?.newReplacement?.replacementSummary || [], (label) => label.includes("합"))
  const pureNewTotal = findSummaryValue(data?.newReplacement?.replacementSummary || [], (label) => label.includes("신규"))
  const replacementTotal = Math.max(0, newTotal - pureNewTotal)
  const terminationTotal = findSummaryValue(data?.terminationType?.reasonSummary || [], (label) => label.includes("합"))
  const netTotal = newTotal - terminationTotal
  const industryRows = useMemo(() => newIndustrySummary.filter((row: any) => !isTotalIndustryRow(row)), [newIndustrySummary])
  const industryMatrixRows = useMemo(() => newIndustrySummary.filter((row: any) => row?.label), [newIndustrySummary])
  const terminationIndustryRows = useMemo(() => terminationIndustrySummary.filter((row: any) => !isTotalIndustryRow(row)), [terminationIndustrySummary])
  const terminationMatrixRows = useMemo(() => terminationIndustrySummary.filter((row: any) => row?.label), [terminationIndustrySummary])

  const filteredNewRecords = useMemo(
    () => newRecords.filter((row: any) => recordMatches(row, normalizedQuery)),
    [newRecords, normalizedQuery],
  )
  const groupedNewRecords = useMemo(() => {
    const buckets = new Map<string, any[]>()
    filteredNewRecords.forEach((row: any) => {
      const label = String(row?.group || "기타").trim() || "기타"
      buckets.set(label, [...(buckets.get(label) || []), row])
    })
    const orderedLabels = [
      ...industryRows.map((row: any) => String(row?.label || "").trim()).filter(Boolean),
      ...Array.from(buckets.keys()).filter((label) => !industryRows.some((row: any) => String(row?.label || "").trim() === label)),
    ]
    return orderedLabels
      .map((label) => ({ label, rows: buckets.get(label) || [] }))
      .filter((group) => group.rows.length > 0)
  }, [filteredNewRecords, industryRows])
  const filteredTerminationRecords = useMemo(
    () => terminationRecords.filter((row: any) => recordMatches(row, normalizedQuery)),
    [terminationRecords, normalizedQuery],
  )
  const groupedTerminationRecords = useMemo(() => {
    const buckets = new Map<string, any[]>()
    filteredTerminationRecords.forEach((row: any) => {
      const label = String(row?.group || "기타").trim() || "기타"
      buckets.set(label, [...(buckets.get(label) || []), row])
    })
    const orderedLabels = [
      ...terminationIndustryRows.map((row: any) => String(row?.label || "").trim()).filter(Boolean),
      ...Array.from(buckets.keys()).filter((label) => !terminationIndustryRows.some((row: any) => String(row?.label || "").trim() === label)),
    ]
    return orderedLabels
      .map((label) => ({ label, rows: buckets.get(label) || [] }))
      .filter((group) => group.rows.length > 0)
  }, [filteredTerminationRecords, terminationIndustryRows])
  const filteredAreaRecords = useMemo(
    () => areaRecords.filter((row: any) => recordMatches(row, normalizedQuery)),
    [areaRecords, normalizedQuery],
  )

  const visibleAreaRecords = filteredAreaRecords.slice(0, 300)

  const saveTone: "slate" | "blue" | "green" | "amber" = isSaving ? "blue" : isDirty ? "amber" : saveMessage ? "green" : "slate"
  const saveText = isSaving ? "저장 중" : isDirty ? "저장 필요" : saveMessage || "저장 완료"

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone="blue">{`${currentYear}년도`}</StatusPill>
                <StatusPill>{sourceTitle(data) || "엑셀 기준"}</StatusPill>
                <StatusPill tone={saveTone}>{saveText}</StatusPill>
              </div>
              <div className="mt-2 text-[18px] font-black text-slate-950">
                신규/대체/해지 유형 분석
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onImportWeekly}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 text-[13px] font-black text-blue-700 transition hover:bg-blue-100"
              >
                <RefreshCw className="h-4 w-4" />
                주간 신규/대체/해지 불러오기
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="inline-flex h-10 items-center gap-2 rounded-2xl bg-blue-600 px-4 text-[13px] font-black text-white shadow-[0_10px_22px_rgba(37,99,235,0.18)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className={`h-4 w-4 ${isSaving ? "animate-pulse" : ""}`} />
                저장
              </button>
            </div>
          </div>
        </div>

        <CompactKpiTable
          items={[
            { label: "신규", value: `${formatNumber(pureNewTotal)}건`, tone: "blue" },
            { label: "대체", value: `${formatNumber(replacementTotal)}건` },
            { label: "신규+대체", value: `${formatNumber(newTotal)}건` },
            { label: "해지", value: `${formatNumber(terminationTotal)}건`, tone: "rose" },
            { label: "순증", value: `${formatNumber(netTotal)}건`, tone: "green" },
          ]}
        />

        <div className="border-t border-slate-100 px-5 pb-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap gap-2">
              {tabItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`h-9 rounded-full px-4 text-[13px] font-black transition ${
                    tab === item.key
                      ? "bg-slate-950 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="relative block w-full lg:w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="회사명, ID, 담당자, 사유 검색"
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
        </div>
      </section>

      {tab === "summary" ? (
        <div className="grid gap-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <MiniSummaryTable title="업무성격 요약" rows={data?.newReplacement?.workSummary || []} />
            <MiniSummaryTable title="타사단말기 대체 요약" rows={data?.newReplacement?.replacementSummary || []} />
            <MiniSummaryTable title="해지 유형 요약" rows={data?.terminationType?.reasonSummary || []} />
            <MiniSummaryTable title="경쟁사 변경 요약" rows={data?.terminationType?.competitorSummary || []} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-[15px] font-black text-slate-900">
                <Database className="h-4 w-4 text-blue-600" />
                추출 현황
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricTile label="신규 상세" value={`${formatNumber(newRecords.length)}건`} />
                <MetricTile label="해지 상세" value={`${formatNumber(terminationRecords.length)}건`} />
                <MetricTile label="영역별 상세" value={`${formatNumber(areaRecords.length)}건`} />
                <MetricTile label="개인별 실적" value={`${formatNumber(personalRows.length)}명`} />
              </div>
              <div className="mt-3 text-[12px] font-semibold text-slate-500">
                원본 파일 수정 시각: {sourceUpdatedLabel(data?.sourceUpdatedAt) || "확인 필요"}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-[15px] font-black text-slate-900">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                주간 불러오기 저장본
              </div>
              {latestSnapshot ? (
                <div className="space-y-2 text-[13px] font-semibold text-slate-600">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    {latestSnapshot.label || "최근 불러오기"} · {compactDate(latestSnapshot.createdAt)}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-slate-200 px-3 py-2 text-center">
                      <div className="text-[11px] text-slate-400">신규/대체</div>
                      <div className="text-[17px] font-black text-slate-950">{formatNumber(latestSnapshot.newCount)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 px-3 py-2 text-center">
                      <div className="text-[11px] text-slate-400">해지</div>
                      <div className="text-[17px] font-black text-slate-950">{formatNumber(latestSnapshot.terminationCount)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 px-3 py-2 text-center">
                      <div className="text-[11px] text-slate-400">순증</div>
                      <div className="text-[17px] font-black text-slate-950">{formatNumber(latestSnapshot.netCount)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[13px] font-semibold text-slate-400">
                  아직 저장된 주간 불러오기 내역이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "new" ? (
        <div className="space-y-4">
          <IndustryMatrixTable rows={industryMatrixRows} />
          <GroupedNewRecordsTable groups={groupedNewRecords} />
        </div>
      ) : null}

      {tab === "termination" ? (
        <div className="space-y-4">
          <TerminationMatrixTable rows={terminationMatrixRows} />
          <GroupedTerminationRecordsTable groups={groupedTerminationRecords} />
        </div>
      ) : null}

      {tab === "area" ? (
        <div className="space-y-4">
          <DenseTable
            columns={[
              { key: "no", label: "구분", className: "w-[64px] text-center" },
              { key: "area", label: "담당영역", className: "min-w-[220px] font-semibold text-slate-900" },
              { key: "manager", label: "담당자", className: "min-w-[160px]" },
              { key: "newCount", label: "신규", className: "text-center tabular-nums" },
              { key: "terminationCount", label: "해지", className: "text-center tabular-nums" },
              { key: "netCount", label: "순증", className: "text-center font-black tabular-nums text-slate-950" },
            ]}
            rows={data?.areaNetGrowth?.summaryRows || []}
            emptyText="영역별 순증 요약이 없습니다."
          />
          <div className="flex items-center gap-2 text-[13px] font-bold text-slate-500">
            <Table2 className="h-4 w-4" />
            상세 {formatNumber(filteredAreaRecords.length)}건 중 {formatNumber(visibleAreaRecords.length)}건 표시
          </div>
          <DenseTable
            columns={[
              { key: "no", label: "NO", className: "w-[58px] text-center tabular-nums" },
              { key: "date", label: "날짜", className: "w-[96px] tabular-nums" },
              { key: "idCode", label: "ID", className: "w-[94px] font-bold text-slate-900" },
              { key: "companyName", label: "기관", className: "min-w-[170px] font-semibold text-slate-900" },
              { key: "departmentName", label: "부서", className: "min-w-[160px]" },
              { key: "recommender", label: "권유자", className: "w-[82px]" },
              { key: "replacementType", label: "구분", className: "w-[88px]" },
              { key: "group", label: "영역", className: "min-w-[140px]" },
            ]}
            rows={visibleAreaRecords}
            emptyText="검색 조건에 맞는 영역별 상세 데이터가 없습니다."
          />
        </div>
      ) : null}

      {tab === "personal" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-[15px] font-black text-slate-900">
              <UsersRound className="h-4 w-4 text-blue-600" />
              개인별 신규 실적
            </div>
            <DenseTable
              columns={[
                { key: "no", label: "구분", className: "w-[72px] text-center" },
                { key: "manager", label: "담당자", className: "min-w-[160px] font-bold text-slate-950" },
                { key: "totalNew", label: "총 신규", className: "text-center font-black tabular-nums text-slate-950" },
                { key: "new", label: "신규", className: "text-center tabular-nums" },
                { key: "check", label: "체크", className: "text-center tabular-nums" },
                { key: "marketPoint", label: "마켓", className: "text-center tabular-nums" },
                { key: "reutersBloomberg", label: "로이터/블룸", className: "text-center tabular-nums" },
              ]}
              rows={personalRows}
              emptyText="개인별 실적 데이터가 없습니다."
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
