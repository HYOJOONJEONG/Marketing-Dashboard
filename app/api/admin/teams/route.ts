import { NextResponse } from "next/server"
import { requireApiPermission, getRequestIp } from "@/lib/auth/server"
import { appendActivityLog, updateAuthState } from "@/lib/auth/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await requireApiPermission("teamManagement", "create")
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null)
  const name = String(body?.name || "").trim()
  const code = String(body?.code || "").trim()
  if (!name || !code) {
    return NextResponse.json({ ok: false, error: "팀명과 코드는 필수입니다." }, { status: 400 })
  }
  await updateAuthState((state) => {
    const now = new Date().toISOString()
    state.teams.unshift({
      id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      name,
      createdAt: now,
      updatedAt: now,
    })
    appendActivityLog(state, {
      actorUserId: auth.context.user.id,
      actorName: auth.context.user.name,
      actionType: "team_create",
      targetType: "team",
      targetId: code,
      pageKey: "teamManagement",
      beforeValue: "",
      afterValue: name,
      ipAddress: getRequestIp(request),
      sessionId: auth.context.sessionId,
      success: true,
    })
  })
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request) {
  const auth = await requireApiPermission("teamManagement", "edit")
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null)
  const teamId = String(body?.teamId || "").trim()
  const fieldName = String(body?.fieldName || "").trim()
  const value = String(body?.value || "").trim()
  await updateAuthState((state) => {
    const team = state.teams.find((item) => item.id === teamId)
    if (!team) throw new Error("팀을 찾을 수 없습니다.")
    ;(team as any)[fieldName] = value
    team.updatedAt = new Date().toISOString()
    appendActivityLog(state, {
      actorUserId: auth.context.user.id,
      actorName: auth.context.user.name,
      actionType: "team_update",
      targetType: "team",
      targetId: teamId,
      pageKey: "teamManagement",
      beforeValue: "",
      afterValue: JSON.stringify({ fieldName, value }),
      ipAddress: getRequestIp(request),
      sessionId: auth.context.sessionId,
      success: true,
    })
  })
  return NextResponse.json({ ok: true })
}
