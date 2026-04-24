import { redirect } from "next/navigation"
import { NextResponse } from "next/server"
import { PermissionAction, PermissionIndex, UserRecord } from "@/lib/auth/model"
import { buildPermissionIndex, hasPermission } from "@/lib/auth/permissions"
import { resolveRequestSession } from "@/lib/auth/session"
import { getTeamName } from "@/lib/auth/store"

export type RequestAuthContext = {
  user: UserRecord
  permissionIndex: PermissionIndex
  sessionId: string
  teamName: string
}

export function getRequestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

export function getRequestUserAgent(request: Request) {
  return request.headers.get("user-agent") || "unknown"
}

export async function requirePageAuth() {
  const session = await resolveRequestSession()
  if (!session) return null
  const permissionIndex = buildPermissionIndex(session.state, session.user)
  return {
    user: session.user,
    permissionIndex,
    sessionId: session.sessionId,
    teamName: getTeamName(session.state, session.user.teamId),
    state: session.state,
  }
}

export async function requirePagePermission(menuKey: keyof PermissionIndex, action: PermissionAction = "view") {
  const session = await requirePageAuth()
  if (!session) redirect("/")
  if (!hasPermission(session.permissionIndex, menuKey, action)) redirect("/")
  return session
}

export async function requireApiPermission(menuKey: keyof PermissionIndex, action: PermissionAction = "view") {
  const session = await resolveRequestSession()
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 }),
    }
  }
  const permissionIndex = buildPermissionIndex(session.state, session.user)
  if (!hasPermission(permissionIndex, menuKey, action)) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 }),
    }
  }
  return {
    ok: true as const,
    context: {
      user: session.user,
      permissionIndex,
      sessionId: session.sessionId,
      teamName: getTeamName(session.state, session.user.teamId),
      state: session.state,
    } satisfies RequestAuthContext,
  }
}
