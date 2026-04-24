import { NextResponse } from "next/server"
import { requireApiPermission, getRequestIp } from "@/lib/auth/server"
import {
  appendActivityLog,
  appendUserChangeLog,
  createIndividualPassword,
  findUserById,
  updateAuthState,
} from "@/lib/auth/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await requireApiPermission("userManagement", "create")
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const name = String(body?.name || "").trim()
  const loginId = String(body?.loginId || name).trim()
  const role = String(body?.role || "staff").trim()
  const title = String(body?.title || "사원").trim()
  const teamId = String(body?.teamId || "").trim()
  const password = String(body?.password || "").trim()
  const assignedIndustries = Array.isArray(body?.assignedIndustries)
    ? body.assignedIndustries.map((item: unknown) => String(item || "").trim()).filter(Boolean)
    : []

  if (!name || !loginId || !teamId) {
    return NextResponse.json({ ok: false, error: "이름, 로그인ID, 팀은 필수입니다." }, { status: 400 })
  }

  await updateAuthState((state) => {
    if (state.users.some((user) => user.loginId === loginId && !user.deletedAt)) {
      throw new Error("이미 사용 중인 로그인ID입니다.")
    }
    const now = new Date().toISOString()
    const passwordData = password ? createIndividualPassword(password) : null
    const nextUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      loginId,
      name,
      title,
      assignedIndustries,
      role: role as any,
      teamId,
      active: true,
      deletedAt: null,
      authStrategy: passwordData ? "individual" : ("common" as const),
      passwordHash: passwordData?.hash || null,
      passwordSalt: passwordData?.salt || null,
      createdAt: now,
      updatedAt: now,
    }
    state.users.unshift(nextUser)
    appendActivityLog(state, {
      actorUserId: auth.context.user.id,
      actorName: auth.context.user.name,
      actionType: "user_create",
      targetType: "user",
      targetId: nextUser.id,
      pageKey: "userManagement",
      beforeValue: "",
      afterValue: JSON.stringify({ name, role, teamId }),
      ipAddress: getRequestIp(request),
      sessionId: auth.context.sessionId,
      success: true,
    })
  }).catch((error) => {
    throw error
  })

  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request) {
  const auth = await requireApiPermission("userManagement", "edit")
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null)
  const userId = String(body?.userId || "").trim()
  const fieldName = String(body?.fieldName || "").trim()
  const value = body?.value
  if (!userId || !fieldName) {
    return NextResponse.json({ ok: false, error: "대상 정보가 부족합니다." }, { status: 400 })
  }

  await updateAuthState((state) => {
    const target = findUserById(state, userId)
    if (!target) throw new Error("대상 사용자를 찾을 수 없습니다.")

    let nextValue = value
    if (typeof nextValue === "string") {
      nextValue = nextValue.trim()
    }

    if (fieldName === "name") {
      const nextName = String(nextValue || "").trim()
      if (!nextName) throw new Error("이름은 비워둘 수 없습니다.")
      const duplicate = state.users.find(
        (user) => user.id !== target.id && !user.deletedAt && (user.name === nextName || user.loginId === nextName),
      )
      if (duplicate) throw new Error("이미 사용 중인 이름입니다.")

      const beforeName = target.name
      const beforeValue = beforeName
      target.name = nextName

      if (target.authStrategy === "common" || target.loginId === beforeName) {
        target.loginId = nextName
      }

      target.updatedAt = new Date().toISOString()
      appendUserChangeLog(state, {
        targetUserId: target.id,
        changedByAdminId: auth.context.user.id,
        fieldName,
        beforeValue,
        afterValue: nextName,
      })
      appendActivityLog(state, {
        actorUserId: auth.context.user.id,
        actorName: auth.context.user.name,
        actionType: "user_update",
        targetType: "user",
        targetId: target.id,
        pageKey: "userManagement",
        beforeValue,
        afterValue: nextName,
        ipAddress: getRequestIp(request),
        sessionId: auth.context.sessionId,
        success: true,
      })
      return
    }

    const beforeValue = String((target as any)[fieldName] ?? "")
    ;(target as any)[fieldName] = nextValue
    target.updatedAt = new Date().toISOString()
    appendUserChangeLog(state, {
      targetUserId: target.id,
      changedByAdminId: auth.context.user.id,
      fieldName,
      beforeValue,
      afterValue: String(nextValue ?? ""),
    })
    appendActivityLog(state, {
      actorUserId: auth.context.user.id,
      actorName: auth.context.user.name,
      actionType: "user_update",
      targetType: "user",
      targetId: target.id,
      pageKey: "userManagement",
      beforeValue,
      afterValue: String(nextValue ?? ""),
      ipAddress: getRequestIp(request),
      sessionId: auth.context.sessionId,
      success: true,
    })
  }).catch((error) => {
    throw error
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const auth = await requireApiPermission("userManagement", "delete")
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const userId = String(body?.userId || "").trim()
  if (!userId) return NextResponse.json({ ok: false, error: "대상 사용자를 지정해주세요." }, { status: 400 })

  await updateAuthState((state) => {
    const target = findUserById(state, userId)
    if (!target) throw new Error("대상 사용자를 찾을 수 없습니다.")
    const deletedAt = target.deletedAt || new Date().toISOString()
    target.active = false
    target.deletedAt = deletedAt
    target.updatedAt = deletedAt
    state.userSessions = state.userSessions.filter((session) => session.userId !== userId)
    state.presenceSessions = state.presenceSessions.filter((session) => session.userId !== userId)
    appendActivityLog(state, {
      actorUserId: auth.context.user.id,
      actorName: auth.context.user.name,
      actionType: "user_delete",
      targetType: "user",
      targetId: userId,
      pageKey: "userManagement",
      beforeValue: "",
      afterValue: JSON.stringify({ deletedAt }),
      ipAddress: getRequestIp(request),
      sessionId: auth.context.sessionId,
      success: true,
    })
  }).catch((error) => {
    throw error
  })

  return NextResponse.json({ ok: true })
}
