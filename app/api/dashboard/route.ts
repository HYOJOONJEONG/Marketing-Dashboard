import path from "path"
import { NextResponse } from "next/server"
import { buildPermissionIndex, filterContractsForUser, getContractAccessScope, hasPermission } from "@/lib/auth/permissions"
import { getRequestIp, requireApiPermission } from "@/lib/auth/server"
import { appendActivityLog, updateAuthState } from "@/lib/auth/store"
import { resolveRequestSession } from "@/lib/auth/session"
import { readDashboardState, writeDashboardState } from "@/lib/shared-db-store"

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

function isOwnedContractForUser(contract: any, user: any) {
  const createdBy = String(contract?.createdBy || "").trim()
  const recommenderUserId = String(contract?.recommenderUserId || "").trim()
  const recommender = String(contract?.recommender || "").trim()
  return createdBy === user.id || recommenderUserId === user.id || recommender === user.name
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

export async function GET() {
  const session = await resolveRequestSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  }
  const permissions = buildPermissionIndex(session.state, session.user)
  if (!DASHBOARD_VIEW_KEYS.some((menuKey) => hasPermission(permissions, menuKey, "view"))) {
    return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 })
  }
  try {
    const data = await readDashboardState<any>(DATA_PATH)
    if (data) {
      return NextResponse.json({
        ...data,
        contracts: filterContractsForUser(Array.isArray(data.contracts) ? data.contracts : [], session.user, permissions),
      })
    }

    const fallbackData = await readDashboardState<any>(FALLBACK_PATH)
    return NextResponse.json({
      ...(fallbackData || EMPTY_DASHBOARD),
      contracts: filterContractsForUser(Array.isArray(fallbackData?.contracts) ? fallbackData.contracts : [], session.user, permissions),
    })
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
    const existingData = (await readDashboardState<any>(DATA_PATH)) || (await readDashboardState<any>(FALLBACK_PATH)) || EMPTY_DASHBOARD
    const isPartial = Boolean(body?.partial && body?.data && typeof body.data === "object" && !Array.isArray(body.data))
    const incomingBody = isPartial ? body.data : body
    const changedKeys = (
      Array.isArray(body?.changedKeys) ? body.changedKeys : []
    ).filter((key: unknown): key is DashboardStateSliceKey => DASHBOARD_STATE_SLICE_KEYS.includes(key as DashboardStateSliceKey))
    const scope = getContractAccessScope(session.user, permissions)
    const nextContracts = mergeContractsForScope(
      Array.isArray(existingData?.contracts) ? existingData.contracts : [],
      Array.isArray(incomingBody?.contracts) ? incomingBody.contracts : [],
      session.user,
      scope,
    )
    const nextBody = {
      ...existingData,
      ...incomingBody,
      ...(Array.isArray(incomingBody?.contracts) ? { contracts: nextContracts } : {}),
    }

    await writeDashboardState(nextBody, {
      menuLabel: "Dashboard",
      changeLabel: "Save dashboard state",
    }, isPartial && changedKeys.length ? changedKeys : undefined)
    await updateAuthState((state) => {
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
    const data = (await readDashboardState<any>(DATA_PATH)) || (await readDashboardState<any>(FALLBACK_PATH)) || EMPTY_DASHBOARD
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
    await updateAuthState((state) => {
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
    })
    return NextResponse.json({ ok: true, data: nextData, contract: nextContract })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to register contract"
    const isReadOnly = message.toLowerCase().includes("read-only")
    return NextResponse.json(
      { ok: false, error: message },
      { status: isReadOnly ? 403 : 500 },
    )
  }
}
