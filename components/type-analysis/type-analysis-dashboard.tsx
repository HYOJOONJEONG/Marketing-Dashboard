"use client"

import { useMemo, useState } from "react"
import { FileText, RefreshCw, Save } from "lucide-react"

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
  industryMoveOptions?: string[]
  areaMoveOptions?: string[]
  onImportWeekly: () => void
  onSave: () => void
  onMoveRecord?: (
    kind: "new" | "termination",
    record: any,
    target: string,
    targetKind: "industry" | "area",
  ) => void
}

type ReportColumn = {
  label: string
  align?: "left" | "center" | "right"
  width?: string
  noWrap?: boolean
  cssClass?: string
  get: (row: any, index: number) => unknown
}

type DateSortDir = "desc" | "asc"

const tabItems: Array<{ key: TabKey; label: string }> = [
  { key: "summary", label: "요약" },
  { key: "new", label: "신규/대체" },
  { key: "termination", label: "해지" },
  { key: "area", label: "영역별 순증" },
  { key: "personal", label: "개인별 실적" },
]

const ADMIN_TITLE_BY_NAME: Record<string, string> = {
  이상철: "본부장",
  신무길: "팀장",
  이홍민: "부장",
  정효준: "과장",
  조홍희: "대리",
  정진영: "사원",
  박혜리: "사원",
  윤옥수: "팀장",
  진효정: "과장",
  김다빈: "사원",
  김대일: "사원",
}

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

function normalizeSummaryLabel(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "")
}

function exactSummaryValueByLabel(rows: any[], labels: string[]) {
  const normalizedLabels = labels.map(normalizeSummaryLabel)
  const row = (Array.isArray(rows) ? rows : []).find((item) => {
    const label = normalizeSummaryLabel(item?.label)
    return normalizedLabels.includes(label)
  })
  return row ? toNumber(row.value) : null
}

function summaryTotalValue(rows: any[]) {
  return exactSummaryValueByLabel(rows, ["합계", "합", "계", "총계"]) ?? 0
}

function summaryValueByLabel(rows: any[], matchers: string[]) {
  const normalizedMatchers = matchers.map(normalizeSummaryLabel)
  if (normalizedMatchers.some((matcher) => ["합계", "합", "계", "총계"].includes(matcher))) {
    const exactTotal = exactSummaryValueByLabel(rows, ["합계", "합", "계", "총계"])
    if (exactTotal !== null) return exactTotal
  }
  return findSummaryValue(rows, (label) => {
    const normalizedLabel = normalizeSummaryLabel(label)
    return normalizedMatchers.some((matcher) => normalizedLabel.includes(matcher))
  })
}

function excelNumber(value: unknown, dashZero = false) {
  const number = toNumber(value)
  if (dashZero && number === 0) return "-"
  return formatNumber(number)
}

function getRecordDateLabel(row: any) {
  return compactDate(row?.date || row?.reflectedDate || row?.createdAt || "")
}

function dateSortValue(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "")
  if (digits.length >= 8) return Number(digits.slice(0, 8))
  return 0
}

function sortRecordsByReflectionDate(records: any[], dir: DateSortDir) {
  const sign = dir === "asc" ? 1 : -1
  return [...records].sort((a: any, b: any) => {
    const diff = dateSortValue(getRecordDateLabel(a)) - dateSortValue(getRecordDateLabel(b))
    if (diff) return diff * sign
    return toNumber(a?.no) - toNumber(b?.no)
  })
}

function normalizeManagerLabel(value: unknown) {
  const text = String(value ?? "").trim()
  const matchedName = Object.keys(ADMIN_TITLE_BY_NAME).find((name) => text === name || text.startsWith(`${name} `))
  if (!matchedName) return text
  return `${matchedName} ${ADMIN_TITLE_BY_NAME[matchedName]}`
}

const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

function normalizedAsOfDateText(value: unknown) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/^기준\s*/g, "")
    .replace(/\s*기준\s*$/g, "")
    .trim()
  if (!cleaned) return ""

  const match = cleaned.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:\s*\(?([월화수목금토일])\)?)?/)
  if (!match) return cleaned.replace(/^\((.*)\)$/g, "$1").trim()

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const weekday = match[4] || KOREAN_WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] || ""
  return `${String(year).padStart(4, "0")}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}${weekday ? `(${weekday})` : ""}`
}

function sourceTitle(data: any) {
  return normalizedAsOfDateText(
    data?.newReplacement?.asOf ||
      data?.terminationType?.asOf ||
      data?.areaNetGrowth?.asOf ||
      data?.personalPerformance?.asOf ||
      "",
  )
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
  return [align, column.align === "right" ? "numeric" : "", column.noWrap ? "nowrap" : "", column.cssClass || ""].filter(Boolean).join(" ")
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
  return markers.some((marker) => marker === "계" || marker === "총계" || marker.includes("합계"))
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

function groupedReportTable(
  groups: Array<{ label: string; rows: any[] }>,
  columns: ReportColumn[],
  emptyText: string,
  groupLabel = "업종",
) {
  let detailNo = 0
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
              return `<tr class="group-row"><td colspan="${columns.length}"><div class="group-title"><span><em>${escapeReportHtml(groupLabel)}</em><b>${escapeReportHtml(row.label)}</b></span><strong>${formatNumber(row.count)}건</strong></div></td></tr>`
            }
            const rowForReport = { ...row, reportNo: ++detailNo }
            return `
              <tr class="${isReportTotalRow(row) ? "total-row" : ""}">
                ${columns
                  .map((column) => `<td class="${reportCellClass(column)}">${escapeReportHtml(column.get(rowForReport, detailNo - 1))}</td>`)
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

function buildMoveOptions(options: string[] = [], current: unknown) {
  const currentText = String(current || "").trim()
  const base = options.map((item) => String(item || "").trim()).filter(Boolean)
  return currentText && !base.includes(currentText) ? [currentText, ...base] : base
}

function MoveSelect({
  value,
  options,
  label,
  onChange,
}: {
  value: string
  options: string[]
  label: string
  onChange: (value: string) => void
}) {
  const items = buildMoveOptions(options, value)
  if (!items.length) return <span className="text-slate-300">-</span>
  return (
    <select
      className="h-7 w-full min-w-[190px] rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      value={value || items[0]}
      onChange={(event) => {
        const nextValue = event.target.value
        if (nextValue && nextValue !== value) onChange(nextValue)
      }}
      aria-label={label}
    >
      {items.map((item) => (
        <option key={item} value={item}>{item}</option>
      ))}
    </select>
  )
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

type TypeAnalysisTone = "blue" | "indigo" | "rose" | "emerald" | "slate"

function toneClass(tone: TypeAnalysisTone, part: "text" | "border" | "bg" | "softBg" | "ring") {
  const map = {
    blue: {
      text: "text-blue-700",
      border: "border-blue-100",
      bg: "bg-blue-600",
      softBg: "bg-blue-50",
      ring: "ring-blue-100",
    },
    indigo: {
      text: "text-indigo-700",
      border: "border-indigo-100",
      bg: "bg-indigo-600",
      softBg: "bg-indigo-50",
      ring: "ring-indigo-100",
    },
    rose: {
      text: "text-rose-700",
      border: "border-rose-100",
      bg: "bg-rose-600",
      softBg: "bg-rose-50",
      ring: "ring-rose-100",
    },
    emerald: {
      text: "text-emerald-700",
      border: "border-emerald-100",
      bg: "bg-emerald-600",
      softBg: "bg-emerald-50",
      ring: "ring-emerald-100",
    },
    slate: {
      text: "text-slate-700",
      border: "border-slate-200",
      bg: "bg-slate-700",
      softBg: "bg-slate-50",
      ring: "ring-slate-100",
    },
  } as const
  return map[tone][part]
}

function AnalysisCardHeader({
  eyebrow,
  title,
  asOf,
  tone = "blue",
}: {
  eyebrow: string
  title: string
  asOf: string
  tone?: TypeAnalysisTone
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className={`text-[11px] font-bold uppercase tracking-[0.16em] ${toneClass(tone, "text")}`}>{eyebrow}</div>
        <h2 className="mt-1 text-[20px] font-black tracking-[-0.03em] text-slate-950">{title}</h2>
      </div>
      <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-[12px] font-bold ${toneClass("rose", "border")} ${toneClass("rose", "softBg")} ${toneClass("rose", "text")}`}>
        {asOfBadgeLabel(asOf)}
      </span>
    </div>
  )
}

function CompactMetricBand({
  title,
  tone = "blue",
  items,
}: {
  title: string
  tone?: TypeAnalysisTone
  items: Array<{ label: string; value: unknown; sub?: string; title?: string; total?: boolean; dashZero?: boolean }>
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${toneClass(tone, "border")}`}>
      <div className={`border-b px-4 py-2.5 text-center ${toneClass(tone, "border")} ${toneClass(tone, "softBg")}`}>
        <div className={`text-[12px] font-black ${toneClass(tone, "text")}`}>{title}</div>
      </div>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-full gap-px bg-slate-100"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(94px, 1fr))` }}
        >
          {items.map((item) => {
            const value = typeof item.value === "string" ? item.value : excelNumber(item.value, item.dashZero)
            return (
              <div
                key={`${title}-${item.label}-${item.sub || ""}`}
                className={`flex min-h-[74px] flex-col items-center justify-center bg-white px-3 py-2.5 text-center transition hover:bg-slate-50 ${item.total ? toneClass(tone, "softBg") : ""}`}
              >
                <div title={item.title || item.label} className="max-w-full truncate whitespace-nowrap text-[12px] font-bold text-slate-600">
                  {item.label}
                </div>
                {item.sub ? <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{item.sub}</div> : null}
                <div className={`mt-1 text-[19px] font-black tabular-nums ${item.total ? toneClass(tone, "text") : "text-slate-950"}`}>
                  {value}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SimpleKpiGrid({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: TypeAnalysisTone; sub?: string }>
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {items.map((item) => {
        const tone = item.tone || "slate"
        return (
          <div key={item.label} className={`relative overflow-hidden rounded-2xl border bg-white px-4 py-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass(tone, "border")}`}>
            <div className={`absolute inset-x-0 top-0 h-1 ${toneClass(tone, "bg")}`} />
            <div className="text-[12px] font-black text-slate-500">{item.label}</div>
            <div className={`mt-1 text-[25px] font-black tabular-nums tracking-normal ${toneClass(tone, "text")}`}>{item.value}</div>
            {item.sub ? <div className="mt-1 truncate text-[11px] font-semibold text-slate-400">{item.sub}</div> : null}
          </div>
        )
      })}
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
            <div className="mt-1 text-right text-[18px] font-semibold tabular-nums text-slate-950">{formatNumber(row.value)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function isTotalIndustryRow(row: any) {
  const label = String(row?.label || "").replace(/\s+/g, "")
  return label === "계" || label.includes("합계")
}

function industryLabelParts(value: unknown) {
  const text = String(value || "").trim()
  if (!text) return { title: "-", detail: "", hasDetail: false }
  if (text === "계" || text.includes("합계")) return { title: text, detail: "", hasDetail: false }

  const baseText = text.replace(/\([^)]*\)\s*$/g, "").trim()
  const items = baseText.split(",").map((item) => item.trim()).filter(Boolean)
  const shouldFold = text.length > 18 || items.length > 2 || /\([^)]*\)/.test(text)
  if (!shouldFold) return { title: text, detail: "", hasDetail: false }

  const title =
    items.length >= 3
      ? `${items[0]}·${items[1]} 외`
      : items.length === 2
        ? `${items[0]}·${items[1]}`
        : baseText || text

  return { title, detail: text, hasDetail: title !== text }
}

function asOfBadgeLabel(value: unknown) {
  const cleaned = normalizedAsOfDateText(value)
  return cleaned ? `${cleaned} 기준` : "기준일 확인 필요"
}

function cleanCumulativeLabel(value: unknown) {
  return String(value ?? "").trim().replace(/^누적\s*:\s*/g, "").trim()
}

function FoldableMatrixLabel({
  value,
  isTotal = false,
  tone = "blue",
}: {
  value: unknown
  isTotal?: boolean
  tone?: "blue" | "rose" | "emerald"
}) {
  const labelParts = industryLabelParts(value)
  const totalClass =
    tone === "rose"
      ? "text-rose-800"
      : tone === "emerald"
        ? "text-emerald-800"
        : "text-blue-800"
  if (isTotal) return <span className={`block text-center ${totalClass}`}>{labelParts.title}</span>
  if (!labelParts.hasDetail) return <span className="block truncate px-2 py-1 font-semibold text-slate-800">{labelParts.title}</span>

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 truncate font-semibold text-slate-800">{labelParts.title}</span>
        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
          <span className="group-open:hidden">펼침</span>
          <span className="hidden group-open:inline">접기</span>
        </span>
      </summary>
      <div className="mt-1 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] font-medium leading-4 text-slate-500">
        {labelParts.detail}
      </div>
    </details>
  )
}

function GroupHeaderLabel({
  category = "업종",
  label,
  count,
}: {
  category?: string
  label: string
  count: number
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-500">
          {category}
        </span>
        <span className="truncate text-[12px] font-medium text-slate-900">{label}</span>
      </div>
      <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-500">{formatNumber(count)}건</span>
    </div>
  )
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
  { key: "label", label: "업종", className: "min-w-[300px] text-left text-slate-700" },
  { key: "check", label: "체크", className: "text-right tabular-nums" },
  { key: "marketPoint", label: "마켓", className: "text-right tabular-nums" },
  { key: "bloomberg", label: "블룸버그", className: "text-right tabular-nums" },
  { key: "reuters", label: "로이터", className: "text-right tabular-nums" },
  { key: "hankyungEtc", label: "기타", className: "text-right tabular-nums" },
  { key: "new", label: "신규", className: "text-right font-medium tabular-nums text-blue-700" },
  { key: "total", label: "합계", className: "text-right font-medium tabular-nums text-slate-950" },
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

function NewReplacementExcelSummary({
  year,
  asOf,
  workSummary,
  replacementSummary,
  industryRows,
}: {
  year: number | string
  asOf: string
  workSummary: any[]
  replacementSummary: any[]
  industryRows: any[]
}) {
  const workColumns = [
    { label: "외환", value: summaryValueByLabel(workSummary, ["외환"]) },
    { label: "주식", value: summaryValueByLabel(workSummary, ["주식"]), title: "주식, 선물, 옵션" },
    { label: "채권", value: summaryValueByLabel(workSummary, ["채권"]) },
    { label: "기타", value: summaryValueByLabel(workSummary, ["기타"]) },
    { label: "합계", value: summaryValueByLabel(workSummary, ["합계", "합"]), total: true },
  ]
  const replacementColumns = [
    { label: "체크", sub: "C", value: summaryValueByLabel(replacementSummary, ["체크"]) },
    { label: "마켓", sub: "M", value: summaryValueByLabel(replacementSummary, ["마켓포인트", "마켓"]), title: "마켓포인트" },
    { label: "블룸", sub: "B", value: summaryValueByLabel(replacementSummary, ["블룸버그", "블룸"]), title: "블룸버그" },
    { label: "로이터", sub: "R", value: summaryValueByLabel(replacementSummary, ["로이터"]) },
    { label: "기타", sub: "H", value: summaryValueByLabel(replacementSummary, ["기타", "한경"]), title: "한경머니/기타" },
    { label: "신규", sub: "N", value: summaryValueByLabel(replacementSummary, ["신규"]) },
    { label: "합계", value: summaryValueByLabel(replacementSummary, ["합계", "합"]), total: true },
  ]
  const matrixColumns = [
    { key: "label", label: "구분", className: "w-[230px] text-left" },
    { key: "check", label: "체크( C )", className: "w-[110px] text-center" },
    { key: "marketPoint", label: "마켓포인트( M )", className: "w-[132px] text-center" },
    { key: "bloomberg", label: "블룸버그( B )", className: "w-[122px] text-center" },
    { key: "reuters", label: "로이터( R )", className: "w-[108px] text-center" },
    { key: "hankyungEtc", label: "한경머니(H)", className: "w-[108px] text-center" },
    { key: "new", label: "신규(N)", className: "w-[108px] text-center" },
    { key: "total", label: "합계", className: "w-[108px] text-center" },
  ]
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <AnalysisCardHeader
        eyebrow="New / Replacement"
        title={`${year}년 인포맥스 신규단말기 대체현황`}
        asOf={asOf}
        tone="blue"
      />

      <div className="overflow-x-auto">
        <div className="min-w-[1080px] space-y-4 p-5">
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.45fr]">
            <CompactMetricBand title="업무성격" tone="blue" items={workColumns} />
            <CompactMetricBand title="타사단말기 대체" tone="indigo" items={replacementColumns.map((item) => ({ ...item, dashZero: true }))} />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
              <div className="text-[13px] font-bold text-slate-900">업종별 대체 현황</div>
              <div className="text-[11px] font-semibold text-slate-400">분류 이니셜 기준</div>
            </div>
            <table className="w-full table-fixed border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  {matrixColumns.map((column) => (
                    <th key={column.key} className={`${column.className} border-r border-slate-200 px-3 py-2.5 font-bold last:border-r-0`}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {industryRows.length ? (
                  industryRows.map((row, index) => {
                    const isTotal = isTotalIndustryRow(row)
                    return (
                      <tr
                        key={`${row?.label || "industry"}-${index}`}
                        className={`border-b border-slate-100 last:border-0 ${isTotal ? "bg-blue-50/70" : "hover:bg-blue-50/30"}`}
                      >
                        {matrixColumns.map((column) => (
                          <td
                            key={column.key}
                            className={`${column.className} border-r border-slate-100 px-3 py-2 align-middle tabular-nums last:border-r-0 ${isTotal ? "font-bold text-blue-800" : "text-slate-700"}`}
                          >
                            {column.key === "label" ? (
                              <FoldableMatrixLabel value={row?.label} isTotal={isTotal} tone="blue" />
                            ) : (
                              excelNumber(row?.[column.key])
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={matrixColumns.length} className="px-4 py-8 text-center font-semibold text-slate-400">
                      업종별 신규/대체 요약이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

function GroupedNewRecordsTable({
  groups,
  industryOptions,
  onMoveRecord,
}: {
  groups: Array<{ label: string; rows: any[] }>
  industryOptions: string[]
  onMoveRecord?: Props["onMoveRecord"]
}) {
  const totalCount = groups.reduce((sum, group) => sum + group.rows.length, 0)
  let displayNo = 0
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-900">
        상세 목록 {formatNumber(totalCount)}건
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1300px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
              <th className="w-[56px] border-r border-slate-200 px-2 py-2 text-center font-semibold">NO</th>
              <th className="w-[92px] border-r border-slate-200 px-2 py-2 text-left font-semibold">반영일</th>
              <th className="w-[96px] border-r border-slate-200 px-2 py-2 text-left font-semibold">ID</th>
              <th className="min-w-[170px] border-r border-slate-200 px-2 py-2 text-left font-semibold">회사명</th>
              <th className="min-w-[150px] border-r border-slate-200 px-2 py-2 text-left font-semibold">부서</th>
              <th className="w-[86px] border-r border-slate-200 px-2 py-2 text-left font-semibold">권유자</th>
              <th className="w-[88px] border-r border-slate-200 px-2 py-2 text-left font-semibold">구분</th>
              <th className="w-[82px] border-r border-slate-200 px-2 py-2 text-left font-semibold">업무성격</th>
              <th className="min-w-[180px] border-r border-slate-200 px-2 py-2 text-left font-semibold">비고</th>
              <th className="w-[220px] px-2 py-2 text-left font-semibold">업종 이동</th>
            </tr>
          </thead>
          <tbody>
            {groups.length ? (
              groups.flatMap((group) => [
                <tr key={`${group.label}-header`} className="border-y border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                  <td colSpan={10} className="px-3 py-1.5">
                    <GroupHeaderLabel label={group.label} count={group.rows.length} />
                  </td>
                </tr>,
                ...group.rows.map((row, index) => {
                  const rowNo = ++displayNo
                  return (
                  <tr key={`${group.label}-${row?.id || row?.sourceId || row?.idCode || index}`} className="border-b border-slate-100 hover:bg-blue-50/30">
                    <td className="border-r border-slate-100 px-2 py-1.5 text-center tabular-nums text-slate-600">{rowNo}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 tabular-nums text-slate-600">{row.date}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 font-medium text-slate-900">{row.idCode}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 font-medium text-slate-900">{row.companyName}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 text-slate-600">{row.departmentName}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 text-slate-600">{row.recommender}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 font-medium text-slate-700">{row.replacementType || "신규"}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 font-medium text-slate-700">{row.businessType || "기타"}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 text-slate-600">{row.note}</td>
                    <td className="px-2 py-1.5">
                      {onMoveRecord ? (
                        <MoveSelect
                          value={String(row?.group || group.label || "").trim()}
                          options={industryOptions}
                          label="신규/대체 업종 이동"
                          onChange={(value) => onMoveRecord("new", row, value, "industry")}
                        />
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                  </tr>
                  )
                }),
              ])
            ) : (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
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
  { key: "label", label: "구분", className: "w-[230px] text-left" },
  { key: "userMove", label: "퇴사/이직", className: "w-[105px] text-center tabular-nums" },
  { key: "costCut", label: "비용절감", className: "w-[105px] text-center tabular-nums" },
  { key: "lowUsage", label: "활용저조", className: "w-[105px] text-center tabular-nums" },
  { key: "contentOrCompetitor", label: "타사대체", className: "w-[105px] text-center tabular-nums" },
  { key: "contractEnd", label: "계약만료", className: "w-[105px] text-center tabular-nums" },
  { key: "reorg", label: "조직개편", className: "w-[105px] text-center tabular-nums" },
  { key: "leave", label: "휴직/출장", className: "w-[105px] text-center tabular-nums" },
  { key: "merger", label: "합병매각", className: "w-[105px] text-center tabular-nums" },
  { key: "unpaid", label: "미수", className: "w-[95px] text-center tabular-nums" },
  { key: "total", label: "합계", className: "w-[95px] text-center font-medium tabular-nums text-rose-700" },
]

function TerminationMatrixTable({
  year,
  asOf,
  reasonSummary,
  competitorSummary,
  rows,
}: {
  year: number | string
  asOf: string
  reasonSummary: any[]
  competitorSummary: any[]
  rows: any[]
}) {
  const reasonColumns = [
    { label: "퇴사/이직", value: summaryValueByLabel(reasonSummary, ["사용자퇴사", "이직"]), title: "사용자 퇴사/이직" },
    { label: "비용절감", value: summaryValueByLabel(reasonSummary, ["비용절감", "예산삭감"]) },
    { label: "활용저조", value: summaryValueByLabel(reasonSummary, ["활용"]) },
    { label: "타사대체", value: summaryValueByLabel(reasonSummary, ["콘텐츠", "타사대체"]), title: "콘텐츠 불만/타사대체" },
    { label: "계약만료", value: summaryValueByLabel(reasonSummary, ["계약만료"]) },
    { label: "조직개편", value: summaryValueByLabel(reasonSummary, ["조직개편"]) },
    { label: "휴직/출장", value: summaryValueByLabel(reasonSummary, ["휴직", "출장"]) },
    { label: "합병매각", value: summaryValueByLabel(reasonSummary, ["합병", "매각"]) },
    { label: "미수", value: summaryValueByLabel(reasonSummary, ["미수"]), title: "구독료 미수" },
    { label: "합계", value: summaryValueByLabel(reasonSummary, ["합계", "합"]), total: true },
  ]
  const competitorColumns = [
    { label: "체크", sub: "C", value: summaryValueByLabel(competitorSummary, ["체크"]) },
    { label: "마켓", sub: "M", value: summaryValueByLabel(competitorSummary, ["마켓포인트", "마켓"]), title: "마켓포인트" },
    { label: "블룸", sub: "B", value: summaryValueByLabel(competitorSummary, ["블룸버그", "블룸"]), title: "블룸버그" },
    { label: "로이터", sub: "R", value: summaryValueByLabel(competitorSummary, ["로이터"]) },
    { label: "한경/기타", sub: "H", value: summaryValueByLabel(competitorSummary, ["한경", "기타"]) },
    { label: "아웃", sub: "E", value: summaryValueByLabel(competitorSummary, ["아웃"]) },
    { label: "합계", value: summaryValueByLabel(competitorSummary, ["합계", "합"]), total: true },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <AnalysisCardHeader
        eyebrow="Termination Type"
        title={`${year}년 인포맥스 해지 유형 분석`}
        asOf={asOf}
        tone="rose"
      />
      <div className="overflow-x-auto">
        <div className="min-w-[1240px] space-y-4 p-5">
          <div className="grid gap-4">
            <CompactMetricBand title="해지유형" tone="rose" items={reasonColumns.map((item) => ({ ...item, dashZero: true }))} />
            <CompactMetricBand title="경쟁사 변경" tone="indigo" items={competitorColumns.map((item) => ({ ...item, dashZero: true }))} />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
              <div className="text-[13px] font-bold text-slate-900">업종별 해지 현황</div>
              <div className="text-[11px] font-semibold text-slate-400">분류 이니셜 기준</div>
            </div>
            <table className="w-full table-fixed border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  {terminationIndustryColumns.map((column) => (
                    <th key={column.key} className={`border-r border-slate-200 px-3 py-2.5 font-bold last:border-r-0 ${column.className}`}>
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
                      <tr key={`${row.label}-${index}`} className={`border-b border-slate-100 last:border-0 ${isTotal ? "bg-rose-50/70" : "hover:bg-rose-50/30"}`}>
                        {terminationIndustryColumns.map((column) => (
                          <td key={column.key} className={`border-r border-slate-100 px-3 py-2 align-middle last:border-r-0 ${column.className} ${isTotal ? "font-bold text-rose-800" : "text-slate-700"}`}>
                            {column.key === "label" ? (
                              <FoldableMatrixLabel value={row?.[column.key]} isTotal={isTotal} tone="rose" />
                            ) : (
                              formatNumber(row?.[column.key])
                            )}
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
      </div>
    </section>
  )
}

function GroupedTerminationRecordsTable({
  groups,
  industryOptions,
  onMoveRecord,
}: {
  groups: Array<{ label: string; rows: any[] }>
  industryOptions: string[]
  onMoveRecord?: Props["onMoveRecord"]
}) {
  const totalCount = groups.reduce((sum, group) => sum + group.rows.length, 0)
  let displayNo = 0
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-900">
        상세 목록 {formatNumber(totalCount)}건
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1260px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
              <th className="w-[56px] border-r border-slate-200 px-2 py-2 text-center font-semibold">NO</th>
              <th className="w-[92px] border-r border-slate-200 px-2 py-2 text-left font-semibold">반영일</th>
              <th className="w-[96px] border-r border-slate-200 px-2 py-2 text-left font-semibold">ID</th>
              <th className="min-w-[170px] border-r border-slate-200 px-2 py-2 text-left font-semibold">회사명</th>
              <th className="min-w-[150px] border-r border-slate-200 px-2 py-2 text-left font-semibold">부서</th>
              <th className="w-[86px] border-r border-slate-200 px-2 py-2 text-left font-semibold">담당자</th>
              <th className="min-w-[140px] border-r border-slate-200 px-2 py-2 text-left font-semibold">해지사유</th>
              <th className="w-[98px] border-r border-slate-200 px-2 py-2 text-right font-semibold">위약금</th>
              <th className="min-w-[180px] border-r border-slate-200 px-2 py-2 text-left font-semibold">비고</th>
              <th className="w-[220px] px-2 py-2 text-left font-semibold">업종 이동</th>
            </tr>
          </thead>
          <tbody>
            {groups.length ? (
              groups.flatMap((group) => [
                <tr key={`${group.label}-header`} className="border-y border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                  <td colSpan={10} className="px-3 py-1.5">
                    <GroupHeaderLabel label={group.label} count={group.rows.length} />
                  </td>
                </tr>,
                ...group.rows.map((row, index) => {
                  const rowNo = ++displayNo
                  return (
                  <tr key={`${group.label}-${row?.id || row?.sourceId || row?.idCode || index}`} className="border-b border-slate-100 hover:bg-rose-50/30">
                    <td className="border-r border-slate-100 px-2 py-1.5 text-center tabular-nums text-slate-600">{rowNo}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 tabular-nums text-slate-600">{row.date}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 font-medium text-slate-900">{row.idCode}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 font-medium text-slate-900">{row.companyName}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 text-slate-600">{row.departmentName}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 text-slate-600">{row.recommender}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 font-medium text-slate-700">{row.reason}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-600">{formatNumber(row.penalty)}</td>
                    <td className="border-r border-slate-100 px-2 py-1.5 text-slate-600">{row.note}</td>
                    <td className="px-2 py-1.5">
                      {onMoveRecord ? (
                        <MoveSelect
                          value={String(row?.group || group.label || "").trim()}
                          options={industryOptions}
                          label="해지 업종 이동"
                          onChange={(value) => onMoveRecord("termination", row, value, "industry")}
                        />
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                  </tr>
                  )
                }),
              ])
            ) : (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
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
  { key: "no", label: "구분", className: "w-[64px] text-center text-slate-700" },
  { key: "area", label: "담당영역", className: "w-[300px] text-left text-slate-700" },
  { key: "manager", label: "담당자", className: "w-[280px] text-left text-slate-600" },
  { key: "newCount", label: "신규", className: "w-[110px] text-center font-medium tabular-nums text-blue-700" },
  { key: "terminationCount", label: "해지", className: "w-[110px] text-center font-medium tabular-nums text-rose-700" },
  { key: "netCount", label: "순증", className: "w-[110px] text-center font-medium tabular-nums text-slate-950" },
]

function AreaSummaryTable({
  year,
  asOf,
  cumulativeLabel,
  rows,
}: {
  year: number | string
  asOf: string
  cumulativeLabel?: unknown
  rows: any[]
}) {
  const totalRow = rows.find((row) => String(row?.no || "").replace(/\s+/g, "") === "계")
  const kpiItems = [
    { label: "신규", value: `${formatNumber(totalRow?.newCount)}건`, tone: "blue" as TypeAnalysisTone },
    { label: "해지", value: `${formatNumber(totalRow?.terminationCount)}건`, tone: "rose" as TypeAnalysisTone },
    { label: "순증", value: `${formatNumber(totalRow?.netCount)}건`, tone: "emerald" as TypeAnalysisTone },
  ]
  const cumulative = cleanCumulativeLabel(cumulativeLabel)
  if (cumulative) kpiItems.push({ label: "누적", value: cumulative, tone: "slate" as TypeAnalysisTone })

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <AnalysisCardHeader
        eyebrow="Area Net Growth"
        title={`${year}년 영역별 순증 현황`}
        asOf={asOf}
        tone="emerald"
      />
      <div className="overflow-x-auto">
        <div className="min-w-[980px] space-y-4 p-5">
          <SimpleKpiGrid items={kpiItems} />

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
              <div className="text-[13px] font-bold text-slate-900">영역별 순증 현황</div>
              <div className="text-[11px] font-semibold text-slate-400">신규 - 해지 기준</div>
            </div>
            <table className="w-full table-fixed border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  {areaSummaryColumns.map((column) => (
                    <th key={column.key} className={`border-r border-slate-200 px-3 py-2.5 font-bold last:border-r-0 ${column.className}`}>
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
                      <tr key={`${row?.area || row?.no || "area"}-${index}`} className={`border-b border-slate-100 last:border-0 ${isTotal ? "bg-emerald-50/70" : "hover:bg-emerald-50/30"}`}>
                        {areaSummaryColumns.map((column) => (
                          <td key={column.key} className={`border-r border-slate-100 px-3 py-2 align-middle last:border-r-0 ${column.className} ${isTotal ? "font-bold text-emerald-800" : ""}`}>
                            {column.key === "area" ? (
                              <FoldableMatrixLabel value={row?.[column.key]} isTotal={isTotal} tone="emerald" />
                            ) : ["newCount", "terminationCount", "netCount"].includes(column.key) ? (
                              formatNumber(row?.[column.key])
                            ) : (
                              row?.[column.key]
                            )}
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
      </div>
    </section>
  )
}

function GroupedAreaRecordsTable({
  groups,
  areaOptions,
  onMoveRecord,
}: {
  groups: Array<{ label: string; rows: any[] }>
  areaOptions: string[]
  onMoveRecord?: Props["onMoveRecord"]
}) {
  const totalCount = groups.reduce((sum, group) => sum + group.rows.length, 0)
  let displayNo = 0
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-900">
        상세 목록 {formatNumber(totalCount)}건
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1260px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-slate-700">
              <th className="w-[56px] border-r border-slate-200 px-2 py-2 text-center font-semibold">NO</th>
              <th className="w-[86px] border-r border-slate-200 px-2 py-2 text-center font-semibold">구분</th>
              <th className="w-[92px] border-r border-slate-200 px-2 py-2 text-left font-semibold">반영일</th>
              <th className="w-[96px] border-r border-slate-200 px-2 py-2 text-left font-semibold">ID</th>
              <th className="min-w-[180px] border-r border-slate-200 px-2 py-2 text-left font-semibold">기관</th>
              <th className="min-w-[150px] border-r border-slate-200 px-2 py-2 text-left font-semibold">부서</th>
              <th className="w-[130px] border-r border-slate-200 px-2 py-2 text-left font-semibold">세부구분</th>
              <th className="min-w-[180px] border-r border-slate-200 px-2 py-2 text-left font-semibold">비고</th>
              <th className="w-[260px] px-2 py-2 text-left font-semibold">영역 이동</th>
            </tr>
          </thead>
          <tbody>
            {groups.length ? (
              groups.flatMap((group) => [
                <tr key={`${group.label}-header`} className="border-y border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                  <td colSpan={9} className="px-3 py-1.5">
                    <GroupHeaderLabel category="영역" label={group.label} count={group.rows.length} />
                  </td>
                </tr>,
                ...group.rows.map((row, index) => {
                  const rowNo = ++displayNo
                  const isTermination = row?.kind === "termination" || row?.transactionType === "해지"
                  const tone = isTermination ? "border-rose-100 bg-rose-50 text-rose-700" : "border-blue-100 bg-blue-50 text-blue-700"
                  return (
                    <tr key={`${group.label}-${row?.id || row?.sourceId || row?.idCode || index}`} className={`border-b border-slate-100 ${isTermination ? "hover:bg-rose-50/30" : "hover:bg-blue-50/30"}`}>
                      <td className="border-r border-slate-100 px-2 py-1.5 text-center tabular-nums text-slate-600">{rowNo}</td>
                      <td className="border-r border-slate-100 px-2 py-1.5 text-center">
                        <span className={`inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-semibold ${tone}`}>
                          {isTermination ? "해지" : "신규/대체"}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 px-2 py-1.5 tabular-nums text-slate-600">{row.date}</td>
                      <td className="border-r border-slate-100 px-2 py-1.5 font-medium text-slate-900">{row.idCode}</td>
                      <td className="border-r border-slate-100 px-2 py-1.5 font-medium text-slate-900">{row.companyName}</td>
                      <td className="border-r border-slate-100 px-2 py-1.5 text-slate-600">{row.departmentName}</td>
                      <td className="border-r border-slate-100 px-2 py-1.5 font-medium text-slate-700">{isTermination ? row.reason : row.replacementType || "신규"}</td>
                      <td className="border-r border-slate-100 px-2 py-1.5 text-slate-600">{row.note}</td>
                      <td className="px-2 py-1.5">
                        {onMoveRecord ? (
                          <MoveSelect
                            value={String(row?.areaGroup || row?.group || group.label || "").trim()}
                            options={areaOptions}
                            label="영역 이동"
                            onChange={(value) => onMoveRecord(isTermination ? "termination" : "new", row, value, "area")}
                          />
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                  )
                }),
              ])
            ) : (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
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

function PersonalPerformancePanel({
  year,
  asOf,
  rows,
}: {
  year: number | string
  asOf: string
  rows: any[]
}) {
  const totals = rows.reduce(
    (acc, row) => ({
      totalNew: acc.totalNew + toNumber(row?.totalNew),
      new: acc.new + toNumber(row?.new),
      check: acc.check + toNumber(row?.check),
      marketPoint: acc.marketPoint + toNumber(row?.marketPoint),
      reutersBloomberg: acc.reutersBloomberg + toNumber(row?.reutersBloomberg),
    }),
    { totalNew: 0, new: 0, check: 0, marketPoint: 0, reutersBloomberg: 0 },
  )
  const tableColumns = [
    { key: "no", label: "구분", className: "w-[72px] text-center" },
    { key: "manager", label: "담당자", className: "w-[240px] text-center" },
    { key: "totalNew", label: "총 신규", className: "w-[150px] text-center tabular-nums" },
    { key: "new", label: "신규", className: "w-[150px] text-center tabular-nums" },
    { key: "check", label: "체크", className: "w-[150px] text-center tabular-nums" },
    { key: "marketPoint", label: "마켓", className: "w-[150px] text-center tabular-nums" },
    { key: "reutersBloomberg", label: "로이터/블룸", className: "w-[150px] text-center tabular-nums" },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <AnalysisCardHeader
        eyebrow="Personal Performance"
        title={`${year}년 개인별 신규 현황`}
        asOf={asOf}
        tone="blue"
      />
      <div className="space-y-4 p-5">
        <SimpleKpiGrid
          items={[
            { label: "담당자", value: `${formatNumber(rows.length)}명`, tone: "slate" },
            { label: "총 신규", value: `${formatNumber(totals.totalNew)}건`, tone: "blue" },
            { label: "신규", value: `${formatNumber(totals.new)}건`, tone: "emerald" },
            { label: "체크", value: `${formatNumber(totals.check)}건`, tone: "indigo" },
            { label: "마켓", value: `${formatNumber(totals.marketPoint)}건`, tone: "indigo" },
            { label: "로이터/블룸", value: `${formatNumber(totals.reutersBloomberg)}건`, tone: "indigo" },
          ]}
        />
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
            <div className="text-[13px] font-bold text-slate-900">개인별 신규 현황</div>
            <div className="text-[11px] font-semibold text-slate-400">담당자 기준 · 총계 포함</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px] table-fixed border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 bg-blue-50/80 text-slate-700">
                  {tableColumns.map((column) => (
                    <th key={column.key} className={`border-r border-blue-100 px-3 py-2.5 text-center font-bold last:border-r-0 ${column.className}`}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  <>
                    {rows.map((row, index) => (
                      <tr key={`${row?.no || index}-${row?.manager || "manager"}`} className="border-b border-slate-100 hover:bg-blue-50/30">
                        <td className="border-r border-slate-100 px-3 py-2.5 text-center font-semibold tabular-nums text-slate-700">{row.no || index + 1}</td>
                        <td className="border-r border-slate-100 px-3 py-2.5 text-center font-semibold text-slate-900">{row.manager}</td>
                        <td className="border-r border-slate-100 px-3 py-2.5 text-center font-bold tabular-nums text-blue-700">{formatNumber(row.totalNew)}</td>
                        <td className="border-r border-slate-100 px-3 py-2.5 text-center tabular-nums text-slate-700">{formatNumber(row.new)}</td>
                        <td className="border-r border-slate-100 px-3 py-2.5 text-center font-semibold tabular-nums text-indigo-700">{toNumber(row.check) ? formatNumber(row.check) : ""}</td>
                        <td className="border-r border-slate-100 px-3 py-2.5 text-center font-semibold tabular-nums text-indigo-700">{toNumber(row.marketPoint) ? formatNumber(row.marketPoint) : ""}</td>
                        <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-indigo-700">{toNumber(row.reutersBloomberg) ? formatNumber(row.reutersBloomberg) : ""}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-blue-200 bg-blue-50/80 font-bold text-blue-900">
                      <td colSpan={2} className="border-r border-blue-100 px-3 py-2.5 text-center">총계</td>
                      <td className="border-r border-blue-100 px-3 py-2.5 text-center tabular-nums">{formatNumber(totals.totalNew)}</td>
                      <td className="border-r border-blue-100 px-3 py-2.5 text-center tabular-nums">{formatNumber(totals.new)}</td>
                      <td className="border-r border-blue-100 px-3 py-2.5 text-center tabular-nums text-indigo-700">{formatNumber(totals.check)}</td>
                      <td className="border-r border-blue-100 px-3 py-2.5 text-center tabular-nums text-indigo-700">{formatNumber(totals.marketPoint)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-indigo-700">{formatNumber(totals.reutersBloomberg)}</td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={tableColumns.length} className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
                      개인별 실적 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

export function TypeAnalysisDashboard({
  data,
  currentYear,
  isDirty,
  isSaving,
  saveMessage,
  industryMoveOptions = [],
  areaMoveOptions = [],
  onImportWeekly,
  onSave,
  onMoveRecord,
}: Props) {
  const [tab, setTab] = useState<TabKey>("summary")

  const newRecords = Array.isArray(data?.newReplacement?.records) ? data.newReplacement.records : []
  const newIndustrySummary = Array.isArray(data?.newReplacement?.industrySummary) ? data.newReplacement.industrySummary : []
  const terminationRecords = Array.isArray(data?.terminationType?.records) ? data.terminationType.records : []
  const terminationIndustrySummary = Array.isArray(data?.terminationType?.industrySummary) ? data.terminationType.industrySummary : []
  const areaRecords = Array.isArray(data?.areaNetGrowth?.records) ? data.areaNetGrowth.records : []
  const areaSummaryRows = Array.isArray(data?.areaNetGrowth?.summaryRows) ? data.areaNetGrowth.summaryRows : []
  const personalRows = Array.isArray(data?.personalPerformance?.rows) ? data.personalPerformance.rows : []
  const snapshots = Array.isArray(data?.weeklySnapshots) ? data.weeklySnapshots : []
  const latestSnapshot = snapshots[0]

  const newTotal = summaryTotalValue(data?.newReplacement?.replacementSummary || [])
  const pureNewTotal = findSummaryValue(data?.newReplacement?.replacementSummary || [], (label) => label.includes("신규"))
  const replacementTotal = Math.max(0, newTotal - pureNewTotal)
  const terminationTotal = summaryTotalValue(data?.terminationType?.reasonSummary || [])
  const netTotal = newTotal - terminationTotal
  const industryRows = useMemo(() => newIndustrySummary.filter((row: any) => !isTotalIndustryRow(row)), [newIndustrySummary])
  const industryMatrixRows = useMemo(() => newIndustrySummary.filter((row: any) => row?.label), [newIndustrySummary])
  const terminationIndustryRows = useMemo(() => terminationIndustrySummary.filter((row: any) => !isTotalIndustryRow(row)), [terminationIndustrySummary])
  const terminationMatrixRows = useMemo(() => terminationIndustrySummary.filter((row: any) => row?.label), [terminationIndustrySummary])
  const areaRows = useMemo(() => areaSummaryRows.filter((row: any) => String(row?.no || "").replace(/\s+/g, "") !== "계"), [areaSummaryRows])
  const personalRowsForDisplay = useMemo(
    () => personalRows.map((row: any) => ({ ...row, manager: normalizeManagerLabel(row?.manager) })),
    [personalRows],
  )
  const filteredNewRecords = useMemo(
    () => sortRecordsByReflectionDate(newRecords, "desc"),
    [newRecords],
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
    () => sortRecordsByReflectionDate(terminationRecords, "desc"),
    [terminationRecords],
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
    () => sortRecordsByReflectionDate(areaRecords, "desc"),
    [areaRecords],
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

  const summaryWorkMetrics = [
    { label: "외환", value: summaryValueByLabel(data?.newReplacement?.workSummary || [], ["외환"]) },
    { label: "주식", value: summaryValueByLabel(data?.newReplacement?.workSummary || [], ["주식"]), title: "주식, 선물, 옵션" },
    { label: "채권", value: summaryValueByLabel(data?.newReplacement?.workSummary || [], ["채권"]) },
    { label: "기타", value: summaryValueByLabel(data?.newReplacement?.workSummary || [], ["기타"]) },
    { label: "합계", value: summaryValueByLabel(data?.newReplacement?.workSummary || [], ["합계", "합"]), total: true },
  ]
  const summaryReplacementMetrics = [
    { label: "체크", sub: "C", value: summaryValueByLabel(data?.newReplacement?.replacementSummary || [], ["체크"]) },
    { label: "마켓", sub: "M", value: summaryValueByLabel(data?.newReplacement?.replacementSummary || [], ["마켓포인트", "마켓"]), title: "마켓포인트" },
    { label: "블룸", sub: "B", value: summaryValueByLabel(data?.newReplacement?.replacementSummary || [], ["블룸버그", "블룸"]), title: "블룸버그" },
    { label: "로이터", sub: "R", value: summaryValueByLabel(data?.newReplacement?.replacementSummary || [], ["로이터"]) },
    { label: "기타", sub: "H", value: summaryValueByLabel(data?.newReplacement?.replacementSummary || [], ["기타", "한경"]), title: "한경머니/기타" },
    { label: "신규", sub: "N", value: pureNewTotal },
    { label: "합계", value: newTotal, total: true },
  ]
  const summaryTerminationMetrics = [
    { label: "퇴사/이직", value: summaryValueByLabel(data?.terminationType?.reasonSummary || [], ["사용자퇴사", "이직"]), title: "사용자 퇴사/이직" },
    { label: "비용절감", value: summaryValueByLabel(data?.terminationType?.reasonSummary || [], ["비용절감", "예산삭감"]) },
    { label: "활용저조", value: summaryValueByLabel(data?.terminationType?.reasonSummary || [], ["활용"]) },
    { label: "타사대체", value: summaryValueByLabel(data?.terminationType?.reasonSummary || [], ["콘텐츠", "타사대체"]), title: "콘텐츠 불만/타사대체" },
    { label: "계약만료", value: summaryValueByLabel(data?.terminationType?.reasonSummary || [], ["계약만료"]) },
    { label: "조직개편", value: summaryValueByLabel(data?.terminationType?.reasonSummary || [], ["조직개편"]) },
    { label: "휴직/출장", value: summaryValueByLabel(data?.terminationType?.reasonSummary || [], ["휴직", "출장"]) },
    { label: "합병매각", value: summaryValueByLabel(data?.terminationType?.reasonSummary || [], ["합병", "매각"]) },
    { label: "미수", value: summaryValueByLabel(data?.terminationType?.reasonSummary || [], ["미수"]) },
    { label: "합계", value: terminationTotal, total: true },
  ]
  const summaryCompetitorMetrics = [
    { label: "체크", sub: "C", value: summaryValueByLabel(data?.terminationType?.competitorSummary || [], ["체크"]) },
    { label: "마켓", sub: "M", value: summaryValueByLabel(data?.terminationType?.competitorSummary || [], ["마켓포인트", "마켓"]), title: "마켓포인트" },
    { label: "블룸", sub: "B", value: summaryValueByLabel(data?.terminationType?.competitorSummary || [], ["블룸버그", "블룸"]), title: "블룸버그" },
    { label: "로이터", sub: "R", value: summaryValueByLabel(data?.terminationType?.competitorSummary || [], ["로이터"]) },
    { label: "한경/기타", sub: "H", value: summaryValueByLabel(data?.terminationType?.competitorSummary || [], ["한경", "기타"]) },
    { label: "아웃", sub: "E", value: summaryValueByLabel(data?.terminationType?.competitorSummary || [], ["아웃"]) },
    { label: "합계", value: summaryValueByLabel(data?.terminationType?.competitorSummary || [], ["합계", "합"]), total: true },
  ]

  const saveText = isSaving ? "저장 중" : isDirty ? "저장 필요" : saveMessage || "저장 완료"

  function handlePrintReport() {
    const personalTotals = personalRowsForDisplay.reduce(
      (acc: { totalNew: number; new: number; check: number; marketPoint: number; reutersBloomberg: number }, row: any) => ({
        totalNew: acc.totalNew + toNumber(row?.totalNew),
        new: acc.new + toNumber(row?.new),
        check: acc.check + toNumber(row?.check),
        marketPoint: acc.marketPoint + toNumber(row?.marketPoint),
        reutersBloomberg: acc.reutersBloomberg + toNumber(row?.reutersBloomberg),
      }),
      { totalNew: 0, new: 0, check: 0, marketPoint: 0, reutersBloomberg: 0 },
    )
    const personalRowsForReport = personalRowsForDisplay.length
      ? [
          ...personalRowsForDisplay,
          {
            no: "총계",
            manager: "총계",
            ...personalTotals,
          },
        ]
      : []
    const reportNumber = (value: unknown, dashZero = false) => {
      const number = toNumber(value)
      if (dashZero && number === 0) return "-"
      return formatNumber(number)
    }
    const reportNewGroups = makeGroups(
      filteredNewRecords,
      industryRows.map((row: any) => String(row?.label || "").trim()),
      (row) => String(row?.group || "기타").trim(),
    )
    const reportTerminationGroups = makeGroups(
      filteredTerminationRecords,
      terminationIndustryRows.map((row: any) => String(row?.label || "").trim()),
      (row) => String(row?.group || "기타").trim(),
    )
    const reportAreaGroups = makeGroups(
      filteredAreaRecords,
      areaRows.map((row: any) => String(row?.area || "").trim()),
      (row) => String(row?.areaGroup || row?.group || "기타").trim(),
    )

    const simpleColumns: ReportColumn[] = [
      { label: "구분", width: "68%", get: (row) => row.label || row.area || row.manager || row.no },
      { label: "값", width: "32%", align: "right", noWrap: true, get: (row) => reportNumber(row.value ?? row.totalNew ?? row.netCount ?? 0, true) },
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
      { label: "NO", width: "5%", align: "center", noWrap: true, get: (row) => row.reportNo ?? row.no },
      { label: "반영일", width: "9%", noWrap: true, get: (row) => row.date },
      { label: "ID", width: "9%", noWrap: true, get: (row) => row.idCode },
      { label: "회사명", width: "17%", get: (row) => row.companyName },
      { label: "부서", width: "16%", get: (row) => row.departmentName },
      { label: "권유자", width: "8%", noWrap: true, get: (row) => row.recommender },
      { label: "구분", width: "8%", noWrap: true, get: (row) => row.replacementType || "신규" },
      { label: "업무", width: "7%", noWrap: true, get: (row) => row.businessType || "기타" },
      { label: "비고", width: "20%", get: (row) => row.note },
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
      { label: "NO", width: "5%", align: "center", noWrap: true, get: (row) => row.reportNo ?? row.no },
      { label: "반영일", width: "9%", noWrap: true, get: (row) => row.date },
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
      { label: "NO", width: "5%", align: "center", noWrap: true, get: (row) => row.reportNo ?? row.no },
      { label: "구분", width: "8%", noWrap: true, get: (row) => (row.kind === "termination" || row.transactionType === "해지" ? "해지" : "신규/대체") },
      { label: "반영일", width: "9%", noWrap: true, get: (row) => row.date },
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
      { label: "체크", width: "12%", align: "right", noWrap: true, cssClass: "accent-indigo", get: (row) => reportNumber(row.check, row.manager !== "총계") },
      { label: "마켓", width: "12%", align: "right", noWrap: true, cssClass: "accent-indigo", get: (row) => reportNumber(row.marketPoint, row.manager !== "총계") },
      { label: "로이터/블룸", width: "14%", align: "right", noWrap: true, cssClass: "accent-indigo", get: (row) => reportNumber(row.reutersBloomberg, row.manager !== "총계") },
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
            .toolbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; background: rgba(248, 250, 252, 0.96); border-bottom: 1px solid #e2e8f0; }
            .report-tabs { display: inline-flex; flex-wrap: wrap; gap: 4px; border: 1px solid #dbe3ef; border-radius: 12px; background: #f1f5f9; padding: 4px; }
            .toolbar-actions { display: inline-flex; flex: 0 0 auto; gap: 8px; }
            .toolbar button { height: 34px; border: 1px solid #cbd5e1; border-radius: 9px; background: #fff; padding: 0 12px; color: #0f172a; font-size: 12px; font-weight: 700; cursor: pointer; }
            .toolbar .report-tab { border: 0; background: transparent; color: #64748b; }
            .toolbar .report-tab.is-active { background: #fff; color: #0f172a; box-shadow: 0 1px 2px rgba(15, 23, 42, .08); }
            .toolbar .primary { border-color: #1d4ed8; background: #1d4ed8; color: #fff; }
            .report { width: 100%; max-width: 1120px; margin: 0 auto; padding: 20px 22px 42px; background: #fff; box-shadow: 0 18px 50px rgba(15, 23, 42, .08); }
            .report.single-section .section.page { break-before: auto; }
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
            .kpi .sub { margin-top: 2px; color: #64748b; font-size: 8px; font-weight: 700; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
            .report-table .accent-indigo { color: #4338ca; font-weight: 700; }
            .report-table .empty { text-align: center; color: #94a3b8; padding: 16px; }
            .total-row td { background: #fff7ed !important; color: #0f172a; font-weight: 700; }
            .group-row td { background: #f1f5f9 !important; color: #0f172a; font-weight: 700; border-top: 1.5px solid #94a3b8; border-bottom: 1px solid #cbd5e1; }
            .group-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
            .group-title span { display: inline-flex; align-items: center; gap: 5px; color: #0f172a; }
            .group-title em { display: inline-flex; align-items: center; height: 14px; border: 1px solid #cbd5e1; border-radius: 999px; background: #fff; padding: 0 5px; color: #64748b; font-size: 7px; font-style: normal; font-weight: 700; letter-spacing: .04em; }
            .group-title b { color: #0f172a; font-size: 8.8px; font-weight: 700; }
            .group-title strong { color: #475569; font-size: 8.5px; font-weight: 700; white-space: nowrap; }
            .note { margin-top: 7px; color: #64748b; font-size: 9px; }
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
            <div class="report-tabs" role="tablist" aria-label="리포트 섹션">
              <button class="report-tab is-active" type="button" data-report-tab="all">전체</button>
              <button class="report-tab" type="button" data-report-tab="summary">요약</button>
              <button class="report-tab" type="button" data-report-tab="new">신규/대체</button>
              <button class="report-tab" type="button" data-report-tab="termination">해지</button>
              <button class="report-tab" type="button" data-report-tab="area">영역별 순증</button>
              <button class="report-tab" type="button" data-report-tab="personal">개인별</button>
            </div>
            <div class="toolbar-actions">
              <button class="primary" onclick="window.print()">PDF 저장/출력</button>
              <button onclick="setReportSection('all'); window.print()">전체 PDF</button>
              <button onclick="window.close()">닫기</button>
            </div>
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
              <div class="kpi"><div class="label">신규/대체</div><div class="value">${formatNumber(newTotal)}건</div><div class="sub">신규 ${formatNumber(pureNewTotal)} · 대체 ${formatNumber(replacementTotal)}</div></div>
              <div class="kpi"><div class="label">해지</div><div class="value">${formatNumber(terminationTotal)}건</div></div>
              <div class="kpi"><div class="label">순증</div><div class="value">${formatNumber(netTotal)}건</div></div>
              <div class="kpi"><div class="label">영역 상세</div><div class="value">${formatNumber(areaRecords.length)}건</div></div>
              <div class="kpi"><div class="label">누적</div><div class="value">${escapeReportHtml(cleanCumulativeLabel(data?.areaNetGrowth?.cumulativeNetLabel) || "-")}</div></div>
            </div>

            <section class="section report-section" data-section="summary">
              <h2>요약</h2>
              <div class="summary-grid">
                <div><h3>업무성격 요약</h3>${reportTable(simpleColumns, data?.newReplacement?.workSummary || [], "데이터 없음")}</div>
                <div><h3>타사단말기 대체 요약</h3>${reportTable(simpleColumns, data?.newReplacement?.replacementSummary || [], "데이터 없음")}</div>
                <div><h3>해지 유형 요약</h3>${reportTable(simpleColumns, data?.terminationType?.reasonSummary || [], "데이터 없음")}</div>
                <div><h3>경쟁사 변경 요약</h3>${reportTable(simpleColumns, data?.terminationType?.competitorSummary || [], "데이터 없음")}</div>
              </div>
              <div class="note">원본 파일 수정 시각: ${escapeReportHtml(sourceUpdatedLabel(data?.sourceUpdatedAt) || "확인 필요")}</div>
            </section>

            <section class="section page report-section" data-section="new">
              <h2>신규/대체</h2>
              ${reportTable(newIndustryColumns, industryMatrixRows, "업종별 신규/대체 요약이 없습니다.")}
              <h3>상세 목록</h3>
              ${groupedReportTable(reportNewGroups, newDetailColumns, "신규/대체 상세 데이터가 없습니다.", "업종")}
            </section>

            <section class="section page report-section" data-section="termination">
              <h2>해지</h2>
              ${reportTable(terminationIndustryColumnsForReport, terminationMatrixRows, "업종별 해지 요약이 없습니다.")}
              <h3>상세 목록</h3>
              ${groupedReportTable(reportTerminationGroups, terminationDetailColumns, "해지 상세 데이터가 없습니다.", "업종")}
            </section>

            <section class="section page report-section" data-section="area">
              <h2>영역별 순증</h2>
              ${reportTable(areaColumns, areaSummaryRows, "영역별 순증 요약이 없습니다.")}
              <h3>상세 목록</h3>
              ${groupedReportTable(reportAreaGroups, areaDetailColumns, "영역별 상세 데이터가 없습니다.", "영역")}
            </section>

            <section class="section page report-section" data-section="personal">
              <h2>개인별 실적</h2>
              ${reportTable(personalColumns, personalRowsForReport, "개인별 실적 데이터가 없습니다.")}
            </section>
          </main>
          <script>
            function setReportSection(key) {
              const nextKey = key || "all";
              document.querySelectorAll("[data-report-tab]").forEach((button) => {
                button.classList.toggle("is-active", button.dataset.reportTab === nextKey);
              });
              document.querySelectorAll(".report-section").forEach((section) => {
                section.hidden = nextKey !== "all" && section.dataset.section !== nextKey;
              });
              const report = document.querySelector(".report");
              if (report) report.classList.toggle("single-section", nextKey !== "all");
            }
            document.querySelectorAll("[data-report-tab]").forEach((button) => {
              button.addEventListener("click", () => setReportSection(button.dataset.reportTab));
            });
            setReportSection("all");
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
        <div className="border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="text-[18px] font-semibold text-slate-950">
                신규/대체/해지 유형 분석
              </div>
              <div className="mt-1 text-[12px] font-semibold text-slate-500">
                {currentYear}년도 · {sourceTitle(data) || "엑셀 기준"} · {saveText}
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

        <div className="border-t border-slate-100 px-5 py-3">
          <div className="inline-flex max-w-full min-w-0 flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {tabItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`h-9 rounded-xl px-4 text-[13px] font-bold transition ${
                  tab === item.key
                    ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:bg-white hover:text-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {tab === "summary" ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <AnalysisCardHeader
            eyebrow="Overview"
            title={`${currentYear}년 신규/대체/해지 유형 분석 요약`}
            asOf={sourceTitle(data) || "엑셀 기준"}
            tone="slate"
          />
          <div className="space-y-4 p-5">
            <SimpleKpiGrid
              items={[
                { label: "신규/대체", value: `${formatNumber(newTotal)}건`, tone: "blue", sub: `신규 ${formatNumber(pureNewTotal)} · 대체 ${formatNumber(replacementTotal)}` },
                { label: "해지", value: `${formatNumber(terminationTotal)}건`, tone: "rose" },
                { label: "순증", value: `${formatNumber(netTotal)}건`, tone: "emerald" },
                { label: "영역 상세", value: `${formatNumber(areaRecords.length)}건`, tone: "slate" },
                { label: "누적", value: cleanCumulativeLabel(data?.areaNetGrowth?.cumulativeNetLabel) || "-", tone: "slate" },
              ]}
            />

            <div className="grid gap-4 xl:grid-cols-2">
              <CompactMetricBand title="업무성격" tone="blue" items={summaryWorkMetrics} />
              <CompactMetricBand title="타사단말기 대체" tone="indigo" items={summaryReplacementMetrics.map((item) => ({ ...item, dashZero: true }))} />
              <CompactMetricBand title="해지유형" tone="rose" items={summaryTerminationMetrics.map((item) => ({ ...item, dashZero: true }))} />
              <CompactMetricBand title="경쟁사 변경" tone="indigo" items={summaryCompetitorMetrics.map((item) => ({ ...item, dashZero: true }))} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-semibold text-slate-500">
                원본 파일 수정 시각: <span className="text-slate-700">{sourceUpdatedLabel(data?.sourceUpdatedAt) || "확인 필요"}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[12px] font-semibold text-slate-500">
                최근 반영:{" "}
                <span className="text-slate-700">
                  {latestSnapshot ? `${latestSnapshot.label || "마지막 반영"} · ${compactDate(latestSnapshot.createdAt)}` : "주간 반영 내역 없음"}
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "new" ? (
        <div className="space-y-4">
          <NewReplacementExcelSummary
            year={currentYear}
            asOf={data?.newReplacement?.asOf || sourceTitle(data)}
            workSummary={data?.newReplacement?.workSummary || []}
            replacementSummary={data?.newReplacement?.replacementSummary || []}
            industryRows={industryMatrixRows}
          />
          <GroupedNewRecordsTable
            groups={groupedNewRecords}
            industryOptions={industryMoveOptions}
            onMoveRecord={onMoveRecord}
          />
        </div>
      ) : null}

      {tab === "termination" ? (
        <div className="space-y-4">
          <TerminationMatrixTable
            year={currentYear}
            asOf={data?.terminationType?.asOf || sourceTitle(data)}
            reasonSummary={data?.terminationType?.reasonSummary || []}
            competitorSummary={data?.terminationType?.competitorSummary || []}
            rows={terminationMatrixRows}
          />
          <GroupedTerminationRecordsTable
            groups={groupedTerminationRecords}
            industryOptions={industryMoveOptions}
            onMoveRecord={onMoveRecord}
          />
        </div>
      ) : null}

      {tab === "area" ? (
        <div className="space-y-4">
          <AreaSummaryTable
            year={currentYear}
            asOf={data?.areaNetGrowth?.asOf || sourceTitle(data)}
            cumulativeLabel={data?.areaNetGrowth?.cumulativeNetLabel}
            rows={areaSummaryRows}
          />
          <GroupedAreaRecordsTable
            groups={groupedAreaRecords}
            areaOptions={areaMoveOptions}
            onMoveRecord={onMoveRecord}
          />
        </div>
      ) : null}

      {tab === "personal" ? (
        <div className="space-y-4">
          <PersonalPerformancePanel
            year={currentYear}
            asOf={data?.personalPerformance?.asOf || sourceTitle(data)}
            rows={personalRowsForDisplay}
          />
        </div>
      ) : null}
    </div>
  )
}
