import path from "path"
import { NextResponse } from "next/server"
import { buildPermissionIndex, filterContractsForUser, getContractAccessScope, hasPermission } from "@/lib/auth/permissions"
import { getRequestIp, requireApiPermission } from "@/lib/auth/server"
import { appendActivityLog, updateAuthState } from "@/lib/auth/store"
import { resolveRequestSession } from "@/lib/auth/session"
import { ensureManualWeeklyRestore } from "@/lib/manual-weekly-restore"
import { readDashboardState, readDashboardStateSlices, writeDashboardState } from "@/lib/shared-db-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DATA_PATH = path.join(process.cwd(), "data", "app-state.json")
const FALLBACK_PATH = path.join(process.cwd(), "api-dashboard-response.json")

const EMPTY_DASHBOARD = { ui: {}, contracts: [], termination: {} }
const DASHBOARD_VIEW_KEYS = [
  "dailyReport",
  "weeklyReport",
  "manualInput",
  "newContractsList",
  "weeklySelection",
  "typeAnalysis",
  "collectionManagement",
  "terminationManagement",
  "optionDashboard",
] as const
const DASHBOARD_EDIT_KEYS = [
  "dailyReport",
  "manualInput",
  "newContractsList",
  "weeklySelection",
  "typeAnalysis",
  "collectionManagement",
  "terminationManagement",
] as const

const DASHBOARD_STATE_SLICE_KEYS = [
  "ui",
  "currentYear",
  "years",
  "availableYears",
  "dailyReport",
  "weeklyReport",
  "contracts",
  "typeAnalysis",
  "collection",
  "termination",
  "paidOptionSourceColumns",
] as const

type DashboardStateSliceKey = (typeof DASHBOARD_STATE_SLICE_KEYS)[number]

function isTransientStoreError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "")
  return /connect|connection|socket|timeout|timed out|econn|redis/i.test(message)
}

function publicSaveErrorMessage(error: unknown, fallback: string) {
  if (isTransientStoreError(error)) {
    return "저장소 연결이 일시적으로 불안정합니다. 다시 시도해주세요."
  }
  return error instanceof Error ? error.message : fallback
}

function normalizeContractIdCode(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase()
}

function normalizeDashboardDate(value: unknown) {
  const digits = String(value ?? "").replace(/[^\d]/g, "")
  if (digits.length > 8) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
  if (digits.length === 8) return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`
  if (digits.length === 6) return `20${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 6)}`
  return String(value ?? "").trim()
}

function safeText(value: unknown) {
  return String(value ?? "").trim()
}

function isOwnedContractForUser(contract: any, user: any) {
  const createdBy = String(contract?.createdBy || "").trim()
  const recommenderUserId = String(contract?.recommenderUserId || "").trim()
  const recommender = String(contract?.recommender || "").trim()
  return createdBy === user.id || recommenderUserId === user.id || recommender === user.name
}

function parseTimestamp(value: unknown) {
  const time = Date.parse(String(value || ""))
  return Number.isFinite(time) ? time : 0
}

function dailyReportEntryKey(entry: any) {
  const date = safeText(entry?.date)
  const teamName = safeText(entry?.teamName)
  const userName = safeText(entry?.userName)
  const userId = safeText(entry?.userId)
  const id = safeText(entry?.id)
  if (date && teamName && userName) return `${date}::${teamName}::${userName}`
  if (date && userId) return `${date}::${userId}`
  return id || `${Date.now()}::${Math.random()}`
}

function dailyReportEntryWeight(entry: any) {
  return [
    safeText(entry?.reportBody),
    safeText(entry?.plannedTasks),
    safeText(entry?.submittedAt),
  ].filter(Boolean).length
}

function pickLatestDailyReportEntry(existing: any, incoming: any) {
  if (!existing) return incoming
  const existingTime = parseTimestamp(existing?.updatedAt || existing?.submittedAt)
  const incomingTime = parseTimestamp(incoming?.updatedAt || incoming?.submittedAt)
  if (incomingTime > existingTime) return { ...existing, ...incoming }
  if (incomingTime < existingTime) return existing
  return dailyReportEntryWeight(incoming) >= dailyReportEntryWeight(existing) ? { ...existing, ...incoming } : existing
}

function mergeDailyReportState(existingDailyReport: any, incomingDailyReport: any) {
  if (!incomingDailyReport || typeof incomingDailyReport !== "object" || Array.isArray(incomingDailyReport)) {
    return incomingDailyReport
  }

  const mergedReports = new Map<string, any>()
  const existingReports = Array.isArray(existingDailyReport?.reports) ? existingDailyReport.reports : []
  const incomingReports = Array.isArray(incomingDailyReport?.reports) ? incomingDailyReport.reports : []

  existingReports.forEach((entry: any) => {
    mergedReports.set(dailyReportEntryKey(entry), entry)
  })
  incomingReports.forEach((entry: any) => {
    const key = dailyReportEntryKey(entry)
    mergedReports.set(key, pickLatestDailyReportEntry(mergedReports.get(key), entry))
  })

  const summaryMap = new Map<string, any>()
  const mergeSummary = (summary: any) => {
    const key = [
      safeText(summary?.date),
      safeText(summary?.createdBy),
      safeText(summary?.content),
    ].join("::")
    const existing = summaryMap.get(key)
    if (!existing || parseTimestamp(summary?.createdAt) >= parseTimestamp(existing?.createdAt)) {
      summaryMap.set(key, summary)
    }
  }
  ;(Array.isArray(existingDailyReport?.aiSummaries) ? existingDailyReport.aiSummaries : []).forEach(mergeSummary)
  ;(Array.isArray(incomingDailyReport?.aiSummaries) ? incomingDailyReport.aiSummaries : []).forEach(mergeSummary)

  return {
    ...existingDailyReport,
    ...incomingDailyReport,
    reports: Array.from(mergedReports.values()),
    aiSummaries: Array.from(summaryMap.values()),
  }
}

function mergeManualSaveHistory(existingHistory: any, incomingHistory: any) {
  const map = new Map<string, any>()
  const addRows = (rows: any) => {
    if (!Array.isArray(rows)) return
    rows.forEach((row: any) => {
      const id = safeText(row?.id || row?.savedAt || row?.createdAt)
      if (!id) return
      const existing = map.get(id)
      if (!existing || parseTimestamp(row?.savedAt || row?.createdAt) >= parseTimestamp(existing?.savedAt || existing?.createdAt)) {
        map.set(id, row)
      }
    })
  }
  addRows(existingHistory)
  addRows(incomingHistory)
  return Array.from(map.values())
    .sort((a, b) => parseTimestamp(b?.savedAt || b?.createdAt) - parseTimestamp(a?.savedAt || a?.createdAt))
    .slice(0, 10)
}

function mergeWeeklyReportState(existingWeeklyReport: any, incomingWeeklyReport: any) {
  if (!incomingWeeklyReport || typeof incomingWeeklyReport !== "object" || Array.isArray(incomingWeeklyReport)) {
    return incomingWeeklyReport
  }
  return {
    ...incomingWeeklyReport,
    manualSaveHistory: mergeManualSaveHistory(
      existingWeeklyReport?.manualSaveHistory,
      incomingWeeklyReport?.manualSaveHistory,
    ),
  }
}

function rowMergeKey(row: any) {
  const id = safeText(row?.id)
  if (id) return `id:${id}`
  const customerId = normalizeContractIdCode(row?.customerId || row?.idCode)
  return customerId ? `customer:${customerId}` : ""
}

function mergeTerminationActiveRows(existingRows: any[], incomingRows: any[]) {
  const existingByKey = new Map<string, any>()
  existingRows.forEach((row) => {
    const key = rowMergeKey(row)
    if (key) existingByKey.set(key, row)
  })

  return incomingRows.map((incomingRow) => {
    const key = rowMergeKey(incomingRow)
    const existingRow = key ? existingByKey.get(key) : null
    if (!existingRow) return incomingRow

    const existingSelected = Boolean(existingRow?.selected)
    const incomingSelected = Boolean(incomingRow?.selected)
    const existingSelectedAt = safeText(existingRow?.selectedUpdatedAt || existingRow?.selectionUpdatedAt)
    const incomingSelectedAt = safeText(incomingRow?.selectedUpdatedAt || incomingRow?.selectionUpdatedAt)
    const existingSelectedTime = parseTimestamp(existingSelectedAt)
    const incomingSelectedTime = parseTimestamp(incomingSelectedAt)

    if (existingSelectedTime || incomingSelectedTime) {
      if (existingSelectedTime > incomingSelectedTime) {
        return {
          ...incomingRow,
          selected: existingSelected,
          ...(existingSelectedAt ? { selectedUpdatedAt: existingSelectedAt } : {}),
        }
      }
      return {
        ...incomingRow,
        selected: incomingSelected,
        ...(incomingSelectedAt ? { selectedUpdatedAt: incomingSelectedAt } : {}),
      }
    }

    if (existingSelected && !incomingSelected) {
      return { ...incomingRow, selected: true }
    }
    return incomingRow
  })
}

function normalizeDeletedRowMap(value: any) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, deletedAt]) => [safeText(key), safeText(deletedAt)] as const)
      .filter(([key]) => Boolean(key)),
  )
}

function mergeDeletedRowMaps(existingMap: any, incomingMap: any) {
  const existing = normalizeDeletedRowMap(existingMap)
  const incoming = normalizeDeletedRowMap(incomingMap)
  const merged: Record<string, string> = { ...existing }
  Object.entries(incoming).forEach(([key, incomingDeletedAt]) => {
    const existingDeletedAt = merged[key]
    if (!existingDeletedAt || parseTimestamp(incomingDeletedAt) >= parseTimestamp(existingDeletedAt)) {
      merged[key] = incomingDeletedAt
    }
  })
  return merged
}

function filterDeletedRows(rows: any[], deletedMap: Record<string, string>) {
  const deletedIds = new Set(Object.keys(deletedMap))
  if (!deletedIds.size) return rows
  return rows.filter((row) => !deletedIds.has(safeText(row?.id)))
}

function mergeTerminationState(existingTermination: any, incomingTermination: any) {
  if (!incomingTermination || typeof incomingTermination !== "object" || Array.isArray(incomingTermination)) {
    return incomingTermination
  }

  const existingSheets = Array.isArray(existingTermination?.sheets) ? existingTermination.sheets : []
  const incomingSheets = Array.isArray(incomingTermination?.sheets) ? incomingTermination.sheets : []
  const deletedItemIds = mergeDeletedRowMaps(existingTermination?.deletedItemIds, incomingTermination?.deletedItemIds)
  const deletedHoldIds = mergeDeletedRowMaps(existingTermination?.deletedHoldIds, incomingTermination?.deletedHoldIds)
  const existingSheetById = new Map<string, any>()
  existingSheets.forEach((sheet: any) => {
    const id = safeText(sheet?.id)
    if (id) existingSheetById.set(id, sheet)
  })

  return {
    ...existingTermination,
    ...incomingTermination,
    deletedItemIds,
    deletedHoldIds,
    sheets: incomingSheets.map((incomingSheet: any, index: number) => {
      const existingSheet =
        existingSheetById.get(safeText(incomingSheet?.id)) ||
        existingSheets[index] ||
        null
      if (!existingSheet) {
        return {
          ...incomingSheet,
          ...(Array.isArray(incomingSheet?.items)
            ? { items: filterDeletedRows(incomingSheet.items, deletedItemIds) }
            : {}),
          ...(Array.isArray(incomingSheet?.holdItems)
            ? { holdItems: filterDeletedRows(incomingSheet.holdItems, deletedHoldIds) }
            : {}),
        }
      }
      return {
        ...incomingSheet,
        ...(Array.isArray(incomingSheet?.items)
          ? {
              items: filterDeletedRows(
                mergeTerminationActiveRows(
                  Array.isArray(existingSheet?.items) ? existingSheet.items : [],
                  incomingSheet.items,
                ),
                deletedItemIds,
              ),
            }
          : {}),
        ...(Array.isArray(incomingSheet?.holdItems)
          ? { holdItems: filterDeletedRows(incomingSheet.holdItems, deletedHoldIds) }
          : {}),
      }
    }),
  }
}

function countTerminationRows(termination: any, key: "items" | "holdItems" | "confirmedItems" | "releasedHoldItems") {
  return (Array.isArray(termination?.sheets) ? termination.sheets : []).reduce(
    (total: number, sheet: any) => total + (Array.isArray(sheet?.[key]) ? sheet[key].length : 0),
    0,
  )
}

function inferDashboardPageKey(changedKeys: DashboardStateSliceKey[]) {
  if (changedKeys.includes("termination")) return "terminationManagement"
  if (changedKeys.includes("collection")) return "collectionManagement"
  if (changedKeys.includes("contracts")) return "newContractsList"
  if (changedKeys.includes("typeAnalysis")) return "typeAnalysis"
  if (changedKeys.includes("dailyReport")) return "dailyReport"
  if (changedKeys.includes("weeklyReport")) return "weeklyReport"
  if (changedKeys.includes("paidOptionSourceColumns")) return "optionDashboard"
  return "weeklyReport"
}

function describeDashboardPut(changedKeys: DashboardStateSliceKey[], existingData: any, incomingBody: any) {
  if (changedKeys.includes("termination")) {
    const beforeHold = countTerminationRows(existingData?.termination, "holdItems")
    const afterHold = countTerminationRows(incomingBody?.termination, "holdItems")
    const beforeReleased = countTerminationRows(existingData?.termination, "releasedHoldItems")
    const afterReleased = countTerminationRows(incomingBody?.termination, "releasedHoldItems")
    const beforeActive = countTerminationRows(existingData?.termination, "items")
    const afterActive = countTerminationRows(incomingBody?.termination, "items")
    const beforeConfirmed = countTerminationRows(existingData?.termination, "confirmedItems")
    const afterConfirmed = countTerminationRows(incomingBody?.termination, "confirmedItems")

    if (afterHold < beforeHold && afterReleased > beforeReleased) return `청구보류 ${beforeHold - afterHold}건 해제 저장`
    if (afterHold < beforeHold && afterActive > beforeActive) return `청구보류 ${beforeHold - afterHold}건 해지리스트 이동 저장`
    if (afterHold < beforeHold) return `청구보류 ${beforeHold - afterHold}건 삭제 저장`
    if (afterHold > beforeHold) return `청구보류 ${afterHold - beforeHold}건 등록/복구 저장`
    if (afterConfirmed > beforeConfirmed) return `해지확정 ${afterConfirmed - beforeConfirmed}건 반영 저장`
    if (afterActive < beforeActive) return `해지리스트 ${beforeActive - afterActive}건 삭제/확정 저장`
    if (afterActive > beforeActive) return `해지리스트 ${afterActive - beforeActive}건 등록/복구 저장`
    return "해지 진행사항 수정 저장"
  }
  if (changedKeys.includes("collection")) return "계약서통합관리 저장"
  if (changedKeys.includes("contracts")) return "신규계약/주간반영 리스트 저장"
  if (changedKeys.includes("typeAnalysis")) return "신규/대체/해지 유형 분석 저장"
  if (changedKeys.includes("dailyReport")) return "데일리 업무일지 저장"
  if (changedKeys.includes("weeklyReport")) return "주간실적보고/수동입력 저장"
  return "대시보드 저장"
}

function contractMergeKey(row: any) {
  const id = safeText(row?.id)
  if (id) return `id:${id}`
  const idCode = normalizeContractIdCode(row?.idCode)
  return idCode ? `idCode:${idCode}` : ""
}

function mergeContractWeeklySelection(existing: any, incoming: any) {
  if (!existing) return incoming
  const existingAt = safeText(existing?.includedInWeeklyUpdatedAt || existing?.weeklySelectionUpdatedAt)
  const incomingAt = safeText(incoming?.includedInWeeklyUpdatedAt || incoming?.weeklySelectionUpdatedAt)
  const existingTime = parseTimestamp(existingAt)
  const incomingTime = parseTimestamp(incomingAt)
  const existingChecked = Boolean(existing?.includedInWeekly)
  const incomingChecked = Boolean(incoming?.includedInWeekly)

  if (existingTime || incomingTime) {
    if (existingTime > incomingTime) {
      return {
        ...incoming,
        includedInWeekly: existingChecked,
        ...(existingAt ? { includedInWeeklyUpdatedAt: existingAt } : {}),
      }
    }
    return {
      ...incoming,
      includedInWeekly: incomingChecked,
      ...(incomingAt ? { includedInWeeklyUpdatedAt: incomingAt } : {}),
    }
  }

  if (existingChecked && !incomingChecked) {
    return { ...incoming, includedInWeekly: true }
  }
  return incoming
}

function mergeContractRowsPreservingWeeklySelection(existingContracts: any[], incomingContracts: any[]) {
  const existingByKey = new Map<string, any>()
  existingContracts.forEach((contract) => {
    const key = contractMergeKey(contract)
    if (key) existingByKey.set(key, contract)
  })
  return incomingContracts.map((contract) => {
    const key = contractMergeKey(contract)
    return mergeContractWeeklySelection(key ? existingByKey.get(key) : null, contract)
  })
}

function mergeContractsForScope(existingContracts: any[], incomingContracts: any[], user: any, scope: ReturnType<typeof getContractAccessScope>) {
  const scopedIncoming = mergeContractRowsPreservingWeeklySelection(existingContracts, incomingContracts)
  if (scope === "all") return scopedIncoming
  if (scope === "team") {
    const preserved = existingContracts.filter((contract) => String(contract?.teamId || "") !== user.teamId)
    return [...scopedIncoming, ...preserved]
  }
  const preserved = existingContracts.filter((contract) => !isOwnedContractForUser(contract, user))
  return [...scopedIncoming, ...preserved]
}

function isBusanUniversityTerminationRow(row: any) {
  const companyName = safeText(row?.companyName).replace(/\s+/g, "")
  const customerId = normalizeContractIdCode(row?.customerId)
  return (
    customerId === "E151214" ||
    companyName.includes("부산대학교산학협력단") ||
    companyName.includes("부산대학교") ||
    companyName.includes("부산대")
  )
}

function applyTerminationIdCorrections(data: any) {
  if (!data || typeof data !== "object" || !Array.isArray(data?.termination?.sheets)) {
    return { data, changed: false }
  }
  let changed = false
  const sheets = data.termination.sheets.map((sheet: any) => {
    let sheetChanged = false
    const nextSheet = { ...sheet }
    ;(["items", "holdItems", "confirmedItems", "releasedHoldItems"] as const).forEach((key) => {
      const rows = Array.isArray(sheet?.[key]) ? sheet[key] : null
      if (!rows) return
      let keyChanged = false
      const nextRows = rows.map((row: any) => {
        const customerId = normalizeContractIdCode(row?.customerId)
        if (!isBusanUniversityTerminationRow(row) || customerId === "E150214") return row
        changed = true
        sheetChanged = true
        keyChanged = true
        return { ...row, customerId: "E150214" }
      })
      if (keyChanged) nextSheet[key] = nextRows
    })
    return sheetChanged ? nextSheet : sheet
  })
  if (!changed) return { data, changed: false }
  return {
    data: {
      ...data,
      termination: {
        ...data.termination,
        sheets,
      },
    },
    changed: true,
  }
}

async function ensureDashboardDataCorrections(data: any) {
  const corrected = applyTerminationIdCorrections(data)
  if (!corrected.changed) return corrected.data
  await writeDashboardState(
    corrected.data,
    {
      menuLabel: "해지 진행사항",
      changeLabel: "해지확정 부산대 고객번호 E150214 수정",
    },
    ["termination"],
  )
  return corrected.data
}

function buildDashboardResponse(data: any, session: any, permissions: any) {
  return {
    ...data,
    contracts: filterContractsForUser(Array.isArray(data?.contracts) ? data.contracts : [], session.user, permissions),
  }
}

export async function GET(request: Request) {
  const session = await resolveRequestSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  }
  const permissions = buildPermissionIndex(session.state, session.user)
  if (!DASHBOARD_VIEW_KEYS.some((menuKey) => hasPermission(permissions, menuKey, "view"))) {
    return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 })
  }
  try {
    const url = new URL(request.url)
    const slice = url.searchParams.get("slice") || ""
    let data = await readDashboardState<any>(DATA_PATH)
    data = await ensureManualWeeklyRestore(data)
    data = await ensureDashboardDataCorrections(data).catch((error) => {
      console.error("Failed to apply dashboard data corrections.", error)
      return applyTerminationIdCorrections(data).data
    })
    if (data) {
      if (slice === "dailyReport") {
        return NextResponse.json({
          dailyReport: data?.dailyReport || {},
          ui: data?.ui || {},
        })
      }
      if (slice === "weeklyReport") {
        return NextResponse.json({
          weeklyReport: data?.weeklyReport || {},
          paidOptionSourceColumns: data?.paidOptionSourceColumns || [],
          ui: data?.ui || {},
        })
      }
      return NextResponse.json(buildDashboardResponse(data, session, permissions))
    }

    let fallbackData = await readDashboardState<any>(FALLBACK_PATH)
    fallbackData = await ensureManualWeeklyRestore(fallbackData)
    if (slice === "dailyReport") {
      return NextResponse.json({
        dailyReport: fallbackData?.dailyReport || {},
        ui: fallbackData?.ui || {},
      })
    }
    if (slice === "weeklyReport") {
      return NextResponse.json({
        weeklyReport: fallbackData?.weeklyReport || {},
        paidOptionSourceColumns: fallbackData?.paidOptionSourceColumns || [],
        ui: fallbackData?.ui || {},
      })
    }
    return NextResponse.json(buildDashboardResponse(fallbackData || EMPTY_DASHBOARD, session, permissions))
  } catch (error) {
    console.error("Failed to read dashboard state.", error)
    return NextResponse.json(EMPTY_DASHBOARD)
  }
}

export async function PUT(request: Request) {
  const session = await resolveRequestSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  }
  const permissions = buildPermissionIndex(session.state, session.user)
  if (!DASHBOARD_EDIT_KEYS.some((menuKey) => hasPermission(permissions, menuKey, "edit"))) {
    return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 })
  }
  const raw = await request.text()
  let body: any

  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 })
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Dashboard state must be a JSON object" }, { status: 400 })
  }

  try {
    const isPartial = Boolean(body?.partial && body?.data && typeof body.data === "object" && !Array.isArray(body.data))
    const incomingBody = isPartial ? body.data : body
    const requestedChangedKeys = (
      Array.isArray(body?.changedKeys) ? body.changedKeys : []
    ).filter((key: unknown): key is DashboardStateSliceKey => DASHBOARD_STATE_SLICE_KEYS.includes(key as DashboardStateSliceKey))
    const sourceViews = Array.isArray(body?.sourceViews)
      ? body.sourceViews.map((key: unknown) => String(key || "")).filter(Boolean)
      : []
    const isManualWeeklySave = sourceViews.includes("manual-input") || sourceViews.includes("weekly-report")
    const changedKeys =
      requestedChangedKeys.includes("contracts") && requestedChangedKeys.includes("weeklyReport") && !isManualWeeklySave
        ? requestedChangedKeys.filter((key: DashboardStateSliceKey) => key !== "weeklyReport")
        : requestedChangedKeys
    const canWritePartialDirectly = isPartial && changedKeys.length > 0 && !Array.isArray(incomingBody?.contracts)
    let nextBody = incomingBody
    let existingDataForMerge: any = null
    let existingDataForActivity: any = null

    if (!canWritePartialDirectly) {
      const existingData = (await readDashboardState<any>(DATA_PATH)) || (await readDashboardState<any>(FALLBACK_PATH)) || EMPTY_DASHBOARD
      existingDataForMerge = existingData
      existingDataForActivity = existingData
      const scope = getContractAccessScope(session.user, permissions)
      const nextContracts = mergeContractsForScope(
        Array.isArray(existingData?.contracts) ? existingData.contracts : [],
        Array.isArray(incomingBody?.contracts) ? incomingBody.contracts : [],
        session.user,
        scope,
      )
      nextBody = {
        ...existingData,
        ...incomingBody,
        ...(Array.isArray(incomingBody?.contracts) ? { contracts: nextContracts } : {}),
      }
    }

    if (changedKeys.includes("dailyReport") && incomingBody?.dailyReport) {
      const existingData =
        existingDataForMerge ||
        (await readDashboardState<any>(DATA_PATH)) ||
        (await readDashboardState<any>(FALLBACK_PATH)) ||
        EMPTY_DASHBOARD
      existingDataForActivity = existingData
      nextBody = {
        ...nextBody,
        dailyReport: mergeDailyReportState(existingData?.dailyReport, incomingBody.dailyReport),
      }
    }

    if (changedKeys.includes("weeklyReport") && incomingBody?.weeklyReport) {
      const existingData =
        existingDataForMerge ||
        existingDataForActivity ||
        (await readDashboardState<any>(DATA_PATH)) ||
        (await readDashboardState<any>(FALLBACK_PATH)) ||
        EMPTY_DASHBOARD
      existingDataForActivity = existingData
      nextBody = {
        ...nextBody,
        weeklyReport: mergeWeeklyReportState(existingData?.weeklyReport, incomingBody.weeklyReport),
      }
    }

    if (changedKeys.includes("termination") && incomingBody?.termination) {
      const existingData =
        existingDataForMerge ||
        (await readDashboardState<any>(DATA_PATH)) ||
        (await readDashboardState<any>(FALLBACK_PATH)) ||
        EMPTY_DASHBOARD
      existingDataForActivity = existingData
      nextBody = {
        ...nextBody,
        termination: mergeTerminationState(existingData?.termination, incomingBody.termination),
      }
    }

    const activityPageKey = inferDashboardPageKey(changedKeys)
    const activityDetail = describeDashboardPut(changedKeys, existingDataForActivity || existingDataForMerge || EMPTY_DASHBOARD, incomingBody)
    const correctedNextBody = applyTerminationIdCorrections(nextBody).data

    await writeDashboardState(correctedNextBody, {
      menuLabel: "Dashboard",
      changeLabel: "Save dashboard state",
    }, isPartial && changedKeys.length ? changedKeys : undefined)
    await updateAuthState((state) => {
      appendActivityLog(state, {
        actorUserId: session.user.id,
        actorName: session.user.name,
        actionType: "dashboard_put",
        targetType: "dashboard_state",
        targetId: activityPageKey,
        pageKey: activityPageKey,
        beforeValue: "",
        afterValue: JSON.stringify({ detail: activityDetail, changedKeys }),
        ipAddress: getRequestIp(request),
        sessionId: session.sessionId,
        success: true,
      })
    }).catch((error) => {
      console.error("Failed to append dashboard activity log.", error)
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save dashboard state"
    const isReadOnly = message.toLowerCase().includes("read-only")
    return NextResponse.json(
      { ok: false, error: message },
      { status: isReadOnly ? 403 : 500 },
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("newContractsList", "edit")
  if (!auth.ok) return auth.response
  let body: any

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 })
  }

  if (body?.action !== "addContract" || !body.contract || typeof body.contract !== "object") {
    return NextResponse.json({ ok: false, error: "Unsupported dashboard action" }, { status: 400 })
  }

  try {
    const data = (await readDashboardStateSlices<any>(["contracts", "ui"], FALLBACK_PATH)) || EMPTY_DASHBOARD
    const contracts = Array.isArray(data.contracts) ? data.contracts : []
    const incoming = body.contract
    const incomingId = String(incoming.id || `c${Date.now()}`)
    const nextNo = contracts.reduce((max: number, row: any) => Math.max(max, Number(row?.no || 0)), 0) + 1
    const now = new Date().toISOString()
    const nextContract = {
      ...incoming,
      id: incomingId,
      no: Number(incoming.no || 0) > 0 ? Number(incoming.no) : nextNo,
      registrationDate: normalizeDashboardDate(incoming.registrationDate || now),
      companyName: String(incoming.companyName || "").trim(),
      departmentName: String(incoming.departmentName || "").trim(),
      idCode: String(incoming.idCode || "").trim(),
      industry: String(incoming.industry || "국내증권"),
      contractMonth: String(incoming.contractMonth || "").trim(),
      documentStatus: String(incoming.documentStatus || "미회수"),
      replacementType: String(incoming.replacementType || "신규"),
      includedInWeekly: Boolean(incoming.includedInWeekly),
      recommender: auth.context.user.name,
      recommenderUserId: auth.context.user.id,
      createdBy: auth.context.user.id,
      teamId: auth.context.user.teamId,
      note: String(incoming.note || "").trim(),
      createdAt: now,
      updatedAt: now,
    }

    if (!nextContract.companyName || !nextContract.idCode) {
      return NextResponse.json({ ok: false, error: "회사명과 아이디는 필수입니다." }, { status: 400 })
    }
    const incomingIdCode = normalizeContractIdCode(nextContract.idCode)
    const duplicatedId = contracts.some((row: any) => {
      if (String(row?.id || "") === incomingId) return false
      return normalizeContractIdCode(row?.idCode) === incomingIdCode
    })
    if (duplicatedId) {
      return NextResponse.json({ ok: false, error: "중복된 ID가 존재합니다." }, { status: 409 })
    }

    const withoutDuplicate = contracts.filter((row: any) => String(row?.id || "") !== incomingId)
    const updatedAt = new Date().toISOString()
    const nextData = {
      ...data,
      contracts: [nextContract, ...withoutDuplicate],
      ui: {
        ...(data.ui || {}),
        menuUpdatedAt: {
          ...(data.ui?.menuUpdatedAt || {}),
          contracts: updatedAt,
        },
      },
    }

    await writeDashboardState(nextData, {
      menuLabel: "신규계약 리스트",
      changeLabel: "Register contract",
    }, ["contracts", "ui"])
    void updateAuthState((state) => {
      appendActivityLog(state, {
        actorUserId: auth.context.user.id,
        actorName: auth.context.user.name,
        actionType: "contract_create",
        targetType: "contract",
        targetId: nextContract.id,
        pageKey: "newContractsList",
        beforeValue: "",
        afterValue: JSON.stringify({
          recommender: nextContract.recommender,
          recommenderUserId: nextContract.recommenderUserId,
          createdBy: nextContract.createdBy,
          teamId: nextContract.teamId,
        }),
        ipAddress: getRequestIp(request),
        sessionId: auth.context.sessionId,
        success: true,
      })
    }).catch((error) => {
      console.error("Failed to append contract activity log.", error)
    })
    return NextResponse.json({ ok: true, data: { contracts: nextData.contracts, ui: nextData.ui }, contract: nextContract })
  } catch (error) {
    console.error("Failed to register contract.", error)
    const message = publicSaveErrorMessage(error, "Failed to register contract")
    const isReadOnly = message.toLowerCase().includes("read-only")
    return NextResponse.json(
      { ok: false, error: message },
      { status: isReadOnly ? 403 : 500 },
    )
  }
}
