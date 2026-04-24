import { NextResponse } from "next/server"
import { requireApiPermission, getRequestIp } from "@/lib/auth/server"
import { appendActivityLog, appendPermissionChangeLog, getRoleIdByName, updateAuthState } from "@/lib/auth/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PUT(request: Request) {
  const auth = await requireApiPermission("permissionManagement", "edit")
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const mode = String(body?.mode || "role")
  const roleId = String(body?.roleId || "").trim()
  const userId = String(body?.userId || "").trim()
  const menuKey = String(body?.menuKey || "").trim()
  const action = String(body?.action || "").trim()
  const allowed = Boolean(body?.allowed)

  await updateAuthState((state) => {
    if (mode === "user") {
      const existing = state.userPermissionOverrides.find(
        (item) => item.userId === userId && item.menuKey === menuKey && item.action === action,
      )
      const beforeValue = Boolean(existing?.allowed)
      if (existing) {
        existing.allowed = allowed
      } else {
        state.userPermissionOverrides.push({
          id: `uov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          userId,
          menuKey: menuKey as any,
          action: action as any,
          allowed,
        })
      }
      appendPermissionChangeLog(state, {
        targetUserId: userId,
        changedByAdminId: auth.context.user.id,
        menuKey: menuKey as any,
        action: action as any,
        beforeValue,
        afterValue: allowed,
      })
    } else {
      const existing = state.rolePermissions.find(
        (item) => item.roleId === roleId && item.menuKey === menuKey && item.action === action,
      )
      if (existing) existing.allowed = allowed
    }
    appendActivityLog(state, {
      actorUserId: auth.context.user.id,
      actorName: auth.context.user.name,
      actionType: "permission_update",
      targetType: mode === "user" ? "user_permission_override" : "role_permission",
      targetId: mode === "user" ? userId : roleId || getRoleIdByName(state, auth.context.user.role),
      pageKey: "permissionManagement",
      beforeValue: "",
      afterValue: JSON.stringify({ menuKey, action, allowed }),
      ipAddress: getRequestIp(request),
      sessionId: auth.context.sessionId,
      success: true,
    })
  })

  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request) {
  const auth = await requireApiPermission("permissionManagement", "edit")
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null)
  const userId = String(body?.userId || "").trim()
  await updateAuthState((state) => {
    state.userPermissionOverrides = state.userPermissionOverrides.filter((item) => item.userId !== userId)
    appendActivityLog(state, {
      actorUserId: auth.context.user.id,
      actorName: auth.context.user.name,
      actionType: "permission_override_reset",
      targetType: "user_permission_override",
      targetId: userId,
      pageKey: "permissionManagement",
      beforeValue: "",
      afterValue: "",
      ipAddress: getRequestIp(request),
      sessionId: auth.context.sessionId,
      success: true,
    })
  })
  return NextResponse.json({ ok: true })
}
