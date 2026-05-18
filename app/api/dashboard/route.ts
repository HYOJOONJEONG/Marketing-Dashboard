import path from "path"
import { NextResponse } from "next/server"
import { buildPermissionIndex, filterContractsForUser, getContractAccessScope, hasPermission } from "@/lib/auth/permissions"
import { getRequestIp, requireApiPermission } from "@/lib/auth/server"
import { appendActivityLog, updateAuthState } from "@/lib/auth/store"
import { resolveRequestSession } from "@/lib/auth/session"
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
  "collectionManagement",
  "terminationManagement",
  "optionDashboard",
] as const
const DASHBOARD_EDIT_KEYS = [
  "dailyReport",
  "manualInput",
  "newContractsList",
  "weeklySelection",
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

function mergeContractsForScope(existingContracts: any[], incomingContracts: any[], user: any, scope: ReturnType<typeof getContractAccessScope>) {
  if (scope === "all") return incomingContracts
  if (scope === "team") {
    const preserved = existingContracts.filter((contract) => String(contract?.teamId || "") !== user.teamId)
    return [...incomingContracts, ...preserved]
  }
  const preserved = existingContracts.filter((contract) => !isOwnedContractForUser(contract, user))
  return [...incomingContracts, ...preserved]
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
    const data = await readDashboardState<any>(DATA_PATH)
    if (data) {
      if (slice === "dailyReport") {
        return NextResponse.json({
          dailyReport: data?.dailyReport || {},
          ui: data?.ui || {},
        })
      }
      return NextResponse.json(buildDashboardResponse(data, session, permissions))
    }

    const fallbackData = await readDashboardState<any>(FALLBACK_PATH)
    if (slice === "dailyReport") {
      return NextResponse.json({
        dailyReport: fallbackData?.dailyReport || {},
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
    const changedKeys = (
      Array.isArray(body?.changedKeys) ? body.changedKeys : []
    ).filter((key: unknown): key is DashboardStateSliceKey => DASHBOARD_STATE_SLICE_KEYS.includes(key as DashboardStateSliceKey))
    const canWritePartialDirectly = isPartial && changedKeys.length > 0 && !Array.isArray(incomingBody?.contracts)
    let nextBody = incomingBody
    let existingDataForMerge: any = null

    if (!canWritePartialDirectly) {
      const existingData = (await readDashboardState<any>(DATA_PATH)) || (await readDashboardState<any>(FALLBACK_PATH)) || EMPTY_DASHBOARD
      existingDataForMerge = existingData
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
      nextBody = {
        ...nextBody,
        dailyReport: mergeDailyReportState(existingData?.dailyReport, incomingBody.dailyReport),
      }
    }

    await writeDashboardState(nextBody, {
      menuLabel: "Dashboard",
      changeLabel: "Save dashboard state",
    }, isPartial && changedKeys.length ? changedKeys : undefined)
    void updateAuthState((state) => {
      appendActivityLog(state, {
        actorUserId: session.user.id,
        actorName: session.user.name,
        actionType: "dashboard_put",
        targetType: "dashboard_state",
        targetId: "dashboard",
        pageKey: "weeklyReport",
        beforeValue: "",
        afterValue: "save",
        ipAddress: getRequestIp(request),
        sessionId: session.sessionId,
        success: true,
      })
    }).catch(() => undefined)
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
    const nextContract = {
      ...incoming,
      id: incomingId,
      no: Number(incoming.no || 0) > 0 ? Number(incoming.no) : nextNo,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
