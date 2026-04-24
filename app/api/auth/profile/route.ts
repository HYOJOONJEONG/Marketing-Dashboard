import { NextResponse } from "next/server"
import { resolveRequestSession } from "@/lib/auth/session"
import { getRequestIp } from "@/lib/auth/server"
import { appendActivityLog, findUserById, updateAuthState } from "@/lib/auth/store"
import { normalizeAssignedIndustries } from "@/lib/industry-groups"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request) {
  const session = await resolveRequestSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const hasAssignedIndustries = Boolean(body && Object.prototype.hasOwnProperty.call(body, "assignedIndustries"))
  const hasAvatarEmoji = Boolean(body && Object.prototype.hasOwnProperty.call(body, "avatarEmoji"))

  if (!hasAssignedIndustries && !hasAvatarEmoji) {
    return NextResponse.json({ ok: false, error: "변경할 프로필 항목이 없습니다." }, { status: 400 })
  }

  const assignedIndustries = hasAssignedIndustries
    ? normalizeAssignedIndustries(body?.assignedIndustries)
    : undefined
  const avatarEmoji = hasAvatarEmoji
    ? String(body?.avatarEmoji || "").trim().slice(0, 4) || null
    : undefined

  let nextAssignedIndustries: string[] = []
  let nextAvatarEmoji: string | null = null

  await updateAuthState((state) => {
    const target = findUserById(state, session.user.id)
    if (!target) throw new Error("사용자 정보를 찾을 수 없습니다.")
    if (assignedIndustries) target.assignedIndustries = assignedIndustries
    if (hasAvatarEmoji) target.avatarEmoji = avatarEmoji ?? null
    target.updatedAt = new Date().toISOString()
    nextAssignedIndustries = normalizeAssignedIndustries(target.assignedIndustries)
    nextAvatarEmoji = target.avatarEmoji ? String(target.avatarEmoji).trim() : null
    appendActivityLog(state, {
      actorUserId: session.user.id,
      actorName: session.user.name,
      actionType: "profile_update",
      targetType: "user",
      targetId: session.user.id,
      pageKey: "me",
      beforeValue: "",
      afterValue: JSON.stringify({ assignedIndustries: nextAssignedIndustries, avatarEmoji: nextAvatarEmoji }),
      ipAddress: getRequestIp(request),
      sessionId: session.sessionId,
      success: true,
    })
  })

  return NextResponse.json({ ok: true, assignedIndustries: nextAssignedIndustries, avatarEmoji: nextAvatarEmoji })
}
