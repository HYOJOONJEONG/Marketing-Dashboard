"use client"

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { OptionDashboardPage } from "./option-dashboard/OptionDashboardPage"

type ViewKey = "weekly-report" | "contracts" | "weekly-selection" | "manual-input" | "collection" | "option-dashboard" | "termination"
type CollectionTabKey = "integrated" | "long-term" | "delivery"
type SectionKey = "performance" | "termination"

const LOCAL_STORAGE_KEY = "infobiz-dashboard-state-v1"

const viewTitles: Record<ViewKey, string> = {
  "weekly-report": "주간실적보고",
  contracts: "신규계약 리스트",
  "weekly-selection": "주간 반영 리스트",
  "manual-input": "수동 입력 리스트",
  collection: "계약서통합관리",
  "option-dashboard": "유료 옵션 정보 현황",
  termination: "해지 진행사항",
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

function formatMoney(value: unknown) {
  return `${formatNumber(value)}원`
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
  const fallback = ["1. 해지 발생 시 본부장님 보고 진행", "2. CRM 및 해지 리스트 등록"]
  if (!Array.isArray(value) || value.length === 0) return fallback
  const mapped = value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .map((item, idx) => (isBrokenKoreanText(item) ? fallback[idx] || fallback[fallback.length - 1] : item))
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

function normalizeMonth(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
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
    total: "153건",
    rows: [
      ["국내은행", "19건"],
      ["국내증권", "47건"],
      ["보험사", "16건"],
      ["자산운용", "23건"],
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
      .filter((column) => column.title !== "API")
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
    return {
      id: fromSource?.id || fromBase?.id || `paid-option-${index}`,
      title,
      total: sanitizeSummaryText(fromSource?.total, fromBase?.total || "0건"),
      rows: Array.isArray(fromSource?.rows)
        ? fromSource.rows.map((row: any) => [
            sanitizeSummaryText(Array.isArray(row) ? row[0] : row?.[0], ""),
            sanitizeSummaryText(Array.isArray(row) ? row[1] : row?.[1], ""),
          ])
        : Array.isArray(fromBase?.rows)
          ? [...fromBase.rows]
          : [],
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
  return normalizedColumns.map((column: any) => ({
    ...column,
    total: countByTitle.get(column.title) || formatCountToKoreanUnit(column.total, "0건"),
  }))
}

function buildTerminationOverviewRows(rows: any[]) {
  return (Array.isArray(rows) && rows.length ? rows : weeklyTerminationOverviewRows).map((row: any, index: number) => ({
    label: sanitizeSummaryText(row?.label, weeklyTerminationOverviewRows[index]?.label || `행 ${index + 1}`),
    values: Array.from({ length: reportTerminationColumnsStatic.length }, (_, valueIndex) =>
      sanitizeSummaryText(row?.values?.[valueIndex], weeklyTerminationOverviewRows[index]?.values?.[valueIndex] || ""),
    ),
  }))
}

function buildWeeklyIndustryOverviewRows(rows: any[]) {
  return (Array.isArray(rows) && rows.length ? rows : weeklyIndustryOverviewRows).map((row: any, index: number) => ({
    label: sanitizeSummaryText(row?.label, weeklyIndustryOverviewRows[index]?.label || `행 ${index + 1}`),
    values: Array.from({ length: reportIndustryColumnsStatic.length }, (_, valueIndex) =>
      sanitizeSummaryText(row?.values?.[valueIndex], weeklyIndustryOverviewRows[index]?.values?.[valueIndex] || ""),
    ),
  }))
}

const reportTerminationColumnsStatic = ["계약만료", "비용절감", "퇴사", "조직개편", "휴직,장기출장", "합병매각", "활용도 저조", "타사대체", "비용미납", "합계"] as const
const reportIndustryColumnsStatic = ["국내증권", "국내은행", "외국계", "자산운용", "보험사", "일반기업", "공사/정부", "연기금", "기타금융", "합계"] as const

const terminationReasonAlias: Record<string, string> = {
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
  const columns = reportTerminationColumnsStatic.slice(0, -1)
  const indexMap = new Map(columns.map((column, index) => [column, index]))
  const counts = Array.from({ length: columns.length }, () => 0)
  ;(items || []).forEach((item: any) => {
    const reason = normalizeTerminationReason(item?.reason)
    const index = reason ? indexMap.get(reason) : undefined
    if (index == null) return
    counts[index] += 1
  })
  const total = counts.reduce((sum, value) => sum + value, 0)
  return [...counts.map((value) => String(value)), String(total)]
}

function computeTerminationRowTotal(values: any[]) {
  const hasValue = values.some((value) => String(value ?? "").trim() !== "")
  if (!hasValue) return ""
  const hasPercent = values.some((value) => String(value ?? "").includes("%"))
  const sum = values.reduce((total, value) => total + parseLooseNumber(value), 0)
  const percentTotal = hasPercent && sum > 0 && Math.abs(sum - 100) <= 1 ? 100 : sum
  return hasPercent ? `${formatNumber(percentTotal)}%` : formatNumber(sum)
}

function computeIndustryRowTotal(values: any[]) {
  const hasValue = values.some((value) => String(value ?? "").trim() !== "")
  if (!hasValue) return ""
  const sum = values.reduce((total, value) => total + parseLooseNumber(value), 0)
  return formatNumber(sum)
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
}: {
  initialData: any
  initialView?: ViewKey
  initialCollectionTab?: CollectionTabKey
}) {
  const [data, setData] = useState<any>(initialData)
  const [view, setView] = useState<ViewKey>(initialView)
  const [collectionTab, setCollectionTab] = useState<CollectionTabKey>(initialCollectionTab)
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ performance: true, termination: true })
  const [isPending, startTransition] = useTransition()
  const [manualDraft, setManualDraft] = useState<any>(() =>
    buildManualDraftFromWeekly(
      initialData?.weeklyReport || {},
      initialData?.contracts || [],
      initialData?.paidOptionSourceColumns || initialData?.weeklyReport?.paidOptionInfoColumns || [],
    ),
  )
  const [manualRevenueHeaderEdited, setManualRevenueHeaderEdited] = useState(false)
  const [contractDraft, setContractDraft] = useState<any>({
    companyName: "",
    departmentName: "",
    idCode: "",
    industry: "국내증권",
    contractMonth: "",
    recommender: "",
    note: "",
    documentStatus: "미회수",
    replacementType: "신규",
  })
  const [editingContractId, setEditingContractId] = useState<string | null>(null)
  const [editingContractDraft, setEditingContractDraft] = useState<any>({})
  const [contractQuery, setContractQuery] = useState("")
  const [contractStatusFilter, setContractStatusFilter] = useState("all")
  const [contractReplacementFilter, setContractReplacementFilter] = useState("all")
  const [contractMonthFilter, setContractMonthFilter] = useState("all")
  const [contractSort, setContractSort] = useState<{
    key:
      | "companyName"
      | "departmentName"
      | "idCode"
      | "industry"
      | "contractMonth"
      | "recommender"
      | "documentStatus"
      | "replacementType"
      | "note"
    dir: "asc" | "desc"
  }>({
    key: "contractMonth",
    dir: "desc",
  })
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null)
  const [editingCollectionDraft, setEditingCollectionDraft] = useState<any>({})
  const [collectionYearFilter, setCollectionYearFilter] = useState<number | "all">(initialData?.collection?.yearFilter || 2026)
  const [collectionStatusFilter, setCollectionStatusFilter] = useState<string>(initialData?.collection?.statusFilter || "all")
  const [collectionSort, setCollectionSort] = useState<{
    key: "year" | "companyName" | "departmentName" | "idCode" | "industry" | "claimMonth" | "receiptDate" | "reflectedDate" | "status"
    dir: "asc" | "desc"
  }>(initialData?.collection?.sort || { key: "year", dir: "desc" })
  const [selectedDeliveryHistoryDate, setSelectedDeliveryHistoryDate] = useState<string>("")
  const [historyStack, setHistoryStack] = useState<any[]>([])
  const pendingSaveRef = useRef<number | null>(null)
  const pendingPayloadRef = useRef<string | null>(null)
  const pendingDataRef = useRef<any | null>(null)
  const lastHistoryAtRef = useRef<number>(0)
  const flushPendingSave = useRef<() => void>(() => {})
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
    reasonDetail: "",
    startDate: "",
    endDate: "",
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
  const [selectedReleasedIds, setSelectedReleasedIds] = useState<string[]>([])
  const [holdReceivedDateFilter, setHoldReceivedDateFilter] = useState("all")
  const [holdEndDateFilter, setHoldEndDateFilter] = useState("all")
  const [holdQuery, setHoldQuery] = useState("")

  const weeklyReport = data.weeklyReport || {}
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

  useEffect(() => {
    if (normalizedTerminationOnceRef.current) return
    if (!termination.sheets || termination.sheets.length === 0) return
    const activeSheet = termination.sheets[0]
    const selectedItems = (activeSheet.items || []).filter((row: any) => row.selected)
    const needsPrune = termination.sheets.length > 1
    const needsMove = selectedItems.length > 0
    if (!needsPrune && !needsMove) return
    normalizedTerminationOnceRef.current = true
    const nextActiveSheet = {
      ...activeSheet,
      items: needsMove ? (activeSheet.items || []).filter((row: any) => !row.selected) : activeSheet.items || [],
      confirmedItems: needsMove
        ? [
            ...selectedItems.map((row: any) => ({ ...row, selected: true })),
            ...(activeSheet.confirmedItems || []),
          ]
        : activeSheet.confirmedItems || [],
    }
    startTransition(async () => {
      await persist({
        ...data,
        termination: {
          ...termination,
          currentSheetId: nextActiveSheet.id,
          sheets: [nextActiveSheet],
        },
      })
    })
  }, [data, termination, startTransition])
  const includedContracts = useMemo(() => contracts.filter((row: any) => row.includedInWeekly), [contracts])
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
    return ["all", ...Array.from(values)]
  }, [contracts])
  const filteredContracts = useMemo(() => {
    const query = contractQuery.trim().toLowerCase()
    return contracts.filter((row: any) => {
      if (contractStatusFilter !== "all" && row.documentStatus !== contractStatusFilter) return false
      if (contractReplacementFilter !== "all" && (row.replacementType || "신규") !== contractReplacementFilter) return false
      if (contractMonthFilter !== "all" && row.contractMonth !== contractMonthFilter) return false
      if (!query) return true
      return [
        row.companyName,
        row.departmentName,
        row.idCode,
        row.industry,
        row.contractMonth,
        row.recommender,
        row.note,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [contracts, contractQuery, contractStatusFilter, contractReplacementFilter, contractMonthFilter])
  const sortedContracts = useMemo(
    () => sortByKey(filteredContracts, contractSort.key, contractSort.dir),
    [filteredContracts, contractSort],
  )

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
    setManualDraft(buildManualDraftFromWeekly(weeklyReport, contracts, paidOptionSourceColumns))
    setManualRevenueHeaderEdited(false)
  }, [weeklyReport, contracts, paidOptionSourceColumns])

  const contractMonthStats = useMemo(() => {
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
  }, [contracts, currentYear])
  const currentMonthKey = useMemo(() => {
    const now = new Date()
    return now.getFullYear() * 100 + (now.getMonth() + 1)
  }, [])
  const contractRecommenderStats = useMemo(() => {
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
  }, [contracts])
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
      .map(([date, entry]) => ({ value: date, label: `${date} 주차`, entry }))
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
    return collectionRows.filter((row: any) => {
      const yearOk = collectionYearFilter === "all" ? true : Number(row.year) === Number(collectionYearFilter)
      const statusOk = collectionStatusFilter === "all" ? true : (row.status || "미정") === collectionStatusFilter
      return yearOk && statusOk
    })
  }, [collectionRows, collectionStatusFilter, collectionYearFilter])
  const sortedCollectionRows = useMemo(
    () => sortByKey(filteredCollectionRows, collectionSort.key, collectionSort.dir),
    [filteredCollectionRows, collectionSort],
  )
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
    const query = terminationQuery.trim().toLowerCase()
    const rows = selectedSheet?.items || []
    return rows.filter((row: any) => {
      if (terminationSort.key === "terminationDate" && !String(row.terminationDate || "").trim()) {
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
      if (!query) return true
      return [row.companyName, row.departmentName, row.customerId, row.manager, row.reason]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [selectedSheet, terminationQuery, terminationReasonFilter, terminationDateFilter, terminationSort.key])
  const terminationReasonOptions = useMemo(() => {
    const base = reportTerminationColumnsStatic.slice(0, -1)
    return ["all", ...base, "기타"]
  }, [])
  const terminationDateOptions = useMemo(() => {
    const dates = new Set<string>()
    ;(selectedSheet?.items || []).forEach((row: any) => {
      const value = normalizeDate(row.terminationDate)
      if (value) dates.add(value)
    })
    return ["all", ...Array.from(dates).sort().reverse()]
  }, [selectedSheet])
  const terminationItems = useMemo(
    () => sortByKey(filteredTerminationItemsBase, terminationSort.key, terminationSort.dir),
    [filteredTerminationItemsBase, terminationSort],
  )
  const holdItems = useMemo(
    () => sortByKey(selectedSheet?.holdItems || [], holdSort.key, holdSort.dir),
    [selectedSheet, holdSort],
  )
  const filteredHoldItems = useMemo(() => {
    const query = holdQuery.trim().toLowerCase()
    return holdItems.filter((row: any) => {
      if (holdReceivedDateFilter !== "all" && normalizeDate(row.receivedDate) !== holdReceivedDateFilter) return false
      if (holdEndDateFilter !== "all" && normalizeDate(row.endDate) !== holdEndDateFilter) return false
      if (!query) return true
      return [row.companyName, row.departmentName, row.customerId, row.manager, row.reason]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [holdItems, holdReceivedDateFilter, holdEndDateFilter, holdQuery])
  const holdReceivedDateOptions = useMemo(() => {
    const dates = new Set<string>()
    holdItems.forEach((row: any) => {
      const value = normalizeDate(row.receivedDate)
      if (value) dates.add(value)
    })
    return ["all", ...Array.from(dates).sort().reverse()]
  }, [holdItems])
  const holdEndDateOptions = useMemo(() => {
    const dates = new Set<string>()
    holdItems.forEach((row: any) => {
      const value = normalizeDate(row.endDate)
      if (value) dates.add(value)
    })
    return ["all", ...Array.from(dates).sort().reverse()]
  }, [holdItems])
  const confirmedTerminationItems = useMemo(
    () => sortByKey(selectedSheet?.confirmedItems || [], terminationSort.key, terminationSort.dir),
    [selectedSheet, terminationSort],
  )
  const releasedHoldItems = useMemo(
    () => sortByKey(selectedSheet?.releasedHoldItems || [], holdSort.key, holdSort.dir),
    [selectedSheet, holdSort],
  )
  useEffect(() => {
    setSelectedConfirmedIds((prev) => prev.filter((id) => confirmedTerminationItems.some((row: any) => row.id === id)))
  }, [confirmedTerminationItems])

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

  function persist(nextData: any) {
    const now = Date.now()
    setData(nextData)
    pendingDataRef.current = nextData
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextData))
      }
    } catch {}
    if (pendingSaveRef.current) {
      window.clearTimeout(pendingSaveRef.current)
    }
    pendingSaveRef.current = window.setTimeout(() => {
      const body = pendingPayloadRef.current || (pendingDataRef.current ? JSON.stringify(pendingDataRef.current) : null)
      if (!pendingPayloadRef.current && pendingDataRef.current) {
        pendingPayloadRef.current = body
      }
      pendingPayloadRef.current = null
      pendingSaveRef.current = null
      if (!body) return
      const send = () => fetch("/api/dashboard", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => {})
      if ("requestIdleCallback" in window) {
        ;(window as any).requestIdleCallback(send, { timeout: 300 })
      } else {
        void send()
      }
    }, 30)
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
  }

  flushPendingSave.current = () => {
    const body = pendingPayloadRef.current || (pendingDataRef.current ? JSON.stringify(pendingDataRef.current) : null)
    pendingPayloadRef.current = null
    if (!body) return
    if ("sendBeacon" in navigator) {
      const blob = new Blob([body], { type: "application/json" })
      ;(navigator as any).sendBeacon("/api/dashboard", blob)
      return
    }
    void fetch("/api/dashboard", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {})
  }

  useEffect(() => {
    const handleBeforeUnload = () => {
      flushPendingSave.current()
    }
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushPendingSave.current()
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])

  useEffect(() => {
    const serverCollection = data?.collection || {}
    setCollectionTab(serverCollection?.tab || "integrated")
    setCollectionYearFilter(serverCollection?.yearFilter || 2026)
    setCollectionStatusFilter(serverCollection?.statusFilter || "all")
    setCollectionSort(serverCollection?.sort || { key: "year", dir: "desc" })
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
    } catch {}
  }, [])

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
      note: row.note || "",
      documentStatus: row.documentStatus || "미회수",
      replacementType: row.replacementType || "신규",
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

  function updateManualPaidOptionColumn(columnIndex: number, field: string, value: string) {
    setManualDraft((prev: any) => {
      const paidOptionInfoColumns = cloneData(prev.paidOptionInfoColumns || [])
      if (!paidOptionInfoColumns[columnIndex]) return prev
      paidOptionInfoColumns[columnIndex][field] = value
      return { ...prev, paidOptionInfoColumns }
    })
  }

  function updateManualPaidOptionItem(columnIndex: number, itemIndex: number, value: string) {
    setManualDraft((prev: any) => {
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
    setManualDraft((prev: any) => {
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
      const response = await fetch("/api/options?basis=seed&category=all&activeOnly=1", {
        cache: "no-store",
      })
      if (!response.ok) {
        throw new Error(`옵션정보 API 오류 (${response.status})`)
      }
      const payload = await response.json()
      const nextColumns = applySeedTotalsToPaidOptionColumns(paidOptionSourceColumns, Array.isArray(payload?.cards) ? payload.cards : [])
      setManualDraft((prev: any) => ({
        ...prev,
        paidOptionInfoColumns: cloneData(nextColumns),
      }))
      window.alert("옵션정보를 불러왔습니다.")
    } catch (error: any) {
      const message = String(error?.message || "옵션정보를 불러오지 못했습니다.")
      window.alert(message)
    }
  }

  function loadTerminationOverviewFromWeeklyList() {
    const confirmedItems = Array.isArray(selectedSheet?.confirmedItems) ? selectedSheet.confirmedItems : []
    const weeklySelected = Array.isArray(selectedSheet?.items)
      ? selectedSheet.items.filter((row: any) => row?.selected)
      : []
    const weeklyValues = buildTerminationWeeklyCounts(weeklySelected)
    const confirmedValues = buildTerminationWeeklyCounts(confirmedItems)
    const combineValues = (base: string[], extra: string[]) => {
      const totalIndex = base.length - 1
      const combined = base.map((value, index) =>
        index === totalIndex ? "0" : String(parseLooseNumber(value) + parseLooseNumber(extra[index])),
      )
      const total = combined
        .slice(0, totalIndex)
        .reduce((sum, value) => sum + parseLooseNumber(value), 0)
      combined[totalIndex] = String(total)
      return combined
    }
    const cumulativeValues = combineValues(confirmedValues, weeklyValues)
    setManualDraft((prev: any) => {
      const terminationOverviewRows = cloneData(prev.terminationOverviewRows || [])
      const weeklyIndex = terminationOverviewRows.findIndex((row: any) => row.label === "주간")
      const cumulativeIndex = terminationOverviewRows.findIndex((row: any) => row.label === "누적")
      if (weeklyIndex === -1 && cumulativeIndex === -1) return prev
      if (weeklyIndex !== -1) terminationOverviewRows[weeklyIndex].values = weeklyValues
      if (cumulativeIndex !== -1) terminationOverviewRows[cumulativeIndex].values = cumulativeValues
      return { ...prev, terminationOverviewRows }
    })
  }

  function updateManualTerminationOverviewCell(rowIndex: number, valueIndex: number, value: string) {
    setManualDraft((prev: any) => {
      const terminationOverviewRows = cloneData(prev.terminationOverviewRows || [])
      if (!terminationOverviewRows[rowIndex]) return prev
      if (!Array.isArray(terminationOverviewRows[rowIndex].values)) terminationOverviewRows[rowIndex].values = []
      terminationOverviewRows[rowIndex].values[valueIndex] = value
      return { ...prev, terminationOverviewRows }
    })
  }

  function updateManualWeeklyIndustryOverviewCell(rowIndex: number, valueIndex: number, value: string) {
    setManualDraft((prev: any) => {
      const weeklyIndustryOverviewRows = cloneData(prev.weeklyIndustryOverviewRows || [])
      if (!weeklyIndustryOverviewRows[rowIndex]) return prev
      if (!Array.isArray(weeklyIndustryOverviewRows[rowIndex].values)) weeklyIndustryOverviewRows[rowIndex].values = []
      weeklyIndustryOverviewRows[rowIndex].values[valueIndex] = value
      return { ...prev, weeklyIndustryOverviewRows }
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
    const nextContracts = contracts.map((row: any) =>
      row.id === contractId ? { ...row, includedInWeekly: !row.includedInWeekly } : row,
    )
    persist({ ...data, contracts: nextContracts })
  }

  function handleMoveWeeklySelectionToCollection() {
    if (!includedContracts.length) {
      window.alert("선택된 계약이 없습니다.")
      return
    }
    if (!window.confirm("신규 계약 리스트에서 삭제가 됩니다.\n계약서통합관리로 이동할까요?")) return

    startTransition(async () => {
      const baseDate = normalizeDate(weeklyReport?.baseDate || new Date().toISOString().slice(0, 10))
      const reflectedDate = normalizeDate(new Date().toISOString().slice(0, 10))
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
          reflectedDate,
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
          sort: collectionSort,
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
      console.debug("[contracts] create start", contractDraft)
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
          replacementType: contractDraft.replacementType || "신규",
          includedInWeekly: false,
          recommender: contractDraft.recommender.trim(),
          note: contractDraft.note.trim(),
          replacementType: "신규",
        },
        ...contracts,
      ]
      await persist({ ...data, contracts: nextContracts })
      console.debug("[contracts] create done", nextContracts[0])
      setContractDraft({
        companyName: "",
        departmentName: "",
        idCode: "",
        industry: "국내증권",
        contractMonth: "",
        recommender: "",
        note: "",
        documentStatus: "미회수",
        replacementType: "신규",
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
              note: editingContractDraft.note.trim(),
              documentStatus: editingContractDraft.documentStatus,
              replacementType: editingContractDraft.replacementType || "신규",
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
          sort: collectionSort,
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
      })
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
          sort: collectionSort,
        },
      })
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
    persist({
      ...data,
      collection: {
        ...collection,
        delivery: nextDelivery,
        tab: collectionTab,
        yearFilter: collectionYearFilter,
        statusFilter: collectionStatusFilter,
        sort: collectionSort,
      },
    })
  }

  function buildCollectionDeliverySnapshot() {
    const deliveredDate = normalizeDate(collectionDelivery.deliveredDate)
    if (!deliveredDate) return null
    return {
      id: `delivery-history-${Date.now()}`,
      deliveredDate,
      title: collectionDelivery.title,
      managerConfirm: collectionDelivery.managerConfirm,
      senderConfirm: collectionDelivery.senderConfirm,
      savedAt: new Date().toISOString(),
      rows: collectionDelivery.rows.map((row: any, index: number) => ({
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

  function handleCollectionDeliverySaveHistory() {
    const snapshot = buildCollectionDeliverySnapshot()
    if (!snapshot) {
      window.alert("전달 일자를 먼저 입력해 주세요.")
      return
    }
    const nextHistory = [
      snapshot,
      ...(collectionDelivery.history || []).filter(
        (entry: any) => normalizeDate(entry.deliveredDate) !== snapshot.deliveredDate,
      ),
    ]
    persistCollectionDelivery({
      ...collectionDelivery,
      deliveredDate: snapshot.deliveredDate,
      history: nextHistory,
    })
    setSelectedDeliveryHistoryDate(snapshot.deliveredDate)
    window.alert(`${snapshot.deliveredDate} 주차 리스트로 저장되었습니다.`)
  }

  function applyCollectionDeliveryHistory(target: any, selectedDate: string) {
    persistCollectionDelivery({
      ...collectionDelivery,
      title: String(target.title || collectionDelivery.title),
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
      history: collectionDelivery.history || [],
    })
  }

  function handleCollectionDeliveryLoadHistory(dateKey?: string, skipConfirm = false) {
    const selectedDate = normalizeDate(dateKey || selectedDeliveryHistoryDate)
    if (!selectedDate) {
      window.alert("불러올 전달일자 히스토리를 선택해 주세요.")
      return
    }
    const target = (collectionDelivery.history || []).find(
      (entry: any) => normalizeDate(entry.deliveredDate) === selectedDate,
    )
    if (!target) {
      window.alert("선택한 전달일자 히스토리를 찾을 수 없습니다.")
      return
    }
    if (!skipConfirm && !window.confirm(`${selectedDate} 주차 리스트를 불러올까요?`)) return
    applyCollectionDeliveryHistory(target, selectedDate)
  }

  function handleCollectionDeliveryHistorySelect(nextDate: string) {
    setSelectedDeliveryHistoryDate(nextDate)
    if (!nextDate) return
    const currentDate = normalizeDate(collectionDelivery.deliveredDate)
    if (currentDate === normalizeDate(nextDate)) return
    handleCollectionDeliveryLoadHistory(nextDate, true)
  }

  function handleCollectionDeliveryMetaChange(field: "title" | "deliveredDate" | "managerConfirm" | "senderConfirm", value: string) {
    persistCollectionDelivery({
      ...collectionDelivery,
      [field]: field === "deliveredDate" ? normalizeDate(value) : value,
    })
  }

  function handleCollectionDeliveryRowChange(
    rowId: string,
    field: "companyName" | "departmentName" | "idCode" | "recommender" | "contractMonth" | "recoveredCount" | "note",
    value: string,
  ) {
    const nextRows = collectionDelivery.rows.map((row: any) =>
      row.id === rowId
        ? { ...row, [field]: value }
        : row,
    )
    persistCollectionDelivery({
      ...collectionDelivery,
      rows: nextRows,
    })
  }

  function handleCollectionDeliveryAddRow() {
    persistCollectionDelivery({
      ...collectionDelivery,
      rows: [
        ...collectionDelivery.rows,
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
    })
  }

  function handleCollectionDeliveryDeleteRow(rowId: string) {
    if (!window.confirm("이 전달 항목을 삭제할까요?")) return
    persistCollectionDelivery({
      ...collectionDelivery,
      rows: collectionDelivery.rows.filter((row: any) => row.id !== rowId),
    })
  }

  function handleCollectionDeliveryPrint() {
    const popup = window.open("", "_blank", "width=980,height=1200")
    if (!popup) {
      window.alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.")
      return
    }
    const rowsHtml = collectionDelivery.rows
      .map((row: any, index: number) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(row.companyName)}</td>
          <td>${escapeHtml(row.departmentName)}</td>
          <td>${escapeHtml(row.idCode)}</td>
          <td>${escapeHtml(row.recommender)}</td>
          <td>${escapeHtml(row.contractMonth)}</td>
          <td>${escapeHtml(row.recoveredCount)}</td>
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
        <title>${escapeHtml(collectionDelivery.title)}</title>
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
          td:nth-child(2), td:nth-child(3), td:nth-child(8) { text-align: left; }
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
                <h1 class="title">${escapeHtml(collectionDelivery.title)}</h1>
                <div class="subtitle">계약서 전달 확인용 문서</div>
              </div>
              <div class="meta">
                <div class="meta-row">
                  <span class="meta-label">전달 일자 :</span>
                  <span class="meta-value">${escapeHtml(collectionDelivery.deliveredDate)}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">담당자 확인 :</span>
                  <span class="meta-sign-line">${escapeHtml(collectionDelivery.managerConfirm)}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">전달자 확인 :</span>
                  <span class="meta-sign-line">${escapeHtml(collectionDelivery.senderConfirm)}</span>
                </div>
              </div>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style="width:6%">구분</th>
                    <th style="width:24%">회사명</th>
                    <th style="width:14%">부서명</th>
                    <th style="width:10%">ID</th>
                    <th style="width:7%">권유</th>
                    <th style="width:8%">계약월</th>
                    <th style="width:7%">회수</th>
                    <th>비고</th>
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
    popup.focus()
    popup.print()
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

  function handleConfirmSelectedTerminations() {
    if (!selectedSheet) return
    const activeItems = selectedSheet.items || []
    const selectedItems = activeItems.filter((row: any) => row.selected)
    if (!selectedItems.length) return
    const reflectedDate = normalizeDate(new Date().toISOString().slice(0, 10))
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              items: (sheet.items || []).filter((row: any) => !row.selected),
              confirmedItems: [
                ...selectedItems.map((row: any) => ({ ...row, reflectedDate })),
                ...(sheet.confirmedItems || []),
              ],
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
    })
  }

  function restoreTerminationConfirmed(itemId: string) {
    if (!selectedSheet) return
    const confirmedItems = selectedSheet.confirmedItems || []
    const targetItem = confirmedItems.find((row: any) => row.id === itemId)
    if (!targetItem) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              items: [{ ...targetItem, selected: false }, ...(sheet.items || [])],
              confirmedItems: (sheet.confirmedItems || []).filter((row: any) => row.id !== itemId),
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
      reasonDetail: "",
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
      reason: holdDraft.reason === "기타" && holdDraft.reasonDetail?.trim()
        ? `기타(${holdDraft.reasonDetail.trim()})`
        : holdDraft.reason,
      startDate: normalizeMonth(holdDraft.startDate),
      endDate: normalizeMonth(holdDraft.endDate),
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

  function toggleContractSort(
    key:
      | "companyName"
      | "departmentName"
      | "idCode"
      | "industry"
      | "contractMonth"
      | "recommender"
      | "documentStatus"
      | "replacementType"
      | "note",
  ) {
    setContractSort((prev) =>
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

  function toggleSelectAllReleased(checked: boolean) {
    if (checked) {
      setSelectedReleasedIds(releasedHoldItems.map((row: any) => row.id))
      return
    }
    setSelectedReleasedIds([])
  }

  function handleBulkRestoreConfirmed() {
    if (!selectedSheet || selectedConfirmedIds.length === 0) return
    const confirmedItems = selectedSheet.confirmedItems || []
    const restoreTargets = confirmedItems.filter((row: any) => selectedConfirmedIds.includes(row.id))
    if (!restoreTargets.length) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              items: [...restoreTargets.map((row: any) => ({ ...row, selected: false })), ...(sheet.items || [])],
              confirmedItems: (sheet.confirmedItems || []).filter((row: any) => !selectedConfirmedIds.includes(row.id)),
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      setSelectedConfirmedIds([])
    })
  }

  function handleBulkRestoreReleased() {
    if (!selectedSheet || selectedReleasedIds.length === 0) return
    const releasedItems = selectedSheet.releasedHoldItems || []
    const restoreTargets = releasedItems.filter((row: any) => selectedReleasedIds.includes(row.id))
    if (!restoreTargets.length) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              holdItems: [...restoreTargets, ...(sheet.holdItems || [])],
              releasedHoldItems: (sheet.releasedHoldItems || []).filter((row: any) => !selectedReleasedIds.includes(row.id)),
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      setSelectedReleasedIds([])
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
                      reason: editingHoldDraft.reason === "기타" && editingHoldDraft.reasonDetail?.trim()
                        ? `기타(${editingHoldDraft.reasonDetail.trim()})`
                        : editingHoldDraft.reason,
                      startDate: normalizeMonth(editingHoldDraft.startDate),
                      endDate: normalizeMonth(editingHoldDraft.endDate),
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

  function handleReleaseHoldRow(rowId: string) {
    if (!selectedSheet) return
    const row = (selectedSheet.holdItems || []).find((item: any) => item.id === rowId)
    if (!row) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
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
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
      if (editingHoldId === rowId) {
        setEditingHoldId(null)
        setEditingHoldDraft({})
      }
    })
  }

  function restoreReleasedHoldRow(rowId: string) {
    if (!selectedSheet) return
    const row = (selectedSheet.releasedHoldItems || []).find((item: any) => item.id === rowId)
    if (!row) return
    startTransition(async () => {
      const nextSheets = (termination.sheets || []).map((sheet: any) =>
        sheet.id === selectedSheet.id
          ? {
              ...sheet,
              holdItems: [{ ...row }, ...(sheet.holdItems || [])],
              releasedHoldItems: (sheet.releasedHoldItems || []).filter((item: any) => item.id !== rowId),
            }
          : sheet,
      )
      await persist({ ...data, termination: { ...termination, currentSheetId: selectedSheet.id, sheets: nextSheets } })
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
        paidOptionInfoColumns: cloneData(manualDraft.paidOptionInfoColumns || []),
        terminationOverviewRows: cloneData(manualDraft.terminationOverviewRows || []),
        weeklyIndustryOverviewRows: cloneData(manualDraft.weeklyIndustryOverviewRows || []),
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
  const displayBaseDate = formatDateDashed(getUpcomingThursday())
  const revenueHeaderText = reportRevenueDisplay.header
  const revenueSubtitleOne = reportRevenueDisplay.subtitleOne
  const revenueSubtitleTwo = reportRevenueDisplay.subtitleTwo
  const revenueNoteText = buildRevenueNoteText(displayBaseDate, weeklyReport?.revenueUnitPrice)
  const revenueHeaderMetric = splitRevenueMetric(revenueHeaderText, "주간 순증 매출")
  const revenueSubtitleMetricOne = splitRevenueMetric(revenueSubtitleOne, "26년 순증 매출")
  const revenueSubtitleMetricTwo = splitRevenueMetric(revenueSubtitleTwo, "연간 누적 매출 (추정)")
  const revenueNoteParts = splitRevenueNoteText(revenueNoteText)
  const manualGoalRows = buildGoalRows(manualDraft.goalRows || [])
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
  const paidOptionColumns = buildPaidOptionInfoColumns(weeklyReport.paidOptionInfoColumns || [])
  const manualPaidOptionColumns = buildPaidOptionInfoColumns(manualDraft.paidOptionInfoColumns || [])
  const reportTerminationColumns = [...reportTerminationColumnsStatic]
  const reportTerminationRows = buildTerminationOverviewRows(weeklyReport.terminationOverviewRows || [])
  const reportIndustryColumns = [...reportIndustryColumnsStatic]
  const reportIndustryRows = buildWeeklyIndustryOverviewRows(weeklyReport.weeklyIndustryOverviewRows || [])

  return (
    <div className="dashboard-shell min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1720px]">
          <aside className="dashboard-sidebar w-[272px] border-r border-slate-200 bg-white px-4 py-4">
            <div className="overflow-hidden rounded-[24px] border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f5f9ff_100%)] px-5 py-4 shadow-[0_8px_20px_rgba(37,99,235,0.06)]">
              <div className="flex items-center justify-start">
                <img
                  src="/yonhapinfomax-logo.png"
                  alt="연합인포맥스"
                  className="h-8 w-auto shrink-0 object-contain"
                />
              </div>
              <div
                className="mt-2.5 text-[19px] font-black leading-[1.22] tracking-[-0.055em] text-[#1e3a8a]"
                style={{ fontFamily: '"SUIT Variable","Pretendard Variable","Aptos","Noto Sans KR",sans-serif' }}
              >
                인포Biz본부
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
                <button
                  type="button"
                  onClick={() => setView("option-dashboard")}
                  className={`flex h-11 w-full items-center rounded-2xl px-4 text-left text-[15px] font-semibold ${
                    view === "option-dashboard" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {viewTitles["option-dashboard"]}
                </button>
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
                        {[revenueNoteParts.primary, revenueNoteParts.secondary].filter(Boolean).join(" / ")}
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
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.holdTotal)}대</td>
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
                        <td className={`${weeklyTdClass} font-semibold`}>{formatNumber(reportSummary?.terminationTypeTotal)}대</td>
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
                              ? computeTerminationRowTotal((row.values || []).slice(0, reportTerminationColumns.length - 1))
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
                    <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" placeholder="권유자" value={contractDraft.recommender} onChange={(e)=>updateContractDraft("recommender", e.target.value)} />
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
                      <button type="button" onClick={handleContractCreate} className="h-10 rounded-2xl bg-blue-600 px-4 text-[14px] font-semibold text-white whitespace-nowrap">
                        {isPending ? "등록 중..." : "등록"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                  className="h-9 w-64 rounded-xl border border-slate-200 bg-white px-3 text-[13px]"
                  placeholder="회사명/부서/아이디/권유자 검색"
                  value={contractQuery}
                  onChange={(e) => setContractQuery(e.target.value)}
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
                        <tr key={row.id}>
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
                            {editing ? <input className="h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px]" value={editingContractDraft.recommender || ""} onChange={(e)=>updateEditingContractDraft("recommender", e.target.value)} /> : <span className="block truncate">{row.recommender}</span>}
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
                                <button type="button" onClick={() => handleContractUpdate(row.id)} className="rounded-lg bg-blue-600 px-2 py-1.5 text-[11px] font-semibold text-white whitespace-nowrap">수정완료</button>
                                <button type="button" onClick={() => handleContractDelete(row.id)} className="rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-700 whitespace-nowrap">삭제</button>
                                <button type="button" onClick={() => { setEditingContractId(null); setEditingContractDraft({}) }} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold whitespace-nowrap">취소</button>
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                <button type="button" onClick={() => startContractEdit(row)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold">수정</button>
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
                  <thead><tr>{["선택","No.","회사명","부서명","ID","업종","계약월","권유자","계약서 상태","대체여부"].map((head)=><th key={head} className={thClass}>{head}</th>)}</tr></thead>
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
                        <td className={tdClass}>{row.replacementType || "신규"}</td>
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
                  </div>
                </div>
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_180px_220px]">
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
                      {calcHint("((합계 - 매출순증) × 1,000,000) + (누적순증 합계 × 단가)")}
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
                          baseRows.reduce((sum: number, row) => sum + toNumber(row.months?.[monthIndex]), 0),
                        )
                        return manualRevenueRows.map((row, rowIndex) => {
                          const isTotalRow = row.label === "합계"
                          const displayMonths = isTotalRow ? revenueTotalMonths : (row.months || [])
                          const total = (displayMonths || []).reduce((sum: number, value: number) => sum + toNumber(value), 0)
                        return (
                          <tr key={row.key || rowIndex}>
                            <td className={manualLabelCellClass}>{row.label}</td>
                            {(displayMonths || []).map((monthValue: number, monthIndex: number) => (
                              <td key={`${row.key}-${monthIndex}`} className={`${tdClass} p-1`}>
                                <input
                                  className={`${manualTableInputClass} ${isTotalRow ? "font-semibold text-slate-900" : ""}`}
                                  style={isTotalRow ? { backgroundColor: "#fffbeb", borderColor: "#fcd34d" } : undefined}
                                  value={String(monthValue ?? "")}
                                  onChange={(e) => updateManualRevenueCell(rowIndex, monthIndex, e.target.value)}
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

              <div className="space-y-3">
                {summaryMatrixRows.map((section) => (
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
                          {section.cells.map(([label, field], cellIndex) => (
                            <td key={`${section.title}-${field}`} className={`${tdClass} p-1`}>
                              <input
                                className={`${manualTableInputClass} ${section.cells.length === 4 && cellIndex === section.cells.length - 1 ? "text-left px-4" : ""}`}
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
                    {manualGoalRows.map((row: any, rowIndex: number) => {
                      const isTotalRow = row.month === "합계"
                      const isQuarterGroupStart = rowIndex < 12 && rowIndex % 3 === 0
                      const shouldRenderQuarterValue = isTotalRow || rowIndex >= 12 || isQuarterGroupStart
                      const quarterRowSpan = !isTotalRow && rowIndex < 12 ? 3 : undefined
                      return (
                        <tr key={`${row.month}-${rowIndex}`}>
                          <td className={`${manualLabelCellClass} ${isTotalRow ? "font-bold text-slate-900" : ""}`}>{row.month}</td>
                          {["netTarget", "targetContracts"].map((field) => (
                            <td key={field} className={`${tdClass} p-1`}>
                              <input
                                className={`${manualTableInputClass} ${isTotalRow ? "font-bold text-slate-900" : ""}`}
                                style={isTotalRow ? {
                                  backgroundColor: "#fffbeb",
                                  borderColor: "#fcd34d",
                                } : undefined}
                                value={String(row[field] ?? "")}
                                onChange={(e) => updateManualGoalRow(rowIndex, field, e.target.value)}
                                readOnly={isTotalRow}
                              />
                            </td>
                          ))}
                          {shouldRenderQuarterValue ? (
                            <td rowSpan={quarterRowSpan} className={`${tdClass} p-1 align-middle`}>
                              <input
                                className={`${manualTableInputClass} ${isTotalRow ? "font-bold text-slate-900" : ""}`}
                                style={isTotalRow ? {
                                  backgroundColor: "#fffbeb",
                                  borderColor: "#fcd34d",
                                } : undefined}
                                value={String(row.quarterNetTarget ?? "")}
                                onChange={(e) => updateManualGoalRow(rowIndex, "quarterNetTarget", e.target.value)}
                                readOnly={isTotalRow}
                              />
                            </td>
                          ) : null}
                          <td className={`${tdClass} p-1`}>
                            <input
                              className={`${manualTableInputClass} ${isTotalRow ? "font-bold text-slate-900" : ""}`}
                              style={isTotalRow ? {
                                backgroundColor: "#fffbeb",
                                borderColor: "#fcd34d",
                              } : undefined}
                              value={String(row.monthlyActual ?? "")}
                              onChange={(e) => updateManualGoalRow(rowIndex, "monthlyActual", e.target.value)}
                              readOnly={isTotalRow}
                            />
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
                                onChange={(e) => updateManualGoalRow(rowIndex, "quarterActual", e.target.value)}
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
                                onChange={(e) => updateManualGoalRow(rowIndex, "gap", e.target.value)}
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
                    {(manualDraft.terminationOverviewRows || []).map((row: any, rowIndex: number) => (
                      <tr key={`manual-termination-overview-${row.label}`}>
                        <td className={`${tdClass} whitespace-nowrap text-center font-semibold`}>{row.label}</td>
                        {reportTerminationColumnsStatic.map((column, valueIndex) => {
                          const isTotalColumn = column === "합계"
                          const totalValue = isTotalColumn
                            ? computeTerminationRowTotal((row.values || []).slice(0, reportTerminationColumnsStatic.length - 1))
                            : null
                          return (
                            <td key={`${row.label}-${column}`} className={`${tdClass} p-1`}>
                              <input
                                className={manualTableInputClass}
                                style={
                                  isTotalColumn
                                    ? { backgroundColor: "#fffbeb", borderColor: "#fcd34d" }
                                    : undefined
                                }
                                value={isTotalColumn ? String(totalValue ?? "") : String(row.values?.[valueIndex] ?? "")}
                                onChange={(e) => updateManualTerminationOverviewCell(rowIndex, valueIndex, e.target.value)}
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
                    {(manualDraft.weeklyIndustryOverviewRows || []).map((row: any, rowIndex: number) => (
                      <tr key={`manual-weekly-industry-${row.label}`}>
                        <td className={`${tdClass} whitespace-nowrap text-center font-semibold`}>{row.label}</td>
                        {reportIndustryColumnsStatic.map((column, valueIndex) => {
                          const isTotalColumn = column === "합계"
                          const totalValue = isTotalColumn
                            ? computeIndustryRowTotal((row.values || []).slice(0, reportIndustryColumnsStatic.length - 1))
                            : null
                          return (
                            <td key={`${row.label}-${column}`} className={`${tdClass} p-1`}>
                              <input
                                className={manualTableInputClass}
                                style={
                                  isTotalColumn
                                    ? { backgroundColor: "#fffbeb", borderColor: "#fcd34d" }
                                    : undefined
                                }
                                value={isTotalColumn ? String(totalValue ?? "") : String(row.values?.[valueIndex] ?? "")}
                                onChange={(e) => updateManualWeeklyIndustryOverviewCell(rowIndex, valueIndex, e.target.value)}
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
                    <button type="button" onClick={() => handleCollectionTabChange("delivery")} className={`rounded-2xl px-4 py-2 text-[13px] font-semibold ${collectionTab === "delivery" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>전달 리스트</button>
                  </div>
                </div>
                {collectionTab === "delivery" ? (
                  <div className="flex flex-wrap gap-2">
                    {renderChip(`전달 항목 ${formatNumber(collectionDelivery.rows.length)}건`, "blue")}
                    {renderChip(`전달 일자 ${collectionDelivery.deliveredDate || "-"}`, "gray")}
                    {renderChip(`저장 주차 ${formatNumber(deliveryHistoryOptions.length)}건`, "gray")}
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
                    <div className="break-keep text-[18px] font-bold text-slate-900">{collectionDelivery.title}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="h-9 min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700"
                        value={selectedDeliveryHistoryDate}
                        onChange={(e) => handleCollectionDeliveryHistorySelect(e.target.value)}
                        disabled={deliveryHistoryOptions.length === 0}
                      >
                        {deliveryHistoryOptions.length === 0 ? (
                          <option value="">저장된 주차 없음</option>
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
                        onClick={handleCollectionDeliverySaveHistory}
                        className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                      >
                        리스트 저장
                      </button>
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
                        className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        PDF 출력
                      </button>
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <label className="space-y-1">
                      <div className="text-[12px] font-medium text-slate-600">전달 일자</div>
                      <input
                        className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]"
                        value={collectionDelivery.deliveredDate}
                        onChange={(e) => handleCollectionDeliveryMetaChange("deliveredDate", e.target.value)}
                        placeholder="YYYY.MM.DD"
                      />
                    </label>
                    <label className="space-y-1">
                      <div className="text-[12px] font-medium text-slate-600">담당자 확인</div>
                      <input
                        className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]"
                        value={collectionDelivery.managerConfirm}
                        onChange={(e) => handleCollectionDeliveryMetaChange("managerConfirm", e.target.value)}
                      />
                    </label>
                    <label className="space-y-1">
                      <div className="text-[12px] font-medium text-slate-600">전달자 확인</div>
                      <input
                        className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]"
                        value={collectionDelivery.senderConfirm}
                        onChange={(e) => handleCollectionDeliveryMetaChange("senderConfirm", e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="overflow-auto rounded-2xl border border-slate-200">
                    <table className={tableClass}>
                      <thead>
                        <tr>
                          {["구분", "회사명", "부서명", "ID", "권유", "계약월", "회수", "비고", "작업"].map((label) => (
                            <th key={label} className={thClass}>
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {collectionDelivery.rows.length === 0 ? (
                          <tr>
                            <td colSpan={9} className={`${tdClass} py-8 text-slate-500`}>
                              전달 리스트 항목이 없습니다. 행 추가를 눌러 입력해 주세요.
                            </td>
                          </tr>
                        ) : (
                          collectionDelivery.rows.map((row: any, index: number) => (
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
                                <input className="h-9 w-full min-w-[72px] rounded-xl border border-slate-200 px-3 text-[13px]" value={row.recommender} onChange={(e) => handleCollectionDeliveryRowChange(row.id, "recommender", e.target.value)} />
                              </td>
                              <td className={tdClass}>
                                <input className="h-9 w-full min-w-[88px] rounded-xl border border-slate-200 px-3 text-[13px]" value={row.contractMonth} onChange={(e) => handleCollectionDeliveryRowChange(row.id, "contractMonth", e.target.value)} placeholder="26년 4월" />
                              </td>
                              <td className={tdClass}>
                                <input className="h-9 w-full min-w-[56px] rounded-xl border border-slate-200 px-3 text-[13px]" value={row.recoveredCount} onChange={(e) => handleCollectionDeliveryRowChange(row.id, "recoveredCount", e.target.value)} />
                              </td>
                              <td className={tdClass}>
                                <input className="h-9 w-full min-w-[180px] rounded-xl border border-slate-200 px-3 text-[13px]" value={row.note} onChange={(e) => handleCollectionDeliveryRowChange(row.id, "note", e.target.value)} />
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
                        <input className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[14px]" type="month" value={holdDraft.endDate} onChange={(e)=>updateHoldDraft("endDate", e.target.value)} />
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
                                  {["계약만료","비용절감","활용도 저조","사용자퇴사","타사대체","조직개편","비용미납","폐업","합병매각","휴직/장기출장","기타"].map((item) => <option key={item} value={item}>{item}</option>)}
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
                            <td className={tdClass}>{row.manager}</td>
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
                        onChange={(e) => setHoldQuery(e.target.value)}
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
                    </div>
                  </div>
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
                      {filteredHoldItems.map((row: any, index: number) => {
                        const editing = editingHoldId === row.id
                        return (
                        <tr key={row.id}>
                          <td className={`${tdClass} text-center tabular-nums`}>{index + 1}</td>
                          <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{editing ? <input type="date" className="h-9 w-36 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.receivedDate || ""} onChange={(e)=>updateEditingHoldDraft("receivedDate", e.target.value)} /> : normalizeDate(row.receivedDate)}</td>
                          <td className={tdClass}>{editing ? <input className="h-9 w-full min-w-[110px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.manager || ""} onChange={(e)=>updateEditingHoldDraft("manager", e.target.value)} /> : row.manager}</td>
                          <td className={tdClass}>{editing ? <input className="h-9 w-full min-w-[110px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.customerId || ""} onChange={(e)=>updateEditingHoldDraft("customerId", e.target.value)} /> : row.customerId}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.companyName || ""} onChange={(e)=>updateEditingHoldDraft("companyName", e.target.value)} /> : row.companyName}</td>
                          <td className={`${tdClass} whitespace-nowrap`}>{editing ? <input className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.departmentName || ""} onChange={(e)=>updateEditingHoldDraft("departmentName", e.target.value)} /> : row.departmentName}</td>
                          <td className={tdClass}>
                            {editing ? (
                              <div className="space-y-2">
                                <select
                                  className="h-9 w-full min-w-[120px] rounded-xl border border-slate-200 px-3 text-[13px]"
                                  value={editingHoldDraft.reason || "사용자퇴사"}
                                  onChange={(e)=>updateEditingHoldDraft("reason", e.target.value)}
                                >
                                  {["사용자퇴사","사용자이동","계약만료","비용절감","휴직/장기출장","기타"].map((item) => <option key={item} value={item}>{item}</option>)}
                                </select>
                                {editingHoldDraft.reason === "기타" && (
                                  <input
                                    className="h-9 w-full min-w-[140px] rounded-xl border border-slate-200 px-3 text-[13px]"
                                    value={editingHoldDraft.reasonDetail || ""}
                                    onChange={(e)=>updateEditingHoldDraft("reasonDetail", e.target.value)}
                                    placeholder="기타 사유"
                                  />
                                )}
                              </div>
                            ) : row.reason}
                          </td>
                              <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{editing ? <input type="month" className="h-9 w-32 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.startDate || ""} onChange={(e)=>updateEditingHoldDraft("startDate", e.target.value)} /> : formatMonthLabel(row.startDate)}</td>
                              <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{editing ? <input type="month" className="h-9 w-32 rounded-xl border border-slate-200 px-3 text-[13px]" value={editingHoldDraft.endDate || ""} onChange={(e)=>updateEditingHoldDraft("endDate", e.target.value)} /> : formatMonthLabel(row.endDate)}</td>
                          <td className={`${tdClass} text-center`}>
                            {editing ? (
                              <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                <button type="button" onClick={() => handleHoldUpdate(row.id)} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">수정완료</button>
                                <button type="button" onClick={() => handleMoveHoldToTermination(row.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">해지이동</button>
                                <button type="button" onClick={() => handleReleaseHoldRow(row.id)} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">해제</button>
                                <button type="button" onClick={() => handleDeleteHoldRow(row.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">삭제</button>
                                <button type="button" onClick={() => { setEditingHoldId(null); setEditingHoldDraft({}) }} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">취소</button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => startHoldEdit(row)}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap"
                                >
                                  수정
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReleaseHoldRow(row.id)}
                                  className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap"
                                >
                                  해제
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
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
                        <th className={thClass}>반영일</th>
                        <th className={`${thClass} text-center`}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {releasedHoldItems.length === 0 ? (
                        <tr>
                          <td className={`${tdClass} text-center text-slate-400`} colSpan={12}>
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



