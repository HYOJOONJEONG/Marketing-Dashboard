import path from "path"
import { NextResponse } from "next/server"
import { requireApiPermission, getRequestIp } from "@/lib/auth/server"
import { appendActivityLog, updateAuthState } from "@/lib/auth/store"
import { readDashboardState, writeDashboardState } from "@/lib/shared-db-store"

const DATA_PATH = path.join(process.cwd(), "data", "app-state.json")
const FALLBACK_PATH = path.join(process.cwd(), "api-dashboard-response.json")

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request) {
  const auth = await requireApiPermission("contractManagement", "edit")
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const contractId = String(body?.contractId || "").trim()
  const fieldName = String(body?.fieldName || "").trim()
  const value = body?.value
  if (!contractId || !fieldName) {
    return NextResponse.json({ ok: false, error: "대상 계약 정보가 부족합니다." }, { status: 400 })
  }

  const data =
    (await readDashboardState<any>(DATA_PATH)) ||
    (await readDashboardState<any>(FALLBACK_PATH)) || { contracts: [] }

  const contracts = Array.isArray(data.contracts) ? data.contracts : []
  const target = contracts.find((contract: any) => contract.id === contractId)
  if (!target) {
    return NextResponse.json({ ok: false, error: "계약을 찾을 수 없습니다." }, { status: 404 })
  }
  const beforeValue = String(target[fieldName] ?? "")
  target[fieldName] = value
  target.updatedAt = new Date().toISOString()

  await writeDashboardState(data, {
    menuLabel: "계약관리",
    changeLabel: `Admin update contract ${fieldName}`,
  }, ["contracts"])
  await updateAuthState((state) => {
    appendActivityLog(state, {
      actorUserId: auth.context.user.id,
      actorName: auth.context.user.name,
      actionType: "contract_update",
      targetType: "contract",
      targetId: contractId,
      pageKey: "contractManagement",
      beforeValue,
      afterValue: String(value ?? ""),
      ipAddress: getRequestIp(request),
      sessionId: auth.context.sessionId,
      success: true,
    })
  })

  return NextResponse.json({ ok: true })
}
