"use client"

import { useMemo, useState } from "react"
import { BarChart3, Database, FileText, RefreshCw, Save, Search, UsersRound } from "lucide-react"

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

type ReportColumn = {
  label: string
  align?: "left" | "center" | "right"
  width?: string
  noWrap?: boolean
  get: (row: any, index: number) => unknown
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
    row?.transactionType,
    row?.kind,
    row?.group,
    row?.areaGroup,
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

function escapeReportHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function reportTimestamp() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date())
}

function reportCellClass(column: ReportColumn) {
  const align = column.align === "right" ? "right" : column.align === "center" ? "center" : "left"
  return [align, column.align === "right" ? "numeric" : "", column.noWrap ? "nowrap" : ""].filter(Boolean).join(" ")
}

function reportColGroup(columns: ReportColumn[]) {
  return `<colgroup>${columns
    .map((column) => `<col${column.width ? ` style="width:${escapeReportHtml(column.width)}"` : ""} />`)
    .join("")}</colgroup>`
}

function isReportTotalRow(row: any) {
  const markers = [row?.label, row?.no, row?.area, row?.manager]
    .map((value) => String(value ?? "").replace(/\s+/g, ""))
    .filter(Boolean)
  return markers.some((marker) => marker === "계" || marker.includes("합계"))
}

function reportTable(columns: ReportColumn[], rows: any[], emptyText: string) {
  const body = rows.length
    ? rows
        .map(
          (row, index) => `
            <tr class="${isReportTotalRow(row) ? "total-row" : ""}">
              ${columns
                .map((column) => `<td class="${reportCellClass(column)}">${escapeReportHtml(column.get(row, index))}</td>`)
                .join("")}
            </tr>`,
        )
        .join("")
    : `<tr><td class="empty" colspan="${columns.length}">${escapeReportHtml(emptyText)}</td></tr>`
  return `
    <table class="report-table">
      ${reportColGroup(columns)}
      <thead>
        <tr>${columns.map((column) => `<th class="${reportCellClass(column)}">${escapeReportHtml(column.label)}</th>`).join("")}</tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `
}

function groupedReportTable(groups: Array<{ label: string; rows: any[] }>, columns: ReportColumn[], emptyText: string) {
  const rows = groups.flatMap((group) => [
    { __group: true, label: group.label, count: group.rows.length },
    ...group.rows,
  ])
  if (!rows.length) return reportTable(columns, [], emptyText)
  return `
    <table class="report-table">
      ${reportColGroup(columns)}
      <thead>
        <tr>${columns.map((column) => `<th class="${reportCellClass(column)}">${escapeReportHtml(column.label)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map((row: any, index) => {
            if (row.__group) {
              return `<tr class="group-row"><td colspan="${columns.length}"><div class="group-title"><span>(${escapeReportHtml(row.label)})</span><strong>${formatNumber(row.count)}건</strong></div></td></tr>`
            }
            return `
              <tr class="${isReportTotalRow(row) ? "total-row" : ""}">
                ${columns
                  .map((column) => `<td class="${reportCellClass(column)}">${escapeReportHtml(column.get(row, index))}</td>`)
                  .join("")}
              </tr>
            `
          })
          .join("")}
      </tbody>
    </table>
  `
}

function makeGroups(records: any[], orderedLabels: string[], getLabel: (row: any) => string) {
  const buckets = new Map<string, any[]>()
  records.forEach((row) => {
    const label = getLabel(row) || "기타"
    buckets.set(label, [...(buckets.get(label) || []), row])
  })
  const labels = [
    ...orderedLabels.filter(Boolean),
    ...Array.from(buckets.keys()).filter((label) => !orderedLabels.includes(label)),
  ]
  return labels.map((label) => ({ label, rows: buckets.get(label) || [] })).filter((group) => group.rows.length > 0)
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
      <div className="mt-0.5 text-[20px] font-semibold tabular-nums text-slate-950">{value}</div>
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
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-[14px] font-semibold text-slate-900">{title}</div>
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3 lg:grid-cols-5">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0 px-3 py-3">
            <div className="truncate text-[12px] font-semibold text-slate-500">{row.label}</div>
            <div className="mt-1 text-[18px] font-semibold tabular-nums text-slate-950">{formatNumber(row.value)}</div>
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
                <th key={item.label} className="border-r border-slate-200 px-2 py-2 text-center font-semibold last:border-r-0">
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
                  <td key={item.label} className={`border-r border-slate-200 px-2 py-2 text-center text-[17px] font-semibold tabular-nums last:border-r-0 ${toneClass}`}>
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
                <th key={column.key} className={`px-3 py-2.5 text-left font-semibold ${column.className || ""}`}>
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
  { key: "new", label: "신규", className: "text-center font-semibold tabular-nums text-blue-700" },
  { key: "total", label: "합계", className: "text-center font-semibold tabular-nums text-slate-950" },
]

function IndustryMatrixTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
              {newReplacementIndustryColumns.map((column) => (
                <th key={column.key} className={`border-r border-slate-200 px-2 py-2 font-semibold last:border-r-0 ${column.className}`}>
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
                      <td key={column.key} className={`border-r border-slate-100 px-2 py-1.5 last:border-r-0 ${column.className} ${isTotal ? "font-semibold" : ""}`}>
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
      <div className="border-b border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-900">
        상세 목록 {formatNumber(totalCount)}건
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
              <th className="w-[56px] border-r border-slate-200 px-2 py-2 text-center font-semibold">NO</th>
              <th className="w-[92px] border-r border-slate-200 px-2 py-2 text-left font-semibold">날짜</th>
              <th className="w-[96px] border-r border-slate-200 px-2 py-2 text-left font-semibold">ID</th>
              <th className="min-w-[170px] border-r border-slate-200 px-2 py-2 text-left font-semibold">회사명</th>
              <th className="min-w-[150px] border-r border-slate-200 px-2 py-2 text-left font-semibold">부서</th>
              <th className="w-[86px] border-r border-slate-200 px-2 py-2 text-left font-semibold">권유자</th>
              <th className="w-[88px] border-r border-slate-200 px-2 py-2 text-left font-semibold">구분</th>
              <th className="min-w-[180px] px-2 py-2 text-left font-semibold">비고</th>
            </tr>
          </thead>
          <tbody>
            {groups.length ? (
              groups.flatMap((group) => [
                <tr key={`${group.label}-header`} className="border-y border-slate-300 bg-slate-50">
                  <td colSpan={8} className="px-3 py-1.5 text-[12px] font-semibold text-slate-900">
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
  { key: "total", label: "합계", className: "text-center font-semibold tabular-nums text-rose-700" },
]

function TerminationMatrixTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
              {terminationIndustryColumns.map((column) => (
                <th key={column.key} className={`border-r border-slate-200 px-2 py-2 font-semibold last:border-r-0 ${column.className}`}>
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
                      <td key={column.key} className={`border-r border-slate-100 px-2 py-1.5 last:border-r-0 ${column.className} ${isTotal ? "font-semibold" : ""}`}>
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
      <div className="border-b border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-900">
        상세 목록 {formatNumber(totalCount)}건
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
              <th className="w-[56px] border-r border-slate-200 px-2 py-2 text-center font-semibold">NO</th>
              <th className="w-[92px] border-r border-slate-200 px-2 py-2 text-left font-semibold">날짜</th>
              <th className="w-[96px] border-r border-slate-200 px-2 py-2 text-left font-semibold">ID</th>
              <th className="min-w-[170px] border-r border-slate-200 px-2 py-2 text-left font-semibold">회사명</th>
              <th className="min-w-[150px] border-r border-slate-200 px-2 py-2 text-left font-semibold">부서</th>
              <th className="w-[86px] border-r border-slate-200 px-2 py-2 text-left font-semibold">담당자</th>
              <th className="min-w-[140px] border-r border-slate-200 px-2 py-2 text-left font-semibold">해지사유</th>
              <th className="w-[98px] border-r border-slate-200 px-2 py-2 text-right font-semibold">위약금</th>
              <th className="min-w-[180px] px-2 py-2 text-left font-semibold">비고</th>
            </tr>
          </thead>
          <tbody>
            {groups.length ? (
              groups.flatMap((group) => [
                <tr key={`${group.label}-header`} className="border-y border-slate-300 bg-slate-50">
                  <td colSpan={9} className="px-3 py-1.5 text-[12px] font-semibold text-slate-900">
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

const areaSummaryColumns = [
  { key: "no", label: "구분", className: "w-[64px] text-center font-bold text-slate-700" },
  { key: "area", label: "담당영역", className: "min-w-[260px] text-left font-bold text-slate-900" },
  { key: "manager", label: "담당자", className: "min-w-[260px] text-left text-slate-600" },
  { key: "newCount", label: "신규", className: "w-[96px] text-center font-semibold tabular-nums text-blue-700" },
  { key: "terminationCount", label: "해지", className: "w-[96px] text-center font-semibold tabular-nums text-rose-700" },
  { key: "netCount", label: "순증", className: "w-[96px] text-center font-semibold tabular-nums text-slate-950" },
]

function AreaSummaryTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
              {areaSummaryColumns.map((column) => (
                <th key={column.key} className={`border-r border-slate-200 px-2 py-2 font-semibold last:border-r-0 ${column.className}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, index) => {
                const isTotal = String(row?.no || "").replace(/\s+/g, "") === "계"
                return (
                  <tr key={`${row?.area || row?.no || "area"}-${index}`} className={`border-b border-slate-100 last:border-0 ${isTotal ? "bg-amber-50" : ""}`}>
                    {areaSummaryColumns.map((column) => (
                      <td key={column.key} className={`border-r border-slate-100 px-2 py-1.5 last:border-r-0 ${column.className} ${isTotal ? "font-semibold" : ""}`}>
                        {["newCount", "terminationCount", "netCount"].includes(column.key) ? formatNumber(row?.[column.key]) : row?.[column.key]}
                      </td>
                    ))}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={areaSummaryColumns.length} className="px-4 py-8 text-center text-[13px] font-semibold text-slate-400">
                  영역별 순증 요약이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GroupedAreaRecordsTable({ groups }: { groups: Array<{ label: string; rows: any[] }> }) {
  const totalCount = groups.reduce((sum, group) => sum + group.rows.length, 0)
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-900">
        상세 목록 {formatNumber(totalCount)}건
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
              <th className="w-[56px] border-r border-slate-200 px-2 py-2 text-center font-semibold">NO</th>
              <th className="w-[86px] border-r border-slate-200 px-2 py-2 text-center font-semibold">구분</th>
              <th className="w-[92px] border-r border-slate-200 px-2 py-2 text-left font-semibold">날짜</th>
              <th className="w-[96px] border-r border-slate-200 px-2 py-2 text-left font-semibold">ID</th>
              <th className="min-w-[180px] border-r border-slate-200 px-2 py-2 text-left font-semibold">기관</th>
              <th className="min-w-[150px] border-r border-slate-200 px-2 py-2 text-left font-semibold">부서</th>
              <th className="w-[130px] border-r border-slate-200 px-2 py-2 text-left font-semibold">세부구분</th>
              <th className="min-w-[180px] px-2 py-2 text-left font-semibold">비고</th>
            </tr>
          </thead>
          <tbody>
            {groups.length ? (
              groups.flatMap((group) => [
                <tr key={`${group.label}-header`} className="border-y border-slate-300 bg-slate-50">
                  <td colSpan={8} className="px-3 py-1.5 text-[12px] font-semibold text-slate-900">
                    ({group.label}) <span className="ml-1 text-slate-500">{formatNumber(group.rows.length)}건</span>
                  </td>
                </tr>,
                ...group.rows.map((row, index) => {
                  const isTermination = row?.kind === "termination" || row?.transactionType === "해지"
                  const tone = isTermination ? "border-rose-100 bg-rose-50 text-rose-700" : "border-blue-100 bg-blue-50 text-blue-700"
                  return (
                    <tr key={`${group.label}-${row?.id || row?.sourceId || row?.idCode || index}`} className={`border-b border-slate-100 ${isTermination ? "hover:bg-rose-50/30" : "hover:bg-blue-50/30"}`}>
                      <td className="border-r border-slate-100 px-2 py-1.5 text-center tabular-nums text-slate-600">{row.no || index + 1}</td>
                      <td className="border-r border-slate-100 px-2 py-1.5 text-center">
                        <span className={`inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-semibold ${tone}`}>
                          {isTermination ? "해지" : "신규/대체"}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 px-2 py-1.5 tabular-nums text-slate-600">{row.date}</td>
                      <td className="border-r border-slate-100 px-2 py-1.5 font-bold text-slate-900">{row.idCode}</td>
                      <td className="border-r border-slate-100 px-2 py-1.5 font-semibold text-slate-900">{row.companyName}</td>
                      <td className="border-r border-slate-100 px-2 py-1.5 text-slate-600">{row.departmentName}</td>
                      <td className="border-r border-slate-100 px-2 py-1.5 font-semibold text-slate-700">{isTermination ? row.reason : row.replacementType || "신규"}</td>
                      <td className="px-2 py-1.5 text-slate-600">{row.note}</td>
                    </tr>
                  )
                }),
              ])
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
                  검색 조건에 맞는 영역별 순증 데이터가 없습니다.
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
  const areaSummaryRows = Array.isArray(data?.areaNetGrowth?.summaryRows) ? data.areaNetGrowth.summaryRows : []
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
  const areaRows = useMemo(() => areaSummaryRows.filter((row: any) => String(row?.no || "").replace(/\s+/g, "") !== "계"), [areaSummaryRows])

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
  const groupedAreaRecords = useMemo(() => {
    const buckets = new Map<string, any[]>()
    filteredAreaRecords.forEach((row: any) => {
      const label = String(row?.areaGroup || row?.group || "기타").trim() || "기타"
      buckets.set(label, [...(buckets.get(label) || []), row])
    })
    const orderedLabels = [
      ...areaRows.map((row: any) => String(row?.area || "").trim()).filter(Boolean),
      ...Array.from(buckets.keys()).filter((label) => !areaRows.some((row: any) => String(row?.area || "").trim() === label)),
    ]
    return orderedLabels
      .map((label) => ({ label, rows: buckets.get(label) || [] }))
      .filter((group) => group.rows.length > 0)
  }, [filteredAreaRecords, areaRows])

  const saveTone: "slate" | "blue" | "green" | "amber" = isSaving ? "blue" : isDirty ? "amber" : saveMessage ? "green" : "slate"
  const saveText = isSaving ? "저장 중" : isDirty ? "저장 필요" : saveMessage || "저장 완료"

  function handlePrintReport() {
    const reportNewGroups = makeGroups(
      newRecords,
      industryRows.map((row: any) => String(row?.label || "").trim()),
      (row) => String(row?.group || "기타").trim(),
    )
    const reportTerminationGroups = makeGroups(
      terminationRecords,
      terminationIndustryRows.map((row: any) => String(row?.label || "").trim()),
      (row) => String(row?.group || "기타").trim(),
    )
    const reportAreaGroups = makeGroups(
      areaRecords,
      areaRows.map((row: any) => String(row?.area || "").trim()),
      (row) => String(row?.areaGroup || row?.group || "기타").trim(),
    )

    const simpleColumns: ReportColumn[] = [
      { label: "구분", width: "68%", get: (row) => row.label || row.area || row.manager || row.no },
      { label: "값", width: "32%", align: "right", noWrap: true, get: (row) => `${formatNumber(row.value ?? row.totalNew ?? row.netCount ?? 0)}` },
    ]
    const newIndustryColumns: ReportColumn[] = [
      { label: "업종", width: "34%", get: (row) => row.label },
      { label: "체크", width: "9%", align: "right", noWrap: true, get: (row) => formatNumber(row.check) },
      { label: "마켓", width: "9%", align: "right", noWrap: true, get: (row) => formatNumber(row.marketPoint) },
      { label: "블룸", width: "9%", align: "right", noWrap: true, get: (row) => formatNumber(row.bloomberg) },
      { label: "로이터", width: "9%", align: "right", noWrap: true, get: (row) => formatNumber(row.reuters) },
      { label: "기타", width: "9%", align: "right", noWrap: true, get: (row) => formatNumber(row.hankyungEtc) },
      { label: "신규", width: "10%", align: "right", noWrap: true, get: (row) => formatNumber(row.new) },
      { label: "합계", width: "11%", align: "right", noWrap: true, get: (row) => formatNumber(row.total) },
    ]
    const newDetailColumns: ReportColumn[] = [
      { label: "NO", width: "5%", align: "center", noWrap: true, get: (row) => row.no },
      { label: "날짜", width: "9%", noWrap: true, get: (row) => row.date },
      { label: "ID", width: "9%", noWrap: true, get: (row) => row.idCode },
      { label: "회사명", width: "18%", get: (row) => row.companyName },
      { label: "부서", width: "17%", get: (row) => row.departmentName },
      { label: "권유자", width: "8%", noWrap: true, get: (row) => row.recommender },
      { label: "구분", width: "9%", noWrap: true, get: (row) => row.replacementType || "신규" },
      { label: "비고", width: "25%", get: (row) => row.note },
    ]
    const terminationIndustryColumnsForReport: ReportColumn[] = [
      { label: "업종", width: "27%", get: (row) => row.label },
      { label: "퇴사/이직", width: "7.3%", align: "right", noWrap: true, get: (row) => formatNumber(row.userMove) },
      { label: "비용절감", width: "7.3%", align: "right", noWrap: true, get: (row) => formatNumber(row.costCut) },
      { label: "활용저조", width: "7.3%", align: "right", noWrap: true, get: (row) => formatNumber(row.lowUsage) },
      { label: "타사대체", width: "7.3%", align: "right", noWrap: true, get: (row) => formatNumber(row.contentOrCompetitor) },
      { label: "계약만료", width: "7.3%", align: "right", noWrap: true, get: (row) => formatNumber(row.contractEnd) },
      { label: "조직개편", width: "7.3%", align: "right", noWrap: true, get: (row) => formatNumber(row.reorg) },
      { label: "휴직/출장", width: "7.3%", align: "right", noWrap: true, get: (row) => formatNumber(row.leave) },
      { label: "합병매각", width: "7.3%", align: "right", noWrap: true, get: (row) => formatNumber(row.merger) },
      { label: "미수", width: "7.3%", align: "right", noWrap: true, get: (row) => formatNumber(row.unpaid) },
      { label: "합계", width: "7%", align: "right", noWrap: true, get: (row) => formatNumber(row.total) },
    ]
    const terminationDetailColumns: ReportColumn[] = [
      { label: "NO", width: "5%", align: "center", noWrap: true, get: (row) => row.no },
      { label: "날짜", width: "9%", noWrap: true, get: (row) => row.date },
      { label: "ID", width: "9%", noWrap: true, get: (row) => row.idCode },
      { label: "회사명", width: "18%", get: (row) => row.companyName },
      { label: "부서", width: "17%", get: (row) => row.departmentName },
      { label: "담당자", width: "8%", noWrap: true, get: (row) => row.recommender },
      { label: "해지사유", width: "13%", get: (row) => row.reason },
      { label: "위약금", width: "9%", align: "right", noWrap: true, get: (row) => formatNumber(row.penalty) },
      { label: "비고", width: "12%", get: (row) => row.note },
    ]
    const areaColumns: ReportColumn[] = [
      { label: "구분", width: "6%", align: "center", noWrap: true, get: (row) => row.no },
      { label: "담당영역", width: "30%", get: (row) => row.area },
      { label: "담당자", width: "34%", get: (row) => row.manager },
      { label: "신규", width: "10%", align: "right", noWrap: true, get: (row) => formatNumber(row.newCount) },
      { label: "해지", width: "10%", align: "right", noWrap: true, get: (row) => formatNumber(row.terminationCount) },
      { label: "순증", width: "10%", align: "right", noWrap: true, get: (row) => formatNumber(row.netCount) },
    ]
    const areaDetailColumns: ReportColumn[] = [
      { label: "NO", width: "5%", align: "center", noWrap: true, get: (row) => row.no },
      { label: "구분", width: "8%", noWrap: true, get: (row) => (row.kind === "termination" || row.transactionType === "해지" ? "해지" : "신규/대체") },
      { label: "날짜", width: "9%", noWrap: true, get: (row) => row.date },
      { label: "ID", width: "9%", noWrap: true, get: (row) => row.idCode },
      { label: "기관", width: "20%", get: (row) => row.companyName },
      { label: "부서", width: "18%", get: (row) => row.departmentName },
      { label: "세부구분", width: "12%", get: (row) => row.reason || row.replacementType || "신규" },
      { label: "비고", width: "19%", get: (row) => row.note },
    ]
    const personalColumns: ReportColumn[] = [
      { label: "구분", width: "8%", align: "center", noWrap: true, get: (row) => row.no },
      { label: "담당자", width: "28%", get: (row) => row.manager },
      { label: "총 신규", width: "13%", align: "right", noWrap: true, get: (row) => formatNumber(row.totalNew) },
      { label: "신규", width: "13%", align: "right", noWrap: true, get: (row) => formatNumber(row.new) },
      { label: "체크", width: "12%", align: "right", noWrap: true, get: (row) => formatNumber(row.check) },
      { label: "마켓", width: "12%", align: "right", noWrap: true, get: (row) => formatNumber(row.marketPoint) },
      { label: "로이터/블룸", width: "14%", align: "right", noWrap: true, get: (row) => formatNumber(row.reutersBloomberg) },
    ]

    const html = `<!doctype html>
      <html lang="ko">
        <head>
          <meta charset="utf-8" />
          <title>신규 대체 해지 유형 분석 리포트</title>
          <style>
            @page { size: A4 landscape; margin: 10mm 9mm 11mm; }
            * { box-sizing: border-box; }
            html { background: #eef2f7; }
            body { margin: 0; color: #0f172a; font-family: "Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif; background: #eef2f7; }
            .toolbar { position: sticky; top: 0; z-index: 2; display: flex; justify-content: flex-end; gap: 8px; padding: 12px; background: rgba(248, 250, 252, 0.94); border-bottom: 1px solid #e2e8f0; }
            .toolbar button { height: 34px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; padding: 0 12px; color: #0f172a; font-size: 12px; font-weight: 600; cursor: pointer; }
            .report { width: 100%; max-width: 1120px; margin: 0 auto; padding: 20px 22px 42px; background: #fff; box-shadow: 0 18px 50px rgba(15, 23, 42, .08); }
            .cover { border-top: 4px solid #0b1f3a; border-bottom: 1px solid #94a3b8; padding: 14px 0 12px; }
            .cover-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
            .eyebrow { color: #0b1f3a; font-size: 9px; font-weight: 700; letter-spacing: .14em; }
            h1 { margin: 6px 0 0; font-size: 21px; line-height: 1.22; font-weight: 700; letter-spacing: 0; color: #07111f; }
            .report-code { flex: 0 0 auto; border: 1px solid #cbd5e1; border-radius: 999px; padding: 5px 9px; color: #334155; font-size: 9px; font-weight: 700; letter-spacing: .04em; background: #f8fafc; }
            .meta { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; color: #475569; font-size: 10px; }
            .meta span::before { content: ""; display: inline-block; width: 3px; height: 3px; margin: 0 6px 2px 0; border-radius: 999px; background: #64748b; }
            .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; margin: 12px 0 8px; border: 1px solid #cbd5e1; border-radius: 2px; overflow: hidden; }
            .kpi { min-height: 50px; border-right: 1px solid #e2e8f0; padding: 8px 10px; background: #fff; }
            .kpi:last-child { border-right: 0; }
            .kpi .label { color: #475569; font-size: 9px; font-weight: 700; letter-spacing: .04em; }
            .kpi .value { margin-top: 2px; font-size: 17px; font-weight: 700; color: #0b1f3a; text-align: right; font-variant-numeric: tabular-nums; }
            .section { margin-top: 14px; break-inside: avoid; }
            .section.page { break-before: page; }
            h2 { margin: 0 0 8px; padding-bottom: 5px; border-bottom: 1px solid #0b1f3a; font-size: 14px; font-weight: 700; color: #0b1f3a; }
            h3 { margin: 11px 0 5px; font-size: 10.5px; font-weight: 700; color: #334155; }
            .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; align-items: start; }
            .report-table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #fff; border: 1px solid #cbd5e1; }
            .report-table th { border: 1px solid #cbd5e1; background: #eaf0f7; color: #0f2742; padding: 4px 5px; font-size: 8.4px; line-height: 1.25; font-weight: 700; text-align: center; word-break: keep-all; white-space: nowrap; }
            .report-table td { border: 1px solid #e2e8f0; padding: 3.5px 5px; font-size: 8.2px; line-height: 1.28; font-weight: 400; vertical-align: middle; word-break: keep-all; overflow-wrap: anywhere; }
            .report-table tbody tr:nth-child(even):not(.group-row):not(.total-row) td { background: #fbfdff; }
            .report-table .center { text-align: center; }
            .report-table .right { text-align: right; }
            .report-table .left { text-align: left; }
            .report-table .numeric { font-variant-numeric: tabular-nums; }
            .report-table .nowrap { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .report-table .empty { text-align: center; color: #94a3b8; padding: 16px; }
            .total-row td { background: #fff7ed !important; color: #0f172a; font-weight: 700; }
            .group-row td { background: #f1f5f9 !important; color: #0f172a; font-weight: 700; border-top: 1.5px solid #94a3b8; border-bottom: 1px solid #cbd5e1; }
            .group-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
            .group-title span { color: #0f172a; }
            .group-title strong { color: #475569; font-size: 8.5px; font-weight: 700; white-space: nowrap; }
            .note { margin-top: 7px; color: #64748b; font-size: 9px; }
            .print-footer { position: fixed; left: 9mm; right: 9mm; bottom: 4mm; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 3px; color: #94a3b8; font-size: 8px; }
            @media print {
              html, body { background: #fff; }
              .toolbar { display: none; }
              .report { max-width: none; padding: 0 0 8mm; box-shadow: none; }
              .section { break-inside: auto; }
              .summary-grid { gap: 6px; }
              .report-table th, .report-table td, .kpi, .total-row td, .group-row td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <button onclick="window.print()">PDF 저장/출력</button>
            <button onclick="window.close()">닫기</button>
          </div>
          <main class="report">
            <header class="cover">
              <div class="cover-row">
                <div>
                  <div class="eyebrow">INFOBIZ PERFORMANCE RESEARCH</div>
                  <h1>신규/대체/해지 유형 분석 리포트</h1>
                </div>
                <div class="report-code">TYPE ANALYSIS / ${escapeReportHtml(currentYear)}</div>
              </div>
              <div class="meta">
                <span>기준연도 ${escapeReportHtml(currentYear)}년도</span>
                <span>기준 ${escapeReportHtml(sourceTitle(data) || "엑셀 기준")}</span>
                <span>생성 ${escapeReportHtml(reportTimestamp())}</span>
              </div>
            </header>

            <div class="kpis">
              <div class="kpi"><div class="label">신규</div><div class="value">${formatNumber(pureNewTotal)}건</div></div>
              <div class="kpi"><div class="label">대체</div><div class="value">${formatNumber(replacementTotal)}건</div></div>
              <div class="kpi"><div class="label">신규+대체</div><div class="value">${formatNumber(newTotal)}건</div></div>
              <div class="kpi"><div class="label">해지</div><div class="value">${formatNumber(terminationTotal)}건</div></div>
              <div class="kpi"><div class="label">순증</div><div class="value">${formatNumber(netTotal)}건</div></div>
            </div>

            <section class="section">
              <h2>요약</h2>
              <div class="summary-grid">
                <div><h3>업무성격 요약</h3>${reportTable(simpleColumns, data?.newReplacement?.workSummary || [], "데이터 없음")}</div>
                <div><h3>타사단말기 대체 요약</h3>${reportTable(simpleColumns, data?.newReplacement?.replacementSummary || [], "데이터 없음")}</div>
                <div><h3>해지 유형 요약</h3>${reportTable(simpleColumns, data?.terminationType?.reasonSummary || [], "데이터 없음")}</div>
                <div><h3>경쟁사 변경 요약</h3>${reportTable(simpleColumns, data?.terminationType?.competitorSummary || [], "데이터 없음")}</div>
              </div>
              <div class="note">원본 파일 수정 시각: ${escapeReportHtml(sourceUpdatedLabel(data?.sourceUpdatedAt) || "확인 필요")}</div>
            </section>

            <section class="section page">
              <h2>신규/대체</h2>
              ${reportTable(newIndustryColumns, industryMatrixRows, "업종별 신규/대체 요약이 없습니다.")}
              <h3>상세 목록</h3>
              ${groupedReportTable(reportNewGroups, newDetailColumns, "신규/대체 상세 데이터가 없습니다.")}
            </section>

            <section class="section page">
              <h2>해지</h2>
              ${reportTable(terminationIndustryColumnsForReport, terminationMatrixRows, "업종별 해지 요약이 없습니다.")}
              <h3>상세 목록</h3>
              ${groupedReportTable(reportTerminationGroups, terminationDetailColumns, "해지 상세 데이터가 없습니다.")}
            </section>

            <section class="section page">
              <h2>영역별 순증</h2>
              ${reportTable(areaColumns, areaSummaryRows, "영역별 순증 요약이 없습니다.")}
              <h3>상세 목록</h3>
              ${groupedReportTable(reportAreaGroups, areaDetailColumns, "영역별 상세 데이터가 없습니다.")}
            </section>

            <section class="section page">
              <h2>개인별 실적</h2>
              ${reportTable(personalColumns, personalRows, "개인별 실적 데이터가 없습니다.")}
            </section>
            <div class="print-footer">
              <span>연합인포맥스 인포Biz본부</span>
              <span>Confidential Internal Report</span>
            </div>
          </main>
          <script>
            window.addEventListener("load", () => {
              setTimeout(() => window.print(), 350);
            });
          </script>
        </body>
      </html>`

    const popup = window.open("", "_blank", "width=1180,height=900")
    if (!popup) {
      window.alert("팝업이 차단되었습니다. 브라우저 팝업 허용 후 다시 시도해주세요.")
      return
    }
    popup.document.open()
    popup.document.write(html)
    popup.document.close()
    popup.focus()
  }

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
              <div className="mt-2 text-[18px] font-semibold text-slate-950">
                신규/대체/해지 유형 분석
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onImportWeekly}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 text-[13px] font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <RefreshCw className="h-4 w-4" />
                주간 신규/대체/해지 불러오기
              </button>
              <button
                type="button"
                onClick={handlePrintReport}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <FileText className="h-4 w-4" />
                리포트 PDF
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-[13px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className={`h-9 rounded-full px-4 text-[13px] font-semibold transition ${
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
              <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
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
              <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
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
                      <div className="text-[17px] font-semibold text-slate-950">{formatNumber(latestSnapshot.newCount)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 px-3 py-2 text-center">
                      <div className="text-[11px] text-slate-400">해지</div>
                      <div className="text-[17px] font-semibold text-slate-950">{formatNumber(latestSnapshot.terminationCount)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 px-3 py-2 text-center">
                      <div className="text-[11px] text-slate-400">순증</div>
                      <div className="text-[17px] font-semibold text-slate-950">{formatNumber(latestSnapshot.netCount)}</div>
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
          <AreaSummaryTable rows={areaSummaryRows} />
          <GroupedAreaRecordsTable groups={groupedAreaRecords} />
        </div>
      ) : null}

      {tab === "personal" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <UsersRound className="h-4 w-4 text-blue-600" />
              개인별 신규 실적
            </div>
            <DenseTable
              columns={[
                { key: "no", label: "구분", className: "w-[72px] text-center" },
                { key: "manager", label: "담당자", className: "min-w-[160px] font-bold text-slate-950" },
                { key: "totalNew", label: "총 신규", className: "text-center font-semibold tabular-nums text-slate-950" },
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
