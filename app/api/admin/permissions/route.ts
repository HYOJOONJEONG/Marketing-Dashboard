import { NextResponse } from "next/server"
import { requireApiPermission, getRequestIp } from "@/lib/auth/server"
import { appendActivityLog, appendPermissionChangeLog, getRoleIdByName, updateAuthState } from "@/lib/auth/store"
import { MenuKey, PermissionAction } from "@/lib/auth/model"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PUT(request: Request) {
  const auth = await requireApiPermission("permissionManagement", "edit")
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const mode = String(body?.mode || "role")
  const roleId = String(body?.roleId || "").trim()
  const userId = String(body?.userId || "").trim()
  const updates = Array.isArray(body?.updates)
    ? body.updates
        .map((item: any) => ({
          menuKey: String(item?.menuKey || "").trim(),
          action: String(item?.action || "").trim(),
          allowed: Boolean(item?.allowed),
        }))
        .filter((item) => item.menuKey && item.action)
    : [
        {
          menuKey: String(body?.menuKey || "").trim(),
          action: String(body?.action || "").trim(),
          allowed: Boolean(body?.allowed),
        },
      ].filter((item) => item.menuKey && item.action)

  if (!updates.length) {
    return NextResponse.json({ ok: false, error: "변경할 권한이 없습니다." }, { status: 400 })
  }

  if (mode === "user" && !userId) {
    return NextResponse.json({ ok: false, error: "대상 사용자가 없습니다." }, { status: 400 })
  }

  if (mode !== "user" && !roleId) {
    return NextResponse.json({ ok: false, error: "대상 역할이 없습니다." }, { status: 400 })
  }

  await updateAuthState((state) => {
    updates.forEach(({ menuKey, action, allowed }) => {
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
            menuKey: menuKey as MenuKey,
            action: action as PermissionAction,
            allowed,
          })
        }
        appendPermissionChangeLog(state, {
          targetUserId: userId,
          changedByAdminId: auth.context.user.id,
          menuKey: menuKey as MenuKey,
          action: action as PermissionAction,
          beforeValue,
          afterValue: allowed,
        })
        return
      }

      const existing = state.rolePermissions.find(
        (item) => item.roleId === roleId && item.menuKey === menuKey && item.action === action,
      )
      if (existing) {
        existing.allowed = allowed
      }
    })

    appendActivityLog(state, {
      actorUserId: auth.context.user.id,
      actorName: auth.context.user.name,
      actionType: "permission_update",
      targetType: mode === "user" ? "user_permission_override" : "role_permission",
      targetId: mode === "user" ? userId : roleId || getRoleIdByName(state, auth.context.user.role),
      pageKey: "permissionManagement",
      beforeValue: "",
      afterValue: JSON.stringify({ updates }),
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
