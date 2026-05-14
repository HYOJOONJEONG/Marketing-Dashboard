"use client"

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, KeyRound, LogOut, Menu, MessageSquare, UserRound, X } from "lucide-react"
import { OptionDashboardPage } from "./option-dashboard/OptionDashboardPage"
import { DailyReportPage } from "./daily-report/daily-report-page"
import {
  DailyDirectoryUser,
  createEmptyDailyReportState,
  normalizeDailyReportState,
} from "@/lib/daily-report"

type ViewKey =
  | "daily-report"
  | "weekly-report"
  | "contracts"
  | "weekly-selection"
  | "manual-input"
  | "collection"
  | "option-dashboard"
  | "termination"

const VIEW_STATE_KEYS: Record<ViewKey, string[]> = {
  "daily-report": ["dailyReport", "ui"],
  "weekly-report": ["weeklyReport", "currentYear", "years", "availableYears", "paidOptionSourceColumns", "ui"],
  "contracts": ["contracts", "currentYear", "years", "availableYears", "ui"],
  "weekly-selection": ["contracts", "weeklyReport", "ui"],
  "manual-input": ["weeklyReport", "currentYear", "years", "availableYears", "paidOptionSourceColumns", "ui"],
  "collection": ["collection", "currentYear", "years", "availableYears", "ui"],
  "option-dashboard": ["ui"],
  "termination": ["termination", "ui"],
}

function pickTopLevelState(source: any, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, source?.[key]]))
}

function collectStateKeysForViews(views: ViewKey[]) {
  return Array.from(new Set(views.flatMap((viewKey) => VIEW_STATE_KEYS[viewKey] || [])))
}

type CollectionTabKey = "integrated" | "long-term" | "delivery"
type SectionKey = "dailyReport" | "performance" | "termination"

const LOCAL_STORAGE_KEY = "infobiz-dashboard-state-v1"
const PRESENCE_HEARTBEAT_RUSH_INTERVAL_MS = 15 * 1000
const PRESENCE_HEARTBEAT_DEFAULT_INTERVAL_MS = 45 * 1000
const DAILY_REPORT_POLL_RUSH_INTERVAL_MS = 10 * 1000
const DAILY_REPORT_POLL_DEFAULT_INTERVAL_MS = 60 * 1000

function getKstHour() {
  const formattedHour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    hour12: false,
  }).format(new Date())
  return Number(formattedHour) % 24
}

function isDailyReportRushHourKst() {
  const hour = getKstHour()
  return hour >= 16 && hour < 18
}

function getPresenceHeartbeatIntervalMs() {
  return isDailyReportRushHourKst() ? PRESENCE_HEARTBEAT_RUSH_INTERVAL_MS : PRESENCE_HEARTBEAT_DEFAULT_INTERVAL_MS
}

function getDailyReportPollIntervalMs() {
  return isDailyReportRushHourKst() ? DAILY_REPORT_POLL_RUSH_INTERVAL_MS : DAILY_REPORT_POLL_DEFAULT_INTERVAL_MS
}

const viewTitles: Record<ViewKey, string> = {
  "daily-report": "업무일지",
  "weekly-report": "주간실적보고",
  contracts: "신규계약 리스트",
  "weekly-selection": "주간 반영 리스트",
  "manual-input": "수동 입력 리스트",
  collection: "계약서통합관리",
  "option-dashboard": "유료 옵션 정보 현황",
  termination: "해지 진행사항",
}

const manualSummaryAutoFields = new Set([
  "weeklyNetUnits",
  "weeklyNewContracts",
  "weeklyTerminationContracts",
  "newContractTotal",
  "holdTotal",
  "terminationTypeTotal",
])

const manualSummaryMatrixRows = [
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

type PresenceStatus = "online" | "away" | "offline"
type CreateStatus = "idle" | "saving" | "success"
type ContractSortKey =
  | "createdAt"
  | "companyName"
  | "departmentName"
  | "idCode"
  | "industry"
  | "contractMonth"
  | "recommender"
  | "documentStatus"
  | "replacementType"
  | "note"

type PresenceUser = {
  userId: string
  userName: string
  teamName: string
  title?: string | null
  avatarEmoji?: string | null
  currentPage: string
  currentSection: string
  status: PresenceStatus
  color: { bg: string; text: string; border: string; hex: string }
}

type PopupMessage = {
  id: string
  senderUserId: string
  senderName: string
  title: string
  body: string
  createdAt: string
}

function getPresenceDotClass(status: PresenceStatus) {
  if (status === "online") return "bg-emerald-500"
  if (status === "away") return "bg-amber-400"
  return "bg-slate-300"
}

function getPresenceLabel(status: PresenceStatus) {
  if (status === "online") return "온라인"
  if (status === "away") return "자리비움"
  return "오프라인"
}

  const cardClass = "rounded-[24px] border border-slate-200 bg-white shadow-sm"
const tableClass = "w-full text-[14px]"
const thClass = "border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[13px] font-semibold text-slate-600"
const tdClass = "border-t border-slate-200 px-3 py-2.5 align-middle text-center text-[14px] text-slate-800"
const weeklyReportTableClass = "weekly-report-table w-full table-fixed text-[14px]"
const weeklyThClass = "border-b border-slate-200 bg-slate-100 px-2.5 py-2 text-center text-[13px] font-semibold text-slate-700"
const weeklyTdClass = "border-t border-slate-200 px-2.5 py-2 text-center align-middle text-[14px] text-slate-800"
const manualTableInputClass =
  "h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-[13px] font-medium text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
const manualTableTextInputClass =
  "h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-medium text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
const manualSectionTitleClass = "text-[15px] font-bold text-slate-900"
const manualHeaderCellClass = "border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[13px] font-semibold text-slate-700"
const manualLabelCellClass = "w-[132px] bg-slate-50 px-3 py-2.5 text-center text-[13px] font-semibold text-slate-700"
const manualTableTitleRowClass = "border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-[16px] font-bold text-slate-900"
function toNumber(value: unknown) {
  const num = Number(String(value ?? "").replace(/,/g, ""))
  return Number.isNaN(num) ? 0 : num
}

function formatNumber(value: unknown) {
  return toNumber(value).toLocaleString("ko-KR")
}

function normalizeCustomerIdentifier(value: unknown) {
  return String(value ?? "").trim().toUpperCase()
}

function normalizeSearchIdentifier(value: unknown) {
  return String(value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
}

function matchesSearchQuery(value: unknown, query: string, identifierQuery: string) {
  const text = String(value ?? "").toLowerCase()
  if (query && text.includes(query)) return true
  if (identifierQuery && normalizeSearchIdentifier(value).includes(identifierQuery)) return true
  return false
}

function getContractSearchText(row: Record<string, unknown>) {
  return [
    row.companyName,
    row.departmentName,
    row.idCode,
    row.industry,
    row.contractMonth,
    toContractMonthInputValue(row.contractMonth),
    row.recommender,
    row.documentStatus,
    row.replacementType,
    row.note,
  ]
}

function getTerminationSearchText(row: Record<string, unknown>) {
  return [
    row.companyName,
    row.departmentName,
    row.customerId,
    row.idCode,
    row.id,
    row.manager,
    row.reason,
    row.note,
  ]
}

function compareContractValue(rowA: Record<string, unknown>, rowB: Record<string, unknown>, key: string) {
  if (key === "createdAt") {
    return parseDateKey(rowA.createdAt) - parseDateKey(rowB.createdAt)
  }
  if (key === "contractMonth") {
    return parseContractMonthKey(rowA.contractMonth) - parseContractMonthKey(rowB.contractMonth)
  }
  if (key === "idCode") {
    return normalizeSearchIdentifier(rowA.idCode).localeCompare(normalizeSearchIdentifier(rowB.idCode), "ko", {
      numeric: true,
      sensitivity: "base",
    })
  }
  return String(rowA[key] ?? "").localeCompare(String(rowB[key] ?? ""), "ko", {
    numeric: true,
    sensitivity: "base",
  })
}

function sortContractsByKey<T extends Record<string, unknown>>(items: T[], key: string, dir: "asc" | "desc") {
  const factor = dir === "asc" ? 1 : -1
  return [...items].sort((a, b) => compareContractValue(a, b, key) * factor)
}

function formatMoney(value: unknown) {
  return `${formatNumber(value)}원`
}

function formatLastUpdated(value: unknown) {
  if (!value) return "No updates yet"
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return "No updates yet"
  const seoulDate = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const year = seoulDate.getUTCFullYear()
  const month = String(seoulDate.getUTCMonth() + 1).padStart(2, "0")
  const day = String(seoulDate.getUTCDate()).padStart(2, "0")
  const hour24 = seoulDate.getUTCHours()
  const period = hour24 >= 12 ? "오후" : "오전"
  const hour12 = hour24 % 12 || 12
  const minute = String(seoulDate.getUTCMinutes()).padStart(2, "0")
  return `${year}. ${month}. ${day}. ${period} ${String(hour12).padStart(2, "0")}:${minute}`
}

function getSeoulTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function getTerminationManagerFallback(row: any) {
  const manager = String(row?.manager || "").trim()
  if (manager) return manager
  return ""
}

function backfillTerminationManagerRows(rows: any[] = []) {
  let changed = false
  const nextRows = rows.map((row) => {
    const manager = getTerminationManagerFallback(row)
    if (!manager || String(row?.manager || "").trim() === manager) return row
    changed = true
    return { ...row, manager }
  })
  return { rows: changed ? nextRows : rows, changed }
}

function backfillTerminationSheetManagers(sheet: any) {
  const nextSheet = { ...sheet }
  let changed = false

  ;(["items", "holdItems", "confirmedItems", "releasedHoldItems"] as const).forEach((key) => {
    const result = backfillTerminationManagerRows(nextSheet[key] || [])
    if (result.changed) {
      nextSheet[key] = result.rows
      changed = true
    }
  })

  return { sheet: changed ? nextSheet : sheet, changed }
}

function replaceDivisionName(text: unknown) {
  return String(text ?? "")
    .replace(/정보사업본부/g, "인포Biz본부")
    .replace(/정보사업1팀/g, "인포Biz1팀")
}

function sanitizeTerminationTitle(text: unknown) {
  return String(text ?? "").replace(/\(새시트\)/g, "").trim()
}

function isBrokenKoreanText(text: unknown) {
  const value = String(text ?? "")
  if (!value.trim()) return false
  return value.includes("�") || value.includes("?") || /[ÃÂÌÍÑÕØ]/.test(value)
}

function getSafeTerminationTeamLabel(value: unknown) {
  return isBrokenKoreanText(value) ? "인포Biz본부 인포Biz1팀" : String(value ?? "")
}

function getSafeTerminationGuidelines(value: unknown) {
  const fallback = ["1. 해지 발생 시 선보고 진행", "2. CRM 및 해지 리스트 등록"]
  if (!Array.isArray(value) || value.length === 0) return fallback
  const mapped = value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .map((item, idx) =>
      isBrokenKoreanText(item)
        ? fallback[idx] || fallback[fallback.length - 1]
        : item.replace("해지 발생 시 본부장님 보고 진행", "해지 발생 시 선보고 진행"),
    )
  return mapped.length ? mapped : fallback
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
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

function formatDateOnlyDotted(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (digits.length >= 8) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
  return normalizeDate(value)
}

function normalizeMonth(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (digits.length === 4) return `20${digits.slice(0, 2)}.${digits.slice(2, 4)}`
  if (digits.length === 6 && digits.startsWith("20")) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}`
  if (digits.length === 8 && digits.startsWith("20")) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}`
  return String(value ?? "")
}

function formatMonthLabel(value: unknown) {
  const normalized = normalizeMonth(value)
  const digits = normalized.replace(/[^\d]/g, "")
  if (digits.length === 6) return `${digits.slice(2, 4)}년 ${digits.slice(4, 6)}월`
  if (digits.length === 8) return `${digits.slice(2, 4)}년 ${digits.slice(4, 6)}월`
  return normalized
}

function toInputDate(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  return ""
}

function toInputMonth(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (digits.length === 4) return `20${digits.slice(0, 2)}-${digits.slice(2, 4)}`
  if (digits.length === 6 && digits.startsWith("20")) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`
  if (digits.length === 8 && digits.startsWith("20")) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`
  return ""
}

function parseDateKey(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (digits.length === 6) {
    if (digits.startsWith("20")) return Number(`${digits}01`)
    return Number(`20${digits}`)
  }
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

function toContractMonthInputValue(value: unknown) {
  const parts = parseContractMonthParts(value)
  if (!parts) return ""
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}`
}

function fromContractMonthInputValue(value: unknown) {
  const text = String(value ?? "").trim()
  const match = text.match(/^(\d{4})-(\d{2})$/)
  if (!match) return text
  const year = match[1].slice(-2)
  const month = String(Number(match[2]))
  return `${year}년 ${month}월`
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

function sanitizeCellValue(value: unknown, fallback = "") {
  if (value == null) return fallback
  const text = String(value ?? "").trim()
  return text
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

function buildRevenueRowsWithComputedTotal(rows: any[]) {
  const fallbackLabels = ["매출순증", "위약금", "이전비", "합계"]
  const fallbackKeys = ["sales", "penalty", "move", "total"]
  const normalizedRows = (Array.isArray(rows) ? rows : []).map((row, index) => ({
    ...row,
    key: row?.key || fallbackKeys[index] || `row-${index}`,
    label: sanitizeSummaryText(row?.label, fallbackLabels[index] || `항목 ${index + 1}`),
    months: Array.from({ length: 12 }, (_, monthIndex) => sanitizeCellValue(row?.months?.[monthIndex], "")),
  }))
  const baseRows = normalizedRows.filter((row) => String(row?.label || "").trim() !== "합계")
  if (!baseRows.length) return normalizedRows

  const lastActiveMonthIndex = baseRows.reduce((lastIndex, row) => {
    const rowLastIndex = (row.months || []).reduce((latest: number, value: unknown, monthIndex: number) => {
      const text = String(value ?? "").trim()
      if (!text) return latest
      return parseLooseNumber(text) !== 0 ? monthIndex : latest
    }, -1)
    return Math.max(lastIndex, rowLastIndex)
  }, -1)
  const displayBaseRows = baseRows.map((row) => ({
    ...row,
    months: (row.months || []).map((value: unknown, monthIndex: number) => {
      const text = sanitizeCellValue(value, "")
      if (monthIndex > lastActiveMonthIndex && parseLooseNumber(text) === 0) return ""
      return text
    }),
  }))

  const totalMonths = Array.from({ length: 12 }, (_, monthIndex) =>
    displayBaseRows.some((row) => String(row?.months?.[monthIndex] ?? "").trim() !== "")
      ? displayBaseRows.reduce((sum, row) => sum + toNumber(row?.months?.[monthIndex]), 0)
      : "",
  )
  const totalRow =
    normalizedRows.find((row) => String(row?.label || "").trim() === "합계") || {
      key: "total",
      label: "합계",
      months: Array(12).fill(0),
    }

  return [
    ...displayBaseRows,
    {
      ...totalRow,
      key: totalRow.key || "total",
      label: "합계",
      months: totalMonths,
    },
  ]
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

const paidOptionInfoColumns = [
  {
    title: "해외채권",
    total: "122건",
    rows: [
      ["국내은행", "14건"],
      ["국내증권", "43건"],
      ["보험사", "33건"],
      ["자산운용", "8건"],
      ["중개사", "3건"],
      ["공제회", "3건"],
      ["연기금/공사", "11건"],
      ["평가사", "2건"],
      ["외국계은행", "1건"],
      ["일반기업", "1건"],
      ["기타금융", "3건"],
    ],
  },
  {
    title: "해외지수",
    total: "152건",
    rows: [
      ["국내은행", "19건"],
      ["국내증권", "70건"],
      ["보험사", "15건"],
      ["자산운용", "0건"],
      ["연기금/공사", "2건"],
      ["외국계은행", "30건"],
      ["선물중개사", "6건"],
      ["일반기업", "6건"],
      ["공제회", "4건"],
    ],
  },
  {
    title: "해외종목",
    total: "10건",
    rows: [
      ["국내은행", "2건"],
      ["자산운용", "3건"],
      ["일반기업", "2건"],
      ["보험사", "3건"],
    ],
  },
  {
    title: "LME",
    total: "26건",
    rows: [
      ["국내은행", "1건"],
      ["외국계은행", "6건"],
      ["일반기업", "19건"],
    ],
  },
  {
    title: "전광판",
    total: "15건",
    rows: [
      ["국내은행", "8건"],
      ["국내증권", "1건"],
      ["일반기업", "3건"],
      ["기타금융", "1건"],
      ["연기금/공사", "1건"],
      ["정부기관", "1건"],
    ],
  },
  {
    title: "SOFR",
    total: "171건",
    rows: [
      ["국내은행", "37건"],
      ["국내증권", "4건"],
      ["기타금융", "2건"],
      ["외국계은행", "22건"],
      ["일반기업", "91건"],
      ["공사", "7건"],
      ["보험", "6건"],
      ["연기금", "1건"],
      ["자산운용", "1건"],
    ],
  },
] as const

const paidOptionOrderedTitles = ["해외채권", "해외지수", "해외종목", "LME", "전광판", "SOFR"] as const
const paidOptionTitleByCode: Record<string, string> = {
  BOND: "해외채권",
  INDEX: "해외지수",
  STOCK: "해외종목",
  LME: "LME",
  SIGNAGE: "전광판",
  API: "API",
  SOFR: "SOFR",
}

const weeklyTerminationOverviewRows = [
  { label: "주간", values: ["3", "1", "3", "", "1", "1", "", "", "1", "9"] },
  { label: "누적", values: ["40", "5", "36", "6", "1", "1", "5", "", "1", "95"] },
  { label: "비율", values: ["42%", "5%", "38%", "6%", "1%", "1%", "5%", "0%", "1%", "100%"] },
] as const

const weeklyIndustryOverviewRows = [
  { label: "신규", values: ["88", "7", "6", "32", "9", "24", "6", "6", "30", "208"] },
  { label: "순증", values: ["37", "5", "1", "25", "2", "9", "5", "5", "24", "113"] },
] as const

function buildPaidOptionInfoColumns(columns: any[]) {
  const source = Array.isArray(columns) && columns.length ? columns : paidOptionInfoColumns
  const baseByTitle = new Map<string, any>(
    paidOptionInfoColumns
      .filter((column) => String(column.title) !== "API")
      .map((column) => [column.title, column]),
  )
  const sourceByTitle = new Map<string, any>()
  source.forEach((column: any, idx: number) => {
    const code = String(column?.category_code || "").trim()
    const fallbackByCode = paidOptionTitleByCode[code] || ""
    const fallbackByIndex = sanitizeSummaryText(paidOptionInfoColumns[idx]?.title, "")
    const title = sanitizeSummaryText(column?.title, fallbackByCode || fallbackByIndex)
    if (!paidOptionOrderedTitles.includes(title as any)) return
    sourceByTitle.set(title, column)
  })

  return paidOptionOrderedTitles.map((title, index) => {
    const fromSource = sourceByTitle.get(title) || {}
    const fromBase = baseByTitle.get(title) || {}
    const sourceRows = title === "해외지수" ? fromBase?.rows : fromSource?.rows
    const rows = Array.isArray(sourceRows)
      ? sourceRows.map((row: any) => [
          sanitizeSummaryText(Array.isArray(row) ? row[0] : row?.[0], ""),
          sanitizeCellValue(Array.isArray(row) ? row[1] : row?.[1], ""),
        ])
      : Array.isArray(fromBase?.rows)
        ? [...fromBase.rows]
        : []
    const rowTotal = rows.reduce((sum: number, row: any[]) => sum + parseLooseNumber(row?.[1]), 0)
    return {
      id: fromSource?.id || fromBase?.id || `paid-option-${index}`,
      title,
      total:
        title === "해외지수" && rowTotal > 0
          ? `${rowTotal}건`
          : sanitizeSummaryText(fromSource?.total, fromBase?.total || "0건"),
      rows,
    }
  })
}

function formatCountToKoreanUnit(value: unknown, fallback = "0건") {
  const text = String(value ?? "").trim()
  if (!text) return fallback
  if (text.endsWith("건")) return text
  const parsed = parseLooseNumber(text)
  if (!Number.isFinite(parsed)) return fallback
  return `${parsed}건`
}

function applySeedTotalsToPaidOptionColumns(columns: any[], cards: any[]) {
  const normalizedColumns = buildPaidOptionInfoColumns(columns)
  const titleByCode = new Map<string, string>(
    Object.entries(paidOptionTitleByCode).map(([code, title]) => [String(code).trim(), String(title).trim()]),
  )
  const countByTitle = new Map<string, string>()
  ;(Array.isArray(cards) ? cards : []).forEach((card: any) => {
    const code = String(card?.category_code || "").trim()
    if (code === "API") return
    const title = titleByCode.get(code) || sanitizeSummaryText(card?.category_name_ko, "")
    if (!title) return
    countByTitle.set(title, formatCountToKoreanUnit(card?.count_value))
  })
  return normalizedColumns.map((column: any) => {
    const rowTotal = (column.rows || []).reduce((sum: number, row: any[]) => sum + parseLooseNumber(row?.[1]), 0)
    return {
      ...column,
      total:
        column.title === "해외지수" && rowTotal > 0
          ? `${rowTotal}건`
          : countByTitle.get(column.title) || formatCountToKoreanUnit(column.total, "0건"),
    }
  })
}

function buildTerminationOverviewRows(rows: any[]) {
  return (Array.isArray(rows) && rows.length ? rows : weeklyTerminationOverviewRows).map((row: any, index: number) => ({
    label: sanitizeSummaryText(row?.label, weeklyTerminationOverviewRows[index]?.label || `행 ${index + 1}`),
    values: Array.from({ length: reportTerminationColumnsStatic.length }, (_, valueIndex) =>
      sanitizeCellValue(row?.values?.[valueIndex], weeklyTerminationOverviewRows[index]?.values?.[valueIndex] || ""),
    ),
  }))
}

function buildWeeklyIndustryOverviewRows(rows: any[]) {
  return (Array.isArray(rows) && rows.length ? rows : weeklyIndustryOverviewRows).map((row: any, index: number) => ({
    label: sanitizeSummaryText(row?.label, weeklyIndustryOverviewRows[index]?.label || `행 ${index + 1}`),
    values: buildIndustryRowValuesWithTotal(
      Array.from({ length: reportIndustryColumnsStatic.length }, (_, valueIndex) =>
        sanitizeCellValue(row?.values?.[valueIndex], weeklyIndustryOverviewRows[index]?.values?.[valueIndex] || ""),
      ),
    ),
  }))
}

const reportTerminationColumnsStatic = ["계약만료", "비용절감", "퇴사", "조직개편", "휴직,장기출장", "합병매각", "활용도 저조", "타사대체", "비용미납", "합계"] as const
const reportIndustryColumnsStatic = ["국내증권", "국내은행", "외국계", "자산운용", "보험사", "일반기업", "공사/정부", "연기금", "기타금융", "합계"] as const

const terminationReasonAlias: Record<string, string> = {
  "사용자퇴사": "퇴사",
  "사용자이동퇴사": "퇴사",
  "휴직/장기출장": "휴직,장기출장",
  "휴직·장기출장": "휴직,장기출장",
  "휴직,장기출장": "휴직,장기출장",
  "활용지조": "활용도 저조",
  "활용저조": "활용도 저조",
  "활용저하": "활용도 저조",
  "타사교체": "타사대체",
  "타사대체": "타사대체",
  "타사 대체": "타사대체",
}

function parseLooseNumber(value: unknown) {
  const cleaned = String(value ?? "").replace(/[^\d.-]/g, "")
  if (!cleaned) return 0
  const num = Number(cleaned)
  return Number.isNaN(num) ? 0 : num
}

function normalizeTerminationReason(reason: unknown) {
  const raw = String(reason ?? "").trim()
  if (!raw) return ""
  const withoutDetail = raw.replace(/^기타\((.+)\)$/g, "기타")
  const compact = withoutDetail.replace(/\s+/g, "").replace(/\//g, ",")
  if (terminationReasonAlias[compact]) return terminationReasonAlias[compact]
  if ((reportTerminationColumnsStatic as readonly string[]).includes(compact as any)) return compact
  if (compact.includes("휴직") && compact.includes("장기출장")) return "휴직,장기출장"
  if (compact.includes("타사")) return "타사대체"
  if (compact.includes("활용")) return "활용도 저조"
  return ""
}

function buildTerminationWeeklyCounts(items: any[]) {
  const sourceItems = Array.isArray(items) ? items : []
  const columns = reportTerminationColumnsStatic.slice(0, -1)
  const indexMap = new Map<string, number>(columns.map((column, index) => [column, index]))
  const counts = Array.from({ length: columns.length }, () => 0)
  sourceItems.forEach((item: any) => {
    const reason = normalizeTerminationReason(item?.reason)
    const index = reason ? indexMap.get(reason) : undefined
    if (index == null) return
    counts[index] += 1
  })
  const total = sourceItems.length
  return [...counts.map((value) => String(value)), String(total)]
}

function buildTerminationRatioValues(values: string[]) {
  const baseValues = Array.isArray(values) ? values : []
  const total = parseLooseNumber(baseValues[reportTerminationColumnsStatic.length - 1])
  const columns = reportTerminationColumnsStatic.slice(0, -1)
  if (!total) return [...columns.map(() => "0%"), "0%"]
  return [
    ...columns.map((_, index) => `${Math.round((parseLooseNumber(baseValues[index]) / total) * 100)}%`),
    "100%",
  ]
}

function computeTerminationRowTotal(values: any[]) {
  const hasValue = values.some((value) => String(value ?? "").trim() !== "")
  if (!hasValue) return ""
  const hasPercent = values.some((value) => String(value ?? "").includes("%"))
  const sum = values.reduce((total, value) => total + parseLooseNumber(value), 0)
  const percentTotal = hasPercent && sum > 0 && Math.abs(sum - 100) <= 1 ? 100 : sum
  return hasPercent ? `${formatNumber(percentTotal)}%` : formatNumber(sum)
}

function buildTerminationOverviewRowsWithComputedTotals(rows: any[]) {
  const normalizedRows = buildTerminationOverviewRows(rows || []).map((row) => {
    if (row.label === "비율") return row
    const values = Array.from({ length: reportTerminationColumnsStatic.length }, (_, index) =>
      sanitizeCellValue(row.values?.[index], ""),
    )
    if (!String(values[reportTerminationColumnsStatic.length - 1] ?? "").trim()) {
      values[reportTerminationColumnsStatic.length - 1] = computeTerminationRowTotal(
        values.slice(0, reportTerminationColumnsStatic.length - 1),
      )
    }
    return { ...row, values }
  })
  const cumulativeRow = normalizedRows.find((row) => row.label === "누적")
  const ratioIndex = normalizedRows.findIndex((row) => row.label === "비율")
  if (cumulativeRow && ratioIndex !== -1) {
    normalizedRows[ratioIndex] = {
      ...normalizedRows[ratioIndex],
      values: buildTerminationRatioValues(cumulativeRow.values),
    }
  }
  return normalizedRows
}

function computeIndustryRowTotal(values: any[]) {
  const hasValue = values.some((value) => String(value ?? "").trim() !== "")
  if (!hasValue) return ""
  const sum = values.reduce((total, value) => total + parseLooseNumber(value), 0)
  return formatNumber(sum)
}

function normalizeIndustryRowValues(values: any[]) {
  const source = Array.isArray(values) ? values : []
  return Array.from({ length: reportIndustryColumnsStatic.length }, (_, index) =>
    sanitizeCellValue(source[index], ""),
  )
}

function buildIndustryRowValuesWithTotal(values: any[]) {
  const normalized = normalizeIndustryRowValues(values)
  const editableValues = normalized.slice(0, reportIndustryColumnsStatic.length - 1)
  const hasValue = editableValues.some((value) => String(value ?? "").trim() !== "")
  const total = hasValue
    ? String(editableValues.reduce((sum, value) => sum + parseLooseNumber(value), 0))
    : ""
  return [...editableValues, total]
}

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
  ;(Array.isArray(rows) ? rows : []).forEach((row) => {
    const parsedOrder = parseGoalMonthOrder(row?.month)
    if (!parsedOrder) return
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

  const hasCompleteGoalTemplate =
    mergedByMonth.has(1) &&
    mergedByMonth.has(2) &&
    mergedByMonth.has(3) &&
    mergedByMonth.has(4) &&
    mergedByMonth.has(5) &&
    mergedByMonth.has(6) &&
    mergedByMonth.has(7) &&
    mergedByMonth.has(8) &&
    mergedByMonth.has(9) &&
    mergedByMonth.has(10) &&
    mergedByMonth.has(11) &&
    mergedByMonth.has(12)

  if (!hasCompleteGoalTemplate) {
    mergedByMonth.clear()
  }

  const normalizedRows = goalRowTemplate2026.map((templateRow, index) => {
    const order = index + 1 <= 12 ? index + 1 : 13
    const savedRow = mergedByMonth.get(order)
    return {
      month: templateRow.month,
      netTarget: savedRow && savedRow.netTarget != null ? savedRow.netTarget : templateRow.netTarget,
      targetContracts:
        savedRow && savedRow.targetContracts != null ? savedRow.targetContracts : templateRow.targetContracts,
      quarterNetTarget:
        savedRow && savedRow.quarterNetTarget != null ? savedRow.quarterNetTarget : templateRow.quarterNetTarget,
      monthlyActual:
        savedRow && savedRow.monthlyActual != null ? savedRow.monthlyActual : templateRow.monthlyActual,
      quarterActual:
        savedRow && savedRow.quarterActual != null ? savedRow.quarterActual : templateRow.quarterActual,
      gap: savedRow && savedRow.gap != null ? savedRow.gap : templateRow.gap,
    }
  })

  for (let quarterStart = 0; quarterStart < 12; quarterStart += 3) {
    const quarterRows = normalizedRows.slice(quarterStart, quarterStart + 3)
    const quarterMonthlyActual = quarterRows.reduce((sum, row) => sum + toNumber(row.monthlyActual), 0)
    const quarterNetTarget = toNumber(normalizedRows[quarterStart]?.quarterNetTarget)
    normalizedRows[quarterStart] = {
      ...normalizedRows[quarterStart],
      quarterActual: quarterMonthlyActual,
      gap: quarterMonthlyActual - quarterNetTarget,
    }
    for (let index = quarterStart + 1; index < quarterStart + 3; index += 1) {
      normalizedRows[index] = {
        ...normalizedRows[index],
        quarterActual: "",
        gap: "",
      }
    }
  }

  const monthlyRows = normalizedRows.slice(0, 12)
  const totalNetTarget = monthlyRows.reduce((sum, row) => sum + toNumber(row.netTarget), 0)
  const totalTargetContracts = monthlyRows.reduce((latest, row) => {
    const value = toNumber(row.targetContracts)
    return value > 0 ? value : latest
  }, 0)
  const totalQuarterNetTarget = monthlyRows.reduce((sum, row) => sum + toNumber(row.quarterNetTarget), 0)
  const totalMonthlyActual = monthlyRows.reduce((sum, row) => sum + toNumber(row.monthlyActual), 0)
  const totalQuarterActual = monthlyRows.reduce((sum, row) => sum + toNumber(row.quarterActual), 0)
  const totalGap = totalMonthlyActual - totalQuarterNetTarget

  normalizedRows[12] = {
    month: "합계",
    netTarget: totalNetTarget,
    targetContracts: totalTargetContracts,
    quarterNetTarget: totalQuarterNetTarget,
    monthlyActual: totalMonthlyActual,
    quarterActual: totalQuarterActual,
    gap: totalGap,
  }

  return normalizedRows
}

type EditableGoalField = "netTarget" | "targetContracts" | "quarterNetTarget" | "monthlyActual"
const editableGoalFields = new Set<EditableGoalField>(["netTarget", "targetContracts", "quarterNetTarget", "monthlyActual"])

function isEditableGoalField(field: string): field is EditableGoalField {
  return editableGoalFields.has(field as EditableGoalField)
}

function buildEditableGoalRows(rows: any[]) {
  const mergedByMonth = new Map<number, any>()
  ;(Array.isArray(rows) ? rows : []).forEach((row) => {
    const parsedOrder = parseGoalMonthOrder(row?.month)
    if (!parsedOrder) return
    mergedByMonth.set(parsedOrder, row)
  })
  const hasCompleteGoalTemplate = Array.from({ length: 12 }, (_, index) => index + 1).every((month) =>
    mergedByMonth.has(month),
  )
  if (!hasCompleteGoalTemplate) return goalRowTemplate2026.map((row) => ({ ...row }))
  return goalRowTemplate2026.map((templateRow, index) => {
    const order = index + 1 <= 12 ? index + 1 : 13
    const savedRow = mergedByMonth.get(order)
    return {
      month: templateRow.month,
      netTarget: savedRow && savedRow.netTarget != null ? savedRow.netTarget : templateRow.netTarget,
      targetContracts: savedRow && savedRow.targetContracts != null ? savedRow.targetContracts : templateRow.targetContracts,
      quarterNetTarget: savedRow && savedRow.quarterNetTarget != null ? savedRow.quarterNetTarget : templateRow.quarterNetTarget,
      monthlyActual: savedRow && savedRow.monthlyActual != null ? savedRow.monthlyActual : templateRow.monthlyActual,
      quarterActual: savedRow && savedRow.quarterActual != null ? savedRow.quarterActual : templateRow.quarterActual,
      gap: savedRow && savedRow.gap != null ? savedRow.gap : templateRow.gap,
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

function BufferedManualInput({
  value,
  onCommit,
  onLiveChange,
  onDirty,
  className,
  style,
  placeholder,
  inputMode,
  readOnly,
}: {
  value: unknown
  onCommit?: (value: string) => void
  onLiveChange?: (value: string) => void
  onDirty?: () => void
  className: string
  style?: React.CSSProperties
  placeholder?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  readOnly?: boolean
}) {
  const externalValue = String(value ?? "")
  const [draftValue, setDraftValue] = useState(externalValue)
  const latestDraftRef = useRef(externalValue)
  const isEditingRef = useRef(false)

  useEffect(() => {
    if (isEditingRef.current && !readOnly) return
    latestDraftRef.current = externalValue
    setDraftValue(externalValue)
  }, [externalValue, readOnly])

  function commit(nextValue = latestDraftRef.current) {
    isEditingRef.current = false
    latestDraftRef.current = nextValue
    setDraftValue(nextValue)
    if (readOnly) return
    if (nextValue === externalValue) return
    onCommit?.(nextValue)
  }

  return (
    <input
      className={className}
      style={style}
      placeholder={placeholder}
      inputMode={inputMode}
      value={draftValue}
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : undefined}
      aria-readonly={readOnly || undefined}
      onMouseDown={(event) => {
        if (readOnly) event.preventDefault()
      }}
      onFocus={(event) => {
        if (readOnly) {
          isEditingRef.current = false
          latestDraftRef.current = externalValue
          setDraftValue(externalValue)
          event.currentTarget.blur()
          return
        }
        isEditingRef.current = true
        onDirty?.()
        event.currentTarget.select()
      }}
      onChange={(event) => {
        const nextValue = event.target.value
        latestDraftRef.current = nextValue
        setDraftValue(nextValue)
        if (!readOnly) onDirty?.()
        if (!readOnly) onLiveChange?.(nextValue)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur()
        }
      }}
      onBlur={(event) => commit(event.currentTarget.value)}
    />
  )
}

function ManualGoalInputTable({
  currentYear,
  rows,
  onCommitCell,
  onDirty,
}: {
  currentYear: number | string
  rows?: any[]
  onCommitCell: (rowIndex: number, field: EditableGoalField, value: string) => void
  onDirty?: () => void
}) {
  const [draftRows, setDraftRows] = useState<any[]>(() => buildEditableGoalRows(rows || []))
  const [calculatedRows, setCalculatedRows] = useState<any[]>(() => buildGoalRows(rows || []))
  const draftRowsRef = useRef<any[]>(draftRows)
  const isEditingRef = useRef(false)
  const rowsSignature = useMemo(() => JSON.stringify(rows || []), [rows])

  function setGoalDraftRows(nextDraftRows: any[]) {
    draftRowsRef.current = nextDraftRows
    setDraftRows(nextDraftRows)
    setCalculatedRows(buildGoalRows(nextDraftRows))
  }

  useEffect(() => {
    if (isEditingRef.current) return
    const nextDraftRows = buildEditableGoalRows(rows || [])
    setGoalDraftRows(nextDraftRows)
  }, [rowsSignature])

  function buildNextDraftRows(rowIndex: number, field: EditableGoalField, value: string, baseRows = draftRowsRef.current) {
    const next = buildEditableGoalRows(baseRows)
    if (!next[rowIndex]) return next
    next[rowIndex][field] = value
    return next
  }

  function updateDraftCell(rowIndex: number, field: EditableGoalField, value: string) {
    const nextDraftRows = buildNextDraftRows(rowIndex, field, value)
    setGoalDraftRows(nextDraftRows)
    onDirty?.()
  }

  function commitDraftCell(rowIndex: number, field: EditableGoalField, value: string) {
    isEditingRef.current = false
    const nextDraftRows = buildNextDraftRows(rowIndex, field, value)
    setGoalDraftRows(nextDraftRows)
    const currentValue = nextDraftRows[rowIndex]?.[field]
    if (
      String(currentValue ?? "") === String(value ?? "") &&
      String(rows?.[rowIndex]?.[field] ?? "") === String(value ?? "")
    ) {
      return
    }
    onCommitCell(rowIndex, field, value)
  }

  function handleFocus(event: React.FocusEvent<HTMLInputElement>, readOnly?: boolean) {
    isEditingRef.current = true
    if (!readOnly) onDirty?.()
    event.currentTarget.select()
  }

  function renderEditableInput(row: any, rowIndex: number, field: EditableGoalField, isTotalRow: boolean) {
    const inputValue = isTotalRow ? row[field] : draftRows[rowIndex]?.[field]
    return (
      <input
        className={`${manualTableInputClass} ${isTotalRow ? "font-bold text-slate-900" : ""}`}
        style={
          isTotalRow
            ? {
                backgroundColor: "#fffbeb",
                borderColor: "#fcd34d",
              }
            : undefined
        }
        value={String(inputValue ?? "")}
        onFocus={(event) => handleFocus(event, isTotalRow)}
        onChange={(event) => updateDraftCell(rowIndex, field, event.target.value)}
        onBlur={(event) => commitDraftCell(rowIndex, field, event.target.value)}
        readOnly={isTotalRow}
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className={tableClass}>
        <thead>
          <tr>
            <th colSpan={7} className={manualTableTitleRowClass}>
              {currentYear}년 판매 목표 (단말기 목표 6,364대, 순증 260대)
            </th>
          </tr>
          <tr>
            {["구분(월)", "순증", "목표계약대수", "분기순증목표", "월간실적", "분기실적", "목표대비 달성현황"].map((head) => (
              <th key={head} className={manualHeaderCellClass}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calculatedRows.map((row: any, rowIndex: number) => {
            const isTotalRow = row.month === "합계"
            const isQuarterGroupStart = rowIndex < 12 && rowIndex % 3 === 0
            const shouldRenderQuarterValue = isTotalRow || rowIndex >= 12 || isQuarterGroupStart
            const quarterRowSpan = !isTotalRow && rowIndex < 12 ? 3 : undefined
            return (
              <tr key={`${row.month}-${rowIndex}`}>
                <td className={`${manualLabelCellClass} ${isTotalRow ? "font-bold text-slate-900" : ""}`}>{row.month}</td>
                {(["netTarget", "targetContracts"] as EditableGoalField[]).map((field) => (
                  <td key={field} className={`${tdClass} p-1`}>
                    {renderEditableInput(row, rowIndex, field, isTotalRow)}
                  </td>
                ))}
                {shouldRenderQuarterValue ? (
                  <td rowSpan={quarterRowSpan} className={`${tdClass} p-1 align-middle`}>
                    {renderEditableInput(row, rowIndex, "quarterNetTarget", isTotalRow)}
                  </td>
                ) : null}
                <td className={`${tdClass} p-1`}>
                  {renderEditableInput(row, rowIndex, "monthlyActual", isTotalRow)}
                </td>
                {shouldRenderQuarterValue ? (
                  <td rowSpan={quarterRowSpan} className={`${tdClass} p-1 align-middle`}>
                    <input
                      className={`${manualTableInputClass} ${isTotalRow ? "font-bold text-slate-900" : ""}`}
                      style={{
                        backgroundColor: "#fffbeb",
                        borderColor: "#fcd34d",
                        ...(isTotalRow ? { fontWeight: 700, color: "#0f172a" } : {}),
                      }}
                      value={String(row.quarterActual ?? "")}
                      readOnly
                    />
                  </td>
                ) : null}
                {shouldRenderQuarterValue ? (
                  <td rowSpan={quarterRowSpan} className={`${tdClass} p-1 align-middle`}>
                    <input
                      className={`${manualTableInputClass} ${isTotalRow ? "font-bold text-slate-900" : ""}`}
                      style={{
                        backgroundColor: "#fffbeb",
                        borderColor: "#fcd34d",
                        ...(isTotalRow ? { fontWeight: 700, color: "#0f172a" } : {}),
                      }}
                      value={String(row.gap ?? "")}
                      readOnly
                    />
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
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
  if (!list.length) return [{ idCode: "", company: "", amount: "", content: "", note: "", kind: "manual" }]
  return list.map((row) => {
    const legacyLabel = String(row?.label ?? "")
    const content = String(row?.content ?? legacyLabel)
    const note = String(row?.note ?? "")
    const kind = String(row?.kind ?? "")
    return {
      idCode: String(row?.idCode ?? row?.id ?? ""),
      company: String(row?.company ?? ""),
      amount: String(row?.amount ?? ""),
      content,
      note,
      kind: kind || (legacyLabel.includes("추가계약") || note.includes("추가계약") ? "additional-contract" : "manual"),
    }
  })
}

function getWeeklyAdditionalContractAmount(currentAmount: unknown) {
  return Math.max(0, toNumber(currentAmount))
}

function buildAutoRevenueHeader(unitPrice: unknown, selectedCount: number, additionalContractCount: unknown) {
  const baseUnitPrice = toNumber(unitPrice) || 6160000
  const bonusRevenue = Math.max(0, toNumber(additionalContractCount))
  const computedRevenue = baseUnitPrice * selectedCount + bonusRevenue
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
  const baseRows = normalizedRows.filter((row) => String(row?.label || "").trim() !== "합계")
  if (baseRows.length) {
    return baseRows.reduce((sum, row) => {
      const rowTotal = (row.months || []).reduce((rowSum: number, value: number) => rowSum + toNumber(value), 0)
      return sum + rowTotal
    }, 0)
  }
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
  const nonSalesRevenue = (totalMillions - salesMillions) * 1000000
  const cumulativeNetUnits = toNumber(summary?.cumulativeNetUnits)
  const baseUnitPrice = toNumber(unitPrice) || 6160000
  const cumulativeNetRevenue = cumulativeNetUnits * baseUnitPrice
  return `26년 순증 매출 (약 ${formatMoney(Math.round(nonSalesRevenue + cumulativeNetRevenue))})`
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
  return `※대당 연 ${formatNumber(baseUnitPrice)}원으로 매출을 산정${dateLabel} / 주간 순증 매출은 추가계약금액을 포함하며, 연간 순증 매출은 (누적순증 합계 × 단가) + ((합계 - 매출순증) × 1,000,000) 기준입니다. 연간 누적 매출은 총 계약대수 × 단가 기준이며 위약금 및 이전비는 월 단위로 계산하되 모든 금액 단위는 백만 원으로 표기.`
}

function getUpcomingThursday(baseDate = new Date()) {
  const next = new Date(baseDate)
  const day = next.getDay()
  const diff = (4 - day + 7) % 7 || 7
  next.setDate(next.getDate() + diff)
  return next
}

function formatDateDashed(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function shiftDashedDate(value: unknown, diffDays: number) {
  const text = String(value ?? "")
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return text
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return text
  date.setDate(date.getDate() + diffDays)
  return formatDateDashed(date)
}

function formatDateDotted(value: unknown) {
  const text = String(value ?? "")
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return text
  return `${match[1]}.${match[2]}.${match[3]}`
}

function formatDateDottedWithWeekday(value: unknown) {
  const text = String(value ?? "")
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return text
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return text
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"]
  return `${match[1]}.${match[2]}.${match[3]}(${weekdays[date.getDay()]})`
}

function calcHint(text: string) {
  return (
    <span
      title={text}
      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-bold text-slate-500 align-middle cursor-help"
      aria-label={text}
    >
      i
    </span>
  )
}

function buildRevenueDisplaySet(params: {
  revenueHeaderText?: unknown
  subtitleOne?: unknown
  subtitleTwo?: unknown
  revenueUnitPrice?: unknown
  additionalContractCount?: unknown
  additionalSales?: any[]
  manualSummary?: any
  revenueRows?: any[]
  fallbackSelectedCount?: number
}) {
  const selectedContractCount = Number(params.fallbackSelectedCount || 0)
  const weeklyAdditionalContractAmount = getWeeklyAdditionalContractAmount(params.additionalContractCount)
  const computedHeader = buildAutoRevenueHeader(
    params.revenueUnitPrice,
    selectedContractCount,
    weeklyAdditionalContractAmount,
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

function splitRevenueMetric(text: string, fallbackLabel: string) {
  const safeText = sanitizeText(text, "")
  const matched = safeText.match(/^(.*?)\s*(\(.+\))$/)
  if (matched) {
    const rawLabel = matched[1].trim()
    const label = fallbackLabel.includes("추정") ? fallbackLabel : (rawLabel || fallbackLabel)
    return {
      label,
      value: matched[2].trim().replace(/^\((.*)\)$/, "$1"),
    }
  }
  return {
    label: fallbackLabel,
    value: safeText,
  }
}

function splitRevenueNoteText(text: string) {
  const safeText = sanitizeText(text, "")
  const parts = safeText.split(" / ").map((part) => part.trim()).filter(Boolean)
  return {
    primary: parts[0] || safeText,
    secondary: parts[1] || "",
  }
}

function buildManualDraftFromWeekly(weekly: any, contracts: any[], paidOptionSourceColumns?: any[]) {
  const safeWeekly = weekly || {}
  const summary = safeWeekly.manualSummary || {}
  const includedContractCount = (contracts || []).filter((row: any) => row.includedInWeekly).length
  const revenueUnitPrice = toNumber(safeWeekly.revenueUnitPrice) || 6160000
  const additionalContractCount = toNumber(safeWeekly.additionalContractCount)
  const dynamicBaseDate = formatDateDashed(getUpcomingThursday())
  const revenueDisplay = buildRevenueDisplaySet({
    revenueHeaderText: safeWeekly.revenueHeaderText,
    subtitleOne: safeWeekly.subtitleOne,
    subtitleTwo: safeWeekly.subtitleTwo,
    revenueUnitPrice,
    additionalContractCount,
    additionalSales: safeWeekly.additionalSales || [],
    manualSummary: summary,
    revenueRows: safeWeekly.revenueRows || [],
    fallbackSelectedCount: includedContractCount,
  })
  const revenueNoteText = buildRevenueNoteText(dynamicBaseDate, revenueUnitPrice)

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
    paidOptionInfoColumns: cloneData(
      buildPaidOptionInfoColumns(
        Array.isArray(paidOptionSourceColumns) && paidOptionSourceColumns.length
          ? paidOptionSourceColumns
          : safeWeekly.paidOptionInfoColumns || [],
      ),
    ),
    terminationOverviewRows: cloneData(buildTerminationOverviewRows(safeWeekly.terminationOverviewRows || [])),
    weeklyIndustryOverviewRows: cloneData(buildWeeklyIndustryOverviewRows(safeWeekly.weeklyIndustryOverviewRows || [])),
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

function chunkIntoRows<T>(items: T[], targetRows: number) {
  if (!items.length) return []
  const safeRows = Math.max(1, targetRows)
  const chunkSize = Math.max(1, Math.ceil(items.length / safeRows))
  return chunkArray(items, chunkSize)
}

function buildFixedRowMatrix<T>(items: T[], rowCount: number, columnCount: number) {
  const safeRows = Math.max(1, rowCount)
  const safeColumns = Math.max(1, columnCount)
  const matrix = Array.from({ length: safeRows }, (_, rowIndex) =>
    items.slice(rowIndex * safeColumns, rowIndex * safeColumns + safeColumns),
  )
  return matrix
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

function SaveIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6.75 20.25h10.5A2.25 2.25 0 0 0 19.5 18V9.2a2.25 2.25 0 0 0-.66-1.59l-2.45-2.45a2.25 2.25 0 0 0-1.59-.66H6.75A2.25 2.25 0 0 0 4.5 6.75V18a2.25 2.25 0 0 0 2.25 2.25Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 4.5v5h7.25M8.25 16.25l2.25 2.25 5.25-5.75" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PdfIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M7 3.75h6.1L18 8.65v11.6H7A1.75 1.75 0 0 1 5.25 18.5v-13A1.75 1.75 0 0 1 7 3.75Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13 4v4.75h4.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 13.25h8v4.5H8v-4.5Z" fill="currentColor" />
      <path d="M9.05 16.65v-2.3h.9c.58 0 .96.32.96.82 0 .51-.38.84-.96.84h-.32v.64h-.58Zm.58-1.1h.25c.27 0 .42-.14.42-.37 0-.22-.15-.35-.42-.35h-.25v.72Zm1.62 1.1v-2.3h.84c.7 0 1.16.45 1.16 1.15 0 .7-.46 1.15-1.16 1.15h-.84Zm.58-.49h.2c.38 0 .62-.25.62-.66 0-.4-.24-.66-.62-.66h-.2v1.32Zm1.77.49v-2.3h1.6v.49h-1.02v.48h.9v.49h-.9v.84h-.58Z" fill="white" />
    </svg>
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
  currentUser,
  directoryUsers,
  permissions,
  onViewChange,
}: {
  initialData: any
  initialView?: ViewKey
  initialCollectionTab?: CollectionTabKey
  currentUser?: {
    id: string
    name: string
    role: string
    teamName: string
    avatarEmoji?: string | null
    color?: { bg: string; text: string; border: string; hex: string }
  } | null
  directoryUsers: DailyDirectoryUser[]
  permissions?: Record<string, Record<string, boolean>> | null
  onViewChange?: (view: ViewKey) => void
}) {
  const router = useRouter()
  const [data, setData] = useState<any>(initialData)
  const [view, setView] = useState<ViewKey>(initialView)
  const isContractsView = view === "contracts"
  const isWeeklySelectionView = view === "weekly-selection"
  const isCollectionView = view === "collection"
  const isTerminationView = view === "termination"
  const [collectionTab, setCollectionTab] = useState<CollectionTabKey>(initialCollectionTab)
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ dailyReport: true, performance: true, termination: true })
  const [isPending, startTransition] = useTransition()
  const [isAccountPending, startAccountTransition] = useTransition()
  const [dirtyViews, setDirtyViews] = useState<Partial<Record<ViewKey, boolean>>>({})
  const [isSavingDashboard, setIsSavingDashboard] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [isPresenceListOpen, setIsPresenceListOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [nextPassword, setNextPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([])
  const [popupMessages, setPopupMessages] = useState<PopupMessage[]>([])
  const [manualPresenceStatus, setManualPresenceStatus] = useState<"away" | null>(null)
  const [manualDraft, setManualDraft] = useState<any>(() =>
    buildManualDraftFromWeekly(
      initialData?.weeklyReport || {},
      initialData?.contracts || [],
      initialData?.paidOptionSourceColumns || initialData?.weeklyReport?.paidOptionInfoColumns || [],
    ),
  )
  const [manualPreviewDraft, setManualPreviewDraft] = useState<any | null>(null)
  const [manualRevenueHeaderEdited, setManualRevenueHeaderEdited] = useState(false)
  const [contractDraft, setContractDraft] = useState<any>({
    companyName: "",
    departmentName: "",
    idCode: "",
    industry: "국내증권",
    contractMonth: "",
    recommender: currentUser?.name || "",
    note: "",
    documentStatus: "미회수",
    replacementType: "신규",
  })
  const [contractCreateStatus, setContractCreateStatus] = useState<CreateStatus>("idle")
  const [terminationCreateStatus, setTerminationCreateStatus] = useState<CreateStatus>("idle")
  const [holdCreateStatus, setHoldCreateStatus] = useState<CreateStatus>("idle")
  const [editingContractId, setEditingContractId] = useState<string | null>(null)
  const [editingContractDraft, setEditingContractDraft] = useState<any>({})
  const [contractQuery, setContractQuery] = useState("")
  const [contractStatusFilter, setContractStatusFilter] = useState("all")
  const [contractReplacementFilter, setContractReplacementFilter] = useState("all")
  const [contractMonthFilter, setContractMonthFilter] = useState("all")
  const [contractSort, setContractSort] = useState<{
    key: ContractSortKey
    dir: "asc" | "desc"
  }>({
    key: "contractMonth",
    dir: "desc",
  })
  const [recentContractId, setRecentContractId] = useState<string | null>(null)
  const [recentTerminationId, setRecentTerminationId] = useState<string | null>(null)
  const [recentHoldId, setRecentHoldId] = useState<string | null>(null)
  const [weeklySelectionSort, setWeeklySelectionSort] = useState<{
    key:
      | "includedInWeekly"
      | "no"
      | "companyName"
      | "departmentName"
      | "idCode"
      | "industry"
      | "contractMonth"
      | "recommender"
      | "documentStatus"
      | "replacementType"
    dir: "asc" | "desc"
  }>({
    key: "no",
    dir: "asc",
  })
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null)
  const [editingCollectionDraft, setEditingCollectionDraft] = useState<any>({})
  const [collectionYearFilter, setCollectionYearFilter] = useState<number | "all">(getUpcomingThursday().getFullYear() || 2026)
  const [collectionStatusFilter, setCollectionStatusFilter] = useState<string>(initialData?.collection?.statusFilter || "all")
  const [collectionSort, setCollectionSort] = useState<{
    key: "year" | "companyName" | "departmentName" | "idCode" | "industry" | "claimMonth" | "receiptDate" | "reflectedDate" | "status"
    dir: "asc" | "desc"
  }>(initialData?.collection?.sort || { key: "year", dir: "desc" })
  const [dailyReportFocus, setDailyReportFocus] = useState<"today" | "status">("today")
  const [selectedDeliveryHistoryDate, setSelectedDeliveryHistoryDate] = useState<string>("")
  const [deliveryDraft, setDeliveryDraft] = useState<any>(null)
  const [historyStack, setHistoryStack] = useState<any[]>([])
  const pendingSaveRef = useRef<number | null>(null)
  const pendingDeliveryDraftSaveRef = useRef<number | null>(null)
  const deliveryDraftRef = useRef<any>(null)
  const isSyncingDeliveryDraftRef = useRef(false)
  const pendingPayloadRef = useRef<string | null>(null)
  const pendingDataRef = useRef<any | null>(null)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const localStorageCacheTimerRef = useRef<number | null>(null)
  const manualSaveTimerRef = useRef<number | null>(null)
  const lastHistoryAtRef = useRef<number>(0)
  const dirtyViewsRef = useRef<Partial<Record<ViewKey, boolean>>>({})
  const manualDraftRef = useRef<any>(manualDraft)
  const manualPreviewDraftRef = useRef<any | null>(manualPreviewDraft)
  const manualDraftReadyRef = useRef(false)
  const isSyncingManualDraftRef = useRef(false)
  const flushPendingSave = useRef<() => void>(() => {})
  const heartbeatIdRef = useRef(`conn-${Math.random().toString(36).slice(2, 10)}`)
  const lastActivityAtRef = useRef(Date.now())
  const dismissedPopupMessageIdsRef = useRef<Set<string>>(new Set())
  const hasAccess = (menuKey: string, action: string = "view") =>
    Boolean(permissions?.[menuKey]?.admin || permissions?.[menuKey]?.[action])
  const avatarLabel = String(currentUser?.avatarEmoji || "").trim() || String(currentUser?.name || "").slice(0, 1) || "사"
  const canViewDailyReport = hasAccess("dailyReport", "view")
  const canViewWeeklyReport = hasAccess("weeklyReport", "view")
  const canViewManualInput = hasAccess("manualInput", "view")
  const canEditManualInput = hasAccess("manualInput", "edit")
  const canViewContracts = hasAccess("newContractsList", "view")
  const canCreateContracts = hasAccess("newContractsList", "edit")
  const canEditContracts = hasAccess("newContractsList", "edit")
  const canDeleteContracts = hasAccess("newContractsList", "edit")
  const canViewCollections = hasAccess("collectionManagement", "view")
  const canViewTermination = hasAccess("terminationManagement", "view")
  const canViewWeeklySelection = hasAccess("weeklySelection", "view")
  const canViewOptionDashboard = hasAccess("optionDashboard", "view")
  const canViewAdminPage =
    hasAccess("adminPage", "view") ||
    hasAccess("storageManagement", "view") ||
    hasAccess("userManagement", "view") ||
    hasAccess("teamManagement", "view") ||
    hasAccess("permissionManagement", "view") ||
    hasAccess("permissionAuditLog", "view") ||
    hasAccess("activityLog", "view")
  const currentPresenceStatus = useMemo<PresenceStatus>(() => {
    if (!currentUser?.id) return "offline"
    return presenceUsers.find((user) => user.userId === currentUser.id)?.status || "offline"
  }, [currentUser?.id, presenceUsers])
  const activePresenceUsers = useMemo(
    () => presenceUsers.filter((user) => user.status !== "offline"),
    [presenceUsers],
  )
  const visiblePresenceUsers = useMemo(() => activePresenceUsers.slice(0, 5), [activePresenceUsers])
  const hiddenPresenceCount = Math.max(0, activePresenceUsers.length - visiblePresenceUsers.length)
  const visibleViews = [
    canViewDailyReport ? "daily-report" : null,
    canViewWeeklyReport ? "weekly-report" : null,
    canViewManualInput ? "manual-input" : null,
    canViewContracts ? "contracts" : null,
    canViewWeeklySelection ? "weekly-selection" : null,
    canViewCollections ? "collection" : null,
    canViewOptionDashboard ? "option-dashboard" : null,
    canViewTermination ? "termination" : null,
  ].filter(Boolean) as ViewKey[]

  function updateManualDraft(updater: any) {
    const previous = manualDraftRef.current || manualDraft
    const next = typeof updater === "function" ? updater(previous) : updater
    manualDraftRef.current = next
    setManualDraft(next)
  }

  function updateManualPreviewDraft(updater: any) {
    markManualInputDirty()
    const source = manualPreviewDraftRef.current || manualDraftRef.current || manualDraft
    const next = typeof updater === "function" ? updater(source) : updater
    manualPreviewDraftRef.current = next
    setManualPreviewDraft(next)
  }

  function updateManualLiveDraft(updater: any) {
    markManualInputDirty()
    const source = manualPreviewDraftRef.current || manualDraftRef.current || manualDraft
    const next = typeof updater === "function" ? updater(source) : updater
    manualDraftRef.current = next
    setManualDraft(next)
    manualPreviewDraftRef.current = next
    setManualPreviewDraft(next)
  }

  function previewManualField(field: string, value: string) {
    if (field === "revenueUnitPrice" || field === "additionalContractCount") {
      const digitsOnly = String(value ?? "").replace(/[^\d]/g, "")
      updateManualPreviewDraft((prev: any) => ({ ...prev, [field]: digitsOnly }))
      return
    }
    updateManualPreviewDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function previewManualSummaryField(field: string, value: string) {
    updateManualPreviewDraft((prev: any) => ({
      ...prev,
      manualSummary: { ...prev.manualSummary, [field]: value },
    }))
  }

  function previewManualRevenueCell(rowIndex: number, monthIndex: number, value: string) {
    updateManualLiveDraft((prev: any) => {
      const revenueRows = cloneData(prev.revenueRows || [])
      if (!revenueRows[rowIndex]) return prev
      if (!Array.isArray(revenueRows[rowIndex].months)) revenueRows[rowIndex].months = Array(12).fill(0)
      revenueRows[rowIndex].months[monthIndex] = value
      return { ...prev, revenueRows }
    })
  }

  function previewManualTerminationOverviewCell(rowIndex: number, valueIndex: number, value: string) {
    updateManualPreviewDraft((prev: any) => {
      const terminationOverviewRows = cloneData(prev.terminationOverviewRows || [])
      if (!terminationOverviewRows[rowIndex]) return prev
      if (!Array.isArray(terminationOverviewRows[rowIndex].values)) terminationOverviewRows[rowIndex].values = []
      terminationOverviewRows[rowIndex].values[valueIndex] = value
      return { ...prev, terminationOverviewRows }
    })
  }

  function previewManualWeeklyIndustryOverviewCell(rowIndex: number, valueIndex: number, value: string) {
    if (valueIndex >= reportIndustryColumnsStatic.length - 1) return
    updateManualLiveDraft((prev: any) => {
      const weeklyIndustryOverviewRows = cloneData(prev.weeklyIndustryOverviewRows || [])
      if (!weeklyIndustryOverviewRows[rowIndex]) return prev
      weeklyIndustryOverviewRows[rowIndex].values = normalizeIndustryRowValues(weeklyIndustryOverviewRows[rowIndex].values)
      weeklyIndustryOverviewRows[rowIndex].values[valueIndex] = value
      weeklyIndustryOverviewRows[rowIndex].values = buildIndustryRowValuesWithTotal(weeklyIndustryOverviewRows[rowIndex].values)
      return { ...prev, weeklyIndustryOverviewRows }
    })
  }

  function previewAdditionalSaleRow(rowIndex: number, field: string, value: string) {
    updateManualPreviewDraft((prev: any) => {
      const additionalSales = normalizeAdditionalSalesRows(cloneData(prev.additionalSales || [])) as Array<Record<string, string>>
      additionalSales[rowIndex][field] = value
      return { ...prev, additionalSales }
    })
  }

  function applyAdditionalSalesDraft(
    updater: (
      rows: Array<Record<string, string>>,
      sourceDraft: any,
    ) => Array<Record<string, string>> | { rows: any[]; draftPatch?: Record<string, unknown> },
  ) {
    markManualInputDirty()
    const sourceDraft = manualPreviewDraftRef.current || manualDraftRef.current || manualDraft
    const sourceRows = normalizeAdditionalSalesRows(cloneData(sourceDraft.additionalSales || [])) as Array<Record<string, string>>
    const result = updater(sourceRows, sourceDraft)
    const nextRows = normalizeAdditionalSalesRows(Array.isArray(result) ? result : result.rows)
    const nextDraft = {
      ...sourceDraft,
      ...(!Array.isArray(result) ? result.draftPatch || {} : {}),
      additionalSales: nextRows,
    }
    manualDraftRef.current = nextDraft
    setManualDraft(nextDraft)
    manualPreviewDraftRef.current = nextDraft
    setManualPreviewDraft(nextDraft)
  }

  const [terminationEntryMode, setTerminationEntryMode] = useState<"termination" | "hold">("termination")
  const [terminationDraft, setTerminationDraft] = useState<any>({
    receivedDate: toInputDate(new Date().toISOString().slice(0, 10)),
    manager: currentUser?.name || "",
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
    manager: currentUser?.name || "",
    customerId: "",
    companyName: "",
    departmentName: "",
    reason: "사용자퇴사",
    reasonDetail: "",
    startDate: "",
    endDate: "",
    note: "",
  })
  const [terminationSort, setTerminationSort] = useState<{
    key:
      | "receivedDate"
      | "terminationDate"
      | "manager"
      | "customerId"
      | "companyName"
      | "departmentName"
      | "reason"
      | "penalty"
    dir: "asc" | "desc"
  }>({
    key: "terminationDate",
    dir: "desc",
  })
  const [terminationQuery, setTerminationQuery] = useState("")
  const [terminationReasonFilter, setTerminationReasonFilter] = useState("all")
  const [terminationDateFilter, setTerminationDateFilter] = useState("all")
  const [holdSort, setHoldSort] = useState<{ key: "receivedDate" | "startDate" | "endDate"; dir: "asc" | "desc" }>({
    key: "receivedDate",
    dir: "desc",
  })
  const [editingTerminationId, setEditingTerminationId] = useState<string | null>(null)
  const [editingTerminationDraft, setEditingTerminationDraft] = useState<any>({})
  const [editingHoldId, setEditingHoldId] = useState<string | null>(null)
  const [editingHoldDraft, setEditingHoldDraft] = useState<any>({})
  const [showTerminationArchive, setShowTerminationArchive] = useState(false)
  const [selectedConfirmedIds, setSelectedConfirmedIds] = useState<string[]>([])
  const [selectedHoldIds, setSelectedHoldIds] = useState<string[]>([])
  const [selectedReleasedIds, setSelectedReleasedIds] = useState<string[]>([])
  const [holdReceivedDateFilter, setHoldReceivedDateFilter] = useState("all")
  const [holdEndDateFilter, setHoldEndDateFilter] = useState("all")
  const [holdQuery, setHoldQuery] = useState("")

  const weeklyReport = data.weeklyReport || {}
  const dailyReportDate = getSeoulTodayKey()
  const normalizedDailyReport = useMemo(
    () => normalizeDailyReportState(data.dailyReport || createEmptyDailyReportState(), directoryUsers || [], dailyReportDate),
    [data.dailyReport, directoryUsers, dailyReportDate],
  )
  const contracts = data.contracts || []
  const collection = data.collection || { integrated: [], longTerm: [] }
  const termination = data.termination || { sheets: [], currentSheetId: undefined }
  const currentYear = getUpcomingThursday().getFullYear() || data.currentYear || new Date().getFullYear()
  const availableYears = data.availableYears || data.years || []
  const paidOptionSourceColumns = useMemo(
    () => buildPaidOptionInfoColumns(data.paidOptionSourceColumns || weeklyReport.paidOptionInfoColumns || []),
    [data.paidOptionSourceColumns, weeklyReport.paidOptionInfoColumns],
  )

  const selectedSheet = useMemo(
    () => termination.sheets?.[0] || null,
    [termination.sheets],
  )
  const normalizedTerminationOnceRef = useRef(false)
  const previousViewRef = useRef<ViewKey | null>(null)

  useEffect(() => {
    router.prefetch("/me")
  }, [router])

  useEffect(() => {
    if (normalizedTerminationOnceRef.current) return
    if (!termination.sheets || termination.sheets.length === 0) return
    const needsPrune = termination.sheets.length > 1
    let needsManagerBackfill = false
    const normalizedSheets = (termination.sheets || []).map((sheet: any) => {
      const result = backfillTerminationSheetManagers(sheet)
      if (result.changed) needsManagerBackfill = true
      return result.sheet
    })
    if (!needsPrune && !needsManagerBackfill) {
      normalizedTerminationOnceRef.current = true
      return
    }
    normalizedTerminationOnceRef.current = true
    const nextActiveSheet = normalizedSheets[0]
    startTransition(async () => {
      await persist({
        ...data,
        termination: {
          ...termination,
          currentSheetId: nextActiveSheet.id,
          sheets: needsPrune ? [nextActiveSheet] : normalizedSheets,
        },
      })
    })
  }, [data, termination, startTransition])
  useEffect(() => {
    const previousView = previousViewRef.current
    if (view === "collection" && previousView !== "collection" && collectionTab === "integrated") {
      setCollectionYearFilter(2026)
      setCollectionStatusFilter("all")
    }
    previousViewRef.current = view
  }, [view, collectionTab])
  const includedContracts = useMemo(() => contracts.filter((row: any) => row.includedInWeekly), [contracts])
  useEffect(() => {
    if (!currentUser?.name) return
    setContractDraft((prev: any) => ({ ...prev, recommender: currentUser.name }))
  }, [currentUser?.name])
  useEffect(() => {
    if (!currentUser?.name) return
    setTerminationDraft((prev: any) => (prev.manager ? prev : { ...prev, manager: currentUser.name }))
    setHoldDraft((prev: any) => (prev.manager ? prev : { ...prev, manager: currentUser.name }))
  }, [currentUser?.name])
  useEffect(() => {
    if (visibleViews.includes(view)) return
    if (visibleViews.length) setView(visibleViews[0])
  }, [view, visibleViews])
  useEffect(() => {
    onViewChange?.(view)
  }, [onViewChange, view])
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [view])
  useEffect(() => {
    if (!currentUser?.id) return
    let alive = true
    let eventSource: EventSource | null = null
    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null

    const markActivity = () => {
      if (manualPresenceStatus === "away") return
      lastActivityAtRef.current = Date.now()
    }

    const sendHeartbeat = async () => {
      if (document.visibilityState === "hidden") return
      try {
        await fetch("/api/presence/heartbeat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            currentPage: viewTitles[view],
            currentSection: view,
            connectionId: heartbeatIdRef.current,
            manualStatus: manualPresenceStatus,
            lastActivityAt: new Date(lastActivityAtRef.current).toISOString(),
          }),
        })
      } catch {
        // Ignore transient heartbeat issues in sidebar presence UI.
      }
    }

    const connect = () => {
      if (eventSource) return
      if (document.visibilityState === "hidden") return
      eventSource = new EventSource("/api/presence/stream")
      eventSource.onmessage = (event) => {
        if (!alive) return
        try {
          const payload = JSON.parse(event.data)
          setPresenceUsers(Array.isArray(payload?.presenceUsers) ? payload.presenceUsers : [])
          const nextPopupMessages = Array.isArray(payload?.popupMessages)
            ? payload.popupMessages.filter((message: PopupMessage) => !dismissedPopupMessageIdsRef.current.has(message.id))
            : []
          setPopupMessages(nextPopupMessages)
        } catch {
          setPresenceUsers([])
          setPopupMessages([])
        }
      }
      eventSource.onerror = () => {
        eventSource?.close()
        eventSource = null
      }
    }

    const handleActivity = () => {
      markActivity()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markActivity()
        void sendHeartbeat()
        if (!eventSource || eventSource.readyState === EventSource.CLOSED) connect()
      } else {
        eventSource?.close()
        eventSource = null
      }
    }

    if (manualPresenceStatus !== "away") {
      lastActivityAtRef.current = Date.now()
    }

    const scheduleHeartbeat = () => {
      if (!alive) return
      heartbeatTimer = setTimeout(() => {
        if (!alive) return
        if (document.visibilityState !== "hidden") void sendHeartbeat()
        scheduleHeartbeat()
      }, getPresenceHeartbeatIntervalMs())
    }

    const activityEvents: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"]
    activityEvents.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }))
    document.addEventListener("visibilitychange", handleVisibilityChange)

    void sendHeartbeat()
    scheduleHeartbeat()
    connect()

    return () => {
      alive = false
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, handleActivity))
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (heartbeatTimer) clearTimeout(heartbeatTimer)
      if (eventSource) eventSource.close()
    }
  }, [currentUser?.id, manualPresenceStatus, view])

  const handleLogout = () => {
    startAccountTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null)
      window.location.replace("/")
    })
  }
  const handlePasswordChange = () => {
    setPasswordMessage("")
    if (!currentPassword || !nextPassword || !confirmPassword) {
      setPasswordMessage("비밀번호 항목을 모두 입력해주세요.")
      return
    }
    if (nextPassword !== confirmPassword) {
      setPasswordMessage("새 비밀번호 확인이 일치하지 않습니다.")
      return
    }

    startAccountTransition(async () => {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, nextPassword }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        setPasswordMessage(payload?.error || "비밀번호 변경에 실패했습니다.")
        return
      }
      setCurrentPassword("")
      setNextPassword("")
      setConfirmPassword("")
      setPasswordMessage("비밀번호가 변경되었습니다.")
      setTimeout(() => setIsPasswordOpen(false), 700)
    })
  }
  const weeklyTerminationAutoCount = useMemo(
    () => (selectedSheet?.items || []).filter((row: any) => Boolean(row?.selected)).length,
    [selectedSheet],
  )
  const weeklyNewContractAutoCount = includedContracts.length
  const weeklyNetAutoCount = weeklyNewContractAutoCount - weeklyTerminationAutoCount
  const applyWeeklyAutoSummary = (summary: any = {}) => {
    const nextSummary = {
      ...summary,
      weeklyNetUnits: weeklyNetAutoCount,
      weeklyNewContracts: weeklyNewContractAutoCount,
      weeklyTerminationContracts: weeklyTerminationAutoCount,
    }
    nextSummary.newContractTotal = toNumber(nextSummary.competitorReplacement) + toNumber(nextSummary.newReplacement)
    nextSummary.holdTotal = toNumber(nextSummary.holdPending) + toNumber(nextSummary.billingHold)
    nextSummary.terminationTypeTotal = toNumber(nextSummary.contractTermination) + toNumber(nextSummary.competitorTermination)
    return nextSummary
  }
  const contractStatusOptions = useMemo(() => {
    const values = new Set<string>()
    contracts.forEach((row: any) => {
      if (row?.documentStatus) values.add(String(row.documentStatus))
    })
    return ["all", ...Array.from(values)]
  }, [contracts])
  const contractReplacementOptions = useMemo(() => {
    const values = new Set<string>()
    contracts.forEach((row: any) => {
      if (row?.replacementType) values.add(String(row.replacementType))
    })
    return ["all", ...Array.from(values)]
  }, [contracts])
  const contractMonthOptions = useMemo(() => {
    const values = new Set<string>()
    contracts.forEach((row: any) => {
      if (row?.contractMonth) values.add(String(row.contractMonth))
    })
    return ["all", ...Array.from(values).sort((a, b) => parseContractMonthKey(b) - parseContractMonthKey(a))]
  }, [contracts])
  const filteredContracts = useMemo(() => {
    const rawQuery = contractQuery.trim()
    const query = rawQuery.toLowerCase()
    const identifierQuery = normalizeSearchIdentifier(rawQuery)
    return contracts.filter((row: any) => {
      if (contractStatusFilter !== "all" && row.documentStatus !== contractStatusFilter) return false
      if (contractReplacementFilter !== "all" && (row.replacementType || "신규") !== contractReplacementFilter) return false
      if (contractMonthFilter !== "all" && row.contractMonth !== contractMonthFilter) return false
      if (!query && !identifierQuery) return true
      return getContractSearchText(row)
        .filter(Boolean)
        .some((value) => matchesSearchQuery(value, query, identifierQuery))
    })
  }, [contracts, contractQuery, contractStatusFilter, contractReplacementFilter, contractMonthFilter])
  const sortedContracts = useMemo(
    () => sortContractsByKey(filteredContracts, contractSort.key, contractSort.dir),
    [filteredContracts, contractSort],
  )
  const sortedWeeklySelectionContracts = useMemo(
    () => (isWeeklySelectionView ? sortByKey(contracts, weeklySelectionSort.key, weeklySelectionSort.dir) : []),
    [contracts, weeklySelectionSort, isWeeklySelectionView],
  )

  useEffect(() => {
    if (manualRevenueHeaderEdited) return
    const nextHeader = buildAutoRevenueHeader(
      manualDraft.revenueUnitPrice,
      weeklyNetAutoCount,
      getWeeklyAdditionalContractAmount(manualDraft.additionalContractCount),
    )
    updateManualDraft((prev: any) => (
      prev.revenueHeaderText === nextHeader
        ? prev
        : { ...prev, revenueHeaderText: nextHeader }
    ))
  }, [manualDraft.additionalContractCount, manualDraft.revenueUnitPrice, manualRevenueHeaderEdited, weeklyNetAutoCount])

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
    updateManualDraft((prev: any) => {
      if (prev.subtitleOne === nextSubtitleOne && prev.subtitleTwo === nextSubtitleTwo) return prev
      return {
        ...prev,
        subtitleOne: nextSubtitleOne,
        subtitleTwo: nextSubtitleTwo,
      }
    })
  }, [
    manualDraft.revenueRows,
    manualDraft.manualSummary?.cumulativeNetUnits,
    manualDraft.manualSummary?.totalContracts,
    manualDraft.revenueUnitPrice,
  ])

  useEffect(() => {
    if (dirtyViewsRef.current["manual-input"]) return
    isSyncingManualDraftRef.current = true
    updateManualDraft(buildManualDraftFromWeekly(weeklyReport, contracts, paidOptionSourceColumns))
    setManualRevenueHeaderEdited(false)
  }, [weeklyReport, contracts, paidOptionSourceColumns])

  const contractMonthStats = useMemo(() => {
    if (!isContractsView) return []
    const currentYearNumber = Number(currentYear) || 2026
    const monthCounts = new Map<number, number>()
    const years = new Set<number>([currentYearNumber])
    contracts.forEach((row: any) => {
      const month = String(row.contractMonth || "").trim() || "미입력"
      const parsed = parseContractMonthParts(month)
      if (parsed && parsed.year >= currentYearNumber) {
        years.add(parsed.year)
        const key = parsed.year * 100 + parsed.month
        monthCounts.set(key, (monthCounts.get(key) || 0) + 1)
      }
    })
    return [...years]
      .sort((a, b) => a - b)
      .flatMap((year) =>
        Array.from({ length: 12 }, (_, index) => {
          const month = index + 1
          const key = year * 100 + month
          return {
            label: `${String(year).slice(-2)}년 ${month}월`,
            count: monthCounts.get(key) || 0,
            sortKey: key,
          }
        }),
      )
  }, [contracts, currentYear, isContractsView])
  const currentMonthKey = useMemo(() => {
    const now = new Date()
    return now.getFullYear() * 100 + (now.getMonth() + 1)
  }, [])
  const contractRecommenderStats = useMemo(() => {
    if (!isContractsView) return []
    const map = new Map<string, number>()
    contracts.forEach((row: any) => {
      const name = String(row.recommender || "").trim() || "미입력"
      map.set(name, (map.get(name) || 0) + 1)
    })
    const preferredOrder = [
      "이상철",
      "신무길",
      "이홍민",
      "정효준",
      "조홍희",
      "정진영",
      "박혜리",
      "기타",
    ]
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => {
        const ai = preferredOrder.indexOf(a.label)
        const bi = preferredOrder.indexOf(b.label)
        if (ai >= 0 || bi >= 0) {
          return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999)
        }
        return a.label.localeCompare(b.label, "ko")
      })
  }, [contracts, isContractsView])
  const contractStatsRowCount = useMemo(() => (contractMonthStats.length > 12 ? 3 : 2), [contractMonthStats.length])
  const contractMonthColumns = contractStatsRowCount === 3 ? 8 : 6
  const contractRecommenderColumns = contractStatsRowCount === 3 ? 3 : 4
  const contractMonthRows = useMemo(
    () => buildFixedRowMatrix(contractMonthStats, contractStatsRowCount, contractMonthColumns),
    [contractMonthStats, contractStatsRowCount, contractMonthColumns],
  )
  const contractRecommenderRows = useMemo(
    () => buildFixedRowMatrix(contractRecommenderStats, contractStatsRowCount, contractRecommenderColumns),
    [contractRecommenderStats, contractStatsRowCount, contractRecommenderColumns],
  )
  const collectionRows = useMemo(
    () => (collectionTab === "long-term" ? collection.longTerm || [] : collectionTab === "delivery" ? [] : collection.integrated || []),
    [collection, collectionTab],
  )
  const collectionDelivery = useMemo(() => {
    const raw = collection?.delivery || {}
    const normalizeDeliveryRow = (row: any, index: number, prefix = "delivery-row-seed") => ({
      id: row?.id || `${prefix}-${index + 1}`,
      companyName: String(row?.companyName || ""),
      departmentName: String(row?.departmentName || ""),
      idCode: String(row?.idCode || ""),
      recommender: String(row?.recommender || ""),
      contractMonth: String(row?.contractMonth || ""),
      recoveredCount: String(row?.recoveredCount || ""),
      note: String(row?.note || ""),
    })
    const rows = Array.isArray(raw.rows) ? raw.rows : []
    const normalizedRows = rows.map((row: any, index: number) => normalizeDeliveryRow(row, index))
    const rawHistory = Array.isArray(raw.history) ? raw.history : []
    const normalizedHistory = rawHistory
      .map((entry: any, entryIndex: number) => {
        const historyRows = Array.isArray(entry?.rows) ? entry.rows : []
        const deliveredDate = normalizeDate(entry?.deliveredDate || entry?.date || "")
        return {
          id: String(entry?.id || `delivery-history-${entryIndex + 1}`),
          deliveredDate,
          title: String(entry?.title || raw?.title || `${currentYear}년 고객업무팀 계약서 전달 리스트`),
          managerConfirm: String(entry?.managerConfirm || ""),
          senderConfirm: String(entry?.senderConfirm || ""),
          savedAt: String(entry?.savedAt || entry?.updatedAt || ""),
          rows: historyRows.map((row: any, rowIndex: number) =>
            normalizeDeliveryRow(row, rowIndex, `delivery-history-${entryIndex + 1}-row`),
          ),
        }
      })
      .filter((entry: any) => Boolean(entry.deliveredDate))
      .sort((a: any, b: any) => {
        const dateDiff = parseDateKey(b.deliveredDate) - parseDateKey(a.deliveredDate)
        if (dateDiff !== 0) return dateDiff
        return String(b.savedAt || "").localeCompare(String(a.savedAt || ""), "ko")
      })
    const fallbackDate = normalizeDate(weeklyReport?.baseDate || new Date().toISOString().slice(0, 10))
    return {
      title: String(raw.title || `${currentYear}년 고객업무팀 계약서 전달 리스트`),
      deliveredDate: String(raw.deliveredDate || fallbackDate),
      managerConfirm: String(raw.managerConfirm || ""),
      senderConfirm: String(raw.senderConfirm || ""),
      rows: normalizedRows,
      history: normalizedHistory,
    }
  }, [collection?.delivery, currentYear, weeklyReport?.baseDate])
  const cloneCollectionDeliveryState = (source: any) => ({
    title: String(source?.title || `${currentYear}년 고객업무팀 계약서 전달 리스트`),
    deliveredDate: String(source?.deliveredDate || ""),
    managerConfirm: String(source?.managerConfirm || ""),
    senderConfirm: String(source?.senderConfirm || ""),
    rows: Array.isArray(source?.rows)
      ? source.rows.map((row: any, index: number) => ({
          id: row?.id || `delivery-row-${index + 1}`,
          companyName: String(row?.companyName || ""),
          departmentName: String(row?.departmentName || ""),
          idCode: String(row?.idCode || ""),
          recommender: String(row?.recommender || ""),
          contractMonth: String(row?.contractMonth || ""),
          recoveredCount: String(row?.recoveredCount || ""),
          note: String(row?.note || ""),
        }))
      : [],
    history: Array.isArray(source?.history) ? source.history.map((entry: any) => ({ ...entry })) : [],
  })
  const collectionDeliverySignature = useMemo(() => JSON.stringify(collectionDelivery), [collectionDelivery])
  useEffect(() => {
    deliveryDraftRef.current = deliveryDraft
  }, [deliveryDraft])
  useEffect(() => {
    if (collectionTab === "delivery" && deliveryDraftRef.current) return
    isSyncingDeliveryDraftRef.current = true
    setDeliveryDraft(cloneCollectionDeliveryState(collectionDelivery))
  }, [collectionDeliverySignature, collectionTab])
  useEffect(() => {
    if (collectionTab !== "delivery" || !deliveryDraft) return
    if (isSyncingDeliveryDraftRef.current) {
      isSyncingDeliveryDraftRef.current = false
      return
    }
    if (pendingDeliveryDraftSaveRef.current) {
      window.clearTimeout(pendingDeliveryDraftSaveRef.current)
    }
    pendingDeliveryDraftSaveRef.current = window.setTimeout(() => {
      void persistCollectionDelivery(cloneCollectionDeliveryState(deliveryDraft))
    }, 500)
    return () => {
      if (pendingDeliveryDraftSaveRef.current) {
        window.clearTimeout(pendingDeliveryDraftSaveRef.current)
      }
    }
  }, [collectionTab, deliveryDraft])
  const activeCollectionDelivery = deliveryDraft || collectionDelivery
  const deliveryHistoryOptions = useMemo(() => {
    const byDate = new Map<string, any>()
    ;(collectionDelivery.history || []).forEach((entry: any) => {
      const dateKey = normalizeDate(entry.deliveredDate)
      if (!dateKey) return
      const existing = byDate.get(dateKey)
      if (!existing) {
        byDate.set(dateKey, entry)
        return
      }
      const existingSavedAt = String(existing.savedAt || "")
      const nextSavedAt = String(entry.savedAt || "")
      if (nextSavedAt.localeCompare(existingSavedAt, "ko") > 0) byDate.set(dateKey, entry)
    })
    return [...byDate.entries()]
      .sort((a, b) => parseDateKey(b[0]) - parseDateKey(a[0]))
      .map(([date, entry]) => ({ value: date, label: date, entry }))
  }, [collectionDelivery.history])
  useEffect(() => {
    if (!deliveryHistoryOptions.length) {
      setSelectedDeliveryHistoryDate("")
      return
    }
    setSelectedDeliveryHistoryDate((prev) =>
      prev && deliveryHistoryOptions.some((item) => item.value === prev)
        ? prev
        : deliveryHistoryOptions[0].value,
    )
  }, [deliveryHistoryOptions])
  const filteredCollectionRows = useMemo(() => {
    if (!isCollectionView) return []
    return collectionRows.filter((row: any) => {
      const yearOk = collectionYearFilter === "all" ? true : Number(row.year) === Number(collectionYearFilter)
      const statusOk = collectionStatusFilter === "all" ? true : (row.status || "미정") === collectionStatusFilter
      return yearOk && statusOk
    })
  }, [collectionRows, collectionStatusFilter, collectionYearFilter, isCollectionView])
  const sortedCollectionRows = useMemo(
    () => (isCollectionView ? sortByKey(filteredCollectionRows, collectionSort.key, collectionSort.dir) : []),
    [filteredCollectionRows, collectionSort, isCollectionView],
  )
  const collectionIndustrySummary = useMemo(() => {
    if (!isCollectionView) return []
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
  }, [collectionRows, collectionYearFilter, isCollectionView])
  const collectionIndustryMatrix = useMemo(() => {
    if (!isCollectionView) {
      return {
        headers: [],
        rows: [],
      }
    }
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
  }, [collectionIndustrySummary, isCollectionView])
  const collectionTableColumns = [
    { label: "No." },
    { label: "연도", key: "year" as const },
    { label: "회사명", key: "companyName" as const },
    { label: "부서명", key: "departmentName" as const },
    { label: "ID", key: "idCode" as const },
    { label: "업종", key: "industry" as const },
    { label: "청구월", key: "claimMonth" as const },
    { label: "회수일", key: "receiptDate" as const },
    { label: "반영일", key: "reflectedDate" as const },
    { label: "상태", key: "status" as const },
    { label: "작업" },
  ]
  const getCollectionSortMark = (
    key: "year" | "companyName" | "departmentName" | "idCode" | "industry" | "claimMonth" | "receiptDate" | "reflectedDate" | "status",
  ) => {
    if (collectionSort.key !== key) return ""
    return collectionSort.dir === "asc" ? " ▲" : " ▼"
  }
  const filteredTerminationItemsBase = useMemo(() => {
    if (!isTerminationView) return []
    const rawQuery = terminationQuery.trim()
    const query = rawQuery.toLowerCase()
    const identifierQuery = normalizeSearchIdentifier(rawQuery)
    const rows = selectedSheet?.items || []
    const isSearching = Boolean(query || identifierQuery)
    return rows.filter((row: any) => {
      if (!isSearching && terminationSort.key === "terminationDate" && !String(row.terminationDate || "").trim()) {
        return false
      }
      if (terminationDateFilter !== "all" && normalizeDate(row.terminationDate) !== terminationDateFilter) {
        return false
      }
      if (terminationReasonFilter !== "all") {
        if (terminationReasonFilter === "기타") {
          if (!String(row.reason || "").includes("기타")) return false
        } else {
          const normalized = normalizeTerminationReason(row.reason)
          if (normalized !== terminationReasonFilter) return false
        }
      }
      if (!query && !identifierQuery) return true
      return getTerminationSearchText(row)
        .filter(Boolean)
        .some((value) => matchesSearchQuery(value, query, identifierQuery))
      })
    }, [selectedSheet, terminationQuery, terminationReasonFilter, terminationDateFilter, terminationSort.key, isTerminationView])
  const terminationReasonOptions = useMemo(() => {
    const base = reportTerminationColumnsStatic.slice(0, -1)
    return ["all", ...base, "기타"]
  }, [])
    const terminationDateOptions = useMemo(() => {
      if (!isTerminationView) return ["all"]
      const dates = new Set<string>()
      ;(selectedSheet?.items || []).forEach((row: any) => {
        const value = normalizeDate(row.terminationDate)
        if (value) dates.add(value)
      })
      return ["all", ...Array.from(dates).sort().reverse()]
    }, [selectedSheet, isTerminationView])
    const terminationItems = useMemo(
      () => (isTerminationView ? sortByKey(filteredTerminationItemsBase, terminationSort.key, terminationSort.dir) : []),
      [filteredTerminationItemsBase, terminationSort, isTerminationView],
    )
    const holdItems = useMemo(
      () => (isTerminationView ? sortByKey(selectedSheet?.holdItems || [], holdSort.key, holdSort.dir) : []),
      [selectedSheet, holdSort, isTerminationView],
    )
    const filteredHoldItems = useMemo(() => {
      if (!isTerminationView) return []
      const rawQuery = holdQuery.trim()
      const query = rawQuery.toLowerCase()
      const identifierQuery = normalizeSearchIdentifier(rawQuery)
      return holdItems.filter((row: any) => {
        if (holdReceivedDateFilter !== "all" && normalizeDate(row.receivedDate) !== holdReceivedDateFilter) return false
        if (holdEndDateFilter !== "all" && normalizeDate(row.endDate) !== holdEndDateFilter) return false
        if (!query && !identifierQuery) return true
        return [row.companyName, row.departmentName, row.customerId, row.idCode, row.id, row.manager, row.reason, row.note]
          .filter(Boolean)
          .some((value) => matchesSearchQuery(value, query, identifierQuery))
      })
    }, [holdItems, holdReceivedDateFilter, holdEndDateFilter, holdQuery, isTerminationView])
    const holdReceivedDateOptions = useMemo(() => {
      if (!isTerminationView) return ["all"]
      const dates = new Set<string>()
      holdItems.forEach((row: any) => {
        const value = normalizeDate(row.receivedDate)
        if (value) dates.add(value)
      })
      return ["all", ...Array.from(dates).sort().reverse()]
    }, [holdItems, isTerminationView])
    const holdEndDateOptions = useMemo(() => {
      if (!isTerminationView) return ["all"]
      const dates = new Set<string>()
      holdItems.forEach((row: any) => {
        const value = normalizeDate(row.endDate)
        if (value) dates.add(value)
      })
      return ["all", ...Array.from(dates).sort().reverse()]
    }, [holdItems, isTerminationView])
    const confirmedTerminationItems = useMemo(
      () => (isTerminationView ? sortByKey(selectedSheet?.confirmedItems || [], terminationSort.key, terminationSort.dir) : []),
      [selectedSheet, terminationSort, isTerminationView],
    )
    const releasedHoldItems = useMemo(
      () => (isTerminationView ? sortByKey(selectedSheet?.releasedHoldItems || [], holdSort.key, holdSort.dir) : []),
      [selectedSheet, holdSort, isTerminationView],
    )
  useEffect(() => {
    setSelectedConfirmedIds((prev) => prev.filter((id) => confirmedTerminationItems.some((row: any) => row.id === id)))
  }, [confirmedTerminationItems])

  useEffect(() => {
    setSelectedHoldIds((prev) => prev.filter((id) => filteredHoldItems.some((row: any) => row.id === id)))
  }, [filteredHoldItems])

  useEffect(() => {
    setSelectedReleasedIds((prev) => prev.filter((id) => releasedHoldItems.some((row: any) => row.id === id)))
  }, [releasedHoldItems])
  const visibleWeeklyTerminationCount = useMemo(
    () => (selectedSheet?.items || []).length,
    [selectedSheet],
  )
  const visibleWeeklyBillingHoldCount = useMemo(
    () => (selectedSheet?.holdItems || []).length,
    [selectedSheet],
  )
  const reasonSummary = useMemo(() => {
    const map = new Map<string, number>()
    ;(selectedSheet?.items || []).forEach((row: any) => {
      map.set(row.reason || "기타", (map.get(row.reason || "기타") || 0) + 1)
    })
    return [...map.entries()]
  }, [selectedSheet])

  async function sendDashboardUpdate(body: string, keepalive = false) {
    const response = await fetch("/api/dashboard", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
      ...(keepalive ? { keepalive: true } : {}),
    })
    if (!response.ok) {
      throw new Error(`Dashboard save failed (${response.status})`)
    }
  }

  function queueDashboardUpdate(body: string, keepalive = false) {
    const nextSave = saveQueueRef.current
      .catch(() => undefined)
      .then(() => sendDashboardUpdate(body, keepalive))
    saveQueueRef.current = nextSave.catch(() => undefined)
    return nextSave
  }

  function scheduleLocalDashboardCache(nextData: any) {
    if (typeof window === "undefined") return
    if (localStorageCacheTimerRef.current) {
      window.clearTimeout(localStorageCacheTimerRef.current)
    }
    localStorageCacheTimerRef.current = window.setTimeout(() => {
      localStorageCacheTimerRef.current = null
      try {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextData))
      } catch {}
    }, 0)
  }

  function markViewsDirty(views: ViewKey[] = [view]) {
    const nextDirtyViews = {
      ...dirtyViewsRef.current,
      ...Object.fromEntries(views.map((key) => [key, true])),
    }
    dirtyViewsRef.current = nextDirtyViews
    setDirtyViews(nextDirtyViews)
  }

  function clearDirtyViews(views: ViewKey[]) {
    const nextDirtyViews = { ...dirtyViewsRef.current }
    views.forEach((key) => {
      delete nextDirtyViews[key]
    })
    dirtyViewsRef.current = nextDirtyViews
    setDirtyViews(nextDirtyViews)
  }

  function getDirtyViewKeys(extraViews: ViewKey[] = []) {
    return Array.from(
      new Set([
        ...Object.entries(dirtyViewsRef.current)
          .filter(([, dirty]) => dirty)
          .map(([key]) => key as ViewKey),
        ...extraViews,
      ]),
    )
  }

  async function commitDashboardData(sourceData: any = pendingDataRef.current || data, updatedViews: ViewKey[] = [view]) {
    const viewsToCommit = getDirtyViewKeys(updatedViews)
    const updatedAt = new Date().toISOString()
    const menuUpdatedAt = {
      ...(sourceData?.ui?.menuUpdatedAt || {}),
      ...Object.fromEntries(viewsToCommit.map((key) => [key, updatedAt])),
    }
    const nextDataWithMeta = {
      ...sourceData,
      ui: {
        ...(sourceData?.ui || {}),
        menuUpdatedAt,
      },
    }
    const changedKeys = collectStateKeysForViews(viewsToCommit)
    const payload = JSON.stringify({
      partial: true,
      changedKeys,
      data: pickTopLevelState(nextDataWithMeta, changedKeys),
    })
    await queueDashboardUpdate(payload)
    setData(nextDataWithMeta)
    pendingDataRef.current = nextDataWithMeta
    scheduleLocalDashboardCache(nextDataWithMeta)
    clearDirtyViews(viewsToCommit)
  }

  function persist(nextData: any, options: { immediate?: boolean; updatedViews?: ViewKey[] } = {}) {
    const now = Date.now()
    const updatedViews = options.updatedViews?.length ? options.updatedViews : [view]
    const previousData = cloneData(pendingDataRef.current || data)
    setData(nextData)
    pendingDataRef.current = nextData
    markViewsDirty(updatedViews)
    scheduleLocalDashboardCache(nextData)
    if (pendingSaveRef.current) {
      window.clearTimeout(pendingSaveRef.current)
    }
    let savePromise: Promise<void> = Promise.resolve()
    if (options.immediate) {
      pendingPayloadRef.current = null
      pendingSaveRef.current = null
      savePromise = commitDashboardData(nextData, updatedViews).catch((error) => {
        setData(previousData)
        pendingDataRef.current = previousData
        scheduleLocalDashboardCache(previousData)
        window.alert("저장에 실패해서 이전 상태로 되돌렸습니다. 잠시 후 다시 시도해주세요.")
        throw error
      })
    }
    if (now - lastHistoryAtRef.current > 500) {
      const snapshot = () => {
        setHistoryStack((prev) => [cloneData(data), ...prev].slice(0, 20))
      }
      lastHistoryAtRef.current = now
      if ("requestIdleCallback" in window) {
        ;(window as any).requestIdleCallback(snapshot, { timeout: 800 })
      } else {
        snapshot()
      }
    }
    return savePromise
  }

  async function persistDailyReportState(nextDailyReportState: any) {
    await persist(
      {
        ...data,
        dailyReport: nextDailyReportState,
      },
      { immediate: true, updatedViews: ["daily-report"] },
    )
    void notifyDailyTeamCompletion(nextDailyReportState)
  }

  async function notifyDailyTeamCompletion(nextDailyReportState: any) {
    try {
      await fetch("/api/popup-messages/daily-completion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: dailyReportDate,
          reports: Array.isArray(nextDailyReportState?.reports) ? nextDailyReportState.reports : [],
        }),
      })
    } catch {
      // Daily report saves must not fail because a popup notification failed.
    }
  }

  async function acknowledgePopupMessage(messageId: string) {
    dismissedPopupMessageIdsRef.current.add(messageId)
    if (dismissedPopupMessageIdsRef.current.size > 200) {
      dismissedPopupMessageIdsRef.current = new Set(Array.from(dismissedPopupMessageIdsRef.current).slice(-100))
    }
    setPopupMessages((prev) => prev.filter((message) => message.id !== messageId))
    try {
      await fetch("/api/popup-messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "read", messageIds: [messageId] }),
      })
    } catch {
      // The next stream tick may show it again if the read marker failed.
    }
  }

  async function replyToPopupMessage(message: PopupMessage) {
    if (!message.senderUserId || message.senderUserId === currentUser?.id) {
      window.alert("답장을 보낼 대상이 없습니다.")
      return
    }
    const body = window.prompt(`${message.senderName || "보낸 사람"}에게 답장할 내용을 입력해주세요.`)
    const replyBody = String(body || "").trim()
    if (!replyBody) return
    try {
      const response = await fetch("/api/popup-messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetUserIds: [message.senderUserId],
          title: `답장: ${message.title || "업무 알림"}`,
          body: replyBody,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        window.alert(payload?.error || "답장을 보내지 못했습니다.")
        return
      }
      await acknowledgePopupMessage(message.id)
      window.alert("답장을 보냈습니다.")
    } catch {
      window.alert("답장을 보내지 못했습니다. 잠시 후 다시 시도해주세요.")
    }
  }

  async function sendPopupMessage(targetUserIds: string[], label: string) {
    const body = window.prompt(`${label}에게 보낼 팝업 메시지를 입력해주세요.`)
    const message = String(body || "").trim()
    if (!message) return
    try {
      const response = await fetch("/api/popup-messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetUserIds,
          title: "업무 알림",
          body: message,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        window.alert(payload?.error || "메시지를 보내지 못했습니다.")
        return
      }
      window.alert(`${payload.sent || 0}명에게 팝업 메시지를 보냈습니다.`)
    } catch {
      window.alert("메시지를 보내지 못했습니다. 잠시 후 다시 시도해주세요.")
    }
  }

  async function sendPopupMessageToAll() {
    const targets = activePresenceUsers.map((user) => user.userId).filter((userId) => userId && userId !== currentUser?.id)
    if (!targets.length) {
      window.alert("메시지를 보낼 접속자가 없습니다.")
      return
    }
    const body = window.prompt("현재 접속자 전체에게 보낼 팝업 메시지를 입력해주세요.")
    const message = String(body || "").trim()
    if (!message) return
    try {
      const response = await fetch("/api/popup-messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetUserIds: targets,
          title: "업무 알림",
          body: message,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        window.alert(payload?.error || "메시지를 보내지 못했습니다.")
        return
      }
      window.alert(`${payload.sent || 0}명에게 팝업 메시지를 보냈습니다.`)
    } catch {
      window.alert("메시지를 보내지 못했습니다. 잠시 후 다시 시도해주세요.")
    }
  }

  useEffect(() => {
    const rawDailyReport = data.dailyReport || createEmptyDailyReportState()
    const rawReports = Array.isArray(rawDailyReport?.reports) ? rawDailyReport.reports : []
    const rawSummaries = Array.isArray(rawDailyReport?.aiSummaries) ? rawDailyReport.aiSummaries : []
    const needsPrune =
      rawReports.some((row: any) => String(row?.date || "").trim() !== dailyReportDate) ||
      rawSummaries.some((row: any) => String(row?.date || "").trim() !== dailyReportDate)

    if (!needsPrune) return

    void persist(
      {
        ...data,
        dailyReport: normalizedDailyReport,
      },
      { immediate: true, updatedViews: ["daily-report"] },
    )
  }, [data, dailyReportDate, normalizedDailyReport, persist])

  flushPendingSave.current = () => {
    // Saves are intentionally manual now. This function remains as a no-op
    // so older call sites cannot push half-finished edits on page unload.
  }

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!Object.values(dirtyViewsRef.current).some(Boolean)) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (manualSaveTimerRef.current) window.clearTimeout(manualSaveTimerRef.current)
      if (localStorageCacheTimerRef.current) window.clearTimeout(localStorageCacheTimerRef.current)
    }
  }, [])

  useEffect(() => {
    dirtyViewsRef.current = dirtyViews
  }, [dirtyViews])

  function markManualInputDirty() {
    if (dirtyViewsRef.current["manual-input"]) return
    dirtyViewsRef.current = {
      ...dirtyViewsRef.current,
      "manual-input": true,
    }
    markViewsDirty(["manual-input"])
  }

  useEffect(() => {
    manualDraftRef.current = manualDraft
    if (!manualDraftReadyRef.current) {
      manualDraftReadyRef.current = true
      return
    }
    if (isSyncingManualDraftRef.current) {
      isSyncingManualDraftRef.current = false
      return
    }
    markViewsDirty(["manual-input"])
  }, [manualDraft])

  useEffect(() => {
    manualPreviewDraftRef.current = manualPreviewDraft
  }, [manualPreviewDraft])

  useEffect(() => {
    const serverCollection = data?.collection || {}
    setCollectionYearFilter(getUpcomingThursday().getFullYear() || 2026)
    setCollectionStatusFilter(serverCollection?.statusFilter || "all")
    setCollectionSort(serverCollection?.sort || { key: "year", dir: "desc" })
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
    } catch {}
  }, [])

  useEffect(() => {
    if (view !== "daily-report") return
    let cancelled = false
    let timer: number | null = null

    const refreshDailyReport = async () => {
      if (document.visibilityState === "hidden") return
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" })
        if (!response.ok) return
        const latest = await response.json()
        if (cancelled) return
        if (latest?.dailyReport) {
          setData((prev: any) => ({ ...prev, dailyReport: latest.dailyReport, ui: latest.ui || prev.ui }))
        }
      } catch {
        // Ignore transient polling issues for collaborative daily reports.
      }
    }

    const scheduleRefresh = () => {
      if (cancelled) return
      timer = window.setTimeout(() => {
        if (cancelled) return
        void refreshDailyReport().finally(scheduleRefresh)
      }, getDailyReportPollIntervalMs())
    }

    scheduleRefresh()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [view])

  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    url.searchParams.set("view", view)
    if (view === "collection") {
      url.searchParams.set("tab", collectionTab)
    } else {
      url.searchParams.delete("tab")
    }
    window.history.replaceState({}, "", url.toString())
  }, [view, collectionTab])

  function handleUndoLastAction() {
    if (!historyStack.length) {
      window.alert("되돌릴 작업이 없습니다.")
      return
    }
    const [previous, ...rest] = historyStack
    setHistoryStack(rest)
    setData(previous)
    pendingDataRef.current = previous
    markViewsDirty([view])
  }

  function handleWeeklyReportPrint() {
    const previousTitle = document.title
    const baseDateDigits = String(displayBaseDate || "")
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
    markManualInputDirty()
    if (field === "revenueHeaderText") {
      setManualRevenueHeaderEdited(true)
    }
    if (field === "revenueUnitPrice" || field === "additionalContractCount") {
      const digitsOnly = String(value ?? "").replace(/[^\d]/g, "")
      updateManualDraft((prev: any) => ({ ...prev, [field]: digitsOnly }))
      return
    }
    updateManualDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function getCreateButtonLabel(status: CreateStatus, idleLabel = "등록") {
    const isSaveCreate = idleLabel.includes("저장")
    if (status === "saving") return isSaveCreate ? "등록&저장 중..." : "저장 중..."
    if (status === "success") return isSaveCreate ? "등록&저장 완료" : "등록완료"
    return idleLabel
  }

  function getCreateButtonClass(status: CreateStatus) {
    const colorClass =
      status === "success"
        ? "bg-emerald-600 text-white"
        : status === "saving"
          ? "bg-slate-400 text-white"
          : "bg-blue-600 text-white hover:bg-blue-700"
    return `h-10 rounded-2xl px-4 text-[14px] font-semibold whitespace-nowrap transition ${colorClass}`
  }

  function flashRecentRow(setter: React.Dispatch<React.SetStateAction<string | null>>, rowId: string) {
    setter(rowId)
    window.setTimeout(() => {
      setter((current) => (current === rowId ? null : current))
    }, 2800)
  }

  function hasDuplicateContractId(idCode: unknown) {
    const normalizedId = normalizeCustomerIdentifier(idCode)
    if (!normalizedId) return false
    const latestContracts = (pendingDataRef.current || data)?.contracts || contracts
    return latestContracts.some((row: any) => normalizeCustomerIdentifier(row?.idCode) === normalizedId)
  }

  function hasDuplicateTerminationCustomerId(customerId: unknown, sourceTermination?: any) {
    const normalizedId = normalizeCustomerIdentifier(customerId)
    if (!normalizedId) return false
    const latestTermination = sourceTermination || (pendingDataRef.current || data)?.termination || termination
    return (latestTermination?.sheets || []).some((sheet: any) =>
      [
        ...(sheet?.items || []),
        ...(sheet?.holdItems || []),
        ...(sheet?.confirmedItems || []),
        ...(sheet?.releasedHoldItems || []),
      ].some((row: any) => normalizeCustomerIdentifier(row?.customerId) === normalizedId),
    )
  }

  function updateContractDraft(field: string, value: string) {
    if (contractCreateStatus !== "idle") setContractCreateStatus("idle")
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
      note: row.note || "",
      documentStatus: row.documentStatus || "미회수",
      replacementType: row.replacementType || "신규",
    })
  }

  function updateEditingContractDraft(field: string, value: string) {
    setEditingContractDraft((prev: any) => ({ ...prev, [field]: value }))
  }

  function updateManualSummaryField(field: string, value: string) {
    markManualInputDirty()
    updateManualDraft((prev: any) => ({
      ...prev,
      manualSummary: { ...prev.manualSummary, [field]: value },
    }))
  }

  function updateManualRevenueCell(rowIndex: number, monthIndex: number, value: string) {
    markManualInputDirty()
    updateManualDraft((prev: any) => {
      const revenueRows = cloneData(prev.revenueRows || [])
      if (!revenueRows[rowIndex]) return prev
      if (!Array.isArray(revenueRows[rowIndex].months)) revenueRows[rowIndex].months = Array(12).fill(0)
      revenueRows[rowIndex].months[monthIndex] = value
      return { ...prev, revenueRows }
    })
  }

  function updateManualGoalRow(rowIndex: number, field: string, value: string) {
    if (!isEditableGoalField(field)) return
    if (rowIndex >= 12) return
    if (field === "quarterNetTarget" && rowIndex % 3 !== 0) return
    markManualInputDirty()
    const sourceDraft = manualPreviewDraftRef.current || manualDraftRef.current || manualDraft
    const goalRows = buildEditableGoalRows(sourceDraft.goalRows || [])
    if (!goalRows[rowIndex]) return
    goalRows[rowIndex][field] = value
    const nextDraft = { ...sourceDraft, goalRows }
    manualDraftRef.current = nextDraft
    setManualDraft(nextDraft)
    manualPreviewDraftRef.current = nextDraft
    setManualPreviewDraft(nextDraft)
  }

  function updateManualIndustryRow(rowIndex: number, field: string, value: string) {
    markManualInputDirty()
    updateManualDraft((prev: any) => {
      const industryStats = cloneData(prev.industryStats || [])
      if (!industryStats[rowIndex]) return prev
      industryStats[rowIndex][field] = value
      return { ...prev, industryStats }
    })
  }

  function updateManualPaidOptionColumn(columnIndex: number, field: string, value: string) {
    markManualInputDirty()
    updateManualDraft((prev: any) => {
      const paidOptionInfoColumns = cloneData(prev.paidOptionInfoColumns || [])
      if (!paidOptionInfoColumns[columnIndex]) return prev
      paidOptionInfoColumns[columnIndex][field] = value
      return { ...prev, paidOptionInfoColumns }
    })
  }

  function updateManualPaidOptionItem(columnIndex: number, itemIndex: number, value: string) {
    markManualInputDirty()
    updateManualDraft((prev: any) => {
      const paidOptionInfoColumns = cloneData(prev.paidOptionInfoColumns || [])
      if (!paidOptionInfoColumns[columnIndex]) return prev
      if (!Array.isArray(paidOptionInfoColumns[columnIndex].rows)) paidOptionInfoColumns[columnIndex].rows = []
      if (!Array.isArray(paidOptionInfoColumns[columnIndex].rows[itemIndex])) paidOptionInfoColumns[columnIndex].rows[itemIndex] = ["", ""]
      paidOptionInfoColumns[columnIndex].rows[itemIndex][0] = value
      const rowText = paidOptionInfoColumns[columnIndex].rows[itemIndex][0] || ""
      if (!paidOptionInfoColumns[columnIndex].rows[itemIndex][1]) {
        const matched = String(rowText).match(/(.+?)\s+(\d+건)$/)
        if (matched) {
          paidOptionInfoColumns[columnIndex].rows[itemIndex][0] = matched[1]
          paidOptionInfoColumns[columnIndex].rows[itemIndex][1] = matched[2]
        }
      }
      return { ...prev, paidOptionInfoColumns }
    })
  }

  function updateManualPaidOptionRowCell(columnIndex: number, rowIndex: number, cellIndex: number, value: string) {
    markManualInputDirty()
    updateManualDraft((prev: any) => {
      const paidOptionInfoColumns = cloneData(prev.paidOptionInfoColumns || [])
      if (!paidOptionInfoColumns[columnIndex]) return prev
      if (!Array.isArray(paidOptionInfoColumns[columnIndex].rows)) paidOptionInfoColumns[columnIndex].rows = []
      if (!Array.isArray(paidOptionInfoColumns[columnIndex].rows[rowIndex])) paidOptionInfoColumns[columnIndex].rows[rowIndex] = ["", ""]
      paidOptionInfoColumns[columnIndex].rows[rowIndex][cellIndex] = value
      return { ...prev, paidOptionInfoColumns }
    })
  }

  async function reloadPaidOptionInfo() {
    try {
      const response = await fetch("/api/options?basis=seed&category=all&activeOnly=1&includeRecords=0", {
        cache: "no-store",
      })
      if (!response.ok) {
        throw new Error(`옵션정보 API 오류 (${response.status})`)
      }
      const payload = await response.json()
      const sourceDraft = manualPreviewDraftRef.current || manualDraftRef.current || manualDraft
      const sourceColumns = Array.isArray(sourceDraft?.paidOptionInfoColumns) && sourceDraft.paidOptionInfoColumns.length
        ? sourceDraft.paidOptionInfoColumns
        : paidOptionSourceColumns
      const nextColumns = applySeedTotalsToPaidOptionColumns(sourceColumns, Array.isArray(payload?.cards) ? payload.cards : [])
      const prevColumnsKey = JSON.stringify(buildPaidOptionInfoColumns(sourceColumns))
      const nextColumnsKey = JSON.stringify(nextColumns)
      if (prevColumnsKey === nextColumnsKey) {
        window.alert("옵션정보가 이미 최신입니다.")
        return
      }
      markManualInputDirty()
      const nextDraft = {
        ...sourceDraft,
        paidOptionInfoColumns: cloneData(nextColumns),
      }
      manualDraftRef.current = nextDraft
      setManualDraft(nextDraft)
      manualPreviewDraftRef.current = nextDraft
      setManualPreviewDraft(nextDraft)
      window.alert("옵션정보를 불러왔습니다.")
    } catch (error: any) {
      const message = String(error?.message || "옵션정보를 불러오지 못했습니다.")
      window.alert(message)
    }
  }

  function loadTerminationOverviewFromWeeklyList() {
    const latestData = pendingDataRef.current || data
    const latestTermination = latestData?.termination || termination
    const latestSheet = Array.isArray(latestTermination?.sheets) && latestTermination.sheets.length
      ? latestTermination.sheets[0]
      : selectedSheet
    const confirmedItems = Array.isArray(latestSheet?.confirmedItems) ? latestSheet.confirmedItems : []
    const weeklySelected = Array.isArray(latestSheet?.items)
      ? latestSheet.items.filter((row: any) => row?.selected)
      : []
    const weeklyValues = buildTerminationWeeklyCounts(weeklySelected)
    const confirmedValues = buildTerminationWeeklyCounts(confirmedItems)
    const combineValues = (base: string[], extra: string[]) => {
      const totalIndex = base.length - 1
      const combined = base.map((value, index) =>
        String(parseLooseNumber(value) + parseLooseNumber(extra[index])),
      )
      return combined
    }
    const cumulativeValues = combineValues(confirmedValues, weeklyValues)
    markManualInputDirty()
    const sourceDraft = manualPreviewDraftRef.current || manualDraftRef.current || manualDraft
    const nextDraft = (() => {
      const prev = sourceDraft
      const terminationOverviewRows = cloneData(prev.terminationOverviewRows || [])
      const weeklyIndex = terminationOverviewRows.findIndex((row: any) => row.label === "주간")
      const cumulativeIndex = terminationOverviewRows.findIndex((row: any) => row.label === "누적")
      const ratioIndex = terminationOverviewRows.findIndex((row: any) => row.label === "비율")
      if (weeklyIndex === -1 && cumulativeIndex === -1) return prev
      if (weeklyIndex !== -1) terminationOverviewRows[weeklyIndex].values = weeklyValues
      if (cumulativeIndex !== -1) terminationOverviewRows[cumulativeIndex].values = cumulativeValues
      if (ratioIndex !== -1) terminationOverviewRows[ratioIndex].values = buildTerminationRatioValues(cumulativeValues)
      return { ...prev, terminationOverviewRows }
    })()
    manualDraftRef.current = nextDraft
    setManualDraft(nextDraft)
    manualPreviewDraftRef.current = nextDraft
    setManualPreviewDraft(nextDraft)
    window.alert("해지확정현황을 불러왔습니다.")
  }

  function updateManualTerminationOverviewCell(rowIndex: number, valueIndex: number, value: string) {
    markManualInputDirty()
    updateManualDraft((prev: any) => {
      const terminationOverviewRows = cloneData(prev.terminationOverviewRows || [])
      if (!terminationOverviewRows[rowIndex]) return prev
      if (!Array.isArray(terminationOverviewRows[rowIndex].values)) terminationOverviewRows[rowIndex].values = []
      terminationOverviewRows[rowIndex].values[valueIndex] = value
      return { ...prev, terminationOverviewRows }
    })
  }

  function updateManualWeeklyIndustryOverviewCell(rowIndex: number, valueIndex: number, value: string) {
    if (valueIndex >= reportIndustryColumnsStatic.length - 1) return
    markManualInputDirty()
    updateManualDraft((prev: any) => {
      const weeklyIndustryOverviewRows = cloneData(prev.weeklyIndustryOverviewRows || [])
      if (!weeklyIndustryOverviewRows[rowIndex]) return prev
      weeklyIndustryOverviewRows[rowIndex].values = normalizeIndustryRowValues(weeklyIndustryOverviewRows[rowIndex].values)
      weeklyIndustryOverviewRows[rowIndex].values[valueIndex] = value
      weeklyIndustryOverviewRows[rowIndex].values = buildIndustryRowValuesWithTotal(weeklyIndustryOverviewRows[rowIndex].values)
      return { ...prev, weeklyIndustryOverviewRows }
    })
  }

  function updateAdditionalSaleRow(rowIndex: number, field: string, value: string) {
    applyAdditionalSalesDraft((rows) => {
      if (!rows[rowIndex]) return rows
      rows[rowIndex][field] = value
      return rows
    })
  }

  function appendAdditionalContractAmountToSales() {
    const sourceDraft = manualPreviewDraftRef.current || manualDraftRef.current || manualDraft
    const amount = parseLooseNumber(sourceDraft.additionalContractCount)
    if (!amount) {
      window.alert("추가 계약 금액을 입력해주세요.")
      return
    }
    applyAdditionalSalesDraft((rows) => ({
      draftPatch: { additionalContractCount: "" },
      rows: normalizeAdditionalSalesRows([
        ...rows,
        {
          idCode: "",
          company: "",
          amount: String(amount),
          content: "",
          note: "",
          kind: "additional-contract",
        },
      ]),
    }))
    window.alert("추가매출에 반영했습니다.")
  }

  function addAdditionalSaleRow() {
    applyAdditionalSalesDraft((rows) =>
      normalizeAdditionalSalesRows([
        ...rows,
        { idCode: "", company: "", amount: "", content: "", note: "", kind: "manual" },
      ]),
    )
  }

  function deleteAdditionalSaleRow(rowIndex: number) {
    applyAdditionalSalesDraft((rows) => rows.filter((_: any, index: number) => index !== rowIndex))
  }

  function toggleWeeklySelection(contractId: string) {
    const nextContracts = contracts.map((row: any) =>
      row.id === contractId ? { ...row, includedInWeekly: !row.includedInWeekly } : row,
    )
    persist(
      { ...data, contracts: nextContracts },
      { immediate: true, updatedViews: ["weekly-selection", "weekly-report"] },
    )
  }

  function handleMoveWeeklySelectionToCollection() {
    if (!includedContracts.length) {
      window.alert("선택된 계약이 없습니다.")
      return
    }
    if (!window.confirm("신규 계약 리스트에서 삭제가 됩니다.\n계약서통합관리로 이동할까요?")) return

    startTransition(async () => {
      try {
        const latestResponse = await fetch("/api/dashboard", { cache: "no-store" }).catch(() => null)
        const latestData = latestResponse?.ok ? await latestResponse.json().catch(() => null) : null
        const sourceData = latestData && typeof latestData === "object" ? latestData : data
        const sourceCollection = sourceData?.collection || collection
        const sourceContracts = Array.isArray(sourceData?.contracts) ? sourceData.contracts : contracts
        const baseDate = normalizeDate(weeklyReport?.baseDate || new Date().toISOString().slice(0, 10))
        const reflectedDate = normalizeDate(new Date().toISOString().slice(0, 10))
        const existingRows = sourceCollection.integrated || []
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
            reflectedDate,
            status: row.documentStatus || "미회수",
          }))

        const selectedIds = new Set(includedContracts.map((row: any) => row.id))
        const nextContracts = sourceContracts.filter((row: any) => !selectedIds.has(row.id))
        const nextData = {
          ...sourceData,
          contracts: nextContracts,
          collection: {
            ...sourceCollection,
            integrated: [...movedRows, ...existingRows],
            yearFilter: currentYear,
            statusFilter: "all",
            sort: collectionSort,
          },
        }

        await persist(nextData, {
          immediate: true,
          updatedViews: ["weekly-selection", "contracts", "collection"],
        })
        setCollectionTab("integrated")
        setCollectionYearFilter(currentYear)
        setCollectionStatusFilter("all")
        setView("collection")
      } catch (error) {
        console.error("Failed to move weekly selection to collection.", error)
      }
    })
  }

  function handleContractCreate() {
    if (!canCreateContracts) {
      window.alert("신규계약 등록 권한이 없습니다.")
      return
    }
    if (!contractDraft.companyName.trim() || !contractDraft.idCode.trim()) {
      window.alert("회사명과 아이디는 필수입니다.")
      return
    }
    if (hasDuplicateContractId(contractDraft.idCode)) {
      window.alert("중복된 ID가 존재합니다.")
      return
    }
    setContractCreateStatus("saving")
    startTransition(async () => {
      try {
        const nextContract = {
          id: `c${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          companyName: contractDraft.companyName.trim(),
          departmentName: contractDraft.departmentName.trim(),
          idCode: contractDraft.idCode.trim(),
          industry: contractDraft.industry,
          contractMonth: contractDraft.contractMonth.trim(),
          documentStatus: contractDraft.documentStatus,
          replacementType: contractDraft.replacementType || "신규",
          includedInWeekly: false,
          recommender: contractDraft.recommender.trim(),
          note: contractDraft.note.trim(),
        }
        const response = await fetch("/api/dashboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "addContract", contract: nextContract }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.ok || !payload?.data) {
          throw new Error(payload?.error || `계약 등록 실패 (${response.status})`)
        }
        const createdId = String(payload?.contract?.id || nextContract.id)
        setData(payload.data)
        pendingDataRef.current = payload.data
        clearDirtyViews(["contracts"])
        try {
          window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload.data))
        } catch {}
        setContractDraft({
          companyName: "",
          departmentName: "",
          idCode: "",
          industry: "국내증권",
          contractMonth: "",
          recommender: currentUser?.name || "",
          note: "",
          documentStatus: "미회수",
          replacementType: "신규",
        })
        setContractQuery("")
        setContractStatusFilter("all")
        setContractReplacementFilter("all")
        setContractMonthFilter("all")
        setContractSort({ key: "createdAt", dir: "desc" })
        flashRecentRow(setRecentContractId, createdId)
        setContractCreateStatus("success")
      } catch (error: any) {
        setContractCreateStatus("idle")
        window.alert(String(error?.message || "계약 등록 저장에 실패했습니다."))
      }
    })
  }

  function handleContractUpdate(contractId: string) {
    if (!canEditContracts) {
      window.alert("계약 수정 권한이 없습니다.")
      return
    }
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
              note: editingContractDraft.note.trim(),
              documentStatus: editingContractDraft.documentStatus,
              replacementType: editingContractDraft.replacementType || "신규",
            }
          : row,
      )
      await persist({ ...data, contracts: nextContracts }, { immediate: true, updatedViews: ["contracts"] })
      setEditingContractId(null)
      setEditingContractDraft({})
    })
  }

  function handleContractDelete(contractId: string) {
    if (!canDeleteContracts) {
      window.alert("계약 삭제 권한이 없습니다.")
      return
    }
    if (!window.confirm("이 계약을 삭제할까요?")) return
    startTransition(async () => {
      const nextContracts = contracts.filter((row: any) => row.id !== contractId)
      await persist({ ...data, contracts: nextContracts }, { immediate: true, updatedViews: ["contracts"] })
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
          sort: collectionSort,
        },
      }, { immediate: true, updatedViews: ["collection"] })
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
      reflectedDate: row.reflectedDate || "",
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
              reflectedDate: editingCollectionDraft.reflectedDate,
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
          sort: collectionSort,
        },
      }, { immediate: true, updatedViews: ["collection"] })
      setEditingCollectionId(null)
      setEditingCollectionDraft({})
    })
  }

  function handleCollectionStatusToggle(rowId: string, nextStatus: string) {
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
    void persist({
      ...data,
      collection: {
        ...collection,
        [key]: nextCollectionRows,
        yearFilter: collectionYearFilter,
        statusFilter: collectionStatusFilter,
        sort: collectionSort,
      },
    }, { immediate: true, updatedViews: ["collection"] })
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
          sort: collectionSort,
        },
      }, { immediate: true, updatedViews: ["collection"] })
    })
  }

  function handleCollectionSortChange(
    nextKey: "year" | "companyName" | "departmentName" | "idCode" | "industry" | "claimMonth" | "receiptDate" | "reflectedDate" | "status",
  ) {
    setCollectionSort((prev) =>
      prev.key === nextKey
        ? { key: nextKey, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key: nextKey, dir: "asc" },
    )
  }

  function persistCollectionDelivery(nextDelivery: any) {
    return persist(
      {
        ...data,
        collection: {
          ...collection,
          delivery: nextDelivery,
          tab: collectionTab,
          yearFilter: collectionYearFilter,
          statusFilter: collectionStatusFilter,
          sort: collectionSort,
        },
      },
      { immediate: true, updatedViews: ["collection"] },
    )
  }

  async function flushCollectionDeliveryDraft(nextDraft?: any) {
    const source = cloneCollectionDeliveryState(nextDraft || activeCollectionDelivery || collectionDelivery)
    if (pendingDeliveryDraftSaveRef.current) {
      window.clearTimeout(pendingDeliveryDraftSaveRef.current)
      pendingDeliveryDraftSaveRef.current = null
    }
    await persistCollectionDelivery(source)
    return source
  }

  function buildCollectionDeliverySnapshot(source: any = activeCollectionDelivery || collectionDelivery) {
    const deliveredDate = normalizeDate(source?.deliveredDate)
    if (!deliveredDate) return null
    return {
      id: `delivery-history-${Date.now()}`,
      deliveredDate,
      title: String(source?.title || ""),
      managerConfirm: String(source?.managerConfirm || ""),
      senderConfirm: String(source?.senderConfirm || ""),
      savedAt: new Date().toISOString(),
      rows: (source?.rows || []).map((row: any, index: number) => ({
        id: row?.id || `delivery-history-row-${index + 1}`,
        companyName: String(row?.companyName || ""),
        departmentName: String(row?.departmentName || ""),
        idCode: String(row?.idCode || ""),
        recommender: String(row?.recommender || ""),
        contractMonth: String(row?.contractMonth || ""),
        recoveredCount: String(row?.recoveredCount || ""),
        note: String(row?.note || ""),
      })),
    }
  }

  async function handleCollectionDeliverySaveHistory() {
    const workingDelivery = cloneCollectionDeliveryState(activeCollectionDelivery || collectionDelivery)
    const snapshot = buildCollectionDeliverySnapshot(workingDelivery)
    if (!snapshot) {
      window.alert("전달 일자를 먼저 입력해 주세요.")
      return
    }
    const nextHistory = [
      snapshot,
      ...(workingDelivery.history || []).filter(
        (entry: any) => normalizeDate(entry.deliveredDate) !== snapshot.deliveredDate,
      ),
    ]
    const nextDelivery = {
      ...workingDelivery,
      deliveredDate: snapshot.deliveredDate,
      rows: snapshot.rows,
      history: nextHistory,
    }
    isSyncingDeliveryDraftRef.current = true
    setDeliveryDraft(cloneCollectionDeliveryState(nextDelivery))
    await flushCollectionDeliveryDraft(nextDelivery)
    setSelectedDeliveryHistoryDate(snapshot.deliveredDate)
    window.alert(`${snapshot.deliveredDate} 리스트로 저장되었습니다.`)
  }

  async function applyCollectionDeliveryHistory(target: any, selectedDate: string) {
    const baseDelivery = cloneCollectionDeliveryState(activeCollectionDelivery || collectionDelivery)
    const nextDelivery = {
      ...baseDelivery,
      title: String(target.title || baseDelivery.title),
      deliveredDate: normalizeDate(target.deliveredDate || selectedDate),
      managerConfirm: String(target.managerConfirm || ""),
      senderConfirm: String(target.senderConfirm || ""),
      rows: (target.rows || []).map((row: any, index: number) => ({
        id: row?.id || `delivery-row-loaded-${Date.now()}-${index + 1}`,
        companyName: String(row?.companyName || ""),
        departmentName: String(row?.departmentName || ""),
        idCode: String(row?.idCode || ""),
        recommender: String(row?.recommender || ""),
        contractMonth: String(row?.contractMonth || ""),
        recoveredCount: String(row?.recoveredCount || ""),
        note: String(row?.note || ""),
      })),
      history: baseDelivery.history || [],
    }
    isSyncingDeliveryDraftRef.current = true
    setDeliveryDraft(cloneCollectionDeliveryState(nextDelivery))
    await flushCollectionDeliveryDraft(nextDelivery)
  }

  async function handleCollectionDeliveryLoadHistory(dateKey?: string, skipConfirm = false) {
    const selectedDate = normalizeDate(dateKey || selectedDeliveryHistoryDate)
    if (!selectedDate) {
      window.alert("불러올 전달일자 히스토리를 선택해 주세요.")
      return
    }
    const target = ((activeCollectionDelivery || collectionDelivery)?.history || []).find(
      (entry: any) => normalizeDate(entry.deliveredDate) === selectedDate,
    )
    if (!target) {
      window.alert("선택한 전달일자 히스토리를 찾을 수 없습니다.")
      return
    }
    if (!skipConfirm && !window.confirm(`${selectedDate} 리스트를 불러올까요?`)) return
    await applyCollectionDeliveryHistory(target, selectedDate)
  }

  function handleCollectionDeliveryHistorySelect(nextDate: string) {
    setSelectedDeliveryHistoryDate(nextDate)
    if (!nextDate) return
    void handleCollectionDeliveryLoadHistory(nextDate, true)
  }

  async function handleCollectionDeliveryDeleteHistory(dateKey?: string) {
    const selectedDate = normalizeDate(dateKey || selectedDeliveryHistoryDate)
    if (!selectedDate) {
      window.alert("삭제할 저장 일자를 선택해 주세요.")
      return
    }
    const workingDelivery = cloneCollectionDeliveryState(activeCollectionDelivery || collectionDelivery)
    const target = (workingDelivery.history || []).find(
      (entry: any) => normalizeDate(entry.deliveredDate) === selectedDate,
    )
    if (!target) {
      window.alert("선택한 저장 일자를 찾을 수 없습니다.")
      return
    }
    if (!window.confirm(`${selectedDate} 저장본을 삭제할까요? 현재 화면 내용은 유지됩니다.`)) return
    const nextHistory = (workingDelivery.history || []).filter(
      (entry: any) => normalizeDate(entry.deliveredDate) !== selectedDate,
    )
    const nextDelivery = {
      ...workingDelivery,
      history: nextHistory,
    }
    isSyncingDeliveryDraftRef.current = true
    setDeliveryDraft(cloneCollectionDeliveryState(nextDelivery))
    await flushCollectionDeliveryDraft(nextDelivery)
    setSelectedDeliveryHistoryDate(normalizeDate(nextHistory[0]?.deliveredDate || ""))
    window.alert(`${selectedDate} 저장본을 삭제했습니다.`)
  }

  function handleCollectionDeliveryMetaChange(field: "title" | "deliveredDate" | "managerConfirm" | "senderConfirm", value: string) {
    setDeliveryDraft((prev: any) => ({
      ...cloneCollectionDeliveryState(prev || activeCollectionDelivery || collectionDelivery),
      [field]: field === "deliveredDate" ? normalizeDate(value) : value,
    }))
  }

  function handleCollectionDeliveryRowChange(
    rowId: string,
    field: "companyName" | "departmentName" | "idCode" | "recommender" | "contractMonth" | "recoveredCount" | "note",
    value: string,
  ) {
    setDeliveryDraft((prev: any) => {
      const baseDelivery = cloneCollectionDeliveryState(prev || activeCollectionDelivery || collectionDelivery)
      return {
        ...baseDelivery,
        rows: baseDelivery.rows.map((row: any) =>
          row.id === rowId
            ? { ...row, [field]: value }
            : row,
        ),
      }
    })
  }

  function handleCollectionDeliveryAddRow() {
    setDeliveryDraft((prev: any) => {
      const baseDelivery = cloneCollectionDeliveryState(prev || activeCollectionDelivery || collectionDelivery)
      return {
        ...baseDelivery,
        rows: [
          ...baseDelivery.rows,
          {
            id: `delivery-row-${Date.now()}`,
            companyName: "",
            departmentName: "",
            idCode: "",
            recommender: "",
            contractMonth: "",
            recoveredCount: "",
            note: "",
          },
        ],
      }
    })
  }

  function handleCollectionDeliveryDeleteRow(rowId: string) {
    if (!window.confirm("이 전달 항목을 삭제할까요?")) return
    setDeliveryDraft((prev: any) => {
      const baseDelivery = cloneCollectionDeliveryState(prev || activeCollectionDelivery || collectionDelivery)
      return {
        ...baseDelivery,
        rows: baseDelivery.rows.filter((row: any) => row.id !== rowId),
      }
    })
  }

  async function handleCollectionDeliveryOpenNewPage() {
    const today = normalizeDate(getSeoulTodayKey())
    const workingDelivery = cloneCollectionDeliveryState(activeCollectionDelivery || collectionDelivery)
    const hasCurrentContent =
      workingDelivery.rows.some((row: any) =>
        [
          row.companyName,
          row.departmentName,
          row.idCode,
          row.recommender,
          row.contractMonth,
          row.recoveredCount,
          row.note,
        ].some((value) => String(value || "").trim()),
      ) ||
      String(workingDelivery.managerConfirm || "").trim() ||
      String(workingDelivery.senderConfirm || "").trim()

    const shouldSaveCurrent = hasCurrentContent
      ? window.confirm(
          `현재 페이지를 일단 저장할까요?\n\n확인: ${today} 일자 리스트로 저장 후 새 페이지 열기\n취소: 저장하지 않고 새 페이지 열기`,
        )
      : false
    const currentSnapshot = shouldSaveCurrent
      ? buildCollectionDeliverySnapshot({
          ...workingDelivery,
          deliveredDate: today,
        })
      : null
    const nextHistory = currentSnapshot
      ? [
          currentSnapshot,
          ...(workingDelivery.history || []).filter(
            (entry: any) => normalizeDate(entry.deliveredDate) !== currentSnapshot.deliveredDate,
          ),
        ]
      : workingDelivery.history || []

    const nextDelivery = {
      ...workingDelivery,
      deliveredDate: today,
      managerConfirm: "",
      senderConfirm: "",
      rows: [],
      history: nextHistory,
    }
    isSyncingDeliveryDraftRef.current = true
    setDeliveryDraft(cloneCollectionDeliveryState(nextDelivery))
    await flushCollectionDeliveryDraft(nextDelivery)
    setSelectedDeliveryHistoryDate("")
  }

  function handleCollectionDeliveryPrint() {
    const popup = window.open("", "_blank", "width=980,height=1200")
    if (!popup) {
      window.alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.")
      return
    }
    const printSource = activeCollectionDelivery || collectionDelivery
    const rowsHtml = printSource.rows
      .map((row: any, index: number) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(row.companyName)}</td>
          <td>${escapeHtml(row.departmentName)}</td>
          <td>${escapeHtml(row.idCode)}</td>
          <td>${escapeHtml(row.note)}</td>
        </tr>
      `)
      .join("")
    popup.document.open()
    popup.document.write(`
      <!doctype html>
      <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(printSource.title)}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm 10mm; }
          html, body {
            margin: 0;
            padding: 0;
            font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
            color: #0b1f44;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .wrapper { padding: 1mm 0; }
          .sheet {
            border: 1px solid #d6e0ea;
            border-radius: 10px;
            overflow: hidden;
            background: #ffffff;
          }
          .header {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 270px;
            align-items: start;
            gap: 10px;
            padding: 8px 10px;
            border-bottom: 1px solid #d8e2ef;
            background: #ffffff;
          }
          .title-wrap {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 0;
          }
          .title {
            font-size: 17px;
            font-weight: 800;
            margin: 0;
            letter-spacing: -0.1px;
            word-break: keep-all;
            line-break: strict;
            white-space: nowrap;
          }
          .subtitle { font-size: 10px; color: #526683; }
          .meta {
            min-width: 270px;
            width: 270px;
            font-size: 11px;
            color: #0b1f44;
            border: 1px solid #d5dfeb;
            border-radius: 9px;
            background: #ffffff;
            padding: 7px 9px;
            box-sizing: border-box;
          }
          .meta-row {
            display: grid;
            grid-template-columns: auto 1fr;
            align-items: center;
            column-gap: 6px;
            margin-bottom: 4px;
          }
          .meta-row:last-child { margin-bottom: 0; }
          .meta-label { white-space: nowrap; font-weight: 700; }
          .meta-value { text-align: right; font-weight: 600; }
          .meta-sign-line {
            min-width: 0;
            width: 100%;
            height: 20px;
            border-bottom: 1px solid #213a63;
            padding: 0 4px;
            text-align: left;
            font-weight: 600;
            box-sizing: border-box;
            display: block;
          }
          .table-wrap { padding: 0 8px 8px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; color: #0b1f44; }
          th, td { border: 1px solid #c3cfdf; padding: 4px 6px; vertical-align: middle; text-align: center; word-break: break-word; }
          thead th {
            background: #f6ddd1;
            color: #0b1f44;
            font-weight: 800;
          }
          tbody td { background: #ffffff; }
          td:nth-child(2), td:nth-child(3), td:nth-child(5) { text-align: left; }
          .footer-note {
            padding: 0 10px 8px;
            font-size: 10px;
            color: #5f7492;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="sheet">
            <div class="header">
              <div class="title-wrap">
                <h1 class="title">${escapeHtml(printSource.title)}</h1>
                <div class="subtitle">계약서 전달 확인용 문서</div>
              </div>
              <div class="meta">
                <div class="meta-row">
                  <span class="meta-label">전달 일자 :</span>
                    <span class="meta-value">${escapeHtml(printSource.deliveredDate)}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">담당자 확인 :</span>
                    <span class="meta-sign-line">${escapeHtml(printSource.managerConfirm)}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">전달자 확인 :</span>
                  <span class="meta-sign-line">${escapeHtml(printSource.senderConfirm)}</span>
                </div>
              </div>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style="width:6%">구분</th>
                    <th style="width:27%">회사명</th>
                    <th style="width:18%">부서명</th>
                    <th style="width:12%">ID</th>
                    <th style="width:37%">비고</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </div>
            <div class="footer-note">인포Biz본부 계약서 전달 기록</div>
          </div>
        </div>
      </body>
      </html>
    `)
    popup.document.close()
    popup.onload = () => {
      popup.focus()
      popup.setTimeout(() => {
        popup.print()
      }, 250)
    }
  }

  function handleCollectionIntegratedPrint() {
    const integratedRows = Array.isArray(collection?.integrated) ? collection.integrated : []
    const longTermRows = Array.isArray(collection?.longTerm) ? collection.longTerm : []
    const currentYearNumber = Number(currentYear) || new Date().getFullYear()
    const reportDate = String(displayBaseDate || formatDateDashed(getUpcomingThursday()))
    const previousDate = shiftDashedDate(reportDate, -1)
    const fileDate = reportDate.replace(/[^\d]/g, "")
    const fileTitle = `계약서_회수현황_${fileDate || "report"}`
    const summaryBuckets = [
      { key: "26", label: "26년", match: (year: number) => year === 2026 },
      { key: "25", label: "25년", match: (year: number) => year === 2025 },
      { key: "24", label: "24년", match: (year: number) => year === 2024 },
      { key: "22", label: "22년", match: (year: number) => year === 2022 },
      { key: "legacy", label: "14년 이전", match: (year: number) => year > 0 && year <= 2014 },
    ]

    const summary = summaryBuckets.map((bucket) => {
      const sourceRows =
        bucket.key === "legacy"
          ? longTermRows.filter((row: any) => String(row?.status || "미정") === "미회수")
          : integratedRows.filter((row: any) => bucket.match(Number(row?.year)))
      const collected =
        bucket.key === "legacy"
          ? 0
          : sourceRows.filter((row: any) => String(row?.status || "미정") === "회수").length
      const uncollected = sourceRows.filter((row: any) => String(row?.status || "미정") === "미회수").length
      return {
        year: bucket.label,
        total: bucket.key === "legacy" ? uncollected : sourceRows.length,
        collected,
        uncollected,
      }
    })

    const summaryHtml = summary
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.year)}</td>
            <td>${formatNumber(item.total)}건</td>
            <td>${formatNumber(item.collected)}건</td>
            <td>${formatNumber(item.uncollected)}건</td>
          </tr>
        `,
      )
      .join("")

    const buildYearDetailTable = (year: number, compact = false) => {
        const yearRows = integratedRows
          .filter((row: any) => Number(row?.year) === year && String(row?.status || "미정") === "미회수")
          .sort((a: any, b: any) => {
            const monthDiff = parseContractMonthKey(a?.claimMonth) - parseContractMonthKey(b?.claimMonth)
            if (monthDiff !== 0) return monthDiff
            return String(a?.companyName || "").localeCompare(String(b?.companyName || ""), "ko")
          })
          .map((row: any, index: number) => ({
            no: index + 1,
            company: String(row?.companyName || ""),
            department: String(row?.departmentName || ""),
            id: String(row?.idCode || ""),
            industry: String(row?.industry || ""),
            billingMonth: String(row?.claimMonth || ""),
            status: String(row?.status || "미정"),
          }))

        const rowsHtml =
          yearRows.length > 0
            ? yearRows
                .map(
                  (row: any) => `
                    <tr>
                      <td>${formatNumber(row.no)}</td>
                      <td>${escapeHtml(row.company)}</td>
                      <td>${escapeHtml(row.department)}</td>
                      <td>${escapeHtml(row.id)}</td>
                      <td>${escapeHtml(row.industry)}</td>
                      <td>${escapeHtml(row.billingMonth)}</td>
                      <td>${escapeHtml(row.status)}</td>
                    </tr>
                  `,
                )
                .join("")
            : `
              <tr>
                <td colspan="7" class="empty-cell">${year}년 미회수 계약서가 없습니다.</td>
              </tr>
            `

        return `
          <div class="${compact ? "detail-year-mini" : "detail-section detail-year-block"}">
            <h2 class="${compact ? "mini-section-title" : "section-title"}">${year}년 미회수 계약서 목록</h2>
            <table class="detail-table ${compact ? "compact-table" : "semi-compact-table"}" aria-label="${year}년 미회수 계약서 목록">
              <thead>
                <tr>
                  <th style="width: 7%">NO</th>
                  <th style="width: 22%">회사명</th>
                  <th style="width: 18%">부서명</th>
                  <th style="width: 12%">ID</th>
                  <th style="width: 14%">업종</th>
                  <th style="width: 15%">청구일</th>
                  <th style="width: 12%">상태</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `
      }

    const detailedSectionsHtml = [2026, 2025, 2024, 2022]
      .map((year) => buildYearDetailTable(year, false))
      .join("")

    const longTermUncollectedRows = longTermRows
      .filter((row: any) => String(row?.status || "미정") === "미회수")
      .sort((a: any, b: any) => {
        const yearDiff = Number(b?.year || 0) - Number(a?.year || 0)
        if (yearDiff !== 0) return yearDiff
        const monthDiff = parseContractMonthKey(a?.claimMonth) - parseContractMonthKey(b?.claimMonth)
        if (monthDiff !== 0) return monthDiff
        return String(a?.companyName || "").localeCompare(String(b?.companyName || ""), "ko")
      })
      .map((row: any, index: number) => ({
        no: index + 1,
        company: String(row?.companyName || ""),
        department: String(row?.departmentName || ""),
        id: String(row?.idCode || ""),
        industry: String(row?.industry || ""),
        billingMonth: String(row?.claimMonth || ""),
        collected: String(row?.status || "") === "회수" ? "회수" : "",
        uncollected: String(row?.status || "") === "회수" ? "" : "미회수",
        note: String(row?.note || row?.specialNote || ""),
        managerNote: String(row?.managerNote || row?.reviewNote || ""),
      }))

    const longTermRowsHtml =
      longTermUncollectedRows.length > 0
        ? longTermUncollectedRows
            .map(
              (row: any) => `
                <tr>
                  <td>${formatNumber(row.no)}</td>
                  <td>${escapeHtml(row.company)}</td>
                  <td>${escapeHtml(row.department)}</td>
                  <td>${escapeHtml(row.id)}</td>
                  <td>${escapeHtml(row.industry)}</td>
                  <td>${escapeHtml(row.billingMonth)}</td>
                  <td>${escapeHtml(row.collected)}</td>
                  <td>${escapeHtml(row.uncollected)}</td>
                  <td>${escapeHtml(row.note)}</td>
                  <td>${escapeHtml(row.managerNote)}</td>
                </tr>
              `,
            )
            .join("")
        : `
          <tr>
            <td colspan="10" class="empty-cell">14년도 이전 장기 미회수 계약서가 없습니다.</td>
          </tr>
        `

    const printHtml = `
      <!doctype html>
      <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(fileTitle)}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 9mm 10mm;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #0f172a;
            font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            padding: 0;
          }
          .sheet {
            width: 100%;
            box-sizing: border-box;
          }
          .page-one {
            min-height: 268mm;
            display: flex;
            flex-direction: column;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 5px;
          }
          .title-block {
            min-width: 0;
          }
          .title {
            margin: 0;
            font-size: 20px;
            line-height: 1.15;
            font-weight: 800;
            color: #0b1f44;
          }
          .meta {
            text-align: right;
            white-space: nowrap;
          }
          .meta .dept {
            font-size: 11px;
            font-weight: 700;
            color: #0b1f44;
          }
          .meta .date {
            margin-top: 2px;
            font-size: 10px;
            color: #475569;
            font-weight: 600;
          }
          .summary-section,
          .detail-section {
            margin-top: 5px;
          }
          .section-title {
            margin: 0 0 3px;
            font-size: 12px;
            font-weight: 800;
            color: #0b1f44;
          }
          .detail-year-block {
            margin-top: 5px;
          }
          .detail-year-mini {
            min-width: 0;
          }
          .mini-section-title {
            margin: 0 0 2px;
            font-size: 10px;
            font-weight: 800;
            color: #0b1f44;
          }
          .summary-table,
          .detail-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 8.6px;
          }
          .summary-table th,
          .summary-table td,
          .detail-table th,
          .detail-table td {
            border: 1px solid #cfd8e3;
            padding: 2px 2px;
            vertical-align: middle;
            text-align: center;
            word-break: keep-all;
            line-height: 1.12;
          }
          .summary-table th,
          .detail-table th {
            background: #eef4ff;
            color: #0b1f44;
            font-weight: 800;
          }
          .summary-table td:first-child,
          .detail-table td:nth-child(2),
          .detail-table td:nth-child(3),
          .detail-table td:nth-child(5) {
            text-align: left;
          }
          .semi-compact-table {
            font-size: 8.2px;
          }
          .semi-compact-table th,
          .semi-compact-table td {
            padding: 2px 2px;
          }
          .compact-table {
            font-size: 7.8px;
          }
          .compact-table th,
          .compact-table td {
            padding: 1.5px 1.5px;
          }
          .empty-cell {
            height: 24px;
            color: #64748b;
            text-align: center !important;
          }
          .footer-note {
            margin-top: 4px;
            text-align: right;
            font-size: 8px;
            color: #64748b;
          }
          .page-one .summary-section,
          .page-one .detail-section {
            margin-top: 7px;
          }
          .page-one .section-title {
            margin: 0 0 4px;
            font-size: 13px;
          }
          .page-one .summary-table,
          .page-one .detail-table {
            font-size: 9.2px;
          }
          .page-one .summary-table th,
          .page-one .summary-table td,
          .page-one .detail-table th,
          .page-one .detail-table td {
            padding: 3px 3px;
            line-height: 1.2;
          }
          .page-one .semi-compact-table {
            font-size: 9px;
          }
          .page-one .semi-compact-table th,
          .page-one .semi-compact-table td {
            padding: 3px 3px;
          }
          .page-one .footer-note {
            margin-top: auto;
            padding-top: 8px;
          }
          .page-break {
            break-before: page;
            page-break-before: always;
            margin-top: 0;
            padding-top: 0;
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="page-one">
            <div class="header">
              <div class="title-block">
                <h1 class="title">주간 계약서 회수현황</h1>
              </div>
              <div class="meta">
                <div class="dept">인포Biz본부</div>
                <div class="date">${escapeHtml(formatDateDottedWithWeekday(reportDate))}</div>
              </div>
            </div>

            <div class="summary-section">
              <h2 class="section-title">연도별 회수 요약</h2>
              <table class="summary-table" aria-label="연도별 회수 요약">
                <thead>
                  <tr>
                    <th style="width: 25%">연도</th>
                    <th style="width: 25%">총건수</th>
                    <th style="width: 25%">회수</th>
                    <th style="width: 25%">미회수</th>
                  </tr>
                </thead>
                <tbody>${summaryHtml}</tbody>
              </table>
            </div>

            ${detailedSectionsHtml}

            <div class="footer-note">인포Biz본부 주간 계약서 회수 보고서</div>
          </div>

          <div class="detail-section page-break">
            <h2 class="section-title">장기미회수 계약서 현황 (${formatNumber(longTermUncollectedRows.length)}건)</h2>
            <table class="detail-table compact-table" aria-label="장기미회수 계약서 현황">
              <thead>
                <tr>
                  <th style="width: 6%">구분</th>
                  <th style="width: 15%">회사명</th>
                  <th style="width: 15%">부서명</th>
                  <th style="width: 10%">ID</th>
                  <th style="width: 10%">업종</th>
                  <th style="width: 10%">청구일</th>
                  <th style="width: 6%">회수</th>
                  <th style="width: 8%">미회수</th>
                  <th style="width: 10%">특이사항</th>
                  <th style="width: 10%">담당자 확인 후 특이사항</th>
                </tr>
              </thead>
              <tbody>${longTermRowsHtml}</tbody>
            </table>
          </div>
        </div>
        <script>
          window.addEventListener("load", function () {
            setTimeout(function () {
              window.focus();
              window.print();
            }, 250);
          });
        </script>
      </body>
      </html>
    `

    const blob = new Blob([printHtml], { type: "text/html;charset=utf-8" })
    const objectUrl = URL.createObjectURL(blob)
    const popup = window.open(objectUrl, "_blank", "noopener,noreferrer,width=960,height=1280")
    if (!popup) {
      URL.revokeObjectURL(objectUrl)
      return
    }

    const revoke = () => {
      try {
        URL.revokeObjectURL(objectUrl)
      } catch {}
    }

    popup.addEventListener("beforeunload", revoke, { once: true })
    popup.onload = () => {
      popup.focus()
      popup.setTimeout(() => {
        popup.print()
        popup.setTimeout(revoke, 1500)
      }, 300)
    }
  }


  function handleCollectionTabChange(nextTab: CollectionTabKey) {
    setCollectionTab(nextTab)
    if (nextTab === "long-term") {
      setCollectionYearFilter("all")
      setCollectionStatusFilter("미회수")
    } else if (nextTab === "delivery") {
      setCollectionStatusFilter("all")
    } else {
      setCollectionYearFilter(2026)
      setCollectionStatusFilter("all")
    }
  }

  function persistTerminationData(nextData: any, options: { throwOnError?: boolean } = {}) {
    const savePromise = persist(nextData, { immediate: true, updatedViews: ["termination"] })
    if (!options.throwOnError) {
      void savePromise.catch(() => {
        // persist() already restores the previous state and alerts the user on immediate save failures.
      })
    }
    return savePromise
  }

  function toggleTerminationSelected(itemId: string) {
    if (!selectedSheet) return
    const { latestData, latestTermination, latestSheet } = getLatestTerminationContext()
    if (!latestSheet) return
    const nextSheets = (latestTermination.sheets || []).map((sheet: any) =>
      sheet.id === latestSheet.id
        ? {
            ...sheet,
            items: (sheet.items || []).map((row: any) =>
              row.id === itemId ? { ...row, selected: !row.selected } : row,
            ),
          }
        : sheet,
    )
    persistTerminationData({ ...latestData, termination: { ...latestTermination, currentSheetId: latestSheet.id, sheets: nextSheets } })
  }

  function handleConfirmSelectedTerminations() {
    const { latestData, latestTermination, latestSheet } = getLatestTerminationContext()
    if (!latestSheet) return
    const activeItems = latestSheet.items || []
    const selectedItems = activeItems
      .filter((row: any) => row.selected)
      .map((row: any) => {
        const mergedRow = mergeEditingTerminationRow(row)
        const manager = getTerminationManagerFallback(mergedRow)
        return manager ? { ...mergedRow, manager } : mergedRow
      })
    if (!selectedItems.length) return
    const reflectedDate = normalizeDate(new Date().toISOString().slice(0, 10))
    const selectedSet = new Set(selectedItems.map((row: any) => row.id))
    const nextSheets = (latestTermination.sheets || []).map((sheet: any) =>
      sheet.id === latestSheet.id
        ? {
            ...sheet,
            items: (sheet.items || []).filter((row: any) => !selectedSet.has(row.id)),
            confirmedItems: [
              ...selectedItems.map((row: any) => ({ ...row, selected: false, reflectedDate })),
              ...(sheet.confirmedItems || []),
            ],
          }
        : sheet,
    )
    persistTerminationData({ ...latestData, termination: { ...latestTermination, currentSheetId: latestSheet.id, sheets: nextSheets } })
    if (selectedItems.some((row: any) => row.id === editingTerminationId)) {
      setEditingTerminationId(null)
      setEditingTerminationDraft({})
    }
  }

  function restoreTerminationConfirmed(itemId: string) {
    const { latestData, latestTermination, latestSheet } = getLatestTerminationContext()
    if (!latestSheet) return
    const confirmedItems = latestSheet.confirmedItems || []
    const targetItem = confirmedItems.find((row: any) => row.id === itemId)
    if (!targetItem) return
    const nextSheets = (latestTermination.sheets || []).map((sheet: any) =>
      sheet.id === latestSheet.id
        ? {
            ...sheet,
            items: [{ ...targetItem, selected: false }, ...(sheet.items || [])],
            confirmedItems: (sheet.confirmedItems || []).filter((row: any) => row.id !== itemId),
          }
        : sheet,
    )
    persistTerminationData({ ...latestData, termination: { ...latestTermination, currentSheetId: latestSheet.id, sheets: nextSheets } })
  }

  function updateTerminationDraft(field: string, value: string) {
    if (terminationCreateStatus !== "idle") setTerminationCreateStatus("idle")
    setTerminationDraft((prev: any) => ({ ...prev, [field]: field === "customerId" ? String(value || "").trim().toUpperCase() : value }))
  }

  function updateHoldDraft(field: string, value: string) {
    if (holdCreateStatus !== "idle") setHoldCreateStatus("idle")
    setHoldDraft((prev: any) => ({ ...prev, [field]: field === "customerId" ? String(value || "").trim().toUpperCase() : value }))
  }

  function resetTerminationDraft() {
    setTerminationDraft({
      receivedDate: toInputDate(new Date().toISOString().slice(0, 10)),
      manager: currentUser?.name || "",
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
      manager: currentUser?.name || "",
      customerId: "",
      companyName: "",
      departmentName: "",
      reason: "사용자퇴사",
      reasonDetail: "",
      startDate: "",
      endDate: "",
      note: "",
    })
  }

  async function handleTerminationCreate() {
    if (!selectedSheet) return
    if (!terminationDraft.customerId.trim() || !terminationDraft.companyName.trim()) {
      window.alert("고객번호와 고객사는 필수입니다.")
      return
    }
    const { latestData, latestTermination, latestSheet } = getLatestTerminationContext()
    if (!latestSheet) return
    if (hasDuplicateTerminationCustomerId(terminationDraft.customerId, latestTermination)) {
      window.alert("중복된 ID가 존재합니다.")
      return
    }
    setTerminationCreateStatus("saving")
    const nextItem = {
      id: `term-${Date.now()}`,
      no: "0",
      selected: false,
      receivedDate: normalizeDate(terminationDraft.receivedDate),
      manager: terminationDraft.manager.trim(),
      customerId: terminationDraft.customerId.trim().toUpperCase(),
      companyName: terminationDraft.companyName.trim(),
      departmentName: terminationDraft.departmentName.trim(),
      reason: terminationDraft.reason === "기타" && terminationDraft.reasonDetail.trim()
        ? `기타(${terminationDraft.reasonDetail.trim()})`
        : terminationDraft.reason,
      terminationDate: normalizeDate(terminationDraft.terminationDate),
      penalty: toNumber(terminationDraft.penalty),
    }
    const nextSheets = (latestTermination.sheets || []).map((sheet: any) =>
      sheet.id === latestSheet.id
        ? {
            ...sheet,
            items: [nextItem, ...(sheet.items || [])],
            weeklyTerminationCount: (sheet.weeklyTerminationCount || 0) + 1,
          }
        : sheet,
    )
    try {
      await persistTerminationData(
        { ...latestData, termination: { ...latestTermination, currentSheetId: latestSheet.id, sheets: nextSheets } },
        { throwOnError: true },
      )
      resetTerminationDraft()
      setTerminationQuery("")
      setTerminationReasonFilter("all")
      setTerminationDateFilter("all")
      setTerminationSort({ key: "receivedDate", dir: "desc" })
      flashRecentRow(setRecentTerminationId, nextItem.id)
      setTerminationCreateStatus("success")
    } catch {
      setTerminationCreateStatus("idle")
    }
  }

  async function handleHoldCreate() {
    if (!selectedSheet) return
    if (!holdDraft.customerId.trim() || !holdDraft.companyName.trim()) {
      window.alert("고객번호와 고객사는 필수입니다.")
      return
    }
    const { latestData, latestTermination, latestSheet } = getLatestTerminationContext()
    if (!latestSheet) return
    if (hasDuplicateTerminationCustomerId(holdDraft.customerId, latestTermination)) {
      window.alert("중복된 ID가 존재합니다.")
      return
    }
    setHoldCreateStatus("saving")
    const nextItem = {
      id: `hold-${Date.now()}`,
      no: "0",
      receivedDate: normalizeDate(holdDraft.receivedDate),
      manager: holdDraft.manager.trim(),
      customerId: holdDraft.customerId.trim().toUpperCase(),
      companyName: holdDraft.companyName.trim(),
      departmentName: holdDraft.departmentName.trim(),
      reason: holdDraft.reason === "기타" && holdDraft.reasonDetail?.trim()
        ? `기타(${holdDraft.reasonDetail.trim()})`
        : holdDraft.reason,
      startDate: normalizeMonth(holdDraft.startDate),
      endDate: normalizeMonth(holdDraft.endDate),
      note: holdDraft.note?.trim() || "",
    }
    const nextSheets = (latestTermination.sheets || []).map((sheet: any) =>
      sheet.id === latestSheet.id
        ? {
            ...sheet,
            holdItems: [nextItem, ...(sheet.holdItems || [])],
            weeklyBillingHoldCount: (sheet.weeklyBillingHoldCount || 0) + 1,
          }
        : sheet,
    )
    try {
      await persistTerminationData(
        { ...latestData, termination: { ...latestTermination, currentSheetId: latestSheet.id, sheets: nextSheets } },
        { throwOnError: true },
      )
      resetHoldDraft()
      setHoldQuery("")
      setHoldReceivedDateFilter("all")
      setHoldEndDateFilter("all")
      setHoldSort({ key: "receivedDate", dir: "desc" })
      flashRecentRow(setRecentHoldId, nextItem.id)
      setHoldCreateStatus("success")
    } catch {
      setHoldCreateStatus("idle")
    }
  }

  function toggleTerminationSort(
    key:
      | "receivedDate"
      | "terminationDate"
      | "manager"
      | "customerId"
      | "companyName"
      | "departmentName"
      | "reason"
      | "penalty",
  ) {
    setTerminationSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    )
  }

  function toggleContractSort(key: ContractSortKey) {
    setContractSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    )
  }

  function toggleWeeklySelectionSort(
    key:
      | "includedInWeekly"
      | "no"
      | "companyName"
      | "departmentName"
      | "idCode"
      | "industry"
      | "contractMonth"
      | "recommender"
      | "documentStatus"
      | "replacementType",
  ) {
    setWeeklySelectionSort((prev) =>
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

  function toggleSelectAllConfirmed(checked: boolean) {
    if (checked) {
      setSelectedConfirmedIds(confirmedTerminationItems.map((row: any) => row.id))
      return
    }
    setSelectedConfirmedIds([])
  }

  function toggleSelectAllHoldItems(checked: boolean) {
    if (checked) {
      setSelectedHoldIds(filteredHoldItems.map((row: any) => row.id))
      return
    }
    setSelectedHoldIds([])
  }

  function toggleSelectAllReleased(checked: boolean) {
    if (checked) {
      setSelectedReleasedIds(releasedHoldItems.map((row: any) => row.id))
      return
    }
    setSelectedReleasedIds([])
  }

  function handleBulkRestoreConfirmed() {
    const { latestData, latestTermination, latestSheet } = getLatestTerminationContext()
    if (!latestSheet || selectedConfirmedIds.length === 0) return
    const confirmedItems = latestSheet.confirmedItems || []
    const restoreTargets = confirmedItems.filter((row: any) => selectedConfirmedIds.includes(row.id))
    if (!restoreTargets.length) return
    const selectedSet = new Set(selectedConfirmedIds)
    const nextSheets = (latestTermination.sheets || []).map((sheet: any) =>
      sheet.id === latestSheet.id
        ? {
            ...sheet,
            items: [...restoreTargets.map((row: any) => ({ ...row, selected: false })), ...(sheet.items || [])],
            confirmedItems: (sheet.confirmedItems || []).filter((row: any) => !selectedSet.has(row.id)),
          }
        : sheet,
    )
    persistTerminationData({ ...latestData, termination: { ...latestTermination, currentSheetId: latestSheet.id, sheets: nextSheets } })
    setSelectedConfirmedIds([])
  }

  function handleBulkRestoreReleased() {
    const { latestData, latestTermination, latestSheet } = getLatestTerminationContext()
    if (!latestSheet || selectedReleasedIds.length === 0) return
    const releasedItems = latestSheet.releasedHoldItems || []
    const restoreTargets = releasedItems.filter((row: any) => selectedReleasedIds.includes(row.id))
    if (!restoreTargets.length) return
    const selectedSet = new Set(selectedReleasedIds)
    const nextSheets = (latestTermination.sheets || []).map((sheet: any) =>
      sheet.id === latestSheet.id
        ? {
            ...sheet,
            holdItems: [...restoreTargets, ...(sheet.holdItems || [])],
            releasedHoldItems: (sheet.releasedHoldItems || []).filter((row: any) => !selectedSet.has(row.id)),
          }
        : sheet,
    )
    persistTerminationData({ ...latestData, termination: { ...latestTermination, currentSheetId: latestSheet.id, sheets: nextSheets } })
    setSelectedReleasedIds([])
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
    setEditingTerminationDraft((prev: any) => ({ ...prev, [field]: field === "customerId" ? String(value || "").trim().toUpperCase() : value }))
  }

  function mergeEditingTerminationRow(row: any) {
    if (editingTerminationId !== row?.id) return row
    return {
      ...row,
      receivedDate: normalizeDate(editingTerminationDraft.receivedDate),
      manager: editingTerminationDraft.manager?.trim() || "",
      customerId: editingTerminationDraft.customerId?.trim().toUpperCase() || "",
      companyName: editingTerminationDraft.companyName?.trim() || "",
      departmentName: editingTerminationDraft.departmentName?.trim() || "",
      reason:
        editingTerminationDraft.reason === "기타" && editingTerminationDraft.reasonDetail?.trim()
          ? `기타(${editingTerminationDraft.reasonDetail.trim()})`
          : editingTerminationDraft.reason,
      terminationDate: normalizeDate(editingTerminationDraft.terminationDate),
      penalty: toNumber(editingTerminationDraft.penalty),
    }
  }

  async function handleTerminationUpdate(rowId: string) {
    const { latestData, latestTermination, latestSheet } = getLatestTerminationContext()
    if (!latestSheet) return
    const nextSheets = (latestTermination.sheets || []).map((sheet: any) =>
      sheet.id === latestSheet.id
        ? {
            ...sheet,
            items: (sheet.items || []).map((row: any) =>
              row.id === rowId
                ? {
                    ...row,
                    receivedDate: normalizeDate(editingTerminationDraft.receivedDate),
                    manager: editingTerminationDraft.manager?.trim() || "",
                    customerId: editingTerminationDraft.customerId?.trim().toUpperCase() || "",
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
    try {
      await persistTerminationData(
        { ...latestData, termination: { ...latestTermination, currentSheetId: latestSheet.id, sheets: nextSheets } },
        { throwOnError: true },
      )
      setEditingTerminationId(null)
      setEditingTerminationDraft({})
    } catch {
      // persist() already restores the previous state and alerts the user on immediate save failures.
    }
  }

  function handleDeleteTerminationRow(rowId: string) {
    if (!selectedSheet) return
    if (!window.confirm("이 해지 건을 삭제할까요?")) return
    const { latestData, latestTermination, latestSheet } = getLatestTerminationContext()
    if (!latestSheet) return
    const nextSheets = (latestTermination.sheets || []).map((sheet: any) =>
      sheet.id === latestSheet.id
        ? {
            ...sheet,
            items: (sheet.items || []).filter((row: any) => row.id !== rowId),
            weeklyTerminationCount: Math.max(0, (sheet.weeklyTerminationCount || 0) - 1),
          }
        : sheet,
    )
    persistTerminationData({ ...latestData, termination: { ...latestTermination, currentSheetId: latestSheet.id, sheets: nextSheets } })
    if (editingTerminationId === rowId) {
      setEditingTerminationId(null)
      setEditingTerminationDraft({})
    }
  }

  function startHoldEdit(row: any) {
    const reasonText = String(row.reason || "")
    const parsedReasonDetail = reasonText.startsWith("기타(")
      ? reasonText.replace(/^기타\((.*)\)$/, "$1")
      : ""
    setEditingHoldId(row.id)
    setEditingHoldDraft({
      receivedDate: toInputDate(row.receivedDate),
      manager: row.manager || "",
      customerId: row.customerId || "",
      companyName: row.companyName || "",
      departmentName: row.departmentName || "",
      reason: reasonText.startsWith("기타(") ? "기타" : (row.reason || "사용자퇴사"),
      reasonDetail: parsedReasonDetail,
      startDate: toInputMonth(row.startDate),
      endDate: toInputMonth(row.endDate),
      note: row.note || "",
    })
  }

  function updateEditingHoldDraft(field: string, value: string) {
    setEditingHoldDraft((prev: any) => ({ ...prev, [field]: field === "customerId" ? String(value || "").trim().toUpperCase() : value }))
  }

  function mergeEditingHoldRow(row: any) {
    if (editingHoldId !== row?.id) return row
    return {
      ...row,
      receivedDate: normalizeDate(editingHoldDraft.receivedDate),
      manager: editingHoldDraft.manager?.trim() || "",
      customerId: editingHoldDraft.customerId?.trim().toUpperCase() || "",
      companyName: editingHoldDraft.companyName?.trim() || "",
      departmentName: editingHoldDraft.departmentName?.trim() || "",
      reason: editingHoldDraft.reason === "기타" && editingHoldDraft.reasonDetail?.trim()
        ? `기타(${editingHoldDraft.reasonDetail.trim()})`
        : editingHoldDraft.reason,
      startDate: normalizeMonth(editingHoldDraft.startDate),
      endDate: normalizeMonth(editingHoldDraft.endDate),
      note: editingHoldDraft.note?.trim() || "",
    }
  }

  function getLatestTerminationContext() {
    const latestData = pendingDataRef.current || data
    const latestTermination = latestData?.termination || termination
    const latestSheet = (latestTermination.sheets || []).find((sheet: any) => sheet.id === selectedSheet?.id) || selectedSheet
    return { latestData, latestTermination, latestSheet }
  }

  async function handleHoldUpdate(rowId: string) {
    const { latestData, latestTermination, latestSheet } = getLatestTerminationContext()
    if (!latestSheet) return
    const nextSheets = (latestTermination.sheets || []).map((sheet: any) =>
      sheet.id === latestSheet.id
        ? {
            ...sheet,
            holdItems: (sheet.holdItems || []).map((row: any) =>
              row.id === rowId
                ? {
                    ...row,
                    receivedDate: normalizeDate(editingHoldDraft.receivedDate),
                    manager: editingHoldDraft.manager?.trim() || "",
                    customerId: editingHoldDraft.customerId?.trim().toUpperCase() || "",
                    companyName: editingHoldDraft.companyName?.trim() || "",
                    departmentName: editingHoldDraft.departmentName?.trim() || "",
                    reason: editingHoldDraft.reason === "기타" && editingHoldDraft.reasonDetail?.trim()
                      ? `기타(${editingHoldDraft.reasonDetail.trim()})`
                      : editingHoldDraft.reason,
                    startDate: normalizeMonth(editingHoldDraft.startDate),
                    endDate: normalizeMonth(editingHoldDraft.endDate),
                    note: editingHoldDraft.note?.trim() || "",
                  }
                : row,
            ),
          }
        : sheet,
    )
    try {
      await persistTerminationData(
        { ...latestData, termination: { ...latestTermination, currentSheetId: latestSheet.id, sheets: nextSheets } },
        { throwOnError: true },
      )
      setEditingHoldId(null)
      setEditingHoldDraft({})
    } catch {
      // persist() already restores the previous state and alerts the user on immediate save failures.
    }
  }

  function handleDeleteHoldRow(rowId: string) {
    if (!selectedSheet) return
    if (!window.confirm("이 청구보류 건을 삭제할까요?")) return
    const { latestData, latestTermination, latestSheet } = getLatestTerminationContext()
    if (!latestSheet) return
    const nextSheets = (latestTermination.sheets || []).map((sheet: any) =>
      sheet.id === latestSheet.id
        ? {
            ...sheet,
            holdItems: (sheet.holdItems || []).filter((row: any) => row.id !== rowId),
            weeklyBillingHoldCount: Math.max(0, (sheet.weeklyBillingHoldCount || 0) - 1),
          }
        : sheet,
    )
    persistTerminationData({ ...latestData, termination: { ...latestTermination, currentSheetId: latestSheet.id, sheets: nextSheets } })
    if (editingHoldId === rowId) {
      setEditingHoldId(null)
      setEditingHoldDraft({})
    }
  }

  function handleReleaseHoldRow(rowId: string) {
    const { latestData, latestTermination, latestSheet } = getLatestTerminationContext()
    if (!latestSheet) return
    const row = mergeEditingHoldRow((latestSheet.holdItems || []).find((item: any) => item.id === rowId))
    if (!row) return
    const nextSheets = (latestTermination.sheets || []).map((sheet: any) =>
      sheet.id === latestSheet.id
        ? {
            ...sheet,
            holdItems: (sheet.holdItems || []).filter((item: any) => item.id !== rowId),
            releasedHoldItems: [
              { ...row, reflectedDate: normalizeDate(new Date().toISOString().slice(0, 10)) },
              ...(sheet.releasedHoldItems || []),
            ],
          }
        : sheet,
    )
    persistTerminationData({ ...latestData, termination: { ...latestTermination, currentSheetId: latestSheet.id, sheets: nextSheets } })
    if (editingHoldId === rowId) {
      setEditingHoldId(null)
      setEditingHoldDraft({})
    }
  }

  function handleReleaseSelectedHoldRows() {
    const { latestData, latestTermination, latestSheet } = getLatestTerminationContext()
    if (!latestSheet || selectedHoldIds.length === 0) return
    const selectedSet = new Set(selectedHoldIds)
    const releaseTargets = (latestSheet.holdItems || [])
      .filter((item: any) => selectedSet.has(item.id))
      .map((item: any) => mergeEditingHoldRow(item))
    if (!releaseTargets.length) return
    const reflectedDate = normalizeDate(new Date().toISOString().slice(0, 10))
    const nextSheets = (latestTermination.sheets || []).map((sheet: any) =>
      sheet.id === latestSheet.id
        ? {
            ...sheet,
            holdItems: (sheet.holdItems || []).filter((item: any) => !selectedSet.has(item.id)),
            releasedHoldItems: [
              ...releaseTargets.map((row: any) => ({ ...row, reflectedDate })),
              ...(sheet.releasedHoldItems || []),
            ],
          }
        : sheet,
    )
    persistTerminationData({ ...latestData, termination: { ...latestTermination, currentSheetId: latestSheet.id, sheets: nextSheets } })
    if (editingHoldId && selectedSet.has(editingHoldId)) {
      setEditingHoldId(null)
      setEditingHoldDraft({})
    }
    setSelectedHoldIds([])
  }

  function restoreReleasedHoldRow(rowId: string) {
    const { latestData, latestTermination, latestSheet } = getLatestTerminationContext()
    if (!latestSheet) return
    const row = (latestSheet.releasedHoldItems || []).find((item: any) => item.id === rowId)
    if (!row) return
    const nextSheets = (latestTermination.sheets || []).map((sheet: any) =>
      sheet.id === latestSheet.id
        ? {
            ...sheet,
            holdItems: [{ ...row }, ...(sheet.holdItems || [])],
            releasedHoldItems: (sheet.releasedHoldItems || []).filter((item: any) => item.id !== rowId),
          }
        : sheet,
    )
    persistTerminationData({ ...latestData, termination: { ...latestTermination, currentSheetId: latestSheet.id, sheets: nextSheets } })
  }

  function handleMoveHoldToTermination(rowId: string) {
    const { latestData, latestTermination, latestSheet } = getLatestTerminationContext()
    if (!latestSheet) return
    const row = mergeEditingHoldRow((latestSheet.holdItems || []).find((item: any) => item.id === rowId))
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
    const nextSheets = (latestTermination.sheets || []).map((sheet: any) =>
      sheet.id === latestSheet.id
        ? {
            ...sheet,
            items: [movedItem, ...(sheet.items || [])],
            holdItems: (sheet.holdItems || []).filter((item: any) => item.id !== rowId),
            weeklyTerminationCount: (sheet.weeklyTerminationCount || 0) + 1,
            weeklyBillingHoldCount: Math.max(0, (sheet.weeklyBillingHoldCount || 0) - 1),
          }
        : sheet,
    )
    persistTerminationData({ ...latestData, termination: { ...latestTermination, currentSheetId: latestSheet.id, sheets: nextSheets } })
    if (editingHoldId === rowId) {
      setEditingHoldId(null)
      setEditingHoldDraft({})
    }
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

  const receivedDatePickerOnlyProps = {
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Tab" || event.key === "Escape") return
      event.preventDefault()
    },
    onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => event.preventDefault(),
    onDrop: (event: React.DragEvent<HTMLInputElement>) => event.preventDefault(),
    onClick: (event: React.MouseEvent<HTMLInputElement>) => {
      try {
        ;(event.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
      } catch {}
    },
  }

  function handleManualInputKeyDownCapture(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter") return
    if ((event.nativeEvent as KeyboardEvent).isComposing) return
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return
    event.preventDefault()
    target.blur()
  }

  function handleManualUpdate() {
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLInputElement) {
      document.activeElement.blur()
    }
    if (typeof window !== "undefined") {
      if (manualSaveTimerRef.current) window.clearTimeout(manualSaveTimerRef.current)
      manualSaveTimerRef.current = window.setTimeout(() => {
        manualSaveTimerRef.current = null
        runManualUpdate()
      }, 0)
      return
    }
    runManualUpdate()
  }

  function runManualUpdate() {
    startTransition(async () => {
      const draft = manualPreviewDraftRef.current || manualDraftRef.current || manualDraft
      const latestData = pendingDataRef.current || data
      const latestWeeklyReport = latestData?.weeklyReport || weeklyReport
      const normalizedRevenueRows = buildRevenueRowsWithComputedTotal(draft.revenueRows || [])
      const draftSummary = applyWeeklyAutoSummary(draft.manualSummary || {})
      const draftRevenueDisplay = buildRevenueDisplaySet({
        revenueHeaderText: draft.revenueHeaderText,
        subtitleOne: draft.subtitleOne,
        subtitleTwo: draft.subtitleTwo,
        revenueUnitPrice: draft.revenueUnitPrice,
        additionalContractCount: draft.additionalContractCount,
        additionalSales: draft.additionalSales || [],
        manualSummary: draftSummary,
        revenueRows: normalizedRevenueRows,
        fallbackSelectedCount: weeklyNetAutoCount,
      })
      const nextManualDraft = {
        ...draft,
        revenueRows: cloneData(normalizedRevenueRows),
        terminationOverviewRows: cloneData(buildTerminationOverviewRowsWithComputedTotals(draft.terminationOverviewRows || [])),
      }
      const nextWeekly = {
        ...latestWeeklyReport,
        // Persist the exact values currently shown in the manual input view so
        // weekly report behaves like an Excel cell reference.
        revenueHeaderText: draftRevenueDisplay.header,
        revenueUnitPrice: toNumber(draft.revenueUnitPrice),
        additionalContractCount: toNumber(draft.additionalContractCount),
        subtitleOne: draftRevenueDisplay.subtitleOne,
        subtitleTwo: draftRevenueDisplay.subtitleTwo,
        revenueNoteText: draft.revenueNoteText,
        manualSummary: draftSummary,
        revenueRows: cloneData(normalizedRevenueRows),
        goalRows: cloneData(buildGoalRows(draft.goalRows || [])),
        industryStats: cloneData(draft.industryStats || []),
        paidOptionInfoColumns: cloneData(draft.paidOptionInfoColumns || []),
        terminationOverviewRows: cloneData(nextManualDraft.terminationOverviewRows || []),
        weeklyIndustryOverviewRows: cloneData(draft.weeklyIndustryOverviewRows || []),
        additionalSales: normalizeAdditionalSalesRows(cloneData(draft.additionalSales || [])),
      }
      try {
        isSyncingManualDraftRef.current = true
        manualDraftRef.current = nextManualDraft
        setManualDraft(nextManualDraft)
        manualPreviewDraftRef.current = nextManualDraft
        setManualPreviewDraft(nextManualDraft)
        await persist(
          { ...latestData, weeklyReport: nextWeekly },
          { immediate: true, updatedViews: ["manual-input", "weekly-report"] },
        )
        isSyncingManualDraftRef.current = true
        manualPreviewDraftRef.current = null
        setManualPreviewDraft(null)
      } catch {
        window.alert("Save failed. Please do not refresh; try Update again in a moment.")
      }
    })
  }

  async function handleSaveCurrentView() {
    if (view === "manual-input") {
      handleManualUpdate()
      return
    }
    if (isSavingDashboard) return
    setIsSavingDashboard(true)
    try {
      await commitDashboardData(pendingDataRef.current || data, [view])
    } catch {
      window.alert("저장에 실패했습니다. 잠시 후 다시 시도해주세요.")
    } finally {
      setIsSavingDashboard(false)
    }
  }

  const reportGoalRows = buildGoalRows(weeklyReport.goalRows || [])
  const reportIndustryStats = buildIndustryStats(weeklyReport.industryStats || [])
  const manualDisplayDraft = manualPreviewDraft || manualDraft
  const autoManualSummary = useMemo(
    () => applyWeeklyAutoSummary(manualDisplayDraft.manualSummary || {}),
    [
      manualDisplayDraft.manualSummary,
      weeklyNetAutoCount,
      weeklyNewContractAutoCount,
      weeklyTerminationAutoCount,
    ],
  )
  const autoWeeklyReportSummary = useMemo(
    () => applyWeeklyAutoSummary(weeklyReport.manualSummary || {}),
    [
      weeklyReport.manualSummary,
      weeklyNetAutoCount,
      weeklyNewContractAutoCount,
      weeklyTerminationAutoCount,
    ],
  )
  const reportSummary = {
    ...autoWeeklyReportSummary,
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
  const manualRevenueDisplay = useMemo(
    () =>
      buildRevenueDisplaySet({
        revenueHeaderText: manualDisplayDraft.revenueHeaderText,
        subtitleOne: manualDisplayDraft.subtitleOne,
        subtitleTwo: manualDisplayDraft.subtitleTwo,
        revenueUnitPrice: manualDisplayDraft.revenueUnitPrice,
        additionalContractCount: manualDisplayDraft.additionalContractCount,
        additionalSales: manualDisplayDraft.additionalSales || [],
        manualSummary: autoManualSummary,
        revenueRows: manualDisplayDraft.revenueRows || [],
        fallbackSelectedCount: weeklyNetAutoCount,
      }),
    [
      manualDisplayDraft.revenueHeaderText,
      manualDisplayDraft.subtitleOne,
      manualDisplayDraft.subtitleTwo,
      manualDisplayDraft.revenueUnitPrice,
      manualDisplayDraft.additionalContractCount,
      manualDisplayDraft.additionalSales,
      autoManualSummary,
      manualDisplayDraft.revenueRows,
      weeklyNetAutoCount,
    ],
  )
  const manualRevenueHeaderText = manualRevenueDisplay.header
  const manualRevenueSubtitleOne = manualRevenueDisplay.subtitleOne
  const manualRevenueSubtitleTwo = manualRevenueDisplay.subtitleTwo
  const manualRevenueRows = useMemo(
    () => buildRevenueRowsWithComputedTotal(manualDisplayDraft.revenueRows || []),
    [manualDisplayDraft.revenueRows],
  )
  const reportRevenueDisplay = buildRevenueDisplaySet({
    revenueHeaderText: weeklyReport.revenueHeaderText,
    subtitleOne: weeklyReport.subtitleOne,
    subtitleTwo: weeklyReport.subtitleTwo,
    revenueUnitPrice: weeklyReport.revenueUnitPrice,
    additionalContractCount: weeklyReport.additionalContractCount,
    additionalSales: weeklyReport.additionalSales || [],
    manualSummary: autoWeeklyReportSummary,
    revenueRows: weeklyReport.revenueRows || [],
    fallbackSelectedCount: weeklyNetAutoCount,
  })
  // Weekly report should reference the persisted manual-input values, just like
  // an Excel cell reference to saved cells.
  const reportRevenueRows = useMemo(
    () => buildRevenueRowsWithComputedTotal(weeklyReport.revenueRows || []),
    [weeklyReport.revenueRows],
  )
  const displayBaseDate = formatDateDashed(getUpcomingThursday())
  const revenueHeaderText = reportRevenueDisplay.header
  const revenueSubtitleOne = reportRevenueDisplay.subtitleOne
  const revenueSubtitleTwo = reportRevenueDisplay.subtitleTwo
  const revenueNoteText = buildRevenueNoteText(displayBaseDate, weeklyReport?.revenueUnitPrice)
  const revenueHeaderMetric = splitRevenueMetric(revenueHeaderText, "주간 순증 매출")
  const revenueSubtitleMetricOne = splitRevenueMetric(revenueSubtitleOne, "26년 순증 매출")
  const revenueSubtitleMetricTwo = splitRevenueMetric(revenueSubtitleTwo, "연간 누적 매출 (추정)")
  const revenueNoteParts = splitRevenueNoteText(revenueNoteText)
  const manualSummary = autoManualSummary
  const monthLabels = useMemo(() => Array.from({ length: 12 }, (_, index) => `${index + 1}월`), [])
  const paidOptionColumns = buildPaidOptionInfoColumns(weeklyReport.paidOptionInfoColumns || [])
  const manualPaidOptionColumns = useMemo(
    () => buildPaidOptionInfoColumns(manualDisplayDraft.paidOptionInfoColumns || []),
    [manualDisplayDraft.paidOptionInfoColumns],
  )
  const reportTerminationColumns = [...reportTerminationColumnsStatic]
  const reportTerminationRows = useMemo(
    () => buildTerminationOverviewRowsWithComputedTotals(weeklyReport.terminationOverviewRows || []),
    [weeklyReport.terminationOverviewRows],
  )
  const manualTerminationOverviewRows = useMemo(
    () => buildTerminationOverviewRowsWithComputedTotals(manualDisplayDraft.terminationOverviewRows || []),
    [manualDisplayDraft.terminationOverviewRows],
  )
  const reportIndustryColumns = [...reportIndustryColumnsStatic]
  const reportIndustryRows = buildWeeklyIndustryOverviewRows(weeklyReport.weeklyIndustryOverviewRows || [])
  const currentMenuUpdatedAt = data?.ui?.menuUpdatedAt?.[view]
  const currentViewDirty = Boolean(dirtyViews[view])
  const hasUnsavedChanges = Object.values(dirtyViews).some(Boolean)
  const showHeaderSave = !["daily-report", "weekly-report", "contracts", "weekly-selection", "manual-input", "termination"].includes(view)

  const manualRevenueSection = useMemo(
    () => (
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className={manualSectionTitleClass}>매출 자동계산 설정</div>
          </div>
        </div>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_180px_280px]">
          <label className="space-y-1.5">
            <div className="text-[12px] font-semibold text-slate-500">
              매출 헤더 <span className="text-amber-600">(자동계산)</span>
              {calcHint("(주간반영 선택계약수 × 단가) + 추가계약 금액")}
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
              {calcHint("주간 순증 매출 계산식에 곱해지는 기준 단가")}
            </div>
            <BufferedManualInput
              className="h-10 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 text-[14px]"
              inputMode="numeric"
              value={formatNumericInputDisplay(manualDisplayDraft.revenueUnitPrice)}
              onDirty={markManualInputDirty}
              onLiveChange={(value) => previewManualField("revenueUnitPrice", value)}
              onCommit={(value) => updateManualField("revenueUnitPrice", value)}
            />
          </label>
          <div className="space-y-1.5">
            <div className="text-[12px] font-semibold text-slate-500">
              추가 계약 금액
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <BufferedManualInput
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px]"
                inputMode="numeric"
                placeholder="예: 1,000,000"
                value={formatNumericInputDisplay(manualDisplayDraft.additionalContractCount)}
                onDirty={markManualInputDirty}
                onLiveChange={(value) => previewManualField("additionalContractCount", value)}
                onCommit={(value) => updateManualField("additionalContractCount", value)}
              />
              <button
                type="button"
                onClick={appendAdditionalContractAmountToSales}
                className="h-10 rounded-xl bg-blue-600 px-4 text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(37,99,235,0.16)] hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          <label className="space-y-1.5">
            <div className="text-[12px] font-semibold text-slate-500">
              연간 순증 매출 <span className="text-amber-600">(자동계산)</span>
              {calcHint("누적순증 합계(단말기 순증 및 해지) × 단가 + ((매출 자동계산 설정 표의 합계 - 매출순증) × 1,000,000)")}
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
              {calcHint("총 계약대수 × 단가")}
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
              {(() => {
                const baseRows = manualRevenueRows.filter((row) => row.label !== "합계")
                const revenueTotalMonths = monthLabels.map((_, monthIndex) =>
                  baseRows.some((row) => String(row.months?.[monthIndex] ?? "").trim() !== "")
                    ? baseRows.reduce((sum: number, row) => sum + toNumber(row.months?.[monthIndex]), 0)
                    : "",
                )
                return manualRevenueRows.map((row, rowIndex) => {
                  const isTotalRow = row.label === "합계"
                  const displayMonths = isTotalRow
                    ? revenueTotalMonths
                    : monthLabels.map((_, monthIndex) => row.months?.[monthIndex] ?? "")
                  const total = (displayMonths || []).reduce((sum: number, value: unknown) => sum + toNumber(value), 0)
                  return (
                    <tr key={row.key || rowIndex}>
                      <td className={manualLabelCellClass}>{row.label}</td>
                      {(displayMonths || []).map((monthValue: unknown, monthIndex: number) => (
                        <td key={`${row.key}-${monthIndex}`} className={`${tdClass} p-1`}>
                          <BufferedManualInput
                            className={`${manualTableInputClass} ${isTotalRow ? "font-semibold text-slate-900" : ""}`}
                            style={isTotalRow ? { backgroundColor: "#fffbeb", borderColor: "#fcd34d" } : undefined}
                            value={String(monthValue ?? "")}
                            onDirty={markManualInputDirty}
                            onLiveChange={(value) => previewManualRevenueCell(rowIndex, monthIndex, value)}
                            onCommit={(value) => updateManualRevenueCell(rowIndex, monthIndex, value)}
                            readOnly={isTotalRow}
                          />
                        </td>
                      ))}
                      <td className={`${tdClass} w-[96px] text-center font-semibold bg-amber-50 text-slate-900`}>
                        {formatNumber(total)}
                      </td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        </div>
      </div>
    ),
    [
      manualRevenueHeaderText,
      manualRevenueSubtitleOne,
      manualRevenueSubtitleTwo,
      manualDisplayDraft.revenueUnitPrice,
      manualDisplayDraft.additionalContractCount,
      manualDisplayDraft.revenueRows,
      manualRevenueRows,
      monthLabels,
    ],
  )

  const manualSummaryMatrixSection = useMemo(
    () => (
      <div className="space-y-3">
        {manualSummaryMatrixRows.map((section) => (
          <div key={section.title} className="overflow-hidden rounded-2xl border border-slate-200">
            <table className={tableClass}>
              <colgroup>
                {section.cells.length === 7 ? (
                  <>
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "24%" }} />
                  </>
                ) : (
                  <>
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "44%" }} />
                  </>
                )}
              </colgroup>
              <tbody>
                <tr>
                  <th className={`${manualHeaderCellClass} w-[220px] text-[15px] font-bold`}>{section.title}</th>
                  {section.cells.map(([label]) => (
                    <th key={`${section.title}-${label}`} className={manualHeaderCellClass}>{label}</th>
                  ))}
                </tr>
                <tr>
                  <td className={`${tdClass} bg-white`} />
                  {section.cells.map(([label, field], cellIndex) => {
                    const isAutoField = manualSummaryAutoFields.has(field)
                    return (
                      <td key={`${section.title}-${field}`} className={`${tdClass} p-1`}>
                        <BufferedManualInput
                          className={`${manualTableInputClass} ${isAutoField ? "cursor-not-allowed font-bold text-slate-900" : ""} ${section.cells.length === 4 && cellIndex === section.cells.length - 1 ? "text-left px-4" : ""}`}
                          style={isAutoField ? { backgroundColor: "#fffbeb", borderColor: "#fcd34d" } : undefined}
                          value={String(manualSummary?.[field] ?? "")}
                          readOnly={isAutoField}
                          onDirty={markManualInputDirty}
                          onLiveChange={(value) => previewManualSummaryField(field, value)}
                          onCommit={(value) => updateManualSummaryField(field, value)}
                        />
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>
    ),
    [manualSummary],
  )

  const manualGoalSection = useMemo(
    () => (
      <ManualGoalInputTable
        currentYear={currentYear}
        rows={manualDisplayDraft.goalRows || []}
        onCommitCell={updateManualGoalRow}
        onDirty={markManualInputDirty}
      />
    ),
    [currentYear, manualDisplayDraft.goalRows],
  )

  const manualPaidOptionSection = useMemo(
    () => (
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className={tableClass}>
          <thead>
            <tr>
              <th colSpan={Math.max(1, manualPaidOptionColumns.length)} className={manualTableTitleRowClass}>
                <div className="flex items-center justify-between gap-3">
                  <span>유료 옵션 정보</span>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[12px] font-semibold tracking-[-0.01em] text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                    onClick={reloadPaidOptionInfo}
                  >
                    옵션정보 불러오기
                  </button>
                </div>
              </th>
            </tr>
            <tr>
              {manualPaidOptionColumns.map((column, columnIndex) => (
                <th key={`manual-paid-option-title-${column.id}-${columnIndex}`} className={manualHeaderCellClass}>
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {manualPaidOptionColumns.map((column, columnIndex) => (
                <td key={`manual-paid-option-total-${column.id}-${columnIndex}`} className={`${tdClass} text-center font-semibold`}>
                  {column.total}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    ),
    [manualPaidOptionColumns],
  )

  const manualTerminationOverviewSection = useMemo(
    () => (
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className={tableClass}>
          <colgroup>
            <col style={{ width: "88px" }} />
            {reportTerminationColumnsStatic.map((column) => (
              <col key={`manual-termination-col-${column}`} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th colSpan={reportTerminationColumnsStatic.length + 1} className={manualTableTitleRowClass}>
                <div className="flex items-center justify-between gap-3">
                  <span>
                    {currentYear}년 해지 현황 ({String(displayBaseDate || "").replace(/^\d{4}-(\d{2})-(\d{2})$/, "$1/$2")} 기준)
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] font-semibold tracking-[-0.01em] text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={loadTerminationOverviewFromWeeklyList}
                  >
                    해지확정현황 불러오기
                  </button>
                </div>
              </th>
            </tr>
            <tr>
              {["구분", ...reportTerminationColumnsStatic].map((head) => (
                <th key={head} className={manualHeaderCellClass}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {manualTerminationOverviewRows.map((row: any, rowIndex: number) => (
              <tr key={`manual-termination-overview-${row.label}`}>
                <td className={`${tdClass} whitespace-nowrap text-center font-semibold`}>{row.label}</td>
                {reportTerminationColumnsStatic.map((column, valueIndex) => {
                  const isTotalColumn = column === "합계"
                  const storedTotalValue = row.values?.[valueIndex]
                  const totalValue = isTotalColumn
                    ? String(storedTotalValue ?? "").trim() || computeTerminationRowTotal((row.values || []).slice(0, reportTerminationColumnsStatic.length - 1))
                    : null
                  return (
                    <td key={`${row.label}-${column}`} className={`${tdClass} p-1`}>
                      <BufferedManualInput
                        className={manualTableInputClass}
                        style={{ backgroundColor: "#fffbeb", borderColor: "#fcd34d" }}
                        value={isTotalColumn ? String(totalValue ?? "") : String(row.values?.[valueIndex] ?? "")}
                        onDirty={markManualInputDirty}
                        onCommit={(value) => updateManualTerminationOverviewCell(rowIndex, valueIndex, value)}
                        readOnly
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    [currentYear, displayBaseDate, manualTerminationOverviewRows],
  )

  const manualWeeklyIndustrySection = useMemo(
    () => (
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className={tableClass}>
          <colgroup>
            <col style={{ width: "88px" }} />
            {reportIndustryColumnsStatic.map((column) => (
              <col key={`manual-industry-col-${column}`} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th colSpan={reportIndustryColumnsStatic.length + 1} className={manualTableTitleRowClass}>
                {replaceDivisionName(`정보사업본부 업종별 실적 현황 (${String(displayBaseDate || "").replace(/^\d{4}-(\d{2})-(\d{2})$/, "$1/$2")} 기준)`)}
              </th>
            </tr>
            <tr>
              {["구분", ...reportIndustryColumnsStatic].map((head) => (
                <th key={head} className={manualHeaderCellClass}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(manualDisplayDraft.weeklyIndustryOverviewRows || []).map((row: any, rowIndex: number) => (
              <tr key={`manual-weekly-industry-${row.label}`}>
                <td className={`${tdClass} whitespace-nowrap text-center font-semibold`}>{row.label}</td>
                {reportIndustryColumnsStatic.map((column, valueIndex) => {
                  const normalizedValues = normalizeIndustryRowValues(row.values || [])
                  const isTotalColumn = column === "합계"
                  const totalValue = isTotalColumn
                    ? computeIndustryRowTotal(normalizedValues.slice(0, reportIndustryColumnsStatic.length - 1))
                    : null
                  return (
                    <td key={`${row.label}-${column}`} className={`${tdClass} p-1`}>
                      <BufferedManualInput
                        className={manualTableInputClass}
                        style={
                          isTotalColumn
                            ? { backgroundColor: "#fffbeb", borderColor: "#fcd34d" }
                            : undefined
                        }
                        value={isTotalColumn ? String(totalValue ?? "") : String(normalizedValues[valueIndex] ?? "")}
                        onDirty={markManualInputDirty}
                        onLiveChange={(value) => previewManualWeeklyIndustryOverviewCell(rowIndex, valueIndex, value)}
                        onCommit={(value) => updateManualWeeklyIndustryOverviewCell(rowIndex, valueIndex, value)}
                        readOnly={isTotalColumn}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    [displayBaseDate, manualDisplayDraft.weeklyIndustryOverviewRows],
  )

  const manualAdditionalSalesSection = useMemo(
    () => (
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className={`${tableClass} min-w-[760px]`}>
            <colgroup>
              <col style={{ width: "56px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "180px" }} />
              <col />
              <col style={{ width: "72px" }} />
            </colgroup>
            <thead>
              <tr>
                <th colSpan={7} className={manualTableTitleRowClass}>
                  <div className="flex items-center justify-between gap-3">
                    <span>추가 매출</span>
                    <button
                      type="button"
                      onClick={addAdditionalSaleRow}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold tracking-[-0.01em] text-slate-700 transition hover:bg-slate-50"
                    >
                      행 추가
                    </button>
                  </div>
                </th>
              </tr>
              <tr>
                <th className={manualHeaderCellClass}>No.</th>
                <th className={manualHeaderCellClass}>ID</th>
                <th className={manualHeaderCellClass}>회사</th>
                <th className={manualHeaderCellClass}>금액</th>
                <th className={manualHeaderCellClass}>내용</th>
                <th className={manualHeaderCellClass}>비고</th>
                <th className={manualHeaderCellClass}>관리</th>
              </tr>
            </thead>
            <tbody>
              {normalizeAdditionalSalesRows(manualDisplayDraft.additionalSales || []).map((row: any, rowIndex: number) => (
                <tr key={`manual-additional-${rowIndex}`} className="bg-white">
                  <td className={`${tdClass} px-2 text-center font-semibold text-blue-700`}>{rowIndex + 1}</td>
                  <td className={`${tdClass} p-1`}>
                    <BufferedManualInput className={manualTableTextInputClass} placeholder="ID" value={String(row.idCode ?? "")} onDirty={markManualInputDirty} onLiveChange={(value) => previewAdditionalSaleRow(rowIndex, "idCode", value)} onCommit={(value) => updateAdditionalSaleRow(rowIndex, "idCode", value)} />
                  </td>
                  <td className={`${tdClass} p-1`}>
                    <BufferedManualInput className={manualTableTextInputClass} placeholder="회사" value={String(row.company ?? "")} onDirty={markManualInputDirty} onLiveChange={(value) => previewAdditionalSaleRow(rowIndex, "company", value)} onCommit={(value) => updateAdditionalSaleRow(rowIndex, "company", value)} />
                  </td>
                  <td className={`${tdClass} p-1`}>
                    <BufferedManualInput className={manualTableInputClass} placeholder="금액" value={String(row.amount ?? "")} onDirty={markManualInputDirty} onLiveChange={(value) => previewAdditionalSaleRow(rowIndex, "amount", value)} onCommit={(value) => updateAdditionalSaleRow(rowIndex, "amount", value)} />
                  </td>
                  <td className={`${tdClass} p-1`}>
                    <BufferedManualInput className={manualTableTextInputClass} placeholder="내용" value={String(row.content ?? "")} onDirty={markManualInputDirty} onLiveChange={(value) => previewAdditionalSaleRow(rowIndex, "content", value)} onCommit={(value) => updateAdditionalSaleRow(rowIndex, "content", value)} />
                  </td>
                  <td className={`${tdClass} p-1`}>
                    <BufferedManualInput className={manualTableTextInputClass} placeholder="비고" value={String(row.note ?? "")} onDirty={markManualInputDirty} onLiveChange={(value) => previewAdditionalSaleRow(rowIndex, "note", value)} onCommit={(value) => updateAdditionalSaleRow(rowIndex, "note", value)} />
                  </td>
                  <td className={`${tdClass} p-1 text-center`}>
                    <button type="button" onClick={() => deleteAdditionalSaleRow(rowIndex)} className="inline-flex h-8 items-center rounded-full border border-rose-200 bg-white px-2.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
    [manualDisplayDraft.additionalSales],
  )

  return (
    <div className="dashboard-shell min-h-screen bg-[#f6f8fc] text-slate-900">
      {popupMessages.length > 0 ? (
        <div className="fixed bottom-4 right-4 z-[70] w-[min(360px,calc(100vw-32px))] space-y-2">
          {popupMessages.slice(0, 3).map((message) => (
            <div key={message.id} className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl shadow-slate-900/12">
              <div className="flex items-start gap-3 border-b border-slate-100 bg-blue-50/70 px-4 py-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-black text-slate-950">{message.title || "업무 알림"}</div>
                  <div className="mt-0.5 truncate text-[12px] font-semibold text-blue-700">{message.senderName || "시스템"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void acknowledgePopupMessage(message.id)}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-700"
                  aria-label="팝업 메시지 닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-4 py-3">
                <div className="whitespace-pre-wrap break-words text-[13px] leading-5 text-slate-700">{message.body}</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void replyToPopupMessage(message)}
                    className="h-9 rounded-xl bg-blue-600 text-[13px] font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!message.senderUserId || message.senderUserId === currentUser?.id}
                  >
                    답장
                  </button>
                  <button
                    type="button"
                    onClick={() => void acknowledgePopupMessage(message.id)}
                    className="h-9 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mx-auto flex min-h-screen max-w-[1720px]">
        <button
          type="button"
          aria-label="사이드바 닫기"
          onClick={() => setIsSidebarOpen(false)}
          className={`fixed inset-0 z-30 bg-slate-950/25 transition-opacity duration-200 lg:hidden ${
            isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />
          <aside
            className={`dashboard-sidebar fixed inset-y-0 left-0 z-40 flex w-[286px] max-w-[calc(100vw-24px)] flex-col border-r border-slate-200 bg-white px-4 py-4 shadow-xl transition-transform duration-200 lg:static lg:z-auto lg:w-[272px] lg:max-w-none lg:translate-x-0 lg:shadow-none ${
              isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="relative overflow-visible px-1 pt-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                <img
                  src="/yonhapinfomax-logo.png"
                  alt="연합인포맥스"
                  className="h-7 w-auto shrink-0 object-contain"
                />
                <div className="truncate text-[15px] font-black tracking-[-0.04em] text-slate-900">인포Biz본부</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 lg:hidden"
                  aria-label="사이드바 닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {currentUser ? (
                <>
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen((prev) => {
                          const next = !prev
                          if (!next) setIsPasswordOpen(false)
                          return next
                        })
                      }}
                      className="flex w-full items-center gap-2.5 rounded-2xl px-1 py-1.5 text-left transition hover:bg-slate-50"
                    >
                      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[22px] shadow-sm">
                        {avatarLabel}
                        <span
                          className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${getPresenceDotClass(currentPresenceStatus)}`}
                          aria-label={getPresenceLabel(currentPresenceStatus)}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-black tracking-[-0.04em] text-slate-950">{currentUser.name}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                            {currentUser.role}
                          </span>
                          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                            {currentUser.teamName}
                          </span>
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-slate-400 transition duration-200 ${isUserMenuOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>

                  <div
                    className={`overflow-hidden transition-all duration-200 ease-out ${
                      isUserMenuOpen ? "mt-3 max-h-[420px] opacity-100" : "mt-0 max-h-0 opacity-0"
                    }`}
                  >
                    <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                      <div className="space-y-1">
                        <a
                          href="/me"
                          onClick={() => {
                            setIsUserMenuOpen(false)
                            setIsPasswordOpen(false)
                            setIsSidebarOpen(false)
                          }}
                          className="flex h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left text-slate-700 transition hover:bg-slate-50"
                        >
                          <UserRound className="ml-1 h-[18px] w-[18px] text-slate-400" />
                          <span className="flex-1 text-[14px] font-bold tracking-[-0.03em] text-slate-800">내 페이지</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setManualPresenceStatus((prev) => {
                              const next = prev === "away" ? null : "away"
                              if (!next) {
                                lastActivityAtRef.current = Date.now()
                              }
                              return next
                            })
                          }}
                          className="flex h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left text-slate-700 transition hover:bg-slate-50"
                        >
                          <span className={`ml-1 h-2.5 w-2.5 rounded-full ${manualPresenceStatus === "away" ? "bg-amber-400" : "bg-emerald-500"}`} />
                          <span className="flex-1 text-[14px] font-bold tracking-[-0.03em] text-slate-800">
                            {manualPresenceStatus === "away" ? "자동 상태 사용" : "자리비움으로 표시"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordMessage("")
                            setIsPasswordOpen((prev) => !prev)
                          }}
                          className="flex h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left text-slate-700 transition hover:bg-slate-50"
                        >
                          <KeyRound className="ml-1 h-[18px] w-[18px] text-slate-400" />
                          <span className="flex-1 text-[14px] font-bold tracking-[-0.03em] text-slate-800">비밀번호 변경</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          disabled={isAccountPending}
                          className="flex h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                        >
                          <LogOut className="ml-1 h-[18px] w-[18px] text-slate-400" />
                          <span className="flex-1 text-[14px] font-bold tracking-[-0.03em] text-slate-800">로그아웃</span>
                        </button>
                      </div>

                      <div
                        className={`overflow-hidden transition-all duration-200 ease-out ${
                          isPasswordOpen ? "mt-2 max-h-[260px] opacity-100" : "mt-0 max-h-0 opacity-0"
                        }`}
                      >
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[14px] font-black tracking-[-0.03em] text-slate-950">비밀번호 변경</div>
                              <div className="mt-1 text-[11px] text-slate-500">현재 비밀번호 확인 후 새 비밀번호로 바꿉니다.</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsPasswordOpen(false)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-500 transition hover:bg-slate-200"
                              aria-label="비밀번호 팝업 닫기"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-3 space-y-2.5">
                            <input
                              type="password"
                              value={currentPassword}
                              onChange={(event) => setCurrentPassword(event.target.value)}
                              placeholder="현재 비밀번호"
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                            />
                            <input
                              type="password"
                              value={nextPassword}
                              onChange={(event) => setNextPassword(event.target.value)}
                              placeholder="새 비밀번호"
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                            />
                            <input
                              type="password"
                              value={confirmPassword}
                              onChange={(event) => setConfirmPassword(event.target.value)}
                              placeholder="새 비밀번호 확인"
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                            />
                            {passwordMessage ? (
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                                {passwordMessage}
                              </div>
                            ) : null}
                            <button
                              type="button"
                              onClick={handlePasswordChange}
                              disabled={isAccountPending}
                              className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-60"
                            >
                              {isAccountPending ? "변경 중..." : "비밀번호 저장"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

          <div className="mt-5 flex-1 space-y-5">
            <div>
              <button
                type="button"
                onClick={() => setSections((prev) => ({ ...prev, dailyReport: !prev.dailyReport }))}
                className="group flex w-full items-center justify-between rounded-2xl border border-transparent px-3 py-2.5 text-[15px] font-bold text-slate-900 transition hover:border-slate-200 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span className="tracking-[-0.02em]">업무일지</span>
                </span>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition ${
                    sections.dailyReport ? "rotate-180" : ""
                  } group-hover:bg-slate-200 group-hover:text-slate-500`}
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
              {sections.dailyReport && (
                <div className="mt-2 space-y-1.5">
                  {canViewDailyReport ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setDailyReportFocus("today")
                          setView("daily-report")
                        }}
                        className={`flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ${
                          view === "daily-report" && dailyReportFocus === "today" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        데일리 업무일지
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDailyReportFocus("status")
                          setView("daily-report")
                        }}
                        className={`ml-4 flex h-10 w-[calc(100%-1rem)] items-center rounded-2xl px-4 text-left text-[14px] font-semibold ${
                          view === "daily-report" && dailyReportFocus === "status" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        제출 현황
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>

            <div>
              <button
                type="button"
                onClick={() => setSections((prev) => ({ ...prev, performance: !prev.performance }))}
                className="group flex w-full items-center justify-between rounded-2xl border border-transparent px-3 py-2.5 text-[15px] font-bold text-slate-900 transition hover:border-slate-200 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span className="tracking-[-0.02em]">실적 관리</span>
                  </span>
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition ${
                      sections.performance ? "rotate-180" : ""
                    } group-hover:bg-slate-200 group-hover:text-slate-500`}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
                {sections.performance && (
                  <div className="mt-2 space-y-1.5">
                    {canViewWeeklyReport ? (
                      <button
                        type="button"
                        onClick={() => setView("weekly-report")}
                        className={`flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ${
                          view === "weekly-report" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {viewTitles["weekly-report"]}
                      </button>
                    ) : null}
                    {canViewManualInput ? (
                      <button
                        type="button"
                        onClick={() => setView("manual-input")}
                        className={`ml-4 flex h-10 w-[calc(100%-1rem)] items-center rounded-2xl px-4 text-left text-[14px] font-semibold ${
                          view === "manual-input" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        수동 입력 리스트
                      </button>
                    ) : null}
                    {canViewContracts ? (
                      <button
                        type="button"
                        onClick={() => setView("contracts")}
                        className={`flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ${
                          view === "contracts" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {viewTitles.contracts}
                      </button>
                    ) : null}
                    {canViewWeeklySelection ? (
                      <button
                        type="button"
                        onClick={() => setView("weekly-selection")}
                        className={`flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ${
                          view === "weekly-selection" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {viewTitles["weekly-selection"]}
                      </button>
                    ) : null}
                    {canViewCollections ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCollectionTab("integrated")
                          setView("collection")
                        }}
                        className={`flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ${
                          view === "collection" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {viewTitles.collection}
                      </button>
                    ) : null}
                    {canViewOptionDashboard ? (
                      <button
                        type="button"
                        onClick={() => setView("option-dashboard")}
                        className={`flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ${
                          view === "option-dashboard" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {viewTitles["option-dashboard"]}
                      </button>
                    ) : null}
                  </div>
                )}
            </div>

            <div>
              <button
                type="button"
                onClick={() => setSections((prev) => ({ ...prev, termination: !prev.termination }))}
                className="group flex w-full items-center justify-between rounded-2xl border border-transparent px-3 py-2.5 text-[15px] font-bold text-slate-900 transition hover:border-slate-200 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span className="tracking-[-0.02em]">해지 관리</span>
                </span>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition ${
                    sections.termination ? "rotate-180" : ""
                  } group-hover:bg-slate-200 group-hover:text-slate-500`}
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
              {sections.termination && (
                <div className="mt-2 space-y-1.5">
                  {canViewTermination ? (
                    <button
                      type="button"
                      onClick={() => setView("termination")}
                      className={`flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ${
                        view === "termination" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      해지 진행사항
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            {canViewAdminPage ? (
              <div>
                <div className="mb-2 px-3 text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  관리자
                </div>
                <a
                  href="/admin"
                  className="flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  관리자페이지
                </a>
              </div>
            ) : null}

          </div>

          {currentUser ? (
            <div className="mt-auto px-1 pt-6">
              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="space-y-3">
                  <div className="min-w-0">
                    <div className="whitespace-nowrap text-[15px] font-black tracking-[-0.03em] text-slate-900">현재 접속 인원</div>
                    <div className="mt-1 text-[12px] font-semibold text-emerald-600">
                      {activePresenceUsers.length}명 접속 중
                    </div>
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void sendPopupMessageToAll()}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                      aria-label="현재 접속자 전체에게 메시지 보내기"
                      title="현재 접속자 전체에게 메시지 보내기"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPresenceListOpen((prev) => !prev)}
                      className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-full bg-slate-50 px-2.5 text-[12px] font-semibold text-slate-500 transition hover:bg-slate-100"
                    >
                      <span className="truncate">전체 보기</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 transition duration-200 ${isPresenceListOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPresenceListOpen((prev) => !prev)}
                  className="mt-4 block w-full overflow-hidden rounded-2xl bg-slate-50/70 px-3 py-3 text-left transition hover:bg-slate-100"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {visiblePresenceUsers.length ? (
                      visiblePresenceUsers.map((user) => {
                        const label = String(user.avatarEmoji || "").trim() || String(user.userName || "").slice(0, 1)
                        return (
                          <span
                            key={user.userId}
                            className="relative inline-flex min-w-0"
                            title={`${user.userName} · ${user.teamName || "팀 미지정"}`}
                          >
                            <span
                              className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${user.color.bg} ${user.color.text} ${user.color.border} text-[16px] font-black shadow-sm`}
                            >
                              {label}
                              <span
                                className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${getPresenceDotClass(user.status)}`}
                              />
                            </span>
                          </span>
                        )
                      })
                    ) : (
                      <span className="text-[13px] font-medium text-slate-400">현재 접속 중인 사용자가 없습니다.</span>
                    )}
                    {hiddenPresenceCount > 0 ? (
                      <span className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-[12px] font-bold text-slate-600 shadow-sm">
                        +{hiddenPresenceCount}
                      </span>
                    ) : null}
                  </div>
                </button>

                <div
                  className={`overflow-hidden transition-all duration-200 ease-out ${
                    isPresenceListOpen ? "mt-4 max-h-[420px] opacity-100" : "mt-0 max-h-0 opacity-0"
                  }`}
                >
                  <div className="border-t border-slate-100 pt-3">
                    <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                      {presenceUsers.map((user) => {
                        const label = String(user.avatarEmoji || "").trim() || String(user.userName || "").slice(0, 1)
                        return (
                          <div
                            key={user.userId}
                            className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                            title={`${user.userName} · ${user.teamName || "팀 미지정"}`}
                          >
                            <div
                              className={`relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${user.color.border} ${user.color.bg} ${user.color.text} text-[18px] font-black`}
                            >
                              {label}
                              <span
                                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${getPresenceDotClass(user.status)}`}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[14px] font-bold tracking-[-0.03em] text-slate-900">
                                <span className="block break-keep pr-1">
                                  {user.userName}
                                </span>
                              </div>
                              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[12px] text-slate-500">
                                <span className="min-w-0 max-w-full truncate">{user.teamName || "팀 미지정"}</span>
                                <span className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                  {getPresenceLabel(user.status)}
                                </span>
                                {user.currentPage ? <span className="min-w-0 max-w-full truncate">{user.currentPage}</span> : null}
                              </div>
                            </div>
                            {user.userId !== currentUser?.id ? (
                              <button
                                type="button"
                                onClick={() => void sendPopupMessage([user.userId], user.userName)}
                                className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
                                aria-label={`${user.userName}에게 메시지 보내기`}
                                title={`${user.userName}에게 메시지 보내기`}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 flex-1 px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
            <div className={`${cardClass} dashboard-header ${view === "daily-report" ? "mb-3 px-5 py-3" : "mb-5 px-5 py-4"} flex items-start justify-between`}>
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 lg:hidden"
                aria-label="사이드바 열기"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
              <h1 className={`${view === "daily-report" ? "mt-1 text-[18px]" : "mt-2 text-[20px]"} font-black tracking-[-0.04em] text-slate-950`}>{viewTitles[view]}</h1>
              {view !== "daily-report" ? (
                <div className="mt-1 text-[12px] font-semibold text-slate-500" suppressHydrationWarning>
                  Last update: {formatLastUpdated(currentMenuUpdatedAt)}
                </div>
              ) : null}
            </div>
            </div>
            <div className="dashboard-header-actions flex items-center gap-3">
              {showHeaderSave && (
                <button
                  type="button"
                  onClick={handleSaveCurrentView}
                  disabled={!hasUnsavedChanges || isSavingDashboard}
                  title="저장"
                  aria-label="저장"
                  className={`inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-[14px] font-bold transition ${
                    hasUnsavedChanges && !isSavingDashboard
                      ? "bg-blue-600 text-white shadow-[0_10px_22px_rgba(37,99,235,0.22)] hover:bg-blue-700"
                      : "border border-slate-200 bg-slate-100 text-slate-400"
                  }`}
                >
                  <SaveIcon className={isSavingDashboard && hasUnsavedChanges ? "h-5 w-5 animate-pulse" : "h-5 w-5"} />
                  <span>저장</span>
                </button>
              )}
              {view === "weekly-report" && (
                <button
                  type="button"
                  onClick={handleWeeklyReportPrint}
                  title="PDF 출력"
                  aria-label="PDF 출력"
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-rose-100 bg-white px-4 text-[14px] font-bold text-rose-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50"
                >
                  <PdfIcon className="h-5 w-5" />
                  <span>PDF</span>
                </button>
              )}
              {view !== "daily-report" ? (
                <>
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
                </>
              ) : null}
            </div>
          </div>

          {view === "daily-report" && (
            <DailyReportPage
              currentUser={{
                id: currentUser?.id || "",
                name: currentUser?.name || "",
                role: currentUser?.role || "",
                teamName: currentUser?.teamName || "",
                avatarEmoji: currentUser?.avatarEmoji || null,
              }}
              directoryUsers={Array.isArray(directoryUsers) ? directoryUsers : []}
              reportState={normalizedDailyReport}
              currentDate={dailyReportDate}
              focus={dailyReportFocus}
              lastUpdatedText={formatLastUpdated(currentMenuUpdatedAt)}
              presenceUsers={(Array.isArray(presenceUsers) ? presenceUsers : []).map((user) => ({
                userId: user.userId,
                userName: user.userName,
                teamName: user.teamName,
                status: user.status,
              }))}
              onSaveState={persistDailyReportState}
            />
          )}

          {view === "weekly-report" && (
            <div className="weekly-report-print space-y-4">
              <section className="print-report-cover hidden print:block">
                <div className="print-report-header-row">
                  <div className="print-report-spacer" />
                </div>
                <div className="print-report-title-row">
                  <div className="print-report-title">주간실적보고</div>
                  <div className="print-report-meta">
                    <div>인포Biz본부</div>
                    <div>{displayBaseDate}</div>
                  </div>
                </div>
              </section>

              <section className={`${cardClass} p-5 print-report-sheet-section`}>
                <div className="mb-1.5 border border-slate-200 bg-slate-50/70 px-3 py-2 print-revenue-meta">
                  <div className="print-revenue-strip">
                    <div className="print-revenue-copy">
                      <div className="print-revenue-kpis">
                        <div className="print-revenue-kpi">
                          <div className="print-revenue-kpi-label">{revenueHeaderMetric.label}</div>
                          <div className="print-revenue-kpi-value">{revenueHeaderMetric.value}</div>
                        </div>
                        <div className="print-revenue-kpi">
                          <div className="print-revenue-kpi-label">{revenueSubtitleMetricOne.label}</div>
                          <div className="print-revenue-kpi-value">{revenueSubtitleMetricOne.value}</div>
                        </div>
                        <div className="print-revenue-kpi">
                          <div className="print-revenue-kpi-label">{revenueSubtitleMetricTwo.label}</div>
                          <div className="print-revenue-kpi-value">{revenueSubtitleMetricTwo.value}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="print-revenue-note">
                    <div className="print-revenue-note-block">
                      <div className="print-revenue-note-value">
                        <div>{revenueNoteParts.primary}</div>
                        {revenueNoteParts.secondary ? <div>{revenueNoteParts.secondary}</div> : null}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="contract-section-wrap mt-4 mb-4">
                  <div className="mb-3 text-[18px] font-bold report-section-title">계약 내역</div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className={`${weeklyReportTableClass} print-contract-table`}>
                      <thead><tr>{["회사명","부서","아이디","업종","계약월","계약서 회수","미회수"].map((head)=><th key={head} className={weeklyThClass}>{head}</th>)}</tr></thead>
                      <tbody>
                        {includedContracts.length ? includedContracts.map((row: any) => (
                          <tr key={row.id}>
                          <td className={weeklyTdClass}>{row.companyName}</td>
                          <td className={weeklyTdClass}>{row.departmentName}</td>
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

              <section className={`${cardClass} p-5 print-report-sheet-section print-gap-after`}>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={`${weeklyReportTableClass} print-combined-summary-table`}>
                    <colgroup>
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "7.5%" }} />
                      <col style={{ width: "7.5%" }} />
                      <col style={{ width: "11.5%" }} />
                      <col style={{ width: "7.5%" }} />
                      <col style={{ width: "7.5%" }} />
                      <col style={{ width: "31.5%" }} />
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
                        <td className={`${weeklyTdClass} font-bold text-slate-800 print-no-highlight`} style={{ backgroundColor: "#fffbeb" }}>{formatNumber(reportSummary?.weeklyNetUnits)}대</td>
                        <td className={`${weeklyTdClass} font-bold text-slate-800 print-no-highlight`} style={{ backgroundColor: "#fffbeb" }}>{formatNumber(reportSummary?.weeklyNewContracts)}대</td>
                        <td className={`${weeklyTdClass} font-bold text-slate-800 print-no-highlight`} style={{ backgroundColor: "#fffbeb" }}>{formatNumber(reportSummary?.weeklyTerminationContracts)}대</td>
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
                        <td className={`${weeklyTdClass} bg-amber-50 font-semibold text-slate-900`}>{formatNumber(reportSummary?.newContractTotal)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.competitorReplacement)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.newReplacement)}대</td>
                        <td className={`${weeklyTdClass} px-3 text-center text-[13px] leading-snug whitespace-normal break-keep print-summary-detail-cell`} colSpan={4}>{reportSummary?.competitorStatus || ""}</td>
                      </tr>

                      <tr>
                        <th className={`${weeklyThClass} font-bold`} rowSpan={2}>해지대기 및 청구보류</th>
                        <th className={weeklyThClass}>해지보류 합계</th>
                        <th className={weeklyThClass}>해지대기</th>
                        <th className={weeklyThClass}>청구보류</th>
                        <th className={weeklyThClass} colSpan={4}>해지 진행 현황</th>
                      </tr>
                      <tr>
                        <td className={`${weeklyTdClass} bg-amber-50 font-semibold text-slate-900`}>{formatNumber(reportSummary?.holdTotal)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.holdPending)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.billingHold)}대</td>
                        <td className={`${weeklyTdClass} px-3 text-center text-[13px] leading-snug whitespace-normal break-keep print-summary-detail-cell`} colSpan={4}>{reportSummary?.holdStatus || ""}</td>
                      </tr>

                      <tr>
                        <th className={`${weeklyThClass} font-bold`} rowSpan={2}>단말기 해지 유형</th>
                        <th className={weeklyThClass}>단말해지 합계</th>
                        <th className={weeklyThClass}>계약해지</th>
                        <th className={weeklyThClass}>타사교체</th>
                        <th className={weeklyThClass} colSpan={4}>타사 교체 현황</th>
                      </tr>
                      <tr>
                        <td className={`${weeklyTdClass} bg-amber-50 font-semibold text-slate-900`}>{formatNumber(reportSummary?.terminationTypeTotal)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.contractTermination)}대</td>
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.competitorTermination)}대</td>
                        <td className={`${weeklyTdClass} px-3 text-center text-[13px] leading-snug whitespace-normal break-keep print-summary-detail-cell`} colSpan={4}>{reportSummary?.competitorTerminationStatus || ""}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={`${cardClass} p-5 space-y-3 print-report-sheet-section print-tight print-gap-after`}>
                <div className="text-[18px] font-bold report-section-title">{currentYear}년 판매 목표 (단말기 목표 6,364대, 순증 260대)</div>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={`${weeklyReportTableClass} print-goal-table`}>
                    <thead>
                      <tr>{["구분(월)", "순증", "목표계약대수", "분기순증목표", "월간실적", "분기실적", "목표대비 달성현황"].map((head) => <th key={head} className={weeklyThClass}>{head}</th>)}</tr>
                    </thead>
                    <tbody>
                      {reportGoalRows.map((row: any, index: number) => {
                        const isTotalRow = row.month === "합계"
                        const isQuarterGroupStart = index < 12 && index % 3 === 0
                        const shouldRenderQuarterValue = isTotalRow || index >= 12 || isQuarterGroupStart
                        const quarterRowSpan = !isTotalRow && index < 12 ? 3 : undefined
                        return (
                          <tr key={`${row.month}-${index}`}>
                            <td className={`${weeklyTdClass} ${isTotalRow ? "font-bold text-slate-900" : ""}`}>{row.month}</td>
                            <td className={`${weeklyTdClass} ${isTotalRow ? "font-bold text-slate-900" : ""}`}>{formatNumber(row.netTarget)}</td>
                            <td className={`${weeklyTdClass} ${isTotalRow ? "font-bold text-slate-900" : ""}`}>{formatNumber(row.targetContracts)}</td>
                            {shouldRenderQuarterValue ? (
                              <td
                                rowSpan={quarterRowSpan}
                                className={`${weeklyTdClass} ${isTotalRow ? "font-bold text-slate-900" : ""} ${!isTotalRow ? "align-middle" : ""}`}
                              >
                                {formatNumber(row.quarterNetTarget)}
                              </td>
                            ) : null}
                            <td className={`${weeklyTdClass} ${isTotalRow ? "font-bold text-slate-900" : ""}`}>{formatNumber(row.monthlyActual)}</td>
                            {shouldRenderQuarterValue ? (
                              <td
                                rowSpan={quarterRowSpan}
                                className={`${weeklyTdClass} ${isTotalRow ? "font-bold text-slate-900" : ""} ${!isTotalRow ? "align-middle" : ""}`}
                              >
                                {formatNumber(row.quarterActual)}
                              </td>
                            ) : null}
                            {shouldRenderQuarterValue ? (
                              <td
                                rowSpan={quarterRowSpan}
                                className={`${weeklyTdClass} ${isTotalRow ? "font-bold text-slate-900" : ""} ${!isTotalRow ? "align-middle" : ""}`}
                              >
                                {formatNumber(row.gap)}
                              </td>
                            ) : null}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={`${cardClass} p-5 space-y-3 print-report-sheet-section print-tight`}>
                <div className="text-[18px] font-bold report-section-title">유료 옵션 정보</div>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={`${weeklyReportTableClass} print-industry-table print-paid-option-table`}>
                    <thead>
                      <tr>
                        {paidOptionColumns.map((column) => (
                          <th key={`paid-option-title-${column.id}`} className={weeklyThClass}>
                            {column.title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {paidOptionColumns.map((column) => (
                          <td key={`paid-option-total-${column.id}`} className={`${weeklyTdClass} font-semibold`}>
                            {column.total}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
              <section className={`${cardClass} p-5 space-y-3 print-report-sheet-section`}>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={`${weeklyReportTableClass} print-industry-table print-termination-table`}>
                    <thead>
                      <tr>
                        <th colSpan={reportTerminationColumns.length + 1} className={`${weeklyThClass} bg-white px-4 text-left text-[18px] font-bold text-slate-900`}>
                          {currentYear}년 해지 현황 ({String(displayBaseDate || "").replace(/^\d{4}-(\d{2})-(\d{2})$/, "$1/$2")} 기준)
                        </th>
                      </tr>
                      <tr>
                        {["구분", ...reportTerminationColumns].map((head) => (
                          <th key={head} className={weeklyThClass}>{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportTerminationRows.map((row) => (
                        <tr key={row.label}>
                          <td className={`${weeklyTdClass} whitespace-nowrap text-center font-bold`}>{row.label}</td>
                          {row.values.map((value, index) => {
                            const column = reportTerminationColumns[index]
                            const isTotalColumn = column === "합계"
                            const totalValue = isTotalColumn
                              ? String(value ?? "").trim() || computeTerminationRowTotal((row.values || []).slice(0, reportTerminationColumns.length - 1))
                              : value
                            return (
                              <td key={`${row.label}-${column}`} className={`${weeklyTdClass} ${row.label === "비율" ? "font-semibold" : ""}`}>
                                {totalValue}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={`${cardClass} p-5 space-y-3 print-report-sheet-section`}>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className={`${weeklyReportTableClass} print-industry-table print-industry-summary-table`}>
                    <thead>
                      <tr>
                        <th colSpan={reportIndustryColumns.length + 1} className={`${weeklyThClass} bg-white px-4 text-left text-[18px] font-bold text-slate-900`}>
                          {replaceDivisionName(`정보사업본부 업종별 실적 현황 (${String(displayBaseDate || "").replace(/^\d{4}-(\d{2})-(\d{2})$/, "$1/$2")} 기준)`)}
                        </th>
                      </tr>
                      <tr>
                        {["구분", ...reportIndustryColumns].map((head) => (
                          <th key={head} className={weeklyThClass}>{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportIndustryRows.map((row) => (
                        <tr key={row.label}>
                          <td className={`${weeklyTdClass} whitespace-nowrap text-center font-bold`}>{row.label}</td>
                          {row.values.map((value, index) => {
                            const column = reportIndustryColumns[index]
                            const isTotalColumn = column === "합계"
                            const totalValue = isTotalColumn
                              ? computeIndustryRowTotal((row.values || []).slice(0, reportIndustryColumns.length - 1))
                              : value
                            return (
                              <td key={`${row.label}-${column}`} className={weeklyTdClass}>
                                {totalValue}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

            </div>
          )}

          {view === "contracts" && (
            <div className={`${cardClass} p-5`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[18px] font-bold">신규계약 리스트</div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-[13px] font-semibold text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                  <span>총</span>
                  <span className="text-[16px] font-extrabold text-blue-600">
                    {formatNumber(contracts.length)}
                  </span>
                  <span>건</span>
                </div>
              </div>
              <div className="mb-4 grid items-stretch gap-3 xl:grid-cols-2">
                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
                  <div className="mb-1.5 text-[13px] font-bold text-slate-900">월별 실적 통계</div>
                  <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full table-fixed text-[13px]">
                      {contractMonthRows.map((chunk, rowIndex) => (
                        <tbody key={`contract-month-block-${rowIndex}`}>
                          <tr>
                            {chunk.map((row) => {
                              const isCurrent = row.sortKey === currentMonthKey
                              return (
                                <th
                                  key={`contract-month-label-${row.label}`}
                                  className={`border-b border-slate-200 px-2 py-2 text-center text-[12px] font-semibold ${
                                    isCurrent ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-600"
                                  }`}
                                >
                                  {row.label}
                                </th>
                              )
                            })}
                            {chunk.length < contractMonthColumns &&
                              Array.from({ length: contractMonthColumns - chunk.length }).map((_, index) => (
                                <th
                                  key={`contract-month-empty-h-${rowIndex}-${index}`}
                                  className="border-b border-slate-200 bg-slate-50 px-2 py-2 text-center text-[12px] font-semibold text-slate-300"
                                >
                                  -
                                </th>
                              ))}
                          </tr>
                          <tr>
                            {chunk.map((row) => {
                              const isCurrent = row.sortKey === currentMonthKey
                              return (
                                <td
                                  key={`contract-month-value-${row.label}`}
                                  className={`border-b border-slate-200 px-2 py-2 text-center text-[14px] font-bold ${
                                    isCurrent ? "bg-blue-50 text-blue-900" : "text-slate-900"
                                  }`}
                                >
                                  {formatNumber(row.count)}
                                </td>
                              )
                            })}
                            {chunk.length < contractMonthColumns &&
                              Array.from({ length: contractMonthColumns - chunk.length }).map((_, index) => (
                                <td
                                  key={`contract-month-empty-v-${rowIndex}-${index}`}
                                  className="border-b border-slate-200 px-2 py-2 text-center text-[14px] font-bold text-slate-300"
                                >
                                  0
                                </td>
                              ))}
                          </tr>
                        </tbody>
                      ))}
                    </table>
                  </div>
                </div>
                <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
                  <div className="mb-1.5 text-[13px] font-bold text-slate-900">권유자별 실적 통계</div>
                  <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full table-fixed text-[13px]">
                      {contractRecommenderRows.map((chunk, rowIndex) => (
                        <tbody key={`contract-recommender-block-${rowIndex}`}>
                          <tr>
                            {chunk.map((row) => (
                              <th
                                key={`contract-recommender-label-${row.label}`}
                                className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-center text-[12px] font-semibold text-slate-600"
                              >
                                {row.label}
                              </th>
                            ))}
                            {chunk.length < contractRecommenderColumns &&
                              Array.from({ length: contractRecommenderColumns - chunk.length }).map((_, index) => (
                                <th
                                  key={`contract-recommender-empty-h-${rowIndex}-${index}`}
                                  className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-center text-[12px] font-semibold text-slate-300"
                                >
                                  -
                                </th>
                              ))}
                          </tr>
                          <tr>
                            {chunk.map((row) => (
                              <td
                                key={`contract-recommender-value-${row.label}`}
                                className="border-b border-slate-200 px-3 py-2 text-center text-[14px] font-bold text-slate-900"
                              >
                                {formatNumber(row.count)}
                              </td>
                            ))}
                            {chunk.length < contractRecommenderColumns &&
                              Array.from({ length: contractRecommenderColumns - chunk.length }).map((_, index) => (
                                <td
                                  key={`contract-recommender-empty-v-${rowIndex}-${index}`}
                                  className="border-b border-slate-200 px-3 py-2 text-center text-[14px] font-bold text-slate-300"
                                >
                                  0
                                </td>
                              ))}
                          </tr>
                        </tbody>
                      ))}
                    </table>
                  </div>
                </div>
              </div>
              <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-[14px] font-bold text-slate-800">신규계약 입력</div>
                {!canCreateContracts ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    현재 계정은 신규계약 등록 권한이 없습니다.
                  </div>
                ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="회사명" value={contractDraft.companyName} onChange={(e)=>updateContractDraft("companyName", e.target.value)} />
                    <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="부서" value={contractDraft.departmentName} onChange={(e)=>updateContractDraft("departmentName", e.target.value)} />
                    <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="아이디" value={contractDraft.idCode} onChange={(e)=>updateContractDraft("idCode", e.target.value)} />
                    <select className="h-10 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" value={contractDraft.industry} onChange={(e)=>updateContractDraft("industry", e.target.value)}>
                      {["국내증권","국내은행","외국계","자산운용","보험","일반기업","공사/정부","연기금","기타금융"].map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <input
                      type="month"
                      className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]"
                      value={toContractMonthInputValue(contractDraft.contractMonth)}
                      onChange={(e)=>updateContractDraft("contractMonth", fromContractMonthInputValue(e.target.value))}
                    />
                    <input
                      className="h-10 w-full rounded-2xl border border-amber-200 bg-amber-50 px-3 text-[14px] font-semibold text-slate-700"
                      placeholder="권유자"
                      value={currentUser?.name || contractDraft.recommender}
                      readOnly
                    />
                    <select className="h-10 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" value={contractDraft.replacementType} onChange={(e)=>updateContractDraft("replacementType", e.target.value)}>
                      {["신규","체크","레피니티브","블룸버그","기타"].map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                    <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="비고" value={contractDraft.note} onChange={(e)=>updateContractDraft("note", e.target.value)} />
                    <div className="grid h-10 grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <select className="h-10 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" value={contractDraft.documentStatus} onChange={(e)=>updateContractDraft("documentStatus", e.target.value)}>
                        <option value="미회수">미회수</option>
                        <option value="회수">회수</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleContractCreate}
                        disabled={contractCreateStatus !== "idle"}
                        className={getCreateButtonClass(contractCreateStatus)}
                      >
                        {getCreateButtonLabel(contractCreateStatus, "등록&저장")}
                      </button>
                    </div>
                  </div>
                </div>
                )}
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                  className="h-9 w-64 rounded-xl border border-slate-200 bg-white px-3 text-[13px]"
                  placeholder="회사명/부서/아이디/권유자 검색"
                  value={contractQuery}
                  onChange={(e) => setContractQuery(e.currentTarget.value)}
                  onInput={(e) => setContractQuery(e.currentTarget.value)}
                  onCompositionEnd={(e) => setContractQuery(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      setContractQuery(e.currentTarget.value.trim())
                    }
                  }}
                />
                <select
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[13px]"
                  value={contractStatusFilter}
                  onChange={(e) => setContractStatusFilter(e.target.value)}
                >
                  {contractStatusOptions.map((option) => (
                    <option key={`contract-status-${option}`} value={option}>
                      {option === "all" ? "계약서 상태 전체" : option}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[13px]"
                  value={contractReplacementFilter}
                  onChange={(e) => setContractReplacementFilter(e.target.value)}
                >
                  {contractReplacementOptions.map((option) => (
                    <option key={`contract-replacement-${option}`} value={option}>
                      {option === "all" ? "대체여부 전체" : option}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[13px]"
                  value={contractMonthFilter}
                  onChange={(e) => setContractMonthFilter(e.target.value)}
                >
                  {contractMonthOptions.map((option) => (
                    <option key={`contract-month-${option}`} value={option}>
                      {option === "all" ? "계약월 전체" : option}
                    </option>
                  ))}
                </select>
                {(contractQuery ||
                  contractStatusFilter !== "all" ||
                  contractReplacementFilter !== "all" ||
                  contractMonthFilter !== "all") && (
                  <button
                    type="button"
                    className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] font-semibold text-slate-600"
                    onClick={() => {
                      setContractQuery("")
                      setContractStatusFilter("all")
                      setContractReplacementFilter("all")
                      setContractMonthFilter("all")
                    }}
                  >
                    필터 초기화
                  </button>
                )}
                <div className="ml-auto text-[12px] text-slate-500">표시 {formatNumber(sortedContracts.length)}건</div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full table-fixed text-[12px]">
                  <thead>
                    <tr>
                      <th className={`${thClass} w-[52px] px-2 py-2 text-center text-[12px]`}>No.</th>
                      <th className={`${thClass} px-2 py-2 text-[12px]`}>
                        {renderSortLabel("회사명", contractSort.key === "companyName", contractSort.dir, () => toggleContractSort("companyName"))}
                      </th>
                      <th className={`${thClass} px-2 py-2 text-[12px]`}>
                        {renderSortLabel("부서", contractSort.key === "departmentName", contractSort.dir, () => toggleContractSort("departmentName"))}
                      </th>
                      <th className={`${thClass} px-2 py-2 text-[12px]`}>
                        {renderSortLabel("아이디", contractSort.key === "idCode", contractSort.dir, () => toggleContractSort("idCode"))}
                      </th>
                      <th className={`${thClass} px-2 py-2 text-[12px]`}>
                        {renderSortLabel("업종", contractSort.key === "industry", contractSort.dir, () => toggleContractSort("industry"))}
                      </th>
                      <th className={`${thClass} px-2 py-2 text-[12px]`}>
                        {renderSortLabel("계약월", contractSort.key === "contractMonth", contractSort.dir, () => toggleContractSort("contractMonth"))}
                      </th>
                      <th className={`${thClass} px-2 py-2 text-[12px]`}>
                        {renderSortLabel("권유자", contractSort.key === "recommender", contractSort.dir, () => toggleContractSort("recommender"))}
                      </th>
                      <th className={`${thClass} px-2 py-2 text-[12px]`}>
                        {renderSortLabel("계약서 상태", contractSort.key === "documentStatus", contractSort.dir, () => toggleContractSort("documentStatus"))}
                      </th>
                      <th className={`${thClass} px-2 py-2 text-[12px]`}>
                        {renderSortLabel("대체여부", contractSort.key === "replacementType", contractSort.dir, () => toggleContractSort("replacementType"))}
                      </th>
                      <th className={`${thClass} px-2 py-2 text-[12px]`}>
                        {renderSortLabel("비고", contractSort.key === "note", contractSort.dir, () => toggleContractSort("note"))}
                      </th>
                      <th className={`${thClass} px-2 py-2 text-[12px]`}>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedContracts.map((row: any, index: number) => {
                      const editing = editingContractId === row.id
                      return (
                        <tr key={row.id} className={recentContractId === row.id ? "recent-row-flash" : undefined}>
                          <td className={`${tdClass} w-[52px] px-2 py-2 text-center text-[12px]`}>{index + 1}</td>
                          <td className={`${tdClass} px-2 py-2 text-[12px]`}>
                            {editing ? <input className="h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px]" value={editingContractDraft.companyName || ""} onChange={(e)=>updateEditingContractDraft("companyName", e.target.value)} /> : <span className="block truncate">{row.companyName}</span>}
                          </td>
                          <td className={`${tdClass} px-2 py-2 text-[12px]`}>
                            {editing ? <input className="h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px]" value={editingContractDraft.departmentName || ""} onChange={(e)=>updateEditingContractDraft("departmentName", e.target.value)} /> : <span className="block truncate">{row.departmentName}</span>}
                          </td>
                          <td className={`${tdClass} px-2 py-2 text-[12px]`}>
                            {editing ? <input className="h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px]" value={editingContractDraft.idCode || ""} onChange={(e)=>updateEditingContractDraft("idCode", e.target.value)} /> : <span className="block truncate">{row.idCode}</span>}
                          </td>
                          <td className={`${tdClass} px-2 py-2 text-[12px]`}>
                            {editing ? (
                              <select className="h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px]" value={editingContractDraft.industry || "국내증권"} onChange={(e)=>updateEditingContractDraft("industry", e.target.value)}>
                                {["국내증권","국내은행","외국계","자산운용","보험","일반기업","공사/정부","연기금","기타금융"].map((item) => <option key={item} value={item}>{item}</option>)}
                              </select>
                            ) : <span className="block truncate">{row.industry}</span>}
                          </td>
                          <td className={`${tdClass} px-2 py-2 text-[12px]`}>
                            {editing ? (
                              <input
                                type="month"
                                className="h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px]"
                                value={toContractMonthInputValue(editingContractDraft.contractMonth)}
                                onChange={(e)=>updateEditingContractDraft("contractMonth", fromContractMonthInputValue(e.target.value))}
                              />
                            ) : <span className="block truncate">{row.contractMonth}</span>}
                          </td>
                          <td className={`${tdClass} px-2 py-2 text-[12px]`}>
                            {editing ? (
                              <input
                                className="h-8 w-full rounded-lg border border-slate-200 bg-slate-100 px-2 text-[12px]"
                                value={editingContractDraft.recommender || ""}
                                onChange={(e)=>updateEditingContractDraft("recommender", e.target.value)}
                                readOnly={!canEditContracts}
                              />
                            ) : <span className="block truncate">{row.recommender}</span>}
                          </td>
                          <td className={`${tdClass} px-2 py-2 text-[12px]`}>
                            {editing ? (
                              <select className="h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px]" value={editingContractDraft.documentStatus || "미회수"} onChange={(e)=>updateEditingContractDraft("documentStatus", e.target.value)}>
                                <option value="미회수">미회수</option>
                                <option value="회수">회수</option>
                              </select>
                            ) : <span className="block truncate">{row.documentStatus}</span>}
                          </td>
                          <td className={`${tdClass} px-2 py-2 text-[12px]`}>
                            {editing ? (
                              <select className="h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px]" value={editingContractDraft.replacementType || row.replacementType || "신규"} onChange={(e)=>updateEditingContractDraft("replacementType", e.target.value)}>
                                {["신규","체크","레피니티브","블룸버그","기타"].map((item) => <option key={item} value={item}>{item}</option>)}
                              </select>
                            ) : <span className="block truncate">{row.replacementType || "신규"}</span>}
                          </td>
                          <td className={`${tdClass} px-2 py-2 text-[12px]`}>
                            {editing ? <input className="h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px]" value={editingContractDraft.note || ""} onChange={(e)=>updateEditingContractDraft("note", e.target.value)} /> : <span className="block truncate">{row.note || ""}</span>}
                          </td>
                          <td className={`${tdClass} px-2 py-2 text-[12px]`}>
                            {editing ? (
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                {canEditContracts ? <button type="button" onClick={() => handleContractUpdate(row.id)} className="rounded-lg bg-blue-600 px-2 py-1.5 text-[11px] font-semibold text-white whitespace-nowrap">수정완료 및 저장</button> : null}
                                {canDeleteContracts ? <button type="button" onClick={() => handleContractDelete(row.id)} className="rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-700 whitespace-nowrap">삭제</button> : null}
                                <button type="button" onClick={() => { setEditingContractId(null); setEditingContractDraft({}) }} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold whitespace-nowrap">취소</button>
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                {canEditContracts ? <button type="button" onClick={() => startContractEdit(row)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold">수정</button> : <span className="text-slate-300">-</span>}
                              </div>
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
                  <thead>
                    <tr>
                      <th className={thClass}>
                        {renderSortLabel("선택", weeklySelectionSort.key === "includedInWeekly", weeklySelectionSort.dir, () => toggleWeeklySelectionSort("includedInWeekly"))}
                      </th>
                      <th className={thClass}>
                        {renderSortLabel("No.", weeklySelectionSort.key === "no", weeklySelectionSort.dir, () => toggleWeeklySelectionSort("no"))}
                      </th>
                      <th className={thClass}>
                        {renderSortLabel("회사명", weeklySelectionSort.key === "companyName", weeklySelectionSort.dir, () => toggleWeeklySelectionSort("companyName"))}
                      </th>
                      <th className={thClass}>
                        {renderSortLabel("부서명", weeklySelectionSort.key === "departmentName", weeklySelectionSort.dir, () => toggleWeeklySelectionSort("departmentName"))}
                      </th>
                      <th className={thClass}>
                        {renderSortLabel("ID", weeklySelectionSort.key === "idCode", weeklySelectionSort.dir, () => toggleWeeklySelectionSort("idCode"))}
                      </th>
                      <th className={thClass}>
                        {renderSortLabel("업종", weeklySelectionSort.key === "industry", weeklySelectionSort.dir, () => toggleWeeklySelectionSort("industry"))}
                      </th>
                      <th className={thClass}>
                        {renderSortLabel("계약월", weeklySelectionSort.key === "contractMonth", weeklySelectionSort.dir, () => toggleWeeklySelectionSort("contractMonth"))}
                      </th>
                      <th className={thClass}>
                        {renderSortLabel("권유자", weeklySelectionSort.key === "recommender", weeklySelectionSort.dir, () => toggleWeeklySelectionSort("recommender"))}
                      </th>
                      <th className={thClass}>
                        {renderSortLabel("계약서 상태", weeklySelectionSort.key === "documentStatus", weeklySelectionSort.dir, () => toggleWeeklySelectionSort("documentStatus"))}
                      </th>
                      <th className={thClass}>
                        {renderSortLabel("대체여부", weeklySelectionSort.key === "replacementType", weeklySelectionSort.dir, () => toggleWeeklySelectionSort("replacementType"))}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedWeeklySelectionContracts.map((row: any, index: number) => (
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
                        <td className={tdClass}>{row.replacementType || "신규"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === "manual-input" && (
            <div className={`${cardClass} space-y-4 p-5`} onKeyDownCapture={handleManualInputKeyDownCapture}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[18px] font-bold text-slate-900">수동 입력 리스트</div>
                  <div className="mt-1 text-[12px] font-semibold text-amber-600">(음영처리된 부분은 자동계산 반영)</div>
                </div>
                <button
                  type="button"
                  onClick={handleManualUpdate}
                  title="저장"
                  aria-label="저장"
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl bg-blue-600 px-4 text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(37,99,235,0.2)] hover:bg-blue-700"
                >
                  <SaveIcon className={isPending ? "h-[18px] w-[18px] animate-pulse" : "h-[18px] w-[18px]"} />
                  <span>저장</span>
                </button>
              </div>

              {manualRevenueSection}

              {manualSummaryMatrixSection}

              {manualGoalSection}

              {manualPaidOptionSection}

              {manualTerminationOverviewSection}

              {manualWeeklyIndustrySection}

              {manualAdditionalSalesSection}

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
                    <button type="button" onClick={() => handleCollectionTabChange("delivery")} className={`rounded-2xl px-4 py-2 text-[13px] font-semibold ${collectionTab === "delivery" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>전달 리스트</button>
                  </div>
                </div>
                {collectionTab === "delivery" ? (
                  <div className="flex flex-wrap gap-2">
                    {renderChip(`전달 항목 ${formatNumber(activeCollectionDelivery.rows.length)}건`, "blue")}
                    {renderChip(`전달 일자 ${activeCollectionDelivery.deliveredDate || "-"}`, "gray")}
                    {renderChip(`저장 일자 ${formatNumber(deliveryHistoryOptions.length)}건`, "gray")}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {renderChip(`전체 ${formatNumber(filteredCollectionRows.length)}건`, "blue")}
                    {renderChip(`회수 ${formatNumber(filteredCollectionRows.filter((row: any) => row.status === "회수").length)}건`, "green")}
                    {renderChip(`미회수 ${formatNumber(filteredCollectionRows.filter((row: any) => row.status === "미회수").length)}건`, "red")}
                    {renderChip(`미정 ${formatNumber(filteredCollectionRows.filter((row: any) => !row.status || row.status === "미정").length)}건`, "gray")}
                  </div>
                )}
              </div>
              {collectionTab === "delivery" ? (
                <div className={`${cardClass} p-5`}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="break-keep text-[18px] font-bold text-slate-900">{activeCollectionDelivery.title}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                      <select
                        className="h-9 min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700"
                        value={selectedDeliveryHistoryDate}
                        onChange={(e) => handleCollectionDeliveryHistorySelect(e.target.value)}
                        disabled={deliveryHistoryOptions.length === 0}
                      >
                        {deliveryHistoryOptions.length === 0 ? (
                          <option value="">저장된 일자 없음</option>
                        ) : (
                          deliveryHistoryOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={handleCollectionDeliveryOpenNewPage}
                        className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700"
                      >
                        새 페이지 열기
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCollectionDeliveryDeleteHistory()}
                        disabled={!selectedDeliveryHistoryDate}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                          selectedDeliveryHistoryDate
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-slate-200 bg-slate-100 text-slate-400"
                        }`}
                      >
                        일자 삭제
                      </button>
                      <button
                        type="button"
                        onClick={handleCollectionDeliverySaveHistory}
                        className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                      >
                        리스트 저장
                      </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleCollectionDeliveryAddRow}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        행 추가
                      </button>
                      <button
                        type="button"
                        onClick={handleCollectionDeliveryPrint}
                        title="PDF 출력"
                        aria-label="PDF 출력"
                        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-rose-100 bg-white px-2.5 text-[11px] font-bold text-rose-600 shadow-sm hover:bg-rose-50"
                      >
                        <PdfIcon className="h-4 w-4" />
                        <span>PDF</span>
                      </button>
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <label className="space-y-1">
                      <div className="text-[12px] font-medium text-slate-600">전달 일자</div>
                      <input
                        className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]"
                        value={activeCollectionDelivery.deliveredDate}
                        onChange={(e) => handleCollectionDeliveryMetaChange("deliveredDate", e.target.value)}
                        placeholder="YYYY.MM.DD"
                      />
                    </label>
                    <label className="space-y-1">
                      <div className="text-[12px] font-medium text-slate-600">담당자 확인</div>
                      <input
                        className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]"
                        value={activeCollectionDelivery.managerConfirm}
                        onChange={(e) => handleCollectionDeliveryMetaChange("managerConfirm", e.target.value)}
                      />
                    </label>
                    <label className="space-y-1">
                      <div className="text-[12px] font-medium text-slate-600">전달자 확인</div>
                      <input
                        className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]"
                        value={activeCollectionDelivery.senderConfirm}
                        onChange={(e) => handleCollectionDeliveryMetaChange("senderConfirm", e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="overflow-auto rounded-2xl border border-slate-200">
                    <table className={tableClass}>
                      <colgroup>
                        <col style={{ width: "54px" }} />
                        <col style={{ width: "18%" }} />
                        <col style={{ width: "15%" }} />
                        <col style={{ width: "12%" }} />
                        <col />
                        <col style={{ width: "72px" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          {["구분", "회사명", "부서명", "ID", "비고", "작업"].map((label) => (
                            <th key={label} className={thClass}>
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeCollectionDelivery.rows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className={`${tdClass} py-8 text-slate-500`}>
                              전달 리스트 항목이 없습니다. 행 추가를 눌러 입력해 주세요.
                            </td>
                          </tr>
                        ) : (
                          activeCollectionDelivery.rows.map((row: any, index: number) => (
                            <tr key={row.id}>
                              <td className={tdClass}>{index + 1}</td>
                              <td className={tdClass}>
                                <input className="h-9 w-full min-w-[150px] rounded-xl border border-slate-200 px-3 text-[13px]" value={row.companyName} onChange={(e) => handleCollectionDeliveryRowChange(row.id, "companyName", e.target.value)} />
                              </td>
                              <td className={tdClass}>
                                <input className="h-9 w-full min-w-[130px] rounded-xl border border-slate-200 px-3 text-[13px]" value={row.departmentName} onChange={(e) => handleCollectionDeliveryRowChange(row.id, "departmentName", e.target.value)} />
                              </td>
                              <td className={tdClass}>
                                <input className="h-9 w-full min-w-[95px] rounded-xl border border-slate-200 px-3 text-[13px]" value={row.idCode} onChange={(e) => handleCollectionDeliveryRowChange(row.id, "idCode", e.target.value)} />
                              </td>
                              <td className={tdClass}>
                                <input className="h-9 w-full min-w-[320px] rounded-xl border border-slate-200 px-3 text-[13px]" value={row.note} onChange={(e) => handleCollectionDeliveryRowChange(row.id, "note", e.target.value)} />
                              </td>
                              <td className={tdClass}>
                                <button
                                  type="button"
                                  onClick={() => handleCollectionDeliveryDeleteRow(row.id)}
                                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                                >
                                  삭제
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <>
              <div className={`${cardClass} p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
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
                  {collectionTab === "integrated" && (
                    <button
                      type="button"
                      onClick={handleCollectionIntegratedPrint}
                      title="PDF 출력"
                      aria-label="PDF 출력"
                      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-rose-100 bg-white px-4 text-[14px] font-bold text-rose-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50"
                    >
                      <PdfIcon className="h-5 w-5" />
                      <span>PDF</span>
                    </button>
                  )}
                </div>
              </div>
              <div className={`${cardClass} p-4`}>
                <div className="mb-3 text-[18px] font-bold text-slate-900">업종별 현황</div>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full table-fixed text-[14px]">
                    <colgroup>
                      <col style={{ width: "88px" }} />
                      {collectionIndustryMatrix.headers.map((_, index) => (
                        <col key={`industry-col-${index}`} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        {["구분", ...collectionIndustryMatrix.headers].map((head) => (
                          <th key={head} className={`${thClass.replace("text-left", "text-center")} h-12 px-2 py-2 text-center text-[14px] font-semibold leading-none`}>
                            {head}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {collectionIndustryMatrix.rows.map((row) => (
                        <tr key={`industry-summary-row-${row.label}`}>
                          <td className={`${tdClass} h-14 px-2 py-2 text-center text-[14px] font-semibold leading-none`}>{row.label}</td>
                          {row.values.map((value: number, index: number) => (
                            <td key={`${row.label}-${index}`} className={`${tdClass} h-14 px-2 py-2 text-center text-[14px] tabular-nums leading-none`}>
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
                <div className={`overflow-auto rounded-2xl border border-slate-200 ${collectionYearFilter === "all" ? "max-h-[560px]" : ""}`}>
                  <table className={`${tableClass} ${collectionYearFilter === "all" ? "text-[12px]" : ""}`}>
                    <thead>
                      <tr>
                        {collectionTableColumns.map((column) => (
                          <th
                            key={column.label}
                            className={`${thClass} ${collectionYearFilter === "all" ? "px-2 py-2 text-[12px]" : ""} sticky top-0 z-10`}
                          >
                            {column.key ? (
                              <button
                                type="button"
                                onClick={() => handleCollectionSortChange(column.key)}
                                className="inline-flex items-center justify-center gap-1 font-semibold text-slate-700 transition hover:text-blue-700"
                              >
                                {column.label}
                                <span className="text-[11px] text-slate-500">{getCollectionSortMark(column.key)}</span>
                              </button>
                            ) : (
                              column.label
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCollectionRows.map((row: any, index: number) => {
                        const editing = editingCollectionId === row.id
                        return (
                          <tr key={row.id}>
                            <td className={`${tdClass} ${collectionYearFilter === "all" ? "px-2 py-2 text-[12px]" : ""}`}>{index + 1}</td>
                            <td className={`${tdClass} ${collectionYearFilter === "all" ? "px-2 py-2 text-[12px]" : ""}`}>
                              {editing ? <input className="h-9 w-20 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.year || ""} onChange={(e)=>updateEditingCollectionDraft("year", e.target.value)} /> : row.year}
                            </td>
                            <td className={`${tdClass} ${collectionYearFilter === "all" ? "px-2 py-2 text-[12px]" : ""} whitespace-nowrap`}>
                              {editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.companyName || ""} onChange={(e)=>updateEditingCollectionDraft("companyName", e.target.value)} /> : row.companyName}
                            </td>
                            <td className={`${tdClass} ${collectionYearFilter === "all" ? "px-2 py-2 text-[12px]" : ""} whitespace-nowrap`}>
                              {editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.departmentName || ""} onChange={(e)=>updateEditingCollectionDraft("departmentName", e.target.value)} /> : row.departmentName}
                            </td>
                            <td className={`${tdClass} ${collectionYearFilter === "all" ? "px-2 py-2 text-[12px]" : ""}`}>
                              {editing ? <input className="h-9 w-full min-w-[100px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.idCode || ""} onChange={(e)=>updateEditingCollectionDraft("idCode", e.target.value)} /> : row.idCode}
                            </td>
                            <td className={`${tdClass} ${collectionYearFilter === "all" ? "px-2 py-2 text-[12px]" : ""}`}>
                              {editing ? <input className="h-9 w-full min-w-[100px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.industry || ""} onChange={(e)=>updateEditingCollectionDraft("industry", e.target.value)} /> : row.industry}
                            </td>
                            <td className={`${tdClass} ${collectionYearFilter === "all" ? "px-2 py-2 text-[12px]" : ""}`}>
                              {editing ? <input className="h-9 w-full min-w-[90px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingCollectionDraft.claimMonth || ""} onChange={(e)=>updateEditingCollectionDraft("claimMonth", e.target.value)} /> : row.claimMonth}
                            </td>
                            <td className={`${tdClass} ${collectionYearFilter === "all" ? "px-2 py-2 text-[12px]" : ""}`}>
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
                            <td className={`${tdClass} ${collectionYearFilter === "all" ? "px-2 py-2 text-[12px]" : ""}`}>
                              {editing ? (
                                <input
                                  value={editingCollectionDraft.reflectedDate || ""}
                                  onChange={(e) => updateEditingCollectionDraft("reflectedDate", e.target.value)}
                                  placeholder="YYYY.MM.DD"
                                  className="h-9 w-28 rounded-xl border border-slate-200 px-3 text-[12px] font-medium text-slate-700 outline-none focus:border-blue-400"
                                />
                              ) : (
                                row.reflectedDate || ""
                              )}
                            </td>
                            <td className={`${tdClass} ${collectionYearFilter === "all" ? "px-2 py-2 text-[12px]" : ""}`}>
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
                            <td className={`${tdClass} ${collectionYearFilter === "all" ? "px-2 py-2 text-[12px]" : ""}`}>
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
                </>
              )}
            </div>
          )}

          {view === "termination" && selectedSheet && (
            <div className="space-y-4">
              <div className={`${cardClass} p-5`}>
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                    <div className="text-[18px] font-bold">단말기 해지 진행사항</div>
                    <div className="mt-2 text-[13px] text-slate-500">{getSafeTerminationTeamLabel(selectedSheet.teamLabel)}</div>
                    <div className="mt-1 space-y-1 text-[13px] text-slate-600">{getSafeTerminationGuidelines(selectedSheet.guidelines).map((line: string) => <div key={line}>{line}</div>)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="text-[12px] text-slate-500">금주 해지 건수</div><div className="mt-1 text-[20px] font-extrabold">{formatNumber(visibleWeeklyTerminationCount)}건</div></div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="text-[12px] text-slate-500">금주 청구보류 건수</div><div className="mt-1 text-[20px] font-extrabold">{formatNumber(visibleWeeklyBillingHoldCount)}건</div></div>
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
                        필수 항목을 입력한 뒤 등록&저장하면 현재 시트에 바로 저장됩니다.
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
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" type="date" value={terminationDraft.receivedDate} onChange={(e)=>updateTerminationDraft("receivedDate", e.target.value)} {...receivedDatePickerOnlyProps} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">담당자</div>
                        <input className="h-10 w-full rounded-2xl border border-amber-300 bg-amber-50 px-3 text-[14px] text-slate-800" placeholder="담당자" value={terminationDraft.manager} onChange={(e)=>updateTerminationDraft("manager", e.target.value)} />
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
                          {["계약만료","비용절감","활용도 저조","사용자퇴사","타사대체","조직개편","비용미납","폐업","합병매각","휴직/장기출장","기타"].map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
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
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">해지일</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" type="date" value={terminationDraft.terminationDate} onChange={(e)=>updateTerminationDraft("terminationDate", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">위약금</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="위약금" value={terminationDraft.penalty} onChange={(e)=>updateTerminationDraft("penalty", e.target.value)} />
                      </label>
                      <div className="col-span-4 flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleTerminationCreate}
                          disabled={terminationCreateStatus !== "idle"}
                          className={getCreateButtonClass(terminationCreateStatus)}
                        >
                          {getCreateButtonLabel(terminationCreateStatus, "등록&저장")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">접수일</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" type="date" value={holdDraft.receivedDate} onChange={(e)=>updateHoldDraft("receivedDate", e.target.value)} {...receivedDatePickerOnlyProps} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">담당자</div>
                        <input className="h-10 w-full rounded-2xl border border-amber-300 bg-amber-50 px-3 text-[14px] text-slate-800" placeholder="담당자" value={holdDraft.manager} onChange={(e)=>updateHoldDraft("manager", e.target.value)} />
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
                          {["사용자퇴사","사용자이동","계약만료","비용절감","휴직/장기출장","기타"].map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </label>
                      {holdDraft.reason === "기타" && (
                        <label className="space-y-1">
                          <div className="text-[12px] font-medium text-slate-600">기타 사유</div>
                          <input
                            className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]"
                            placeholder="기타 사유"
                            value={holdDraft.reasonDetail}
                            onChange={(e)=>updateHoldDraft("reasonDetail", e.target.value)}
                          />
                        </label>
                      )}
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">시작일</div>
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" type="month" value={holdDraft.startDate} onChange={(e)=>updateHoldDraft("startDate", e.target.value)} />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">종료일</div>
                        <input
                          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900"
                          type="month"
                          value={holdDraft.endDate}
                          onChange={(e)=>updateHoldDraft("endDate", e.target.value)}
                        />
                      </label>
                      <label className="space-y-1">
                        <div className="text-[12px] font-medium text-slate-600">비고</div>
                        <input
                          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]"
                          placeholder="비고"
                          value={holdDraft.note}
                          onChange={(e)=>updateHoldDraft("note", e.target.value)}
                        />
                      </label>
                      <div className="col-span-4 flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleHoldCreate}
                          disabled={holdCreateStatus !== "idle"}
                          className={getCreateButtonClass(holdCreateStatus)}
                        >
                          {getCreateButtonLabel(holdCreateStatus, "등록&저장")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setShowTerminationArchive((prev) => !prev)}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {showTerminationArchive ? (
                      <>
                        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-slate-500">
                          <path d="M8 6.5L4 10L8 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M5 10H11.5C14 10 16 11.8 16 14.2V15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        접수 리스트 보기
                        <span className="ml-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          확정 {formatNumber(confirmedTerminationItems.length)}건
                        </span>
                      </>
                    ) : "해지확정 리스트 보기"}
                  </button>
                </div>
                <div className={`${cardClass} overflow-hidden p-0 ${showTerminationArchive ? "hidden" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="text-[17px] font-bold text-slate-900">해지 리스트</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="h-9 w-56 rounded-xl border border-slate-200 bg-white px-3 text-[13px]"
                        placeholder="고객사/담당자/고객번호 검색"
                        value={terminationQuery}
                        onChange={(e) => setTerminationQuery(e.target.value)}
                      />
                      <select
                        className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[13px]"
                        value={terminationDateFilter}
                        onChange={(e) => setTerminationDateFilter(e.target.value)}
                      >
                        {terminationDateOptions.map((option) => (
                          <option key={`termination-date-${option}`} value={option}>
                            {option === "all" ? "해지일 전체" : option}
                          </option>
                        ))}
                      </select>
                      {(terminationQuery || terminationDateFilter !== "all") && (
                        <button
                          type="button"
                          className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] font-semibold text-slate-600"
                          onClick={() => {
                            setTerminationQuery("")
                            setTerminationDateFilter("all")
                          }}
                        >
                          필터 초기화
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleConfirmSelectedTerminations}
                        disabled={!terminationItems.some((row: any) => row.selected)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                          terminationItems.some((row: any) => row.selected)
                            ? "bg-rose-500 text-white hover:bg-rose-600"
                            : "border border-slate-200 bg-slate-100 text-slate-400"
                        }`}
                      >
                        해지확정
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                  <table className={`${tableClass} min-w-full`}>
                    <thead>
                      <tr>
                        <th className={`${thClass} text-center`}>No.</th>
                        <th className={`${thClass} text-center`}>확정</th>
                        <th className={thClass}>
                          {renderSortLabel("접수일", terminationSort.key === "receivedDate", terminationSort.dir, () => toggleTerminationSort("receivedDate"))}
                        </th>
                        <th className={thClass}>
                          {renderSortLabel("담당자", terminationSort.key === "manager", terminationSort.dir, () => toggleTerminationSort("manager"))}
                        </th>
                        <th className={thClass}>
                          {renderSortLabel("고객번호", terminationSort.key === "customerId", terminationSort.dir, () => toggleTerminationSort("customerId"))}
                        </th>
                        <th className={thClass}>
                          {renderSortLabel("고객사", terminationSort.key === "companyName", terminationSort.dir, () => toggleTerminationSort("companyName"))}
                        </th>
                        <th className={thClass}>
                          {renderSortLabel("고객 부서", terminationSort.key === "departmentName", terminationSort.dir, () => toggleTerminationSort("departmentName"))}
                        </th>
                        <th className={thClass}>
                          {renderSortLabel("해지 사유", terminationSort.key === "reason", terminationSort.dir, () => toggleTerminationSort("reason"))}
                        </th>
                        <th className={thClass}>
                          {renderSortLabel("해지일", terminationSort.key === "terminationDate", terminationSort.dir, () => toggleTerminationSort("terminationDate"))}
                        </th>
                        <th className={`${thClass} text-right`}>
                          {renderSortLabel("위약금", terminationSort.key === "penalty", terminationSort.dir, () => toggleTerminationSort("penalty"))}
                        </th>
                        <th className={`${thClass} text-center`}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {terminationItems.map((row: any, index: number) => {
                        const editing = editingTerminationId === row.id
                        return (
                        <React.Fragment key={row.id}>
                        <tr className={`${editing ? "bg-blue-50/40" : row.selected ? "bg-rose-50" : ""} ${recentTerminationId === row.id ? "recent-row-flash" : ""}`}>
                          <td className={`${tdClass} text-center tabular-nums`}>{index + 1}</td>
                          <td className={`${tdClass} text-center`}>
                            <input
                              type="checkbox"
                              checked={Boolean(row.selected)}
                              onChange={() => toggleTerminationSelected(row.id)}
                            />
                          </td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{normalizeDate(row.receivedDate)}</td>
                          <td className={tdClass}>{row.manager}</td>
                          <td className={tdClass}>{row.customerId}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{row.companyName}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{row.departmentName}</td>
                          <td className={tdClass}>{row.reason}</td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{normalizeDate(row.terminationDate)}</td>
                          <td className={`${tdClass} text-right tabular-nums`}>{row.penalty ? formatNumber(row.penalty) : ""}</td>
                          <td className={`${tdClass} text-center`}>
                            {editing ? (
                              <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">수정 중</span>
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
                          {editing ? (
                            <tr className="bg-blue-50/40">
                              <td colSpan={11} className="border-t border-blue-100 px-4 py-3">
                                <div className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
                                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">접수일</div>
                                      <input type="date" className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.receivedDate || ""} onChange={(e)=>updateEditingTerminationDraft("receivedDate", e.target.value)} {...receivedDatePickerOnlyProps} />
                                    </label>
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">담당자</div>
                                      <input className="h-9 w-full rounded-xl border border-amber-300 bg-amber-50 px-3 text-[13px] text-slate-800" value={editingTerminationDraft.manager || ""} onChange={(e)=>updateEditingTerminationDraft("manager", e.target.value)} />
                                    </label>
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">고객번호</div>
                                      <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.customerId || ""} onChange={(e)=>updateEditingTerminationDraft("customerId", e.target.value)} />
                                    </label>
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">고객사</div>
                                      <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.companyName || ""} onChange={(e)=>updateEditingTerminationDraft("companyName", e.target.value)} />
                                    </label>
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">고객 부서</div>
                                      <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.departmentName || ""} onChange={(e)=>updateEditingTerminationDraft("departmentName", e.target.value)} />
                                    </label>
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">해지 사유</div>
                                      <select className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.reason || "계약만료"} onChange={(e)=>updateEditingTerminationDraft("reason", e.target.value)}>
                                        {["계약만료","비용절감","활용도 저조","사용자퇴사","타사대체","조직개편","비용미납","폐업","합병매각","휴직/장기출장","기타"].map((item) => <option key={item} value={item}>{item}</option>)}
                                      </select>
                                    </label>
                                    {editingTerminationDraft.reason === "기타" && (
                                      <label className="space-y-1">
                                        <div className="text-[11px] font-semibold text-slate-500">기타 사유</div>
                                        <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.reasonDetail || ""} onChange={(e)=>updateEditingTerminationDraft("reasonDetail", e.target.value)} placeholder="기타 사유" />
                                      </label>
                                    )}
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">해지일</div>
                                      <input type="date" className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.terminationDate || ""} onChange={(e)=>updateEditingTerminationDraft("terminationDate", e.target.value)} />
                                    </label>
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">위약금</div>
                                      <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingTerminationDraft.penalty || ""} onChange={(e)=>updateEditingTerminationDraft("penalty", e.target.value)} />
                                    </label>
                                  </div>
                                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                                    <button type="button" onClick={() => handleTerminationUpdate(row.id)} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">수정완료 및 저장</button>
                                    <button type="button" onClick={() => handleDeleteTerminationRow(row.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">삭제</button>
                                    <button type="button" onClick={() => { setEditingTerminationId(null); setEditingTerminationDraft({}) }} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">취소</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                          </React.Fragment>
                      )})}
                    </tbody>
                  </table>
                  </div>
                </div>
                <div className={`${cardClass} overflow-hidden p-0 ${showTerminationArchive ? "" : "hidden"}`}>
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div className="text-[17px] font-bold text-slate-900">해지확정 리스트</div>
                    <button
                      type="button"
                      onClick={handleBulkRestoreConfirmed}
                      disabled={selectedConfirmedIds.length === 0}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                        selectedConfirmedIds.length === 0
                          ? "border border-slate-200 bg-slate-100 text-slate-400"
                          : "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      }`}
                    >
                      선택 복구
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                  <table className={`${tableClass} min-w-full`}>
                    <thead>
                      <tr>
                        <th className={`${thClass} text-center`}>
                          <input
                            type="checkbox"
                            checked={confirmedTerminationItems.length > 0 && selectedConfirmedIds.length === confirmedTerminationItems.length}
                            onChange={(e) => toggleSelectAllConfirmed(e.target.checked)}
                          />
                        </th>
                        <th className={`${thClass} text-center`}>No.</th>
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
                        <th className={thClass}>반영일</th>
                        <th className={`${thClass} text-right`}>위약금</th>
                        <th className={`${thClass} text-center`}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {confirmedTerminationItems.length === 0 ? (
                        <tr>
                          <td className={`${tdClass} text-center text-slate-400`} colSpan={12}>
                            확정된 항목이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        confirmedTerminationItems.map((row: any, index: number) => (
                          <tr key={row.id} className="bg-rose-50">
                            <td className={`${tdClass} text-center`}>
                              <input
                                type="checkbox"
                                checked={selectedConfirmedIds.includes(row.id)}
                                onChange={(e) => {
                                  const checked = e.target.checked
                                  setSelectedConfirmedIds((prev) =>
                                    checked ? [...prev, row.id] : prev.filter((id) => id !== row.id),
                                  )
                                }}
                              />
                            </td>
                            <td className={`${tdClass} text-center tabular-nums`}>{index + 1}</td>
                            <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{normalizeDate(row.receivedDate)}</td>
                            <td className={tdClass}>{getTerminationManagerFallback(row) || "-"}</td>
                            <td className={tdClass}>{row.customerId}</td>
                            <td className={`${tdClass} whitespace-nowrap`}>{row.companyName}</td>
                            <td className={`${tdClass} whitespace-nowrap`}>{row.departmentName}</td>
                            <td className={tdClass}>{row.reason}</td>
                            <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{normalizeDate(row.terminationDate)}</td>
                            <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{normalizeDate(row.reflectedDate)}</td>
                            <td className={`${tdClass} text-right tabular-nums`}>{row.penalty ? formatNumber(row.penalty) : ""}</td>
                            <td className={`${tdClass} text-center`}>
                              <button
                                type="button"
                                onClick={() => restoreTerminationConfirmed(row.id)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap"
                              >
                                복구
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
                <div className={`${cardClass} overflow-hidden p-0 ${showTerminationArchive ? "hidden" : ""}`}>
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div className="text-[17px] font-bold text-slate-900">청구보류 리스트</div>
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
                      <input
                        className="h-9 w-56 rounded-xl border border-slate-200 bg-white px-3 text-[12px]"
                        placeholder="고객사/담당자/고객번호 검색"
                        value={holdQuery}
                        onChange={(e) => setHoldQuery(e.currentTarget.value)}
                        onInput={(e) => setHoldQuery(e.currentTarget.value)}
                        onCompositionEnd={(e) => setHoldQuery(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            setHoldQuery(e.currentTarget.value.trim())
                          }
                        }}
                      />
                      <select
                        className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px]"
                        value={holdReceivedDateFilter}
                        onChange={(e) => setHoldReceivedDateFilter(e.target.value)}
                      >
                        {holdReceivedDateOptions.map((option) => (
                          <option key={`hold-received-${option}`} value={option}>
                            {option === "all" ? "접수일 전체" : option}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px]"
                        value={holdEndDateFilter}
                        onChange={(e) => setHoldEndDateFilter(e.target.value)}
                      >
                        {holdEndDateOptions.map((option) => (
                          <option key={`hold-end-${option}`} value={option}>
                            {option === "all" ? "종료일 전체" : option}
                          </option>
                        ))}
                      </select>
                      {(holdQuery || holdReceivedDateFilter !== "all" || holdEndDateFilter !== "all") && (
                        <button
                          type="button"
                          className="h-9 rounded-xl border border-slate-200 px-3 text-[11px] font-semibold text-slate-600"
                          onClick={() => {
                            setHoldQuery("")
                            setHoldReceivedDateFilter("all")
                            setHoldEndDateFilter("all")
                          }}
                        >
                          필터 초기화
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleReleaseSelectedHoldRows}
                        disabled={selectedHoldIds.length === 0}
                        className={`h-9 rounded-xl px-3 text-[12px] font-semibold ${
                          selectedHoldIds.length === 0
                            ? "border border-slate-200 bg-slate-100 text-slate-400"
                            : "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        }`}
                      >
                        청구재개
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                  <table className={`${tableClass} min-w-full`}>
                    <thead>
                      <tr>
                        <th className={`${thClass} text-center`}>
                          <input
                            type="checkbox"
                            checked={filteredHoldItems.length > 0 && selectedHoldIds.length === filteredHoldItems.length}
                            onChange={(e) => toggleSelectAllHoldItems(e.target.checked)}
                          />
                        </th>
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
                        <th className={thClass}>비고</th>
                        <th className={`${thClass} text-center`}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHoldItems.map((row: any, index: number) => {
                        const editing = editingHoldId === row.id
                        return (
                          <React.Fragment key={row.id}>
                          <tr className={`${editing ? "bg-blue-50/40" : ""} ${recentHoldId === row.id ? "recent-row-flash" : ""}`}>
                          <td className={`${tdClass} text-center`}>
                            <input
                              type="checkbox"
                              checked={selectedHoldIds.includes(row.id)}
                              onChange={(e) => {
                                const checked = e.target.checked
                                setSelectedHoldIds((prev) =>
                                  checked ? [...prev, row.id] : prev.filter((id) => id !== row.id),
                                )
                              }}
                            />
                          </td>
                          <td className={`${tdClass} text-center tabular-nums`}>{index + 1}</td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{normalizeDate(row.receivedDate)}</td>
                          <td className={tdClass}>{row.manager}</td>
                          <td className={tdClass}>{row.customerId}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{row.companyName}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{row.departmentName}</td>
                          <td className={tdClass}>{row.reason}</td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{formatMonthLabel(row.startDate)}</td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{formatMonthLabel(row.endDate)}</td>
                          <td className={`${tdClass} max-w-[240px] text-left`}>
                            <div className="truncate" title={row.note || ""}>{row.note}</div>
                          </td>
                          <td className={`${tdClass} text-center`}>
                            {editing ? (
                              <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">수정 중</span>
                            ) : (
                              <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => startHoldEdit(row)}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap"
                                >
                                  수정
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                          {editing ? (
                            <tr className="bg-blue-50/40">
                              <td colSpan={12} className="border-t border-blue-100 px-4 py-3">
                                <div className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
                                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">접수일</div>
                                      <input type="date" className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.receivedDate || ""} onChange={(e)=>updateEditingHoldDraft("receivedDate", e.target.value)} {...receivedDatePickerOnlyProps} />
                                    </label>
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">담당자</div>
                                      <input className="h-9 w-full rounded-xl border border-amber-300 bg-amber-50 px-3 text-[13px] text-slate-800" value={editingHoldDraft.manager || ""} onChange={(e)=>updateEditingHoldDraft("manager", e.target.value)} />
                                    </label>
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">고객번호</div>
                                      <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.customerId || ""} onChange={(e)=>updateEditingHoldDraft("customerId", e.target.value)} />
                                    </label>
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">고객사</div>
                                      <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.companyName || ""} onChange={(e)=>updateEditingHoldDraft("companyName", e.target.value)} />
                                    </label>
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">고객 부서</div>
                                      <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.departmentName || ""} onChange={(e)=>updateEditingHoldDraft("departmentName", e.target.value)} />
                                    </label>
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">보류 사유</div>
                                      <select className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.reason || "사용자퇴사"} onChange={(e)=>updateEditingHoldDraft("reason", e.target.value)}>
                                        {["사용자퇴사","사용자이동","계약만료","비용절감","휴직/장기출장","기타"].map((item) => <option key={item} value={item}>{item}</option>)}
                                      </select>
                                    </label>
                                    {editingHoldDraft.reason === "기타" && (
                                      <label className="space-y-1">
                                        <div className="text-[11px] font-semibold text-slate-500">기타 사유</div>
                                        <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.reasonDetail || ""} onChange={(e)=>updateEditingHoldDraft("reasonDetail", e.target.value)} placeholder="기타 사유" />
                                      </label>
                                    )}
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">시작일</div>
                                      <input type="month" className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.startDate || ""} onChange={(e)=>updateEditingHoldDraft("startDate", e.target.value)} />
                                    </label>
                                    <label className="space-y-1">
                                      <div className="text-[11px] font-semibold text-slate-500">종료일</div>
                                      <input type="month" className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.endDate || ""} onChange={(e)=>updateEditingHoldDraft("endDate", e.target.value)} />
                                    </label>
                                    <label className="col-span-2 space-y-1 lg:col-span-2 xl:col-span-3">
                                      <div className="text-[11px] font-semibold text-slate-500">비고</div>
                                      <input className="h-9 w-full rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.note || ""} onChange={(e)=>updateEditingHoldDraft("note", e.target.value)} placeholder="비고" />
                                    </label>
                                  </div>
                                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                                    <button type="button" onClick={() => handleHoldUpdate(row.id)} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">수정완료 및 저장</button>
                                    <button type="button" onClick={() => handleMoveHoldToTermination(row.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">해지이동</button>
                                    <button type="button" onClick={() => handleDeleteHoldRow(row.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">삭제</button>
                                    <button type="button" onClick={() => { setEditingHoldId(null); setEditingHoldDraft({}) }} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">취소</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                          </React.Fragment>
                      )})}
                    </tbody>
                  </table>
                  </div>
                </div>
                <div className={`${cardClass} overflow-hidden p-0 hidden`}>
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div className="text-[17px] font-bold text-slate-900">청구보류 해제 리스트</div>
                    <button
                      type="button"
                      onClick={handleBulkRestoreReleased}
                      disabled={selectedReleasedIds.length === 0}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                        selectedReleasedIds.length === 0
                          ? "border border-slate-200 bg-slate-100 text-slate-400"
                          : "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      }`}
                    >
                      선택 복구
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                  <table className={`${tableClass} min-w-full`}>
                    <thead>
                      <tr>
                        <th className={`${thClass} text-center`}>
                          <input
                            type="checkbox"
                            checked={releasedHoldItems.length > 0 && selectedReleasedIds.length === releasedHoldItems.length}
                            onChange={(e) => toggleSelectAllReleased(e.target.checked)}
                          />
                        </th>
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
                        <th className={thClass}>비고</th>
                        <th className={thClass}>반영일</th>
                        <th className={`${thClass} text-center`}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {releasedHoldItems.length === 0 ? (
                        <tr>
                          <td className={`${tdClass} text-center text-slate-400`} colSpan={13}>
                            해제된 항목이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        releasedHoldItems.map((row: any, index: number) => (
                          <tr key={row.id} className="bg-amber-50">
                            <td className={`${tdClass} text-center`}>
                              <input
                                type="checkbox"
                                checked={selectedReleasedIds.includes(row.id)}
                                onChange={(e) => {
                                  const checked = e.target.checked
                                  setSelectedReleasedIds((prev) =>
                                    checked ? [...prev, row.id] : prev.filter((id) => id !== row.id),
                                  )
                                }}
                              />
                            </td>
                            <td className={`${tdClass} text-center tabular-nums`}>{index + 1}</td>
                            <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{normalizeDate(row.receivedDate)}</td>
                            <td className={tdClass}>{row.manager}</td>
                            <td className={tdClass}>{row.customerId}</td>
                            <td className={`${tdClass} whitespace-nowrap`}>{row.companyName}</td>
                            <td className={`${tdClass} whitespace-nowrap`}>{row.departmentName}</td>
                            <td className={tdClass}>{row.reason}</td>
                            <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{formatMonthLabel(row.startDate)}</td>
                            <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{formatMonthLabel(row.endDate)}</td>
                            <td className={`${tdClass} min-w-[180px] text-left`}>{row.note}</td>
                            <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{normalizeDate(row.reflectedDate)}</td>
                            <td className={`${tdClass} text-center`}>
                              <button
                                type="button"
                                onClick={() => restoreReleasedHoldRow(row.id)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap"
                              >
                                복구
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
                </div>
            </div>
          )}

          {view === "option-dashboard" && (
            <div className="space-y-4">
              <OptionDashboardPage />
            </div>
          )}

        </main>
      </div>
    </div>
  )
}



