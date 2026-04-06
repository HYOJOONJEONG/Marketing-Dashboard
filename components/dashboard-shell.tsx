"use client"

import { useEffect, useMemo, useState, useTransition } from "react"

type ViewKey = "weekly-report" | "contracts" | "weekly-selection" | "manual-input" | "collection" | "termination"
type CollectionTabKey = "integrated" | "long-term"
type SectionKey = "performance" | "termination"

const viewTitles: Record<ViewKey, string> = {
  "weekly-report": "주간실적보고",
  contracts: "신규계약 리스트",
  "weekly-selection": "주간 반영 리스트",
  "manual-input": "수동 입력 리스트",
  collection: "계약서통합관리",
  termination: "해지 진행사항",
}

  const cardClass = "rounded-[24px] border border-slate-200 bg-white shadow-sm"
const tableClass = "w-full text-[14px]"
const thClass = "border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-[13px] font-semibold text-slate-600"
const tdClass = "border-t border-slate-200 px-3 py-2.5 align-middle text-[14px] text-slate-800"
const weeklyReportTableClass = "weekly-report-table w-full table-fixed text-[14px]"
const weeklyThClass = "border-b border-slate-200 bg-slate-50 px-2.5 py-2 text-center text-[13px] font-semibold text-slate-700"
const weeklyTdClass = "border-t border-slate-200 px-2.5 py-2 text-center align-middle text-[14px] text-slate-800"
const manualTableInputClass =
  "h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-[13px] font-medium text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
const manualTableTextInputClass =
  "h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-medium text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
const manualSectionTitleClass = "text-[15px] font-bold text-slate-900"
const manualHeaderCellClass = "border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[13px] font-semibold text-slate-700"
const manualLabelCellClass = "w-[132px] bg-slate-50 px-3 py-2.5 text-center text-[13px] font-semibold text-slate-700"
const manualTableTitleRowClass = "border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[16px] font-bold text-slate-900"

function toNumber(value: unknown) {
  const num = Number(String(value ?? "").replace(/,/g, ""))
  return Number.isNaN(num) ? 0 : num
}

function formatNumber(value: unknown) {
  return toNumber(value).toLocaleString("ko-KR")
}

function formatMoney(value: unknown) {
  return `${formatNumber(value)}원`
}

function formatNumericInputDisplay(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (!digits) return ""
  return Number(digits).toLocaleString("ko-KR")
}

function normalizeDate(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (digits.length === 8) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
  if (digits.length === 6) return `20${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}`
  return String(value ?? "")
}

function toInputDate(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  return ""
}

function parseDateKey(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (digits.length === 6) return Number(`20${digits}`)
  if (digits.length === 8) return Number(digits)
  return 0
}

function parseContractMonthParts(value: unknown) {
  const text = String(value ?? "").trim()
  if (!text) return null

  const yearMonthMatch = text.match(/(\d{2,4})\D+(\d{1,2})/)
  if (yearMonthMatch) {
    const rawYear = yearMonthMatch[1]
    const rawMonth = yearMonthMatch[2]
    const year = rawYear.length === 2 ? Number(`20${rawYear}`) : Number(rawYear)
    const month = Number(rawMonth)
    if (year && month >= 1 && month <= 12) return { year, month }
  }

  const digits = text.replace(/[^\d]/g, "")
  if (digits.length === 6) {
    const year = Number(digits.slice(0, 4))
    const month = Number(digits.slice(4, 6))
    if (year && month >= 1 && month <= 12) return { year, month }
  }
  if (digits.length === 4) {
    const year = Number(`20${digits.slice(0, 2)}`)
    const month = Number(digits.slice(2, 4))
    if (year && month >= 1 && month <= 12) return { year, month }
  }
  return null
}

function parseContractMonthKey(value: unknown) {
  const parts = parseContractMonthParts(value)
  if (parts) return parts.year * 100 + parts.month
  return 0
}

function sortByDateDesc<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return [...items].sort((a, b) => parseDateKey(b[key]) - parseDateKey(a[key]))
}

function sortByKey<T extends Record<string, unknown>>(items: T[], key: keyof T, dir: "asc" | "desc") {
  const factor = dir === "asc" ? 1 : -1
  return [...items].sort((a, b) => {
    const left = a[key]
    const right = b[key]
    const leftDate = parseDateKey(left)
    const rightDate = parseDateKey(right)
    if (leftDate || rightDate) {
      return (leftDate - rightDate) * factor
    }
    return String(left ?? "").localeCompare(String(right ?? ""), "ko", {
      numeric: true,
      sensitivity: "base",
    }) * factor
  })
}

function sanitizeText(text: unknown, fallback: string) {
  const value = String(text ?? "").trim()
  if (!value) return fallback
  if (/[가-힣]/.test(value)) return value
  if (/원/.test(value)) return value
  return fallback
}

function sanitizeSummaryText(text: unknown, fallback: string) {
  const value = String(text ?? "").trim()
  if (!value) return fallback
  if (/[가-힣]/.test(value)) return value
  return fallback
}

function buildRevenueRows(rows: any[]) {
  const fallbackLabels = ["매출순증", "위약금", "이전비", "합계"]
  const fallbackKeys = ["sales", "penalty", "move", "total"]
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    ...row,
    key: row?.key || fallbackKeys[index] || `row-${index}`,
    label: sanitizeSummaryText(row?.label, fallbackLabels[index] || `항목 ${index + 1}`),
    months: Array.from({ length: 12 }, (_, monthIndex) => toNumber(row?.months?.[monthIndex])),
  }))
}

const goalRowTemplate2026 = [
  { month: "1월", netTarget: 45, targetContracts: 6149, quarterNetTarget: 105, monthlyActual: 47, quarterActual: 106, gap: 1 },
  { month: "2월", netTarget: 30, targetContracts: 6179, quarterNetTarget: "", monthlyActual: 24, quarterActual: "", gap: "" },
  { month: "3월", netTarget: 30, targetContracts: 6209, quarterNetTarget: "", monthlyActual: 35, quarterActual: "", gap: "" },
  { month: "4월", netTarget: 30, targetContracts: 6239, quarterNetTarget: 70, monthlyActual: 7, quarterActual: 7, gap: "" },
  { month: "5월", netTarget: 20, targetContracts: 6259, quarterNetTarget: "", monthlyActual: "", quarterActual: "", gap: "" },
  { month: "6월", netTarget: 20, targetContracts: 6279, quarterNetTarget: "", monthlyActual: "", quarterActual: "", gap: "" },
  { month: "7월", netTarget: 20, targetContracts: 6299, quarterNetTarget: 55, monthlyActual: "", quarterActual: "", gap: "" },
  { month: "8월", netTarget: 20, targetContracts: 6319, quarterNetTarget: "", monthlyActual: "", quarterActual: "", gap: "" },
  { month: "9월", netTarget: 15, targetContracts: 6334, quarterNetTarget: "", monthlyActual: "", quarterActual: "", gap: "" },
  { month: "10월", netTarget: 15, targetContracts: 6349, quarterNetTarget: 30, monthlyActual: "", quarterActual: "", gap: "" },
  { month: "11월", netTarget: 15, targetContracts: 6364, quarterNetTarget: "", monthlyActual: "", quarterActual: "", gap: "" },
  { month: "12월", netTarget: 0, targetContracts: 6364, quarterNetTarget: "", monthlyActual: "", quarterActual: "", gap: "" },
  { month: "합계", netTarget: 260, targetContracts: 6364, quarterNetTarget: 260, monthlyActual: 113, quarterActual: 113, gap: -147 },
] as const

function parseGoalMonthOrder(value: unknown) {
  const text = String(value ?? "").trim()
  if (!text) return null
  if (text.includes("합")) return 13
  const digits = text.replace(/[^\d]/g, "")
  if (!digits) return null
  const month = Number(digits.slice(-2).replace(/^0/, "") || digits.slice(-1) || digits)
  if (month >= 1 && month <= 12) return month
  return null
}

function buildGoalRows(rows: any[]) {
  const mergedByMonth = new Map<number, any>()
  ;(Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const parsedOrder = parseGoalMonthOrder(row?.month) ?? (index + 1 <= 12 ? index + 1 : 13)
    mergedByMonth.set(parsedOrder, {
      month: parsedOrder === 13 ? "합계" : `${parsedOrder}월`,
      netTarget: row?.netTarget ?? row?.monthlyNetTarget ?? "",
      targetContracts: row?.targetContracts ?? row?.contractTarget ?? "",
      quarterNetTarget: row?.quarterNetTarget ?? row?.quarterTarget ?? "",
      monthlyActual: row?.monthlyActual ?? row?.actual ?? "",
      quarterActual: row?.quarterActual ?? row?.quarterlyActual ?? "",
      gap: row?.gap ?? row?.achievementGap ?? "",
    })
  })

  return goalRowTemplate2026.map((templateRow, index) => {
    const order = index + 1 <= 12 ? index + 1 : 13
    const savedRow = mergedByMonth.get(order)
    return {
      month: templateRow.month,
      netTarget: savedRow?.netTarget === "" || savedRow?.netTarget == null ? templateRow.netTarget : savedRow.netTarget,
      targetContracts:
        savedRow?.targetContracts === "" || savedRow?.targetContracts == null
          ? templateRow.targetContracts
          : savedRow.targetContracts,
      quarterNetTarget:
        savedRow?.quarterNetTarget === "" || savedRow?.quarterNetTarget == null
          ? templateRow.quarterNetTarget
          : savedRow.quarterNetTarget,
      monthlyActual:
        savedRow?.monthlyActual === "" || savedRow?.monthlyActual == null
          ? templateRow.monthlyActual
          : savedRow.monthlyActual,
      quarterActual:
        savedRow?.quarterActual === "" || savedRow?.quarterActual == null
          ? templateRow.quarterActual
          : savedRow.quarterActual,
      gap: savedRow?.gap === "" || savedRow?.gap == null ? templateRow.gap : savedRow.gap,
    }
  })
}

function buildIndustryStats(rows: any[]) {
  const fallbackCategories = ["국내증권", "국내은행", "외국계", "자산운용", "보험사", "일반기업", "공사/정부", "연기금", "기타금융", "합계"]
  return (Array.isArray(rows) ? rows : []).map((row, index) => ({
    ...row,
    category: sanitizeSummaryText(row?.category, fallbackCategories[index] || `업종 ${index + 1}`),
    newCount: toNumber(row?.newCount),
    netCount: toNumber(row?.netCount),
  }))
}

function normalizeSummaryStatus(text: unknown, fallback: string) {
  const value = String(text ?? "").trim()
  if (!value) return fallback
  if (/[가-힣]/.test(value)) return value
  return fallback
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function normalizeAdditionalSalesRows(rows: any[]) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return [{ label: "", amount: "", note: "" }]
  return list.map((row) => ({
    label: String(row?.label ?? ""),
    amount: String(row?.amount ?? ""),
    note: String(row?.note ?? ""),
  }))
}

function buildAutoRevenueHeader(unitPrice: unknown, selectedCount: number, additionalContractCount: unknown) {
  const baseUnitPrice = toNumber(unitPrice) || 6160000
  const bonusRevenue = Math.max(0, toNumber(additionalContractCount))
  const computedRevenue = Math.max(0, baseUnitPrice * Math.max(0, selectedCount)) + bonusRevenue
  return `주간 순증 매출 (약 ${formatMoney(computedRevenue)})`
}

function normalizeRevenueHeaderText(value: unknown, fallback: string) {
  const text = sanitizeText(value, fallback).trim()
  const matched = text.match(/^주간\s*순증\s*매출\s*\(약\s*([\d,]+)\s*원?\)$/)
  if (matched) {
    return `주간 순증 매출 (약 ${matched[1]}원)`
  }
  return text
}

function sumRevenueRowTotals(rows: any[]) {
  return buildRevenueRows(rows || []).reduce((sum, row) => {
    const rowTotal = (row.months || []).reduce((rowSum: number, value: number) => rowSum + toNumber(value), 0)
    return sum + rowTotal
  }, 0)
}

function getRevenueTotalMillions(rows: any[]) {
  const normalizedRows = buildRevenueRows(rows || [])
  const totalRow =
    normalizedRows.find((row) => String(row?.label || "").trim() === "합계") ||
    normalizedRows[normalizedRows.length - 1]
  return (totalRow?.months || []).reduce((sum: number, value: number) => sum + toNumber(value), 0)
}

function getRevenueRowMillionsByLabel(rows: any[], label: string) {
  const normalizedRows = buildRevenueRows(rows || [])
  const targetRow = normalizedRows.find((row) => String(row?.label || "").trim() === label)
  return (targetRow?.months || []).reduce((sum: number, value: number) => sum + toNumber(value), 0)
}

function buildAnnualNetRevenueSubtitle(rows: any[], summary: any, unitPrice: unknown) {
  const totalMillions = getRevenueTotalMillions(rows)
  const salesMillions = getRevenueRowMillionsByLabel(rows, "매출순증")
  const nonSalesRevenue = Math.max(0, totalMillions - salesMillions) * 1000000
  const cumulativeNetUnits = Math.max(0, toNumber(summary?.cumulativeNetUnits))
  const baseUnitPrice = toNumber(unitPrice) || 6160000
  const cumulativeNetRevenue = cumulativeNetUnits * baseUnitPrice
  return `26년 순증 매출 (약 ${formatMoney(nonSalesRevenue + cumulativeNetRevenue)})`
}

function buildAnnualCumulativeRevenueSubtitle(totalContracts: unknown, unitPrice: unknown) {
  const contractCount = Math.max(0, toNumber(totalContracts))
  const baseUnitPrice = toNumber(unitPrice) || 6160000
  return `연간 누적 매출 (약 ${formatMoney(contractCount * baseUnitPrice)})`
}

function buildRevenueNoteText(baseDate: unknown, unitPrice: unknown) {
  const normalized = normalizeDate(baseDate)
  const mmdd = normalized && normalized.length >= 10 ? normalized.slice(5, 10).replace(".", "/") : ""
  const baseUnitPrice = toNumber(unitPrice) || 6160000
  const dateLabel = mmdd ? ` (${mmdd} 기준)` : ""
  return `※대당 연 ${formatNumber(baseUnitPrice)}원으로 매출을 산정${dateLabel} / 위약금 및 이전비는 월 단위로 계산하되, 모든 금액 단위는 백만 원으로 표기.`
}

function buildRevenueDisplaySet(params: {
  revenueHeaderText?: unknown
  subtitleOne?: unknown
  subtitleTwo?: unknown
  revenueUnitPrice?: unknown
  additionalContractCount?: unknown
  manualSummary?: any
  revenueRows?: any[]
  fallbackSelectedCount?: number
}) {
  const selectedContractCount = Math.max(0, Number(params.fallbackSelectedCount || 0))
  const computedHeader = buildAutoRevenueHeader(
    params.revenueUnitPrice,
    selectedContractCount,
    params.additionalContractCount,
  )
  const computedSubtitleOne = buildAnnualNetRevenueSubtitle(
    params.revenueRows || [],
    params.manualSummary,
    params.revenueUnitPrice,
  )
  const computedSubtitleTwo = buildAnnualCumulativeRevenueSubtitle(
    params?.manualSummary?.totalContracts,
    params.revenueUnitPrice,
  )
  return {
    // Always use the current computed values so the weekly report behaves like
    // a direct Excel-style cell reference to the manual input screen.
    header: normalizeRevenueHeaderText(computedHeader, computedHeader),
    subtitleOne: normalizeRevenueSubtitleOne(computedSubtitleOne),
    subtitleTwo: sanitizeText(computedSubtitleTwo, "연간 누적 매출"),
  }
}

function buildManualDraftFromWeekly(weekly: any, contracts: any[]) {
  const safeWeekly = weekly || {}
  const summary = safeWeekly.manualSummary || {}
  const includedContractCount = (contracts || []).filter((row: any) => row.includedInWeekly).length
  const revenueUnitPrice = toNumber(safeWeekly.revenueUnitPrice) || 6160000
  const additionalContractCount = toNumber(safeWeekly.additionalContractCount)
  const revenueDisplay = buildRevenueDisplaySet({
    revenueHeaderText: safeWeekly.revenueHeaderText,
    subtitleOne: safeWeekly.subtitleOne,
    subtitleTwo: safeWeekly.subtitleTwo,
    revenueUnitPrice,
    additionalContractCount,
    manualSummary: summary,
    revenueRows: safeWeekly.revenueRows || [],
    fallbackSelectedCount: includedContractCount,
  })
  const revenueNoteText = sanitizeText(
    safeWeekly.revenueNoteText || buildRevenueNoteText(safeWeekly.baseDate, revenueUnitPrice),
    buildRevenueNoteText(safeWeekly.baseDate, revenueUnitPrice),
  )

  return {
    revenueHeaderText: revenueDisplay.header,
    revenueUnitPrice: String(revenueUnitPrice),
    additionalContractCount: String(additionalContractCount || 0),
    subtitleOne: revenueDisplay.subtitleOne,
    subtitleTwo: revenueDisplay.subtitleTwo,
    manualSummary: { ...summary },
    revenueNoteText,
    revenueRows: cloneData(safeWeekly.revenueRows || []),
    goalRows: cloneData(safeWeekly.goalRows || []),
    industryStats: cloneData(safeWeekly.industryStats || []),
    additionalSales: normalizeAdditionalSalesRows(cloneData(safeWeekly.additionalSales || [])),
  }
}

function normalizeRevenueSubtitleOne(value: unknown) {
  const text = sanitizeText(value, "26년 순증 매출")
  return text
    .replace(/^2025년\s*순증\s*매출/, "26년 순증 매출")
    .replace(/^25년\s*순증\s*매출/, "26년 순증 매출")
}

function getWeeklyNetUnitsValue(summary: any, fallback: number) {
  const value = toNumber(summary?.weeklyNetUnits)
  return value > 0 ? value : fallback
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function renderChip(text: string, tone: "blue" | "green" | "red" | "gray" = "blue") {
  const className =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "red"
        ? "bg-rose-50 text-rose-700"
        : tone === "gray"
          ? "bg-slate-100 text-slate-600"
          : "bg-blue-50 text-blue-700"
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold ${className}`}>{text}</span>
}

function renderStatusBadge(status: string) {
  const normalized = status || "미정"
  const className =
    normalized === "회수"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : normalized === "미회수"
        ? "bg-rose-50 text-rose-700 border-rose-100"
        : "bg-slate-100 text-slate-600 border-slate-200"
  return (
    <span className={`inline-flex min-w-[56px] justify-center rounded-full border px-3 py-1 text-[12px] font-semibold ${className}`}>
      {normalized}
    </span>
  )
}

function summaryPairs(summary: any) {
  return [
    ["주간순증 합계", `${formatNumber(summary?.weeklyNetUnits)}대`],
    ["신규계약", `${formatNumber(summary?.weeklyNewContracts)}대`],
    ["해지계약", `${formatNumber(summary?.weeklyTerminationContracts)}대`],
    ["누적순증 합계", `${formatNumber(summary?.cumulativeNetUnits)}대`],
    ["누적신규 계약", `${formatNumber(summary?.cumulativeNewContracts)}대`],
    ["누적해지계약", `${formatNumber(summary?.cumulativeTerminationContracts)}대`],
    ["총 계약대수", `${formatNumber(summary?.totalContracts)}대`],
  ]
}

export function DashboardShell({
  initialData,
  initialView = "weekly-report",
  initialCollectionTab = "integrated",
  initialSheetId,
}: {
  initialData: any
  initialView?: ViewKey
  initialCollectionTab?: CollectionTabKey
  initialSheetId?: string
}) {
  const [data, setData] = useState<any>(initialData)
  const [view, setView] = useState<ViewKey>(initialView)
  const [collectionTab, setCollectionTab] = useState<CollectionTabKey>(initialCollectionTab)
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ performance: true, termination: true })
  const [terminationSheetId, setTerminationSheetId] = useState<string | undefined>(
    initialSheetId || initialData?.termination?.currentSheetId || initialData?.termination?.sheets?.[0]?.id,
  )
  const [isPending, startTransition] = useTransition()
  const [manualDraft, setManualDraft] = useState<any>(() =>
    buildManualDraftFromWeekly(initialData?.weeklyReport || {}, initialData?.contracts || []),
  )
  const [manualRevenueHeaderEdited, setManualRevenueHeaderEdited] = useState(false)
  const [contractDraft, setContractDraft] = useState<any>({
    companyName: "",
    departmentName: "",
    idCode: "",
    industry: "국내증권",
    contractMonth: "",
    recommender: "",
    documentStatus: "미회수",
  })
  const [editingContractId, setEditingContractId] = useState<string | null>(null)
  const [editingContractDraft, setEditingContractDraft] = useState<any>({})
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null)
  const [editingCollectionDraft, setEditingCollectionDraft] = useState<any>({})
  const [collectionYearFilter, setCollectionYearFilter] = useState<number | "all">(initialData?.collection?.yearFilter || 2026)
  const [collectionStatusFilter, setCollectionStatusFilter] = useState<string>(initialData?.collection?.statusFilter || "all")
  const [historyStack, setHistoryStack] = useState<any[]>([])
  const [terminationEntryMode, setTerminationEntryMode] = useState<"termination" | "hold">("termination")
  const [terminationDraft, setTerminationDraft] = useState<any>({
    receivedDate: toInputDate(new Date().toISOString().slice(0, 10)),
    manager: "",
    customerId: "",
    companyName: "",
    departmentName: "",
    reason: "계약만료",
    reasonDetail: "",
    terminationDate: "",
    penalty: "",
  })
  const [holdDraft, setHoldDraft] = useState<any>({
    receivedDate: toInputDate(new Date().toISOString().slice(0, 10)),
    manager: "",
    customerId: "",
    companyName: "",
    departmentName: "",
    reason: "사용자퇴사",
    startDate: "",
    endDate: "",
  })
  const [terminationSort, setTerminationSort] = useState<{ key: "receivedDate" | "terminationDate"; dir: "asc" | "desc" }>({
    key: "receivedDate",
    dir: "desc",
  })
  const [holdSort, setHoldSort] = useState<{ key: "receivedDate" | "startDate" | "endDate"; dir: "asc" | "desc" }>({
    key: "receivedDate",
    dir: "desc",
  })
  const [editingTerminationId, setEditingTerminationId] = useState<string | null>(null)
  const [editingTerminationDraft, setEditingTerminationDraft] = useState<any>({})
  const [editingHoldId, setEditingHoldId] = useState<string | null>(null)
  const [editingHoldDraft, setEditingHoldDraft] = useState<any>({})

  const weeklyReport = data.weeklyReport || {}
  const contracts = data.contracts || []
  const collection = data.collection || { integrated: [], longTerm: [] }
  const termination = data.termination || { sheets: [], currentSheetId: undefined }
  const currentYear = data.currentYear
  const availableYears = data.availableYears || data.years || []

  const selectedSheet = useMemo(
    () => termination.sheets?.find((sheet: any) => sheet.id === terminationSheetId) || termination.sheets?.[0] || null,
    [termination.sheets, terminationSheetId],
  )
  const includedContracts = useMemo(() => contracts.filter((row: any) => row.includedInWeekly), [contracts])

  useEffect(() => {
    if (manualRevenueHeaderEdited) return
    const nextHeader = buildAutoRevenueHeader(
      manualDraft.revenueUnitPrice,
      includedContracts.length,
      manualDraft.additionalContractCount,
    )
    setManualDraft((prev: any) => (
      prev.revenueHeaderText === nextHeader
        ? prev
        : { ...prev, revenueHeaderText: nextHeader }
    ))
  }, [includedContracts.length, manualDraft.additionalContractCount, manualDraft.revenueUnitPrice, manualRevenueHeaderEdited])

  useEffect(() => {
    const nextSubtitleOne = buildAnnualNetRevenueSubtitle(
      manualDraft.revenueRows || [],
      manualDraft.manualSummary,
      manualDraft.revenueUnitPrice,
    )
    const nextSubtitleTwo = buildAnnualCumulativeRevenueSubtitle(
      manualDraft?.manualSummary?.totalContracts,
      manualDraft.revenueUnitPrice,
    )
    setManualDraft((prev: any) => {
      if (prev.subtitleOne === nextSubtitleOne && prev.subtitleTwo === nextSubtitleTwo) return prev
      return {
        ...prev,
        subtitleOne: nextSubtitleOne,
        subtitleTwo: nextSubtitleTwo,
      }
    })
  }, [manualDraft.revenueRows, manualDraft.manualSummary?.totalContracts, manualDraft.revenueUnitPrice])

  useEffect(() => {
    setManualDraft(buildManualDraftFromWeekly(weeklyReport, contracts))
    setManualRevenueHeaderEdited(false)
  }, [weeklyReport, contracts])

  const contractMonthStats = useMemo(() => {
    const currentYearNumber = Number(currentYear) || 2026
    const monthCounts = new Map<number, number>()
    const fallbackMap = new Map<string, number>()
    contracts.forEach((row: any) => {
      const month = String(row.contractMonth || "").trim() || "미입력"
      const parsed = parseContractMonthParts(month)
      if (parsed && parsed.year === currentYearNumber) {
        monthCounts.set(parsed.month, (monthCounts.get(parsed.month) || 0) + 1)
      } else {
        fallbackMap.set(month, (fallbackMap.get(month) || 0) + 1)
      }
    })
    const months = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1
      return {
        label: `${String(currentYearNumber).slice(-2)}년 ${month}월`,
        count: monthCounts.get(month) || 0,
        sortKey: currentYearNumber * 100 + month,
      }
    })
    const fallback = [...fallbackMap.entries()]
      .map(([label, count]) => ({ label, count, sortKey: parseContractMonthKey(label) }))
      .sort((a, b) => {
        if (a.sortKey || b.sortKey) return a.sortKey - b.sortKey
        return a.label.localeCompare(b.label, "ko")
      })
    return [...months, ...fallback.filter((row) => row.label !== "미입력")]
  }, [contracts, currentYear])
  const contractRecommenderStats = useMemo(() => {
    const map = new Map<string, number>()
    contracts.forEach((row: any) => {
      const name = String(row.recommender || "").trim() || "미입력"
      map.set(name, (map.get(name) || 0) + 1)
    })
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label, "ko"))
  }, [contracts])
  const contractMonthRows = useMemo(() => chunkArray(contractMonthStats, 6), [contractMonthStats])
  const contractRecommenderRows = useMemo(() => chunkArray(contractRecommenderStats, 4), [contractRecommenderStats])
  const collectionRows = useMemo(
    () => (collectionTab === "long-term" ? collection.longTerm || [] : collection.integrated || []),
    [collection, collectionTab],
  )
  const filteredCollectionRows = useMemo(() => {
    return collectionRows.filter((row: any) => {
      const yearOk = collectionYearFilter === "all" ? true : Number(row.year) === Number(collectionYearFilter)
      const statusOk = collectionStatusFilter === "all" ? true : (row.status || "미정") === collectionStatusFilter
      return yearOk && statusOk
    })
  }, [collectionRows, collectionStatusFilter, collectionYearFilter])
  const collectionIndustrySummary = useMemo(() => {
    const sourceRows = collectionRows.filter((row: any) => (
      collectionYearFilter === "all" ? true : Number(row.year) === Number(collectionYearFilter)
    ))
    const order = ["국내증권", "국내은행", "외국계", "자산운용", "보험", "일반기업", "연기금", "정부기관", "공기업", "공제회", "기타"]
    const map = new Map<string, { industry: string; total: number; recovered: number; missing: number }>()
    sourceRows.forEach((row: any) => {
      const industry = String(row.industry || "기타").trim() || "기타"
      const bucket = map.get(industry) || { industry, total: 0, recovered: 0, missing: 0 }
      bucket.total += 1
      if (row.status === "회수") bucket.recovered += 1
      if (row.status === "미회수") bucket.missing += 1
      map.set(industry, bucket)
    })
    const rows = [...map.values()].sort((a, b) => {
      const ai = order.indexOf(a.industry)
      const bi = order.indexOf(b.industry)
      if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999)
      return a.industry.localeCompare(b.industry, "ko")
    })
    const totals = rows.reduce(
      (acc, row) => ({ total: acc.total + row.total, recovered: acc.recovered + row.recovered, missing: acc.missing + row.missing }),
      { total: 0, recovered: 0, missing: 0 },
    )
    return [...rows, { industry: "합계", total: totals.total, recovered: totals.recovered, missing: totals.missing }]
  }, [collectionRows, collectionYearFilter])
  const collectionIndustryMatrix = useMemo(() => {
    const rows = collectionIndustrySummary || []
    const headers = rows.map((row: any) => row.industry)
    return {
      headers,
      rows: [
        { label: "계약수", values: rows.map((row: any) => row.total) },
        { label: "회수", values: rows.map((row: any) => row.recovered) },
        { label: "미회수", values: rows.map((row: any) => row.missing) },
      ],
    }
  }, [collectionIndustrySummary])
  const terminationItems = useMemo(
    () => sortByKey(selectedSheet?.items || [], terminationSort.key, terminationSort.dir),
    [selectedSheet, terminationSort],
  )
  const holdItems = useMemo(
    () => sortByKey(selectedSheet?.holdItems || [], holdSort.key, holdSort.dir),
    [selectedSheet, holdSort],
  )
  const selectedTerminationCount = useMemo(
    () => (selectedSheet?.items || []).filter((row: any) => Boolean(row.selected)).length,
    [selectedSheet],
  )
  const visibleWeeklyTerminationCount = useMemo(
    () => Math.max(0, (selectedSheet?.items || []).length - selectedTerminationCount),
    [selectedSheet, selectedTerminationCount],
  )
  const visibleWeeklyBillingHoldCount = useMemo(
    () => (selectedSheet?.holdItems || []).length,
    [selectedSheet],
  )
  const reasonSummary = useMemo(() => {
    const map = new Map<string, number>()
    terminationItems.forEach((row: any) => {
      map.set(row.reason || "기타", (map.get(row.reason || "기타") || 0) + 1)
    })
    return [...map.entries()]
  }, [terminationItems])

  async function persist(nextData: any) {
    setHistoryStack((prev) => [cloneData(data), ...prev].slice(0, 20))
    setData(nextData)
    await fetch("/api/dashboard", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextData),
    })
  }

  function handleUndoLastAction() {
    if (!historyStack.length) {
      window.alert("되돌릴 작업이 없습니다.")
      return
    }
    const [previous, ...rest] = historyStack
    startTransition(async () => {
      setHistoryStack(rest)
      setData(previous)
      await fetch("/api/dashboard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previous),
      })
    })
  }

  function handleWeeklyReportPrint() {
    const previousTitle = document.title
    const baseDateDigits = String(weeklyReport.baseDate || "")
      .replace(/[^\d]/g, "")
      .slice(2, 8)
    document.title = `주간실적보고 ${baseDateDigits || "보고서"}`
    window.print()
    window.setTimeout(() => {
      document.title = previousTitle
    }, 300)
  }

  function handleYearChange(nextYear: number) {
    setData((prev: any) => ({ ...prev, currentYear: nextYear }))
  }

  function handleCreateYear() {
    const now = new Date()
    const isOpen = now.getFullYear() > 2026 || (now.getFullYear() === 2026 && now.getMonth() >= 11)
    if (!isOpen) {
      window.alert("26년 12월에 기능이 열립니다.")
      return
    }
    const nextYear = Math.max(...(availableYears || [Number(currentYear)]).map((year: number) => Number(year))) + 1
    if ((availableYears || []).includes(nextYear)) {
      window.alert(`${nextYear}년은 이미 있습니다.`)
      setData((prev: any) => ({ ...prev, currentYear: nextYear }))
      return
    }
    startTransition(async () => {
      const nextData = {
        ...data,
        currentYear: nextYear,
        availableYears: [nextYear, ...availableYears],
        years: [nextYear, ...(data.years || [])],
      }
      await persist(nextData)
    })
  }

  function updateManualField(field: string, value: string) {
    if (field === "revenueHeaderText") {
      setManualRevenueHeaderEdited(true)
    }
    if (field === "revenueUnitPrice" || field === "additionalContractCount") {
      const digitsOnly = String(value ?? "").replace(/[^\d]/g, "")
      setManualDraft((prev: any) => ({ ...prev, [field]: digitsOnly }))
      return
    }
    setManualDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function updateContractDraft(field: string, value: string) {
    setContractDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function startContractEdit(row: any) {
    setEditingContractId(row.id)
    setEditingContractDraft({
      companyName: row.companyName || "",
      departmentName: row.departmentName || "",
      idCode: row.idCode || "",
      industry: row.industry || "국내증권",
      contractMonth: row.contractMonth || "",
      recommender: row.recommender || "",
      documentStatus: row.documentStatus || "미회수",
    })
  }

  function updateEditingContractDraft(field: string, value: string) {
    setEditingContractDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function updateManualSummaryField(field: string, value: string) {
    setManualDraft((prev: any) => ({
      ...prev,
      manualSummary: { ...prev.manualSummary, [field]: value },
    }))
  }

  function updateManualRevenueCell(rowIndex: number, monthIndex: number, value: string) {
    setManualDraft((prev: any) => {
      const revenueRows = cloneData(prev.revenueRows || [])
      if (!revenueRows[rowIndex]) return prev
      if (!Array.isArray(revenueRows[rowIndex].months)) revenueRows[rowIndex].months = Array(12).fill(0)
      revenueRows[rowIndex].months[monthIndex] = value
      return { ...prev, revenueRows }
    })
  }

  function updateManualGoalRow(rowIndex: number, field: string, value: string) {
    setManualDraft((prev: any) => {
      const goalRows = cloneData(prev.goalRows || [])
      if (!goalRows[rowIndex]) return prev
      goalRows[rowIndex][field] = value
      return { ...prev, goalRows }
    })
  }

  function updateManualIndustryRow(rowIndex: number, field: string, value: string) {
    setManualDraft((prev: any) => {
      const industryStats = cloneData(prev.industryStats || [])
      if (!industryStats[rowIndex]) return prev
      industryStats[rowIndex][field] = value
      return { ...prev, industryStats }
    })
  }

  function updateAdditionalSaleRow(rowIndex: number, field: string, value: string) {
    setManualDraft((prev: any) => {
      const additionalSales = normalizeAdditionalSalesRows(cloneData(prev.additionalSales || [])) as Array<Record<string, string>>
      additionalSales[rowIndex][field] = value
      return { ...prev, additionalSales }
    })
  }

  function addAdditionalSaleRow() {
    setManualDraft((prev: any) => ({
      ...prev,
      additionalSales: [
        ...(prev.additionalSales || []),
        { label: "", amount: "", note: "" },
      ],
    }))
  }

  function deleteAdditionalSaleRow(rowIndex: number) {
    setManualDraft((prev: any) => ({
      ...prev,
      additionalSales: normalizeAdditionalSalesRows((prev.additionalSales || []).filter((_: any, index: number) => index !== rowIndex)),
    }))
  }

  function toggleWeeklySelection(contractId: string) {
    startTransition(async () => {
      const nextContracts = contracts.map((row: any) =>
        row.id === contractId ? { ...row, includedInWeekly: !row.includedInWeekly } : row,
      )
      await persist({ ...data, contracts: nextContracts })
    })
  }

  function handleMoveWeeklySelectionToCollection() {
    if (!includedContracts.length) {
      window.alert("선택된 계약이 없습니다.")
      return
    }
    if (!window.confirm("신규 계약 리스트에서 삭제가 됩니다.\n계약서통합관리로 이동할까요?")) return

    startTransition(async () => {
      const baseDate = normalizeDate(weeklyReport?.baseDate || new Date().toISOString().slice(0, 10))
      const existingRows = collection.integrated || []
      const existingKeys = new Set(
        existingRows.map((row: any) => `${row.idCode || ""}|${row.claimMonth || ""}|${row.companyName || ""}`),
      )

      const movedRows = includedContracts
        .filter((row: any) => !existingKeys.has(`${row.idCode || ""}|${row.contractMonth || ""}|${row.companyName || ""}`))
        .map((row: any, index: number) => ({
          id: `collection-${Date.now()}-${index}`,
          year: currentYear,
          companyName: row.companyName || "",
          departmentName: row.departmentName || "",
          idCode: row.idCode || "",
          industry: row.industry || "",
          claimMonth: row.contractMonth || "",
          receiptDate: row.documentStatus === "회수" ? baseDate : "",
          status: row.documentStatus || "미회수",
        }))

      const selectedIds = new Set(includedContracts.map((row: any) => row.id))
      const nextContracts = contracts.filter((row: any) => !selectedIds.has(row.id))
      const nextData = {
        ...data,
        contracts: nextContracts,
        collection: {
          ...collection,
          integrated: [...movedRows, ...existingRows],
          yearFilter: currentYear,
          statusFilter: "all",
        },
      }

      await persist(nextData)
      setCollectionTab("integrated")
      setCollectionYearFilter(currentYear)
      setCollectionStatusFilter("all")
      setView("collection")
    })
  }

  function handleContractCreate() {
    if (!contractDraft.companyName.trim() || !contractDraft.idCode.trim()) {
      window.alert("회사명과 아이디는 필수입니다.")
      return
    }
    startTransition(async () => {
      const nextNo =
        contracts.reduce((max: number, row: any) => Math.max(max, Number(row.no || 0)), 0) + 1
      const nextContracts = [
        {
          id: `c${Date.now()}`,
          no: nextNo,
          companyName: contractDraft.companyName.trim(),
          departmentName: contractDraft.departmentName.trim(),
          idCode: contractDraft.idCode.trim(),
          industry: contractDraft.industry,
          contractMonth: contractDraft.contractMonth.trim(),
          documentStatus: contractDraft.documentStatus,
          includedInWeekly: false,
          recommender: contractDraft.recommender.trim(),
          replacementType: "신규",
          note: "",
        },
        ...contracts,
      ]
      await persist({ ...data, contracts: nextContracts })
      setContractDraft({
        companyName: "",
        departmentName: "",
        idCode: "",
        industry: "국내증권",
        contractMonth: "",
        recommender: "",
        documentStatus: "미회수",
      })
    })
  }

  function handleContractUpdate(contractId: string) {
    if (!editingContractDraft.companyName?.trim() || !editingContractDraft.idCode?.trim()) {
      window.alert("회사명과 아이디는 필수입니다.")
      return
    }
    startTransition(async () => {
      const nextContracts = contracts.map((row: any) =>
        row.id === contractId
          ? {
              ...row,
              companyName: editingContractDraft.companyName.trim(),
              departmentName: editingContractDraft.departmentName.trim(),
              idCode: editingContractDraft.idCode.trim(),
              industry: editingContractDraft.industry,
              contractMonth: editingContractDraft.contractMonth.trim(),
              recommender: editingContractDraft.recommender.trim(),
              documentStatus: editingContractDraft.documentStatus,
            }
          : row,
      )
      await persist({ ...data, contracts: nextContracts })
      setEditingContractId(null)
      setEditingContractDraft({})
    })
  }

  function handleContractDelete(contractId: string) {
    if (!window.confirm("이 계약을 삭제할까요?")) return
    startTransition(async () => {
      const nextContracts = contracts.filter((row: any) => row.id !== contractId)
      await persist({ ...data, contracts: nextContracts })
      if (editingContractId === contractId) {
        setEditingContractId(null)
        setEditingContractDraft({})
      }
    })
  }

  function handleCollectionDelete(rowId: string) {
    if (!window.confirm("이 항목을 삭제할까요?")) return
    startTransition(async () => {
      const key = collectionTab === "long-term" ? "longTerm" : "integrated"
      const nextCollectionRows = (collection[key] || []).filter((row: any) => row.id !== rowId)
      await persist({
        ...data,
        collection: {
          ...collection,
          [key]: nextCollectionRows,
          yearFilter: collectionYearFilter,
          statusFilter: collectionStatusFilter,
        },
      })
    })
  }

  function startCollectionEdit(row: any) {
    setEditingCollectionId(row.id)
    setEditingCollectionDraft({
      year: row.year || "",
      companyName: row.companyName || "",
      departmentName: row.departmentName || "",
      idCode: row.idCode || "",
      industry: row.industry || "",
      claimMonth: row.claimMonth || "",
      receiptDate: row.receiptDate || "",
      status: row.status || "미정",
    })
  }

  function updateEditingCollectionDraft(field: string, value: string) {
    setEditingCollectionDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function handleCollectionUpdate(rowId: string) {
    startTransition(async () => {
      const key = collectionTab === "long-term" ? "longTerm" : "integrated"
      const nextCollectionRows = (collection[key] || []).map((row: any) =>
        row.id === rowId
          ? {
              ...row,
              year: editingCollectionDraft.year,
              companyName: editingCollectionDraft.companyName,
              departmentName: editingCollectionDraft.departmentName,
              idCode: editingCollectionDraft.idCode,
              industry: editingCollectionDraft.industry,
              claimMonth: editingCollectionDraft.claimMonth,
              receiptDate: editingCollectionDraft.receiptDate,
              status: editingCollectionDraft.status,
            }
          : row,
      )
      await persist({
        ...data,
        collection: {
          ...collection,
          [key]: nextCollectionRows,
          yearFilter: collectionYearFilter,
          statusFilter: collectionStatusFilter,
        },
      })
      setEditingCollectionId(null)
      setEditingCollectionDraft({})
    })
  }

  function handleCollectionStatusToggle(rowId: string, nextStatus: string) {
    startTransition(async () => {
      const key = collectionTab === "long-term" ? "longTerm" : "integrated"
      const nextCollectionRows = (collection[key] || []).map((row: any) =>
        row.id === rowId
          ? {
              ...row,
              status: nextStatus,
              receiptDate:
                nextStatus === "회수"
                  ? row.receiptDate || normalizeDate(new Date().toISOString().slice(0, 10))
                  : "",
            }
          : row,
      )
      await persist({
        ...data,
        collection: {
          ...collection,
          [key]: nextCollectionRows,
          yearFilter: collectionYearFilter,
          statusFilter: collectionStatusFilter,
        },
      })
    })
  }

  function handleCollectionReceiptDateChange(rowId: string, nextValue: string) {
    startTransition(async () => {
      const key = collectionTab === "long-term" ? "longTerm" : "integrated"
      const nextCollectionRows = (collection[key] || []).map((row: any) =>
        row.id === rowId
          ? {
              ...row,
              receiptDate: nextValue,
            }
          : row,
      )
      await persist({
        ...data,
        collection: {
          ...collection,
          [key]: nextCollectionRows,
          yearFilter: collectionYearFilter,
          statusFilter: collectionStatusFilter,
        },
      })
    })
  }


  function handleCollectionTabChange(nextTab: CollectionTabKey) {
    setCollectionTab(nextTab)
    if (nextTab === "long-term") {
      setCollectionYearFilter("all")
      setCollectionStatusFilter("미회수")
    } else {
      setCollectionYearFilter(2026)
      setCollectionStatusFilter("all")
    }
  }

  function toggleTerminationSelected(itemId: string) {
    if (!selectedSheet) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              items: (sheet.items || []).map((row: any) =>
                row.id === itemId ? { ...row, selected: !row.selected } : row,
              ),
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
    })
  }

  function updateTerminationDraft(field: string, value: string) {
    setTerminationDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function updateHoldDraft(field: string, value: string) {
    setHoldDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function resetTerminationDraft() {
    setTerminationDraft({
      receivedDate: toInputDate(new Date().toISOString().slice(0, 10)),
      manager: "",
      customerId: "",
      companyName: "",
      departmentName: "",
      reason: "계약만료",
      reasonDetail: "",
      terminationDate: "",
      penalty: "",
    })
  }

  function resetHoldDraft() {
    setHoldDraft({
      receivedDate: toInputDate(new Date().toISOString().slice(0, 10)),
      manager: "",
      customerId: "",
      companyName: "",
      departmentName: "",
      reason: "사용자퇴사",
      startDate: "",
      endDate: "",
    })
  }

  function handleTerminationCreate() {
    if (!selectedSheet) return
    if (!terminationDraft.customerId.trim() || !terminationDraft.companyName.trim()) {
      window.alert("고객번호와 고객사는 필수입니다.")
      return
    }
    const nextItem = {
      id: `term-${Date.now()}`,
      no: "0",
      selected: false,
      receivedDate: normalizeDate(terminationDraft.receivedDate),
      manager: terminationDraft.manager.trim(),
      customerId: terminationDraft.customerId.trim(),
      companyName: terminationDraft.companyName.trim(),
      departmentName: terminationDraft.departmentName.trim(),
      reason: terminationDraft.reason === "기타" && terminationDraft.reasonDetail.trim()
        ? `기타(${terminationDraft.reasonDetail.trim()})`
        : terminationDraft.reason,
      terminationDate: normalizeDate(terminationDraft.terminationDate),
      penalty: toNumber(terminationDraft.penalty),
    }
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              items: [nextItem, ...(sheet.items || [])],
              weeklyTerminationCount: (sheet.weeklyTerminationCount || 0) + 1,
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      resetTerminationDraft()
    })
  }

  function handleHoldCreate() {
    if (!selectedSheet) return
    if (!holdDraft.customerId.trim() || !holdDraft.companyName.trim()) {
      window.alert("고객번호와 고객사는 필수입니다.")
      return
    }
    const nextItem = {
      id: `hold-${Date.now()}`,
      no: "0",
      receivedDate: normalizeDate(holdDraft.receivedDate),
      manager: holdDraft.manager.trim(),
      customerId: holdDraft.customerId.trim(),
      companyName: holdDraft.companyName.trim(),
      departmentName: holdDraft.departmentName.trim(),
      reason: holdDraft.reason,
      startDate: normalizeDate(holdDraft.startDate),
      endDate: normalizeDate(holdDraft.endDate),
    }
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              holdItems: [nextItem, ...(sheet.holdItems || [])],
              weeklyBillingHoldCount: (sheet.weeklyBillingHoldCount || 0) + 1,
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      resetHoldDraft()
    })
  }

  function toggleTerminationSort(key: "receivedDate" | "terminationDate") {
    setTerminationSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    )
  }

  function toggleHoldSort(key: "receivedDate" | "startDate" | "endDate") {
    setHoldSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    )
  }

  function handleCreateTerminationSheet() {
    const baseSheet = selectedSheet || termination.sheets?.[0] || {}
    const carriedItems = (baseSheet.items || [])
      .filter((row: any) => !row.selected)
      .map((row: any, index: number) => ({
        ...row,
        no: String(index + 1),
        selected: false,
      }))
    const carriedHoldItems = (baseSheet.holdItems || []).map((row: any, index: number) => ({
      ...row,
      no: String(index + 1),
    }))
    const newSheet = {
      id: `sheet-${Date.now()}`,
      name: "새시트",
      title: "단말기 해지 진행사항(새시트)",
      teamLabel: baseSheet.teamLabel || "정보사업본부 정보사업1팀",
      guidelines: baseSheet.guidelines || ["1. 해지 발생 시 본부장님 보고 진행", "2. CRM 및 해지 리스트 등록"],
      weeklyTerminationCount: carriedItems.length,
      weeklyBillingHoldCount: carriedHoldItems.length,
      items: carriedItems,
      holdItems: carriedHoldItems,
    }
    startTransition(async () => {
      const nextSheets = [newSheet, ...(termination.sheets || [])]
      await persist({
        ...data,
        termination: {
          ...termination,
          currentSheetId: newSheet.id,
          sheets: nextSheets,
        },
      })
      setTerminationSheetId(newSheet.id)
    })
  }

  function handleRenameTerminationSheet() {
    if (!selectedSheet) return
    const nextName = window.prompt("시트명을 입력하세요.", selectedSheet.name || "새시트")
    if (!nextName || !nextName.trim()) return
    const trimmed = nextName.trim()
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              name: trimmed,
              title: `단말기 해지 진행사항(${trimmed})`,
            }
          : sheet,
      )
      await persist({
        ...data,
        termination: {
          ...termination,
          currentSheetId: selectedSheet.id,
          sheets: nextSheets,
        },
      })
    })
  }

  function handleDeleteTerminationSheet() {
    if (!selectedSheet) return
    if (!window.confirm("이 시트를 삭제할까요?")) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).filter((sheet: any) => sheet.id !== selectedSheet.id)
      const nextCurrentId = nextSheets[0]?.id
      await persist({
        ...data,
        termination: {
          ...termination,
          currentSheetId: nextCurrentId,
          sheets: nextSheets,
        },
      })
      setTerminationSheetId(nextCurrentId)
    })
  }

  function startTerminationEdit(row: any) {
    setEditingTerminationId(row.id)
    setEditingTerminationDraft({
      receivedDate: toInputDate(row.receivedDate),
      manager: row.manager || "",
      customerId: row.customerId || "",
      companyName: row.companyName || "",
      departmentName: row.departmentName || "",
      reason: row.reason === "기타" || String(row.reason || "").startsWith("기타(") ? "기타" : row.reason || "계약만료",
      reasonDetail: String(row.reason || "").startsWith("기타(") ? String(row.reason).replace(/^기타\((.*)\)$/, "$1") : "",
      terminationDate: toInputDate(row.terminationDate),
      penalty: row.penalty ? String(row.penalty) : "",
    })
  }

  function updateEditingTerminationDraft(field: string, value: string) {
    setEditingTerminationDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function handleTerminationUpdate(rowId: string) {
    if (!selectedSheet) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              items: (sheet.items || []).map((row: any) =>
                row.id === rowId
                  ? {
                      ...row,
                      receivedDate: normalizeDate(editingTerminationDraft.receivedDate),
                      manager: editingTerminationDraft.manager?.trim() || "",
                      customerId: editingTerminationDraft.customerId?.trim() || "",
                      companyName: editingTerminationDraft.companyName?.trim() || "",
                      departmentName: editingTerminationDraft.departmentName?.trim() || "",
                      reason:
                        editingTerminationDraft.reason === "기타" && editingTerminationDraft.reasonDetail?.trim()
                          ? `기타(${editingTerminationDraft.reasonDetail.trim()})`
                          : editingTerminationDraft.reason,
                      terminationDate: normalizeDate(editingTerminationDraft.terminationDate),
                      penalty: toNumber(editingTerminationDraft.penalty),
                    }
                  : row,
              ),
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      setEditingTerminationId(null)
      setEditingTerminationDraft({})
    })
  }

  function handleDeleteTerminationRow(rowId: string) {
    if (!selectedSheet) return
    if (!window.confirm("이 해지 건을 삭제할까요?")) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              items: (sheet.items || []).filter((row: any) => row.id !== rowId),
              weeklyTerminationCount: Math.max(0, (sheet.weeklyTerminationCount || 0) - 1),
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      if (editingTerminationId === rowId) {
        setEditingTerminationId(null)
        setEditingTerminationDraft({})
      }
    })
  }

  function startHoldEdit(row: any) {
    setEditingHoldId(row.id)
    setEditingHoldDraft({
      receivedDate: toInputDate(row.receivedDate),
      manager: row.manager || "",
      customerId: row.customerId || "",
      companyName: row.companyName || "",
      departmentName: row.departmentName || "",
      reason: row.reason || "사용자퇴사",
      startDate: toInputDate(row.startDate),
      endDate: toInputDate(row.endDate),
    })
  }

  function updateEditingHoldDraft(field: string, value: string) {
    setEditingHoldDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function handleHoldUpdate(rowId: string) {
    if (!selectedSheet) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              holdItems: (sheet.holdItems || []).map((row: any) =>
                row.id === rowId
                  ? {
                      ...row,
                      receivedDate: normalizeDate(editingHoldDraft.receivedDate),
                      manager: editingHoldDraft.manager?.trim() || "",
                      customerId: editingHoldDraft.customerId?.trim() || "",
                      companyName: editingHoldDraft.companyName?.trim() || "",
                      departmentName: editingHoldDraft.departmentName?.trim() || "",
                      reason: editingHoldDraft.reason,
                      startDate: normalizeDate(editingHoldDraft.startDate),
                      endDate: normalizeDate(editingHoldDraft.endDate),
                    }
                  : row,
              ),
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      setEditingHoldId(null)
      setEditingHoldDraft({})
    })
  }

  function handleDeleteHoldRow(rowId: string) {
    if (!selectedSheet) return
    if (!window.confirm("이 청구보류 건을 삭제할까요?")) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              holdItems: (sheet.holdItems || []).filter((row: any) => row.id !== rowId),
              weeklyBillingHoldCount: Math.max(0, (sheet.weeklyBillingHoldCount || 0) - 1),
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      if (editingHoldId === rowId) {
        setEditingHoldId(null)
        setEditingHoldDraft({})
      }
    })
  }

  function handleMoveHoldToTermination(rowId: string) {
    if (!selectedSheet) return
    const row = (selectedSheet.holdItems || []).find((item: any) => item.id === rowId)
    if (!row) return
    const movedItem = {
      id: `term-${Date.now()}`,
      no: "0",
      selected: false,
      receivedDate: row.receivedDate,
      manager: row.manager,
      customerId: row.customerId,
      companyName: row.companyName,
      departmentName: row.departmentName,
      reason: row.reason,
      terminationDate: row.endDate || "",
      penalty: 0,
    }
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              items: [movedItem, ...(sheet.items || [])],
              holdItems: (sheet.holdItems || []).filter((item: any) => item.id !== rowId),
              weeklyTerminationCount: (sheet.weeklyTerminationCount || 0) + 1,
              weeklyBillingHoldCount: Math.max(0, (sheet.weeklyBillingHoldCount || 0) - 1),
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      if (editingHoldId === rowId) {
        setEditingHoldId(null)
        setEditingHoldDraft({})
      }
    })
  }

  function renderSortLabel(
    label: string,
    active: boolean,
    dir: "asc" | "desc",
    onClick: () => void,
  ) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-[13px] font-semibold ${active ? "text-blue-700" : "text-slate-600 hover:text-slate-900"}`}
      >
        <span>{label}</span>
        <span className="text-[11px]">{active ? (dir === "asc" ? "ASC" : "DESC") : "↕"}</span>
      </button>
    )
  }

  function handleManualUpdate() {
    startTransition(async () => {
      const nextWeekly = {
        ...weeklyReport,
        // Persist the exact values currently shown in the manual input view so
        // weekly report behaves like an Excel cell reference.
        revenueHeaderText: manualRevenueHeaderText,
        revenueUnitPrice: toNumber(manualDraft.revenueUnitPrice),
        additionalContractCount: toNumber(manualDraft.additionalContractCount),
        subtitleOne: manualRevenueSubtitleOne,
        subtitleTwo: manualRevenueSubtitleTwo,
        revenueNoteText: manualDraft.revenueNoteText,
        manualSummary: { ...manualDraft.manualSummary },
        revenueRows: cloneData(manualDraft.revenueRows || []),
        goalRows: cloneData(manualDraft.goalRows || []),
        industryStats: cloneData(manualDraft.industryStats || []),
        additionalSales: normalizeAdditionalSalesRows(cloneData(manualDraft.additionalSales || [])),
      }
      await persist({ ...data, weeklyReport: nextWeekly })
      setView("weekly-report")
    })
  }

  const reportGoalRows = buildGoalRows(weeklyReport.goalRows || [])
  const reportIndustryStats = buildIndustryStats(weeklyReport.industryStats || [])
  const reportSummary = {
    ...(weeklyReport.manualSummary || {}),
    competitorStatus: normalizeSummaryStatus(
      weeklyReport?.manualSummary?.competitorStatus,
      "체크19대, 마켓포인트2대, 블룸버그0대, 로이터1대, 기타0대, 신규155대",
    ),
    holdStatus: normalizeSummaryStatus(
      weeklyReport?.manualSummary?.holdStatus,
      "방어불가 18대, 방어 진행 0대",
    ),
    competitorTerminationStatus: normalizeSummaryStatus(
      weeklyReport?.manualSummary?.competitorTerminationStatus,
      "체크0대, 마켓포인트0대, 블룸버그0대, 로이터0대, 기타0대",
    ),
  }
  const manualRevenueDisplay = buildRevenueDisplaySet({
    revenueHeaderText: manualDraft.revenueHeaderText,
    subtitleOne: manualDraft.subtitleOne,
    subtitleTwo: manualDraft.subtitleTwo,
    revenueUnitPrice: manualDraft.revenueUnitPrice,
    additionalContractCount: manualDraft.additionalContractCount,
    manualSummary: manualDraft.manualSummary,
    revenueRows: manualDraft.revenueRows || [],
    fallbackSelectedCount: includedContracts.length,
  })
  const manualRevenueHeaderText = manualRevenueDisplay.header
  const manualRevenueSubtitleOne = manualRevenueDisplay.subtitleOne
  const manualRevenueSubtitleTwo = manualRevenueDisplay.subtitleTwo
  const manualRevenueRows = buildRevenueRows(manualDraft.revenueRows || [])
  const reportRevenueDisplay = buildRevenueDisplaySet({
    revenueHeaderText: weeklyReport.revenueHeaderText,
    subtitleOne: weeklyReport.subtitleOne,
    subtitleTwo: weeklyReport.subtitleTwo,
    revenueUnitPrice: weeklyReport.revenueUnitPrice,
    additionalContractCount: weeklyReport.additionalContractCount,
    manualSummary: weeklyReport.manualSummary || {},
    revenueRows: weeklyReport.revenueRows || [],
    fallbackSelectedCount: includedContracts.length,
  })
  // Weekly report should reference the persisted manual-input values, just like
  // an Excel cell reference to saved cells.
  const reportRevenueRows = buildRevenueRows(weeklyReport.revenueRows || [])
  const revenueHeaderText = reportRevenueDisplay.header
  const revenueSubtitleOne = reportRevenueDisplay.subtitleOne
  const revenueSubtitleTwo = reportRevenueDisplay.subtitleTwo
  const revenueNoteText = sanitizeText(
    weeklyReport.revenueNoteText,
    buildRevenueNoteText(weeklyReport?.baseDate, weeklyReport?.revenueUnitPrice),
  )
  const manualGoalRows = buildGoalRows(manualDraft.goalRows || [])
  const manualIndustryStats = buildIndustryStats(manualDraft.industryStats || [])
  const manualSummary = manualDraft.manualSummary || {}
  const monthLabels = Array.from({ length: 12 }, (_, index) => `${index + 1}월`)
  const summaryMatrixRows = [
    {
      title: "단말기 순증 및 해지",
      cells: [
        ["주간순증 합계", "weeklyNetUnits"],
        ["신규계약", "weeklyNewContracts"],
        ["해지계약", "weeklyTerminationContracts"],
        ["누적순증 합계", "cumulativeNetUnits"],
        ["누적신규 계약", "cumulativeNewContracts"],
        ["누적해지계약", "cumulativeTerminationContracts"],
        ["총 계약대수", "totalContracts"],
      ],
    },
    {
      title: "경쟁사 단말기 교체 현황",
      cells: [
        ["신규계약 합계", "newContractTotal"],
        ["타사교체", "competitorReplacement"],
        ["신규계약", "newReplacement"],
        ["단말 교체 현황", "competitorStatus"],
      ],
    },
    {
      title: "해지대기 및 청구보류",
      cells: [
        ["해지보류 합계", "holdTotal"],
        ["해지대기", "holdPending"],
        ["청구보류", "billingHold"],
        ["해지 진행 현황", "holdStatus"],
      ],
    },
    {
      title: "단말기 해지 유형",
      cells: [
        ["단말해지 합계", "terminationTypeTotal"],
        ["계약해지", "contractTermination"],
        ["타사교체", "competitorTermination"],
        ["타사 교체 현황", "competitorTerminationStatus"],
      ],
    },
  ]

  return (
    <div className="dashboard-shell min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1720px]">
          <aside className="dashboard-sidebar w-[272px] border-r border-slate-200 bg-white px-4 py-4">
            <div className="overflow-hidden rounded-[24px] border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f5f9ff_100%)] px-5 py-4 shadow-[0_8px_20px_rgba(37,99,235,0.06)]">
              <div className="flex items-center justify-start">
                <img
                  src="/yonhapinfomax-logo.png"
                  alt="연합인포맥스"
                  className="h-7 w-auto shrink-0 opacity-90"
                />
              </div>
              <div
                className="mt-2.5 text-[19px] font-black leading-[1.22] tracking-[-0.055em] text-[#1e3a8a]"
                style={{ fontFamily: '"SUIT Variable","Pretendard Variable","Aptos","Noto Sans KR",sans-serif' }}
              >
                정보사업본부
                <br />
                통합 대시보드
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-1.5 w-10 rounded-full bg-gradient-to-r from-[#2563eb] to-[#60a5fa]" />
                <span
                  className="text-[10px] font-medium tracking-[0.01em] text-[#8da0c2]"
                  style={{ fontFamily: '"Aptos","SUIT Variable","Pretendard Variable","Noto Sans KR",sans-serif' }}
                >
                  Internal Dashboard
                </span>
              </div>
            </div>

          <div className="mt-8 space-y-5">
            <div>
              <button
                type="button"
                onClick={() => setSections((prev) => ({ ...prev, performance: !prev.performance }))}
                className="flex w-full items-center justify-between px-2 py-1 text-[15px] font-bold text-slate-900"
                >
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />실적 관리</span>
                  <span className="text-slate-400">{sections.performance ? "⌄" : "›"}</span>
                </button>
                {sections.performance && (
                  <div className="mt-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => setView("weekly-report")}
                      className={`flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ${
                        view === "weekly-report" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {viewTitles["weekly-report"]}
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("manual-input")}
                      className={`ml-4 flex h-10 w-[calc(100%-1rem)] items-center rounded-2xl px-4 text-left text-[14px] font-semibold ${
                        view === "manual-input" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      수동 입력 리스트
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("contracts")}
                      className={`flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ${
                        view === "contracts" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {viewTitles.contracts}
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("weekly-selection")}
                      className={`flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ${
                        view === "weekly-selection" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {viewTitles["weekly-selection"]}
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("collection")}
                      className={`flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ${
                        view === "collection" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {viewTitles.collection}
                    </button>
                  </div>
                )}
            </div>

            <div>
              <button
                type="button"
                onClick={() => setSections((prev) => ({ ...prev, termination: !prev.termination }))}
                className="flex w-full items-center justify-between px-2 py-1 text-[15px] font-bold text-slate-900"
              >
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />해지 관리</span>
                <span className="text-slate-400">{sections.termination ? "⌄" : "›"}</span>
              </button>
              {sections.termination && (
                <div className="mt-2 space-y-1">
                  <button
                    type="button"
                    onClick={() => setView("termination")}
                    className={`flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ${
                      view === "termination" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    해지 진행사항
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="flex-1 px-5 py-5">
          <div className={`${cardClass} dashboard-header mb-5 flex items-start justify-between px-5 py-4`}>
            <div>
              <div className="text-[14px] text-slate-500">기준일 {weeklyReport.baseDate}</div>
              <h1 className="mt-2 text-[20px] font-black tracking-[-0.04em] text-slate-950">{viewTitles[view]}</h1>
            </div>
            <div className="dashboard-header-actions flex items-center gap-3">
              {view === "weekly-report" && (
                <button
                  type="button"
                  onClick={handleWeeklyReportPrint}
                  className="h-11 rounded-2xl bg-blue-600 px-4 text-[14px] font-semibold text-white transition hover:bg-blue-700"
                >
                  PDF 출력
                </button>
              )}
              <div className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-slate-700">
                {currentYear}년도
              </div>
              <button
                type="button"
                onClick={handleUndoLastAction}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!historyStack.length || isPending}
              >
                이전 작업 되돌리기
              </button>
            </div>
          </div>

          {view === "weekly-report" && (
            <div className="weekly-report-print space-y-4">
              <section className="print-report-cover hidden print:block">
                <div className="print-report-header-row">
                  <div className="print-report-spacer" />
                  <div className="print-report-date">기준일 {weeklyReport.baseDate}</div>
                </div>
                <div className="print-report-title">주간실적보고</div>
              </section>

              <section className={`${cardClass} p-5 print-report-sheet-section`}>
                <div className="mb-3 text-[18px] font-bold print-report-section-title">계약 내역</div>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={`${weeklyReportTableClass} print-contract-table`}>
                    <thead><tr>{["회사명","부서","아이디","업종","계약월","계약서 회수","미회수"].map((head)=><th key={head} className={weeklyThClass}>{head}</th>)}</tr></thead>
                    <tbody>
                      {includedContracts.length ? includedContracts.map((row: any) => (
                        <tr key={row.id}>
                          <td className={`${weeklyTdClass} text-left`}>{row.companyName}</td>
                          <td className={`${weeklyTdClass} text-left`}>{row.departmentName}</td>
                          <td className={weeklyTdClass}>{row.idCode}</td>
                          <td className={weeklyTdClass}>{row.industry}</td>
                          <td className={weeklyTdClass}>{row.contractMonth}</td>
                          <td className={weeklyTdClass}>{row.documentStatus === "회수" ? "o" : ""}</td>
                          <td className={weeklyTdClass}>{row.documentStatus === "미회수" ? "o" : ""}</td>
                        </tr>
                      )) : <tr><td className={weeklyTdClass} colSpan={7}>금주 반영 계약이 없습니다.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={`${cardClass} p-5 print-report-sheet-section`}>
                <div className="mb-1.5 border border-slate-200 bg-slate-50/70 px-3 py-2 print-revenue-meta">
                  <div className="print-revenue-strip">
                    <div className="print-revenue-copy">
                      <div className="print-revenue-main">{revenueHeaderText}</div>
                      <div className="print-revenue-sub">{revenueSubtitleOne} <span className="print-revenue-sep">/</span> {revenueSubtitleTwo}</div>
                    </div>
                    <div className="print-revenue-note">{revenueNoteText}</div>
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={`${weeklyReportTableClass} print-revenue-table`}>
                    <thead><tr>{["구분(월)","1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월","합계"].map((head)=><th key={head} className={weeklyThClass}>{head}</th>)}</tr></thead>
                    <tbody>
                      {reportRevenueRows.map((row: any) => {
                        const total = (row.months || []).reduce((sum: number, value: number) => sum + toNumber(value), 0)
                        return (
                          <tr key={row.key}>
                            <td className={`${weeklyTdClass} font-semibold`}>{row.label}</td>
                            {(row.months || []).map((monthValue: number, index: number) => <td key={`${row.key}-${index}`} className={weeklyTdClass}>{formatNumber(monthValue)}</td>)}
                            <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(total)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={`${cardClass} p-5 print-report-sheet-section`}>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={`${weeklyReportTableClass} print-combined-summary-table`}>
                    <colgroup>
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "24%" }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <th className={`${weeklyThClass} font-bold`} rowSpan={2}>단말기 순증 및 해지</th>
                        <th className={weeklyThClass}>주간순증 합계</th>
                        <th className={weeklyThClass}>신규계약</th>
                        <th className={weeklyThClass}>해지계약</th>
                        <th className={weeklyThClass}>누적순증 합계</th>
                        <th className={weeklyThClass}>신규계약</th>
                        <th className={weeklyThClass}>계약해지</th>
                        <th className={weeklyThClass}>총 계약대수</th>
                      </tr>
                      <tr>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.weeklyNetUnits)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.weeklyNewContracts)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.weeklyTerminationContracts)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.cumulativeNetUnits)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.cumulativeNewContracts)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.cumulativeTerminationContracts)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.totalContracts)}대</td>
                      </tr>

                      <tr>
                        <th className={`${weeklyThClass} font-bold`} rowSpan={2}>경쟁사 단말기 교체 현황</th>
                        <th className={weeklyThClass}>신규계약 합계</th>
                        <th className={weeklyThClass}>타사교체</th>
                        <th className={weeklyThClass}>신규계약</th>
                        <th className={weeklyThClass} colSpan={4}>단말 교체 현황</th>
                      </tr>
                      <tr>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.newContractTotal)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.competitorReplacement)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.newReplacement)}대</td>
                        <td className={`${weeklyTdClass} text-left print-summary-detail-cell`} colSpan={4}>{reportSummary?.competitorStatus || ""}</td>
                      </tr>

                      <tr>
                        <th className={`${weeklyThClass} font-bold`} rowSpan={2}>해지대기 및 청구보류</th>
                        <th className={weeklyThClass}>해지보류 합계</th>
                        <th className={weeklyThClass}>해지대기</th>
                        <th className={weeklyThClass}>청구보류</th>
                        <th className={weeklyThClass} colSpan={4}>해지 진행 현황</th>
                      </tr>
                      <tr>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.holdTotal)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.holdPending)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.billingHold)}대</td>
                        <td className={`${weeklyTdClass} text-left print-summary-detail-cell`} colSpan={4}>{reportSummary?.holdStatus || ""}</td>
                      </tr>

                      <tr>
                        <th className={`${weeklyThClass} font-bold`} rowSpan={2}>단말기 해지 유형</th>
                        <th className={weeklyThClass}>단말해지 합계</th>
                        <th className={weeklyThClass}>계약해지</th>
                        <th className={weeklyThClass}>타사교체</th>
                        <th className={weeklyThClass} colSpan={4}>타사 교체 현황</th>
                      </tr>
                      <tr>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.terminationTypeTotal)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.contractTermination)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.competitorTermination)}대</td>
                        <td className={`${weeklyTdClass} text-left print-summary-detail-cell`} colSpan={4}>{reportSummary?.competitorTerminationStatus || ""}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={`${cardClass} p-5 space-y-3 print-report-sheet-section`}>
                <div className="text-[18px] font-bold print-report-section-title">2026년 판매 목표</div>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={`${weeklyReportTableClass} print-goal-table`}>
                    <thead>
                      <tr>{["구분(월)", "순증", "목표계약대수", "분기순증목표", "월간실적", "분기실적", "목표대비 달성현황"].map((head) => <th key={head} className={weeklyThClass}>{head}</th>)}</tr>
                    </thead>
                    <tbody>
                      {reportGoalRows.map((row: any, index: number) => (
                        <tr key={`${row.month}-${index}`}>
                          <td className={weeklyTdClass}>{row.month}</td>
                          <td className={weeklyTdClass}>{formatNumber(row.netTarget)}</td>
                          <td className={weeklyTdClass}>{formatNumber(row.targetContracts)}</td>
                          <td className={weeklyTdClass}>{formatNumber(row.quarterNetTarget)}</td>
                          <td className={weeklyTdClass}>{formatNumber(row.monthlyActual)}</td>
                          <td className={weeklyTdClass}>{formatNumber(row.quarterActual)}</td>
                          <td className={weeklyTdClass}>{formatNumber(row.gap)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={`${cardClass} p-5 space-y-3 print-report-sheet-section`}>
                <div className="text-[18px] font-bold print-report-section-title">정보사업본부 업종별 실적 현황</div>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={`${weeklyReportTableClass} print-industry-table`}>
                    <thead>
                      <tr>{["구분", ...reportIndustryStats.map((row: any) => row.category)].map((head) => <th key={head} className={weeklyThClass}>{head}</th>)}</tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={`${weeklyTdClass} font-semibold`}>신규</td>
                        {reportIndustryStats.map((row: any, index: number) => <td key={`new-${index}`} className={weeklyTdClass}>{formatNumber(row.newCount)}</td>)}
                      </tr>
                      <tr>
                        <td className={`${weeklyTdClass} font-semibold`}>순증</td>
                        {reportIndustryStats.map((row: any, index: number) => <td key={`net-${index}`} className={weeklyTdClass}>{formatNumber(row.netCount)}</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

            </div>
          )}

          {view === "contracts" && (
            <div className={`${cardClass} p-5`}>
              <div className="mb-3 flex items-center justify-between"><div className="text-[18px] font-bold">신규계약 리스트</div><div className="text-[13px] text-slate-500">총 {formatNumber(contracts.length)}건</div></div>
              <div className="mb-4 grid gap-3 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
                  <div className="mb-1.5 text-[13px] font-bold text-slate-900">월별 실적 통계</div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-[13px]">
                      {contractMonthRows.map((chunk, rowIndex) => (
                        <tbody key={`contract-month-block-${rowIndex}`}>
                          <tr>
                            {chunk.map((row) => (
                              <th key={`contract-month-label-${row.label}`} className="border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[12px] font-semibold text-slate-600">
                                {row.label.replace(/^\d{2}년\s*/, "")}
                              </th>
                            ))}
                          </tr>
                          <tr>
                            {chunk.map((row) => (
                              <td key={`contract-month-value-${row.label}`} className="border-b border-slate-200 px-2 py-1.5 text-center text-[14px] font-bold text-slate-900">
                                {formatNumber(row.count)}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      ))}
                    </table>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
                  <div className="mb-1.5 text-[13px] font-bold text-slate-900">권유자별 실적 통계</div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-[13px]">
                      <tbody>
                        {contractRecommenderRows.map((chunk, rowIndex) => (
                          <tr key={`contract-recommender-row-${rowIndex}`}>
                            {chunk.map((row) => (
                              [
                                <th key={`contract-recommender-label-${row.label}`} className="border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[12px] font-semibold text-slate-600">
                                  {row.label}
                                </th>,
                                <td key={`contract-recommender-value-${row.label}`} className="border-b border-slate-200 px-2 py-1.5 text-center text-[14px] font-bold text-slate-900">
                                  {formatNumber(row.count)}
                                </td>,
                              ]
                            ))}
                            {chunk.length < 4 &&
                              Array.from({ length: 4 - chunk.length }).map((_, index) => (
                                [
                                  <th key={`contract-recommender-empty-h-${rowIndex}-${index}`} className="border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[12px] font-semibold text-slate-300">
                                    -
                                  </th>,
                                  <td key={`contract-recommender-empty-v-${rowIndex}-${index}`} className="border-b border-slate-200 px-2 py-1.5 text-center text-[14px] font-bold text-slate-300">
                                    0
                                  </td>,
                                ]
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-[14px] font-bold text-slate-800">신규계약 입력</div>
                <div className="grid grid-cols-7 gap-3">
                  <input className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="회사명" value={contractDraft.companyName} onChange={(e)=>updateContractDraft("companyName", e.target.value)} />
                  <input className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="부서" value={contractDraft.departmentName} onChange={(e)=>updateContractDraft("departmentName", e.target.value)} />
                  <input className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="아이디" value={contractDraft.idCode} onChange={(e)=>updateContractDraft("idCode", e.target.value)} />
                  <select className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" value={contractDraft.industry} onChange={(e)=>updateContractDraft("industry", e.target.value)}>
                    {["국내증권","국내은행","외국계","자산운용","보험","일반기업","공사/정부","연기금","기타금융"].map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                  <input className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="계약월" value={contractDraft.contractMonth} onChange={(e)=>updateContractDraft("contractMonth", e.target.value)} />
                  <input className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="권유자" value={contractDraft.recommender} onChange={(e)=>updateContractDraft("recommender", e.target.value)} />
                  <div className="flex gap-2">
                    <select className="h-10 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" value={contractDraft.documentStatus} onChange={(e)=>updateContractDraft("documentStatus", e.target.value)}>
                      <option value="미회수">미회수</option>
                      <option value="회수">회수</option>
                    </select>
                    <button type="button" onClick={handleContractCreate} className="h-10 rounded-2xl bg-blue-600 px-4 text-[14px] font-semibold text-white">
                      {isPending ? "등록 중..." : "등록"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className={tableClass}>
                  <thead><tr>{["No.","회사명","부서","아이디","업종","계약월","권유자","계약서 상태","작업"].map((head)=><th key={head} className={head === "No." ? `${thClass} text-center` : thClass}>{head}</th>)}</tr></thead>
                  <tbody>
                    {contracts.map((row: any, index: number) => {
                      const editing = editingContractId === row.id
                      return (
                        <tr key={row.id}>
                          <td className={`${tdClass} w-16 text-center`}>{row.no || index + 1}</td>
                          <td className={`${tdClass} min-w-[180px]`}>
                            {editing ? <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingContractDraft.companyName || ""} onChange={(e)=>updateEditingContractDraft("companyName", e.target.value)} /> : row.companyName}
                          </td>
                          <td className={`${tdClass} min-w-[180px]`}>
                            {editing ? <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingContractDraft.departmentName || ""} onChange={(e)=>updateEditingContractDraft("departmentName", e.target.value)} /> : row.departmentName}
                          </td>
                          <td className={`${tdClass} min-w-[140px]`}>
                            {editing ? <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingContractDraft.idCode || ""} onChange={(e)=>updateEditingContractDraft("idCode", e.target.value)} /> : row.idCode}
                          </td>
                          <td className={`${tdClass} min-w-[120px]`}>
                            {editing ? (
                              <select className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingContractDraft.industry || "국내증권"} onChange={(e)=>updateEditingContractDraft("industry", e.target.value)}>
                                {["국내증권","국내은행","외국계","자산운용","보험","일반기업","공사/정부","연기금","기타금융"].map((item) => <option key={item} value={item}>{item}</option>)}
                              </select>
                            ) : row.industry}
                          </td>
                          <td className={`${tdClass} min-w-[140px]`}>
                            {editing ? <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingContractDraft.contractMonth || ""} onChange={(e)=>updateEditingContractDraft("contractMonth", e.target.value)} /> : row.contractMonth}
                          </td>
                          <td className={`${tdClass} min-w-[140px]`}>
                            {editing ? <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingContractDraft.recommender || ""} onChange={(e)=>updateEditingContractDraft("recommender", e.target.value)} /> : row.recommender}
                          </td>
                          <td className={`${tdClass} min-w-[130px]`}>
                            {editing ? (
                              <select className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingContractDraft.documentStatus || "미회수"} onChange={(e)=>updateEditingContractDraft("documentStatus", e.target.value)}>
                                <option value="미회수">미회수</option>
                                <option value="회수">회수</option>
                              </select>
                            ) : row.documentStatus}
                          </td>
                          <td className={`${tdClass} min-w-[220px]`}>
                            {editing ? (
                              <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                                <button type="button" onClick={() => handleContractUpdate(row.id)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white whitespace-nowrap">수정완료</button>
                                <button type="button" onClick={() => handleContractDelete(row.id)} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 whitespace-nowrap">삭제</button>
                                <button type="button" onClick={() => { setEditingContractId(null); setEditingContractDraft({}) }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold whitespace-nowrap">취소</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => startContractEdit(row)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold">수정</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === "weekly-selection" && (
            <div className={`${cardClass} p-5`}>
              <div className="mb-3 flex items-center justify-between gap-4">
                <div className="text-[18px] font-bold">주간 반영 리스트</div>
                <div className="flex items-center gap-3">
                  <div className="text-[13px] text-slate-500">현재 {formatNumber(contracts.length)}건 / 선택 {formatNumber(includedContracts.length)}건</div>
                  <button
                    type="button"
                    onClick={handleMoveWeeklySelectionToCollection}
                    disabled={!includedContracts.length || isPending}
                    className="rounded-xl bg-blue-600 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    계약서 통합관리로 이동
                  </button>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className={tableClass}>
                  <thead><tr>{["선택","No.","회사명","부서명","ID","업종","계약월","권유자","계약서 상태"].map((head)=><th key={head} className={thClass}>{head}</th>)}</tr></thead>
                  <tbody>
                    {contracts.map((row: any, index: number) => (
                      <tr key={row.id} className={row.includedInWeekly ? "bg-blue-50" : ""}>
                        <td className={`${tdClass} text-center`}>
                          <input
                            type="checkbox"
                            checked={Boolean(row.includedInWeekly)}
                            onChange={() => toggleWeeklySelection(row.id)}
                          />
                        </td>
                        <td className={tdClass}>{index + 1}</td>
                        <td className={`${tdClass} whitespace-nowrap`}>{row.companyName}</td>
                        <td className={`${tdClass} whitespace-nowrap`}>{row.departmentName}</td>
                        <td className={tdClass}>{row.idCode}</td>
                        <td className={tdClass}>{row.industry}</td>
                        <td className={tdClass}>{row.contractMonth}</td>
                        <td className={tdClass}>{row.recommender}</td>
                        <td className={tdClass}>{row.documentStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === "manual-input" && (
            <div className={`${cardClass} space-y-4 p-5`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[18px] font-bold text-slate-900">수동 입력 리스트</div>
                  <div className="mt-1 text-[12px] font-semibold text-amber-600">(음영처리된 부분은 자동계산 반영)</div>
                </div>
                <button type="button" onClick={handleManualUpdate} className="h-10 shrink-0 rounded-2xl bg-blue-600 px-5 text-[14px] font-semibold text-white">
                  {isPending ? "업데이트 중..." : "업데이트"}
                </button>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className={manualSectionTitleClass}>매출 자동계산 설정</div>
                    <div className="text-[11px] font-medium text-slate-500">(주간반영 선택계약수 × 단가) + 추가계약 금액</div>
                  </div>
                </div>
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_180px_220px]">
                  <label className="space-y-1.5">
                    <div className="text-[12px] font-semibold text-slate-500">
                      매출 헤더 <span className="text-amber-600">(자동계산)</span>
                    </div>
                    <input
                      className="h-10 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 text-[14px]"
                      value={manualRevenueHeaderText}
                      readOnly
                    />
                  </label>
                  <label className="space-y-1.5">
                    <div className="text-[12px] font-semibold text-slate-500">
                      단가 <span className="text-amber-600">(자동계산 반영)</span>
                    </div>
                    <input
                      className="h-10 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 text-[14px]"
                      inputMode="numeric"
                      value={formatNumericInputDisplay(manualDraft.revenueUnitPrice)}
                      onChange={(e) => updateManualField("revenueUnitPrice", e.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <div className="text-[12px] font-semibold text-slate-500">
                      추가 계약 금액
                    </div>
                    <input
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px]"
                      inputMode="numeric"
                      placeholder="예: 1,000,000"
                      value={formatNumericInputDisplay(manualDraft.additionalContractCount)}
                      onChange={(e) => updateManualField("additionalContractCount", e.target.value)}
                    />
                  </label>
                </div>
                <div className="grid gap-3 xl:grid-cols-2">
                  <label className="space-y-1.5">
                    <div className="text-[12px] font-semibold text-slate-500">
                      연간 순증 매출 <span className="text-amber-600">(자동계산)</span>
                    </div>
                    <input
                      className="h-10 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 text-[14px]"
                      value={manualRevenueSubtitleOne}
                      readOnly
                    />
                  </label>
                  <label className="space-y-1.5">
                    <div className="text-[12px] font-semibold text-slate-500">
                      연간 누적 매출 <span className="text-amber-600">(자동계산)</span>
                    </div>
                    <input
                      className="h-10 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 text-[14px]"
                      value={manualRevenueSubtitleTwo}
                      readOnly
                    />
                  </label>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={tableClass}>
                    <thead>
                      <tr>
                        <th className={manualHeaderCellClass}>구분(월)</th>
                        {monthLabels.map((label) => (
                          <th key={label} className={manualHeaderCellClass}>{label}</th>
                        ))}
                        <th className={manualHeaderCellClass}>합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualRevenueRows.map((row, rowIndex) => {
                        const total = (row.months || []).reduce((sum: number, value: number) => sum + toNumber(value), 0)
                        return (
                          <tr key={row.key || rowIndex}>
                            <td className={manualLabelCellClass}>{row.label}</td>
                            {(row.months || []).map((monthValue: number, monthIndex: number) => (
                              <td key={`${row.key}-${monthIndex}`} className={`${tdClass} p-1`}>
                                <input
                                  className={manualTableInputClass}
                                  value={String(monthValue ?? "")}
                                  onChange={(e) => updateManualRevenueCell(rowIndex, monthIndex, e.target.value)}
                                />
                              </td>
                            ))}
                            <td className={`${tdClass} w-[96px] text-center font-semibold`}>{formatNumber(total)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3">
                {summaryMatrixRows.map((section) => (
                  <div key={section.title} className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className={tableClass}>
                      <tbody>
                        <tr>
                          <th className={`${manualHeaderCellClass} w-[220px] text-[15px] font-bold`}>{section.title}</th>
                          {section.cells.map(([label]) => (
                            <th key={`${section.title}-${label}`} className={manualHeaderCellClass}>{label}</th>
                          ))}
                        </tr>
                        <tr>
                          <td className={`${tdClass} bg-white`} />
                          {section.cells.map(([label, field]) => (
                            <td key={`${section.title}-${field}`} className={`${tdClass} p-1`}>
                              <input
                                className={manualTableInputClass}
                                value={String(manualSummary?.[field] ?? "")}
                                onChange={(e) => updateManualSummaryField(field, e.target.value)}
                              />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th colSpan={7} className={manualTableTitleRowClass}>
                        2026년 판매 목표
                      </th>
                    </tr>
                    <tr>
                      {["구분(월)", "순증", "목표계약대수", "분기순증목표", "월간실적", "분기실적", "목표대비 달성현황"].map((head) => (
                        <th key={head} className={manualHeaderCellClass}>{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {manualGoalRows.map((row: any, rowIndex: number) => (
                      <tr key={`${row.month}-${rowIndex}`}>
                        <td className={manualLabelCellClass}>{row.month}</td>
                        {["netTarget", "targetContracts", "quarterNetTarget", "monthlyActual", "quarterActual", "gap"].map((field) => (
                          <td key={field} className={`${tdClass} p-1`}>
                            <input
                              className={manualTableInputClass}
                              value={String(row[field] ?? "")}
                              onChange={(e) => updateManualGoalRow(rowIndex, field, e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th colSpan={4} className={manualTableTitleRowClass}>
                        업종별 실적 입력
                      </th>
                    </tr>
                    <tr>
                      {["구분", "업종", "신규", "순증"].map((head) => (
                        <th key={head} className={manualHeaderCellClass}>{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {manualIndustryStats.map((row: any, rowIndex: number) => (
                      <tr key={`${row.category}-${rowIndex}`}>
                        <td className={`${tdClass} text-center`}>{rowIndex + 1}</td>
                        <td className={`${tdClass} p-1`}>
                          <input
                            className={manualTableTextInputClass}
                            value={String(row.category ?? "")}
                            onChange={(e) => updateManualIndustryRow(rowIndex, "category", e.target.value)}
                          />
                        </td>
                        <td className={`${tdClass} p-1`}>
                          <input
                            className={manualTableInputClass}
                            value={String(row.newCount ?? "")}
                            onChange={(e) => updateManualIndustryRow(rowIndex, "newCount", e.target.value)}
                          />
                        </td>
                        <td className={`${tdClass} p-1`}>
                          <input
                            className={manualTableInputClass}
                            value={String(row.netCount ?? "")}
                            onChange={(e) => updateManualIndustryRow(rowIndex, "netCount", e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[15px] font-bold text-slate-900">추가 매출</div>
                  <button type="button" onClick={addAdditionalSaleRow} className="rounded-xl border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700">행 추가</button>
                </div>
                <div className="space-y-2">
                  {normalizeAdditionalSalesRows(manualDraft.additionalSales || []).map((row: any, rowIndex: number) => (
                    <div key={`manual-additional-${rowIndex}`} className="grid grid-cols-[1.3fr_1fr_1.5fr_auto] gap-2">
                      <input className={manualTableTextInputClass} placeholder="항목" value={String(row.label ?? "")} onChange={(e) => updateAdditionalSaleRow(rowIndex, "label", e.target.value)} />
                      <input className={manualTableInputClass} placeholder="금액" value={String(row.amount ?? "")} onChange={(e) => updateAdditionalSaleRow(rowIndex, "amount", e.target.value)} />
                      <input className={manualTableTextInputClass} placeholder="비고" value={String(row.note ?? "")} onChange={(e) => updateAdditionalSaleRow(rowIndex, "note", e.target.value)} />
                      <button type="button" onClick={() => deleteAdditionalSaleRow(rowIndex)} className="rounded-xl border border-rose-200 px-3 py-1.5 text-[12px] font-semibold text-rose-600">삭제</button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {view === "collection" && (
            <div className="space-y-4">
              <div className={`${cardClass} p-5`}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[18px] font-bold">계약서통합관리</div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleCollectionTabChange("integrated")} className={`rounded-2xl px-4 py-2 text-[13px] font-semibold ${collectionTab === "integrated" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>통합관리</button>
                    <button type="button" onClick={() => handleCollectionTabChange("long-term")} className={`rounded-2xl px-4 py-2 text-[13px] font-semibold ${collectionTab === "long-term" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>장기미회수</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {renderChip(`전체 ${formatNumber(filteredCollectionRows.length)}건`, "blue")}
                  {renderChip(`회수 ${formatNumber(filteredCollectionRows.filter((row: any) => row.status === "회수").length)}건`, "green")}
                  {renderChip(`미회수 ${formatNumber(filteredCollectionRows.filter((row: any) => row.status === "미회수").length)}건`, "red")}
                  {renderChip(`미정 ${formatNumber(filteredCollectionRows.filter((row: any) => !row.status || row.status === "미정").length)}건`, "gray")}
                </div>
              </div>
              <div className={`${cardClass} p-4`}>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setCollectionYearFilter("all")} className={`rounded-2xl px-3 py-2 text-[13px] font-semibold ${collectionYearFilter === "all" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>전체</button>
                  {availableYears.map((year: number) => (
                    <button key={year} type="button" onClick={() => setCollectionYearFilter(year)} className={`rounded-2xl px-3 py-2 text-[13px] font-semibold ${collectionYearFilter === year ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>{year}년</button>
                  ))}
                  <div className="mx-1 h-6 w-px bg-slate-200" />
                  {[
                    ["all", "전체"],
                    ["회수", "회수"],
                    ["미회수", "미회수"],
                    ["미정", "미정"],
                  ].map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setCollectionStatusFilter(value)} className={`rounded-2xl px-3 py-2 text-[13px] font-semibold ${collectionStatusFilter === value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>{label}</button>
                  ))}
                </div>
              </div>
              <div className={`${cardClass} p-3`}>
                <div className="mb-2 text-[15px] font-bold text-slate-900">업종별 현황</div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className={tableClass}>
                    <thead>
                      <tr>
                        {["구분", ...collectionIndustryMatrix.headers].map((head) => (
                          <th key={head} className={`${thClass} text-center`}>
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {collectionIndustryMatrix.rows.map((row) => (
                        <tr key={`industry-summary-row-${row.label}`}>
                          <td className={`${tdClass} text-center font-medium`}>{row.label}</td>
                          {row.values.map((value: number, index: number) => (
                            <td key={`${row.label}-${index}`} className={`${tdClass} text-center`}>
                              {formatNumber(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className={`${cardClass} p-5`}>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={tableClass}>
                    <thead><tr>{["No.","연도","회사명","부서명","ID","업종","청구월","회수일","상태","작업"].map((head)=><th key={head} className={thClass}>{head}</th>)}</tr></thead>
                    <tbody>
                      {filteredCollectionRows.map((row: any, index: number) => {
                        const editing = editingCollectionId === row.id
                        return (
                          <tr key={row.id}>
                            <td className={tdClass}>{index + 1}</td>
                            <td className={tdClass}>
                              {editing ? <input className="h-9 w-20 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.year || ""} onChange={(e)=>updateEditingCollectionDraft("year", e.target.value)} /> : row.year}
                            </td>
                            <td className={`${tdClass} whitespace-nowrap`}>
                              {editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.companyName || ""} onChange={(e)=>updateEditingCollectionDraft("companyName", e.target.value)} /> : row.companyName}
                            </td>
                            <td className={`${tdClass} whitespace-nowrap`}>
                              {editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.departmentName || ""} onChange={(e)=>updateEditingCollectionDraft("departmentName", e.target.value)} /> : row.departmentName}
                            </td>
                            <td className={tdClass}>
                              {editing ? <input className="h-9 w-full min-w-[100px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.idCode || ""} onChange={(e)=>updateEditingCollectionDraft("idCode", e.target.value)} /> : row.idCode}
                            </td>
                            <td className={tdClass}>
                              {editing ? <input className="h-9 w-full min-w-[100px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.industry || ""} onChange={(e)=>updateEditingCollectionDraft("industry", e.target.value)} /> : row.industry}
                            </td>
                            <td className={tdClass}>
                              {editing ? <input className="h-9 w-full min-w-[90px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.claimMonth || ""} onChange={(e)=>updateEditingCollectionDraft("claimMonth", e.target.value)} /> : row.claimMonth}
                            </td>
                            <td className={tdClass}>
                              {editing ? (
                                <input
                                  value={editingCollectionDraft.receiptDate || ""}
                                  onChange={(e) => updateEditingCollectionDraft("receiptDate", e.target.value)}
                                  placeholder="YYYY.MM.DD"
                                  className="h-9 w-28 rounded-xl border border-slate-200 px-3 text-[12px] font-medium text-slate-700 outline-none focus:border-blue-400"
                                />
                              ) : (
                                row.receiptDate || ""
                              )}
                            </td>
                            <td className={tdClass}>
                              {editing ? (
                                renderStatusBadge(row.status)
                              ) : (
                                <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleCollectionStatusToggle(row.id, "회수")}
                                    className={`min-w-[42px] rounded-[6px] px-2 py-1 text-[11px] font-semibold leading-none transition ${
                                      row.status === "회수"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-transparent text-slate-500 hover:bg-white"
                                    }`}
                                  >
                                    회수
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCollectionStatusToggle(row.id, "미회수")}
                                    className={`min-w-[48px] rounded-[6px] px-2 py-1 text-[11px] font-semibold leading-none transition ${
                                      row.status === "미회수"
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-transparent text-slate-500 hover:bg-white"
                                    }`}
                                  >
                                    미회수
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className={tdClass}>
                              {editing ? (
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleCollectionUpdate(row.id)}
                                    className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                                  >
                                    수정완료
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCollectionDelete(row.id)}
                                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                                  >
                                    삭제
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCollectionId(null)
                                      setEditingCollectionDraft({})
                                    }}
                                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                                  >
                                    취소
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startCollectionEdit(row)}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                                >
                                  수정
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {view === "termination" && selectedSheet && (
            <div className="space-y-4">
              <div className={`${cardClass} p-5`}>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[18px] font-bold">{selectedSheet.title || `단말기 해지 진행사항(${selectedSheet.name})`}</div>
                    <div className="mt-2 text-[13px] text-slate-500">{selectedSheet.teamLabel}</div>
                    <div className="mt-1 space-y-1 text-[13px] text-slate-600">{(selectedSheet.guidelines || []).map((line: string) => <div key={line}>{line}</div>)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="text-[12px] text-slate-500">금주 해지 건수</div><div className="mt-1 text-[20px] font-extrabold">{formatNumber(visibleWeeklyTerminationCount)}건</div></div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="text-[12px] text-slate-500">금주 청구보류 건수</div><div className="mt-1 text-[20px] font-extrabold">{formatNumber(visibleWeeklyBillingHoldCount)}건</div></div>
                  </div>
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCreateTerminationSheet}
                    className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-[18px] font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    +
                  </button>
                  {(termination.sheets || []).map((sheet: any) => (
                    <button key={sheet.id} type="button" onClick={() => setTerminationSheetId(sheet.id)} className={`rounded-full px-3 py-2 text-[13px] font-semibold ${sheet.id === selectedSheet.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>{sheet.name}</button>
                  ))}
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRenameTerminationSheet}
                      disabled={!selectedSheet}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      시트명 수정
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteTerminationSheet}
                      disabled={!selectedSheet}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      시트삭제
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="mb-2 text-[13px] font-semibold text-slate-700">해지 현황 구분</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white">
                      합계 {formatNumber(reasonSummary.reduce((sum, [, value]) => sum + Number(value), 0))}건
                    </span>
                    {reasonSummary.map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700"
                      >
                        <span className="mr-2 text-slate-500">{key}</span>
                        <span className="font-semibold text-slate-900">{formatNumber(value)}건</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div className={`${cardClass} p-4`}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[16px] font-bold text-slate-900">
                        {terminationEntryMode === "termination" ? "해지 입력" : "청구보류 입력"}
                      </div>
                      <div className="mt-1 text-[12px] text-slate-500">
                        필수 항목을 입력한 뒤 등록하면 현재 시트에 바로 반영됩니다.
                      </div>
                    </div>
                    <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                      <button
                        type="button"
                        onClick={() => setTerminationEntryMode("termination")}
                        className={`rounded-2xl px-3 py-1.5 text-[13px] font-semibold ${terminationEntryMode === "termination" ? "bg-blue-600 text-white" : "text-slate-600"}`}
                      >
                        해지 입력
                      </button>
                      <button
                        type="button"
                        onClick={() => setTerminationEntryMode("hold")}
                        className={`rounded-2xl px-3 py-1.5 text-[13px] font-semibold ${terminationEntryMode === "hold" ? "bg-blue-600 text-white" : "text-slate-600"}`}
                      >
                        청구보류 입력
                      </button>
                    </div>
                  </div>
                  {terminationEntryMode === "termination" ? (
                    <div className="grid grid-cols-4 gap-3">
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">접수일</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" type="date" value={terminationDraft.receivedDate} onChange={(e)=>updateTerminationDraft("receivedDate", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">담당자</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="담당자" value={terminationDraft.manager} onChange={(e)=>updateTerminationDraft("manager", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">고객번호</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="고객번호" value={terminationDraft.customerId} onChange={(e)=>updateTerminationDraft("customerId", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">고객사</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="고객사" value={terminationDraft.companyName} onChange={(e)=>updateTerminationDraft("companyName", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">고객 부서</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="고객 부서" value={terminationDraft.departmentName} onChange={(e)=>updateTerminationDraft("departmentName", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">해지 사유</div>
                        <select className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" value={terminationDraft.reason} onChange={(e)=>updateTerminationDraft("reason", e.target.value)}>
                          {["계약만료","비용절감","사용자퇴사","폐업","합병매각","휴직/장기출장","기타"].map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">해지일</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" type="date" value={terminationDraft.terminationDate} onChange={(e)=>updateTerminationDraft("terminationDate", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">위약금</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="위약금" value={terminationDraft.penalty} onChange={(e)=>updateTerminationDraft("penalty", e.target.value)} />
                      </label>
                      {terminationDraft.reason === "기타" && (
                        <label className="space-y-1">
                          <div className="text-[12px] font-medium text-slate-600">기타 사유</div>
                          <input
                            className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]"
                            placeholder="기타 사유"
                            value={terminationDraft.reasonDetail}
                            onChange={(e)=>updateTerminationDraft("reasonDetail", e.target.value)}
                          />
                        </label>
                      )}
                      <div className="col-span-4 flex justify-end pt-1">
                        <button type="button" onClick={handleTerminationCreate} className="h-10 rounded-2xl bg-blue-600 px-4 text-[14px] font-semibold text-white">
                          {isPending ? "등록 중..." : "등록"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">접수일</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" type="date" value={holdDraft.receivedDate} onChange={(e)=>updateHoldDraft("receivedDate", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">담당자</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="담당자" value={holdDraft.manager} onChange={(e)=>updateHoldDraft("manager", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">고객번호</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="고객번호" value={holdDraft.customerId} onChange={(e)=>updateHoldDraft("customerId", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">고객사</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="고객사" value={holdDraft.companyName} onChange={(e)=>updateHoldDraft("companyName", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">고객 부서</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="고객 부서" value={holdDraft.departmentName} onChange={(e)=>updateHoldDraft("departmentName", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">보류 사유</div>
                        <select className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" value={holdDraft.reason} onChange={(e)=>updateHoldDraft("reason", e.target.value)}>
                          {["사용자퇴사","계약만료","비용절감","휴직/장기출장","기타"].map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">시작일</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" type="date" value={holdDraft.startDate} onChange={(e)=>updateHoldDraft("startDate", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">종료일</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" type="date" value={holdDraft.endDate} onChange={(e)=>updateHoldDraft("endDate", e.target.value)} />
                      </label>
                      <div className="col-span-4 flex justify-end pt-1">
                        <button type="button" onClick={handleHoldCreate} className="h-10 rounded-2xl bg-blue-600 px-4 text-[14px] font-semibold text-white">
                          {isPending ? "등록 중..." : "등록"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div className={`${cardClass} overflow-hidden p-0`}>
                  <div className="border-b border-slate-200 px-4 py-3 text-[17px] font-bold text-slate-900">해지 리스트</div>
                  <div className="overflow-x-auto">
                  <table className={`${tableClass} min-w-full`}>
                    <thead>
                      <tr>
                        <th className={`${thClass} text-center`}>No.</th>
                        <th className={`${thClass} text-center`}>선택</th>
                        <th className={thClass}>
                          {renderSortLabel("접수일", terminationSort.key === "receivedDate", terminationSort.dir, () => toggleTerminationSort("receivedDate"))}
                        </th>
                        <th className={thClass}>담당자</th>
                        <th className={thClass}>고객번호</th>
                        <th className={thClass}>고객사</th>
                        <th className={thClass}>고객 부서</th>
                        <th className={thClass}>해지 사유</th>
                        <th className={thClass}>
                          {renderSortLabel("해지일", terminationSort.key === "terminationDate", terminationSort.dir, () => toggleTerminationSort("terminationDate"))}
                        </th>
                        <th className={`${thClass} text-right`}>위약금</th>
                        <th className={`${thClass} text-center`}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {terminationItems.map((row: any, index: number) => {
                        const editing = editingTerminationId === row.id
                        return (
                        <tr key={row.id} className={row.selected ? "bg-rose-50" : ""}>
                          <td className={`${tdClass} text-center tabular-nums`}>{index + 1}</td>
                          <td className={`${tdClass} text-center`}>
                            <input
                              type="checkbox"
                              checked={Boolean(row.selected)}
                              onChange={() => toggleTerminationSelected(row.id)}
                            />
                          </td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{editing ? <input type="date" className="h-9 w-36 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.receivedDate || ""} onChange={(e)=>updateEditingTerminationDraft("receivedDate", e.target.value)} /> : normalizeDate(row.receivedDate)}</td>
                          <td className={tdClass}>{editing ? <input className="h-9 w-full min-w-[110px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.manager || ""} onChange={(e)=>updateEditingTerminationDraft("manager", e.target.value)} /> : row.manager}</td>
                          <td className={tdClass}>{editing ? <input className="h-9 w-full min-w-[110px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.customerId || ""} onChange={(e)=>updateEditingTerminationDraft("customerId", e.target.value)} /> : row.customerId}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.companyName || ""} onChange={(e)=>updateEditingTerminationDraft("companyName", e.target.value)} /> : row.companyName}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.departmentName || ""} onChange={(e)=>updateEditingTerminationDraft("departmentName", e.target.value)} /> : row.departmentName}</td>
                          <td className={tdClass}>
                            {editing ? (
                              <div className="space-y-2">
                                <select className="h-9 w-full min-w-[120px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.reason || "계약만료"} onChange={(e)=>updateEditingTerminationDraft("reason", e.target.value)}>
                                  {["계약만료","비용절감","사용자퇴사","폐업","합병매각","휴직/장기출장","기타"].map((item) => <option key={item} value={item}>{item}</option>)}
                                </select>
                                {editingTerminationDraft.reason === "기타" && (
                                  <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.reasonDetail || ""} onChange={(e)=>updateEditingTerminationDraft("reasonDetail", e.target.value)} placeholder="기타 사유" />
                                )}
                              </div>
                            ) : row.reason}
                          </td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{editing ? <input type="date" className="h-9 w-36 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.terminationDate || ""} onChange={(e)=>updateEditingTerminationDraft("terminationDate", e.target.value)} /> : normalizeDate(row.terminationDate)}</td>
                          <td className={`${tdClass} text-right tabular-nums`}>{editing ? <input className="h-9 w-28 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.penalty || ""} onChange={(e)=>updateEditingTerminationDraft("penalty", e.target.value)} /> : row.penalty ? formatNumber(row.penalty) : ""}</td>
                          <td className={`${tdClass} text-center`}>
                            {editing ? (
                              <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                <button type="button" onClick={() => handleTerminationUpdate(row.id)} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">수정완료</button>
                                <button type="button" onClick={() => handleDeleteTerminationRow(row.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">삭제</button>
                                <button type="button" onClick={() => { setEditingTerminationId(null); setEditingTerminationDraft({}) }} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">취소</button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startTerminationEdit(row)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap"
                              >
                                수정
                              </button>
                            )}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                  </div>
                </div>
                <div className={`${cardClass} overflow-hidden p-0`}>
                  <div className="border-b border-slate-200 px-4 py-3 text-[17px] font-bold text-slate-900">청구보류 리스트</div>
                  <div className="overflow-x-auto">
                  <table className={`${tableClass} min-w-full`}>
                    <thead>
                      <tr>
                        <th className={`${thClass} text-center`}>No.</th>
                        <th className={thClass}>
                          {renderSortLabel("접수일", holdSort.key === "receivedDate", holdSort.dir, () => toggleHoldSort("receivedDate"))}
                        </th>
                        <th className={thClass}>담당자</th>
                        <th className={thClass}>고객번호</th>
                        <th className={thClass}>고객사</th>
                        <th className={thClass}>고객 부서</th>
                        <th className={thClass}>보류 사유</th>
                        <th className={thClass}>
                          {renderSortLabel("시작일", holdSort.key === "startDate", holdSort.dir, () => toggleHoldSort("startDate"))}
                        </th>
                        <th className={thClass}>
                          {renderSortLabel("종료일", holdSort.key === "endDate", holdSort.dir, () => toggleHoldSort("endDate"))}
                        </th>
                        <th className={`${thClass} text-center`}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdItems.map((row: any, index: number) => {
                        const editing = editingHoldId === row.id
                        return (
                        <tr key={row.id}>
                          <td className={`${tdClass} text-center tabular-nums`}>{index + 1}</td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{editing ? <input type="date" className="h-9 w-36 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.receivedDate || ""} onChange={(e)=>updateEditingHoldDraft("receivedDate", e.target.value)} /> : normalizeDate(row.receivedDate)}</td>
                          <td className={tdClass}>{editing ? <input className="h-9 w-full min-w-[110px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.manager || ""} onChange={(e)=>updateEditingHoldDraft("manager", e.target.value)} /> : row.manager}</td>
                          <td className={tdClass}>{editing ? <input className="h-9 w-full min-w-[110px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.customerId || ""} onChange={(e)=>updateEditingHoldDraft("customerId", e.target.value)} /> : row.customerId}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.companyName || ""} onChange={(e)=>updateEditingHoldDraft("companyName", e.target.value)} /> : row.companyName}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.departmentName || ""} onChange={(e)=>updateEditingHoldDraft("departmentName", e.target.value)} /> : row.departmentName}</td>
                          <td className={tdClass}>{editing ? <select className="h-9 w-full min-w-[120px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.reason || "사용자퇴사"} onChange={(e)=>updateEditingHoldDraft("reason", e.target.value)}>{["사용자퇴사","계약만료","비용절감","휴직/장기출장","기타"].map((item) => <option key={item} value={item}>{item}</option>)}</select> : row.reason}</td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{editing ? <input type="date" className="h-9 w-36 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.startDate || ""} onChange={(e)=>updateEditingHoldDraft("startDate", e.target.value)} /> : normalizeDate(row.startDate)}</td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{editing ? <input type="date" className="h-9 w-36 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.endDate || ""} onChange={(e)=>updateEditingHoldDraft("endDate", e.target.value)} /> : normalizeDate(row.endDate)}</td>
                          <td className={`${tdClass} text-center`}>
                            {editing ? (
                              <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                <button type="button" onClick={() => handleHoldUpdate(row.id)} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">수정완료</button>
                                <button type="button" onClick={() => handleMoveHoldToTermination(row.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">해지이동</button>
                                <button type="button" onClick={() => handleDeleteHoldRow(row.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">삭제</button>
                                <button type="button" onClick={() => { setEditingHoldId(null); setEditingHoldDraft({}) }} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">취소</button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startHoldEdit(row)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap"
                              >
                                수정
                              </button>
                            )}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}



